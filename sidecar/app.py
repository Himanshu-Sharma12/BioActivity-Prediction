"""
Optional Python RDKit sidecar for BioPredictSafety.

Why this exists
---------------
The Node app uses RDKit compiled to WebAssembly (MinimalLib). MinimalLib does not
expose `FilterCatalog` or `QED`, so the Node side ships a hand-curated subset of 31
Brenk/PAINS SMARTS patterns. Full-fat Python RDKit has the complete catalogues
(PAINS_A/B/C, BRENK, NIH, CHEMBL, ZINC — roughly 960 patterns in total), the QED
drug-likeness score, and Murcko scaffold decomposition.

This service is strictly OPTIONAL. The Node app runs, and produces exactly the same
results it produces today, when this process is not running. Nothing here is a
prediction: every endpoint returns a deterministic substructure match or a published
formula evaluated against computed descriptors.

IMPORTANT — what these numbers are not
--------------------------------------
* A structural alert is a substructure match against a published list. It is not a
  toxicity probability and must never be presented as one.
* QED (Bickerton et al., Nature Chemistry 2012, 4:90-98) is a *drug-likeness
  desirability* score in [0, 1]. It is not a safety, toxicity or potency score.
"""

from __future__ import annotations

import os
from typing import Dict, List

import rdkit
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from rdkit import Chem, RDLogger
from rdkit.Chem import QED
from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams
from rdkit.Chem.Scaffolds import MurckoScaffold

# RDKit writes parse warnings to stderr for every bad input; this service validates
# untrusted SMILES on every request, so that output is pure noise.
RDLogger.DisableLog("rdApp.*")

# Hard cap on input length. A SMILES longer than this is not a drug-like small
# molecule and substructure matching against ~960 patterns can get expensive.
MAX_SMILES_LENGTH = int(os.environ.get("SIDECAR_MAX_SMILES_LENGTH", "4000"))

CATALOG_NAMES: List[str] = [
    "PAINS_A",
    "PAINS_B",
    "PAINS_C",
    "BRENK",
    "NIH",
    "CHEMBL",
    "ZINC",
]


def _build_catalogs() -> Dict[str, FilterCatalog]:
    """One FilterCatalog per catalogue.

    A single combined catalogue would match faster but would lose which published
    list a hit came from, and provenance is the entire point of reporting an alert.
    Catalogues absent from the installed RDKit build are skipped rather than raising,
    so a version bump cannot take the whole service down.
    """
    catalogs: Dict[str, FilterCatalog] = {}
    for name in CATALOG_NAMES:
        enum_value = getattr(FilterCatalogParams.FilterCatalogs, name, None)
        if enum_value is None:
            continue
        params = FilterCatalogParams()
        params.AddCatalog(enum_value)
        catalogs[name] = FilterCatalog(params)
    return catalogs


# Built once at import. Compiling ~960 SMARTS patterns per request would dominate
# the response time.
CATALOGS: Dict[str, FilterCatalog] = _build_catalogs()

app = FastAPI(
    title="BioPredictSafety RDKit sidecar",
    version="1.0.0",
    description=(
        "Optional cheminformatics endpoints that RDKit's WASM MinimalLib build "
        "cannot provide. Deterministic substructure matching and published "
        "descriptor formulas only — no toxicity predictions."
    ),
)


class SmilesRequest(BaseModel):
    smiles: str = Field(..., description="SMILES string. Canonicalised by the server.")


class AlertHit(BaseModel):
    catalog: str = Field(..., description="Catalogue the pattern came from, e.g. BRENK.")
    filterSet: str = Field(
        ...,
        description=(
            "Sub-catalogue the pattern belongs to, e.g. ChEMBL23_Dundee. Equal to the "
            "catalogue name for single-set catalogues such as BRENK."
        ),
    )
    description: str = Field(
        ..., description="The catalogue's own description of the pattern, e.g. phenol_ester."
    )
    matchedAtoms: List[int] = Field(
        default_factory=list,
        description="Atom indices of the match, against the canonical SMILES returned below.",
    )


class AlertsResponse(BaseModel):
    canonicalSmiles: str
    catalogues: List[str] = Field(
        ..., description="Catalogues actually screened for this request."
    )
    alerts: List[AlertHit]
    note: str


class QedProperties(BaseModel):
    MW: float
    ALOGP: float
    HBA: float
    HBD: float
    PSA: float
    ROTB: float
    AROM: float
    ALERTS: float


class QedResponse(BaseModel):
    canonicalSmiles: str
    qed: float = Field(..., description="Quantitative Estimate of Drug-likeness, 0-1.")
    properties: QedProperties
    citation: str
    note: str


class ScaffoldResponse(BaseModel):
    canonicalSmiles: str
    scaffold: str = Field(
        ..., description="Bemis-Murcko scaffold SMILES. Empty string for acyclic molecules."
    )
    isAcyclic: bool


class HealthResponse(BaseModel):
    status: str
    rdkit_version: str
    catalogues: List[str]
    patternCount: int


def _parse(smiles: str) -> Chem.Mol:
    """Parse or reject. Never fabricate a molecule for unparseable input."""
    if smiles is None or not smiles.strip():
        raise HTTPException(status_code=400, detail="smiles must be a non-empty string")
    if len(smiles) > MAX_SMILES_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"smiles exceeds {MAX_SMILES_LENGTH} characters",
        )
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="could not parse smiles")
    return mol


def _matched_atoms(entry, mol: Chem.Mol) -> List[int]:
    """Atom indices covered by a catalogue entry's matches.

    `atomPairs` maps (query atom index, molecule atom index); only the molecule side
    is meaningful to a caller that wants to highlight the substructure. Order is
    preserved and duplicates removed so repeated matches of the same pattern do not
    inflate the list.
    """
    seen: List[int] = []
    for match in entry.GetFilterMatches(mol):
        for _query_idx, mol_idx in match.atomPairs:
            if mol_idx not in seen:
                seen.append(mol_idx)
    return seen


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        rdkit_version=rdkit.__version__,
        catalogues=sorted(CATALOGS.keys()),
        patternCount=sum(c.GetNumEntries() for c in CATALOGS.values()),
    )


@app.post("/alerts", response_model=AlertsResponse)
def alerts(req: SmilesRequest) -> AlertsResponse:
    mol = _parse(req.smiles)
    # Match against the canonical form so that two spellings of the same molecule
    # always produce identical atom indices, matching the Node pipeline's contract.
    canonical = Chem.MolToSmiles(mol)
    mol = Chem.MolFromSmiles(canonical)

    hits: List[AlertHit] = []
    for name in sorted(CATALOGS):
        catalog = CATALOGS[name]
        for entry in catalog.GetMatches(mol):
            description = entry.GetDescription()
            # "FilterSet" names the sub-catalogue (CHEMBL and NIH are aggregates of
            # several published lists). Not every build sets it, hence the fallback.
            try:
                filter_set = entry.GetProp("FilterSet") or name
            except Exception:
                filter_set = name
            hits.append(
                AlertHit(
                    catalog=name,
                    filterSet=filter_set,
                    description=description,
                    matchedAtoms=_matched_atoms(entry, mol),
                )
            )

    return AlertsResponse(
        canonicalSmiles=canonical,
        catalogues=sorted(CATALOGS.keys()),
        alerts=hits,
        note=(
            "Substructure matches against published alert catalogues. "
            "An alert is not a toxicity prediction, and absence of an alert is not "
            "evidence of safety."
        ),
    )


@app.post("/qed", response_model=QedResponse)
def qed(req: SmilesRequest) -> QedResponse:
    mol = _parse(req.smiles)
    canonical = Chem.MolToSmiles(mol)
    props = QED.properties(mol)
    return QedResponse(
        canonicalSmiles=canonical,
        qed=float(QED.qed(mol)),
        properties=QedProperties(
            MW=float(props.MW),
            ALOGP=float(props.ALOGP),
            HBA=float(props.HBA),
            HBD=float(props.HBD),
            PSA=float(props.PSA),
            ROTB=float(props.ROTB),
            AROM=float(props.AROM),
            ALERTS=float(props.ALERTS),
        ),
        citation="Bickerton et al., Nature Chemistry 2012, 4:90-98",
        note=(
            "QED is a drug-likeness desirability score in [0, 1]. It is not a "
            "safety, toxicity or potency measure."
        ),
    )


@app.post("/scaffold", response_model=ScaffoldResponse)
def scaffold(req: SmilesRequest) -> ScaffoldResponse:
    mol = _parse(req.smiles)
    canonical = Chem.MolToSmiles(mol)
    core = MurckoScaffold.GetScaffoldForMol(mol)
    # An acyclic molecule has no Bemis-Murcko framework; RDKit returns an empty
    # molecule rather than an error, so report that explicitly.
    scaffold_smiles = Chem.MolToSmiles(core) if core is not None else ""
    return ScaffoldResponse(
        canonicalSmiles=canonical,
        scaffold=scaffold_smiles,
        isAcyclic=scaffold_smiles == "",
    )

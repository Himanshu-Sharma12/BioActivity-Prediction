# RDKit sidecar (optional)

A small FastAPI service wrapping **full Python RDKit**. It is an *enhancement*, never a
dependency: with this process stopped, the Node application behaves exactly as it does
today. Nothing in `server/` requires it, and no request waits on it.

## Why it exists

The Node app uses RDKit compiled to WebAssembly (`@rdkit/rdkit`, MinimalLib). MinimalLib
does not export `FilterCatalog` or `QED`, so `server/services/structural-alerts.ts` ships a
hand-curated subset of **31** Brenk/PAINS SMARTS patterns. Python RDKit has:

| Capability | WASM MinimalLib | This sidecar |
|---|---|---|
| Brenk / PAINS alerts | 31 curated SMARTS | complete catalogues (PAINS_A/B/C, BRENK, NIH, CHEMBL, ZINC) |
| QED drug-likeness | not available | `rdkit.Chem.QED` |
| Bemis-Murcko scaffold | not available | `rdkit.Chem.Scaffolds.MurckoScaffold` |

`GET /health` reports the exact pattern count for the installed RDKit build, so the number
is never asserted from memory. On RDKit 2026.03.6 the seven catalogues above total
**1585** patterns (measured, not estimated).

## What these numbers are — and are not

* A **structural alert** is a deterministic substructure match against a published list.
  It is *not* a toxicity probability. Absence of an alert is *not* evidence of safety.
* **QED** (Bickerton et al., *Nature Chemistry* 2012, 4:90-98) is a drug-likeness
  desirability score in `[0, 1]`. It is *not* a safety, toxicity or potency score and must
  never be displayed as one.

## Running it

### Docker (recommended)

```bash
docker build -t biopredict-rdkit-sidecar ./sidecar
docker run --rm -p 8000:8000 biopredict-rdkit-sidecar
```

### Local Python (3.10+)

Create the virtualenv **outside the repository** so it is never packaged or committed:

```bash
python3 -m venv ~/.venvs/biopredict-sidecar
source ~/.venvs/biopredict-sidecar/bin/activate
pip install -r sidecar/requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000 --app-dir sidecar
```

### Pointing the Node app at it

```bash
# .env
RDKIT_SIDECAR_URL=http://127.0.0.1:8000
```

Leave the variable **unset** to disable the sidecar entirely. When it is unset the Node
client short-circuits before any network call is attempted — see
`server/services/sidecar.ts`.

## Endpoints

All POST endpoints take `{"smiles": "<SMILES>"}` and return `400` for input RDKit cannot
parse. Nothing is fabricated for invalid input.

### `GET /health`

```json
{
  "status": "ok",
  "rdkit_version": "2026.03.6",
  "catalogues": ["BRENK", "CHEMBL", "NIH", "PAINS_A", "PAINS_B", "PAINS_C", "ZINC"],
  "patternCount": 1585
}
```

### `POST /alerts`

```json
{
  "canonicalSmiles": "CC(=O)Oc1ccccc1C(=O)O",
  "catalogues": ["BRENK", "CHEMBL", "NIH", "PAINS_A", "PAINS_B", "PAINS_C", "ZINC"],
  "alerts": [
    {
      "catalog": "BRENK",
      "filterSet": "Brenk",
      "description": "phenol_ester",
      "matchedAtoms": [5, 6, 7, 8, 9, 4, 3, 1, 2, 0]
    }
  ],
  "note": "Substructure matches against published alert catalogues. ..."
}
```

Matching is done on the **canonical** SMILES, so two spellings of the same molecule give
identical atom indices — the same contract the Node pipeline uses.

`filterSet` names the sub-catalogue: `CHEMBL` and `NIH` aggregate several published lists
(`ChEMBL23_Dundee`, `ChEMBL23_SureChEMBL`, …), while `BRENK` has a single set.

### `POST /qed`

```json
{
  "canonicalSmiles": "...",
  "qed": 0.5501217966938848,
  "properties": { "MW": 180.159, "ALOGP": 1.3101, "HBA": 4.0, "HBD": 1.0, "PSA": 63.6, "ROTB": 2.0, "AROM": 1.0, "ALERTS": 2.0 },
  "citation": "Bickerton et al., Nature Chemistry 2012, 4:90-98",
  "note": "QED is a drug-likeness desirability score in [0, 1]. ..."
}
```

### `POST /scaffold`

```json
{ "canonicalSmiles": "CC(=O)Oc1ccccc1C(=O)O", "scaffold": "c1ccccc1", "isAcyclic": false }
```

`HBA` and `ALERTS` here are QED's *own* internal property definitions and deliberately do
not have to equal the app's `hbaCount` or its structural-alert count. Aspirin gives
`HBA: 4` from QED against `hbaCount: 3` from the descriptor pipeline; both are correct
under their own definition.

Acyclic molecules have no Bemis-Murcko framework; `scaffold` is `""` and `isAcyclic` is
`true` rather than an error.

## Version pinning

`requirements.txt` pins `rdkit==2026.3.6`, the same release line as the Node package
`@rdkit/rdkit@2026.3.6`, so descriptors computed on either side agree. Bump both together
or the two runtimes can disagree on the same molecule.

## Operational notes

* Single uvicorn worker by default — the catalogues are compiled SMARTS held per process.
  Scale with replicas rather than workers.
* Verified on RDKit 2026.03.6: aspirin (`CC(=O)Oc1ccccc1C(=O)O`) gives `qed = 0.5501`,
  and rhodanine (`O=C1CSC(=S)N1`) matches `PAINS_B / rhod_sat_A(33)`.
* The Node client uses a ~2.5 s timeout and a circuit breaker, so a hung or dead sidecar
  degrades the app to its built-in behaviour instead of slowing every request.
* The service holds no state and needs no database, secrets or network egress.

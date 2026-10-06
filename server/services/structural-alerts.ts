import { getRDKit } from "./rdkit";

/**
 * Published structural alerts, matched as SMARTS against the molecule.
 *
 * These are deterministic substructure searches, not predictions. An alert means
 * "this molecule contains a substructure that the cited authors associated with a
 * liability" — it is evidence to look at, not a probability of harm.
 *
 * Sources:
 *  - Brenk et al., "Lessons Learnt from Assembling Screening Libraries for Drug
 *    Discovery for Neglected Diseases", ChemMedChem 2008, 3:435-444.
 *  - Baell & Holloway, "New Substructure Filters for Removal of Pan Assay
 *    Interference Compounds (PAINS)", J Med Chem 2010, 53:2719-2740.
 *
 * Note: RDKit's full FilterCatalog (the complete ~480 Brenk / ~480 PAINS sets) is
 * not exposed in the WASM MinimalLib build, so this is a curated subset of the most
 * frequently cited alerts rather than the complete catalogues. `coverage` below
 * states that plainly so the UI can too.
 */

export type AlertSeverity = "high" | "moderate" | "low";

export interface StructuralAlert {
  id: string;
  name: string;
  smarts: string;
  severity: AlertSeverity;
  concern: string;
  source: "Brenk" | "PAINS";
}

export const ALERT_COVERAGE = {
  brenk: "curated subset (25 of ~105 Brenk alerts)",
  pains: "curated subset (6 of ~480 PAINS_A patterns)",
  note: "Absence of an alert is not evidence of safety.",
} as const;

export const STRUCTURAL_ALERTS: StructuralAlert[] = [
  // --- Reactive / electrophilic groups (Brenk) ---
  { id: "acyl-halide",     name: "Acyl halide",            smarts: "[CX3](=[OX1])[F,Cl,Br,I]", severity: "high",     source: "Brenk", concern: "Highly reactive acylating agent; non-specific protein binding." },
  { id: "alkyl-halide",    name: "Alkyl halide",           smarts: "[CX4][Cl,Br,I]",           severity: "moderate", source: "Brenk", concern: "Potential alkylating agent; genotoxicity risk." },
  { id: "aldehyde",        name: "Aldehyde",               smarts: "[CX3H1](=O)[#6]",          severity: "moderate", source: "Brenk", concern: "Reactive electrophile; forms covalent adducts with lysine residues." },
  { id: "epoxide",         name: "Epoxide",                smarts: "C1OC1",                    severity: "high",     source: "Brenk", concern: "Strained electrophile; established genotoxic and mutagenic liability." },
  { id: "aziridine",       name: "Aziridine",              smarts: "C1NC1",                    severity: "high",     source: "Brenk", concern: "Strained electrophile; DNA alkylation." },
  { id: "isocyanate",      name: "Isocyanate",             smarts: "[NX2]=[CX2]=[OX1]",        severity: "high",     source: "Brenk", concern: "Highly reactive; respiratory sensitiser." },
  { id: "michael-acceptor",name: "Michael acceptor",       smarts: "[CX3]=[CX3][CX3]=[OX1]",   severity: "moderate", source: "Brenk", concern: "Covalent reactivity with cysteine thiols." },
  { id: "acyl-cyanide",    name: "Acyl cyanide",           smarts: "[CX3](=O)C#N",             severity: "high",     source: "Brenk", concern: "Highly reactive electrophile." },
  { id: "sulfonyl-halide", name: "Sulfonyl halide",        smarts: "[SX4](=O)(=O)[F,Cl,Br,I]", severity: "high",     source: "Brenk", concern: "Strong acylating agent; non-selective covalent binding." },

  // --- Genotoxicity-associated (Brenk) ---
  // Nitro is canonicalised by RDKit as charge-separated [N+](=O)[O-], so both the
  // neutral pentavalent and the zwitterionic forms must be matched or every
  // nitroaromatic silently passes.
  { id: "nitro-aromatic",  name: "Aromatic nitro group",   smarts: "[a][$([NX3](=O)=O),$([NX3+](=O)[O-])]", severity: "high", source: "Brenk", concern: "Nitroreduction to reactive intermediates; frequent Ames positive." },
  { id: "nitro-aliphatic", name: "Aliphatic nitro group",  smarts: "[CX4][$([NX3](=O)=O),$([NX3+](=O)[O-])]", severity: "moderate", source: "Brenk", concern: "Potential for reactive nitroso metabolites." },
  { id: "azo",             name: "Azo group",              smarts: "[#6][NX2]=[NX2][#6]",      severity: "high",     source: "Brenk", concern: "Reductive cleavage can release mutagenic aromatic amines." },
  { id: "aniline",         name: "Aniline",                smarts: "[NX3;H2][c]",              severity: "moderate", source: "Brenk", concern: "Metabolic activation to hydroxylamines; methaemoglobinaemia and genotoxicity." },
  { id: "hydrazine",       name: "Hydrazine",              smarts: "[NX3][NX3]",               severity: "high",     source: "Brenk", concern: "Established hepatotoxicant and mutagen." },
  { id: "n-nitroso",       name: "N-nitroso group",        smarts: "[NX3][NX2]=[OX1]",         severity: "high",     source: "Brenk", concern: "Nitrosamine class; potent genotoxic carcinogens." },
  { id: "azide",           name: "Azide",                  smarts: "[NX2]=[NX2+]=[NX1-]",      severity: "high",     source: "Brenk", concern: "Toxic and potentially explosive; unsuitable for development." },
  { id: "diazo",           name: "Diazo compound",         smarts: "[#6]=[NX2+]=[NX1-]",       severity: "high",     source: "Brenk", concern: "Unstable, carbene precursor, alkylating." },

  // --- Metabolic / organ-toxicity liabilities (Brenk) ---
  { id: "thiol",           name: "Free thiol",             smarts: "[SX2H]",                   severity: "moderate", source: "Brenk", concern: "Oxidative instability; disulfide scrambling with proteins." },
  { id: "phenol-ester",    name: "Phenolic ester",         smarts: "[cX3][OX2][CX3]=[OX1]",    severity: "low",      source: "Brenk", concern: "Hydrolytically labile; rapid plasma clearance." },
  { id: "hydroquinone",    name: "Hydroquinone",           smarts: "[OX2H]c1ccc([OX2H])cc1",   severity: "high",     source: "Brenk", concern: "Redox cycling to quinones; oxidative stress and hepatotoxicity." },
  { id: "catechol",        name: "Catechol",               smarts: "[OX2H]c1ccccc1[OX2H]",     severity: "moderate", source: "Brenk", concern: "Quinone formation; COMT substrate; assay interference." },
  { id: "quinone",         name: "Quinone",                smarts: "O=C1C=CC(=O)C=C1",         severity: "high",     source: "Brenk", concern: "Redox cycling and covalent protein binding; hepatotoxicity." },
  { id: "thiocarbonyl",    name: "Thiocarbonyl",           smarts: "[CX3]=[SX1]",              severity: "moderate", source: "Brenk", concern: "Bioactivation to reactive sulfur species; hepatotoxicity." },
  { id: "perhalo-methyl",  name: "Trihalomethyl",          smarts: "[CX4]([F,Cl,Br,I])([F,Cl,Br,I])[F,Cl,Br,I]", severity: "low", source: "Brenk", concern: "Potential for reactive metabolite formation." },
  { id: "phosphorus-ester",name: "Phosphate/phosphonate ester", smarts: "[PX4](=O)([OX2])[OX2]", severity: "moderate", source: "Brenk", concern: "Cholinesterase inhibition potential; poor oral absorption." },

  // --- Assay interference (PAINS) ---
  { id: "pains-catechol",  name: "Catechol (PAINS A)",     smarts: "c1cc([OX2H])c([OX2H])cc1", severity: "moderate", source: "PAINS", concern: "Frequent-hitter; redox-active assay interference." },
  { id: "pains-quinone",   name: "Quinone (PAINS A)",      smarts: "O=C1C=CC(=O)c2ccccc12",    severity: "high",     source: "PAINS", concern: "Pan-assay interference via redox cycling." },
  // Ring order is S-C(=S)-N-C(=O)-C; written the other way round it matches nothing.
  { id: "pains-rhodanine", name: "Rhodanine",              smarts: "O=C1CSC(=S)N1",            severity: "high",     source: "PAINS", concern: "Notorious frequent-hitter; promiscuous across unrelated assays." },
  { id: "pains-phenolic-mannich", name: "Phenolic Mannich base", smarts: "[OX2H]c1ccccc1C[NX3]", severity: "moderate", source: "PAINS", concern: "Releases reactive quinone methide." },
  { id: "pains-enone",     name: "Aryl enone",             smarts: "c[CX3](=O)[CX3]=[CX3]",    severity: "moderate", source: "PAINS", concern: "Michael acceptor; non-specific thiol reactivity." },
  { id: "pains-azo-aryl",  name: "Aryl azo (PAINS A)",     smarts: "c[NX2]=[NX2]c",            severity: "high",     source: "PAINS", concern: "Chromophore interference and reductive cleavage." },
];

export interface AlertMatch {
  id: string;
  name: string;
  severity: AlertSeverity;
  concern: string;
  source: "Brenk" | "PAINS";
  /** Atom indices of the matched substructure, for highlighting in the UI. */
  matchedAtoms: number[];
}

/**
 * Compiled SMARTS are cached because get_qmol allocates in the WASM heap and the
 * pattern set is fixed. They are deliberately never deleted — one allocation per
 * pattern for the process lifetime, rather than per request.
 */
let compiled: Map<string, any> | null = null;

async function getCompiledPatterns(): Promise<Map<string, any>> {
  if (compiled) return compiled;
  const RDKit = await getRDKit();
  const map = new Map<string, any>();
  for (const alert of STRUCTURAL_ALERTS) {
    const q = RDKit.get_qmol(alert.smarts);
    if (q) map.set(alert.id, q);
    // A pattern that fails to compile is skipped rather than throwing, so one bad
    // SMARTS cannot take down analysis of every molecule.
  }
  compiled = map;
  return map;
}

export async function findStructuralAlerts(smiles: string): Promise<AlertMatch[]> {
  if (!smiles || smiles.trim().length === 0) return [];

  const RDKit = await getRDKit();
  const patterns = await getCompiledPatterns();
  const mol = RDKit.get_mol(smiles);
  if (!mol) return [];

  const matches: AlertMatch[] = [];
  try {
    for (const alert of STRUCTURAL_ALERTS) {
      const q = patterns.get(alert.id);
      if (!q) continue;

      const raw = mol.get_substruct_matches(q);
      const hits = raw ? JSON.parse(raw) : [];
      if (Array.isArray(hits) && hits.length > 0) {
        matches.push({
          id: alert.id,
          name: alert.name,
          severity: alert.severity,
          concern: alert.concern,
          source: alert.source,
          matchedAtoms: hits[0]?.atoms ?? [],
        });
      }
    }
  } finally {
    mol.delete();
  }
  return matches;
}

import initRDKitModule from "@rdkit/rdkit";
import type { MolecularDescriptors } from "@shared/schema";

/**
 * Real cheminformatics, backed by RDKit compiled to WASM.
 *
 * This replaces the previous regex-over-SMILES arithmetic in molecular.ts, which
 * miscounted chlorine as carbon, missed aromatic lowercase atoms, estimated hydrogen
 * count as `heavyAtoms * 2`, and derived ring count from `/\d/g.length / 2`.
 * Every value below comes from the same C++ code that Python RDKit uses.
 */

// Emscripten instantiates a fresh 7MB module per call, so this must be a singleton.
let rdkitPromise: Promise<any> | null = null;

export function getRDKit(): Promise<any> {
  if (!rdkitPromise) {
    rdkitPromise = initRDKitModule().then((RDKit: any) => {
      // RDKit writes parse warnings straight to stderr, which is noisy for a server
      // that validates untrusted input on every request.
      RDKit.disable_logging();
      return RDKit;
    });
  }
  return rdkitPromise;
}

/** Warm the WASM module at boot so the first request doesn't pay the ~95ms init. */
export function warmRDKit(): void {
  void getRDKit();
}

export interface MoleculeAnalysis {
  canonicalSmiles: string;
  inchiKey: string;
  molecularFormula: string;
  descriptors: MolecularDescriptors;
  /** Server-rendered 2D structure, so the client never downloads 2.4MB of WASM. */
  svg: string;
}

/**
 * RDKit returns null for unparseable input and also validates valence, so
 * pentavalent carbon is rejected rather than silently accepted.
 * Note: get_mol("") returns a *valid* empty molecule, hence the explicit guard.
 */
export async function isValidSmiles(smiles: string): Promise<boolean> {
  if (!smiles || smiles.trim().length === 0) return false;
  const RDKit = await getRDKit();
  const mol = RDKit.get_mol(smiles);
  if (!mol) return false;
  mol.delete();
  return true;
}

export async function analyzeSmiles(smiles: string): Promise<MoleculeAnalysis | null> {
  if (!smiles || smiles.trim().length === 0) return null;

  const RDKit = await getRDKit();
  const mol = RDKit.get_mol(smiles);
  if (!mol) return null;

  try {
    const d = JSON.parse(mol.get_descriptors());

    return {
      canonicalSmiles: mol.get_smiles(),
      inchiKey: RDKit.get_inchikey_for_inchi(mol.get_inchi()),
      molecularFormula: molecularFormulaFrom(JSON.parse(mol.get_json())),
      descriptors: {
        molecularWeight: round(d.amw),
        logP: round(d.CrippenClogP),
        tpsa: round(d.tpsa),
        rotatableBonds: d.NumRotatableBonds,
        hbdCount: d.NumHBD,
        hbaCount: d.NumHBA,
        atomCount: d.NumHeavyAtoms,
        ringCount: d.NumRings,
      },
      svg: mol.get_svg(320, 240),
    };
  } finally {
    // Mandatory: WASM heap objects are not garbage collected. Omitting this
    // leaks ~8KB per molecule and will eventually OOM a long-lived server.
    mol.delete();
  }
}

/**
 * Lipinski's Rule of Five — Lipinski et al., Adv Drug Deliv Rev 1997.
 * Deterministic and citable. RDKit exposes the inputs but not the rule itself.
 */
export function checkLipinski(d: MolecularDescriptors) {
  const rules = [
    { name: "Molecular weight ≤ 500", passed: d.molecularWeight <= 500, value: d.molecularWeight, threshold: 500 },
    { name: "LogP ≤ 5", passed: d.logP <= 5, value: d.logP, threshold: 5 },
    { name: "H-bond donors ≤ 5", passed: d.hbdCount <= 5, value: d.hbdCount, threshold: 5 },
    { name: "H-bond acceptors ≤ 10", passed: d.hbaCount <= 10, value: d.hbaCount, threshold: 10 },
  ];
  const violations = rules.filter((r) => !r.passed).length;
  // Ro5 permits a single violation.
  return { rules, violations, passed: violations <= 1 };
}

/** Veber et al., J Med Chem 2002 — oral bioavailability. */
export function checkVeber(d: MolecularDescriptors) {
  const rules = [
    { name: "Rotatable bonds ≤ 10", passed: d.rotatableBonds <= 10, value: d.rotatableBonds, threshold: 10 },
    { name: "TPSA ≤ 140 Å²", passed: d.tpsa <= 140, value: d.tpsa, threshold: 140 },
  ];
  return { rules, violations: rules.filter((r) => !r.passed).length, passed: rules.every((r) => r.passed) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Atomic number -> symbol, covering the elements that appear in drug-like molecules.
const ELEMENTS: Record<number, string> = {
  1: "H", 5: "B", 6: "C", 7: "N", 8: "O", 9: "F", 11: "Na", 12: "Mg", 14: "Si",
  15: "P", 16: "S", 17: "Cl", 19: "K", 20: "Ca", 26: "Fe", 30: "Zn", 33: "As",
  34: "Se", 35: "Br", 53: "I", 78: "Pt",
};

/**
 * MinimalLib exposes no molecular formula, so derive it from the atom graph.
 * RDKit's JSON omits fields equal to the defaults (z=6 for carbon, impHs=0),
 * hence the fallbacks. Output uses Hill notation: C, then H, then alphabetical.
 */
function molecularFormulaFrom(molJson: any): string {
  const atoms = molJson?.molecules?.[0]?.atoms;
  if (!Array.isArray(atoms)) return "";

  const counts: Record<string, number> = {};
  let hydrogens = 0;

  for (const atom of atoms) {
    const symbol = ELEMENTS[atom.z ?? 6];
    if (!symbol) return ""; // unknown element: better empty than wrong
    counts[symbol] = (counts[symbol] ?? 0) + 1;
    hydrogens += atom.impHs ?? 0;
  }
  if (hydrogens > 0) counts.H = (counts.H ?? 0) + hydrogens;

  const part = (sym: string) => (counts[sym] === 1 ? sym : `${sym}${counts[sym]}`);
  const ordered = Object.keys(counts)
    .filter((s) => s !== "C" && s !== "H")
    .sort();

  return [
    counts.C ? part("C") : "",
    counts.H ? part("H") : "",
    ...ordered.map(part),
  ].join("");
}

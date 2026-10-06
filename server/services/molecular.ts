import { analyzeSmiles } from "./rdkit";

/**
 * Compound naming.
 *
 * This file previously also computed molecular descriptors by running regular
 * expressions over the SMILES string — counting /C/g (which matched the C in "Cl"),
 * estimating hydrogens as `heavyAtoms * 2`, and deriving ring count from the number
 * of digit characters divided by two. All of that has been removed in favour of
 * RDKit; see rdkit.ts. Only name resolution remains here.
 */
export class MolecularCalculator {
  /**
   * A small lookup of common compounds, used when PubChem cannot resolve a name.
   * Keys are matched against the RDKit canonical SMILES so that equivalent
   * spellings of the same molecule all resolve — previously this was a raw string
   * comparison, so "CC(=O)Oc1ccccc1C(=O)O" hit but the equivalent
   * "CC(=O)OC1=CC=CC=C1C(=O)O" needed its own duplicate entry.
   */
  private static readonly COMMON_NAMES: Record<string, string> = {
    C: "Methane",
    CC: "Ethane",
    CCC: "Propane",
    CCCC: "Butane",
    O: "Water",
    CO: "Methanol",
    CCO: "Ethanol",
    CCN: "Ethylamine",
    "CC(=O)O": "Acetic acid",
    c1ccccc1: "Benzene",
    "Cn1c(=O)c2c(ncn2C)n(C)c1=O": "Caffeine",
    "CC(C)Cc1ccc(C(C)C(=O)O)cc1": "Ibuprofen",
    "CC(=O)Oc1ccccc1C(=O)O": "Aspirin",
  };

  /**
   * Resolve a display name for a structure. Falls back to the molecular formula,
   * which is computed by RDKit rather than by counting letters in the SMILES.
   */
  static async generateCompoundName(smiles: string): Promise<string> {
    const analysis = await analyzeSmiles(smiles);
    if (!analysis) return "Unknown compound";

    const known = this.COMMON_NAMES[analysis.canonicalSmiles];
    if (known) return known;

    return analysis.molecularFormula || "Unknown compound";
  }
}

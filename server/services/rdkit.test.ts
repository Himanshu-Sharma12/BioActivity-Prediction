import { describe, it, expect } from "vitest";
import { analyzeSmiles, isValidSmiles, checkLipinski, checkVeber } from "./rdkit";

/**
 * Reference values are from PubChem, not from this code — the point is to catch
 * the class of bug that shipped previously, where descriptors were plausible-looking
 * but wrong (chlorine counted as carbon, hydrogens estimated as heavyAtoms * 2).
 */
const REFERENCE = [
  { name: "aspirin",   smiles: "CC(=O)Oc1ccccc1C(=O)O",        formula: "C9H8O4",    mw: 180.16, tpsa: 63.6,  hbd: 1, hba: 3 },
  { name: "caffeine",  smiles: "CN1C=NC2=C1C(=O)N(C)C(=O)N2C", formula: "C8H10N4O2", mw: 194.19, tpsa: 61.82, hbd: 0, hba: 3 },
  { name: "ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",   formula: "C13H18O2",  mw: 206.28, tpsa: 37.3,  hbd: 1, hba: 1 },
];

describe("analyzeSmiles", () => {
  for (const c of REFERENCE) {
    it(`computes correct descriptors for ${c.name}`, async () => {
      const r = await analyzeSmiles(c.smiles);
      expect(r).not.toBeNull();
      expect(r!.molecularFormula).toBe(c.formula);
      expect(r!.descriptors.molecularWeight).toBeCloseTo(c.mw, 1);
      expect(r!.descriptors.tpsa).toBeCloseTo(c.tpsa, 1);
      expect(r!.descriptors.hbdCount).toBe(c.hbd);
      expect(r!.descriptors.hbaCount).toBe(c.hba);
    });
  }

  it("does not count chlorine as carbon", async () => {
    // The previous regex implementation matched /C/g, so "ClC(Cl)Cl" read as
    // 4 carbons. Chloroform is CHCl3: one carbon, three chlorines.
    const r = await analyzeSmiles("ClC(Cl)Cl");
    expect(r!.molecularFormula).toBe("CHCl3");
    expect(r!.descriptors.atomCount).toBe(4); // 1 C + 3 Cl, hydrogens implicit
    expect(r!.descriptors.molecularWeight).toBeCloseTo(119.38, 1);
  });

  it("handles aromatic lowercase atoms", async () => {
    // /C/g missed lowercase aromatic carbons entirely.
    const r = await analyzeSmiles("c1ccccc1");
    expect(r!.molecularFormula).toBe("C6H6");
    expect(r!.descriptors.ringCount).toBe(1);
  });

  it("is deterministic across repeated calls", async () => {
    // The old prediction path injected Math.random(), so identical input gave
    // different safety numbers on every request.
    const a = await analyzeSmiles("CN1C=NC2=C1C(=O)N(C)C(=O)N2C");
    const b = await analyzeSmiles("CN1C=NC2=C1C(=O)N(C)C(=O)N2C");
    expect(a!.descriptors).toEqual(b!.descriptors);
    expect(a!.inchiKey).toBe(b!.inchiKey);
  });

  it("produces the canonical InChIKey for caffeine", async () => {
    const r = await analyzeSmiles("CN1C=NC2=C1C(=O)N(C)C(=O)N2C");
    expect(r!.inchiKey).toBe("RYYVLZVUVIJVGH-UHFFFAOYSA-N");
  });

  it("canonicalises equivalent SMILES to the same structure", async () => {
    const a = await analyzeSmiles("CC(=O)Oc1ccccc1C(=O)O");
    const b = await analyzeSmiles("CC(=O)OC1=CC=CC=C1C(=O)O");
    expect(a!.canonicalSmiles).toBe(b!.canonicalSmiles);
  });
});

describe("isValidSmiles", () => {
  it.each([
    ["C1CC", "unclosed ring"],
    ["not_a_smiles", "nonsense text"],
    ["C(C)(C)(C)(C)C", "pentavalent carbon"],
    ["", "empty string"],
    ["   ", "whitespace only"],
  ])("rejects %s (%s)", async (smiles) => {
    expect(await isValidSmiles(smiles)).toBe(false);
  });

  it.each([["CCO"], ["c1ccccc1"], ["CC(=O)Oc1ccccc1C(=O)O"]])(
    "accepts valid SMILES %s",
    async (smiles) => {
      expect(await isValidSmiles(smiles)).toBe(true);
    },
  );
});

describe("drug-likeness rules", () => {
  it("passes aspirin on Lipinski with zero violations", async () => {
    const r = await analyzeSmiles("CC(=O)Oc1ccccc1C(=O)O");
    const lip = checkLipinski(r!.descriptors);
    expect(lip.violations).toBe(0);
    expect(lip.passed).toBe(true);
  });

  it("flags a large lipophilic molecule", async () => {
    // Cyclosporine-like bulk: well outside Ro5.
    const r = await analyzeSmiles("CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC(=O)O");
    const lip = checkLipinski(r!.descriptors);
    expect(lip.violations).toBeGreaterThan(0);
  });

  it("applies Veber thresholds", async () => {
    const r = await analyzeSmiles("CC(=O)Oc1ccccc1C(=O)O");
    const veber = checkVeber(r!.descriptors);
    expect(veber.passed).toBe(true);
  });
});

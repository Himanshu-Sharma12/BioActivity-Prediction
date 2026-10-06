import { describe, it, expect } from "vitest";
import { MolecularCanvasService } from "./molecular-canvas";

describe("MolecularCanvasService", () => {
  it("converts canonical SMILES (phenol) to 2D graph with atoms and bonds", async () => {
    const result = await MolecularCanvasService.smilesToGraph("c1ccccc1O");
    expect(result.valid).toBe(true);
    expect(result.canonicalSmiles).toBe("Oc1ccccc1");
    expect(result.atoms.length).toBe(7); // 6 Carbons + 1 Oxygen
    expect(result.bonds.length).toBe(7); // 6 aromatic ring bonds + 1 C-O bond
    expect(result.descriptors?.molecularWeight).toBeGreaterThan(90);
    expect(result.svg).toContain("<svg");
  });

  it("converts Aspirin to 2D graph with valid coordinates and properties", async () => {
    const result = await MolecularCanvasService.smilesToGraph("CC(=O)Oc1ccccc1C(=O)O");
    expect(result.valid).toBe(true);
    expect(result.atoms.length).toBe(13);
    expect(result.descriptors?.molecularWeight).toBeCloseTo(180.16, 1);
  });

  it("rejects invalid chemical SMILES gracefully", async () => {
    const result = await MolecularCanvasService.smilesToGraph("C12345Invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("converts user-drawn canvas atoms and bonds to canonical SMILES (ethanol)", async () => {
    const atoms = [
      { id: 0, x: 0, y: 0, element: "C" },
      { id: 1, x: 1.5, y: 0, element: "C" },
      { id: 2, x: 2.25, y: 1.3, element: "O" },
    ];
    const bonds = [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 1 },
    ];

    const result = await MolecularCanvasService.graphToSmiles(atoms, bonds);
    expect(result.valid).toBe(true);
    expect(result.canonicalSmiles).toBe("CCO");
    expect(result.descriptors?.molecularWeight).toBeCloseTo(46.07, 1);
  });

  it("converts drawn benzene ring to canonical SMILES c1ccccc1", async () => {
    // 6-carbon ring with alternating single and double bonds
    const atoms = [
      { id: 0, x: 1.5, y: 0, element: "C" },
      { id: 1, x: 0.75, y: -1.3, element: "C" },
      { id: 2, x: -0.75, y: -1.3, element: "C" },
      { id: 3, x: -1.5, y: 0, element: "C" },
      { id: 4, x: -0.75, y: 1.3, element: "C" },
      { id: 5, x: 0.75, y: 1.3, element: "C" },
    ];
    const bonds = [
      { from: 0, to: 1, order: 1 },
      { from: 1, to: 2, order: 2 },
      { from: 2, to: 3, order: 1 },
      { from: 3, to: 4, order: 2 },
      { from: 4, to: 5, order: 1 },
      { from: 5, to: 0, order: 2 },
    ];

    const result = await MolecularCanvasService.graphToSmiles(atoms, bonds);
    expect(result.valid).toBe(true);
    expect(result.canonicalSmiles).toBe("c1ccccc1");
  });
});

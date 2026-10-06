import { describe, it, expect } from "vitest";
import { assessCompound, buildSafetyProfile } from "./safety";
import { findStructuralAlerts, STRUCTURAL_ALERTS } from "./structural-alerts";
import { getRDKit } from "./rdkit";

describe("structural alerts", () => {
  it("every shipped SMARTS pattern compiles", async () => {
    const RDKit = await getRDKit();
    const failed = STRUCTURAL_ALERTS.filter((a) => !RDKit.get_qmol(a.smarts)).map((a) => a.id);
    expect(failed).toEqual([]);
  });

  it("has no duplicate alert ids", () => {
    const ids = STRUCTURAL_ALERTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches nitroaromatics in both charge forms", async () => {
    // RDKit canonicalises nitro to [N+](=O)[O-]; a SMARTS written only for the
    // neutral pentavalent form silently misses every nitroaromatic.
    const zwitterionic = await findStructuralAlerts("O=[N+]([O-])c1ccccc1");
    const neutral = await findStructuralAlerts("c1ccccc1N(=O)=O");
    expect(zwitterionic.map((a) => a.id)).toContain("nitro-aromatic");
    expect(neutral.map((a) => a.id)).toContain("nitro-aromatic");
  });

  it("flags chloramphenicol, a real nitroaromatic drug", async () => {
    const hits = await findStructuralAlerts(
      "OCC(NC(=O)C(Cl)Cl)C(O)c1ccc([N+](=O)[O-])cc1",
    );
    expect(hits.map((a) => a.id)).toContain("nitro-aromatic");
  });

  it("flags rhodanine, a known PAINS frequent-hitter", async () => {
    const hits = await findStructuralAlerts("O=C1CSC(=S)N1");
    expect(hits.map((a) => a.id)).toContain("pains-rhodanine");
  });

  it("does not flag benign molecules", async () => {
    expect(await findStructuralAlerts("CCO")).toEqual([]);
    expect(await findStructuralAlerts("CN1C=NC2=C1C(=O)N(C)C(=O)N2C")).toEqual([]);
  });

  it("returns an empty list rather than throwing on invalid input", async () => {
    expect(await findStructuralAlerts("not_a_smiles")).toEqual([]);
    expect(await findStructuralAlerts("")).toEqual([]);
  });
});

describe("assessCompound", () => {
  it("is deterministic — the defect that motivated this rewrite", async () => {
    // ml-prediction.ts added Math.random() to every toxicity value, so the same
    // compound returned different risk levels on each request.
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => assessCompound("CC(=O)Oc1ccccc1C(=O)O")),
    );
    const serialised = runs.map((r) => JSON.stringify(r));
    expect(new Set(serialised).size).toBe(1);
  });

  it("gives identical results for equivalent SMILES spellings", async () => {
    const a = await assessCompound("CC(=O)Oc1ccccc1C(=O)O");
    const b = await assessCompound("CC(=O)OC1=CC=CC=C1C(=O)O");
    expect(a!.safety).toEqual(b!.safety);
    expect(a!.inchiKey).toBe(b!.inchiKey);
  });

  it("returns null for invalid SMILES instead of fabricating a result", async () => {
    expect(await assessCompound("not_a_smiles")).toBeNull();
    expect(await assessCompound("C1CC")).toBeNull();
    expect(await assessCompound("")).toBeNull();
  });

  it("reports no concern for caffeine", async () => {
    const r = await assessCompound("CN1C=NC2=C1C(=O)N(C)C(=O)N2C");
    expect(r!.safety.concernLevel).toBe("none");
    expect(r!.safety.alertCounts.total).toBe(0);
    expect(r!.safety.drugLikeness.lipinski.passed).toBe(true);
  });

  it("escalates concern level to the highest matched severity", async () => {
    const r = await assessCompound("O=[N+]([O-])c1ccccc1");
    expect(r!.safety.concernLevel).toBe("high");
    expect(r!.safety.alertCounts.high).toBeGreaterThan(0);
  });

  it("always carries the research-use disclaimer", async () => {
    const r = await assessCompound("CCO");
    expect(r!.safety.disclaimer).toMatch(/research use only/i);
    expect(r!.safety.disclaimer).toMatch(/not.*validated toxicity predictions/i);
  });

  it("exposes alert coverage so the UI cannot imply completeness", async () => {
    const r = await assessCompound("CCO");
    expect(r!.safety.coverage.note).toMatch(/not evidence of safety/i);
  });

  it("emits no probability or score fields", async () => {
    // Guards against reintroducing fabricated quantitative output.
    const r = await assessCompound("CC(=O)Oc1ccccc1C(=O)O");
    const json = JSON.stringify(r!.safety);
    expect(json).not.toMatch(/"probability"/);
    expect(json).not.toMatch(/"overallScore"/);
    expect(json).not.toMatch(/"confidence"/);
    expect(json).not.toMatch(/"pic50"/i);
  });

  it("cites a source for each drug-likeness rule set", async () => {
    const r = await assessCompound("CCO");
    expect(r!.safety.drugLikeness.lipinski.citation).toMatch(/Lipinski/);
    expect(r!.safety.drugLikeness.veber.citation).toMatch(/Veber/);
  });
});

describe("buildSafetyProfile", () => {
  const descriptors = {
    molecularWeight: 180.16, logP: 1.31, tpsa: 63.6,
    rotatableBonds: 2, hbdCount: 1, hbaCount: 3, atomCount: 13, ringCount: 1,
  };

  it("reports 'none' when no alerts matched", () => {
    const p = buildSafetyProfile(descriptors, []);
    expect(p.concernLevel).toBe("none");
    expect(p.summary).toMatch(/No structural alerts matched/);
  });

  it("ranks a single high alert above several moderate ones", () => {
    const high = buildSafetyProfile(descriptors, [
      { id: "x", name: "X", severity: "high", concern: "c", source: "Brenk", matchedAtoms: [] },
    ]);
    const moderate = buildSafetyProfile(descriptors, [
      { id: "y", name: "Y", severity: "moderate", concern: "c", source: "Brenk", matchedAtoms: [] },
      { id: "z", name: "Z", severity: "moderate", concern: "c", source: "Brenk", matchedAtoms: [] },
    ]);
    expect(high.concernLevel).toBe("high");
    expect(moderate.concernLevel).toBe("moderate");
  });
});

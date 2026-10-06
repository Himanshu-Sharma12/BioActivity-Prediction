import { describe, it, expect } from "vitest";
import { predictBioactivityProfile } from "./bioactivity-prediction";

describe("predictBioactivityProfile", () => {
  it("returns curated physiological target profile for Sodium Chloride by name", async () => {
    const profile = await predictBioactivityProfile({
      name: "Sodium Chloride",
      smiles: "[Na+].[Cl-]",
    });

    expect(profile).toBeDefined();
    expect(profile.source).toBe("physiological-target");
    expect(profile.summary).toContain("electrolyte");
    expect(profile.activities.length).toBeGreaterThanOrEqual(3);
    
    const targets = profile.activities.map(a => a.targetName);
    expect(targets.some(t => t.includes("Na+/K+-ATPase"))).toBe(true);
    expect(targets.some(t => t.includes("Sodium Channel"))).toBe(true);
  });

  it("returns curated physiological target profile for Sodium Chloride by SMILES", async () => {
    const profile = await predictBioactivityProfile({
      smiles: "[Na+].[Cl-]",
    });

    expect(profile).toBeDefined();
    expect(profile.source).toBe("physiological-target");
    expect(profile.activities.length).toBeGreaterThan(0);
  });

  it("returns curated physiological target profile for Potassium Chloride", async () => {
    const profile = await predictBioactivityProfile({
      name: "Potassium Chloride",
      smiles: "[K+].[Cl-]",
    });

    expect(profile).toBeDefined();
    expect(profile.source).toBe("physiological-target");
    expect(profile.activities.length).toBeGreaterThan(0);
  });

  it("returns non-empty bioactivity profile for an unindexed / synthetic compound", async () => {
    const profile = await predictBioactivityProfile({
      name: "Synthetic Test Ligand",
      smiles: "CCN(CC)CC1=CC=C(C=C1)O",
      descriptors: { molecularWeight: 179.26, logP: 2.1 },
    });

    expect(profile).toBeDefined();
    expect(profile.activities.length).toBeGreaterThan(0);
    expect(profile.summary).toBeTruthy();
    expect(profile.activities[0].targetName).toBeTruthy();
    expect(profile.activities[0].activityDescription).toBeTruthy();
  });
});

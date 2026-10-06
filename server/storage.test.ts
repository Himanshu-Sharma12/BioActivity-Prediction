import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemStorage } from "./storage";

/**
 * Storage selection and the in-memory implementation.
 *
 * DbStorage was fully written but never instantiated — `export const storage`
 * was hardcoded to MemStorage, so every compound, analysis and saved result was
 * silently discarded on restart. These tests cover the selection logic and the
 * saved-analysis behaviour that previously lived in a Set inside a route closure.
 *
 * Note: the DbStorage query paths themselves are NOT covered here — they need a
 * real Postgres. See the note at the end of this file.
 */

describe("MemStorage", () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  describe("compounds", () => {
    it("creates and retrieves a compound", async () => {
      const created = await storage.createCompound({ smiles: "CCO", name: "Ethanol" });
      expect(created.id).toBeTruthy();
      expect(await storage.getCompound(created.id)).toEqual(created);
    });

    it("looks a compound up by SMILES", async () => {
      await storage.createCompound({ smiles: "CCO", name: "Ethanol" });
      const found = await storage.getCompoundBySmiles("CCO");
      expect(found?.name).toBe("Ethanol");
    });

    it("returns undefined for an unknown compound", async () => {
      expect(await storage.getCompound("does-not-exist")).toBeUndefined();
      expect(await storage.getCompoundBySmiles("CCCCCCCC")).toBeUndefined();
    });
  });

  describe("predictions", () => {
    it("defaults the optional identifier columns to null", async () => {
      // These columns were added when pic50/confidence were removed. Drizzle types
      // them as `string | null`, so createPrediction must supply nulls rather than
      // leaving them undefined.
      const compound = await storage.createCompound({ smiles: "CCO", name: "Ethanol" });
      const prediction = await storage.createPrediction({
        compoundId: compound.id,
        descriptors: {},
        safetyAssessment: {},
      });

      expect(prediction.canonicalSmiles).toBeNull();
      expect(prediction.inchiKey).toBeNull();
      expect(prediction.molecularFormula).toBeNull();
      expect(prediction.createdAt).toBeInstanceOf(Date);
    });

    it("stores supplied identifiers", async () => {
      const compound = await storage.createCompound({ smiles: "CCO", name: "Ethanol" });
      const prediction = await storage.createPrediction({
        compoundId: compound.id,
        canonicalSmiles: "CCO",
        inchiKey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        molecularFormula: "C2H6O",
        descriptors: {},
        safetyAssessment: {},
      });

      expect(prediction.molecularFormula).toBe("C2H6O");
      expect(await storage.getPredictionByCompoundId(compound.id)).toEqual(prediction);
    });

    it("returns an empty array for an empty id list", async () => {
      expect(await storage.getPredictionsByCompoundIds([])).toEqual([]);
    });
  });

  describe("saved analyses", () => {
    it("saves, lists and unsaves", async () => {
      await storage.savePrediction("compound-1");
      await storage.savePrediction("compound-2");
      expect(await storage.getSavedCompoundIds()).toEqual(["compound-1", "compound-2"]);

      await storage.unsavePrediction("compound-1");
      expect(await storage.getSavedCompoundIds()).toEqual(["compound-2"]);
    });

    it("treats a repeated save as idempotent", async () => {
      // The DbStorage equivalent relies on onConflictDoNothing; the in-memory one
      // must not diverge from that behaviour.
      await storage.savePrediction("compound-1");
      await storage.savePrediction("compound-1");
      expect(await storage.getSavedCompoundIds()).toEqual(["compound-1"]);
    });

    it("ignores unsaving something that was never saved", async () => {
      await expect(storage.unsavePrediction("never-saved")).resolves.toBeUndefined();
      expect(await storage.getSavedCompoundIds()).toEqual([]);
    });
  });

  describe("batch jobs", () => {
    it("defaults processedCompounds and results", async () => {
      const job = await storage.createBatchJob({ status: "processing", totalCompounds: 5 });
      expect(job.processedCompounds).toBe(0);
      expect(job.results).toBeNull();
      expect(job.completedAt).toBeNull();
    });

    it("updates a job", async () => {
      const job = await storage.createBatchJob({ status: "processing", totalCompounds: 2 });
      const updated = await storage.updateBatchJob(job.id, { status: "completed", processedCompounds: 2 });
      expect(updated?.status).toBe("completed");
      expect(updated?.processedCompounds).toBe(2);
    });

    it("returns undefined when updating a job that does not exist", async () => {
      expect(await storage.updateBatchJob("nope", { status: "failed" })).toBeUndefined();
    });
  });
});

describe("storage selection", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    vi.restoreAllMocks();
  });

  it("falls back to in-memory storage when DATABASE_URL is absent, and warns", async () => {
    delete process.env.DATABASE_URL;
    const mod = await import("./storage");

    expect(mod.storage).toBeInstanceOf(mod.MemStorage);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("DATABASE_URL is not set"),
    );
  });

  it("warns that data will be lost, not merely that a URL is missing", async () => {
    // The point of the warning is that data is being discarded. A vaguer message
    // would let someone run this in production without realising.
    delete process.env.DATABASE_URL;
    await import("./storage");

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("lost when the server restarts"));
  });

  it("falls back to in-memory storage when DATABASE_URL is malformed, and reports it", async () => {
    // A bad URL must not take the process down, but it must also not look like a
    // working database.
    process.env.DATABASE_URL = "not-a-valid-connection-string";
    const mod = await import("./storage");

    expect(mod.storage).toBeInstanceOf(mod.MemStorage);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("could not be initialised"),
      expect.anything(),
    );
  });
});

/**
 * NOT COVERED: the DbStorage query implementations.
 *
 * They require a live Postgres, so they are exercised only by running the app
 * against a real DATABASE_URL. Until that happens, treat the Postgres path as
 * wired-but-unproven — the schema, the Drizzle calls and `npm run db:push` have
 * not been run against an actual database in this repository.
 */

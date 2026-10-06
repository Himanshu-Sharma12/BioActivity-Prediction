import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchSidecarAlerts,
  fetchSidecarQed,
  fetchSidecarScaffold,
  fetchSidecarHealth,
  isSidecarConfigured,
  isCircuitOpen,
  resetSidecarCircuit,
  verifySidecarAvailability,
} from "./sidecar";
import { assessCompound, buildSafetyProfile } from "./safety";
import { ALERT_COVERAGE } from "./structural-alerts";

const ORIGINAL_URL = process.env.RDKIT_SIDECAR_URL;

function mockFetch(impl: (...args: any[]) => any) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  delete process.env.RDKIT_SIDECAR_URL;
  resetSidecarCircuit();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  if (ORIGINAL_URL === undefined) delete process.env.RDKIT_SIDECAR_URL;
  else process.env.RDKIT_SIDECAR_URL = ORIGINAL_URL;
  resetSidecarCircuit();
});

describe("sidecar disabled (RDKIT_SIDECAR_URL unset)", () => {
  it("reports itself as unconfigured", () => {
    expect(isSidecarConfigured()).toBe(false);
  });

  it("returns null from every endpoint without attempting a network call", async () => {
    const fetchMock = mockFetch(() => {
      throw new Error("fetch must not be called when the sidecar is disabled");
    });

    expect(await fetchSidecarAlerts("CCO")).toBeNull();
    expect(await fetchSidecarQed("CCO")).toBeNull();
    expect(await fetchSidecarScaffold("CCO")).toBeNull();
    expect(await fetchSidecarHealth()).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an empty or whitespace URL as disabled", async () => {
    const fetchMock = mockFetch(() => jsonResponse({}));
    process.env.RDKIT_SIDECAR_URL = "   ";
    expect(isSidecarConfigured()).toBe(false);
    expect(await fetchSidecarQed("CCO")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs that the sidecar is disabled on boot and resolves false", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(verifySidecarAvailability()).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("disabled"));
    log.mockRestore();
  });
});

describe("sidecar enabled but unreachable", () => {
  beforeEach(() => {
    process.env.RDKIT_SIDECAR_URL = "http://127.0.0.1:9/";
  });

  it("returns null and does not throw on connection failure", async () => {
    mockFetch(async () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    });
    await expect(fetchSidecarAlerts("CCO")).resolves.toBeNull();
  });

  it("returns null when the request aborts on timeout, without hanging", async () => {
    mockFetch(async (_url: string, init: any) => {
      // Simulate a hung sidecar: never resolves until the client's own abort fires.
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    });

    vi.useFakeTimers();
    const pending = fetchSidecarQed("CCO");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeNull();
  });

  it("returns null on a 500 without throwing", async () => {
    mockFetch(async () => jsonResponse({ detail: "boom" }, 500));
    await expect(fetchSidecarScaffold("CCO")).resolves.toBeNull();
  });

  it("returns null on malformed JSON without throwing", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    await expect(fetchSidecarHealth()).resolves.toBeNull();
  });
});

describe("circuit breaker", () => {
  beforeEach(() => {
    process.env.RDKIT_SIDECAR_URL = "http://127.0.0.1:9";
  });

  it("opens after repeated failures and stops issuing requests", async () => {
    const fetchMock = mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });

    for (let i = 0; i < 3; i++) {
      expect(await fetchSidecarQed("CCO")).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(isCircuitOpen()).toBe(true);

    // Further calls short-circuit: no new network attempts at all.
    for (let i = 0; i < 5; i++) {
      expect(await fetchSidecarQed("CCO")).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("closes again after the cooldown elapses", async () => {
    const fetchMock = mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });

    for (let i = 0; i < 3; i++) await fetchSidecarQed("CCO");
    expect(isCircuitOpen()).toBe(true);

    // Stay on fake timers for the probe: switching back to real timers would restore
    // Date.now() to before the (real-clock) cooldown deadline and re-open the breaker.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31_000);
    expect(isCircuitOpen()).toBe(false);

    await fetchSidecarQed("CCO");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("a successful response resets the failure count", async () => {
    let failing = true;
    const fetchMock = mockFetch(async () => {
      if (failing) throw new Error("ECONNREFUSED");
      return jsonResponse({ status: "ok", rdkit_version: "2026.03.6" });
    });

    await fetchSidecarHealth();
    await fetchSidecarHealth();
    failing = false;
    expect(await fetchSidecarHealth()).toEqual({ status: "ok", rdkit_version: "2026.03.6" });

    failing = true;
    await fetchSidecarHealth();
    await fetchSidecarHealth();
    // Only two failures since the reset, so the breaker must still be closed.
    expect(isCircuitOpen()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not trip the breaker on a 4xx — the sidecar is alive, the input was bad", async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ detail: "could not parse smiles" }, 400));

    for (let i = 0; i < 5; i++) {
      expect(await fetchSidecarAlerts("not_a_smiles")).toBeNull();
    }
    expect(isCircuitOpen()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("request shape when enabled", () => {
  it("POSTs JSON to the right path and strips a trailing slash from the base URL", async () => {
    process.env.RDKIT_SIDECAR_URL = "http://sidecar.test:8000/";
    const fetchMock = mockFetch(async () =>
      jsonResponse({ canonicalSmiles: "CCO", scaffold: "", isAcyclic: true }),
    );

    const result = await fetchSidecarScaffold("CCO");
    expect(result).toEqual({ canonicalSmiles: "CCO", scaffold: "", isAcyclic: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://sidecar.test:8000/scaffold");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ smiles: "CCO" });
  });

  it("does not call out for empty input", async () => {
    process.env.RDKIT_SIDECAR_URL = "http://sidecar.test:8000";
    const fetchMock = mockFetch(async () => jsonResponse({}));
    expect(await fetchSidecarAlerts("")).toBeNull();
    expect(await fetchSidecarQed("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("safety.ts degrades gracefully without the sidecar", () => {
  it("emits no sidecar-derived fields and leaves coverage untouched", async () => {
    const fetchMock = mockFetch(() => {
      throw new Error("fetch must not be called when the sidecar is disabled");
    });

    const result = await assessCompound("CC(=O)Oc1ccccc1C(=O)O");
    expect(result).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const safety = result!.safety;
    expect(safety.qed).toBeUndefined();
    expect(safety.extendedAlerts).toBeUndefined();
    expect(safety.extendedAlertCounts).toBeUndefined();
    // Coverage must be the unmodified built-in wording — no claim of full catalogues.
    expect(safety.coverage).toEqual(ALERT_COVERAGE);
    expect(safety.coverage.source).toBeUndefined();
    expect(JSON.stringify(safety)).not.toMatch(/sidecar/i);
  });

  it("assessCompound output is identical with the sidecar unreachable vs unset", async () => {
    const withoutSidecar = await assessCompound("CC(=O)Oc1ccccc1C(=O)O");

    process.env.RDKIT_SIDECAR_URL = "http://127.0.0.1:9";
    mockFetch(async () => {
      throw new Error("ECONNREFUSED");
    });
    const withDeadSidecar = await assessCompound("CC(=O)Oc1ccccc1C(=O)O");

    expect(JSON.stringify(withDeadSidecar)).toBe(JSON.stringify(withoutSidecar));
  });

  it("buildSafetyProfile is unchanged when enrichment is null or omitted", () => {
    const descriptors = {
      molecularWeight: 180.16, logP: 1.31, tpsa: 63.6,
      rotatableBonds: 2, hbdCount: 1, hbaCount: 3, atomCount: 13, ringCount: 1,
    };
    const a = buildSafetyProfile(descriptors, []);
    const b = buildSafetyProfile(descriptors, [], null);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("safety.ts enrichment when the sidecar answers", () => {
  beforeEach(() => {
    process.env.RDKIT_SIDECAR_URL = "http://sidecar.test:8000";
  });

  it("adds extended alerts and QED, and says which source was used", async () => {
    mockFetch(async (url: string) => {
      if (url.endsWith("/alerts")) {
        return jsonResponse({
          canonicalSmiles: "CC(=O)Oc1ccccc1C(=O)O",
          catalogues: ["BRENK", "PAINS_A", "PAINS_B", "PAINS_C", "NIH", "CHEMBL", "ZINC"],
          alerts: [
            { catalog: "BRENK", filterSet: "Brenk", description: "phenol_ester", matchedAtoms: [0, 1, 2] },
            { catalog: "NIH", filterSet: "NIH", description: "phenol", matchedAtoms: [4] },
          ],
          note: "…",
        });
      }
      if (url.endsWith("/qed")) {
        return jsonResponse({
          canonicalSmiles: "CC(=O)Oc1ccccc1C(=O)O",
          qed: 0.55,
          properties: { MW: 180.16, ALOGP: 1.31, HBA: 3, HBD: 1, PSA: 63.6, ROTB: 2, AROM: 1, ALERTS: 0 },
          citation: "Bickerton et al., Nature Chemistry 2012, 4:90-98",
          note: "…",
        });
      }
      return jsonResponse({}, 404);
    });

    const safety = (await assessCompound("CC(=O)Oc1ccccc1C(=O)O"))!.safety;

    expect(safety.extendedAlertCounts).toEqual({
      total: 2,
      byCatalog: { BRENK: 1, NIH: 1 },
    });
    expect(safety.qed!.score).toBe(0.55);
    expect(safety.qed!.citation).toMatch(/Bickerton/);
    // The caveat is restated locally, so swapping the sidecar cannot weaken it.
    expect(safety.qed!.note).toMatch(/not a safety score/i);
    expect(safety.coverage.source).toBe("builtin-subset+sidecar-full-catalogue");
    expect(safety.coverage.cataloguesScreened).toContain("BRENK");
    expect(safety.coverage.note).toBe(ALERT_COVERAGE.note);
  });

  it("does not let sidecar alerts silently change concernLevel or alertCounts", async () => {
    // The catalogue entries carry no severity grading, so inventing one would be
    // fabrication. concernLevel must stay driven by the curated, attributable set.
    mockFetch(async (url: string) => {
      if (url.endsWith("/alerts")) {
        return jsonResponse({
          canonicalSmiles: "CCO",
          catalogues: ["BRENK"],
          alerts: [{ catalog: "BRENK", filterSet: "Brenk", description: "aliphatic_long_chain", matchedAtoms: [0] }],
          note: "…",
        });
      }
      return jsonResponse({}, 404);
    });

    const safety = (await assessCompound("CCO"))!.safety;
    expect(safety.concernLevel).toBe("none");
    expect(safety.alertCounts.total).toBe(0);
    expect(safety.extendedAlertCounts!.total).toBe(1);
  });

  it("still enriches with QED when only the alerts endpoint fails", async () => {
    mockFetch(async (url: string) => {
      if (url.endsWith("/alerts")) return jsonResponse({ detail: "no" }, 500);
      return jsonResponse({
        canonicalSmiles: "CCO",
        qed: 0.41,
        properties: { MW: 46.07, ALOGP: -0.0014, HBA: 1, HBD: 1, PSA: 20.23, ROTB: 0, AROM: 0, ALERTS: 0 },
        citation: "Bickerton et al., Nature Chemistry 2012, 4:90-98",
        note: "…",
      });
    });

    const safety = (await assessCompound("CCO"))!.safety;
    expect(safety.qed!.score).toBe(0.41);
    expect(safety.extendedAlerts).toEqual([]);
  });

  it("never emits a probability-shaped field for QED", async () => {
    mockFetch(async (url: string) => {
      if (url.endsWith("/qed")) {
        return jsonResponse({
          canonicalSmiles: "CCO",
          qed: 0.41,
          properties: { MW: 46.07, ALOGP: 0, HBA: 1, HBD: 1, PSA: 20.23, ROTB: 0, AROM: 0, ALERTS: 0 },
          citation: "Bickerton et al., Nature Chemistry 2012, 4:90-98",
          note: "…",
        });
      }
      return jsonResponse({}, 500);
    });

    const json = JSON.stringify((await assessCompound("CCO"))!.safety);
    expect(json).not.toMatch(/"probability"/);
    expect(json).not.toMatch(/"toxicity"/i);
    expect(json).not.toMatch(/"overallScore"/);
  });
});

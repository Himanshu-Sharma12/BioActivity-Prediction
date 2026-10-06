/**
 * Client for the OPTIONAL Python RDKit sidecar (see `sidecar/README.md`).
 *
 * The sidecar unlocks the things RDKit's WASM MinimalLib build cannot do: the complete
 * FilterCatalog alert sets, QED, and Murcko scaffolds. It is an enhancement and never a
 * dependency, so this module is built around three hard rules:
 *
 *  1. If `RDKIT_SIDECAR_URL` is unset the sidecar is disabled and every function returns
 *     null *immediately*, without attempting a network call.
 *  2. Nothing here ever throws. Timeouts, connection refusals, malformed JSON and error
 *     responses all collapse to null, so a caller can always treat the result as
 *     "extra information I may or may not have".
 *  3. A dead sidecar must not slow the app down. After a few consecutive failures the
 *     circuit breaker opens and calls short-circuit for a cooldown period, so one
 *     unreachable host cannot add a timeout to every request.
 *
 * Nothing returned by the sidecar is a prediction. Alerts are substructure matches
 * against published lists; QED is a published drug-likeness formula. Neither is a
 * toxicity probability and neither may be presented as one.
 */

/** Per-request timeout. Deliberately short — this is optional enrichment. */
const REQUEST_TIMEOUT_MS = 2500;
/** Consecutive failures before the breaker opens. */
const FAILURE_THRESHOLD = 3;
/** How long the breaker stays open before a single call is allowed through again. */
const COOLDOWN_MS = 30_000;

let consecutiveFailures = 0;
let openUntil = 0;

export interface SidecarAlert {
  /** Catalogue the pattern came from: PAINS_A/B/C, BRENK, NIH, CHEMBL, ZINC. */
  catalog: string;
  /** Sub-catalogue, e.g. ChEMBL23_Dundee. Equals `catalog` for single-set catalogues. */
  filterSet: string;
  description: string;
  /** Atom indices, against the canonical SMILES the sidecar echoes back. */
  matchedAtoms: number[];
}

export interface SidecarAlertsResult {
  canonicalSmiles: string;
  catalogues: string[];
  alerts: SidecarAlert[];
  note: string;
}

export interface SidecarQedResult {
  canonicalSmiles: string;
  /** Quantitative Estimate of Drug-likeness, 0-1. NOT a safety or toxicity score. */
  qed: number;
  properties: {
    MW: number; ALOGP: number; HBA: number; HBD: number;
    PSA: number; ROTB: number; AROM: number; ALERTS: number;
  };
  citation: string;
  note: string;
}

export interface SidecarScaffoldResult {
  canonicalSmiles: string;
  scaffold: string;
  isAcyclic: boolean;
}

export interface SidecarHealth {
  status: string;
  rdkit_version: string;
  catalogues?: string[];
  patternCount?: number;
}

/**
 * Read the env var on every call rather than caching it at module load, so that the
 * sidecar can be enabled or disabled without a restart — and so tests can toggle it.
 */
function baseUrl(): string | null {
  const raw = process.env.RDKIT_SIDECAR_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

/** True when a sidecar URL is configured. Says nothing about reachability. */
export function isSidecarConfigured(): boolean {
  return baseUrl() !== null;
}

/** True when the breaker is open and calls are being short-circuited. */
export function isCircuitOpen(): boolean {
  return Date.now() < openUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    openUntil = Date.now() + COOLDOWN_MS;
    // Reset the counter so that after the cooldown a single probe decides whether to
    // re-open, instead of the breaker latching open forever on one stale count.
    consecutiveFailures = 0;
  }
}

/**
 * Test hook. Resets breaker state between cases; there is no production reason to call
 * this, since the breaker recovers on its own after the cooldown.
 */
export function resetSidecarCircuit(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}

async function request<T>(path: string, body?: unknown): Promise<T | null> {
  const base = baseUrl();
  // Disabled: return before touching the network at all.
  if (base === null) return null;
  if (isCircuitOpen()) return null;

  // AbortController rather than AbortSignal.timeout so the timer is always cleared —
  // an un-cleared timer keeps the event loop alive on a short-lived process.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // A 4xx means the sidecar is alive and rejected this particular molecule (e.g.
      // unparseable SMILES). That is not a health problem, so it must not trip the
      // breaker — otherwise a run of bad input would disable a healthy sidecar.
      if (response.status >= 400 && response.status < 500) {
        recordSuccess();
      } else {
        recordFailure();
      }
      return null;
    }

    const parsed = (await response.json()) as T;
    recordSuccess();
    return parsed;
  } catch {
    // Connection refused, DNS failure, abort on timeout, malformed JSON.
    recordFailure();
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Complete FilterCatalog alert set. Null when unavailable for any reason. */
export function fetchSidecarAlerts(smiles: string): Promise<SidecarAlertsResult | null> {
  if (!smiles || smiles.trim().length === 0) return Promise.resolve(null);
  return request<SidecarAlertsResult>("/alerts", { smiles });
}

/** QED drug-likeness (Bickerton et al. 2012). Null when unavailable. */
export function fetchSidecarQed(smiles: string): Promise<SidecarQedResult | null> {
  if (!smiles || smiles.trim().length === 0) return Promise.resolve(null);
  return request<SidecarQedResult>("/qed", { smiles });
}

/** Bemis-Murcko scaffold SMILES. Null when unavailable. */
export function fetchSidecarScaffold(smiles: string): Promise<SidecarScaffoldResult | null> {
  if (!smiles || smiles.trim().length === 0) return Promise.resolve(null);
  return request<SidecarScaffoldResult>("/scaffold", { smiles });
}

export function fetchSidecarHealth(): Promise<SidecarHealth | null> {
  return request<SidecarHealth>("/health");
}

/**
 * Boot-time probe. Logs whether the optional sidecar is present so that "my alerts look
 * thin" is diagnosable from the startup output rather than by reading code.
 *
 * Runs automatically on first import (below) and never rejects.
 */
export async function verifySidecarAvailability(): Promise<boolean> {
  if (!isSidecarConfigured()) {
    console.log(
      "[sidecar] RDKIT_SIDECAR_URL not set — optional Python RDKit sidecar disabled. " +
        "Using the built-in 31-pattern Brenk/PAINS subset.",
    );
    return false;
  }

  const health = await fetchSidecarHealth();
  if (!health) {
    console.warn(
      `[sidecar] configured at ${baseUrl()} but not reachable — continuing with the ` +
        "built-in 31-pattern Brenk/PAINS subset. This is not fatal.",
    );
    return false;
  }

  console.log(
    `[sidecar] available at ${baseUrl()} (RDKit ${health.rdkit_version}` +
      `${health.patternCount ? `, ${health.patternCount} catalogue patterns` : ""}).`,
  );
  return true;
}

// Probe at import time. `server/index.ts` is owned elsewhere, so the boot log hangs off
// the import graph instead. Skipped under vitest, where a stray background fetch would
// leak across test cases.
if (!process.env.VITEST) {
  void verifySidecarAvailability();
}

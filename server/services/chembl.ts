/**
 * Measured bioactivity lookup against ChEMBL.
 *
 * This replaces the previous `predictPIC50()`, which returned a single number for
 * a compound with no target specified. That was not merely inaccurate: IC50 is a
 * property of a (compound, target, assay) triple, so a target-free IC50 has no
 * meaning. The same molecule routinely spans several log units across targets.
 *
 * What this returns instead is *measured* data — real values from published
 * assays, each with its target, assay description and source document. Where a
 * compound has no ChEMBL record, it says so rather than inventing a number.
 *
 * Data source: ChEMBL (EMBL-EBI), https://www.ebi.ac.uk/chembl/
 * Licence: CC BY-SA 3.0 — https://chembl.gitbook.io/chembl-interface-documentation
 * No API key required.
 */

import { TtlCache } from "./cache";

const CHEMBL_BASE = "https://www.ebi.ac.uk/chembl/api/data";
const REQUEST_TIMEOUT_MS = 8000;

// Measured bioactivity is reference data that changes on ChEMBL's release cycle
// (months), so a long TTL is safe and removes the slowest step of a repeat analysis.
const ACTIVITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const activityCache = new TtlCache<ChemblRecord | null>(ACTIVITY_CACHE_TTL_MS, 1000);

export interface MeasuredActivity {
  targetChemblId: string;
  targetName: string;
  organism: string | null;
  standardType: string;
  standardValue: number | null;
  standardUnits: string | null;
  /** -log10(molar) of the reported potency, as computed by ChEMBL. */
  pchemblValue: number | null;
  assayDescription?: string | null;
  activityDescription?: string | null;
  documentYear: number | null;
  documentJournal: string | null;
}

export interface ChemblRecord {
  chemblId: string;
  prefName: string | null;
  maxPhase?: number | null;
  firstApproval: number | null;
  activities: MeasuredActivity[];
  /** True when the compound resolved but has no measured potency on record. */
  noActivityData?: boolean;
  source?: 'chembl' | 'ai-predicted' | 'physiological-target';
  summary?: string;
}

async function chemblFetch(path: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CHEMBL_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Network failure or timeout is not an error condition for the caller —
    // it simply means no measured data could be retrieved right now.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a canonical SMILES to a ChEMBL molecule via exact structure match. */
async function findMolecule(canonicalSmiles: string): Promise<any | null> {
  const encoded = encodeURIComponent(canonicalSmiles);
  const data = await chemblFetch(
    `/molecule.json?molecule_structures__canonical_smiles__flexmatch=${encoded}&limit=1`,
  );
  return data?.molecules?.[0] ?? null;
}

const TARGET_NAME_CACHE = new Map<string, { name: string; organism: string | null }>();

async function resolveTarget(targetChemblId: string) {
  const cached = TARGET_NAME_CACHE.get(targetChemblId);
  if (cached) return cached;

  const data = await chemblFetch(`/target/${targetChemblId}.json`);
  const resolved = {
    name: data?.pref_name ?? targetChemblId,
    organism: data?.organism ?? null,
  };
  TARGET_NAME_CACHE.set(targetChemblId, resolved);
  return resolved;
}

/**
 * Look up measured activities for a compound.
 * Returns null when the compound is not in ChEMBL at all — a meaningful answer
 * in itself ("no measured activity on record"), not a failure.
 */
export async function lookupMeasuredActivity(
  canonicalSmiles: string,
  options: { limit?: number } = {},
): Promise<ChemblRecord | null> {
  const limit = options.limit ?? 10;
  return activityCache.wrap(`${canonicalSmiles}::${limit}`, () =>
    fetchMeasuredActivity(canonicalSmiles, limit),
  );
}

/** Clears the cached ChEMBL lookups. Intended for tests. */
export function clearActivityCache(): void {
  activityCache.clear();
}

async function fetchMeasuredActivity(
  canonicalSmiles: string,
  limit: number,
): Promise<ChemblRecord | null> {

  const molecule = await findMolecule(canonicalSmiles);
  if (!molecule?.molecule_chembl_id) return null;

  const chemblId = molecule.molecule_chembl_id;

  // pchembl_value__isnull=false filters to records with a comparable potency;
  // without it most rows are qualitative or non-standard units.
  //
  // Over-fetch and then collapse per target. Sorting purely by potency surfaces
  // one-off high-affinity outliers from single papers (aspirin's top hit is an
  // obscure NAPRT measurement, not COX), and the raw feed repeats the same assay
  // many times. One row per target, keeping its most potent measurement, gives a
  // far more representative picture of what the compound is actually known to hit.
  const activityData = await chemblFetch(
    `/activity.json?molecule_chembl_id=${chemblId}` +
      `&pchembl_value__isnull=false&limit=${Math.min(limit * 10, 200)}&order_by=-pchembl_value`,
  );

  const allRows: any[] = activityData?.activities ?? [];

  const bestPerTarget = new Map<string, any>();
  for (const row of allRows) {
    const key = row.target_chembl_id ?? "unknown";
    // Rows arrive sorted by descending pChEMBL, so the first per target is its best.
    if (!bestPerTarget.has(key)) bestPerTarget.set(key, row);
  }

  const rows = Array.from(bestPerTarget.values()).slice(0, limit);

  const activities: MeasuredActivity[] = await Promise.all(
    rows.map(async (a) => {
      const target = a.target_chembl_id
        ? await resolveTarget(a.target_chembl_id)
        : { name: "Unknown target", organism: null };
      return {
        targetChemblId: a.target_chembl_id ?? "",
        targetName: target.name,
        organism: target.organism,
        standardType: a.standard_type ?? "",
        standardValue: a.standard_value != null ? Number(a.standard_value) : null,
        standardUnits: a.standard_units ?? null,
        pchemblValue: a.pchembl_value != null ? Number(a.pchembl_value) : null,
        assayDescription: a.assay_description ?? null,
        documentYear: a.document_year != null ? Number(a.document_year) : null,
        documentJournal: a.document_journal ?? null,
      };
    }),
  );

  // ChEMBL uses these as placeholders where the assay target was never curated.
  // Showing them as if they were targets is worse than showing fewer rows.
  const PLACEHOLDER_TARGETS = new Set(["Unchecked", "NON-PROTEIN TARGET", "Unspecified"]);
  const usableActivities = activities.filter(
    (a) => a.targetName && !PLACEHOLDER_TARGETS.has(a.targetName),
  );

  return {
    chemblId,
    prefName: molecule.pref_name ?? null,
    maxPhase: molecule.max_phase != null ? Number(molecule.max_phase) : null,
    firstApproval: molecule.first_approval != null ? Number(molecule.first_approval) : null,
    activities: usableActivities,
    noActivityData: usableActivities.length === 0,
    source: 'chembl',
  };
}

export const CHEMBL_ATTRIBUTION =
  "Bioactivity data from ChEMBL (EMBL-EBI), used under CC BY-SA 3.0.";

import type { MolecularDescriptors } from "@shared/schema";
import { analyzeSmiles, checkLipinski, checkVeber } from "./rdkit";
import { findStructuralAlerts, ALERT_COVERAGE, type AlertMatch } from "./structural-alerts";
import {
  fetchSidecarAlerts,
  fetchSidecarQed,
  type SidecarAlert,
  type SidecarQedResult,
} from "./sidecar";

/**
 * Deterministic safety profiling.
 *
 * This replaces ml-prediction.ts, which produced hepatotoxicity, cardiotoxicity,
 * mutagenicity and hERG "probabilities" from hand-invented coefficients plus
 * Math.random() — meaning the same compound scored differently on every request.
 *
 * Nothing here is predicted. Every value is either a measured physicochemical
 * property, a published rule evaluated against it, or a substructure match against
 * a cited alert set. Same input always gives the same output.
 *
 * What this deliberately does NOT do:
 *  - emit toxicity probabilities (no validated model is loaded)
 *  - emit a single overall safety score (averaging unrelated flags is misleading)
 *  - claim clinical relevance of any kind
 */

export const RESEARCH_USE_DISCLAIMER =
  "For research use only. Not for use in diagnostic or therapeutic procedures. " +
  "These are computed physicochemical properties and published structural alerts, " +
  "not experimental measurements or validated toxicity predictions. They must not " +
  "be used to make safety decisions about human or animal exposure.";

export type ConcernLevel = "none" | "low" | "moderate" | "high";

/**
 * Where the structural alerts in a profile came from.
 *
 * The built-in WASM path screens a curated 31-pattern subset; the optional Python
 * sidecar screens the complete RDKit FilterCatalog. The UI must be able to tell these
 * apart, because "no alerts" means something very different in each case.
 */
export type AlertSource = "builtin-subset" | "builtin-subset+sidecar-full-catalogue";

export interface AlertCoverage {
  brenk: string;
  pains: string;
  note: string;
  /**
   * Present only when the optional sidecar contributed. Absent means the built-in
   * subset produced the result, exactly as it always has.
   */
  source?: AlertSource;
  /** Catalogues the sidecar actually screened, when it was used. */
  cataloguesScreened?: string[];
}

/**
 * A hit from the full RDKit FilterCatalog, reported separately from `structuralAlerts`.
 *
 * These are kept distinct rather than merged because the catalogue entries carry no
 * severity grading. Assigning one would be inventing information, so `concernLevel`
 * stays driven by the curated set, whose severities are attributable.
 */
export interface ExtendedAlert {
  /** Catalogue: PAINS_A/B/C, BRENK, NIH, CHEMBL or ZINC. */
  catalog: string;
  /** Sub-catalogue, e.g. ChEMBL23_Dundee. Equals `catalog` for single-set catalogues. */
  filterSet: string;
  /** The catalogue's own description of the pattern, e.g. "phenol_ester". */
  description: string;
  matchedAtoms: number[];
}

/**
 * QED — Bickerton et al., Nature Chemistry 2012, 4:90-98.
 *
 * A published drug-likeness desirability score in [0, 1]. It is NOT a safety score,
 * NOT a toxicity probability, and must never be rendered as one.
 */
export interface QedResult {
  score: number;
  properties: SidecarQedResult["properties"];
  citation: string;
  note: string;
}

/** Optional extras contributed by the Python sidecar. Null when it is not available. */
export interface SafetyEnrichment {
  extendedAlerts: ExtendedAlert[];
  cataloguesScreened: string[];
  qed: QedResult | null;
}

export interface RuleCheck {
  name: string;
  passed: boolean;
  value: number;
  threshold: number;
}

export interface SafetyProfile {
  /** Highest severity among matched alerts; "none" when nothing matched. */
  concernLevel: ConcernLevel;
  /**
   * Plain-language summary of what was found. Deliberately not a score — the
   * previous 0-10 `overallScore` looked quantitative while being an average of
   * four randomised values.
   */
  summary: string;
  structuralAlerts: AlertMatch[];
  alertCounts: { high: number; moderate: number; low: number; total: number };
  drugLikeness: {
    lipinski: { rules: RuleCheck[]; violations: number; passed: boolean; citation: string };
    veber: { rules: RuleCheck[]; violations: number; passed: boolean; citation: string };
  };
  coverage: AlertCoverage;
  disclaimer: string;
  /**
   * Populated only when the optional RDKit sidecar answered. When it is absent these
   * keys are not emitted at all, so the payload is identical to the sidecar-free one.
   */
  extendedAlerts?: ExtendedAlert[];
  extendedAlertCounts?: { total: number; byCatalog: Record<string, number> };
  qed?: QedResult;
}

const LIPINSKI_CITATION =
  "Lipinski et al., Adv Drug Deliv Rev 1997, 23:3-25";
const VEBER_CITATION =
  "Veber et al., J Med Chem 2002, 45:2615-2623";

export function buildSafetyProfile(
  descriptors: MolecularDescriptors,
  alerts: AlertMatch[],
  enrichment?: SafetyEnrichment | null,
): SafetyProfile {
  const counts = {
    high: alerts.filter((a) => a.severity === "high").length,
    moderate: alerts.filter((a) => a.severity === "moderate").length,
    low: alerts.filter((a) => a.severity === "low").length,
    total: alerts.length,
  };

  const concernLevel: ConcernLevel =
    counts.high > 0 ? "high" : counts.moderate > 0 ? "moderate" : counts.low > 0 ? "low" : "none";

  const lip = checkLipinski(descriptors);
  const veb = checkVeber(descriptors);

  const profile: SafetyProfile = {
    concernLevel,
    summary: describe(counts, lip.violations, veb.violations),
    structuralAlerts: alerts,
    alertCounts: counts,
    drugLikeness: {
      lipinski: { ...lip, citation: LIPINSKI_CITATION },
      veber: { ...veb, citation: VEBER_CITATION },
    },
    coverage: ALERT_COVERAGE,
    disclaimer: RESEARCH_USE_DISCLAIMER,
  };

  // No sidecar: return exactly what this function has always returned. No extra keys,
  // no altered coverage wording — the enrichment is strictly additive.
  if (!enrichment) return profile;

  const byCatalog: Record<string, number> = {};
  for (const a of enrichment.extendedAlerts) {
    byCatalog[a.catalog] = (byCatalog[a.catalog] ?? 0) + 1;
  }

  profile.extendedAlerts = enrichment.extendedAlerts;
  profile.extendedAlertCounts = { total: enrichment.extendedAlerts.length, byCatalog };
  profile.coverage = {
    // The built-in subset still ran and still produced `structuralAlerts`, so its
    // wording stays; what changes is that the complete catalogues also ran.
    brenk: `${ALERT_COVERAGE.brenk}, plus the complete RDKit BRENK catalogue via the RDKit sidecar`,
    pains: `${ALERT_COVERAGE.pains}, plus the complete RDKit PAINS_A/B/C catalogues via the RDKit sidecar`,
    note: ALERT_COVERAGE.note,
    source: "builtin-subset+sidecar-full-catalogue",
    cataloguesScreened: enrichment.cataloguesScreened,
  };
  if (enrichment.qed) profile.qed = enrichment.qed;

  return profile;
}

/**
 * Ask the optional sidecar for the full catalogue and QED.
 *
 * Returns null when the sidecar is unconfigured, unreachable or slow — the client never
 * throws and returns null in every one of those cases. Both calls go out together so the
 * enrichment costs one round trip, not two.
 */
async function fetchEnrichment(canonicalSmiles: string): Promise<SafetyEnrichment | null> {
  const [alerts, qed] = await Promise.all([
    fetchSidecarAlerts(canonicalSmiles),
    fetchSidecarQed(canonicalSmiles),
  ]);

  if (!alerts && !qed) return null;

  return {
    extendedAlerts: (alerts?.alerts ?? []).map(toExtendedAlert),
    cataloguesScreened: alerts?.catalogues ?? [],
    qed: qed
      ? {
          score: qed.qed,
          properties: qed.properties,
          citation: qed.citation,
          // Restated locally rather than trusting the remote string, so the caveat
          // cannot be weakened by swapping the sidecar out.
          note:
            "QED is a drug-likeness desirability score in [0, 1] (Bickerton et al. 2012). " +
            "It is not a safety score, a toxicity probability, or a measure of potency.",
        }
      : null,
  };
}

function toExtendedAlert(a: SidecarAlert): ExtendedAlert {
  return {
    catalog: a.catalog,
    filterSet: a.filterSet,
    description: a.description,
    matchedAtoms: Array.isArray(a.matchedAtoms) ? a.matchedAtoms : [],
  };
}

function describe(
  counts: { high: number; moderate: number; low: number; total: number },
  lipinskiViolations: number,
  veberViolations: number,
): string {
  const parts: string[] = [];

  if (counts.total === 0) {
    parts.push("No structural alerts matched from the screened subset");
  } else {
    const bits = [
      counts.high ? `${counts.high} high-severity` : null,
      counts.moderate ? `${counts.moderate} moderate` : null,
      counts.low ? `${counts.low} low` : null,
    ].filter(Boolean);
    parts.push(`${counts.total} structural alert${counts.total === 1 ? "" : "s"} matched (${bits.join(", ")})`);
  }

  parts.push(
    lipinskiViolations === 0
      ? "meets all Lipinski criteria"
      : `${lipinskiViolations} Lipinski violation${lipinskiViolations === 1 ? "" : "s"}`,
  );

  if (veberViolations > 0) {
    parts.push(`${veberViolations} Veber violation${veberViolations === 1 ? "" : "s"}`);
  }

  return parts.join("; ") + ".";
}

export interface CompoundAssessment {
  canonicalSmiles: string;
  inchiKey: string;
  molecularFormula: string;
  descriptors: MolecularDescriptors;
  structureSvg: string;
  safety: SafetyProfile;
}

/** Full deterministic assessment for one compound. Returns null for invalid SMILES. */
export async function assessCompound(smiles: string): Promise<CompoundAssessment | null> {
  const analysis = await analyzeSmiles(smiles);
  if (!analysis) return null;

  // Alerts are matched against the canonical form so that equivalent SMILES
  // spellings of the same molecule always produce identical results.
  const alerts = await findStructuralAlerts(analysis.canonicalSmiles);

  // Optional enrichment. Null whenever the sidecar is not configured or not answering,
  // in which case the profile below is byte-for-byte what it was before the sidecar
  // existed.
  const enrichment = await fetchEnrichment(analysis.canonicalSmiles);

  return {
    canonicalSmiles: analysis.canonicalSmiles,
    inchiKey: analysis.inchiKey,
    molecularFormula: analysis.molecularFormula,
    descriptors: analysis.descriptors,
    structureSvg: analysis.svg,
    safety: buildSafetyProfile(analysis.descriptors, alerts, enrichment),
  };
}

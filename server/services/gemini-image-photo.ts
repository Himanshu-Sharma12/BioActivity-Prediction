import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.5-flash"; // fast, supports multimodal
const FALLBACK_IMAGE_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

// Limits and validations
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // server-side cap (client enforces ~4MB)
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

export interface CompoundCandidate {
  name: string;
  smiles?: string;
  confidence: number; // 0..1
  rationale?: string;
}

export interface MedicineUsageGuidelines {
  dosage: string;
  timing: string;
  route: string;
  instructions: string;
}

export interface MedicineSafety {
  prescriptionStatus: string;
  warnings: string[];
  contraindications: string[];
  sideEffects: string[];
}

export interface MedicineIngredients {
  active: Array<{ name: string; strength?: string; smiles?: string }>;
  inactive: string[];
  formulation: string;
}

export interface MedicineConfidence {
  score: number; // 0..1
  labelReadable: boolean;
  rationale: string;
}

export interface MedicineInsights {
  summary: string;
  usageGuidelines: MedicineUsageGuidelines;
  ingredients: MedicineIngredients;
  safety: MedicineSafety;
  confidence: MedicineConfidence;
  compoundCandidates: CompoundCandidate[];
  // Optional enrichments
  rxNorm?: { rxcui?: string; name?: string };
  openFDALabel?: { brand?: string; warnings?: string[] };
}

// Utilities
function asString(v: unknown, fb = ""): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return fb;
  return String(v).trim();
}
function asNumber(v: unknown, fb: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fb;
}
function asBool(v: unknown, fb: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true") return true;
    if (t === "false") return false;
  }
  return fb;
}
function strArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v
      .split(/[\,\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, Number(n.toFixed(3))));
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e !== -1 && e > s) return text.slice(s, e + 1);
  throw new Error("JSON payload not found in Gemini response");
}

export function selectBestCompoundCandidate(list: CompoundCandidate[]): CompoundCandidate | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const filtered = list.filter((c) => c && c.name);
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => {
    const as = a.smiles ? 1 : 0;
    const bs = b.smiles ? 1 : 0;
    if (as !== bs) return bs - as; // prefer with SMILES
    const dc = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (Math.abs(dc) > 1e-6) return dc > 0 ? 1 : -1;
    return a.name.localeCompare(b.name);
  })[0];
}

const FALLBACK: MedicineInsights = {
  summary: "We couldn't confidently parse the photo. Showing a generic over-the-counter analgesic profile for reference only.",
  usageGuidelines: {
    dosage: "500 mg every 4–6 hours as needed (max 3,000 mg/day)",
    timing: "Spread doses; avoid combining with alcohol.",
    route: "Oral",
    instructions: "Take with water; consult a clinician if pain persists > 3 days.",
  },
  ingredients: {
    active: [{ name: "Paracetamol (Acetaminophen)", strength: "500 mg", smiles: "CC(=O)Nc1ccc(O)cc1" }],
    inactive: ["Microcrystalline cellulose", "Starch", "Magnesium stearate"],
    formulation: "Film-coated tablet",
  },
  safety: {
    prescriptionStatus: "Over-the-counter",
    warnings: ["Overdose can cause severe liver injury", "Avoid concurrent acetaminophen products"],
    contraindications: ["Severe hepatic impairment", "Known hypersensitivity"],
    sideEffects: ["Nausea", "Rash"],
  },
  confidence: { score: 0.35, labelReadable: false, rationale: "Fallback used" },
  compoundCandidates: [{ name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1", confidence: 0.35 }],
};

async function tryRxNormLookup(primaryName?: string) {
  try {
    const name = (primaryName || "").trim();
    if (!name) return undefined;
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui?name=${encodeURIComponent(name)}`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const text = await resp.text();
    const rxcui = text.match(/<rxcui>(\d+)<\/rxcui>/)?.[1];
    return rxcui ? { rxcui, name } : undefined;
  } catch {
    return undefined;
  }
}

async function tryOpenFDALabel(brand?: string) {
  try {
    const b = (brand || "").trim();
    if (!b) return undefined;
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(b)}"&limit=1`;
    const resp = await fetch(url);
    if (!resp.ok) return undefined;
    const data = await resp.json();
    const item = data?.results?.[0];
    const warnings = (item?.warnings || item?.warnings_and_cautions || []) as string[];
    return { brand: b, warnings };
  } catch {
    return undefined;
  }
}

export class GeminiImageAnalysisService {
  static async analyzeCompoundImage(imageBase64: string): Promise<MedicineInsights> {
    // Validate input
    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new Error("Image data is required as a Base64 string");
    }

    // MIME and size checks
    const mimeMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/i);
    const mime = (mimeMatch?.[1] || "image/jpeg").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new Error(`Unsupported image MIME type: ${mime}`);
    }
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    const approxBytes = Math.ceil((base64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw new Error("Image too large (server limit 6 MB)");
    }

    // If no key, return fallback gracefully
    if (!process.env.GEMINI_API_KEY) {
      return FALLBACK;
    }

    const prompt = `You are a careful AI pharmacist. Analyze the provided medicine photo and respond with JSON only, using this shape:
{
  "summary": "One paragraph identifying name/brand and purpose.",
  "usageGuidelines": { "dosage": "...", "timing": "...", "route": "...", "instructions": "..." },
  "ingredients": { "active": [{"name":"...","strength":"...","smiles":"optional"}], "inactive": ["..."], "formulation":"..." },
  "safety": { "prescriptionStatus": "...", "warnings": ["..."], "contraindications": ["..."], "sideEffects": ["..."] },
  "confidence": { "score": 0.0-1.0, "labelReadable": true/false, "rationale": "..." },
  "compoundCandidates": [{ "name":"...", "smiles":"optional", "confidence":0.0-1.0, "rationale":"..." }]
}
If uncertain, include your best inference and call out uncertainty. JSON only, no prose.`;

    try {
      const modelsToTry = [GEMINI_IMAGE_MODEL, ...FALLBACK_IMAGE_MODELS.filter(m => m !== GEMINI_IMAGE_MODEL)];
      let txt: string | null = null;
      let lastErr: any = null;

      for (const m of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: m });
          const result = await model.generateContent([
            { text: prompt },
            { inlineData: { data: base64, mimeType: mime } },
          ]);
          txt = result.response.text();
          if (txt) break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[Gemini-Image] model ${m} failed (${err.status || err.message}), trying fallback...`);
        }
      }

      if (!txt) {
        throw lastErr || new Error("Failed to get image analysis from Gemini models");
      }

      const json = extractJsonBlock(txt);
      const raw = JSON.parse(json) as Record<string, unknown>;

      // Normalize
      const usage = (raw.usageGuidelines as Record<string, unknown>) || {};
      const safety = (raw.safety as Record<string, unknown>) || {};
      const ingr = (raw.ingredients as Record<string, unknown>) || {};
      const conf = (raw.confidence as Record<string, unknown>) || {};
      const candidatesRaw = Array.isArray(raw.compoundCandidates) ? raw.compoundCandidates : [];
      const candidates: CompoundCandidate[] = (candidatesRaw as any[]).map((c: any) => ({
        name: asString(c?.name, ""),
        smiles: asString(c?.smiles || c?.smile || ""),
        confidence: clamp01(asNumber(c?.confidence, 0)),
        rationale: asString(c?.rationale || c?.reason || ""),
      })).filter((c) => c.name);

      const insights: MedicineInsights = {
        summary: asString(raw.summary, FALLBACK.summary),
        usageGuidelines: {
          dosage: asString(usage.dosage, FALLBACK.usageGuidelines.dosage),
          timing: asString(usage.timing, FALLBACK.usageGuidelines.timing),
          route: asString(usage.route, FALLBACK.usageGuidelines.route),
          instructions: asString(usage.instructions, FALLBACK.usageGuidelines.instructions),
        },
        ingredients: {
          active: Array.isArray((ingr as any).active) ? (ingr as any).active.map((a: any) => ({
            name: asString(a?.name, ""),
            strength: asString(a?.strength || a?.dosage || ""),
            smiles: asString(a?.smiles || ""),
          })).filter((a: any) => a.name) : FALLBACK.ingredients.active,
          inactive: strArray((ingr as any).inactive).length ? strArray((ingr as any).inactive) : FALLBACK.ingredients.inactive,
          formulation: asString((ingr as any).formulation, FALLBACK.ingredients.formulation),
        },
        safety: {
          prescriptionStatus: asString((safety as any).prescriptionStatus, FALLBACK.safety.prescriptionStatus),
          warnings: strArray((safety as any).warnings).length ? strArray((safety as any).warnings) : FALLBACK.safety.warnings,
          contraindications: strArray((safety as any).contraindications).length ? strArray((safety as any).contraindications) : FALLBACK.safety.contraindications,
          sideEffects: strArray((safety as any).sideEffects).length ? strArray((safety as any).sideEffects) : FALLBACK.safety.sideEffects,
        },
        confidence: {
          score: clamp01(asNumber((conf as any).score, FALLBACK.confidence.score)),
          labelReadable: asBool((conf as any).labelReadable, FALLBACK.confidence.labelReadable),
          rationale: asString((conf as any).rationale, FALLBACK.confidence.rationale),
        },
        compoundCandidates: candidates.length ? candidates : FALLBACK.compoundCandidates,
      };

      // Optional enrichments
      const primaryActive = insights.ingredients.active?.[0]?.name;
      const brandGuess = (insights.summary || "").split(/\b/).slice(0, 10).join(" "); // naive brand hint
      const [rx, fda] = await Promise.all([
        tryRxNormLookup(primaryActive),
        tryOpenFDALabel(brandGuess),
      ]);
      if (rx) insights.rxNorm = rx;
      if (fda) insights.openFDALabel = { brand: fda.brand, warnings: fda.warnings || [] };

      return insights;
    } catch (e) {
      console.error("Gemini image analysis failed:", e);
      return FALLBACK;
    }
  }
}

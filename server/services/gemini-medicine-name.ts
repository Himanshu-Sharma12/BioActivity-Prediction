import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-001";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function generateTextContent(prompt: string): Promise<string> {
  const modelsToTry = [GEMINI_TEXT_MODEL, ...FALLBACK_MODELS.filter(m => m !== GEMINI_TEXT_MODEL)];
  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([{ text: prompt }]);
      const text = result.response?.text();
      if (text) return text;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] model ${modelName} failed (${err.status || err.message}), trying next fallback...`);
    }
  }
  throw lastError || new Error("All Gemini models failed to generate content");
}

export interface MedicineNameIdentification {
  officialName: string;
  brandNames: string[];
  source?: string;
}

export interface MedicineActiveIngredient {
  name: string;
  chemicalClass: string;
  purpose: string;
  smiles?: string;
  strengths: string[];
}

export interface MedicineChemicalComponent {
  compound: string;
  role: string;
  smiles?: string;
}

export interface MedicineUsageGuidelines {
  typicalDosage: string;
  timing: string;
  route: string;
  ageRestrictions?: string;
  overdoseRisks: string;
}

export interface MedicineSafetyInformation {
  prescriptionRequired: boolean;
  sideEffects: string[];
  contraindications: string[];
  pregnancyWarnings: string;
  liverWarnings: string;
  kidneyWarnings: string;
  interactions: string[];
}

export type ConfidenceAssessment = "certain" | "partially certain" | "ambiguous";

export interface MedicineNameAnalysisResult {
  medicine: MedicineNameIdentification;
  activeIngredients: MedicineActiveIngredient[];
  chemicalComposition: MedicineChemicalComponent[];
  indications: string[];
  usageGuidelines: MedicineUsageGuidelines;
  safetyInformation: MedicineSafetyInformation;
  imageBase64?: string | null;
  confidence: {
    score: number;
    level: ConfidenceAssessment;
    rationale: string;
  };
  rawSource?: Record<string, unknown>;
}

const FALLBACK_ANALYSIS: MedicineNameAnalysisResult = {
  medicine: {
    officialName: "Unknown medicine",
    brandNames: [],
  },
  activeIngredients: [],
  chemicalComposition: [],
  indications: [],
  usageGuidelines: {
    typicalDosage: "",
    timing: "",
    route: "",
    ageRestrictions: undefined,
    overdoseRisks: "",
  },
  safetyInformation: {
    prescriptionRequired: false,
    sideEffects: [],
    contraindications: [],
    pregnancyWarnings: "",
    liverWarnings: "",
    kidneyWarnings: "",
    interactions: [],
  },
  imageBase64: null,
  confidence: {
    score: 0,
    level: "ambiguous",
    rationale: "Fallback response because the AI service could not be reached.",
  },
};

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => asString(entry)).filter((entry) => entry.length > 0);
  if (typeof value === "string" && value.trim().length) {
    return value
      .split(/[;|,|\n]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(3));
}

function inferLevel(score: number, hint?: string): ConfidenceAssessment {
  if (hint) {
    const normalized = hint.trim().toLowerCase();
    if (normalized.includes("certain")) return "certain";
    if (normalized.includes("partial")) return "partially certain";
    if (normalized.includes("ambig")) return "ambiguous";
  }
  if (score >= 0.8) return "certain";
  if (score >= 0.5) return "partially certain";
  return "ambiguous";
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  throw new Error("Could not parse AI response as JSON");
}

// Minimal SVG badge as a base64 image when Gemini image is unavailable
function createSimpleMedicineBadgeSVG(text: string): string {
  const label = (text || "Medicine").slice(0, 24);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340">
  <defs>
    <linearGradient id="g" x1="0" x2="1">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <g filter="url(#s)">
    <rect x="60" y="60" rx="24" ry="24" width="480" height="220" fill="white" stroke="#e2e8f0"/>
    <rect x="60" y="60" rx="24" ry="24" width="480" height="80" fill="url(#g)"/>
    <text x="300" y="112" font-family="Inter,Arial" font-size="28" font-weight="700" text-anchor="middle" fill="white">${label}</text>
    <g transform="translate(90,170)">
      <ellipse cx="60" cy="30" rx="60" ry="30" fill="#fde68a" stroke="#f59e0b"/>
      <rect x="160" y="8" width="250" height="44" rx="8" fill="#e2e8f0"/>
      <text x="285" y="38" font-family="Inter,Arial" font-size="16" text-anchor="middle" fill="#334155">Tablet / Pack</text>
    </g>
  </g>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

async function tryGenerateMedicineImage(medicineName: string, brandNames: string[]): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const imageModel = genAI.getGenerativeModel({ model: GEMINI_IMAGE_MODEL });
    const prompt = `Render a photorealistic studio image of the packaging or blister/tablet for the medicine ${medicineName}.${
      brandNames.length ? ` Common brands include ${brandNames.join(", ")}.` : ""
    } Plain white background, soft shadows, high-resolution PNG.`;

    const response = await imageModel.generateContent([{ text: prompt }]);
    const parts = response.response?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.warn("Gemini medicine image generation failed:", error);
  }

  return null;
}

async function enrichWithOpenFDA(medicineName: string): Promise<Record<string, unknown> | null> {
  try {
    const searchTerm = encodeURIComponent(medicineName);
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${searchTerm}"&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return null;
    return {
      brandName: result.openfda?.brand_name?.[0] || medicineName,
      genericName: result.openfda?.generic_name?.[0] || "",
      manufacturer: result.openfda?.manufacturer_name?.[0] || "",
      warnings: result.warnings?.[0]?.split("\n").filter((w: string) => w.trim()) || [],
      indications: result.indications_and_usage?.[0]?.split("\n").filter((i: string) => i.trim()) || [],
      dosage: result.dosage_and_administration?.[0] || "",
      adverseReactions: result.adverse_reactions?.[0]?.split("\n").filter((a: string) => a.trim()) || [],
    };
  } catch (error) {
    console.warn("OpenFDA enrichment failed:", error);
    return null;
  }
}

async function enrichWithRxNorm(medicineName: string): Promise<Record<string, unknown> | null> {
  try {
    const searchTerm = encodeURIComponent(medicineName);
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${searchTerm}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const rxcui = data?.idGroup?.rxnormId?.[0];
    if (!rxcui) return null;

    const propsUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`;
    const propsResponse = await fetch(propsUrl);
    if (!propsResponse.ok) return null;
    const propsData = await propsResponse.json();
    const properties = propsData?.properties;
    if (!properties) return null;

    return {
      rxcui,
      name: properties.name || medicineName,
      synonym: properties.synonym || "",
      tty: properties.tty || "",
    };
  } catch (error) {
    console.warn("RxNorm enrichment failed:", error);
    return null;
  }
}

export class GeminiMedicineNameService {
  static async analyzeMedicineName(name: string): Promise<MedicineNameAnalysisResult> {
    if (!name || typeof name !== "string") {
      throw new Error("Medicine name is required");
    }

    const trimmedName = name.trim();

    // If Gemini key is missing, still return a rich result using FDA/RxNorm
    if (!process.env.GEMINI_API_KEY) {
      const [fdaData, rxNormData] = await Promise.all([
        enrichWithOpenFDA(trimmedName),
        enrichWithRxNorm(trimmedName),
      ]);

      if (!fdaData && !rxNormData) {
        return { ...FALLBACK_ANALYSIS };
      }

      const warnings = (fdaData?.warnings as string[] | undefined) ?? [];
      const adverse = (fdaData?.adverseReactions as string[] | undefined) ?? [];
      const indications = (fdaData?.indications as string[] | undefined) ?? [];
      const dosage = (fdaData?.dosage as string | undefined) ?? "";

      const analysis: MedicineNameAnalysisResult = {
        medicine: {
          officialName: (rxNormData?.name as string) || (fdaData?.brandName as string) || trimmedName,
          brandNames: [
            ...(fdaData?.brandName ? [String(fdaData.brandName)] : []),
          ],
          source: "openfda+rxnorm",
        },
        activeIngredients: [],
        chemicalComposition: [],
        indications: indications.slice(0, 8),
        usageGuidelines: {
          typicalDosage: dosage,
          timing: "",
          route: "",
          ageRestrictions: "",
          overdoseRisks: "",
        },
        safetyInformation: {
          prescriptionRequired: false,
          sideEffects: adverse.slice(0, 12),
          contraindications: [],
          pregnancyWarnings: "",
          liverWarnings: "",
          kidneyWarnings: "",
          interactions: warnings.slice(0, 12),
        },
        imageBase64: createSimpleMedicineBadgeSVG(trimmedName),
        confidence: {
          score: 0.6,
          level: "partially certain",
          rationale: "Derived from FDA/RxNorm public data without AI generation.",
        },
        rawSource: { fdaData, rxNormData },
      };

      return analysis;
    }

    // Enrich with external APIs
    const [fdaData, rxNormData] = await Promise.all([
      enrichWithOpenFDA(trimmedName),
      enrichWithRxNorm(trimmedName),
    ]);

    const externalContext = [];
    if (fdaData) {
      externalContext.push(`OpenFDA data: Brand: ${fdaData.brandName}, Generic: ${fdaData.genericName}, Manufacturer: ${fdaData.manufacturer}, Warnings: ${(fdaData.warnings as string[]).slice(0, 3).join("; ")}`);
    }
    if (rxNormData) {
      externalContext.push(`RxNorm data: RXCUI: ${rxNormData.rxcui}, Name: ${rxNormData.name}, Type: ${rxNormData.tty}`);
    }

    const instructions = `Your task is to analyze a medicine based ONLY on its NAME and return a complete, structured JSON response.

Medicine to analyze: "${trimmedName}"

${externalContext.length ? `Additional validated data from FDA/RxNorm:\n${externalContext.join("\n")}\n` : ""}

Follow these rules strictly:

RULES:
1. Respond ONLY in valid JSON.
2. No explanatory text outside JSON.
3. If unsure, leave fields empty; do NOT hallucinate.
4. Provide SMILES when possible for chemical compounds.
5. Keep descriptions medically accurate.
6. Your output must match EXACTLY the JSON structure below.

RETURN EXACTLY THIS JSON STRUCTURE:

{
  "medicine": {
    "officialName": "",
    "brandNames": []
  },
  "activeIngredients": [
    {
      "name": "",
      "chemicalClass": "",
      "purpose": "",
      "smiles": "",
      "strengths": []
    }
  ],
  "chemicalComposition": [
    {
      "compound": "",
      "role": "",
      "smiles": ""
    }
  ],
  "indications": [],
  "usageGuidelines": {
    "typicalDosage": "",
    "timing": "",
    "route": "",
    "ageRestrictions": "",
    "overdoseRisks": ""
  },
  "safetyInformation": {
    "prescriptionRequired": false,
    "sideEffects": [],
    "contraindications": [],
    "pregnancyWarnings": "",
    "liverWarnings": "",
    "kidneyWarnings": "",
    "interactions": []
  },
  "confidence": {
    "score": 0.0,
    "level": "certain",
    "rationale": ""
  }
}

INCLUDE IN YOUR ANALYSIS:
- Verified medicine name
- Common brand names
- Active ingredients (name, role, chemical class, strength, SMILES)
- Chemical composition (compounds + SMILES)
- Diseases/conditions this medicine treats
- Dosage and timing instructions (general public info)
- Route of administration
- Safety warnings
- Side effects
- Contraindications
- Whether it requires a prescription
- Confidence score (0–1)`;

    let rawPayload: Record<string, unknown> | null = null;

    try {
      const text = await generateTextContent(instructions);
      const json = extractJsonBlock(text);
      rawPayload = JSON.parse(json) as Record<string, unknown>;
    } catch (error) {
      console.error("Gemini medicine name analysis failed:", error);
      return { ...FALLBACK_ANALYSIS };
    }

    const medicineBlock = (rawPayload?.medicine as Record<string, unknown>) || {};
    const usageBlock = (rawPayload?.usageGuidelines as Record<string, unknown>) || {};
    const safetyBlock = (rawPayload?.safetyInformation as Record<string, unknown>) || {};
    const confidenceBlock = (rawPayload?.confidence as Record<string, unknown>) || {};

    const medicine: MedicineNameIdentification = {
      officialName: asString(medicineBlock.officialName, trimmedName),
      brandNames: ensureStringArray(medicineBlock.brandNames),
      source: asString(medicineBlock.source || medicineBlock.reference || ""),
    };

    const activeIngredients = Array.isArray(rawPayload?.activeIngredients)
      ? (rawPayload!.activeIngredients as Array<Record<string, unknown>>).map((entry) => ({
          name: asString(entry.name, ""),
          chemicalClass: asString(entry.chemicalClass, ""),
          purpose: asString(entry.purpose, ""),
          smiles: asString(entry.smiles || entry.SMILES || "") || undefined,
          strengths: ensureStringArray(entry.strengths),
        })).filter((ingredient) => ingredient.name.length > 0)
      : [];

    const chemicalComposition = Array.isArray(rawPayload?.chemicalComposition)
      ? (rawPayload!.chemicalComposition as Array<Record<string, unknown>>).map((entry) => ({
          compound: asString(entry.compound, ""),
          role: asString(entry.role, ""),
          smiles: asString(entry.smiles || entry.SMILES || "") || undefined,
        })).filter((component) => component.compound.length > 0)
      : [];

    const indications = ensureStringArray(rawPayload?.indications);

    const usageGuidelines: MedicineUsageGuidelines = {
      typicalDosage: asString(usageBlock.typicalDosage, ""),
      timing: asString(usageBlock.timing, ""),
      route: asString(usageBlock.route, ""),
      ageRestrictions: asString(usageBlock.ageRestrictions || usageBlock.ageLimit || ""),
      overdoseRisks: asString(usageBlock.overdoseRisks || usageBlock.overdoseWarnings || ""),
    };

    const safetyInformation: MedicineSafetyInformation = {
      prescriptionRequired: asBool(safetyBlock.prescriptionRequired, false),
      sideEffects: ensureStringArray(safetyBlock.sideEffects),
      contraindications: ensureStringArray(safetyBlock.contraindications),
      pregnancyWarnings: asString(safetyBlock.pregnancyWarnings || safetyBlock.pregnancy || ""),
      liverWarnings: asString(safetyBlock.liverWarnings || safetyBlock.hepaticWarnings || ""),
      kidneyWarnings: asString(safetyBlock.kidneyWarnings || safetyBlock.renalWarnings || ""),
      interactions: ensureStringArray(safetyBlock.interactions),
    };

    const score = clampConfidence(asNumber(confidenceBlock.score, 0.7));
    const level = inferLevel(score, asString(confidenceBlock.level));

    const analysis: MedicineNameAnalysisResult = {
      medicine,
      activeIngredients,
      chemicalComposition,
      indications,
      usageGuidelines,
      safetyInformation,
      imageBase64: null,
      confidence: {
        score,
        level,
        rationale: asString(confidenceBlock.rationale, ""),
      },
      rawSource: rawPayload,
    };

    try {
      const image = await tryGenerateMedicineImage(medicine.officialName, medicine.brandNames);
      analysis.imageBase64 = image || createSimpleMedicineBadgeSVG(medicine.officialName);
    } catch (error) {
      analysis.imageBase64 = createSimpleMedicineBadgeSVG(medicine.officialName);
    }

    return analysis;
  }
}

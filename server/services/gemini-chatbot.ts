import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isValidSmiles, analyzeSmiles } from "./rdkit";

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface ChatContext {
  smiles?: string;
  compoundName?: string;
  descriptors?: {
    molecularWeight?: number;
    logP?: number;
    tpsa?: number;
    rotatableBonds?: number;
    hbdCount?: number;
    hbaCount?: number;
    atomCount?: number;
    ringCount?: number;
  };
  safetySummary?: {
    riskLevel?: string;
    alertsCount?: number;
    alerts?: string[];
  };
  bioactivitySummary?: {
    primaryTargets?: string[];
  };
}

export interface ChatAction {
  label: string;
  type: "load_smiles" | "analyze" | "draw" | "quick_reply";
  payload?: string;
}

export interface ChatbotResponse {
  reply: string;
  suggestedSmiles?: string;
  suggestedCompoundName?: string;
  chemicalRationale?: string;
  actions?: ChatAction[];
}

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelsToTry = [GEMINI_TEXT_MODEL, ...FALLBACK_MODELS.filter(m => m !== GEMINI_TEXT_MODEL)];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction || undefined,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out after 5s")), 5000)
      );
      const result = await Promise.race([
        model.generateContent([{ text: prompt }]),
        timeoutPromise
      ]);
      const text = result.response?.text();
      if (text && text.trim().length > 0) return text;
    } catch (err: any) {
      lastError = err;
      console.warn(`[GeminiChatbot] model ${modelName} failed (${err.status || err.message}), trying next fallback...`);
    }
  }
  throw lastError || new Error("All Gemini models failed to generate chat content");
}

const SYSTEM_PROMPT = `
You are the BioPredict Safety AI Chemistry & Formulation Specialist — an expert in medicinal chemistry, cheminformatics, chemical structure design (SMILES notation), pharmacology, toxicology, and drug formulation.

You assist researchers, medicinal chemists, and students with:
1. Drawing and generating SMILES notation for any chemical, drug, scaffold, or user description.
2. Modifying chemical structures (e.g., adding functional groups, fluorination, bioisosteric replacement of carboxylic acids/esters, scaffold hopping, improving water solubility, lowering LogP, reducing hERG liability or PAINS alerts).
3. Interpreting RDKit physicochemical descriptors (MW, LogP, TPSA, HBD, HBA, Rotatable Bonds) and Lipinski Rule of 5 / Veber drug-likeness.
4. Analyzing biological targets, ChEMBL experimental assays, mechanism of action, and physiological ion transport.
5. Evaluating toxicology and structural alerts (Brenk liabilities, Baell PAINS interference).
6. Designing pharmaceutical formulations (FDC tablets, nanoparticles, prodrugs).

CRITICAL FORMATTING INSTRUCTIONS:
- Whenever you suggest, generate, or modify a chemical molecule, ALWAYS output a JSON block inside triple backticks with tag \`\`\`json-smiles at the very end of your response, formatted as:
\`\`\`json-smiles
{
  "smiles": "CANONICAL_OR_ISOMERIC_SMILES",
  "name": "Compound Name or Derivative Name",
  "formula": "Molecular Formula if known",
  "rationale": "Brief chemical explanation of why this structure matches the request"
}
\`\`\`
- Keep SMILES valid according to Daylight SMILES syntax (proper atom symbols, ring closures matching digits 1-9, correct brackets for charges like [Na+], [Cl-], [N+](=O)[O-]).
- Provide clear, professional, concise, and scientifically accurate explanations.
- Use markdown formatting with bullet points and bold headers where appropriate.
`.trim();

export class GeminiChatbotService {
  /**
   * Process a user chat message with context awareness and optional drawing assistance.
   */
  static async handleChat(
    message: string,
    history: ChatMessage[] = [],
    context?: ChatContext,
    actionRequest?: "draw_smiles" | "explain" | "modify_smiles" | "suggest_analogs" | "safety_audit"
  ): Promise<ChatbotResponse> {
    // Build context summary for prompt
    let contextStr = "";
    if (context?.smiles || context?.compoundName) {
      contextStr += `\n[ACTIVE COMPOUND CONTEXT]:\n`;
      if (context.compoundName) contextStr += `- Name: ${context.compoundName}\n`;
      if (context.smiles) contextStr += `- SMILES: ${context.smiles}\n`;
      if (context.descriptors) {
        contextStr += `- Descriptors: MW ${context.descriptors.molecularWeight || 'N/A'} g/mol, LogP ${context.descriptors.logP || 'N/A'}, TPSA ${context.descriptors.tpsa || 'N/A'} Å², HBD ${context.descriptors.hbdCount || 0}, HBA ${context.descriptors.hbaCount || 0}, Rotatable Bonds ${context.descriptors.rotatableBonds || 0}\n`;
      }
      if (context.safetySummary) {
        contextStr += `- Safety Risk: ${context.safetySummary.riskLevel || 'N/A'}, Alerts Count: ${context.safetySummary.alertsCount || 0}\n`;
      }
    }

    // Format recent history (last 6 messages to stay concise)
    let historyStr = "";
    const recentHistory = history.slice(-6);
    if (recentHistory.length > 0) {
      historyStr = "\n[CONVERSATION HISTORY]:\n" + recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n") + "\n";
    }

    let instructionSuffix = "";
    if (actionRequest === "draw_smiles" || /draw|smiles|sketch|structure|molecule|build|analog/i.test(message)) {
      instructionSuffix = `\nThe user is actively working in the SMILES Drawing Studio / Molecular Builder. If the user asks to draw, modify, or create a molecule, ensure you output the exact SMILES in the \`\`\`json-smiles block so it can be loaded directly onto their drawing canvas.`;
    }

    const fullPrompt = `
${contextStr}
${historyStr}
[USER REQUEST]:
${message}
${instructionSuffix}
`.trim();

    try {
      const rawResponse = await callGemini(fullPrompt, SYSTEM_PROMPT);
      return await this.parseResponse(rawResponse, context);
    } catch (err: any) {
      console.error("[GeminiChatbot] Error generating response:", err);
      // Fallback response with deterministic chemistry knowledge
      return this.generateDeterministicFallback(message, context);
    }
  }

  /**
   * Parse raw LLM response, extract JSON-SMILES block if present, and validate SMILES with RDKit.
   */
  private static async parseResponse(text: string, context?: ChatContext): Promise<ChatbotResponse> {
    let cleanReply = text;
    let suggestedSmiles: string | undefined;
    let suggestedCompoundName: string | undefined;
    let chemicalRationale: string | undefined;
    const actions: ChatAction[] = [];

    // Extract ```json-smiles block if present
    const jsonSmilesRegex = /```json-smiles\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonSmilesRegex);

    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.smiles && typeof parsed.smiles === 'string') {
          const rawSmiles = parsed.smiles.trim();
          // Validate and canonicalize using RDKit WASM
          const analysis = await analyzeSmiles(rawSmiles);
          if (analysis) {
            suggestedSmiles = analysis.canonicalSmiles;
            suggestedCompoundName = parsed.name || "Custom Molecule";
            chemicalRationale = parsed.rationale;
          } else {
            console.warn(`[GeminiChatbot] Proposed SMILES "${rawSmiles}" failed RDKit validation`);
          }
        }
      } catch (e) {
        console.warn("[GeminiChatbot] Failed to parse json-smiles block:", e);
      }
      // Remove the json-smiles block from user-visible reply text
      cleanReply = text.replace(jsonSmilesRegex, "").trim();
    } else {
      // Fallback: check if standard ```json block has a smiles field
      const genericJsonRegex = /```json\s*(\{[\s\S]*?"smiles"[\s\S]*?\})\s*```/;
      const gMatch = text.match(genericJsonRegex);
      if (gMatch && gMatch[1]) {
        try {
          const parsed = JSON.parse(gMatch[1]);
          if (parsed.smiles) {
            const analysis = await analyzeSmiles(parsed.smiles);
            if (analysis) {
              suggestedSmiles = analysis.canonicalSmiles;
              suggestedCompoundName = parsed.name || "Target Molecule";
              chemicalRationale = parsed.rationale;
              cleanReply = text.replace(genericJsonRegex, "").trim();
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Build action buttons
    if (suggestedSmiles) {
      actions.push({
        label: `🎨 Load "${suggestedCompoundName || 'Molecule'}" into Drawing Studio`,
        type: "load_smiles",
        payload: suggestedSmiles,
      });
      actions.push({
        label: `⚡ Analyze "${suggestedCompoundName || 'Molecule'}" Now`,
        type: "analyze",
        payload: suggestedSmiles,
      });
    } else if (context?.smiles) {
      actions.push({
        label: `🔬 Audit Safety of ${context.compoundName || 'Current Compound'}`,
        type: "quick_reply",
        payload: `Audit the safety profile of ${context.compoundName || context.smiles}`,
      });
      actions.push({
        label: `🎨 Modify in Drawing Studio`,
        type: "draw",
        payload: context.smiles,
      });
    }

    return {
      reply: cleanReply,
      suggestedSmiles,
      suggestedCompoundName,
      chemicalRationale,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  /**
   * High-quality deterministic fallback if Gemini API is unreachable or exhausted.
   */
  private static async generateDeterministicFallback(
    message: string,
    context?: ChatContext
  ): Promise<ChatbotResponse> {
    const lower = message.toLowerCase();

    // Specific molecule requests
    const library: Record<string, { smiles: string; name: string; rationale: string }> = {
      aspirin: {
        smiles: "CC(=O)Oc1ccccc1C(=O)O",
        name: "Aspirin (Acetylsalicylic Acid)",
        rationale: "Classic NSAID COX-1/COX-2 inhibitor with acetyl ester and ortho-carboxylic acid on a benzene ring.",
      },
      paracetamol: {
        smiles: "CC(=O)Nc1ccc(O)cc1",
        name: "Paracetamol (Acetaminophen)",
        rationale: "4-hydroxyacetanilide consisting of a benzene ring substituted by a hydroxyl group and an acetamido group at para positions.",
      },
      caffeine: {
        smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C",
        name: "Caffeine",
        rationale: "1,3,7-trimethylxanthine purine alkaloid that antagonizes adenosine A1 and A2A receptors.",
      },
      ibuprofen: {
        smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
        name: "Ibuprofen",
        rationale: "2-(4-isobutylphenyl)propanoic acid NSAID with lipophilic branched alkyl group.",
      },
      benzene: {
        smiles: "c1ccccc1",
        name: "Benzene",
        rationale: "Fundamental 6-carbon aromatic ring scaffold.",
      },
      pyridine: {
        smiles: "c1ccncc1",
        name: "Pyridine",
        rationale: "Six-membered aromatic heterocycle containing one nitrogen heteroatom.",
      },
      phenol: {
        smiles: "c1ccc(O)cc1",
        name: "Phenol",
        rationale: "Hydroxyl group directly attached to an aromatic benzene ring.",
      },
      aniline: {
        smiles: "c1ccc(N)cc1",
        name: "Aniline",
        rationale: "Primary aromatic amine consisting of an amino group attached to benzene.",
      },
    };

    // Specific substituted derivatives check before broad scaffolds
    if (lower.includes("aniline") || (lower.includes("benzene") && (lower.includes("amine") || lower.includes("amino")))) {
      return {
        reply: `Here is the chemical structure for **Aniline (Aminobenzene)**.\n\n• **Canonical SMILES**: \`c1ccc(N)cc1\`\n• **Chemical Rationale**: Benzene ring directly substituted with a primary amino group (-NH2).\n\nYou can load this structure directly into the Drawing Studio or trigger full safety analysis.`,
        suggestedSmiles: "c1ccc(N)cc1",
        suggestedCompoundName: "Aniline",
        chemicalRationale: "Benzene substituted with an amino group.",
        actions: [
          { label: `🎨 Load into Drawing Studio`, type: "load_smiles", payload: "c1ccc(N)cc1" },
          { label: `⚡ Analyze Aniline`, type: "analyze", payload: "c1ccc(N)cc1" },
        ],
      };
    }

    for (const [key, val] of Object.entries(library)) {
      if (lower.includes(key)) {
        return {
          reply: `Here is the chemical structure for **${val.name}**.\n\n• **Canonical SMILES**: \`${val.smiles}\`\n• **Chemical Rationale**: ${val.rationale}\n\nYou can click below to load this structure directly into the Drawing Studio or trigger full safety analysis.`,
          suggestedSmiles: val.smiles,
          suggestedCompoundName: val.name,
          chemicalRationale: val.rationale,
          actions: [
            { label: `🎨 Load into Drawing Studio`, type: "load_smiles", payload: val.smiles },
            { label: `⚡ Analyze ${val.name}`, type: "analyze", payload: val.smiles },
          ],
        };
      }
    }

    if (lower.includes("draw") || lower.includes("smiles") || lower.includes("how to")) {
      return {
        reply: `### How to Draw Molecules in BioPredict:
1. **Interactive Canvas**: Open the **Draw** tab above.
2. **Atom Tool**: Select **C, N, O, S, P, F, Cl, Br** and click on the canvas to place atoms.
3. **Bond Tool**: Click an atom and drag or click another atom to bond them. Click any bond to toggle **Single (-) → Double (=) → Triple (#)**.
4. **Ring & Scaffold Stamps**: Drop pre-assembled rings like **Benzene**, **Pyridine**, or **Cyclohexane** with 1 click.
5. **Functional Group Snapping**: Snap **-OH, -NH2, -COOH, -NO2, -SO2NH2** directly onto any selected atom.
6. **AI Assistant**: You can also type what you want right here (e.g., *"Draw an ibuprofen analog with fluorine"*) and I'll generate the valid SMILES for your canvas!`,
        actions: [
          { label: "🎨 Open Drawing Studio", type: "draw" },
          { label: "🌟 Draw Aspirin", type: "load_smiles", payload: "CC(=O)Oc1ccccc1C(=O)O" },
          { label: "⬡ Draw Benzene Scaffold", type: "load_smiles", payload: "c1ccccc1" },
        ],
      };
    }

    return {
      reply: `I am your AI Medicinal Chemistry Copilot. I can assist you with:\n\n• **Drawing & Designing SMILES**: Ask me to draw any drug, ring scaffold, or analog.\n• **Structure Optimization**: Ask how to improve solubility, permeability, or reduce toxicity alerts.\n• **Descriptor Analysis**: Explain LogP, TPSA, H-bond donors/acceptors, and Lipinski / Veber rules.\n• **Target & Safety Audit**: Understand ChEMBL experimental assays, putative targets, and Brenk/PAINS alerts.\n\nWhat would you like to explore or build?`,
      actions: [
        { label: "🎨 Open Drawing Studio", type: "draw" },
        { label: "⬡ Load Reference Molecule", type: "load_smiles", payload: "CC(=O)Oc1ccccc1C(=O)O" },
      ],
    };
  }
}

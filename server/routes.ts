import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { MolecularCalculator } from "./services/molecular";
import { assessCompound } from "./services/safety";
import { isValidSmiles } from "./services/rdkit";
import { lookupMeasuredActivity, CHEMBL_ATTRIBUTION } from "./services/chembl";
import { predictBioactivityProfile } from "./services/bioactivity-prediction";
import { Gemini3DService } from "./services/gemini-3d";
import { GeminiImageAnalysisService, selectBestCompoundCandidate } from "./services/gemini-image-photo";
import { GeminiMedicineNameService } from "./services/gemini-medicine-name";
import { GeminiTherapeuticPredictionService } from "./services/gemini-therapeutic-prediction";
import { PubChemService } from "./services/pubchem";
import { GeminiChatbotService } from "./services/gemini-chatbot";
import { MolecularCanvasService } from "./services/molecular-canvas";
import { insertCompoundSchema, insertPredictionSchema, insertBatchJobSchema, type SafetyAssessment, type MolecularDescriptors } from "@shared/schema";

/** Upper bound on a single batch submission. */
const MAX_BATCH_COMPOUNDS = 100;

/**
 * Upper bound on a single SMILES string. Real drug-like structures are well under
 * this; anything longer is either a mistake or an attempt to make the parser work
 * hard on every request.
 */
const MAX_SMILES_LENGTH = 1000;

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Analyze compound endpoint
  app.post("/api/compounds/analyze", async (req, res) => {
    try {
      const { smiles: inputSmiles, name: inputName } = req.body;
      const cleanSmiles = typeof inputSmiles === 'string' ? inputSmiles.trim() : '';
      const cleanName = typeof inputName === 'string' ? inputName.trim() : '';

      if (!cleanSmiles && !cleanName) {
        return res.status(400).json({ 
          message: "Either SMILES notation or compound name is required" 
        });
      }

      // Determine the primary query to resolve:
      // If user typed a compound name (e.g. "Sodium chloride", "Aspirin") and cleanSmiles differs from the compound's true structure,
      // the compound name takes priority over any stale/default SMILES.
      let input: string;
      if (cleanName && !cleanSmiles) {
        input = cleanName;
      } else if (cleanSmiles && !cleanName) {
        input = cleanSmiles;
      } else if (cleanName && cleanSmiles) {
        if (cleanName.toLowerCase() !== cleanSmiles.toLowerCase()) {
          try {
            const nameResolved = await PubChemService.resolveToSmiles(cleanName);
            if (nameResolved && nameResolved.smiles && nameResolved.smiles !== cleanSmiles) {
              console.log(`📌 User specified compound name "${cleanName}" (${nameResolved.smiles}) takes precedence over mismatched SMILES "${cleanSmiles}"`);
              input = cleanName;
            } else {
              input = cleanSmiles;
            }
          } catch {
            input = cleanSmiles;
          }
        } else {
          input = cleanSmiles;
        }
      } else {
        input = cleanSmiles || cleanName;
      }
      
      console.log("📥 Analyze request - Input:", input, "InputSMILES:", inputSmiles, "InputName:", inputName);

      if (input.length > MAX_SMILES_LENGTH) {
        return res.status(400).json({
          message: `Input is too long (max ${MAX_SMILES_LENGTH} characters).`,
        });
      }
      
      // Resolve input to SMILES notation
      let resolvedSmiles: string;
      let resolvedName: string;
      let isAiDeduction = false;
      let aiDeductionRationale: string | undefined;
      
      console.log("🔍 Checking if input is SMILES or compound name...");
      
      try {
        const resolved = await PubChemService.resolveToSmiles(input);
        console.log("✅ PubChem resolved - SMILES:", resolved.smiles, "Name:", resolved.name);
        resolvedSmiles = resolved.smiles;
        resolvedName = resolved.name || inputName || '';
      } catch (pubchemError) {
        console.log("⚠️ PubChem lookup failed:", pubchemError instanceof Error ? pubchemError.message : pubchemError);
        // If PubChem fails, check if input is valid SMILES
        if (await isValidSmiles(input)) {
          console.log("✅ Input is valid SMILES, using directly");
          resolvedSmiles = input;
          resolvedName = inputName || '';
        } else {
          // Both PubChem lookup and direct SMILES validation failed.
          // Fall back to Gemini AI to deduce chemical structure & SMILES for unindexed / novel compound!
          console.log("🧠 Attempting Gemini AI structure deduction for unindexed compound:", input);
          const aiResult = await GeminiTherapeuticPredictionService.predictStructureFromCompoundName(input);
          if (aiResult && aiResult.smiles && (await isValidSmiles(aiResult.smiles))) {
            console.log("✨ Gemini successfully deduced structure - SMILES:", aiResult.smiles, "Name:", aiResult.name);
            resolvedSmiles = aiResult.smiles;
            resolvedName = aiResult.name || inputName || input;
            isAiDeduction = true;
            aiDeductionRationale = aiResult.rationale;
          } else {
            console.log("❌ Could not deduce chemical structure for:", input);
            return res.status(400).json({ 
              message: `Could not resolve "${input}" to a valid chemical structure. Please check the spelling, supply an alternate chemical name, or provide a SMILES notation directly.`
            });
          }
        }
      }
      
      console.log("📝 Final resolved - SMILES:", resolvedSmiles, "Name:", resolvedName);
      // Validate the resolved SMILES
      if (!(await isValidSmiles(resolvedSmiles))) {
        return res.status(400).json({ message: "Invalid SMILES notation" });
      }

      // Generate a name if not provided
      const compoundName = resolvedName || await MolecularCalculator.generateCompoundName(resolvedSmiles);

      const structurePromise = PubChemService.getCompoundStructure(resolvedSmiles)
        .then(async (pubchemSummary) => {
          if (pubchemSummary && !pubchemSummary.coordinates3d) {
            // PubChem has no 3D record (e.g. inorganic salts like NaCl); generate accurate coordinates
            const fallback3d = await Gemini3DService.generate3DVisualization(resolvedSmiles, compoundName).catch(() => null);
            if (fallback3d?.success && fallback3d.data) {
              pubchemSummary.coordinates3d = {
                atoms: fallback3d.data.atoms,
                bonds: fallback3d.data.bonds,
              };
            }
          } else if (pubchemSummary?.coordinates3d) {
            const c3d = pubchemSummary.coordinates3d;
            if (Array.isArray(c3d.atoms) && c3d.atoms.length === 2 && (!Array.isArray(c3d.bonds) || c3d.bonds.length === 0)) {
              c3d.bonds = [{ from: 0, to: 1, order: 1 }];
            } else if (Array.isArray(c3d.atoms) && c3d.atoms.length === 3 && (!Array.isArray(c3d.bonds) || c3d.bonds.length === 0)) {
              c3d.bonds = [{ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 }];
            }
          }
          return pubchemSummary;
        })
        .catch((structureError) => {
          console.warn("⚠️ PubChem structure fetch failed:", structureError instanceof Error ? structureError.message : structureError);
          return null;
        });
      
      // Check if compound already exists
      let compound = await storage.getCompoundBySmiles(resolvedSmiles);
      if (!compound) {
        // Create new compound with generated or provided name
        const compoundData = insertCompoundSchema.parse({ 
          smiles: resolvedSmiles, 
          name: compoundName 
        });
        compound = await storage.createCompound(compoundData);
      } else {
        // Update compound name if it's different or was empty
        if (compoundName && compound.name !== compoundName) {
          compound = await storage.updateCompound(compound.id, { name: compoundName }) || compound;
        }
      }
      
      // Check if prediction already exists
      let prediction = await storage.getPredictionByCompoundId(compound.id);
      
      if (!prediction) {
        // Real descriptors from RDKit plus deterministic structural alerts.
        // Replaces the former regex-derived descriptors and randomised toxicity model.
        const assessment = await assessCompound(resolvedSmiles);
        if (!assessment) {
          return res.status(400).json({
            message: "Could not parse this structure. Please check the SMILES notation.",
          });
        }

        const predictionData = insertPredictionSchema.parse({
          compoundId: compound.id,
          canonicalSmiles: assessment.canonicalSmiles,
          inchiKey: assessment.inchiKey,
          molecularFormula: assessment.molecularFormula,
          descriptors: assessment.descriptors,
          safetyAssessment: assessment.safety,
        });

        prediction = await storage.createPrediction(predictionData);
      }

      const safety = prediction.safetyAssessment as SafetyAssessment;

      // Look up measured activity from ChEMBL. If ChEMBL has no physical assay measurements
      // (e.g. for inorganic salts like NaCl, unindexed molecules, or nutrients), generate
      // a rich AI & physiological molecular bioactivity profile so activity is NEVER empty.
      let measuredActivity = await lookupMeasuredActivity(
        (prediction.canonicalSmiles as string) ?? resolvedSmiles,
      ).catch(() => null);

      if (!measuredActivity || measuredActivity.activities.length === 0) {
        measuredActivity = await predictBioactivityProfile({
          name: compoundName,
          smiles: resolvedSmiles,
          descriptors: prediction.descriptors as any,
        }).catch(() => null);
      }

      const structure = await structurePromise;

      // Concurrently run therapeutic prediction, autonomous combinations, and unknown profiling
      const [therapeuticPrediction, combinatorialProfile, unknownCompoundProfile] = await Promise.all([
        GeminiTherapeuticPredictionService.predictTherapeuticProfile({
          name: compoundName,
          smiles: resolvedSmiles,
          descriptors: prediction.descriptors as any,
          lipinskiRules: safety.drugLikeness.lipinski,
          structuralAlerts: safety.structuralAlerts,
        }).catch((err) => {
          console.warn("⚠️ Therapeutic prediction error:", err);
          return null;
        }),
        GeminiTherapeuticPredictionService.predictCombinationsAndFormulations({
          primaryName: compoundName,
          primarySmiles: resolvedSmiles,
          descriptors: prediction.descriptors as any,
        }).catch((err) => {
          console.warn("⚠️ Combinations prediction error:", err);
          return null;
        }),
        isAiDeduction ? GeminiTherapeuticPredictionService.profileUnknownCompound({
          name: compoundName,
          smiles: resolvedSmiles,
          descriptors: prediction.descriptors as any,
        }).catch((err) => {
          console.warn("⚠️ Unknown compound profiling error:", err);
          return null;
        }) : Promise.resolve(null),
      ]);

      res.json({
        compound,
        prediction,
        // Kept at the top level for backward compatibility with existing clients.
        lipinskiRules: safety.drugLikeness.lipinski,
        veberRules: safety.drugLikeness.veber,
        structuralAlerts: safety.structuralAlerts,
        measuredActivity,
        attribution: measuredActivity ? CHEMBL_ATTRIBUTION : null,
        disclaimer: safety.disclaimer,
        structure,
        therapeuticPrediction,
        combinatorialProfile,
        unknownCompoundProfile,
        isAiDeduction,
        aiDeductionRationale,
      });
      
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze compound" });
    }
  });
  
  // Analyze compound image with Gemini AI, then verify best candidate and run full analysis
  app.post("/api/compounds/analyze-image", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ message: "Image data is required" });
      }

      console.log("Analyzing image with Gemini AI (photo insights)...");
      const medicineInsights = await GeminiImageAnalysisService.analyzeCompoundImage(imageBase64);
      console.log("Analysis complete. Summary:", medicineInsights?.summary?.slice(0, 80) || "(no summary)");

      // Attempt to pick a best candidate to verify via PubChem and run the standard pipeline
      const best = selectBestCompoundCandidate(medicineInsights.compoundCandidates || []);
      const fallbackName = medicineInsights.ingredients?.active?.[0]?.name;
      const candidateNameOrSmiles = best?.smiles || best?.name || fallbackName;

      if (!candidateNameOrSmiles) {
        // Return insights only if we cannot determine a candidate
        return res.json({ medicineInsights });
      }

      try {
        // Resolve to a trusted SMILES using PubChem
        const resolved = await PubChemService.resolveToSmiles(candidateNameOrSmiles);
        const resolvedSmiles = resolved.smiles;
        const resolvedName = resolved.name || candidateNameOrSmiles;

        // Validate the resolved SMILES
        if (!(await isValidSmiles(resolvedSmiles))) {
          return res.json({ medicineInsights });
        }

        // Generate a name if not provided
        const compoundName = resolvedName || await MolecularCalculator.generateCompoundName(resolvedSmiles);

        const structurePromise = PubChemService.getCompoundStructure(resolvedSmiles).catch(() => null);

        // Ensure compound exists or create
        let compound = await storage.getCompoundBySmiles(resolvedSmiles);
        if (!compound) {
          const compoundData = insertCompoundSchema.parse({ smiles: resolvedSmiles, name: compoundName });
          compound = await storage.createCompound(compoundData);
        } else if (compoundName && compound.name !== compoundName) {
          compound = (await storage.updateCompound(compound.id, { name: compoundName })) || compound;
        }

        // Prediction pipeline
        let prediction = await storage.getPredictionByCompoundId(compound.id);
        if (!prediction) {
          const assessment = await assessCompound(resolvedSmiles);
          if (!assessment) {
            return res.status(400).json({ message: "Could not parse the identified structure." });
          }
          const predictionData = insertPredictionSchema.parse({
            compoundId: compound.id,
            canonicalSmiles: assessment.canonicalSmiles,
            inchiKey: assessment.inchiKey,
            molecularFormula: assessment.molecularFormula,
            descriptors: assessment.descriptors,
            safetyAssessment: assessment.safety,
          });
          prediction = await storage.createPrediction(predictionData);
        }

        const lipinskiRules = (prediction.safetyAssessment as SafetyAssessment).drugLikeness.lipinski;
        const structure = await structurePromise;

        return res.json({
          medicineInsights,
          compound,
          prediction,
          lipinskiRules,
          structure,
        });
      } catch (verifyErr) {
        console.warn("Candidate verification failed, returning insights only:", verifyErr);
        return res.json({ medicineInsights });
      }
    } catch (error) {
      console.error("Image analysis error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to analyze image" });
    }
  });

  // Analyze medicine by name using Gemini
  app.post("/api/medicine/analyze-name", async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "Medicine name is required" });
      }

      const analysis = await GeminiMedicineNameService.analyzeMedicineName(name.trim());
      res.json(analysis);
    } catch (error) {
      console.error("Medicine name analysis error:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to analyze medicine" });
    }
  });
  
  // Get recent compounds
  app.get("/api/compounds/recent", async (req, res) => {
    try {
      const compounds = await storage.getAllCompounds();
      const recentCompounds = compounds.slice(0, 10); // Get last 10
      
      // Get predictions for these compounds
      const predictions = await storage.getPredictionsByCompoundIds(
        recentCompounds.map(c => c.id)
      );
      
      const compoundsWithPredictions = recentCompounds.map(compound => ({
        ...compound,
        prediction: predictions.find(p => p.compoundId === compound.id),
      }));
      
      res.json(compoundsWithPredictions);
    } catch (error) {
      console.error("Error fetching recent compounds:", error);
      res.status(500).json({ message: "Failed to fetch recent compounds" });
    }
  });
  
  // Get compound by ID
  app.get("/api/compounds/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const compound = await storage.getCompound(id);
      
      if (!compound) {
        return res.status(404).json({ message: "Compound not found" });
      }
      
      const prediction = await storage.getPredictionByCompoundId(id);
      const lipinskiRules = prediction ? 
        (prediction.safetyAssessment as SafetyAssessment).drugLikeness.lipinski : null;
      
      res.json({
        compound,
        prediction,
        lipinskiRules,
      });
    } catch (error) {
      console.error("Error fetching compound:", error);
      res.status(500).json({ message: "Failed to fetch compound" });
    }
  });

  // Evaluate compound combinations, conditions, and autonomous medicine formulations
  app.post("/api/compounds/combinations", async (req, res) => {
    try {
      const { name, smiles, partnerName } = req.body;
      if (!name && !smiles) {
        return res.status(400).json({ message: "Compound name or SMILES is required" });
      }

      let resolvedSmiles = smiles;
      let resolvedName = name;
      if (!resolvedSmiles && name) {
        try {
          const pubchem = await PubChemService.resolveToSmiles(name);
          resolvedSmiles = pubchem.smiles;
          resolvedName = pubchem.name || name;
        } catch {
          // If not in PubChem, deduce with AI
          const ai = await GeminiTherapeuticPredictionService.predictStructureFromCompoundName(name);
          resolvedSmiles = ai?.smiles || "C1=CC=CC=C1";
        }
      }

      const result = await GeminiTherapeuticPredictionService.predictCombinationsAndFormulations({
        primaryName: resolvedName || "Compound",
        primarySmiles: resolvedSmiles || "C1=CC=CC=C1",
        partnerName: partnerName?.trim() || undefined,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Combinations prediction error:", err);
      res.status(500).json({ message: "Failed to predict combinations", error: err.message });
    }
  });

  // Deep AI chemical, synthetic, and target profiling for unknown compounds
  app.post("/api/compounds/unknown-profile", async (req, res) => {
    try {
      const { name, smiles } = req.body;
      if (!name && !smiles) {
        return res.status(400).json({ message: "Compound name or SMILES is required" });
      }

      let targetSmiles = smiles;
      if (!targetSmiles && name) {
        const deduced = await GeminiTherapeuticPredictionService.predictStructureFromCompoundName(name);
        targetSmiles = deduced?.smiles || "C1=CC=CC=C1";
      }

      const profile = await GeminiTherapeuticPredictionService.profileUnknownCompound({
        name: name || "Experimental Entity",
        smiles: targetSmiles,
      });

      res.json(profile);
    } catch (err: any) {
      console.error("Unknown compound profile error:", err);
      res.status(500).json({ message: "Failed to profile unknown compound", error: err.message });
    }
  });
  
  // Batch processing endpoint
  app.post("/api/batch/process", async (req, res) => {
    try {
      const { compounds } = req.body;
      
      if (!Array.isArray(compounds) || compounds.length === 0) {
        return res.status(400).json({ message: "Compounds array is required" });
      }

      // Previously unbounded: an arbitrarily long array was accepted and then
      // processed in setImmediate with no cap, no concurrency limit and no way
      // to cancel it.
      if (compounds.length > MAX_BATCH_COMPOUNDS) {
        return res.status(400).json({
          message: `Batch size is limited to ${MAX_BATCH_COMPOUNDS} compounds. Received ${compounds.length}.`,
        });
      }

      const malformed = compounds.findIndex(
        (c: unknown) =>
          typeof c !== "object" || c === null ||
          typeof (c as { smiles?: unknown }).smiles !== "string" ||
          !(c as { smiles: string }).smiles.trim() ||
          (c as { smiles: string }).smiles.length > MAX_SMILES_LENGTH,
      );
      if (malformed !== -1) {
        return res.status(400).json({
          message: `Entry at index ${malformed} is missing a valid 'smiles' string (max ${MAX_SMILES_LENGTH} characters).`,
        });
      }
      
      // Create batch job
      const batchJobData = insertBatchJobSchema.parse({
        status: 'processing',
        totalCompounds: compounds.length,
        processedCompounds: 0,
        results: [],
      });
      
      const batchJob = await storage.createBatchJob(batchJobData);
      
      // Process compounds asynchronously
      setImmediate(async () => {
        const results = [];
        
        for (let i = 0; i < compounds.length; i++) {
          try {
            const { smiles, name } = compounds[i];
            
            if (!(await isValidSmiles(smiles))) {
              results.push({ error: "Invalid SMILES", smiles, name });
              continue;
            }
            
            // Get or create compound
            let compound = await storage.getCompoundBySmiles(smiles);
            if (!compound) {
              compound = await storage.createCompound({ smiles, name });
            }
            
            // Get or create prediction
            let prediction = await storage.getPredictionByCompoundId(compound.id);
            if (!prediction) {
              const assessment = await assessCompound(smiles);
              if (!assessment) {
                results.push({ error: "Could not parse structure", smiles, name });
                continue;
              }

              prediction = await storage.createPrediction({
                compoundId: compound.id,
                canonicalSmiles: assessment.canonicalSmiles,
                inchiKey: assessment.inchiKey,
                molecularFormula: assessment.molecularFormula,
                descriptors: assessment.descriptors,
                safetyAssessment: assessment.safety,
              });
            }
            
            const lipinskiRules = (prediction.safetyAssessment as SafetyAssessment).drugLikeness.lipinski;
            
            results.push({
              compound,
              prediction,
              lipinskiRules,
            });
            
          } catch (error) {
            results.push({ 
              error: error instanceof Error ? error.message : "Processing error", 
              smiles: compounds[i]?.smiles 
            });
          }
          
          // Update progress
          await storage.updateBatchJob(batchJob.id, {
            processedCompounds: i + 1,
          });
        }
        
        // Mark batch as completed
        await storage.updateBatchJob(batchJob.id, {
          status: 'completed',
          results,
          completedAt: new Date(),
        });
      });
      
      res.json({ batchJobId: batchJob.id });
      
    } catch (error) {
      console.error("Batch processing error:", error);
      res.status(500).json({ message: "Failed to start batch processing" });
    }
  });
  
  // Get batch job status
  app.get("/api/batch/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const batchJob = await storage.getBatchJob(id);
      
      if (!batchJob) {
        return res.status(404).json({ message: "Batch job not found" });
      }
      
      res.json(batchJob);
    } catch (error) {
      console.error("Error fetching batch job:", error);
      res.status(500).json({ message: "Failed to fetch batch job" });
    }
  });
  
  // Export results endpoint
  app.post("/api/export", async (req, res) => {
    try {
      const { format, compoundIds } = req.body;
      
      if (!compoundIds || !Array.isArray(compoundIds)) {
        return res.status(400).json({ message: "Compound IDs are required" });
      }
      
      const compounds = await Promise.all(
        compoundIds.map(id => storage.getCompound(id))
      );
      
      const predictions = await storage.getPredictionsByCompoundIds(compoundIds);
      
      const data = compounds.map(compound => {
        if (!compound) return null;
        const prediction = predictions.find(p => p.compoundId === compound.id);
        return { compound, prediction };
      }).filter(Boolean);
      
      if (format === 'csv') {
        // Generate CSV
        const headers = [
          'SMILES', 'Canonical SMILES', 'Name', 'Formula', 'InChIKey', 'LogP', 'MW', 'TPSA', 
          'Rotatable Bonds', 'HBD', 'HBA', 'Concern Level', 'Structural Alerts', 'Lipinski Violations'
        ];
        
        const rows = data.map(item => {
          const d = item!.prediction?.descriptors as MolecularDescriptors | undefined;
          const safety = item!.prediction?.safetyAssessment as SafetyAssessment | undefined;
          return [
            item!.compound.smiles,
            item!.prediction?.canonicalSmiles || '',
            item!.compound.name || '',
            item!.prediction?.molecularFormula || '',
            item!.prediction?.inchiKey || '',
            d?.logP ?? '',
            d?.molecularWeight ?? '',
            d?.tpsa ?? '',
            d?.rotatableBonds ?? '',
            d?.hbdCount ?? '',
            d?.hbaCount ?? '',
            safety?.concernLevel ?? '',
            safety?.structuralAlerts.map(a => a.name).join('; ') ?? '',
            safety?.drugLikeness.lipinski.violations ?? '',
          ];
        });

        // Alert names and summaries contain commas, so every field needs quoting
        // or the CSV silently gains columns.
        const escapeCell = (v: unknown) => {
          const str = String(v ?? '');
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };

        const csv = [headers, ...rows]
          .map(row => row.map(escapeCell).join(','))
          .join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="predictions.csv"');
        res.send(csv);
        
      } else if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="predictions.json"');
        res.json(data);
        
      } else {
        res.status(400).json({ message: "Unsupported format" });
      }
      
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Save prediction
  app.post("/api/predictions/save", async (req, res) => {
    try {
      const { compoundId } = req.body as { compoundId?: string };
      if (!compoundId) return res.status(400).json({ message: "compoundId is required" });

      const compound = await storage.getCompound(compoundId);
      const prediction = await storage.getPredictionByCompoundId(compoundId);
      if (!compound || !prediction) return res.status(404).json({ message: "Prediction not found for compound" });

      await storage.savePrediction(compoundId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Save prediction error:", error);
      res.status(500).json({ message: "Failed to save prediction" });
    }
  });

  // Unsave prediction
  app.delete("/api/predictions/save/:compoundId", async (req, res) => {
    try {
      const { compoundId } = req.params;
      await storage.unsavePrediction(compoundId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Unsave prediction error:", error);
      res.status(500).json({ message: "Failed to unsave prediction" });
    }
  });

  // List saved predictions (latest first up to 20)
  app.get("/api/predictions/saved", async (_req, res) => {
    try {
      const ids = await storage.getSavedCompoundIds();
      const compounds = await Promise.all(ids.map(id => storage.getCompound(id)));
      const predictions = await storage.getPredictionsByCompoundIds(ids);
      const items = compounds
        .map((compound) => compound && ({
          ...compound,
          prediction: predictions.find(p => p.compoundId === compound.id)
        }))
        .filter(Boolean)
        .slice(0, 20);
      res.json(items);
    } catch (error) {
      console.error("List saved predictions error:", error);
      res.status(500).json({ message: "Failed to fetch saved predictions" });
    }
  });

  // Generate 3D structure using Gemini AI
  app.post("/api/gemini/generate-3d", async (req, res) => {
    try {
      const { smiles, name } = req.body;

      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ message: "SMILES notation is required" });
      }

      const result = await Gemini3DService.generate3DVisualization(smiles, name);
      
      if (!result.success) {
        return res.status(500).json({ 
          message: (result as any).error || "Failed to generate 3D structure",
          fallback: (result as any).fallback 
        });
      }

      res.json(result);
    } catch (error) {
      console.error("Gemini 3D generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate 3D structure",
        fallback: true 
      });
    }
  });

  // Get molecular insights using Gemini AI
  app.post("/api/gemini/insights", async (req, res) => {
    try {
      const { smiles, name } = req.body;

      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ message: "SMILES notation is required" });
      }

      const insights = await Gemini3DService.getMolecularInsights(smiles, name);
      
      if (!insights) {
        return res.status(500).json({ message: "Failed to get molecular insights" });
      }

      res.json(insights);
    } catch (error) {
      console.error("Gemini insights error:", error);
      res.status(500).json({ message: "Failed to get molecular insights" });
    }
  });

  // AI Chemist & SMILES Chatbot assistant endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, context, actionRequest } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }

      const response = await GeminiChatbotService.handleChat(
        message.trim(),
        Array.isArray(history) ? history : [],
        context,
        actionRequest
      );

      res.json(response);
    } catch (error) {
      console.error("Chatbot endpoint error:", error);
      res.status(500).json({ 
        reply: "I encountered an error processing your chemistry query. Please try again or rephrase your molecular structure request.",
      });
    }
  });

  // Molecular Canvas: Convert SMILES to 2D Graph (atoms with coordinates + bonds)
  app.post("/api/compounds/smiles-to-graph", async (req, res) => {
    try {
      const { smiles } = req.body;
      if (!smiles || typeof smiles !== 'string' || smiles.trim().length === 0) {
        return res.status(400).json({ message: "SMILES is required" });
      }

      const graph = await MolecularCanvasService.smilesToGraph(smiles.trim());
      if (!graph.valid) {
        return res.status(400).json({ 
          valid: false, 
          message: graph.error || "Invalid SMILES structure" 
        });
      }

      res.json(graph);
    } catch (error) {
      console.error("SMILES to graph error:", error);
      res.status(500).json({ message: "Failed to parse SMILES to molecular graph" });
    }
  });

  // Molecular Canvas: Convert 2D Graph (atoms + bonds) to Canonical SMILES
  app.post("/api/compounds/graph-to-smiles", async (req, res) => {
    try {
      const { atoms, bonds } = req.body;
      if (!Array.isArray(atoms) || atoms.length === 0) {
        return res.status(400).json({ message: "Atoms array is required" });
      }

      const graph = await MolecularCanvasService.graphToSmiles(
        atoms,
        Array.isArray(bonds) ? bonds : []
      );

      if (!graph.valid) {
        return res.status(400).json({ 
          valid: false, 
          message: graph.error || "Cannot generate valid SMILES from current graph (check valency)" 
        });
      }

      res.json(graph);
    } catch (error) {
      console.error("Graph to SMILES error:", error);
      res.status(500).json({ message: "Failed to convert molecular graph to SMILES" });
    }
  });

  console.log("✓ All routes registered");
  
  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { MolecularCalculator } from "./services/molecular";
import { MLPredictionService } from "./services/ml-prediction";
import { insertCompoundSchema, insertPredictionSchema, insertBatchJobSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Analyze compound endpoint
  app.post("/api/compounds/analyze", async (req, res) => {
    try {
      const { smiles, name } = req.body;
      
      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ message: "SMILES notation is required" });
      }
      
      // Validate SMILES
      if (!MolecularCalculator.validateSmiles(smiles)) {
        return res.status(400).json({ message: "Invalid SMILES notation" });
      }
      
      // Check if compound already exists
      let compound = await storage.getCompoundBySmiles(smiles);
      if (!compound) {
        // Create new compound
        const compoundData = insertCompoundSchema.parse({ smiles, name });
        compound = await storage.createCompound(compoundData);
      }
      
      // Check if prediction already exists
      let prediction = await storage.getPredictionByCompoundId(compound.id);
      
      if (!prediction) {
        // Calculate descriptors
        const descriptors = MolecularCalculator.calculateDescriptors(smiles);
        
        // Predict pIC50
        const { pic50, confidence } = MLPredictionService.predictPIC50(descriptors);
        
        // Assess safety
        const safetyAssessment = MLPredictionService.assessSafety(descriptors);
        
        // Store prediction
        const predictionData = insertPredictionSchema.parse({
          compoundId: compound.id,
          pic50,
          confidence,
          descriptors,
          safetyAssessment,
        });
        
        prediction = await storage.createPrediction(predictionData);
      }
      
      // Calculate Lipinski rules
      const lipinskiRules = MolecularCalculator.checkLipinskiRules(prediction.descriptors as any);
      
      res.json({
        compound,
        prediction,
        lipinskiRules,
      });
      
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze compound" });
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
        MolecularCalculator.checkLipinskiRules(prediction.descriptors as any) : null;
      
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
  
  // Batch processing endpoint
  app.post("/api/batch/process", async (req, res) => {
    try {
      const { compounds } = req.body;
      
      if (!Array.isArray(compounds) || compounds.length === 0) {
        return res.status(400).json({ message: "Compounds array is required" });
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
            
            if (!MolecularCalculator.validateSmiles(smiles)) {
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
              const descriptors = MolecularCalculator.calculateDescriptors(smiles);
              const { pic50, confidence } = MLPredictionService.predictPIC50(descriptors);
              const safetyAssessment = MLPredictionService.assessSafety(descriptors);
              
              prediction = await storage.createPrediction({
                compoundId: compound.id,
                pic50,
                confidence,
                descriptors,
                safetyAssessment,
              });
            }
            
            const lipinskiRules = MolecularCalculator.checkLipinskiRules(prediction.descriptors as any);
            
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
          'SMILES', 'Name', 'pIC50', 'Confidence', 'LogP', 'MW', 'TPSA', 
          'Rotatable Bonds', 'HBD', 'HBA', 'Safety Risk', 'Safety Score'
        ];
        
        const rows = data.map(item => [
          item!.compound.smiles,
          item!.compound.name || '',
          item!.prediction?.pic50 || '',
          item!.prediction?.confidence || '',
          (item!.prediction?.descriptors as any)?.logP || '',
          (item!.prediction?.descriptors as any)?.molecularWeight || '',
          (item!.prediction?.descriptors as any)?.tpsa || '',
          (item!.prediction?.descriptors as any)?.rotatableBonds || '',
          (item!.prediction?.descriptors as any)?.hbdCount || '',
          (item!.prediction?.descriptors as any)?.hbaCount || '',
          (item!.prediction?.safetyAssessment as any)?.overallRisk || '',
          (item!.prediction?.safetyAssessment as any)?.overallScore || '',
        ]);
        
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
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

  const httpServer = createServer(app);
  return httpServer;
}

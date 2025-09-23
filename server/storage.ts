import { type Compound, type InsertCompound, type Prediction, type InsertPrediction, type BatchJob, type InsertBatchJob } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Compounds
  getCompound(id: string): Promise<Compound | undefined>;
  getCompoundBySmiles(smiles: string): Promise<Compound | undefined>;
  createCompound(compound: InsertCompound): Promise<Compound>;
  getAllCompounds(): Promise<Compound[]>;
  
  // Predictions
  getPrediction(id: string): Promise<Prediction | undefined>;
  getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined>;
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;
  getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]>;
  
  // Batch Jobs
  getBatchJob(id: string): Promise<BatchJob | undefined>;
  createBatchJob(batchJob: InsertBatchJob): Promise<BatchJob>;
  updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined>;
  getAllBatchJobs(): Promise<BatchJob[]>;
}

export class MemStorage implements IStorage {
  private compounds: Map<string, Compound>;
  private predictions: Map<string, Prediction>;
  private batchJobs: Map<string, BatchJob>;

  constructor() {
    this.compounds = new Map();
    this.predictions = new Map();
    this.batchJobs = new Map();
  }

  // Compounds
  async getCompound(id: string): Promise<Compound | undefined> {
    return this.compounds.get(id);
  }

  async getCompoundBySmiles(smiles: string): Promise<Compound | undefined> {
    return Array.from(this.compounds.values()).find(
      (compound) => compound.smiles === smiles,
    );
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    const id = randomUUID();
    const compound: Compound = { 
      ...insertCompound, 
      id, 
      createdAt: new Date() 
    };
    this.compounds.set(id, compound);
    return compound;
  }

  async getAllCompounds(): Promise<Compound[]> {
    return Array.from(this.compounds.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  // Predictions
  async getPrediction(id: string): Promise<Prediction | undefined> {
    return this.predictions.get(id);
  }

  async getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined> {
    return Array.from(this.predictions.values()).find(
      (prediction) => prediction.compoundId === compoundId,
    );
  }

  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const id = randomUUID();
    const prediction: Prediction = { 
      ...insertPrediction, 
      id, 
      createdAt: new Date() 
    };
    this.predictions.set(id, prediction);
    return prediction;
  }

  async getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]> {
    return Array.from(this.predictions.values()).filter(
      (prediction) => compoundIds.includes(prediction.compoundId),
    );
  }

  // Batch Jobs
  async getBatchJob(id: string): Promise<BatchJob | undefined> {
    return this.batchJobs.get(id);
  }

  async createBatchJob(insertBatchJob: InsertBatchJob): Promise<BatchJob> {
    const id = randomUUID();
    const batchJob: BatchJob = { 
      ...insertBatchJob, 
      id, 
      createdAt: new Date(),
      completedAt: null
    };
    this.batchJobs.set(id, batchJob);
    return batchJob;
  }

  async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined> {
    const existing = this.batchJobs.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.batchJobs.set(id, updated);
    return updated;
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return Array.from(this.batchJobs.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }
}

export const storage = new MemStorage();

import { type Compound, type InsertCompound, type Prediction, type InsertPrediction, type BatchJob, type InsertBatchJob, compounds, predictions, batchJobs, savedPredictions } from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, inArray } from 'drizzle-orm';

export interface IStorage {
  // Compounds
  getCompound(id: string): Promise<Compound | undefined>;
  getCompoundBySmiles(smiles: string): Promise<Compound | undefined>;
  createCompound(compound: InsertCompound): Promise<Compound>;
  updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined>;
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

  // Saved analyses
  savePrediction(compoundId: string): Promise<void>;
  unsavePrediction(compoundId: string): Promise<void>;
  getSavedCompoundIds(): Promise<string[]>;
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
      name: insertCompound.name || null,
      id, 
      createdAt: new Date() 
    };
    this.compounds.set(id, compound);
    return compound;
  }

  async updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined> {
    const existing = this.compounds.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.compounds.set(id, updated);
    return updated;
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
      canonicalSmiles: insertPrediction.canonicalSmiles ?? null,
      inchiKey: insertPrediction.inchiKey ?? null,
      molecularFormula: insertPrediction.molecularFormula ?? null,
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
      processedCompounds: insertBatchJob.processedCompounds ?? 0,
      results: insertBatchJob.results ?? null,
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
  // Saved analyses
  private saved = new Set<string>();

  async savePrediction(compoundId: string): Promise<void> {
    this.saved.add(compoundId);
  }

  async unsavePrediction(compoundId: string): Promise<void> {
    this.saved.delete(compoundId);
  }

  async getSavedCompoundIds(): Promise<string[]> {
    return Array.from(this.saved);
  }

}

export class DbStorage implements IStorage {
  private db;
  
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for DbStorage");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }
  // Compounds
  async getCompound(id: string): Promise<Compound | undefined> {
    const result = await this.db.select().from(compounds).where(eq(compounds.id, id)).limit(1);
    return result[0];
  }

  async getCompoundBySmiles(smiles: string): Promise<Compound | undefined> {
    const result = await this.db.select().from(compounds).where(eq(compounds.smiles, smiles)).limit(1);
    return result[0];
  }

  async createCompound(insertCompound: InsertCompound): Promise<Compound> {
    const result = await this.db.insert(compounds).values(insertCompound).returning();
    return result[0];
  }

  async updateCompound(id: string, updates: Partial<Compound>): Promise<Compound | undefined> {
    const result = await this.db.update(compounds).set(updates).where(eq(compounds.id, id)).returning();
    return result[0];
  }

  async getAllCompounds(): Promise<Compound[]> {
    return await this.db.select().from(compounds).orderBy(desc(compounds.createdAt)).limit(100);
  }

  // Predictions
  async getPrediction(id: string): Promise<Prediction | undefined> {
    const result = await this.db.select().from(predictions).where(eq(predictions.id, id)).limit(1);
    return result[0];
  }

  async getPredictionByCompoundId(compoundId: string): Promise<Prediction | undefined> {
    const result = await this.db.select().from(predictions).where(eq(predictions.compoundId, compoundId)).limit(1);
    return result[0];
  }

  async createPrediction(insertPrediction: InsertPrediction): Promise<Prediction> {
    const result = await this.db.insert(predictions).values(insertPrediction).returning();
    return result[0];
  }

  async getPredictionsByCompoundIds(compoundIds: string[]): Promise<Prediction[]> {
    if (compoundIds.length === 0) return [];
    return await this.db.select().from(predictions).where(
      inArray(predictions.compoundId, compoundIds)
    );
  }

  // Batch Jobs
  async getBatchJob(id: string): Promise<BatchJob | undefined> {
    const result = await this.db.select().from(batchJobs).where(eq(batchJobs.id, id)).limit(1);
    return result[0];
  }

  async createBatchJob(insertBatchJob: InsertBatchJob): Promise<BatchJob> {
    const result = await this.db.insert(batchJobs).values(insertBatchJob).returning();
    return result[0];
  }

  async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<BatchJob | undefined> {
    const result = await this.db.update(batchJobs).set(updates).where(eq(batchJobs.id, id)).returning();
    return result[0];
  }

  async getAllBatchJobs(): Promise<BatchJob[]> {
    return await this.db.select().from(batchJobs).orderBy(desc(batchJobs.createdAt)).limit(50);
  }

  // Saved analyses
  async savePrediction(compoundId: string): Promise<void> {
    // onConflictDoNothing makes a repeated save idempotent rather than a 500.
    await this.db.insert(savedPredictions).values({ compoundId }).onConflictDoNothing();
  }

  async unsavePrediction(compoundId: string): Promise<void> {
    await this.db.delete(savedPredictions).where(eq(savedPredictions.compoundId, compoundId));
  }

  async getSavedCompoundIds(): Promise<string[]> {
    const rows = await this.db.select().from(savedPredictions).orderBy(desc(savedPredictions.savedAt));
    return rows.map((r) => r.compoundId);
  }
}

/**
 * Storage selection.
 *
 * DbStorage was fully implemented but never instantiated, so every compound,
 * analysis and saved result was lost on restart. It is now used automatically
 * whenever DATABASE_URL is configured.
 *
 * MemStorage remains the fallback so the app still runs with no database — but
 * it now says so loudly at boot, rather than silently discarding data.
 */
function createStorage(): IStorage {
  if (!process.env.DATABASE_URL) {
    console.warn(
      "⚠️  DATABASE_URL is not set — using in-memory storage. " +
      "All compounds, analyses and saved results will be lost when the server restarts. " +
      "Set DATABASE_URL and run `npm run db:push` to persist data.",
    );
    return new MemStorage();
  }

  try {
    const db = new DbStorage();
    console.log("✓ Using PostgreSQL storage");
    return db;
  } catch (error) {
    // A malformed DATABASE_URL should not take the whole app down, but it must
    // not silently look like a working database either.
    console.error(
      "✗ DATABASE_URL is set but the database could not be initialised; " +
      "falling back to in-memory storage. Data will NOT persist.",
      error instanceof Error ? error.message : error,
    );
    return new MemStorage();
  }
}

export const storage: IStorage = createStorage();

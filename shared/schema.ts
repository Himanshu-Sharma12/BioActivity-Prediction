import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const compounds = pgTable("compounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  smiles: text("smiles").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  compoundId: varchar("compound_id").references(() => compounds.id).notNull(),
  // pic50 and confidence were removed: a target-free IC50 is not a meaningful
  // quantity, and the stored "confidence" was a function of the prediction itself
  // rather than of any model uncertainty. Measured potency now comes from ChEMBL
  // per target, and is not persisted here because it is upstream reference data.
  canonicalSmiles: text("canonical_smiles"),
  inchiKey: text("inchi_key"),
  molecularFormula: text("molecular_formula"),
  descriptors: jsonb("descriptors").notNull(),
  safetyAssessment: jsonb("safety_assessment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved analyses. Previously an in-memory Set inside registerRoutes(), so every
// save was lost on restart and was shared across all users of the process.
export const savedPredictions = pgTable("saved_predictions", {
  compoundId: varchar("compound_id").primaryKey().references(() => compounds.id),
  savedAt: timestamp("saved_at").defaultNow(),
});

export const batchJobs = pgTable("batch_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull(), // 'pending', 'processing', 'completed', 'failed'
  totalCompounds: integer("total_compounds").notNull(),
  processedCompounds: integer("processed_compounds").default(0),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Insert schemas
export const insertCompoundSchema = createInsertSchema(compounds).pick({
  smiles: true,
  name: true,
});

export const insertPredictionSchema = createInsertSchema(predictions).pick({
  compoundId: true,
  canonicalSmiles: true,
  inchiKey: true,
  molecularFormula: true,
  descriptors: true,
  safetyAssessment: true,
});

export const insertBatchJobSchema = createInsertSchema(batchJobs).pick({
  status: true,
  totalCompounds: true,
  processedCompounds: true,
  results: true,
});

// Types
export type Compound = typeof compounds.$inferSelect;
export type InsertCompound = z.infer<typeof insertCompoundSchema>;
export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type BatchJob = typeof batchJobs.$inferSelect;
export type SavedPrediction = typeof savedPredictions.$inferSelect;
export type InsertBatchJob = z.infer<typeof insertBatchJobSchema>;

// Molecular descriptor schema
export const molecularDescriptorSchema = z.object({
  logP: z.number(),
  molecularWeight: z.number(),
  tpsa: z.number(),
  rotatableBonds: z.number(),
  hbdCount: z.number(),
  hbaCount: z.number(),
  atomCount: z.number(),
  ringCount: z.number(),
});

// Safety assessment schema
//
// The previous shape carried four toxicity endpoints, each with a `probability`
// and a risk tier, plus an `overallScore` on a 0-10 scale. Those numbers were
// produced by hand-invented coefficients with Math.random() added, so they were
// both unfounded and non-deterministic. They are replaced by substructure matches
// against published alert sets, which are deterministic and citable.

export const structuralAlertSchema = z.object({
  id: z.string(),
  name: z.string(),
  severity: z.enum(['low', 'moderate', 'high']),
  concern: z.string(),
  source: z.enum(['Brenk', 'PAINS']),
  matchedAtoms: z.array(z.number()),
});

export const ruleCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  value: z.number(),
  threshold: z.number(),
});

export const ruleSetSchema = z.object({
  rules: z.array(ruleCheckSchema),
  violations: z.number(),
  passed: z.boolean(),
  citation: z.string(),
});

export const safetyAssessmentSchema = z.object({
  concernLevel: z.enum(['none', 'low', 'moderate', 'high']),
  summary: z.string(),
  structuralAlerts: z.array(structuralAlertSchema),
  alertCounts: z.object({
    high: z.number(),
    moderate: z.number(),
    low: z.number(),
    total: z.number(),
  }),
  drugLikeness: z.object({
    lipinski: ruleSetSchema,
    veber: ruleSetSchema,
  }),
  coverage: z.object({
    brenk: z.string(),
    pains: z.string(),
    note: z.string(),
  }),
  disclaimer: z.string(),
});

export type StructuralAlert = z.infer<typeof structuralAlertSchema>;
export type RuleCheck = z.infer<typeof ruleCheckSchema>;
export type RuleSet = z.infer<typeof ruleSetSchema>;

export type MolecularDescriptors = z.infer<typeof molecularDescriptorSchema>;
export type SafetyAssessment = z.infer<typeof safetyAssessmentSchema>;

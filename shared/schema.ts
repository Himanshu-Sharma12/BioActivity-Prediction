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
  pic50: real("pic50").notNull(),
  confidence: real("confidence").notNull(),
  descriptors: jsonb("descriptors").notNull(),
  safetyAssessment: jsonb("safety_assessment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
  pic50: true,
  confidence: true,
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
export const safetyAssessmentSchema = z.object({
  overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  overallScore: z.number().min(0).max(10),
  hepatotoxicity: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    probability: z.number().min(0).max(1),
  }),
  cardiotoxicity: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    probability: z.number().min(0).max(1),
  }),
  mutagenicity: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    probability: z.number().min(0).max(1),
  }),
  hergInhibition: z.object({
    risk: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    probability: z.number().min(0).max(1),
  }),
});

export type MolecularDescriptors = z.infer<typeof molecularDescriptorSchema>;
export type SafetyAssessment = z.infer<typeof safetyAssessmentSchema>;

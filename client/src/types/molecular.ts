// Import MolecularDescriptors from shared schema instead of duplicating
export type { MolecularDescriptors } from "@shared/schema";

// Import SafetyAssessment from shared schema instead of duplicating
export type { SafetyAssessment } from "@shared/schema";

export interface Compound {
  id: string;
  smiles: string;
  name?: string;
  createdAt: Date;
}

export interface Prediction {
  id: string;
  compoundId: string;
  pic50: number;
  confidence: number;
  descriptors: MolecularDescriptors;
  safetyAssessment: SafetyAssessment;
  createdAt: Date;
}

export interface LipinskiRules {
  passed: number;
  total: number;
  rules: Array<{
    name: string;
    value: number;
    limit: number;
    operator: string;
    passed: boolean;
  }>;
}

export interface AnalysisResult {
  compound: Compound;
  prediction: Prediction;
  lipinskiRules: LipinskiRules;
}

export interface BatchJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalCompounds: number;
  processedCompounds: number;
  results?: any[];
  createdAt: Date;
  completedAt?: Date;
}

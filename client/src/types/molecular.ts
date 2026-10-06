import type { MolecularDescriptors, SafetyAssessment } from "@shared/schema";

export type {
  MolecularDescriptors,
  SafetyAssessment,
  StructuralAlert,
  RuleCheck,
  RuleSet,
} from "@shared/schema";

export interface Compound {
  id: string;
  smiles: string;
  name?: string;
  createdAt: Date;
}

export interface Prediction {
  id: string;
  compoundId: string;
  canonicalSmiles: string | null;
  inchiKey: string | null;
  molecularFormula: string | null;
  descriptors: MolecularDescriptors;
  safetyAssessment: SafetyAssessment;
  createdAt: Date;
}

export interface StructureImages {
  image2d?: string | null;
  image3d?: string | null;
}

export interface StructureCoordinates {
  atoms: Array<{ element: string; x: number; y: number; z: number }>;
  bonds: Array<{ from: number; to: number; order: number }>;
}

export interface CompoundStructure {
  source: 'pubchem' | 'gemini';
  smiles: string;
  cid?: number;
  fetchedAt: string;
  images: StructureImages;
  coordinates3d?: StructureCoordinates | null;
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

/** A single measured activity record from ChEMBL. Not a prediction. */
export interface MeasuredActivity {
  targetChemblId: string;
  targetName: string;
  organism: string | null;
  standardType: string;
  standardValue: number | null;
  standardUnits: string | null;
  pchemblValue: number | null;
  assayDescription?: string | null;
  activityDescription?: string | null;
  documentYear: number | null;
  documentJournal: string | null;
}

export interface ChemblRecord {
  chemblId: string;
  prefName: string | null;
  maxPhase?: number | null;
  firstApproval: number | null;
  activities: MeasuredActivity[];
  noActivityData?: boolean;
  source?: 'chembl' | 'ai-predicted' | 'physiological-target';
  summary?: string;
}

export interface DiseaseIndication {
  disease: string;
  category: string;
  relevance: 'primary' | 'secondary' | 'investigational';
  confidenceScore: number;
  mechanismRationale: string;
}

export interface PotentialMedicine {
  medicineName: string;
  drugClass: string;
  dosageForm: string;
  proposedRoute: string;
  targetIndication: string;
  developmentStage: 'Lead Compound' | 'Preclinical Candidate' | 'Clinical Stage' | 'Approved Equivalent';
  formulationNotes: string;
}

export interface TherapeuticPrediction {
  targetDiseases: DiseaseIndication[];
  mechanismOfAction: {
    summary: string;
    primaryTargets: string[];
    biologicalPathways: string[];
  };
  potentialMedicines: PotentialMedicine[];
  therapeuticIndex: {
    window: 'wide' | 'moderate' | 'narrow';
    assessment: string;
  };
  synthesisAndDerivatives: {
    chemicalClass: string;
    suggestedModifications: string[];
  };
  source: 'ai-predicted' | 'literature-derived';
  rationale: string;
}

export interface CombinatorialCondition {
  physiologicalContext: string;
  patientBiomarkers: string;
  clinicalPrerequisites: string;
  administrationTiming: string;
  contraindicatedConditions: string[];
}

export interface CombinatorialMedicineFormulation {
  medicineName: string;
  formulationType: string;
  doseRatio: string;
  deliveryRoute: string;
  excipientsAndTech: string;
  stabilityAndStorage: string;
}

export interface CombinatorialPartner {
  partnerName: string;
  partnerSmiles?: string;
  partnerRole: string;
  synergyIndex: number;
  synergyAssessment: string;
  targetDiseases: Array<{
    disease: string;
    category: string;
    synergyMechanism: string;
    efficacyBoostPct: number;
  }>;
  requiredConditions: CombinatorialCondition;
  medicineFormulation: CombinatorialMedicineFormulation;
}

export interface CombinatorialAnalysisResult {
  primaryCompoundName: string;
  primarySmiles: string;
  autonomousCombinations: CombinatorialPartner[];
  combinationRationale: string;
  source: 'ai-predicted' | 'heuristic-derived';
}

export interface UnknownCompoundProfile {
  identifiedClass: string;
  canonicalSmiles: string;
  iupacName: string;
  molecularFormula: string;
  molecularWeight: number;
  syntheticFeasibilityScore: number;
  syntheticPrecursors: string[];
  putativeBiologicalTargets: Array<{
    target: string;
    confidence: number;
    actionType: string;
  }>;
  safetyWarnings: string[];
  noveltyAssessment: string;
}

export interface AnalysisResult {
  compound: Compound;
  prediction: Prediction;
  lipinskiRules: LipinskiRules;
  structure?: CompoundStructure | null;
  medicineInsights?: MedicineInsights;
  therapeuticPrediction?: TherapeuticPrediction | null;
  combinatorialProfile?: CombinatorialAnalysisResult | null;
  unknownCompoundProfile?: UnknownCompoundProfile | null;
  /** Measured bioactivity from ChEMBL; null when the compound has no record. */
  measuredActivity?: ChemblRecord | null;
  attribution?: string | null;
  disclaimer?: string;
  isAiDeduction?: boolean;
  aiDeductionRationale?: string;
}

// Image analysis (medicine photo) types
export interface CompoundCandidate {
  name: string;
  smiles?: string;
  /** Gemini's confidence in identifying this compound from the image.
      Unrelated to the removed ML prediction "confidence". */
  confidence: number;
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
  score: number;
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
  rxNorm?: { rxcui?: string; name?: string };
  openFDALabel?: { brand?: string; warnings?: string[] };
}

export interface ImageAnalysisResult {
  medicineInsights: MedicineInsights;
  compound?: Compound;
  prediction?: Prediction;
  lipinskiRules?: LipinskiRules;
  structure?: CompoundStructure | null;
}

export type ConfidenceAssessment = "certain" | "partially certain" | "ambiguous";

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

export interface MedicineNameUsageGuidelines {
  typicalDosage: string;
  timing: string;
  route: string;
  ageRestrictions?: string;
  overdoseRisks: string;
}

export interface MedicineNameSafetyInformation {
  prescriptionRequired: boolean;
  sideEffects: string[];
  contraindications: string[];
  pregnancyWarnings: string;
  liverWarnings: string;
  kidneyWarnings: string;
  interactions: string[];
}

export interface MedicineNameAnalysisResult {
  medicine: MedicineNameIdentification;
  activeIngredients: MedicineActiveIngredient[];
  chemicalComposition: MedicineChemicalComponent[];
  indications: string[];
  usageGuidelines: MedicineNameUsageGuidelines;
  safetyInformation: MedicineNameSafetyInformation;
  imageBase64?: string | null;
  confidence: {
    score: number;
    level: ConfidenceAssessment;
    rationale: string;
  };
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

import { MolecularDescriptors, SafetyAssessment } from "@shared/schema";

export class MLPredictionService {
  
  static predictPIC50(descriptors: MolecularDescriptors): { pic50: number; confidence: number } {
    // Mock ML model for pIC50 prediction
    // In production, use TensorFlow.js or load pre-trained models
    
    // Simple linear model based on descriptors
    const { logP, molecularWeight, tpsa, rotatableBonds, hbdCount, hbaCount } = descriptors;
    
    // Mock coefficients for a simple linear model
    const baseIC50 = 6.0;
    const logPCoeff = 0.3;
    const mwCoeff = -0.001;
    const tpsaCoeff = -0.02;
    const rotBondsCoeff = -0.1;
    const hbdCoeff = 0.2;
    const hbaCoeff = -0.05;
    
    const pic50 = baseIC50 + 
                  (logPCoeff * logP) +
                  (mwCoeff * molecularWeight) +
                  (tpsaCoeff * tpsa) +
                  (rotBondsCoeff * rotatableBonds) +
                  (hbdCoeff * hbdCount) +
                  (hbaCoeff * hbaCount) +
                  (Math.random() - 0.5) * 0.5; // Add some noise
    
    // Clamp to reasonable range
    const clampedPIC50 = Math.max(4.0, Math.min(9.0, pic50));
    
    // Mock confidence based on descriptor similarity to training set
    const confidence = Math.max(0.6, Math.min(0.95, 0.85 - Math.abs(pic50 - 6.0) * 0.1));
    
    return {
      pic50: Math.round(clampedPIC50 * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }
  
  static assessSafety(descriptors: MolecularDescriptors): SafetyAssessment {
    // Mock safety assessment models
    const { logP, molecularWeight, tpsa, rotatableBonds } = descriptors;
    
    // Hepatotoxicity risk (higher MW and LogP increase risk)
    const hepatoRisk = (molecularWeight > 400 ? 0.3 : 0.1) + (logP > 3 ? 0.2 : 0.05);
    const hepatotoxicity = {
      probability: Math.min(0.9, hepatoRisk + Math.random() * 0.2),
      risk: hepatoRisk > 0.4 ? 'HIGH' as const : hepatoRisk > 0.2 ? 'MEDIUM' as const : 'LOW' as const,
    };
    
    // Cardiotoxicity risk (related to LogP and TPSA)
    const cardioRisk = (logP > 4 ? 0.4 : 0.2) + (tpsa < 60 ? 0.2 : 0.1);
    const cardiotoxicity = {
      probability: Math.min(0.9, cardioRisk + Math.random() * 0.2),
      risk: cardioRisk > 0.5 ? 'HIGH' as const : cardioRisk > 0.3 ? 'MEDIUM' as const : 'LOW' as const,
    };
    
    // Mutagenicity risk (simplified)
    const mutagenRisk = rotatableBonds > 8 ? 0.3 : 0.1;
    const mutagenicity = {
      probability: Math.min(0.9, mutagenRisk + Math.random() * 0.15),
      risk: mutagenRisk > 0.25 ? 'HIGH' as const : mutagenRisk > 0.15 ? 'MEDIUM' as const : 'LOW' as const,
    };
    
    // hERG inhibition risk (related to LogP and MW)
    const hergRisk = (logP > 3 ? 0.3 : 0.15) + (molecularWeight > 350 ? 0.2 : 0.1);
    const hergInhibition = {
      probability: Math.min(0.9, hergRisk + Math.random() * 0.2),
      risk: hergRisk > 0.4 ? 'HIGH' as const : hergRisk > 0.25 ? 'MEDIUM' as const : 'LOW' as const,
    };
    
    // Overall risk assessment
    const riskScores = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
    };
    
    const avgRisk = (
      riskScores[hepatotoxicity.risk] +
      riskScores[cardiotoxicity.risk] +
      riskScores[mutagenicity.risk] +
      riskScores[hergInhibition.risk]
    ) / 4;
    
    const overallRisk = avgRisk > 2.5 ? 'HIGH' as const : avgRisk > 1.5 ? 'MEDIUM' as const : 'LOW' as const;
    const overallScore = Math.round((4 - avgRisk) * 2.5 * 100) / 100; // Convert to 0-10 scale
    
    return {
      overallRisk,
      overallScore,
      hepatotoxicity,
      cardiotoxicity,
      mutagenicity,
      hergInhibition,
    };
  }
}

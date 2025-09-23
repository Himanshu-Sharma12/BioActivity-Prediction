import { MolecularDescriptors } from "@shared/schema";

// Simple molecular descriptor calculator (in a real app, you'd use RDKit-JS)
export class MolecularCalculator {
  
  static calculateDescriptors(smiles: string): MolecularDescriptors {
    // Mock calculations based on simple SMILES analysis
    // In production, use RDKit-JS for accurate calculations
    
    const atomCount = this.countAtoms(smiles);
    const carbonCount = (smiles.match(/C/g) || []).length;
    const oxygenCount = (smiles.match(/O/g) || []).length;
    const nitrogenCount = (smiles.match(/N/g) || []).length;
    const sulfurCount = (smiles.match(/S/g) || []).length;
    
    // Approximate molecular weight calculation
    const molecularWeight = carbonCount * 12.01 + 
                           oxygenCount * 16.00 + 
                           nitrogenCount * 14.01 + 
                           sulfurCount * 32.07 + 
                           this.countHydrogens(smiles) * 1.008;
    
    // Simple LogP estimation (very basic)
    const logP = (carbonCount * 0.5) - (oxygenCount * 1.2) - (nitrogenCount * 0.7);
    
    // TPSA approximation
    const tpsa = oxygenCount * 20.23 + nitrogenCount * 23.79;
    
    // Count rotatable bonds (very simplified)
    const rotatableBonds = Math.max(0, this.countSingleBonds(smiles) - this.countRings(smiles));
    
    // H-bond donors (simplified: OH, NH)
    const hbdCount = (smiles.match(/OH|NH/g) || []).length;
    
    // H-bond acceptors (simplified: O, N not in NH)
    const hbaCount = oxygenCount + Math.max(0, nitrogenCount - hbdCount);
    
    const ringCount = this.countRings(smiles);
    
    return {
      logP: Math.round(logP * 100) / 100,
      molecularWeight: Math.round(molecularWeight * 100) / 100,
      tpsa: Math.round(tpsa * 100) / 100,
      rotatableBonds,
      hbdCount,
      hbaCount,
      atomCount,
      ringCount,
    };
  }
  
  private static countAtoms(smiles: string): number {
    // Count non-H atoms
    return (smiles.match(/[CNOS]/g) || []).length;
  }
  
  private static countHydrogens(smiles: string): number {
    // Very simplified H count estimation
    const heavyAtoms = this.countAtoms(smiles);
    return Math.max(0, heavyAtoms * 2); // Rough estimate
  }
  
  private static countSingleBonds(smiles: string): number {
    // Count single bonds (simplified)
    return Math.max(0, this.countAtoms(smiles) - 1);
  }
  
  private static countRings(smiles: string): number {
    // Count ring closures in SMILES
    return (smiles.match(/\d/g) || []).length / 2;
  }
  
  static validateSmiles(smiles: string): boolean {
    // Basic SMILES validation
    if (!smiles || smiles.length === 0) return false;
    
    // Check for valid characters
    const validChars = /^[A-Za-z0-9\[\]()=#+\-\\\/\.@:]*$/;
    if (!validChars.test(smiles)) return false;
    
    // Check for balanced parentheses
    let parenCount = 0;
    let bracketCount = 0;
    
    for (const char of smiles) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
      
      if (parenCount < 0 || bracketCount < 0) return false;
    }
    
    return parenCount === 0 && bracketCount === 0;
  }
  
  static checkLipinskiRules(descriptors: MolecularDescriptors): {
    passed: number;
    total: number;
    rules: Array<{
      name: string;
      value: number;
      limit: number;
      operator: string;
      passed: boolean;
    }>;
  } {
    const rules = [
      {
        name: "MW ≤ 500 Da",
        value: descriptors.molecularWeight,
        limit: 500,
        operator: "≤",
        passed: descriptors.molecularWeight <= 500,
      },
      {
        name: "LogP ≤ 5",
        value: descriptors.logP,
        limit: 5,
        operator: "≤",
        passed: descriptors.logP <= 5,
      },
      {
        name: "HBD ≤ 5",
        value: descriptors.hbdCount,
        limit: 5,
        operator: "≤",
        passed: descriptors.hbdCount <= 5,
      },
      {
        name: "HBA ≤ 10",
        value: descriptors.hbaCount,
        limit: 10,
        operator: "≤",
        passed: descriptors.hbaCount <= 10,
      },
    ];
    
    const passed = rules.filter(rule => rule.passed).length;
    
    return {
      passed,
      total: rules.length,
      rules,
    };
  }
}

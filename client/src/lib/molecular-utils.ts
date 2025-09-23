export function formatMolecularWeight(mw: number): string {
  return `${mw.toFixed(2)} g/mol`;
}

export function formatLogP(logP: number): string {
  return logP.toFixed(2);
}

export function formatTPSA(tpsa: number): string {
  return `${tpsa.toFixed(2)} Ų`;
}

export function formatPIC50(pic50: number): string {
  return pic50.toFixed(2);
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function formatProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function getRiskColor(risk: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (risk) {
    case 'LOW':
      return 'text-success';
    case 'MEDIUM':
      return 'text-warning';
    case 'HIGH':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
}

export function getRiskBgColor(risk: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (risk) {
    case 'LOW':
      return 'bg-success';
    case 'MEDIUM':
      return 'bg-warning';
    case 'HIGH':
      return 'bg-destructive';
    default:
      return 'bg-muted';
  }
}

export function getOverallRiskDisplay(risk: 'LOW' | 'MEDIUM' | 'HIGH'): { 
  text: string; 
  color: string; 
  bgColor: string; 
  icon: string; 
} {
  switch (risk) {
    case 'LOW':
      return {
        text: 'LOW RISK',
        color: 'text-success',
        bgColor: 'bg-success/10 border-success/20',
        icon: 'fas fa-check-circle',
      };
    case 'MEDIUM':
      return {
        text: 'MEDIUM RISK',
        color: 'text-warning',
        bgColor: 'bg-warning/10 border-warning/20',
        icon: 'fas fa-exclamation-triangle',
      };
    case 'HIGH':
      return {
        text: 'HIGH RISK',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10 border-destructive/20',
        icon: 'fas fa-times-circle',
      };
    default:
      return {
        text: 'UNKNOWN',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/10 border-muted/20',
        icon: 'fas fa-question-circle',
      };
  }
}

export function validateSMILES(smiles: string): boolean {
  if (!smiles || smiles.length === 0) return false;
  
  // Basic SMILES validation
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

export function generateMolecularStructureDisplay(smiles: string): string {
  // Simple mapping for common SMILES to display structures
  const commonStructures: Record<string, string> = {
    'CCO': 'H₃C—CH₂—OH',
    'CC': 'H₃C—CH₃',
    'C': 'CH₄',
    'O': 'H₂O',
    'CO': 'H₃C—OH',
    'CCC': 'H₃C—CH₂—CH₃',
    'C1=CC=CC=C1': 'Benzene Ring',
    'CC(=O)O': 'H₃C—COOH',
    'CCN': 'H₃C—CH₂—NH₂',
  };
  
  return commonStructures[smiles] || `Structure: ${smiles}`;
}

export function getMolecularName(smiles: string): string {
  const commonNames: Record<string, string> = {
    'CCO': 'Ethanol',
    'CC': 'Ethane',
    'C': 'Methane',
    'O': 'Water',
    'CO': 'Methanol',
    'CCC': 'Propane',
    'C1=CC=CC=C1': 'Benzene',
    'CC(=O)O': 'Acetic Acid',
    'CCN': 'Ethylamine',
  };
  
  return commonNames[smiles] || 'Unknown Compound';
}

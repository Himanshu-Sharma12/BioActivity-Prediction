export function formatMolecularWeight(mw: number): string {
  return `${mw.toFixed(2)} g/mol`;
}

export function formatLogP(logP: number): string {
  return logP.toFixed(2);
}

export function formatTPSA(tpsa: number): string {
  return `${tpsa.toFixed(2)} Å²`;
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

/**
 * Display-name fallback for when a compound has no resolved name.
 *
 * This previously derived a molecular formula by regex-counting letters in the
 * SMILES string, which counted the C in "Cl" as a carbon, missed lowercase
 * aromatic atoms, and estimated hydrogens from the literal "H" characters — so
 * chloroform rendered as "C4Cl". The real formula is computed server-side by
 * RDKit and is available as `prediction.molecularFormula`; use that where a
 * formula is actually wanted, rather than guessing one here.
 */
export function getMolecularName(smiles: string): string {
  const commonNames: Record<string, string> = {
    'C': 'Methane',
    'CC': 'Ethane',
    'CCC': 'Propane',
    'CCCC': 'Butane',
    'O': 'Water',
    'CO': 'Methanol',
    'CCO': 'Ethanol',
    'CCN': 'Ethylamine',
    'CC(=O)O': 'Acetic Acid',
    'C1=CC=CC=C1': 'Benzene',
    'c1ccccc1': 'Benzene',
    'CN1C=NC2=C1C(=O)N(C(=O)N2C)C': 'Caffeine',
    'CN1C=NC2=C1C(=O)N(C)C(=O)N2C': 'Caffeine',
    'CC(C)Cc1ccc(cc1)C(C)C(=O)O': 'Ibuprofen',
    'CC(=O)OC1=CC=CC=C1C(=O)O': 'Aspirin',
    'CC(=O)Oc1ccccc1C(=O)O': 'Aspirin',
  };

  return commonNames[smiles.trim()] ?? 'Unnamed compound';
}

import { Buffer } from "node:buffer";

/**
 * PubChem API Integration Service
 * Provides compound name to SMILES conversion using the PubChem REST API
 */

interface PubChemCompoundData {
  smiles: string;
  name: string;
  molecularFormula?: string;
  molecularWeight?: number;
  iupacName?: string;
  cid?: number;
}

export interface PubChem3DCoordinates {
  atoms: Array<{ element: string; x: number; y: number; z: number }>;
  bonds: Array<{ from: number; to: number; order: number }>;
}

export interface PubChemStructureSummary {
  source: 'pubchem';
  smiles: string;
  cid?: number;
  fetchedAt: string;
  images: {
    image2d?: string | null;
    image3d?: string | null;
  };
  coordinates3d?: PubChem3DCoordinates | null;
}

export class PubChemService {
  private static readonly BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

  /**
   * Check if a string is likely a SMILES notation
   * SMILES typically contains specific characters and patterns
   */
  static isSmilesNotation(input: string): boolean {
    // Remove whitespace
    const trimmed = input.trim();
    
    // If contains spaces, likely not SMILES
    if (trimmed.includes(' ')) {
      return false;
    }
    
    // If it's a common word (all lowercase or capitalized), likely a compound name
    const lowerInput = trimmed.toLowerCase();
    const commonCompoundWords = [
      'aspirin', 'caffeine', 'ibuprofen', 'paracetamol', 'acetaminophen',
      'ethanol', 'methanol', 'benzene', 'toluene', 'glucose', 'fructose',
      'water', 'ammonia', 'acetone', 'ester', 'ketone', 'alcohol', 'acid',
      'phenol', 'aniline', 'morphine', 'codeine', 'penicillin', 'insulin',
      'dopamine', 'serotonin', 'adrenaline', 'testosterone', 'estrogen'
    ];
    
    if (commonCompoundWords.includes(lowerInput)) {
      return false;
    }
    
    // If it's all letters and looks like a word (no numbers, no special chars), likely a name
    if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length > 3) {
      // Check if it contains common SMILES patterns
      const hasCommonSmilesPatterns = /[0-9\[\]()=#@]/.test(trimmed);
      if (!hasCommonSmilesPatterns) {
        return false; // Likely a compound name
      }
    }
    
    // SMILES characteristics:
    // - Contains element symbols (C, N, O, S, P, F, Cl, Br, I, etc.)
    // - Contains bonds (-, =, #, :)
    // - Contains structural notation ([, ], (, ), @)
    // - Contains ring numbers (1-9)
    
    // Check for SMILES-specific patterns
    const smilesPattern = /^[A-Za-z0-9@+\-\[\]()=#:\/\\.*]+$/;
    if (!smilesPattern.test(trimmed)) {
      return false;
    }
    
    // Check for element symbols commonly found in SMILES
    const hasElements = /[CNOSPFBrcli]/.test(trimmed);
    
    // Check for structural notation (strong indicator of SMILES)
    const hasStructure = /[\[\]()=#@]/.test(trimmed);
    
    // If it has structural notation, definitely SMILES
    if (hasStructure) {
      return true;
    }
    
    // Check for ring notation (numbers - strong indicator)
    const hasRings = /\d/.test(trimmed);
    
    // Must have rings or be very short with element symbols
    if (hasRings && hasElements) {
      return true;
    }
    
    // Very short strings with element symbols (like CCO, CO2)
    if (trimmed.length <= 5 && hasElements && /^[CNOSPF][A-Za-z0-9]*$/.test(trimmed)) {
      return true;
    }
    
    // Default: treat as compound name
    return false;
  }

  /**
   * Get compound data from PubChem by name
   * @param compoundName - The common name of the compound
   * @returns Compound data including SMILES notation
   */
  static async getCompoundByName(compoundName: string): Promise<PubChemCompoundData> {
    try {
      const encodedName = encodeURIComponent(compoundName.trim());
      
      // First, get the compound CID (compound identifier)
      const cidUrl = `${this.BASE_URL}/compound/name/${encodedName}/cids/JSON`;
      const cidResponse = await fetch(cidUrl);
      
      if (!cidResponse.ok) {
        throw new Error(`PubChem API error: Compound "${compoundName}" not found`);
      }
      
      const cidData = await cidResponse.json();
      const cid = cidData.IdentifierList?.CID?.[0];
      
      if (!cid) {
        throw new Error(`No CID found for compound "${compoundName}"`);
      }
      
      // Get compound properties including SMILES
      const propsUrl = `${this.BASE_URL}/compound/cid/${cid}/property/CanonicalSMILES,IsomericSMILES,SMILES,ConnectivitySMILES,Title,MolecularFormula,MolecularWeight,IUPACName/JSON`;
      const propsResponse = await fetch(propsUrl);
      
      if (!propsResponse.ok) {
        throw new Error(`Failed to fetch properties for compound "${compoundName}"`);
      }
      
      const propsData = await propsResponse.json();
      const properties = propsData.PropertyTable?.Properties?.[0];
      
      const resolvedSmiles = properties?.CanonicalSMILES
        || properties?.IsomericSMILES
        || properties?.SMILES
        || properties?.ConnectivitySMILES;

      if (!resolvedSmiles) {
        throw new Error(`No SMILES notation found for compound "${compoundName}"`);
      }

      const resolvedName = properties?.Title
        || properties?.IUPACName
        || compoundName;

      return {
        smiles: resolvedSmiles,
        name: resolvedName,
        molecularFormula: properties.MolecularFormula,
        molecularWeight: properties.MolecularWeight,
        iupacName: properties.IUPACName,
        cid,
      };
      
    } catch (error) {
      console.error('PubChem API error:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : `Failed to fetch compound data for "${compoundName}"`
      );
    }
  }

  /**
   * Resolve input to SMILES notation
   * Automatically detects if input is SMILES or compound name
   * @param input - Either SMILES notation or compound name
   * @returns Object containing SMILES and compound name
   */
  static async resolveToSmiles(input: string): Promise<{ smiles: string; name: string }> {
    const trimmed = input.trim();
    
    if (!trimmed) {
      throw new Error('Input cannot be empty');
    }
    
    // Check if input is already SMILES
    if (this.isSmilesNotation(trimmed)) {
      return {
        smiles: trimmed,
        name: '', // Will be generated later if needed
      };
    }
    
    // Input is likely a compound name, fetch SMILES from PubChem
    const data = await this.getCompoundByName(trimmed);
    return {
      smiles: data.smiles,
      name: data.name,
    };
  }

  /**
   * Retrieve PubChem generated imagery and 3D coordinates for the supplied SMILES
   */
  static async getCompoundStructure(smiles: string): Promise<PubChemStructureSummary> {
    const normalized = smiles.trim();
    const encoded = encodeURIComponent(normalized);

    const [recordResult, image2dResult, image3dResult] = await Promise.allSettled([
      this.fetch3DRecord(encoded),
      this.fetchStructureImage(encoded),
      this.fetchStructureImage(encoded, '3d'),
    ]);

    const summary: PubChemStructureSummary = {
      source: 'pubchem',
      smiles: normalized,
      fetchedAt: new Date().toISOString(),
      images: {},
      coordinates3d: null,
    };

    if (recordResult.status === 'fulfilled' && recordResult.value) {
      const compoundRecord = recordResult.value?.PC_Compounds?.[0];
      if (compoundRecord) {
        summary.cid = compoundRecord.id?.id?.cid;
        summary.coordinates3d = this.parse3DCoordinates(compoundRecord);
      }
    } else if (recordResult.status === 'rejected') {
      console.warn('PubChem 3D record fetch failed:', recordResult.reason);
    }

    if (image2dResult.status === 'fulfilled' && image2dResult.value) {
      summary.images.image2d = image2dResult.value;
    }

    if (image3dResult.status === 'fulfilled' && image3dResult.value) {
      summary.images.image3d = image3dResult.value;
    }

    return summary;
  }

  private static async fetch3DRecord(encodedSmiles: string): Promise<any> {
    const url = `${this.BASE_URL}/compound/smiles/${encodedSmiles}/record/JSON?record_type=3d`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch 3D record: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private static async fetchStructureImage(encodedSmiles: string, recordType: '2d' | '3d' = '2d'): Promise<string> {
    const params = new URLSearchParams({ image_size: 'large' });
    if (recordType === '3d') {
      params.set('record_type', '3d');
    }

    const url = `${this.BASE_URL}/compound/smiles/${encodedSmiles}/PNG?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${recordType} image: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  private static parse3DCoordinates(compoundRecord: any): PubChem3DCoordinates | null {
    const atomIds: number[] | undefined = compoundRecord?.atoms?.aid;
    const atomicNumbers: number[] | undefined = compoundRecord?.atoms?.element;
    const coordEntries: any[] = Array.isArray(compoundRecord?.coords) ? compoundRecord.coords : [];

    if (!atomIds || !atomicNumbers || !coordEntries.length) {
      return null;
    }

    const coordinateSet = coordEntries.find((entry) => Array.isArray(entry?.conformers) && entry.conformers[0]?.x && entry.conformers[0]?.y && entry.conformers[0]?.z);
    if (!coordinateSet) {
      return null;
    }

    const conformer = coordinateSet.conformers[0];
    const xCoords: number[] = conformer.x || [];
    const yCoords: number[] = conformer.y || [];
    const zCoords: number[] = conformer.z || [];

    if (xCoords.length !== atomIds.length || yCoords.length !== atomIds.length || zCoords.length !== atomIds.length) {
      return null;
    }

    const idToIndex = new Map<number, number>();
    atomIds.forEach((aid, index) => idToIndex.set(aid, index));

    const atoms = atomIds.map((aid, index) => ({
      element: this.atomicNumberToSymbol(atomicNumbers[index]),
      x: xCoords[index],
      y: yCoords[index],
      z: zCoords[index],
    }));

    const bondAid1: number[] = compoundRecord?.bonds?.aid1 || [];
    const bondAid2: number[] = compoundRecord?.bonds?.aid2 || [];
    const bondOrder: number[] = compoundRecord?.bonds?.order || [];

    const bonds = bondAid1.map((fromAid, idx) => {
      const toAid = bondAid2[idx];
      const fromIndex = idToIndex.get(fromAid);
      const toIndex = idToIndex.get(toAid);

      if (fromIndex === undefined || toIndex === undefined) {
        return null;
      }

      return {
        from: fromIndex,
        to: toIndex,
        order: bondOrder[idx] ?? 1,
      };
    }).filter((bond): bond is { from: number; to: number; order: number } => bond !== null);

    // If binary salt or disconnected species has no bonds (e.g. NaCl, KCl), connect for ball-and-stick modeling
    if (atoms.length === 2 && bonds.length === 0) {
      bonds.push({ from: 0, to: 1, order: 1 });
    } else if (atoms.length === 3 && bonds.length === 0) {
      bonds.push({ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 });
    } else if (atoms.length <= 6) {
      const connectedAtoms = new Set<number>();
      bonds.forEach((b) => {
        connectedAtoms.add(b.from);
        connectedAtoms.add(b.to);
      });

      for (let i = 0; i < atoms.length; i++) {
        if (!connectedAtoms.has(i)) {
          let nearestIdx = -1;
          let minDist = Infinity;
          for (let j = 0; j < atoms.length; j++) {
            if (i === j) continue;
            const dx = atoms[i].x - atoms[j].x;
            const dy = atoms[i].y - atoms[j].y;
            const dz = atoms[i].z - atoms[j].z;
            const dist = dx * dx + dy * dy + dz * dz;
            if (dist < minDist) {
              minDist = dist;
              nearestIdx = j;
            }
          }
          if (nearestIdx >= 0) {
            bonds.push({ from: Math.min(i, nearestIdx), to: Math.max(i, nearestIdx), order: 1 });
            connectedAtoms.add(i);
            connectedAtoms.add(nearestIdx);
          }
        }
      }
    }

    return { atoms, bonds };
  }

  private static atomicNumberToSymbol(atomicNumber: number): string {
    const map: Record<number, string> = {
      1: 'H',
      3: 'Li',
      4: 'Be',
      5: 'B',
      6: 'C',
      7: 'N',
      8: 'O',
      9: 'F',
      10: 'Ne',
      11: 'Na',
      12: 'Mg',
      13: 'Al',
      14: 'Si',
      15: 'P',
      16: 'S',
      17: 'Cl',
      18: 'Ar',
      19: 'K',
      20: 'Ca',
      26: 'Fe',
      29: 'Cu',
      30: 'Zn',
      33: 'As',
      34: 'Se',
      35: 'Br',
      53: 'I',
    };

    return map[atomicNumber] || `E${atomicNumber}`;
  }
}

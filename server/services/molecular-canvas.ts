import { getRDKit } from "./rdkit";
import type { MolecularDescriptors } from "@shared/schema";

export interface CanvasAtom {
  id: number;
  x: number;
  y: number;
  element: string;
}

export interface CanvasBond {
  from: number;
  to: number;
  order: number; // 1 = single, 2 = double, 3 = triple
}

export interface MolecularGraph {
  valid: boolean;
  atoms: CanvasAtom[];
  bonds: CanvasBond[];
  smiles: string;
  canonicalSmiles: string;
  molecularFormula?: string;
  descriptors?: MolecularDescriptors;
  svg?: string;
  error?: string;
}

/**
 * Parse an RDKit V2000 molblock into atoms with (x, y) 2D coordinates and bonds.
 */
function parseV2000MolBlock(molblock: string): { atoms: CanvasAtom[]; bonds: CanvasBond[] } | null {
  const lines = molblock.split("\n");
  const v2000Idx = lines.findIndex(l => l.includes("V2000"));
  if (v2000Idx === -1) return null;

  const countLine = lines[v2000Idx];
  const numAtoms = parseInt(countLine.substring(0, 3).trim(), 10);
  const numBonds = parseInt(countLine.substring(3, 6).trim(), 10);

  if (isNaN(numAtoms) || isNaN(numBonds)) return null;

  const atoms: CanvasAtom[] = [];
  for (let i = 0; i < numAtoms; i++) {
    const line = lines[v2000Idx + 1 + i];
    if (!line) continue;
    const x = parseFloat(line.substring(0, 10).trim()) || 0;
    const y = parseFloat(line.substring(10, 20).trim()) || 0;
    const element = line.substring(31, 34).trim() || "C";
    atoms.push({ id: i, x, y, element });
  }

  const bonds: CanvasBond[] = [];
  for (let i = 0; i < numBonds; i++) {
    const line = lines[v2000Idx + 1 + numAtoms + i];
    if (!line) continue;
    const from = (parseInt(line.substring(0, 3).trim(), 10) || 1) - 1;
    const to = (parseInt(line.substring(3, 6).trim(), 10) || 1) - 1;
    const order = parseInt(line.substring(6, 9).trim(), 10) || 1;
    bonds.push({ from, to, order });
  }

  return { atoms, bonds };
}

/**
 * Format atoms and bonds into a standard V2000 molblock for RDKit WASM ingestion.
 */
function buildV2000MolBlock(atoms: CanvasAtom[], bonds: CanvasBond[]): string {
  const header = "\n  BioPredict Canvas   2D\n\n";

  // Map each atom's ID to its 1-based index in the atom list
  const idToIndex = new Map<number, number>();
  atoms.forEach((a, idx) => {
    idToIndex.set(a.id, idx + 1);
  });

  // Filter bonds to only those where both endpoints exist in atoms
  const validBonds: { from: number; to: number; order: number }[] = [];
  for (const b of bonds) {
    let fromIdx: number | undefined = idToIndex.get(b.from);
    let toIdx: number | undefined = idToIndex.get(b.to);

    // If ID was already a 0-based array index instead of a custom ID:
    if (fromIdx === undefined && b.from >= 0 && b.from < atoms.length) {
      fromIdx = b.from + 1;
    }
    if (toIdx === undefined && b.to >= 0 && b.to < atoms.length) {
      toIdx = b.to + 1;
    }

    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      validBonds.push({ from: fromIdx, to: toIdx, order: Math.min(3, Math.max(1, b.order || 1)) });
    }
  }

  const countStr =
    String(atoms.length).padStart(3, " ") +
    String(validBonds.length).padStart(3, " ") +
    "  0  0  0  0  0  0  0  0999 V2000\n";

  const atomLines = atoms
    .map(a => {
      const x = a.x.toFixed(4).padStart(10, " ");
      const y = a.y.toFixed(4).padStart(10, " ");
      const z = "    0.0000";
      const el = " " + (a.element || "C").trim().padEnd(3, " ");
      return `${x}${y}${z}${el} 0  0  0  0  0  0  0  0  0  0  0  0`;
    })
    .join("\n");

  const bondLines = validBonds
    .map(b => {
      const from = String(b.from).padStart(3, " ");
      const to = String(b.to).padStart(3, " ");
      const order = String(b.order).padStart(3, " ");
      return `${from}${to}${order}  0`;
    })
    .join("\n");

  return header + countStr + atomLines + (validBonds.length > 0 ? "\n" + bondLines : "") + "\nM  END\n";
}

export class MolecularCanvasService {
  /**
   * Convert a SMILES string to a 2D atomic graph with coordinates, bonds, and descriptors.
   */
  static async smilesToGraph(smiles: string): Promise<MolecularGraph> {
    if (!smiles || smiles.trim().length === 0) {
      return { valid: false, atoms: [], bonds: [], smiles: "", canonicalSmiles: "", error: "Empty SMILES" };
    }

    try {
      const RDKit = await getRDKit();
      const mol = RDKit.get_mol(smiles.trim());
      if (!mol) {
        return { valid: false, atoms: [], bonds: [], smiles, canonicalSmiles: "", error: "Invalid chemical structure or valency" };
      }

      try {
        // Generate optimal 2D depiction coordinates
        mol.get_new_coords();
        const molblock = mol.get_v2Kmolblock();
        const parsed = parseV2000MolBlock(molblock);
        const canonical = mol.get_smiles();
        const svg = mol.get_svg(360, 260);

        let descriptors: MolecularDescriptors | undefined;
        try {
          const d = JSON.parse(mol.get_descriptors());
          descriptors = {
            molecularWeight: Math.round(d.amw * 100) / 100,
            logP: Math.round(d.CrippenClogP * 100) / 100,
            tpsa: Math.round(d.tpsa * 100) / 100,
            rotatableBonds: d.NumRotatableBonds,
            hbdCount: d.NumHBD,
            hbaCount: d.NumHBA,
            atomCount: d.NumHeavyAtoms,
            ringCount: d.NumRings,
          };
        } catch {
          // Ignore descriptor error
        }

        return {
          valid: true,
          atoms: parsed ? parsed.atoms : [],
          bonds: parsed ? parsed.bonds : [],
          smiles,
          canonicalSmiles: canonical,
          descriptors,
          svg,
        };
      } finally {
        mol.delete();
      }
    } catch (err: any) {
      return { valid: false, atoms: [], bonds: [], smiles, canonicalSmiles: "", error: err.message };
    }
  }

  /**
   * Convert user-drawn 2D canvas atoms and bonds into a canonical SMILES string and descriptors.
   */
  static async graphToSmiles(atoms: CanvasAtom[], bonds: CanvasBond[]): Promise<MolecularGraph> {
    if (!atoms || atoms.length === 0) {
      return { valid: false, atoms: [], bonds: [], smiles: "", canonicalSmiles: "", error: "No atoms on canvas" };
    }

    try {
      const molblock = buildV2000MolBlock(atoms, bonds);
      const RDKit = await getRDKit();
      const mol = RDKit.get_mol(molblock);

      if (!mol) {
        return {
          valid: false,
          atoms,
          bonds,
          smiles: "",
          canonicalSmiles: "",
          error: "Chemical graph violates valency or cannot be sanitized (check bond orders and charges)",
        };
      }

      try {
        const canonical = mol.get_smiles();
        const svg = mol.get_svg(360, 260);

        let descriptors: MolecularDescriptors | undefined;
        try {
          const d = JSON.parse(mol.get_descriptors());
          descriptors = {
            molecularWeight: Math.round(d.amw * 100) / 100,
            logP: Math.round(d.CrippenClogP * 100) / 100,
            tpsa: Math.round(d.tpsa * 100) / 100,
            rotatableBonds: d.NumRotatableBonds,
            hbdCount: d.NumHBD,
            hbaCount: d.NumHBA,
            atomCount: d.NumHeavyAtoms,
            ringCount: d.NumRings,
          };
        } catch {
          // Ignore
        }

        return {
          valid: true,
          atoms,
          bonds,
          smiles: canonical,
          canonicalSmiles: canonical,
          descriptors,
          svg,
        };
      } finally {
        mol.delete();
      }
    } catch (err: any) {
      return { valid: false, atoms, bonds, smiles: "", canonicalSmiles: "", error: err.message };
    }
  }
}

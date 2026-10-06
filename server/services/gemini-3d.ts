const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"; // use v1beta for wider model availability
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_3D_MODEL || "gemini-3.5-flash";
const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

if (!GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY is not set. 3D visualization will use fallback data.");
}

async function callGemini(model: string, prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: Error | null = null;

  for (const m of modelsToTry) {
    try {
      const url = `${GEMINI_API_BASE}/models/${m}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini-3D] model ${m} failed (${response.status}), trying fallback...`);
        lastError = new Error(`Gemini API error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed to generate 3D coordinates");
}

function extractJson(text: string) {
  let jsonText = text.trim();

  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/```json\n?/gi, "").replace(/```/g, "").trim();
  }

  return JSON.parse(jsonText);
}

function formatElementSymbol(element: any): string {
  if (typeof element !== 'string') return 'C';
  const clean = element.trim().replace(/[^a-zA-Z]/g, '');
  if (!clean) return 'C';
  if (clean.length === 1) return clean.toUpperCase();
  return clean[0].toUpperCase() + clean.slice(1).toLowerCase();
}

function sanitize3DStructure(raw: any) {
  if (!raw || !Array.isArray(raw.atoms) || raw.atoms.length === 0) {
    return null;
  }

  const atoms = raw.atoms.map((a: any) => ({
    element: formatElementSymbol(a.element),
    x: typeof a.x === 'number' && !isNaN(a.x) ? a.x : 0,
    y: typeof a.y === 'number' && !isNaN(a.y) ? a.y : 0,
    z: typeof a.z === 'number' && !isNaN(a.z) ? a.z : 0,
  }));

  // Detect 1-based indexing
  let rawBonds = Array.isArray(raw.bonds) ? raw.bonds : [];
  let isOneBased = false;
  if (rawBonds.length > 0) {
    const minIdx = Math.min(...rawBonds.map((b: any) => Math.min(b.from ?? 0, b.to ?? 0)));
    const maxIdx = Math.max(...rawBonds.map((b: any) => Math.max(b.from ?? 0, b.to ?? 0)));
    if (minIdx === 1 || maxIdx === atoms.length) {
      isOneBased = true;
    }
  }

  const bonds = rawBonds
    .map((b: any) => {
      const from = isOneBased ? (b.from - 1) : Number(b.from);
      const to = isOneBased ? (b.to - 1) : Number(b.to);
      const order = Number(b.order) || 1;
      return { from, to, order: order >= 1 && order <= 3 ? order : 1 };
    })
    .filter((b: any) => b.from >= 0 && b.from < atoms.length && b.to >= 0 && b.to < atoms.length && b.from !== b.to);

  // For binary/ternary species or salts where bonds are missing (e.g. NaCl, KCl), provide connecting bonds for visual ball-and-stick rendering
  if (atoms.length === 2 && bonds.length === 0) {
    bonds.push({ from: 0, to: 1, order: 1 });
  } else if (atoms.length === 3 && bonds.length === 0) {
    bonds.push({ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 });
  } else if (atoms.length <= 6) {
    // If any isolated atom in a small compound or salt has no bonds, connect it to its closest neighbor
    const connectedAtoms = new Set<number>();
    bonds.forEach((b: any) => {
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

  // Center coordinates around (0,0,0)
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const a of atoms) {
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
    minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const targetSpan = 3.5;
  const scale = span > 0 ? targetSpan / span : 1;

  for (const a of atoms) {
    a.x = (a.x - cx) * scale;
    a.y = (a.y - cy) * scale;
    a.z = (a.z - cz) * scale;
  }

  return { atoms, bonds, molecularInsights: raw.molecularInsights || "Optimized 3D geometry generated via AI structural modeling." };
}

function generateDeterministic3DConformer(smiles: string) {
  const atoms: Array<{ element: string; x: number; y: number; z: number }> = [];
  const bonds: Array<{ from: number; to: number; order: number }> = [];

  let atomIdx = 0;
  const ringMap: Record<string, number> = {};
  const branchStack: number[] = [];
  let currentAtom = -1;

  for (let i = 0; i < smiles.length; i++) {
    const char = smiles[i];

    // Bracketed atoms like [Na+], [Cl-], [Fe+3], [OH-], [NH4+]
    if (char === '[') {
      const closeIdx = smiles.indexOf(']', i);
      if (closeIdx !== -1) {
        const inside = smiles.slice(i + 1, closeIdx);
        const match = inside.match(/^([A-Z][a-z]?|[a-z])/);
        const elem = match ? formatElementSymbol(match[1]) : 'C';
        atoms.push({ element: elem, x: 0, y: 0, z: 0 });
        if (currentAtom >= 0) {
          bonds.push({ from: currentAtom, to: atomIdx, order: 1 });
        }
        currentAtom = atomIdx;
        atomIdx++;
        i = closeIdx;
        continue;
      }
    }

    // Ionic salts / disconnected components like [Na+].[Cl-]
    if (char === '.') {
      currentAtom = -1;
      branchStack.length = 0;
      continue;
    }

    if (/[A-Z]/.test(char) || /[cnops]/.test(char)) {
      let elem = char;
      if (i + 1 < smiles.length && /[a-z]/.test(smiles[i + 1]) && /[A-Z]/.test(char)) {
        elem += smiles[i + 1];
        i++;
      }
      elem = formatElementSymbol(elem);
      atoms.push({ element: elem, x: 0, y: 0, z: 0 });

      if (currentAtom >= 0) {
        bonds.push({ from: currentAtom, to: atomIdx, order: 1 });
      }
      currentAtom = atomIdx;
      atomIdx++;
    } else if (char === '=') {
      if (bonds.length > 0) bonds[bonds.length - 1].order = 2;
    } else if (char === '#') {
      if (bonds.length > 0) bonds[bonds.length - 1].order = 3;
    } else if (/[0-9]/.test(char)) {
      if (ringMap[char] !== undefined) {
        bonds.push({ from: ringMap[char], to: currentAtom, order: 1 });
        delete ringMap[char];
      } else {
        ringMap[char] = currentAtom;
      }
    } else if (char === '(') {
      branchStack.push(currentAtom);
    } else if (char === ')') {
      currentAtom = branchStack.pop() ?? currentAtom;
    }
  }

  const n = atoms.length;
  if (n === 0) return { atoms: [], bonds: [], molecularInsights: "Empty structure" };

  // Special handling for binary ionic salts (e.g. NaCl, KCl, LiF)
  if (n === 2 && bonds.length === 0) {
    atoms[0].x = -1.4; atoms[0].y = 0; atoms[0].z = 0;
    atoms[1].x = 1.4; atoms[1].y = 0; atoms[1].z = 0;
    bonds.push({ from: 0, to: 1, order: 1 });
    return sanitize3DStructure({ atoms, bonds, molecularInsights: "Binary salt ball-and-stick spatial conformer." });
  }

  // Ternary ionic salts (e.g. CaCl2, MgCl2, Na2O)
  if (n === 3 && bonds.length === 0) {
    atoms[0].x = 0; atoms[0].y = 0; atoms[0].z = 0;
    atoms[1].x = -1.75; atoms[1].y = 0; atoms[1].z = 0;
    atoms[2].x = 1.75; atoms[2].y = 0; atoms[2].z = 0;
    bonds.push({ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 });
    return sanitize3DStructure({ atoms, bonds, molecularInsights: "Ionic complex ball-and-stick spatial conformer." });
  }

  // 3D positioning with VSEPR tetrahedral & ring relaxation
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * Math.PI * 2 * (1 + Math.floor(n / 6));
    const r = 1.3 * Math.sqrt(i + 1);
    atoms[i].x = r * Math.cos(theta);
    atoms[i].y = r * Math.sin(theta);
    atoms[i].z = ((i % 4) - 1.5) * 0.75;
  }

  // Energy relaxation iterations
  for (let iter = 0; iter < 120; iter++) {
    for (const b of bonds) {
      const a1 = atoms[b.from];
      const a2 = atoms[b.to];
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dz = a2.z - a1.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
      const target = b.order === 2 ? 1.34 : (b.order === 3 ? 1.2 : 1.52);
      const diff = (dist - target) * 0.15;
      const nx = (dx / dist) * diff;
      const ny = (dy / dist) * diff;
      const nz = (dz / dist) * diff;
      a1.x += nx; a1.y += ny; a1.z += nz;
      a2.x -= nx; a2.y -= ny; a2.z -= nz;
    }
  }

  return sanitize3DStructure({ atoms, bonds, molecularInsights: "Deterministic 3D ball-and-stick spatial conformer." });
}

export class Gemini3DService {
  /**
   * Generate 3D molecular structure visualization using Gemini API
   * This uses Gemini to enhance the molecular visualization with AI-powered suggestions
   */
  static async generate3DVisualization(smiles: string, compoundName?: string) {
    try {
      const prompt = `You are a structural chemistry and molecular modeling expert.
Given this SMILES string: "${smiles}" ${compoundName ? `for compound "${compoundName}"` : ''},
generate realistic 3D Cartesian coordinates (ball-and-stick geometry) for optimal 3D visualization.

RULES:
1. "atoms": Array of all heavy (non-hydrogen) atoms with:
   - "element": atomic symbol (e.g. "C", "N", "O", "S", "F", "Cl", "P")
   - "x", "y", "z": 3D coordinates in Angstroms centered around (0,0,0). Bond lengths should be ~1.2 to 1.6 Å.
2. "bonds": Array of bonds connecting the atoms for ball-and-stick modeling:
   - For covalent compounds, include all covalent bonds.
   - For ionic salts/counterions (e.g. NaCl, KCl, CaCl2), connect each counterion to its adjacent atom with order 1 so the molecule displays connected.
   - "from": 0-BASED integer index of starting atom (0 <= from < atoms.length)
   - "to": 0-BASED integer index of ending atom (0 <= to < atoms.length)
   - "order": 1 for single, 2 for double, 3 for triple
3. Follow realistic VSEPR geometries (sp3 tetrahedral ~109.5°, sp2 planar ~120°, aromatic rings flat).
4. "molecularInsights": 1-2 sentences on 3D conformation and key spatial features.

Output strictly valid JSON with no markdown code fences:
{
  "atoms": [{"element": "C", "x": 0.0, "y": 0.0, "z": 0.0}, ...],
  "bonds": [{"from": 0, "to": 1, "order": 1}, ...],
  "molecularInsights": "..."
}`;
      const text = await callGemini(GEMINI_MODEL, prompt);
      const parsed = extractJson(text);
      const sanitized = sanitize3DStructure(parsed);

      if (sanitized && sanitized.atoms.length > 0) {
        return {
          success: true,
          data: sanitized,
          timestamp: new Date().toISOString()
        };
      }
      throw new Error("Parsed structure had invalid geometry");
    } catch (error) {
      console.warn("Gemini 3D generation error, falling back to deterministic conformer:", error);
      const fallbackStructure = generateDeterministic3DConformer(smiles);
      return {
        success: true,
        data: fallbackStructure,
        fallback: true,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get AI-enhanced molecular insights
   */
  static async getMolecularInsights(smiles: string, compoundName?: string) {
    try {
      const prompt = `
Analyze this molecular compound:
SMILES: ${smiles}
${compoundName ? `Name: ${compoundName}` : ''}

Provide:
1. Key structural features
2. Functional groups present
3. 3D conformation characteristics
4. Important chemical properties
5. Visualization tips for 3D rendering

Keep it concise and scientific. Return as JSON with keys: features, functionalGroups, conformation, properties, visualizationTips
`;
  const text = await callGemini(GEMINI_MODEL, prompt);
      return extractJson(text);
    } catch (error) {
      console.error("Gemini insights error:", error);
      return null;
    }
  }
}

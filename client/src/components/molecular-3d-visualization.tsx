import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Box, Download, Expand, RotateCw } from "lucide-react";
import { AnalysisResult } from "@/types/molecular";
import { getMolecularName } from "@/lib/molecular-utils";
import { Switch } from "@/components/ui/switch";

interface Molecular3DVisualizationProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

// 3D structure types
type Atom3D = { element: string; x: number; y: number; z: number };
type Bond3D = { from: number; to: number; order: number };
type Structure3D = { atoms: Atom3D[]; bonds: Bond3D[] };

function formatChemicalElement(raw: string | undefined | null): string {
  if (!raw) return 'C';
  const clean = raw.trim().replace(/[^a-zA-Z]/g, '');
  if (!clean) return 'C';
  if (clean.length === 1) return clean.toUpperCase();
  return clean[0].toUpperCase() + clean.slice(1).toLowerCase();
}

function normalizeStructure3D(raw: Structure3D | null): Structure3D | null {
  if (!raw || !Array.isArray(raw.atoms) || raw.atoms.length === 0) return null;

  const atoms = raw.atoms.map(a => ({
    element: formatChemicalElement(a.element),
    x: typeof a.x === 'number' && !isNaN(a.x) ? a.x : 0,
    y: typeof a.y === 'number' && !isNaN(a.y) ? a.y : 0,
    z: typeof a.z === 'number' && !isNaN(a.z) ? a.z : 0,
  }));

  let rawBonds = Array.isArray(raw.bonds) ? raw.bonds : [];
  let isOneBased = false;
  if (rawBonds.length > 0) {
    const minIdx = Math.min(...rawBonds.map(b => Math.min(b.from ?? 0, b.to ?? 0)));
    const maxIdx = Math.max(...rawBonds.map(b => Math.max(b.from ?? 0, b.to ?? 0)));
    if (minIdx === 1 || maxIdx === atoms.length) {
      isOneBased = true;
    }
  }

  const bonds = rawBonds
    .map(b => {
      const from = isOneBased ? (b.from - 1) : Number(b.from);
      const to = isOneBased ? (b.to - 1) : Number(b.to);
      const order = Number(b.order) || 1;
      return { from, to, order: order >= 1 && order <= 3 ? order : 1 };
    })
    .filter(b => b.from >= 0 && b.from < atoms.length && b.to >= 0 && b.to < atoms.length && b.from !== b.to);

  // Ensure binary salts and disconnected diatomic/polyatomic species have visual bonds
  if (atoms.length === 2 && bonds.length === 0) {
    bonds.push({ from: 0, to: 1, order: 1 });
  } else if (atoms.length === 3 && bonds.length === 0) {
    bonds.push({ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 });
  } else if (atoms.length <= 6) {
    // If any isolated atom in a small compound or salt has no bonds, connect it to its closest neighbor
    const connectedAtoms = new Set<number>();
    bonds.forEach(b => {
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

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  atoms.forEach(a => {
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
    minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const targetSpan = 3.2;
  const scale = span > 0 ? targetSpan / span : 1;

  atoms.forEach(a => {
    a.x = (a.x - cx) * scale;
    a.y = (a.y - cy) * scale;
    a.z = (a.z - cz) * scale;
  });

  return { atoms, bonds };
}

export default function Molecular3DVisualization({ analysis, isAnalyzing }: Molecular3DVisualizationProps) {
  const compound = analysis?.compound;
  const prediction = analysis?.prediction;
  const structureData = analysis?.structure;
  const structureImages = structureData?.images;
  const backendStructure = structureData?.coordinates3d || null;
  const static3DImage = structureImages?.image3d || null;
  const static2DImage = structureImages?.image2d || null;
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenViewerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [geminiStructure, setGeminiStructure] = useState<any>(null);
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [useGemini, setUseGemini] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [showLabels, setShowLabels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [displayMode, setDisplayMode] = useState<'3d-normal' | '3d-ai' | '2d-vector'>('3d-normal');

  // Sync useGemini with displayMode
  useEffect(() => {
    if (displayMode === '3d-ai') {
      setUseGemini(true);
    } else {
      setUseGemini(false);
    }
  }, [displayMode]);

  // Fetch 3D structure from Gemini API when compound changes or AI toggle is enabled
  useEffect(() => {
    if (compound && useGemini && !geminiStructure) {
      setIsLoadingGemini(true);
      fetch('/api/gemini/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          smiles: compound.smiles, 
          name: compound.name 
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setGeminiStructure(data.data);
          }
        })
        .catch(err => {
          console.error('Gemini API error:', err);
        })
        .finally(() => setIsLoadingGemini(false));
    } else if (!useGemini) {
      setGeminiStructure(null);
    }
  }, [compound, useGemini, geminiStructure]);

  useEffect(() => {
    setGeminiStructure(null);
  }, [compound?.smiles]);

  // Generate 3D coordinates from SMILES (improved algorithm)
  const generate3DStructure = (smiles: string): Structure3D => {
    const atoms: Atom3D[] = [];
    const bonds: Bond3D[] = [];
    
    // Parse SMILES string
    let atomIndex = 0;
    const ringConnections: { [key: string]: number } = {};
    let branchStack: number[] = [];
    let currentAtom = -1;
    
    for (let i = 0; i < smiles.length; i++) {
      const char = smiles[i];

      // Handle bracketed atoms: e.g. [Na+], [Cl-], [Fe+3], [OH-], [NH4+]
      if (char === '[') {
        const closeIdx = smiles.indexOf(']', i);
        if (closeIdx !== -1) {
          const bracketContent = smiles.slice(i + 1, closeIdx);
          const match = bracketContent.match(/^([A-Z][a-z]?|[a-z])/);
          const rawElem = match ? match[1] : 'C';
          const element = formatChemicalElement(rawElem);

          atoms.push({ element, x: 0, y: 0, z: 0 });
          if (currentAtom >= 0) {
            bonds.push({ from: currentAtom, to: atomIndex, order: 1 });
          }
          currentAtom = atomIndex;
          atomIndex++;
          i = closeIdx;
          continue;
        }
      }

      // Handle disconnected components / ionic salts: e.g. [Na+].[Cl-]
      if (char === '.') {
        currentAtom = -1;
        branchStack = [];
        continue;
      }
      
      // Handle standard atoms
      if (/[A-Z]/.test(char) || /[cnops]/.test(char)) { // include aromatic lower-case c,n,o,p,s
        let element = char;
        
        // Handle two-letter elements
        if (i + 1 < smiles.length && /[a-z]/.test(smiles[i + 1]) && /[A-Z]/.test(char)) {
          element += smiles[i + 1];
          i++;
        }
        
        element = formatChemicalElement(element);
        atoms.push({ element, x: 0, y: 0, z: 0 });
        
        // Connect to previous atom if exists in the same component
        if (currentAtom >= 0) {
          bonds.push({ from: currentAtom, to: atomIndex, order: 1 });
        }
        
        currentAtom = atomIndex;
        atomIndex++;
      }
      // Handle double bond
      else if (char === '=') {
        if (bonds.length > 0) {
          bonds[bonds.length - 1].order = 2;
        }
      }
      // Handle triple bond
      else if (char === '#') {
        if (bonds.length > 0) {
          bonds[bonds.length - 1].order = 3;
        }
      }
      // Handle ring closures
      else if (/[0-9]/.test(char)) {
        const ringNum = char;
        if (ringConnections[ringNum] !== undefined) {
          bonds.push({ from: ringConnections[ringNum], to: currentAtom, order: 1 });
          delete ringConnections[ringNum];
        } else {
          ringConnections[ringNum] = currentAtom;
        }
      }
      // Handle branches
      else if (char === '(') {
        branchStack.push(currentAtom);
      }
      else if (char === ')') {
        currentAtom = branchStack.pop() || currentAtom;
      }
    }
    
    if (atoms.length === 0) return { atoms, bonds };

    // Special handling for binary ionic salts (e.g. NaCl, KCl, LiF)
    if (atoms.length === 2 && bonds.length === 0) {
      atoms[0].x = -1.4; atoms[0].y = 0; atoms[0].z = 0;
      atoms[1].x = 1.4; atoms[1].y = 0; atoms[1].z = 0;
      bonds.push({ from: 0, to: 1, order: 1 });
      return { atoms, bonds };
    }

    // Special handling for ternary ionic salts (e.g. CaCl2, MgCl2, Na2O)
    if (atoms.length === 3 && bonds.length === 0) {
      atoms[0].x = 0; atoms[0].y = 0; atoms[0].z = 0;
      atoms[1].x = -1.75; atoms[1].y = 0; atoms[1].z = 0;
      atoms[2].x = 1.75; atoms[2].y = 0; atoms[2].z = 0;
      bonds.push({ from: 0, to: 1, order: 1 }, { from: 0, to: 2, order: 1 });
      return { atoms, bonds };
    }
    
    // Initialize positions in a spiral for better initial distribution
    const radius = Math.sqrt(atoms.length) * 1.8; // More spread out
    atoms.forEach((atom, i) => {
      const angle = (i / atoms.length) * Math.PI * 4;
      const r = (i / atoms.length) * radius;
      atom.x = Math.cos(angle) * r;
      atom.y = Math.sin(angle) * r;
      atom.z = (i / atoms.length - 0.5) * 3; // More depth
    });
    
    // Apply force-directed algorithm for better layout
    const iterations = 240; // More iterations for better convergence
    const idealBondLength = 2.2; // Longer bonds for better spacing
    const repulsionStrength = 1.5; // Stronger repulsion between atoms
    const springStrength = 0.25; // Stronger spring force for bonds
    const minSeparation = 1.2;
    
    for (let iter = 0; iter < iterations; iter++) {
      const forces = atoms.map(() => ({ x: 0, y: 0, z: 0 }));
      
      // Repulsion between all atoms
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dx = atoms[j].x - atoms[i].x;
          const dy = atoms[j].y - atoms[i].y;
          const dz = atoms[j].z - atoms[i].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
          
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;
          
          forces[i].x -= fx;
          forces[i].y -= fy;
          forces[i].z -= fz;
          forces[j].x += fx;
          forces[j].y += fy;
          forces[j].z += fz;

          // Collision avoidance – ensure minimum separation
          if (dist < minSeparation) {
            const push = (minSeparation - dist) * 0.6;
            const px = (dx / dist) * push;
            const py = (dy / dist) * push;
            const pz = (dz / dist) * push;
            forces[i].x -= px; forces[i].y -= py; forces[i].z -= pz;
            forces[j].x += px; forces[j].y += py; forces[j].z += pz;
          }
        }
      }
      
      // Spring forces for bonds
      bonds.forEach((bond: Bond3D) => {
        const i = bond.from;
        const j = bond.to;
        const dx = atoms[j].x - atoms[i].x;
        const dy = atoms[j].y - atoms[i].y;
        const dz = atoms[j].z - atoms[i].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        
        const displacement = dist - idealBondLength;
        const force = displacement * springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        forces[i].x += fx;
        forces[i].y += fy;
        forces[i].z += fz;
        forces[j].x -= fx;
        forces[j].y -= fy;
        forces[j].z -= fz;
      });
      
      // Apply forces with adaptive damping
      const damping = 0.55 - (iter / iterations) * 0.35; // Decrease damping over time for settling
      atoms.forEach((atom, i) => {
        atom.x += forces[i].x * damping;
        atom.y += forces[i].y * damping;
        atom.z += forces[i].z * damping;
      });
    }
    
    // Calculate bounds for proper centering and scaling
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    atoms.forEach(atom => {
      minX = Math.min(minX, atom.x);
      maxX = Math.max(maxX, atom.x);
      minY = Math.min(minY, atom.y);
      maxY = Math.max(maxY, atom.y);
      minZ = Math.min(minZ, atom.z);
      maxZ = Math.max(maxZ, atom.z);
    });
    
    // Calculate scale to fit in reasonable bounds
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const depth = maxZ - minZ || 1;
    const maxDim = Math.max(width, height, depth);
    const targetSize = 2.0; // Target size for the molecule
    const scale = (maxDim > 0) ? targetSize / maxDim : 1;
    
    // Center and scale the molecule
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    atoms.forEach(atom => {
      atom.x = (atom.x - centerX) * scale;
      atom.y = (atom.y - centerY) * scale;
      atom.z = (atom.z - centerZ) * scale;
    });
    
    return { atoms, bonds };
  };

  const pubchemStructure: Structure3D | null = backendStructure && Array.isArray(backendStructure.atoms)
    && Array.isArray(backendStructure.bonds)
    ? normalizeStructure3D(backendStructure as Structure3D)
    : null;

  const structure: Structure3D | null = compound ? (
    geminiStructure && Array.isArray(geminiStructure.atoms) && Array.isArray(geminiStructure.bonds)
      ? normalizeStructure3D(geminiStructure as Structure3D)
      : pubchemStructure || normalizeStructure3D(generate3DStructure(compound.smiles))
  ) : null;

  const structureSource = geminiStructure ? 'gemini' : (pubchemStructure ? (structureData?.source ?? 'pubchem') : 'computed');

  // Handle mouse interactions for rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    setRotation(prev => ({
      x: prev.x + deltaY * 0.5,
      y: prev.y + deltaX * 0.5,
    }));
    
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Auto-rotate
  useEffect(() => {
    if (!compound || isFullscreen || !autoRotate) return;
    
    const interval = setInterval(() => {
      setRotation(prev => ({
        x: prev.x,
        y: prev.y + 0.5,
      }));
    }, 50);
    
    return () => clearInterval(interval);
  }, [compound, isFullscreen, autoRotate]);

  // Reset rotation
  const handleReset = () => {
    setRotation({ x: 0, y: 0 });
  };

  // Download 3D structure as PNG
  const handleDownload = () => {
    if (!compound) return;

    if (static3DImage) {
      const link = document.createElement('a');
      link.href = static3DImage;
      link.download = `${compound.name || getMolecularName(compound.smiles)}_3d_structure.png`;
      link.click();
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 900;

    // Fill background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw title
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3D Molecular Structure', canvas.width / 2, 50);

    // Render 3D structure
    if (structure) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 - 50;
      const scale = 120;

      // Draw bonds
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 3;
      structure.bonds.forEach(bond => {
        const from = structure.atoms[bond.from];
        const to = structure.atoms[bond.to];
        
        const fromX = centerX + from.x * scale;
        const fromY = centerY - from.y * scale;
        const toX = centerX + to.x * scale;
        const toY = centerY - to.y * scale;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
      });

      // Draw atoms
      structure.atoms.forEach(atom => {
        const x = centerX + atom.x * scale;
        const y = centerY - atom.y * scale;
        
        // Atom sphere
        const gradient = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 25);
        
        switch (atom.element) {
          case 'C':
            gradient.addColorStop(0, '#666666');
            gradient.addColorStop(1, '#333333');
            break;
          case 'O':
            gradient.addColorStop(0, '#ff5555');
            gradient.addColorStop(1, '#cc0000');
            break;
          case 'N':
            gradient.addColorStop(0, '#5555ff');
            gradient.addColorStop(1, '#0000cc');
            break;
          case 'S':
            gradient.addColorStop(0, '#ffff55');
            gradient.addColorStop(1, '#cccc00');
            break;
          case 'Cl':
            gradient.addColorStop(0, '#66ff66');
            gradient.addColorStop(1, '#118811');
            break;
          case 'F':
            gradient.addColorStop(0, '#88ff88');
            gradient.addColorStop(1, '#00aa00');
            break;
          case 'Br':
            gradient.addColorStop(0, '#cc6666');
            gradient.addColorStop(1, '#881111');
            break;
          case 'I':
            gradient.addColorStop(0, '#cc88ff');
            gradient.addColorStop(1, '#7700cc');
            break;
          case 'Na':
            gradient.addColorStop(0, '#c084fc');
            gradient.addColorStop(1, '#7e22ce');
            break;
          case 'K':
            gradient.addColorStop(0, '#a78bfa');
            gradient.addColorStop(1, '#6d28d9');
            break;
          case 'Ca':
            gradient.addColorStop(0, '#2dd4bf');
            gradient.addColorStop(1, '#0f766e');
            break;
          case 'Mg':
            gradient.addColorStop(0, '#34d399');
            gradient.addColorStop(1, '#047857');
            break;
          case 'P':
            gradient.addColorStop(0, '#ff8800');
            gradient.addColorStop(1, '#cc6600');
            break;
          default:
            gradient.addColorStop(0, '#999999');
            gradient.addColorStop(1, '#666666');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 25, 0, Math.PI * 2);
        ctx.fill();
        
        // Atom label
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(atom.element, x, y);
      });
    }

    // Add compound info
    ctx.fillStyle = '#4b5563';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    const infoY = canvas.height - 120;
    
    ctx.fillText(compound.name || getMolecularName(compound.smiles), canvas.width / 2, infoY);
    ctx.font = '16px monospace';
    ctx.fillText(`SMILES: ${compound.smiles}`, canvas.width / 2, infoY + 30);
    
    if (prediction) {
      ctx.fillText(
        `Molecular Weight: ${prediction.descriptors.molecularWeight.toFixed(2)} g/mol`,
        canvas.width / 2,
        infoY + 60
      );
    }

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${compound.name || 'molecule'}_3d_structure.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // Render 3D structure with proper perspective
  const render3DStructure = (containerRef: React.RefObject<HTMLDivElement>) => {
    if (!structure) return null;

    const viewBoxSize = 500;
    const centerX = viewBoxSize / 2;
    const centerY = viewBoxSize / 2;
    const scale = 54 * zoom;

    // Apply 3D rotation transformation
    const rotatePoint = (x: number, y: number, z: number) => {
      const angleX = (rotation.x * Math.PI) / 180;
      const angleY = (rotation.y * Math.PI) / 180;
      
      // Rotate around Y axis
      let newX = x * Math.cos(angleY) + z * Math.sin(angleY);
      let newZ = -x * Math.sin(angleY) + z * Math.cos(angleY);
      
      // Rotate around X axis
      let newY = y * Math.cos(angleX) - newZ * Math.sin(angleX);
      newZ = y * Math.sin(angleX) + newZ * Math.cos(angleX);
      
      // Perspective calculation with clamp to prevent divide-by-zero or negative scaling
      const perspective = 8;
      const perspectiveFactor = perspective / Math.max(1.2, perspective + newZ);
      
      return {
        x: centerX + newX * scale * perspectiveFactor,
        y: centerY - newY * scale * perspectiveFactor,
        z: newZ,
        scale: perspectiveFactor
      };
    };

    // Transform all atoms with perspective
    const transformedAtoms = structure.atoms.map((atom: Atom3D) => 
      rotatePoint(atom.x, atom.y, atom.z)
    );

    // Filter valid bonds and sort by depth
    const validBonds = structure.bonds.filter(b => transformedAtoms[b.from] && transformedAtoms[b.to]);
    const bondDepths = validBonds.map((bond: Bond3D, i: number) => {
      const fromZ = transformedAtoms[bond.from].z;
      const toZ = transformedAtoms[bond.to].z;
      return { bond, index: i, depth: (fromZ + toZ) / 2 };
    });
    bondDepths.sort((a, b) => a.depth - b.depth);

    const atomDepths = structure.atoms.map((atom: Atom3D, i: number) => ({
      atom,
      index: i,
      depth: transformedAtoms[i]?.z ?? 0,
      transformed: transformedAtoms[i]
    })).filter(a => a.transformed);
    atomDepths.sort((a, b) => a.depth - b.depth);

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', maxHeight: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
          </filter>
          <filter id="shadowStrong">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.4"/>
          </filter>
          <radialGradient id="carbonGrad">
            <stop offset="0%" stopColor="#888888" />
            <stop offset="100%" stopColor="#333333" />
          </radialGradient>
          <radialGradient id="oxygenGrad">
            <stop offset="0%" stopColor="#ff6666" />
            <stop offset="100%" stopColor="#dd0000" />
          </radialGradient>
          <radialGradient id="nitrogenGrad">
            <stop offset="0%" stopColor="#6666ff" />
            <stop offset="100%" stopColor="#0000dd" />
          </radialGradient>
          <radialGradient id="sulfurGrad">
            <stop offset="0%" stopColor="#ffff66" />
            <stop offset="100%" stopColor="#dddd00" />
          </radialGradient>
          <radialGradient id="fluorineGrad">
            <stop offset="0%" stopColor="#88ff88" />
            <stop offset="100%" stopColor="#00aa00" />
          </radialGradient>
          <radialGradient id="chlorineGrad">
            <stop offset="0%" stopColor="#66ff66" />
            <stop offset="100%" stopColor="#118811" />
          </radialGradient>
          <radialGradient id="bromineGrad">
            <stop offset="0%" stopColor="#cc6666" />
            <stop offset="100%" stopColor="#881111" />
          </radialGradient>
          <radialGradient id="iodineGrad">
            <stop offset="0%" stopColor="#cc88ff" />
            <stop offset="100%" stopColor="#7700cc" />
          </radialGradient>
          <radialGradient id="hydrogenGrad">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cccccc" />
          </radialGradient>
          <radialGradient id="phosphorusGrad">
            <stop offset="0%" stopColor="#ff8800" />
            <stop offset="100%" stopColor="#cc6600" />
          </radialGradient>
          <radialGradient id="sodiumGrad">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7e22ce" />
          </radialGradient>
          <radialGradient id="potassiumGrad">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6d28d9" />
          </radialGradient>
          <radialGradient id="calciumGrad">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0f766e" />
          </radialGradient>
          <radialGradient id="magnesiumGrad">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>
          <radialGradient id="ironGrad">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id="zincGrad">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
        </defs>

        {/* Draw bonds (back to front) */}
        {bondDepths.map(({ bond, index }: { bond: Bond3D; index: number }) => {
          const fromPos = transformedAtoms[bond.from];
          const toPos = transformedAtoms[bond.to];
          
          // Adjust bond thickness based on depth
          const avgScale = (fromPos.scale + toPos.scale) / 2;
          const strokeWidth = Math.max(3.5, bond.order * 2.8 * avgScale); // Visible bonds
          
          // Multiple bonds offset
          if (bond.order === 1) {
            return (
              <line
                key={`bond-${index}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#64748b"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={0.8 + avgScale * 0.2}
              />
            );
          } else if (bond.order === 2) {
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetX = (-dy / len) * 3.5; // Slightly larger offset
            const offsetY = (dx / len) * 3.5;
            
            return (
              <g key={`bond-${index}`}>
                <line
                  x1={fromPos.x + offsetX}
                  y1={fromPos.y + offsetY}
                  x2={toPos.x + offsetX}
                  y2={toPos.y + offsetY}
                  stroke="#64748b"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.8 + avgScale * 0.2}
                />
                <line
                  x1={fromPos.x - offsetX}
                  y1={fromPos.y - offsetY}
                  x2={toPos.x - offsetX}
                  y2={toPos.y - offsetY}
                  stroke="#64748b"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.8 + avgScale * 0.2}
                />
              </g>
            );
          } else {
            // Triple bond
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const offsetX = (-dy / len) * 4.5;
            const offsetY = (dx / len) * 4.5;
            
            return (
              <g key={`bond-${index}`}>
                <line
                  x1={fromPos.x}
                  y1={fromPos.y}
                  x2={toPos.x}
                  y2={toPos.y}
                  stroke="#64748b"
                  strokeWidth={strokeWidth * 0.8}
                  strokeLinecap="round"
                  opacity={0.8 + avgScale * 0.2}
                />
                <line
                  x1={fromPos.x + offsetX}
                  y1={fromPos.y + offsetY}
                  x2={toPos.x + offsetX}
                  y2={toPos.y + offsetY}
                  stroke="#64748b"
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                  opacity={0.7 + avgScale * 0.2}
                />
                <line
                  x1={fromPos.x - offsetX}
                  y1={fromPos.y - offsetY}
                  x2={toPos.x - offsetX}
                  y2={toPos.y - offsetY}
                  stroke="#64748b"
                  strokeWidth={strokeWidth * 0.7}
                  strokeLinecap="round"
                  opacity={0.7 + avgScale * 0.2}
                />
              </g>
            );
          }
        })}

        {/* Draw atoms (back to front) */}
        {atomDepths.map(({ atom, index, transformed }: { atom: Atom3D; index: number; transformed: { x: number; y: number; z: number; scale: number } }) => {
          const radius = 16 * transformed.scale; // Slightly smaller for more space
          
          let fill = "url(#carbonGrad)";
          const elemKey = atom.element ? atom.element.toUpperCase() : 'C';
          switch (elemKey) {
            case 'O':
              fill = "url(#oxygenGrad)";
              break;
            case 'N':
              fill = "url(#nitrogenGrad)";
              break;
            case 'S':
              fill = "url(#sulfurGrad)";
              break;
            case 'H':
              fill = "url(#hydrogenGrad)";
              break;
            case 'P':
              fill = "url(#phosphorusGrad)";
              break;
            case 'F':
              fill = "url(#fluorineGrad)";
              break;
            case 'CL':
              fill = "url(#chlorineGrad)";
              break;
            case 'BR':
              fill = "url(#bromineGrad)";
              break;
            case 'I':
              fill = "url(#iodineGrad)";
              break;
            case 'NA':
              fill = "url(#sodiumGrad)";
              break;
            case 'K':
              fill = "url(#potassiumGrad)";
              break;
            case 'CA':
              fill = "url(#calciumGrad)";
              break;
            case 'MG':
              fill = "url(#magnesiumGrad)";
              break;
            case 'FE':
              fill = "url(#ironGrad)";
              break;
            case 'ZN':
              fill = "url(#zincGrad)";
              break;
          }
          
          return (
            <g key={`atom-${index}`}>
              <circle
                cx={transformed.x}
                cy={transformed.y}
                r={radius}
                fill={fill}
                filter={transformed.scale > 0.9 ? "url(#shadowStrong)" : "url(#shadow)"}
                opacity={0.9 + transformed.scale * 0.1}
              />
              {showLabels && (
                <text
                  x={transformed.x}
                  y={transformed.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={Math.max(10, 13 * transformed.scale)}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {atom.element}
                </text>
              )}
            </g>
          );
        })}

        {/* Overlay: SMILES and Molecular Weight inside the image area */}
        {compound && (
          <g>
            {/* Top-right MW badge */}
            <g transform={`translate(${viewBoxSize - 10}, 10)`}>
              <g transform="translate(-160, 0)">
                <rect x={0} y={0} width={170} height={28} rx={8} ry={8} fill="#0f172a" opacity={0.75} stroke="#334155" strokeWidth={0.8} />
                <text x={14} y={18} fontSize={11.5} fontWeight="700" fill="#f8fafc">
                  MW: {prediction ? prediction.descriptors.molecularWeight.toFixed(2) : '—'} g/mol
                </text>
              </g>
            </g>
            {/* Bottom center SMILES */}
            <g transform={`translate(${viewBoxSize / 2}, ${viewBoxSize - 22})`}>
              <rect x={-Math.min(260, viewBoxSize * 0.9) / 2} y={-22} width={Math.min(260, viewBoxSize * 0.9)} height={24} rx={6} ry={6} fill="#0f172a" opacity={0.75} stroke="#334155" strokeWidth={0.8} />
              <text x={0} y={-6} textAnchor="middle" fontSize={11} fill="#e2e8f0" fontFamily="monospace">
                {(compound.smiles.length > 34 ? `${compound.smiles.slice(0,34)}…` : compound.smiles)}
              </text>
            </g>
          </g>
        )}
      </svg>
    );
  };

  return (
    <>
      {/* 3D Molecular Visualization */}
  <Card data-testid="card-3d-molecular-visualization" className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center text-lg font-semibold text-foreground">
                <Box className="mr-2 text-primary h-5 w-5" />
                3D Molecular & AI Geometry
              </span>
              {/* Display Mode Switcher */}
              <div className="flex items-center rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayMode('3d-normal')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    displayMode === '3d-normal'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  3D Normal
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('3d-ai')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    displayMode === '3d-ai'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>✨ AI Geometry</span>
                </button>
                {static2DImage && (
                  <button
                    type="button"
                    onClick={() => setDisplayMode('2d-vector')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      displayMode === '2d-vector'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    2D Flat
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              {/* Labels Toggle */}
              <Button
                variant={showLabels ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowLabels(!showLabels)}
                className="h-8 text-xs px-2"
                title="Toggle atom symbols"
              >
                Labels {showLabels ? "On" : "Off"}
              </Button>

              {/* Auto Rotate Toggle */}
              <Button
                variant={autoRotate ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAutoRotate(!autoRotate)}
                className="h-8 text-xs px-2"
                title="Toggle auto-rotation"
              >
                <RotateCw className={`h-3.5 w-3.5 mr-1 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                Rotate
              </Button>

              {/* Zoom Controls */}
              <div className="flex items-center border border-border rounded-md px-1 h-8">
                <button
                  type="button"
                  disabled={zoom <= 0.6}
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}
                  className="px-1.5 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-[11px] font-mono px-1 min-w-[36px] text-center text-muted-foreground">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  disabled={zoom >= 2.2}
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
                  className="px-1.5 text-sm font-bold text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title="Zoom In"
                >
                  +
                </button>
              </div>

              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={() => { handleReset(); setZoom(1.0); }}
                title="Reset rotation & zoom"
                className="h-8 px-2"
              >
                Reset
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={handleDownload}
                title="Download 3D structure"
                className="h-8 px-2"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={() => setIsFullscreen(true)}
                title="View fullscreen"
                className="h-8 px-2"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div> 
          </div>

          {/* AI Insights Banner */}
          {geminiStructure?.molecularInsights && displayMode === '3d-ai' && (
            <div className="mb-3 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 text-xs flex items-start gap-2">
              <span className="text-primary text-sm leading-none mt-0.5">✨</span>
              <p className="text-foreground leading-relaxed">
                <strong className="text-primary">Gemini 3D Spatial Geometry:</strong> {geminiStructure.molecularInsights}
              </p>
            </div>
          )}
          
          <div 
            ref={viewerContainerRef}
            className="border border-border rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 relative overflow-hidden" 
            style={{ height: '450px' }}
            data-testid="container-3d-structure-display"
          >
            {isAnalyzing || isLoadingGemini ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Skeleton className="h-32 w-32 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                  {isLoadingGemini && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                      🤖 Generating AI-powered 3D structure...
                    </p>
                  )}
                </div>
              </div>
            ) : compound ? (
              <div className="w-full h-full flex flex-col relative">
                {/* 3D Structure Viewer - Takes full container */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div className="w-full h-full max-w-full max-h-full flex items-center justify-center">
                    {displayMode === '2d-vector' && static2DImage ? (
                      <img
                        src={static2DImage}
                        alt="2D molecular structure"
                        className="max-h-full max-w-full object-contain p-4 filter drop-shadow-md"
                      />
                    ) : structure ? (
                      render3DStructure(viewerContainerRef)
                    ) : static3DImage ? (
                      <img
                        src={static3DImage}
                        alt="PubChem 3D structure"
                        className="max-h-full max-w-full rounded-md shadow-sm"
                      />
                    ) : (
                      <div className="text-center text-sm text-muted-foreground">
                        3D coordinates unavailable for this compound.
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Compound Info Overlay - Inside the box */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/90 to-transparent backdrop-blur-sm pb-4 pt-8 px-4 text-center space-y-1.5 z-10 pointer-events-none">
                  <p className="text-base font-bold text-foreground" data-testid="text-3d-compound-name">
                    {compound.name || getMolecularName(compound.smiles)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {structureSource === 'gemini' && 'Source: Gemini AI geometry'}
                    {structureSource === 'pubchem' && 'Source: PubChem 3D coordinates'}
                    {structureSource === 'computed' && 'Source: Generated locally'}
                  </p>
                  <p className="text-xs text-muted-foreground opacity-90">
                    <span className="inline-flex items-center gap-1">
                      <span>Drag to rotate</span>
                      <span className="text-muted-foreground/60">•</span>
                      <span>Reset to center</span>
                      {geminiStructure && (
                        <>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-primary">✨ AI-Enhanced</span>
                        </>
                      )}
                    </span>
                  </p>
                  {/* Mobile AI toggle inside box */}
                  <div className="flex sm:hidden items-center justify-center gap-2 pt-1 pointer-events-auto">
                    <span className="text-xs text-muted-foreground">AI geometry</span>
                    <Switch
                      checked={useGemini}
                      onCheckedChange={(v: boolean) => {
                        setUseGemini(v);
                        setGeminiStructure(null);
                      }}
                      aria-label="Toggle AI geometry"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl text-muted-foreground mb-4">🧬</div>
                  <p className="text-sm text-muted-foreground">Enter a compound to view 3D structure</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-6xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Box className="mr-2 text-primary" />
                3D Structure - Full View
              </span>
              <div className="flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleReset}
                  title="Reset rotation"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleDownload}
                  title="Download 3D structure"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div 
            ref={fullscreenViewerRef}
            className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-lg"
          >
            {compound && (
              <div className="w-full h-full flex flex-col p-8">
                <div className="flex-1 flex items-center justify-center">
                  <div style={{ width: '75%', maxWidth: '800px', aspectRatio: '1' }}>
                    {render3DStructure(fullscreenViewerRef)}
                  </div>
                </div>
                <div className="text-center border-t border-border/50 pt-6 mt-6 space-y-2">
                  <p className="text-2xl text-foreground font-bold">
                    {compound.name || getMolecularName(compound.smiles)}
                  </p>
                  <p className="text-sm text-muted-foreground pt-2 opacity-75">
                    Drag to rotate • Reset to center
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

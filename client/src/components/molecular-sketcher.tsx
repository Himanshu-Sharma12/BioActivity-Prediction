import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Paintbrush,
  Sparkles,
  RotateCcw,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Move,
  Eraser,
  Copy,
  Send,
  Zap,
  Atom,
  Loader2,
  XCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";

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

interface MolecularSketcherProps {
  initialSmiles?: string;
  onApplySmiles: (smiles: string, compoundName?: string) => void;
  onAnalyzeImmediately?: (smiles: string, compoundName?: string) => void;
  isAnalyzing?: boolean;
}

const COMMON_ELEMENTS = [
  { symbol: "C", name: "Carbon", color: "#1e293b", darkColor: "#f1f5f9" },
  { symbol: "N", name: "Nitrogen", color: "#2563eb", darkColor: "#60a5fa" },
  { symbol: "O", name: "Oxygen", color: "#dc2626", darkColor: "#f87171" },
  { symbol: "S", name: "Sulfur", color: "#d97706", darkColor: "#fbbf24" },
  { symbol: "P", name: "Phosphorus", color: "#ea580c", darkColor: "#fb923c" },
  { symbol: "F", name: "Fluorine", color: "#16a34a", darkColor: "#4ade80" },
  { symbol: "Cl", name: "Chlorine", color: "#059669", darkColor: "#34d399" },
  { symbol: "Br", name: "Bromine", color: "#b91c1c", darkColor: "#ef4444" },
  { symbol: "I", name: "Iodine", color: "#7c3aed", darkColor: "#a78bfa" },
];

const PRESET_RINGS = [
  { name: "Benzene", smiles: "c1ccccc1", desc: "6-membered aromatic" },
  { name: "Pyridine", smiles: "c1ccncc1", desc: "Aromatic nitrogen" },
  { name: "Cyclohexane", smiles: "C1CCCCC1", desc: "6-carbon saturated" },
  { name: "Cyclopentane", smiles: "C1CCCC1", desc: "5-carbon ring" },
  { name: "Furan", smiles: "c1ccoc1", desc: "5-ring with O" },
  { name: "Thiophene", smiles: "c1ccsc1", desc: "5-ring with S" },
  { name: "Indole", smiles: "c1ccc2[nH]ccc2c1", desc: "Bicyclic scaffold" },
  { name: "Pyrimidine", smiles: "c1cncnc1", desc: "1,3-Diazine scaffold" },
];

const FUNCTIONAL_GROUPS = [
  { name: "Hydroxyl (-OH)", symbol: "O", order: 1, desc: "Alcohol / Phenol" },
  { name: "Carbonyl (=O)", symbol: "O", order: 2, desc: "Ketone / Aldehyde" },
  { name: "Amine (-NH2)", symbol: "N", order: 1, desc: "Primary amine" },
  { name: "Carboxyl (-COOH)", symbol: "COOH", order: 1, desc: "Carboxylic acid" },
  { name: "Methyl (-CH3)", symbol: "C", order: 1, desc: "Alkyl group" },
  { name: "Fluoro (-F)", symbol: "F", order: 1, desc: "Halogen / Bioisostere" },
  { name: "Chloro (-Cl)", symbol: "Cl", order: 1, desc: "Halogen" },
  { name: "Bromo (-Br)", symbol: "Br", order: 1, desc: "Halogen" },
  { name: "Nitro (-NO2)", symbol: "NO2", order: 1, desc: "Nitro group" },
  { name: "Methoxy (-OCH3)", symbol: "OCH3", order: 1, desc: "Ether group" },
];

export default function MolecularSketcher({
  initialSmiles = "c1ccccc1O",
  onApplySmiles,
  onAnalyzeImmediately,
  isAnalyzing = false,
}: MolecularSketcherProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || theme === "dark";
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Molecular state
  const [atoms, setAtoms] = useState<CanvasAtom[]>([]);
  const [bonds, setBonds] = useState<CanvasBond[]>([]);
  const [history, setHistory] = useState<{ atoms: CanvasAtom[]; bonds: CanvasBond[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Interaction tools & states
  const [activeTool, setActiveTool] = useState<"atom" | "bond" | "move" | "erase">("atom");
  const [selectedElement, setSelectedElement] = useState<string>("C");
  const [bondOrder, setBondOrder] = useState<number>(1);
  const [selectedAtomId, setSelectedAtomId] = useState<number | null>(null);
  const [hoverAtomId, setHoverAtomId] = useState<number | null>(null);

  // Dragging states
  const [draggingAtomId, setDraggingAtomId] = useState<number | null>(null);
  const [bondDragStartAtomId, setBondDragStartAtomId] = useState<number | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // SMILES and validation state
  const [currentSmiles, setCurrentSmiles] = useState<string>("");
  const [inputSmiles, setInputSmiles] = useState<string>("");
  const [compoundName, setCompoundName] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [graphMeta, setGraphMeta] = useState<{
    valid: boolean;
    canonicalSmiles?: string;
    molecularFormula?: string;
    descriptors?: any;
    error?: string;
  }>({ valid: true });

  // AI Copilot state
  const [copilotPrompt, setCopilotPrompt] = useState<string>("");
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [copilotSuggestion, setCopilotSuggestion] = useState<{
    smiles: string;
    name?: string;
    rationale?: string;
  } | null>(null);

  // Ref tracking to prevent accidental reloads or infinite loops
  const initialLoadedRef = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef<{ atoms: CanvasAtom[]; bonds: CanvasBond[] } | null>(null);

  // Convert client mouse coordinates to SVG viewBox coordinate space (500x380)
  const getCanvasCoords = useCallback((e: React.MouseEvent<any> | MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 250, y: 190 };
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.round(Math.max(15, Math.min(485, transformed.x))),
        y: Math.round(Math.max(15, Math.min(365, transformed.y))),
      };
    }
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(Math.max(15, Math.min(485, ((e.clientX - rect.left) / (rect.width || 500)) * 500))),
      y: Math.round(Math.max(15, Math.min(365, ((e.clientY - rect.top) / (rect.height || 380)) * 380))),
    };
  }, []);

  // Push state to undo/redo history
  const pushState = useCallback((newAtoms: CanvasAtom[], newBonds: CanvasBond[]) => {
    setHistory((prev) => {
      const nextIndex = historyIndex + 1;
      const updated = prev.slice(0, nextIndex);
      return [...updated, { atoms: newAtoms, bonds: newBonds }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Synchronize canvas graph to canonical SMILES via backend RDKit
  const syncCanvasToSmiles = useCallback(async (currentAtoms: CanvasAtom[], currentBonds: CanvasBond[]) => {
    if (currentAtoms.length === 0) {
      setCurrentSmiles("");
      setInputSmiles("");
      setGraphMeta({ valid: true });
      return;
    }

    if (isSyncingRef.current) {
      pendingSyncRef.current = { atoms: currentAtoms, bonds: currentBonds };
      return;
    }
    isSyncingRef.current = true;

    try {
      // Scale canvas coordinates to standard Ångström units
      const scaledAtoms = currentAtoms.map((a) => ({
        ...a,
        x: (a.x - 250) / 40,
        y: -(a.y - 190) / 40,
      }));

      const res = await fetch("/api/compounds/graph-to-smiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atoms: scaledAtoms, bonds: currentBonds }),
      });
      const data = await res.json();

      if (data.valid && data.canonicalSmiles) {
        setCurrentSmiles(data.canonicalSmiles);
        setInputSmiles(data.canonicalSmiles);
        setGraphMeta({
          valid: true,
          canonicalSmiles: data.canonicalSmiles,
          descriptors: data.descriptors,
        });
      } else {
        setGraphMeta({
          valid: false,
          error: data.message || "Unbalanced chemical graph (check valencies)",
        });
      }
    } catch (err: any) {
      setGraphMeta({ valid: false, error: err.message });
    } finally {
      isSyncingRef.current = false;
      if (pendingSyncRef.current) {
        const next = pendingSyncRef.current;
        pendingSyncRef.current = null;
        syncCanvasToSmiles(next.atoms, next.bonds);
      }
    }
  }, []);

  // Load a SMILES string onto canvas
  const loadSmilesOntoCanvas = useCallback(async (smilesToLoad: string, name?: string) => {
    if (!smilesToLoad.trim()) return;
    setIsValidating(true);

    try {
      const res = await fetch("/api/compounds/smiles-to-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smiles: smilesToLoad.trim() }),
      });
      const data = await res.json();

      if (data.valid && Array.isArray(data.atoms) && data.atoms.length > 0) {
        // Compute bounding box and normalize into center of SVG (500x380)
        const xs = data.atoms.map((a: CanvasAtom) => a.x);
        const ys = data.atoms.map((a: CanvasAtom) => a.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const maxRange = Math.max(rangeX, rangeY);
        const scale = 250 / maxRange;

        const centerX = 250;
        const centerY = 190;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const normalizedAtoms = data.atoms.map((a: CanvasAtom, idx: number) => ({
          id: idx,
          x: Math.round(centerX + (a.x - midX) * scale),
          y: Math.round(centerY - (a.y - midY) * scale),
          element: a.element || "C",
        }));

        const cleanBonds = (data.bonds || []).map((b: CanvasBond) => ({
          from: b.from,
          to: b.to,
          order: b.order || 1,
        }));

        setAtoms(normalizedAtoms);
        setBonds(cleanBonds);
        setSelectedAtomId(null);
        pushState(normalizedAtoms, cleanBonds);

        setCurrentSmiles(data.canonicalSmiles || smilesToLoad);
        setInputSmiles(data.canonicalSmiles || smilesToLoad);
        if (name) setCompoundName(name);

        setGraphMeta({
          valid: true,
          canonicalSmiles: data.canonicalSmiles,
          descriptors: data.descriptors,
        });

        toast({
          title: "Structure Loaded to Canvas",
          description: name || data.canonicalSmiles || smilesToLoad,
        });
      } else {
        setGraphMeta({ valid: false, error: data.message || "Invalid SMILES structure" });
      }
    } catch (err: any) {
      setGraphMeta({ valid: false, error: err.message });
    } finally {
      setIsValidating(false);
    }
  }, [pushState, toast]);

  // Initial mount load
  useEffect(() => {
    if (initialSmiles && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
      loadSmilesOntoCanvas(initialSmiles);
    }
  }, [initialSmiles, loadSmilesOntoCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        setSelectedAtomId(null);
        setBondDragStartAtomId(null);
        setCursorPos(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedAtomId !== null) {
          e.preventDefault();
          const newAtoms = atoms.filter((a) => a.id !== selectedAtomId);
          const newBonds = bonds.filter((b) => b.from !== selectedAtomId && b.to !== selectedAtomId);
          setAtoms(newAtoms);
          setBonds(newBonds);
          setSelectedAtomId(null);
          pushState(newAtoms, newBonds);
          syncCanvasToSmiles(newAtoms, newBonds);
        }
      } else if (e.key === "1") {
        setBondOrder(1);
      } else if (e.key === "2") {
        setBondOrder(2);
      } else if (e.key === "3") {
        setBondOrder(3);
      } else if (e.key.toLowerCase() === "c") {
        setSelectedElement("C");
      } else if (e.key.toLowerCase() === "n") {
        setSelectedElement("N");
      } else if (e.key.toLowerCase() === "o") {
        setSelectedElement("O");
      } else if (e.key.toLowerCase() === "s") {
        setSelectedElement("S");
      } else if (e.key.toLowerCase() === "f") {
        setSelectedElement("F");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAtomId, atoms, bonds, pushState, syncCanvasToSmiles]);

  // 1. Canvas Background Click: place atom or extend chain
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== "atom") return;
    const { x, y } = getCanvasCoords(e);

    const newId = atoms.length > 0 ? Math.max(...atoms.map((a) => a.id)) + 1 : 0;
    const newAtom: CanvasAtom = {
      id: newId,
      x,
      y,
      element: selectedElement,
    };

    const newAtoms = [...atoms, newAtom];
    let newBonds = [...bonds];

    // If an atom was previously selected, auto-connect to extend chain
    if (selectedAtomId !== null) {
      newBonds.push({ from: selectedAtomId, to: newId, order: bondOrder });
      setBonds(newBonds);
      setSelectedAtomId(newId);
    } else {
      setSelectedAtomId(newId);
    }

    setAtoms(newAtoms);
    pushState(newAtoms, newBonds);
    syncCanvasToSmiles(newAtoms, newBonds);
  };

  // 2. Atom Click Handler
  const handleAtomClick = (e: React.MouseEvent, atom: CanvasAtom) => {
    e.stopPropagation();

    // Eraser Tool
    if (activeTool === "erase") {
      const newAtoms = atoms.filter((a) => a.id !== atom.id);
      const newBonds = bonds.filter((b) => b.from !== atom.id && b.to !== atom.id);
      setAtoms(newAtoms);
      setBonds(newBonds);
      setSelectedAtomId(null);
      pushState(newAtoms, newBonds);
      syncCanvasToSmiles(newAtoms, newBonds);
      return;
    }

    // Atom Placement Tool
    if (activeTool === "atom") {
      if (selectedAtomId === null) {
        setSelectedAtomId(atom.id);
      } else if (selectedAtomId === atom.id) {
        // Toggle element if clicking the already selected atom
        if (atom.element !== selectedElement) {
          const newAtoms = atoms.map((a) => (a.id === atom.id ? { ...a, element: selectedElement } : a));
          setAtoms(newAtoms);
          pushState(newAtoms, bonds);
          syncCanvasToSmiles(newAtoms, bonds);
        } else {
          // Deselect
          setSelectedAtomId(null);
        }
      } else {
        // Connect selected atom to this clicked atom
        const existingIdx = bonds.findIndex(
          (b) =>
            (b.from === selectedAtomId && b.to === atom.id) ||
            (b.from === atom.id && b.to === selectedAtomId)
        );

        let newBonds: CanvasBond[];
        if (existingIdx !== -1) {
          // Cycle bond order: 1 -> 2 -> 3 -> 1
          newBonds = [...bonds];
          newBonds[existingIdx].order = (newBonds[existingIdx].order % 3) + 1;
        } else {
          newBonds = [...bonds, { from: selectedAtomId, to: atom.id, order: bondOrder }];
        }
        setBonds(newBonds);
        setSelectedAtomId(atom.id);
        pushState(atoms, newBonds);
        syncCanvasToSmiles(atoms, newBonds);
      }
      return;
    }

    // Bond Tool
    if (activeTool === "bond") {
      if (selectedAtomId === null) {
        setSelectedAtomId(atom.id);
      } else if (selectedAtomId !== atom.id) {
        const existingIdx = bonds.findIndex(
          (b) =>
            (b.from === selectedAtomId && b.to === atom.id) ||
            (b.from === atom.id && b.to === selectedAtomId)
        );

        let newBonds: CanvasBond[];
        if (existingIdx !== -1) {
          newBonds = [...bonds];
          newBonds[existingIdx].order = (newBonds[existingIdx].order % 3) + 1;
        } else {
          newBonds = [...bonds, { from: selectedAtomId, to: atom.id, order: bondOrder }];
        }
        setBonds(newBonds);
        setSelectedAtomId(atom.id);
        pushState(atoms, newBonds);
        syncCanvasToSmiles(atoms, newBonds);
      }
      return;
    }

    // Move / Select Tool
    if (activeTool === "move") {
      setSelectedAtomId(atom.id === selectedAtomId ? null : atom.id);
    }
  };

  // 3. Atom MouseDown: Initiate Drag-to-Move or Drag-to-Bond
  const handleAtomMouseDown = (e: React.MouseEvent, atom: CanvasAtom) => {
    e.stopPropagation();
    if (activeTool === "move") {
      setDraggingAtomId(atom.id);
      setSelectedAtomId(atom.id);
    } else if (activeTool === "bond" || activeTool === "atom") {
      // Start rubber-band bond drag
      setBondDragStartAtomId(atom.id);
      const coords = getCanvasCoords(e);
      setCursorPos(coords);
    }
  };

  // 4. Mouse Move: Update Atom Dragging or Bond Rubber-Banding
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getCanvasCoords(e);
    setCursorPos(coords);

    // Dragging an existing atom
    if (draggingAtomId !== null) {
      setAtoms((prev) =>
        prev.map((a) => (a.id === draggingAtomId ? { ...a, x: coords.x, y: coords.y } : a))
      );
    }
  };

  // 5. Mouse Up: Complete Dragging or Rubber-Band Bond Placement
  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    // Finish moving atom
    if (draggingAtomId !== null) {
      setDraggingAtomId(null);
      pushState(atoms, bonds);
      syncCanvasToSmiles(atoms, bonds);
      return;
    }

    // Finish rubber-band bond drag
    if (bondDragStartAtomId !== null) {
      const coords = getCanvasCoords(e);
      const startAtom = atoms.find((a) => a.id === bondDragStartAtomId);

      if (startAtom) {
        // If released over another atom
        if (hoverAtomId !== null && hoverAtomId !== bondDragStartAtomId) {
          const existingIdx = bonds.findIndex(
            (b) =>
              (b.from === bondDragStartAtomId && b.to === hoverAtomId) ||
              (b.from === hoverAtomId && b.to === bondDragStartAtomId)
          );

          let newBonds: CanvasBond[];
          if (existingIdx !== -1) {
            newBonds = [...bonds];
            newBonds[existingIdx].order = (newBonds[existingIdx].order % 3) + 1;
          } else {
            newBonds = [...bonds, { from: bondDragStartAtomId, to: hoverAtomId, order: bondOrder }];
          }
          setBonds(newBonds);
          setSelectedAtomId(hoverAtomId);
          pushState(atoms, newBonds);
          syncCanvasToSmiles(atoms, newBonds);
        } else {
          // If dragged into empty space (minimum 25px displacement): create new atom & bond!
          const dx = coords.x - startAtom.x;
          const dy = coords.y - startAtom.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 25) {
            const newId = atoms.length > 0 ? Math.max(...atoms.map((a) => a.id)) + 1 : 0;
            const newAtom: CanvasAtom = {
              id: newId,
              x: coords.x,
              y: coords.y,
              element: selectedElement,
            };
            const newAtoms = [...atoms, newAtom];
            const newBonds = [...bonds, { from: bondDragStartAtomId, to: newId, order: bondOrder }];

            setAtoms(newAtoms);
            setBonds(newBonds);
            setSelectedAtomId(newId);
            pushState(newAtoms, newBonds);
            syncCanvasToSmiles(newAtoms, newBonds);
          }
        }
      }

      setBondDragStartAtomId(null);
    }
  };

  // 6. Bond Click: Cycle Multiplicity or Erase
  const handleBondClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (activeTool === "erase") {
      const newBonds = bonds.filter((_, i) => i !== index);
      setBonds(newBonds);
      pushState(atoms, newBonds);
      syncCanvasToSmiles(atoms, newBonds);
      return;
    }

    const newBonds = [...bonds];
    newBonds[index].order = (newBonds[index].order % 3) + 1;
    setBonds(newBonds);
    pushState(atoms, newBonds);
    syncCanvasToSmiles(atoms, newBonds);
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setAtoms(prev.atoms);
      setBonds(prev.bonds);
      setHistoryIndex(historyIndex - 1);
      setSelectedAtomId(null);
      syncCanvasToSmiles(prev.atoms, prev.bonds);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setAtoms(next.atoms);
      setBonds(next.bonds);
      setHistoryIndex(historyIndex + 1);
      setSelectedAtomId(null);
      syncCanvasToSmiles(next.atoms, next.bonds);
    }
  };

  const handleClear = () => {
    setAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setBondDragStartAtomId(null);
    setCurrentSmiles("");
    setInputSmiles("");
    setCompoundName("");
    pushState([], []);
    setGraphMeta({ valid: true });
    toast({ title: "Canvas Cleared", description: "Ready to sketch new molecule." });
  };

  // Smart Functional Group Snapping
  const handleAttachFunctionalGroup = (group: typeof FUNCTIONAL_GROUPS[0]) => {
    // If canvas is empty, load scaffold directly
    if (atoms.length === 0) {
      const scaffoldSmiles = group.symbol === "COOH" ? "C(=O)O" : group.symbol === "NO2" ? "[N+](=O)[O-]" : group.symbol;
      loadSmilesOntoCanvas(scaffoldSmiles, group.name);
      return;
    }

    // Target atom is the selected atom or the last placed atom
    const targetId = selectedAtomId !== null ? selectedAtomId : atoms[atoms.length - 1].id;
    const targetAtom = atoms.find((a) => a.id === targetId);

    if (!targetAtom) {
      toast({
        title: "Select an Atom First",
        description: "Click an atom on the canvas to attach this functional group.",
      });
      return;
    }

    // Determine an open angle around targetAtom away from neighboring bonds
    const neighborBonds = bonds.filter((b) => b.from === targetId || b.to === targetId);
    let openAngle = Math.PI / 4; // Default 45 degrees

    if (neighborBonds.length > 0) {
      const neighborAngles = neighborBonds.map((b) => {
        const otherId = b.from === targetId ? b.to : b.from;
        const other = atoms.find((a) => a.id === otherId);
        if (!other) return 0;
        return Math.atan2(other.y - targetAtom.y, other.x - targetAtom.x);
      });

      // Find average angle and point in the opposite direction
      const avgX = neighborAngles.reduce((sum, ang) => sum + Math.cos(ang), 0) / neighborAngles.length;
      const avgY = neighborAngles.reduce((sum, ang) => sum + Math.sin(ang), 0) / neighborAngles.length;
      openAngle = Math.atan2(-avgY, -avgX);
    }

    const dist = 48;
    const newX = Math.round(Math.max(25, Math.min(475, targetAtom.x + Math.cos(openAngle) * dist)));
    const newY = Math.round(Math.max(25, Math.min(355, targetAtom.y + Math.sin(openAngle) * dist)));

    let newAtoms = [...atoms];
    let newBonds = [...bonds];
    const baseId = atoms.length > 0 ? Math.max(...atoms.map((a) => a.id)) + 1 : 0;

    if (group.symbol === "COOH") {
      // Carbonyl carbon
      const cAtom: CanvasAtom = { id: baseId, x: newX, y: newY, element: "C" };
      // Carbonyl oxygen
      const ox1: CanvasAtom = {
        id: baseId + 1,
        x: Math.round(newX + Math.cos(openAngle - 0.7) * 36),
        y: Math.round(newY + Math.sin(openAngle - 0.7) * 36),
        element: "O",
      };
      // Hydroxyl oxygen
      const ox2: CanvasAtom = {
        id: baseId + 2,
        x: Math.round(newX + Math.cos(openAngle + 0.7) * 36),
        y: Math.round(newY + Math.sin(openAngle + 0.7) * 36),
        element: "O",
      };
      newAtoms.push(cAtom, ox1, ox2);
      newBonds.push(
        { from: targetId, to: baseId, order: 1 },
        { from: baseId, to: baseId + 1, order: 2 },
        { from: baseId, to: baseId + 2, order: 1 }
      );
      setSelectedAtomId(baseId);
    } else if (group.symbol === "NO2") {
      const nAtom: CanvasAtom = { id: baseId, x: newX, y: newY, element: "N" };
      const o1: CanvasAtom = {
        id: baseId + 1,
        x: Math.round(newX + Math.cos(openAngle - 0.6) * 34),
        y: Math.round(newY + Math.sin(openAngle - 0.6) * 34),
        element: "O",
      };
      const o2: CanvasAtom = {
        id: baseId + 2,
        x: Math.round(newX + Math.cos(openAngle + 0.6) * 34),
        y: Math.round(newY + Math.sin(openAngle + 0.6) * 34),
        element: "O",
      };
      newAtoms.push(nAtom, o1, o2);
      newBonds.push(
        { from: targetId, to: baseId, order: 1 },
        { from: baseId, to: baseId + 1, order: 2 },
        { from: baseId, to: baseId + 2, order: 1 }
      );
      setSelectedAtomId(baseId);
    } else if (group.symbol === "OCH3") {
      const oAtom: CanvasAtom = { id: baseId, x: newX, y: newY, element: "O" };
      const cAtom: CanvasAtom = {
        id: baseId + 1,
        x: Math.round(newX + Math.cos(openAngle) * 40),
        y: Math.round(newY + Math.sin(openAngle) * 40),
        element: "C",
      };
      newAtoms.push(oAtom, cAtom);
      newBonds.push({ from: targetId, to: baseId, order: 1 }, { from: baseId, to: baseId + 1, order: 1 });
      setSelectedAtomId(baseId + 1);
    } else {
      // Single atom group (O, N, F, Cl, Br, C)
      const singleAtom: CanvasAtom = {
        id: baseId,
        x: newX,
        y: newY,
        element: group.symbol,
      };
      newAtoms.push(singleAtom);
      newBonds.push({ from: targetId, to: baseId, order: group.order || 1 });
      setSelectedAtomId(baseId);
    }

    setAtoms(newAtoms);
    setBonds(newBonds);
    pushState(newAtoms, newBonds);
    syncCanvasToSmiles(newAtoms, newBonds);

    toast({
      title: "Attached Functional Group",
      description: `Added ${group.name} to atom #${targetId}`,
    });
  };

  // AI Copilot Query
  const handleCopilotSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!copilotPrompt.trim()) return;

    setIsCopilotLoading(true);
    setCopilotSuggestion(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: copilotPrompt.trim(),
          actionRequest: "draw_smiles",
          context: {
            smiles: currentSmiles,
            compoundName: compoundName,
          },
        }),
      });

      const data = await res.json();
      if (data.suggestedSmiles) {
        setCopilotSuggestion({
          smiles: data.suggestedSmiles,
          name: data.suggestedCompoundName || "AI Designed Molecule",
          rationale: data.chemicalRationale || data.reply,
        });
      } else {
        toast({
          title: "AI Chemist Response",
          description: data.reply.substring(0, 140) + "...",
        });
      }
    } catch (err: any) {
      toast({
        title: "Copilot Error",
        description: err.message || "Failed to communicate with AI chemist.",
        variant: "destructive",
      });
    } finally {
      setIsCopilotLoading(false);
    }
  };

  const handleApplyCopilotSuggestion = () => {
    if (!copilotSuggestion) return;
    loadSmilesOntoCanvas(copilotSuggestion.smiles, copilotSuggestion.name);
    setCopilotSuggestion(null);
    setCopilotPrompt("");
  };

  const rubberBandStartAtom = bondDragStartAtomId !== null ? atoms.find((a) => a.id === bondDragStartAtomId) : null;
  const selectedAtom = selectedAtomId !== null ? atoms.find((a) => a.id === selectedAtomId) : null;

  return (
    <div className="space-y-4 select-none">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Interactive 2D Molecular Sketcher & SMILES Studio
              <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Live RDKit WASM
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Sketch structures atom-by-atom, drag bonds interactively, snap rings, or consult the AI Chemist Copilot.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/draw?smiles=${encodeURIComponent(currentSmiles || '')}`, '_blank')}
            className="text-xs h-8 text-muted-foreground hover:text-foreground gap-1 border border-border/60 hover:bg-muted"
            title="Open Drawing Studio in full dedicated browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tab</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApplySmiles(currentSmiles, compoundName)}
            disabled={!currentSmiles || !graphMeta.valid}
            className="text-xs h-8 border-border hover:bg-muted"
          >
            Apply to Input
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onApplySmiles(currentSmiles, compoundName);
              if (onAnalyzeImmediately) onAnalyzeImmediately(currentSmiles, compoundName);
            }}
            disabled={!currentSmiles || !graphMeta.valid || isAnalyzing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 shadow-sm font-medium"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 mr-1.5" />
            )}
            Analyze Molecule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Toolbar & Chemical Palette */}
        <div className="lg:col-span-3 space-y-3">
          {/* Tool Modes */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-3 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Drawing Tools
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant={activeTool === "atom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTool("atom")}
                  className="h-8 text-xs justify-start px-2.5"
                >
                  <Atom className="w-3.5 h-3.5 mr-1.5" />
                  Place Atom
                </Button>
                <Button
                  type="button"
                  variant={activeTool === "bond" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTool("bond")}
                  className="h-8 text-xs justify-start px-2.5"
                >
                  <span className="font-bold mr-1.5">—</span>
                  Add Bond
                </Button>
                <Button
                  type="button"
                  variant={activeTool === "move" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTool("move")}
                  className="h-8 text-xs justify-start px-2.5"
                >
                  <Move className="w-3.5 h-3.5 mr-1.5" />
                  Move Atom
                </Button>
                <Button
                  type="button"
                  variant={activeTool === "erase" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setActiveTool("erase")}
                  className="h-8 text-xs justify-start px-2.5"
                >
                  <Eraser className="w-3.5 h-3.5 mr-1.5" />
                  Eraser
                </Button>
              </div>

              {/* Bond Multiplicity Selector */}
              <div className="pt-2 border-t border-border/60">
                <span className="text-[10px] font-semibold text-muted-foreground block mb-1">
                  Bond Multiplicity (1, 2, 3):
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 3].map((order) => (
                    <button
                      key={order}
                      type="button"
                      onClick={() => setBondOrder(order)}
                      className={`py-1 text-xs rounded border transition-all ${
                        bondOrder === order
                          ? "bg-primary text-primary-foreground font-bold border-primary shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground border-border"
                      }`}
                    >
                      {order === 1 ? "Single (—)" : order === 2 ? "Double (=)" : "Triple (≡)"}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Atom Element Palette */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Element Palette
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {COMMON_ELEMENTS.map((el) => {
                  const isSelected = selectedElement === el.symbol;
                  return (
                    <button
                      key={el.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedElement(el.symbol);
                        if (activeTool !== "atom") setActiveTool("atom");
                        // If an atom is currently selected, mutate its element
                        if (selectedAtomId !== null) {
                          const newAtoms = atoms.map((a) =>
                            a.id === selectedAtomId ? { ...a, element: el.symbol } : a
                          );
                          setAtoms(newAtoms);
                          pushState(newAtoms, bonds);
                          syncCanvasToSmiles(newAtoms, bonds);
                        }
                      }}
                      className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border hover:bg-muted/50 bg-background"
                      }`}
                    >
                      <span className="text-base font-extrabold" style={{ color: isDark ? (el.darkColor || el.color) : el.color }}>
                        {el.symbol}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-medium truncate">
                        {el.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Ring & Scaffold Stamps */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Ring & Scaffold Stamps
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_RINGS.map((ring) => (
                  <button
                    key={ring.name}
                    type="button"
                    onClick={() => loadSmilesOntoCanvas(ring.smiles, ring.name)}
                    className="p-1.5 border border-border rounded-lg text-left hover:border-primary/60 hover:bg-accent/40 bg-background transition-all"
                  >
                    <div className="text-xs font-semibold text-foreground truncate">{ring.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{ring.smiles}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Drawing Canvas & SMILES Sync */}
        <div className="lg:col-span-6 space-y-3">
          <Card className="border-border bg-card shadow-sm relative overflow-hidden">
            <CardContent className="p-3 space-y-2.5">
              {/* Canvas Header & Interactive Guide */}
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Canvas View</span>
                  <Badge variant="outline" className="text-[10px] font-normal bg-muted">
                    {atoms.length} Atoms · {bonds.length} Bonds
                  </Badge>
                  {selectedAtom && (
                    <Badge variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary flex items-center gap-1">
                      <span>Selected: {selectedAtom.element} (#{selectedAtom.id})</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAtomId(null);
                        }}
                        className="hover:text-destructive ml-0.5"
                        title="Deselect"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="h-7 w-7 p-0"
                    title="Undo (Ctrl+Z)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="h-7 w-7 p-0"
                    title="Redo (Ctrl+Y)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={atoms.length === 0}
                    className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10"
                    title="Clear Canvas"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Status Indicator Bar */}
              <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1 bg-muted/30 py-1 rounded">
                <span>
                  {activeTool === "atom" && (
                    selectedAtomId !== null
                      ? `🔗 Chaining from ${selectedAtom?.element || 'atom'}. Click empty space to extend chain, click another atom to bond, or Esc to deselect.`
                      : `✍️ Click canvas to place a ${selectedElement} atom, or click & drag to connect bonds.`
                  )}
                  {activeTool === "bond" && "🔗 Click & drag between atoms to create bonds. Click a bond to cycle order."}
                  {activeTool === "move" && "✋ Click & drag atoms to reposition them freely."}
                  {activeTool === "erase" && "🧹 Click any atom or bond to erase it."}
                </span>
                <span className="hidden sm:inline text-[10px] text-muted-foreground/70">
                  Shortcuts: 1, 2, 3 · C, N, O, S, F · Esc
                </span>
              </div>

              {/* The Interactive SVG Canvas */}
              <div className="relative border border-border rounded-xl bg-white dark:bg-slate-950 overflow-hidden shadow-inner">
                {/* Engineering Grid Pattern */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={isDark ? "#475569" : "#94a3b8"} strokeWidth="0.5" strokeOpacity={isDark ? 0.5 : 0.3} />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                </svg>

                <svg
                  ref={svgRef}
                  viewBox="0 0 500 380"
                  className="w-full h-[380px] cursor-crosshair relative z-10 select-none"
                  onClick={handleCanvasClick}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {/* Empty state guidance */}
                  {atoms.length === 0 && (
                    <text
                      x="250"
                      y="190"
                      textAnchor="middle"
                      fill={isDark ? "#64748b" : "#94a3b8"}
                      fontSize="14"
                      fontWeight="500"
                      fontFamily="sans-serif"
                    >
                      Click anywhere to place atoms, drag to bond, or pick a ring scaffold
                    </text>
                  )}

                  {/* Draw Bonds */}
                  {bonds.map((bond, idx) => {
                    const fromAtom = atoms.find((a) => a.id === bond.from);
                    const toAtom = atoms.find((a) => a.id === bond.to);
                    if (!fromAtom || !toAtom) return null;

                    const dx = toAtom.x - fromAtom.x;
                    const dy = toAtom.y - fromAtom.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const nx = -dy / len;
                    const ny = dx / len;
                    const bondStroke = isDark ? "#cbd5e1" : "#334155";

                    return (
                      <g
                        key={`bond-${idx}`}
                        onClick={(e) => handleBondClick(e, idx)}
                        className="cursor-pointer hover:opacity-75 transition-opacity"
                      >
                        {/* Invisible fat hit area for easy clicking */}
                        <line
                          x1={fromAtom.x}
                          y1={fromAtom.y}
                          x2={toAtom.x}
                          y2={toAtom.y}
                          stroke="transparent"
                          strokeWidth="14"
                        />

                        {/* Single Bond */}
                        {bond.order === 1 && (
                          <line
                            x1={fromAtom.x}
                            y1={fromAtom.y}
                            x2={toAtom.x}
                            y2={toAtom.y}
                            stroke={bondStroke}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />
                        )}

                        {/* Double Bond */}
                        {bond.order === 2 && (
                          <>
                            <line
                              x1={fromAtom.x + nx * 3.5}
                              y1={fromAtom.y + ny * 3.5}
                              x2={toAtom.x + nx * 3.5}
                              y2={toAtom.y + ny * 3.5}
                              stroke={bondStroke}
                              strokeWidth="2.8"
                              strokeLinecap="round"
                            />
                            <line
                              x1={fromAtom.x - nx * 3.5}
                              y1={fromAtom.y - ny * 3.5}
                              x2={toAtom.x - nx * 3.5}
                              y2={toAtom.y - ny * 3.5}
                              stroke={bondStroke}
                              strokeWidth="2.8"
                              strokeLinecap="round"
                            />
                          </>
                        )}

                        {/* Triple Bond */}
                        {bond.order === 3 && (
                          <>
                            <line
                              x1={fromAtom.x}
                              y1={fromAtom.y}
                              x2={toAtom.x}
                              y2={toAtom.y}
                              stroke={bondStroke}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                            />
                            <line
                              x1={fromAtom.x + nx * 5}
                              y1={fromAtom.y + ny * 5}
                              x2={toAtom.x + nx * 5}
                              y2={toAtom.y + ny * 5}
                              stroke={bondStroke}
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                            <line
                              x1={fromAtom.x - nx * 5}
                              y1={fromAtom.y - ny * 5}
                              x2={toAtom.x - nx * 5}
                              y2={toAtom.y - ny * 5}
                              stroke={bondStroke}
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Rubber-Band Preview Line when dragging a bond */}
                  {rubberBandStartAtom && cursorPos && (
                    <line
                      x1={rubberBandStartAtom.x}
                      y1={rubberBandStartAtom.y}
                      x2={cursorPos.x}
                      y2={cursorPos.y}
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeDasharray="4,3"
                      strokeLinecap="round"
                      className="pointer-events-none animate-pulse"
                    />
                  )}

                  {/* Draw Atoms */}
                  {atoms.map((atom) => {
                    const isSelected = selectedAtomId === atom.id;
                    const isHovered = hoverAtomId === atom.id;
                    const elementDef = COMMON_ELEMENTS.find((el) => el.symbol === atom.element);
                    const atomColor = elementDef 
                      ? (isDark ? (elementDef.darkColor || elementDef.color) : elementDef.color) 
                      : (isDark ? "#f1f5f9" : "#1e293b");

                    return (
                      <g
                        key={`atom-${atom.id}`}
                        onClick={(e) => handleAtomClick(e, atom)}
                        onMouseDown={(e) => handleAtomMouseDown(e, atom)}
                        onMouseEnter={() => setHoverAtomId(atom.id)}
                        onMouseLeave={() => setHoverAtomId(null)}
                        className="cursor-pointer"
                      >
                        {/* Selected / Hover Halo */}
                        {(isSelected || isHovered) && (
                          <circle
                            cx={atom.x}
                            cy={atom.y}
                            r="20"
                            fill="none"
                            stroke={isSelected ? "#3b82f6" : (isDark ? "#64748b" : "#94a3b8")}
                            strokeWidth={isSelected ? "2.5" : "1.5"}
                            strokeDasharray={isSelected ? "4,2" : undefined}
                          />
                        )}

                        {/* Atom circle disc */}
                        <circle
                          cx={atom.x}
                          cy={atom.y}
                          r="14.5"
                          fill={isDark ? "#0f172a" : "#ffffff"}
                          stroke={atomColor}
                          strokeWidth="2.2"
                        />

                        {/* Atom Symbol Text */}
                        <text
                          x={atom.x}
                          y={atom.y + 4.5}
                          textAnchor="middle"
                          fill={atomColor}
                          fontSize="13"
                          fontWeight="bold"
                          fontFamily="sans-serif"
                        >
                          {atom.element}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Live SMILES Sync Box */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {graphMeta.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    Live Canonical SMILES:
                  </span>
                  {graphMeta.descriptors?.molecularWeight && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      MW: {graphMeta.descriptors.molecularWeight} g/mol · Atoms: {graphMeta.descriptors.atomCount || atoms.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={inputSmiles}
                    onChange={(e) => setInputSmiles(e.target.value)}
                    placeholder="Type or paste any SMILES notation..."
                    className="font-mono text-xs bg-background h-9 border-border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadSmilesOntoCanvas(inputSmiles)}
                    disabled={!inputSmiles.trim() || isValidating}
                    className="h-9 px-3 text-xs shrink-0"
                  >
                    {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Load"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(currentSmiles);
                      toast({ title: "Copied SMILES to clipboard", description: currentSmiles });
                    }}
                    disabled={!currentSmiles}
                    className="h-9 w-9 shrink-0"
                    title="Copy SMILES"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {!graphMeta.valid && graphMeta.error && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ {graphMeta.error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Functional Groups & AI Copilot */}
        <div className="lg:col-span-3 space-y-3">
          {/* AI Chemist Copilot Card */}
          <Card className="border-border bg-card shadow-sm border-primary/30">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Chemist Copilot
                </div>
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Gemini Flash
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe a modification or ask the AI to design a molecule:
              </p>

              {/* Prompt Suggestions */}
              <div className="space-y-1">
                {[
                  "Add a fluorine to para position",
                  "Convert to ester prodrug",
                  "Design an ibuprofen analog",
                  "Draw caffeine scaffold",
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setCopilotPrompt(sug);
                    }}
                    className="w-full text-left p-1.5 rounded text-[11px] bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors truncate border border-border/40"
                  >
                    ✨ {sug}
                  </button>
                ))}
              </div>

              {/* Copilot Input Form */}
              <form onSubmit={handleCopilotSubmit} className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    placeholder="e.g. Add -OH to aromatic ring..."
                    className="text-xs h-8 bg-background border-border"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!copilotPrompt.trim() || isCopilotLoading}
                    className="h-8 w-8 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isCopilotLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Copilot Suggestion Box */}
              {copilotSuggestion && (
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/30 space-y-2 animate-in fade-in">
                  <div className="text-xs font-bold text-primary flex items-center justify-between">
                    <span>{copilotSuggestion.name || "AI Generated Molecule"}</span>
                  </div>
                  <div className="p-1.5 bg-background rounded font-mono text-[10px] text-foreground break-all border border-border/60">
                    {copilotSuggestion.smiles}
                  </div>
                  {copilotSuggestion.rationale && (
                    <p className="text-[10px] text-muted-foreground line-clamp-3">
                      {copilotSuggestion.rationale}
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyCopilotSuggestion}
                    className="w-full text-xs h-7 bg-primary hover:bg-primary/90"
                  >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    Apply to Canvas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Functional Group Snapping */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Functional Groups
                </span>
                <span className="text-[10px] text-muted-foreground/80">Click to snap</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {FUNCTIONAL_GROUPS.map((fg) => (
                  <button
                    key={fg.name}
                    type="button"
                    onClick={() => handleAttachFunctionalGroup(fg)}
                    className="p-1.5 border border-border rounded-lg text-left hover:border-primary/60 hover:bg-accent/40 bg-background transition-all"
                  >
                    <div className="text-xs font-semibold text-foreground truncate">{fg.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{fg.desc}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

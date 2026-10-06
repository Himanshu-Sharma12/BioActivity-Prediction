import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, Expand, X } from "lucide-react";
import MolecularDescriptors from "./molecular-descriptors";
import Molecular3DVisualization from "./molecular-3d-visualization";
import LipinskiRules from "./lipinski-rules";
import { AnalysisResult } from "@/types/molecular";
import { generateMolecularStructureDisplay, getMolecularName } from "@/lib/molecular-utils";

interface MolecularVisualizationProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

export default function MolecularVisualization({ analysis, isAnalyzing }: MolecularVisualizationProps) {
  const compound = analysis?.compound;
  const prediction = analysis?.prediction;
  const structureImages = analysis?.structure?.images;
  const image2d = structureImages?.image2d || null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-scale the structure to fit inside the frame
  useEffect(() => {
    if (image2d) {
      return;
    }

    function fit() {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;

      // Reset scale to measure natural size
      content.style.transform = `scale(1)`;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const rect = content.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      const factor = Math.min(cw / w, ch / h, 1);
      setScale(factor > 0 && isFinite(factor) ? factor : 1);
    }

    fit();
    const ro = new ResizeObserver(() => fit());
    if (containerRef.current) ro.observe(containerRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [compound?.smiles, prediction?.descriptors, isAnalyzing, image2d]);

  // Download structure as SVG/PNG
  const handleDownload = () => {
    if (!compound) return;

    if (image2d) {
      const link = document.createElement('a');
      link.href = image2d;
      link.download = `${compound.name || getMolecularName(compound.smiles)}_2d_structure.png`;
      link.click();
      return;
    }

    // Create a canvas to render the structure
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;

    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the molecular structure
    ctx.fillStyle = '#3b82f6'; // blue color
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const structureText = generateMolecularStructureDisplay(compound.smiles);
    const lines = structureText.split('\n');
    const lineHeight = 30;
    const startY = (canvas.height - lines.length * lineHeight) / 2;
    
    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });

    // Add compound info
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#666';
    const nameY = canvas.height - 100;
    ctx.fillText(compound.name || getMolecularName(compound.smiles), canvas.width / 2, nameY);
    ctx.font = '14px monospace';
    ctx.fillText(`SMILES: ${compound.smiles}`, canvas.width / 2, nameY + 25);
    
    if (prediction) {
      ctx.fillText(
        `Molecular Weight: ${prediction.descriptors.molecularWeight.toFixed(2)} g/mol`,
        canvas.width / 2,
        nameY + 50
      );
    }

    // Convert to blob and download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${compound.name || 'molecule'}_structure.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // Open fullscreen view
  const handleFullscreen = () => {
    setIsFullscreen(true);
  };

  // Render structure content
  const renderStructure = () => (
    <div className="text-center" data-testid="section-structure-display">
      {image2d ? (
        <div className="flex flex-col items-center space-y-3">
          <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200 inline-flex items-center justify-center">
            <img
              src={image2d}
              alt={`${compound?.name || getMolecularName(compound?.smiles || '')} 2D structure`}
              className="max-h-[200px] w-auto object-contain"
              data-testid="image-molecular-structure"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground" data-testid="text-compound-name">
              {compound?.name || getMolecularName(compound?.smiles || '')}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-smiles-notation">
              SMILES: {compound?.smiles}
            </p>
            {prediction && (
              <p className="text-xs text-muted-foreground" data-testid="text-molecular-weight">
                Molecular Weight: {prediction.descriptors.molecularWeight.toFixed(2)} g/mol
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={contentRef}
            className="molecule-structure text-primary mb-4 font-mono leading-tight"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              whiteSpace: 'pre',
              display: 'inline-block',
              fontSize: '20px',
              maxWidth: '100%',
            }}
            data-testid="text-molecular-structure"
          >
            {generateMolecularStructureDisplay(compound?.smiles || '')}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-compound-name">
            {compound?.name || getMolecularName(compound?.smiles || '')}
          </p>
          <p className="text-xs text-muted-foreground mt-1" data-testid="text-smiles-notation">
            SMILES: {compound?.smiles}
          </p>
          {prediction && (
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-molecular-weight">
              Molecular Weight: {prediction.descriptors.molecularWeight.toFixed(2)} g/mol
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Molecular Visualization */}
      <Card data-testid="card-molecular-visualization">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center justify-between">
            <span className="flex items-center">
              <Eye className="mr-2 text-primary" />
              2D Structure
            </span>
            <div className="flex space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={handleDownload}
                title="Download structure"
                data-testid="button-download-structure"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                onClick={handleFullscreen}
                title="View fullscreen"
                data-testid="button-fullscreen-structure"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </h2>
          
          <div 
            ref={containerRef}
            className="border border-border rounded-lg p-4 bg-muted/30 overflow-hidden" 
            style={{ height: '300px' }}
            data-testid="container-structure-display"
          >
            <div className="h-full w-full flex items-center justify-center">
              {isAnalyzing ? (
                <div className="text-center space-y-4">
                  <Skeleton className="h-16 w-32 mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                </div>
              ) : compound ? (
                renderStructure()
              ) : (
                <div className="text-center">
                  <div className="text-6xl text-muted-foreground mb-4">⚛</div>
                  <p className="text-sm text-muted-foreground">Enter a compound to view structure</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Eye className="mr-2 text-primary" />
                2D Structure - Full View
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDownload}
                title="Download structure"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center overflow-auto p-8">
            {compound && renderStructure()}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3D Molecular Visualization */}
      <Molecular3DVisualization 
        analysis={analysis}
        isAnalyzing={isAnalyzing}
      />

      {/* Molecular Descriptors */}
      <MolecularDescriptors 
        descriptors={prediction?.descriptors || null}
        isLoading={isAnalyzing}
      />

      {/* Lipinski's Rule of Five */}
      <LipinskiRules 
        rules={analysis?.lipinskiRules || null}
        isLoading={isAnalyzing}
      />
    </>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download, Expand } from "lucide-react";
import MolecularDescriptors from "./molecular-descriptors";
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
                data-testid="button-download-structure"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={!compound}
                data-testid="button-fullscreen-structure"
              >
                <Expand className="h-4 w-4" />
              </Button>
            </div>
          </h2>
          
          <div 
            className="border border-border rounded-lg p-4 bg-muted/30" 
            style={{ height: '300px' }}
            data-testid="container-structure-display"
          >
            <div className="h-full flex items-center justify-center">
              {isAnalyzing ? (
                <div className="text-center space-y-4">
                  <Skeleton className="h-16 w-32 mx-auto" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                  <Skeleton className="h-3 w-36 mx-auto" />
                </div>
              ) : compound ? (
                <div className="text-center">
                  <div className="molecule-structure text-4xl text-primary mb-4" data-testid="text-molecular-structure">
                    {generateMolecularStructureDisplay(compound.smiles)}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-compound-name">
                    {compound.name || getMolecularName(compound.smiles)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-smiles-notation">
                    SMILES: {compound.smiles}
                  </p>
                  {prediction && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-molecular-weight">
                      Molecular Weight: {prediction.descriptors.molecularWeight.toFixed(2)} g/mol
                    </p>
                  )}
                </div>
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

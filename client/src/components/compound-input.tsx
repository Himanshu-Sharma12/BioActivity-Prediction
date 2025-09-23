import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { validateSMILES } from "@/lib/molecular-utils";
import { AnalysisResult } from "@/types/molecular";
import { FlaskConical, Search, Eraser, Upload, History, Star, Database } from "lucide-react";

interface CompoundInputProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onAnalysisStart: () => void;
  onAnalysisError: () => void;
  isAnalyzing: boolean;
}

export default function CompoundInput({ 
  onAnalysisComplete, 
  onAnalysisStart, 
  onAnalysisError, 
  isAnalyzing 
}: CompoundInputProps) {
  const [activeTab, setActiveTab] = useState<'smiles' | 'draw' | 'upload'>('smiles');
  const [smiles, setSmiles] = useState('CCO');
  const [compoundName, setCompoundName] = useState('');
  const { toast } = useToast();

  // Fetch recent compounds
  const { data: recentCompounds } = useQuery({
    queryKey: ['/api/compounds/recent'],
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async ({ smiles, name }: { smiles: string; name?: string }) => {
      const response = await apiRequest('POST', '/api/compounds/analyze', { smiles, name });
      return response.json();
    },
    onSuccess: (data) => {
      onAnalysisComplete(data);
      queryClient.invalidateQueries({ queryKey: ['/api/compounds/recent'] });
      toast({
        title: "Analysis Complete",
        description: "Compound analysis and prediction completed successfully.",
      });
    },
    onError: (error) => {
      onAnalysisError();
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze compound",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!smiles.trim()) {
      toast({
        title: "Missing Input",
        description: "Please enter a SMILES notation",
        variant: "destructive",
      });
      return;
    }

    if (!validateSMILES(smiles.trim())) {
      toast({
        title: "Invalid SMILES",
        description: "Please enter a valid SMILES notation",
        variant: "destructive",
      });
      return;
    }

    onAnalysisStart();
    analysisMutation.mutate({ 
      smiles: smiles.trim(), 
      name: compoundName.trim() || undefined 
    });
  };

  const handleClear = () => {
    setSmiles('');
    setCompoundName('');
  };

  const handleRecentCompoundSelect = (compound: any) => {
    setSmiles(compound.smiles);
    setCompoundName(compound.name || '');
  };

  return (
    <>
      {/* Compound Input Card */}
      <Card data-testid="card-compound-input">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <FlaskConical className="mr-2 text-primary" />
            Compound Input
          </h2>
          
          {/* Input Method Tabs */}
          <div className="flex space-x-1 bg-muted rounded-lg p-1 mb-4" data-testid="tabs-input-method">
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'smiles' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('smiles')}
              data-testid="tab-smiles"
            >
              SMILES
            </button>
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'draw' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('draw')}
              data-testid="tab-draw"
            >
              Draw
            </button>
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'upload' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('upload')}
              data-testid="tab-upload"
            >
              Upload
            </button>
          </div>

          {/* SMILES Input */}
          {activeTab === 'smiles' && (
            <div className="space-y-4" data-testid="panel-smiles-input">
              <div>
                <Label htmlFor="smiles-input" className="block text-sm font-medium text-foreground mb-2">
                  SMILES Notation
                </Label>
                <Textarea
                  id="smiles-input"
                  value={smiles}
                  onChange={(e) => setSmiles(e.target.value)}
                  className="w-full resize-none"
                  rows={3}
                  placeholder="Enter SMILES notation (e.g., CCO, C1=CC=CC=C1)"
                  data-testid="input-smiles"
                />
              </div>
              <div>
                <Label htmlFor="compound-name" className="block text-sm font-medium text-foreground mb-2">
                  Compound Name (Optional)
                </Label>
                <Input
                  id="compound-name"
                  value={compoundName}
                  onChange={(e) => setCompoundName(e.target.value)}
                  placeholder="Enter compound name"
                  data-testid="input-compound-name"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  className="flex-1"
                  data-testid="button-analyze"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {isAnalyzing || analysisMutation.isPending ? 'Analyzing...' : 'Analyze'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  data-testid="button-clear"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Drawing Interface */}
          {activeTab === 'draw' && (
            <div className="space-y-4" data-testid="panel-draw-input">
              <div className="border border-border rounded-lg p-4 drawing-canvas bg-card" style={{ height: '200px' }}>
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <i className="fas fa-pencil-alt text-2xl mb-2"></i>
                    <p className="text-sm">Molecular Drawing Canvas</p>
                    <p className="text-xs mt-1">Drawing functionality coming soon</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['C', 'N', 'O', 'S', 'Ring', 'Bond'].map((tool) => (
                  <Button
                    key={tool}
                    variant="outline"
                    size="sm"
                    disabled
                    data-testid={`button-tool-${tool.toLowerCase()}`}
                  >
                    {tool}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Upload Interface */}
          {activeTab === 'upload' && (
            <div className="space-y-4" data-testid="panel-upload-input">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Upload functionality coming soon</p>
                <p className="text-xs text-muted-foreground mt-1">Will support .csv, .sdf formats</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Processing Card */}
      <Card data-testid="card-batch-processing">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <i className="fas fa-layer-group mr-2 text-primary"></i>
            Batch Processing
          </h3>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drop CSV file or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .csv, .sdf formats</p>
            </div>
            <Button 
              className="w-full" 
              variant="secondary" 
              disabled
              data-testid="button-process-batch"
            >
              <i className="fas fa-play mr-2"></i>
              Process Batch
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="card-quick-actions">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
              data-testid="button-recent-compounds"
            >
              <History className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Recent Compounds
            </button>
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
              data-testid="button-saved-predictions"
            >
              <Star className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Saved Predictions
            </button>
            
            {/* Recent Compounds List */}
            {recentCompounds && recentCompounds.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Recent:</p>
                {recentCompounds.slice(0, 3).map((compound: any) => (
                  <button
                    key={compound.id}
                    onClick={() => handleRecentCompoundSelect(compound)}
                    className="w-full text-left py-1 px-2 text-xs rounded hover:bg-accent transition-colors"
                    data-testid={`button-recent-compound-${compound.id}`}
                  >
                    <div className="truncate font-mono">{compound.smiles}</div>
                    {compound.name && (
                      <div className="truncate text-muted-foreground">{compound.name}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            <button 
              className="w-full text-left py-2 px-3 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => {
                setSmiles('C1=CC=CC=C1');
                setCompoundName('Benzene');
              }}
              data-testid="button-example-compounds"
            >
              <Database className="inline mr-2 h-4 w-4 text-muted-foreground" />
              Example Compounds
            </button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { validateSMILES } from "@/lib/molecular-utils";
import { AnalysisResult, ImageAnalysisResult, MedicineInsights, MedicineNameAnalysisResult } from "@/types/molecular";
import { 
  FlaskConical, Search, Eraser, Upload, History, Star, 
  Database, Beaker, Paintbrush, Play, FileCheck, 
  CheckCircle, XCircle, Loader, Download, Info, AlertCircle,
  ExternalLink, Maximize2
} from "lucide-react";
import MolecularSketcher from "./molecular-sketcher";

interface CompoundInputProps {
  onAnalysisComplete: (result: AnalysisResult) => void;
  onAnalysisStart: () => void;
  onAnalysisError: () => void;
  onMedicineInsightsChange: (insights: MedicineInsights | null) => void;
  onMedicineNameAnalysis: (analysis: MedicineNameAnalysisResult | null) => void;
  isAnalyzing: boolean;
  enableMedicineFeatures?: boolean;
  currentCompound?: { smiles?: string; name?: string } | null;
}

export default function CompoundInput({ 
  onAnalysisComplete, 
  onAnalysisStart, 
  onAnalysisError, 
  onMedicineInsightsChange,
  onMedicineNameAnalysis,
  isAnalyzing,
  enableMedicineFeatures = true,
  currentCompound = null
}: CompoundInputProps) {
  const [activeTab, setActiveTab] = useState<'smiles' | 'draw' | 'upload' | 'photo' | 'medicine'>('smiles');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [smiles, setSmiles] = useState('');
  const [compoundName, setCompoundName] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [uploadedCompounds, setUploadedCompounds] = useState<Array<{smiles: string; name?: string}>>([]);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showBatchResults, setShowBatchResults] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!enableMedicineFeatures && activeTab === 'medicine') {
      setActiveTab('smiles');
    }
  }, [enableMedicineFeatures, activeTab]);


  // Sync with current compound if passed from parent
  useEffect(() => {
    if (currentCompound) {
      if (currentCompound.smiles) setSmiles(currentCompound.smiles);
      if (currentCompound.name) setCompoundName(currentCompound.name);
    }
  }, [currentCompound?.smiles, currentCompound?.name]);

  // Demo steps for tutorial
  const demoSteps = [
    {
      title: "Step 1: Enter SMILES or Compound Name",
      description: "Start by entering either a SMILES string or a compound name in the input field. The system will automatically detect which one you've entered and process it accordingly.",
      example: "Examples: CCO, Aspirin, C1=CC=CC=C1, Caffeine",
      image: "🧪"
    },
    {
      title: "Step 2: Add Custom Name (Optional)",
      description: "If you entered SMILES notation, you can optionally provide a custom compound name. If you entered a compound name, this field is not needed.",
      example: "Example: Ethanol, Aspirin, Caffeine",
      image: "📝"
    },
    {
      title: "Step 3: Run Analysis",
      description: "Click the 'Analyze' button to start. Compound names are resolved to SMILES using the PubChem database, then RDKit computes the molecular descriptors, the published drug-likeness rules and structural alert sets are applied, and ChEMBL is queried for measured activity.",
      example: "Processing time: ~2-5 seconds per compound",
      image: "⚡"
    },
    {
      title: "Step 4: View Results",
      description: "Review the 3D structure, molecular descriptors, drug-likeness (Lipinski and Veber), structural alert matches, and any measured ChEMBL activity per target.",
      example: "Navigate to Safety and Export pages for detailed analysis",
      image: "📊"
    },
    {
      title: "Batch Processing",
      description: "Upload CSV files with multiple compounds to analyze them all at once. The first column should contain SMILES, and the second column (optional) can have compound names.",
      example: "Supports: .csv, .txt, .smi files",
      image: "📦"
    }
  ];

  // Fetch recent compounds
  const { data: recentCompounds } = useQuery({
    queryKey: ['/api/compounds/recent'],
  });

  const { data: savedCompounds } = useQuery({
    queryKey: ['/api/predictions/saved'],
  });

  // Analysis mutation
  const analysisMutation = useMutation({
    mutationFn: async ({ smiles, name }: { smiles: string; name?: string }) => {
      const response = await apiRequest('POST', '/api/compounds/analyze', { smiles, name });
      return response.json();
    },
    onSuccess: (data) => {
      onMedicineInsightsChange(null);
      onMedicineNameAnalysis(null);
      onAnalysisComplete(data);
      if (data?.compound) {
        setSmiles(data.compound.smiles || '');
        setCompoundName(data.compound.name || '');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/compounds/recent'] });
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${data?.compound?.name || data?.compound?.smiles || 'compound'} successfully.`,
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

  // Image analysis mutation (medicine photo)
  const imageAnalysisMutation = useMutation({
    mutationFn: async ({ imageBase64 }: { imageBase64: string }) => {
      const response = await apiRequest('POST', '/api/compounds/analyze-image', { imageBase64 });
      return response.json() as Promise<ImageAnalysisResult>;
    },
    onSuccess: (data) => {
      onMedicineInsightsChange(data?.medicineInsights ?? null);
      onMedicineNameAnalysis(null);
      // If a verified compound analysis is present, pipe it into the main flow
      if (data?.compound && data?.prediction && data?.lipinskiRules) {
        onAnalysisComplete({
          compound: data.compound,
          prediction: data.prediction,
          lipinskiRules: data.lipinskiRules,
          structure: data.structure,
          medicineInsights: data.medicineInsights,
        });
        setActiveTab('smiles');
        toast({ title: 'Photo analyzed', description: 'Verified compound identified and analyzed.' });
      } else {
        toast({
          title: 'Photo analyzed',
          description: 'Insights extracted. No verified compound identified automatically.',
        });
      }
    },
    onError: (error) => {
      onAnalysisError();
      toast({
        title: 'Image analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze photo',
        variant: 'destructive',
      });
    }
  });

  const medicineNameMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const response = await apiRequest('POST', '/api/medicine/analyze-name', { name });
      return response.json() as Promise<MedicineNameAnalysisResult>;
    },
    onSuccess: (data) => {
      onMedicineNameAnalysis(data);
      onMedicineInsightsChange(null);
      toast({
        title: 'Medicine analyzed',
        description: `Insights generated for ${data?.medicine?.officialName || 'the provided medicine'}.`,
      });
    },
    onError: (error) => {
      onAnalysisError();
      toast({
        title: 'Medicine analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze medicine name',
        variant: 'destructive',
      });
    }
  });

  async function handlePhotoSelected(file: File) {
    setUploadError(null);
    // Validate size (client limit ~4MB)
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      const err = `Image too large (${(file.size/1024/1024).toFixed(2)}MB). Max 4MB.`;
      setUploadError(err);
      toast({ title: 'Image too large', description: err, variant: 'destructive' });
      return;
    }
    // Validate MIME
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      const err = 'Unsupported image type. Use PNG or JPEG.';
      setUploadError(err);
      toast({ title: 'Unsupported image', description: err, variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      // Kick off analysis
      imageAnalysisMutation.mutate({ imageBase64: base64 });
    };
    reader.onerror = () => {
      const err = 'Failed to read image';
      setUploadError(err);
      toast({ title: 'Read error', description: err, variant: 'destructive' });
    };
    reader.readAsDataURL(file);
  }

  const handleAnalyze = (overrideSmiles?: string, overrideName?: string) => {
    const rawSmiles = overrideSmiles !== undefined ? overrideSmiles : smiles;
    const rawName = overrideName !== undefined ? overrideName : compoundName;
    const trimmedSmiles = rawSmiles.trim();
    const trimmedName = rawName.trim();

    if (!trimmedSmiles && !trimmedName) {
      toast({
        title: "Missing Input",
        description: "Please enter either a SMILES notation or a compound name to analyze",
        variant: "destructive",
      });
      return;
    }

    onMedicineInsightsChange(null);
    onMedicineNameAnalysis(null);
    onAnalysisStart();

    // If only compound name is provided: analyze by name!
    if (!trimmedSmiles && trimmedName) {
      analysisMutation.mutate({ 
        smiles: trimmedName, 
        name: trimmedName 
      });
      return;
    }

    // If only SMILES is provided: analyze by SMILES!
    if (trimmedSmiles && !trimmedName) {
      analysisMutation.mutate({ 
        smiles: trimmedSmiles 
      });
      return;
    }

    // Both are provided: pass both for smart resolution
    analysisMutation.mutate({ 
      smiles: trimmedSmiles, 
      name: trimmedName 
    });
  };

  // Sync with child tab messages (e.g. from /draw)
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === "BIOPREDICT_LOAD_SMILES") {
        if (event.data.smiles) setSmiles(event.data.smiles);
        if (event.data.name) setCompoundName(event.data.name);
        setActiveTab("smiles");
        toast({
          title: "Structure Loaded from Drawing Studio",
          description: event.data.name || event.data.smiles,
        });
      } else if (event.data?.type === "BIOPREDICT_ANALYZE_SMILES") {
        if (event.data.smiles) setSmiles(event.data.smiles);
        if (event.data.name) setCompoundName(event.data.name);
        handleAnalyze(event.data.smiles, event.data.name);
      }
    };
    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [handleAnalyze, toast]);

  const handleClear = () => {
    setSmiles('');
    setCompoundName('');
  };

  const handleRecentCompoundSelect = (compound: any) => {
    setSmiles(compound.smiles);
    setCompoundName(compound.name || '');
  };

  // Upload handlers with validation
  function parseCSV(text: string): Array<{smiles: string; name?: string}> {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const hasHeader = /smiles/i.test(lines[0]);
    const rows = hasHeader ? lines.slice(1) : lines;
    
    const parsed: Array<{smiles: string; name?: string}> = [];
    
    rows.forEach((line, idx) => {
      const parts = line.split(/,|;|\t/);
      const s = (parts[0] || '').trim();
      const n = (parts[1] || '').trim();
      
      // Validate SMILES
      if (s && validateSMILES(s)) {
        parsed.push({ smiles: s, name: n || undefined });
      } else if (s) {
        console.warn(`Invalid SMILES at line ${idx + (hasHeader ? 2 : 1)}: ${s}`);
      }
    });
    
    return parsed;
  }

  async function handleFileSelected(file: File) {
    setUploadError(null);
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const error = `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 5MB.`;
      setUploadError(error);
      toast({ title: 'Upload failed', description: error, variant: 'destructive' });
      return;
    }
    
    try {
      const text = await file.text();
      let items: Array<{smiles: string; name?: string}> = [];
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'csv' || ext === 'txt' || ext === 'smi') {
        items = parseCSV(text);
      } else if (ext === 'sdf') {
        toast({ 
          title: 'SDF not fully supported', 
          description: 'Please upload CSV, TXT, or SMI files with SMILES notation.', 
          variant: 'destructive' 
        });
        return;
      } else {
        const error = `Unsupported file type: .${ext}`;
        setUploadError(error);
        toast({ title: 'Unsupported file', description: error, variant: 'destructive' });
        return;
      }
      
      if (items.length === 0) {
        const error = 'No valid compounds found in file. Ensure SMILES are in the first column.';
        setUploadError(error);
        toast({ title: 'No compounds found', description: error, variant: 'destructive' });
        return;
      }
      
      setUploadedCompounds(items);
      toast({ 
        title: 'File uploaded successfully', 
        description: `${items.length} compounds loaded and ready for processing.` 
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Could not read file';
      setUploadError(error);
      toast({ title: 'Upload failed', description: error, variant: 'destructive' });
    }
  }

  const batchMutation = useMutation({
    mutationFn: async (compounds: Array<{smiles: string; name?: string}>) => {
      const res = await apiRequest('POST', '/api/batch/process', { compounds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Batch started', description: `Batch Job ID: ${data.batchJobId}` });
      setBatchJobId(data.batchJobId);
      setBatchInfo({ status: 'processing', processedCompounds: 0, totalCompounds: uploadedCompounds.length });
    },
    onError: (error) => {
      toast({ title: 'Batch failed', description: error instanceof Error ? error.message : 'Failed to start batch', variant: 'destructive' });
    }
  });

  // Poll batch status
  useEffect(() => {
    if (!batchJobId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest('GET', `/api/batch/${batchJobId}`);
        const data = await res.json();
        if (!cancelled) setBatchInfo(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (e) {
        // stop polling on error
        clearInterval(interval);
      }
    }, 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [batchJobId]);

  return (
    <>
      {/* Watch Demo Modal */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Play className="mr-2 h-5 w-5 text-primary" />
              Bioactivity Analysis Tutorial
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                {demoSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === demoStep ? 'w-8 bg-primary' : 'w-2 bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Step {demoStep + 1} of {demoSteps.length}
              </span>
            </div>

            {/* Current Step */}
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">{demoSteps[demoStep].image}</div>
              <h3 className="text-2xl font-bold">{demoSteps[demoStep].title}</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {demoSteps[demoStep].description}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-sm font-medium text-foreground">{demoSteps[demoStep].example}</p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setDemoStep(Math.max(0, demoStep - 1))}
                disabled={demoStep === 0}
              >
                Previous
              </Button>
              {demoStep < demoSteps.length - 1 ? (
                <Button onClick={() => setDemoStep(demoStep + 1)}>
                  Next
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowDemoModal(false);
                    setDemoStep(0);
                    toast({
                      title: "Ready to start!",
                      description: "You can now begin analyzing compounds."
                    });
                  }}
                >
                  Start Analyzing
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Results Modal */}
      <Dialog open={showBatchResults} onOpenChange={setShowBatchResults}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <FileCheck className="mr-2 h-5 w-5 text-primary" />
                Batch Processing Results
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (batchInfo?.results) {
                    const csvContent = [
                      ['SMILES', 'Name', 'Safety Score'].join(','),
                      ...batchInfo.results.map((r: any) => [
                        r.compound?.smiles || '',
                        r.compound?.name || '',
                        r.prediction?.safetyAssessment?.overallScore?.toFixed(2) || ''
                      ].join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `batch_results_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                disabled={!batchInfo?.results?.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary */}
            {batchInfo && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {batchInfo.totalCompounds || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {batchInfo.processedCompounds || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary capitalize">
                    {batchInfo.status || 'Unknown'}
                  </div>
                  <div className="text-sm text-muted-foreground">Status</div>
                </div>
              </div>
            )}

            {/* Results Table */}
            {batchInfo?.results && batchInfo.results.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-sm font-semibold">#</th>
                        <th className="text-left p-3 text-sm font-semibold">SMILES</th>
                        <th className="text-left p-3 text-sm font-semibold">Name</th>
                        <th className="text-center p-3 text-sm font-semibold">Safety</th>
                        <th className="text-center p-3 text-sm font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchInfo.results.map((result: any, idx: number) => (
                        <tr key={idx} className="border-t hover:bg-muted/50">
                          <td className="p-3 text-sm">{idx + 1}</td>
                          <td className="p-3 text-xs font-mono truncate max-w-xs">
                            {result.compound?.smiles || 'N/A'}
                          </td>
                          <td className="p-3 text-sm truncate max-w-xs">
                            {result.compound?.name || '-'}
                          </td>
                          <td className="p-3 text-center">
                            {result.prediction?.safetyAssessment?.overallScore
                              ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  result.prediction.safetyAssessment.overallScore >= 70
                                    ? 'bg-green-500/20 text-green-700'
                                    : result.prediction.safetyAssessment.overallScore >= 50
                                    ? 'bg-yellow-500/20 text-yellow-700'
                                    : 'bg-red-500/20 text-red-700'
                                }`}>
                                  {result.prediction.safetyAssessment.overallScore.toFixed(0)}%
                                </span>
                              )
                              : '-'}
                          </td>
                          <td className="p-3 text-center">
                            {result.error ? (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compound Input Card */}
      <Card data-testid="card-compound-input">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <FlaskConical className="mr-2 text-primary" />
              Compound Input
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDemoModal(true)}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Watch Demo
            </Button>
          </div>
          
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
            <button
              className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                activeTab === 'photo' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('photo')}
              data-testid="tab-photo"
            >
              Photo
            </button>
            {enableMedicineFeatures && (
              <button
                className={`flex-1 text-sm py-2 px-3 rounded-md font-medium transition-colors ${
                  activeTab === 'medicine' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('medicine')}
                data-testid="tab-medicine"
              >
                Medicine Name
              </button>
            )}
          </div>

          {/* SMILES / Compound Name Input */}
          {activeTab === 'smiles' && (
            <div className="space-y-4" data-testid="panel-smiles-input">
              {/* Option 1: SMILES Notation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="smiles-input" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    SMILES Notation
                  </Label>
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    Structure String
                  </span>
                </div>
                <div className="relative">
                  <Textarea
                    id="smiles-input"
                    value={smiles}
                    onChange={(e) => setSmiles(e.target.value)}
                    className="w-full resize-none font-mono text-sm pr-8"
                    rows={2}
                    placeholder="Enter SMILES notation (e.g., [Na+].[Cl-], CCO, c1ccccc1)"
                    data-testid="input-smiles"
                  />
                  {smiles && (
                    <button
                      type="button"
                      onClick={() => setSmiles('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-muted"
                      title="Clear SMILES"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Chemical structure notation for precise atomic modeling.
                </p>
              </div>

              {/* Visual Divider */}
              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-border/60"></div>
                <span className="flex-shrink mx-3 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                  or search by compound name
                </span>
                <div className="flex-grow border-t border-border/60"></div>
              </div>

              {/* Option 2: Compound Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="compound-name" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-emerald-500" />
                    Compound Name
                  </Label>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Don't know SMILES? Enter name here
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="compound-name"
                    value={compoundName}
                    onChange={(e) => setCompoundName(e.target.value)}
                    placeholder="e.g., Sodium chloride, Aspirin, Paracetamol, Caffeine, Ibuprofen"
                    data-testid="input-compound-name"
                    className="pr-8 text-sm"
                  />
                  {compoundName && (
                    <button
                      type="button"
                      onClick={() => setCompoundName('')}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs p-1 rounded hover:bg-muted"
                      title="Clear Name"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Type any compound, chemical, or drug name — PubChem & AI will deduce its 2D & 3D chemical structure automatically.
                </p>
              </div>

              <div className="flex space-x-2 pt-1">
                <Button
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  className="flex-1"
                  data-testid="button-analyze"
                >
                  <Search className="mr-2 h-4 w-4" />
                  {isAnalyzing || analysisMutation.isPending ? 'Analyzing...' : 'Analyze Compound'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={isAnalyzing || analysisMutation.isPending}
                  data-testid="button-clear"
                  title="Clear all inputs"
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Drawing / Molecular Builder Interface */}
          {activeTab === 'draw' && (
            <div className="space-y-4" data-testid="panel-draw-input">
              <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Paintbrush className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">SMILES Drawing Studio</h4>
                      <p className="text-xs text-muted-foreground">
                        Interactive 2D structure sketcher with real-time RDKit WASM
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    Widescreen
                  </Badge>
                </div>

                {/* Active Structure Preview Status */}
                <div className="p-3 rounded-lg bg-muted/40 border border-border/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Current Structure in Studio:</span>
                    {smiles && (
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                        {compoundName || 'Drawn Molecule'}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs text-foreground bg-background p-2 rounded border border-border break-all">
                    {smiles || "c1ccccc1O (Default Phenol)"}
                  </div>
                </div>

                {/* Quick Chemical Templates */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Quick Chemical Templates:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { name: "Benzene", smiles: "c1ccccc1" },
                      { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
                      { name: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1" },
                      { name: "Caffeine", smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C" },
                    ].map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setSmiles(item.smiles);
                          setCompoundName(item.name);
                          toast({ title: `Loaded ${item.name}`, description: item.smiles });
                        }}
                        className="p-1.5 text-xs text-left rounded border border-border bg-background hover:bg-muted hover:border-primary/40 transition-colors"
                      >
                        <span className="font-semibold text-foreground block truncate">{item.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground block truncate">{item.smiles}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Launch Actions */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    onClick={() => window.open(`/draw?smiles=${encodeURIComponent(smiles || 'c1ccccc1O')}`, '_blank')}
                    className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold h-11 gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Drawing Studio in New Tab
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDrawingModalOpen(true)}
                    className="w-full h-9 gap-2 text-xs border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Quick Studio Popup Modal
                  </Button>
                </div>
              </div>

              {/* Direct Analysis Button if compound is loaded */}
              {smiles && (
                <div className="flex space-x-2 pt-1">
                  <Button
                    onClick={() => handleAnalyze()}
                    disabled={isAnalyzing || analysisMutation.isPending}
                    className="flex-1"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {isAnalyzing || analysisMutation.isPending ? 'Analyzing...' : 'Analyze Drawn Compound'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    disabled={isAnalyzing || analysisMutation.isPending}
                    title="Clear inputs"
                  >
                    <Eraser className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Upload Interface */}
          {activeTab === 'upload' && (
            <div className="space-y-4" data-testid="panel-upload-input">
              {/* Upload Error Alert */}
              {uploadError && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
              
              {/* Drag & Drop Zone */}
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  isDragging 
                    ? 'border-primary bg-primary/5 scale-105' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setIsDragging(true);
                }}
                onDragLeave={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setIsDragging(false);
                }}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0]; 
                  if (file) handleFileSelected(file); 
                }}
              >
                <Upload className={`mx-auto h-12 w-12 mb-4 transition-colors ${
                  isDragging ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <p className="text-sm font-medium text-foreground mb-2">
                  {isDragging ? 'Drop file here' : 'Drag and drop your file here'}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Supported formats: CSV, TXT, SMI • Maximum size: 5MB
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.smi"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileCheck className="h-4 w-4" />
                  Choose File
                </Button>
              </div>

              {/* File Format Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>File Format:</strong> First column should contain SMILES notation, 
                  second column (optional) can have compound names. Headers are optional.
                </AlertDescription>
              </Alert>

              {/* Uploaded Compounds Preview */}
              {uploadedCompounds.length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-semibold text-foreground">
                        {uploadedCompounds.length} compounds loaded successfully
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setUploadedCompounds([]);
                        setUploadError(null);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <div className="max-h-48 overflow-auto space-y-2 bg-white/50 dark:bg-black/20 rounded p-3">
                    {uploadedCompounds.slice(0, 10).map((c, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between text-xs p-2 rounded bg-white dark:bg-slate-800/50 hover:bg-accent transition-colors"
                      >
                        <div className="flex-1 flex items-center gap-3">
                          <span className="text-muted-foreground font-medium w-6">{idx + 1}.</span>
                          <code className="flex-1 truncate font-mono text-primary">{c.smiles}</code>
                          {c.name && (
                            <span className="truncate text-muted-foreground max-w-xs">{c.name}</span>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => { 
                            setSmiles(c.smiles); 
                            setCompoundName(c.name || ''); 
                            setActiveTab('smiles'); 
                            toast({
                              title: "Compound selected",
                              description: "Ready to analyze"
                            });
                          }}
                          className="ml-2"
                        >
                          Use
                        </Button>
                      </div>
                    ))}
                    {uploadedCompounds.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        + {uploadedCompounds.length - 10} more compounds...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photo Interface */}
          {activeTab === 'photo' && (
            <div className="space-y-4" data-testid="panel-photo-input">
              {uploadError && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-2">Upload a medicine photo (PNG or JPEG)</p>
                <p className="text-xs text-muted-foreground mb-4">Max size: 4MB • Use clear blister, bottle, or box photos</p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelected(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={imageAnalysisMutation.isPending}
                  className="gap-2"
                >
                  {imageAnalysisMutation.isPending ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      Choose Photo
                    </>
                  )}
                </Button>
                {photoPreview && (
                  <div className="mt-4 flex justify-center">
                    <img src={photoPreview} alt="preview" className="max-h-48 rounded border" />
                  </div>
                )}
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Your photo is processed on-device to a Base64 string, then analyzed via Gemini. If Gemini identifies a likely active compound, we verify via PubChem and run the standard analysis automatically.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Medicine Name Interface */}
          {enableMedicineFeatures && activeTab === 'medicine' && (
            <div className="space-y-4" data-testid="panel-medicine-input">
              <div>
                <Label htmlFor="medicine-name" className="block text-sm font-medium text-foreground mb-2">
                  Medicine or Brand Name
                </Label>
                <Input
                  id="medicine-name"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  placeholder="e.g., Paracetamol, Tylenol, Metformin"
                  data-testid="input-medicine-name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Gemini cross-checks the name, lists official brands, active ingredients, indications, dosage guidance, and safety warnings.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  disabled={medicineNameMutation.isPending}
                  onClick={() => {
                    if (!medicineName.trim()) {
                      toast({
                        title: 'Missing name',
                        description: 'Please enter a medicine name to analyze.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    onMedicineInsightsChange(null);
                    onMedicineNameAnalysis(null);
                    medicineNameMutation.mutate({ name: medicineName.trim() });
                  }}
                  data-testid="button-analyze-medicine"
                >
                  {medicineNameMutation.isPending ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Analyze Medicine
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMedicineName('');
                    onMedicineNameAnalysis(null);
                  }}
                  disabled={medicineNameMutation.isPending}
                  data-testid="button-clear-medicine"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Output includes structured JSON with ingredients, chemical composition, indications, dosage guidance, interactions, and confidence scoring. Packaging imagery is generated when feasible.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Processing Card */}
      <Card data-testid="card-batch-processing" className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Batch Processing
            {uploadedCompounds.length > 0 && (
              <span className="ml-auto text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full">
                {uploadedCompounds.length} compounds ready
              </span>
            )}
          </h3>
          
          <div className="space-y-4">
            {/* Quick Batch Upload */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center transition-all hover:border-primary/50 hover:bg-muted/30"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                const file = e.dataTransfer.files?.[0]; 
                if (file) handleFileSelected(file); 
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <Database className="h-8 w-8 text-primary" />
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                Upload Multiple Compounds
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                CSV, TXT, or SMI files • First column: SMILES, Second column: Name (optional)
              </p>
              
              <input
                ref={batchFileInputRef}
                type="file"
                accept=".csv,.txt,.smi"
                className="hidden"
                onChange={(e) => { 
                  const file = e.target.files?.[0]; 
                  if (file) handleFileSelected(file); 
                }}
              />
              
              <div className="flex justify-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => batchFileInputRef.current?.click()}
                  className="gap-2"
                >
                  <FileCheck className="h-4 w-4" />
                  Select File
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => batchMutation.mutate(uploadedCompounds)} 
                  disabled={uploadedCompounds.length === 0 || batchMutation.isPending}
                  data-testid="button-process-batch"
                  className="gap-2"
                >
                  {batchMutation.isPending ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Process Batch
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress & Status */}
            {batchInfo && (
              <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${
                      batchInfo.status === 'completed' ? 'bg-green-500' :
                      batchInfo.status === 'failed' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`} />
                    <span className="font-medium capitalize">{batchInfo.status}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {batchInfo.processedCompounds ?? 0} / {batchInfo.totalCompounds ?? 0}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress 
                    value={Math.round(
                      ((batchInfo.processedCompounds || 0) / (batchInfo.totalCompounds || 1)) * 100
                    )} 
                    className="h-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {Math.round(
                        ((batchInfo.processedCompounds || 0) / (batchInfo.totalCompounds || 1)) * 100
                      )}% complete
                    </span>
                    {batchInfo.status === 'processing' && (
                      <span className="flex items-center gap-1 animate-pulse">
                        <Loader className="h-3 w-3 animate-spin" />
                        Processing...
                      </span>
                    )}
                  </div>
                </div>

                {/* View Results Button */}
                {Array.isArray(batchInfo.results) && batchInfo.results.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowBatchResults(true)}
                  >
                    <FileCheck className="h-4 w-4 mr-2" />
                    View {batchInfo.results.length} Results
                  </Button>
                )}

                {/* Quick Preview (first 3 results) */}
                {Array.isArray(batchInfo.results) && batchInfo.results.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Quick Preview:</p>
                    {batchInfo.results.slice(0, 3).map((r: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleRecentCompoundSelect(r.compound);
                          toast({
                            title: "Compound loaded",
                            description: "Review the analysis results"
                          });
                        }}
                        className="w-full text-left py-2 px-3 text-xs rounded hover:bg-accent transition-colors flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-mono text-primary">{r?.compound?.smiles}</div>
                          {r?.compound?.name && (
                            <div className="truncate text-muted-foreground">{r?.compound?.name}</div>
                          )}
                        </div>
                      </button>
                    ))}
                    {batchInfo.results.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center py-1">
                        + {batchInfo.results.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
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
            {Array.isArray(recentCompounds) && recentCompounds.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Recent:</p>
                {(recentCompounds as any[]).slice(0, 3).map((compound: any) => (
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
            {/* Saved Predictions List */}
            {Array.isArray(savedCompounds) && savedCompounds.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Saved:</p>
                {(savedCompounds as any[]).slice(0, 3).map((compound: any) => (
                  <button
                    key={compound.id}
                    onClick={() => handleRecentCompoundSelect(compound)}
                    className="w-full text-left py-1 px-2 text-xs rounded hover:bg-accent transition-colors"
                    data-testid={`button-saved-compound-${compound.id}`}
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

      {/* Molecular Drawing Studio Pop-up Modal Dialog */}
      <Dialog open={isDrawingModalOpen} onOpenChange={setIsDrawingModalOpen}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh] p-4 sm:p-5 overflow-y-auto bg-background border-border shadow-2xl rounded-2xl">
          <DialogHeader className="pb-2 border-b border-border/60">
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-primary" />
                <span>2D SMILES Molecular Drawing Studio</span>
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                  Pop-up Studio Mode
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.open(`/draw?smiles=${encodeURIComponent(smiles || 'c1ccccc1O')}`, '_blank');
                  setIsDrawingModalOpen(false);
                }}
                className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1 mr-6"
                title="Pop out into new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Pop out to New Tab
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            <MolecularSketcher
              initialSmiles={smiles || "c1ccccc1O"}
              onApplySmiles={(newSmiles, name) => {
                setSmiles(newSmiles);
                if (name) setCompoundName(name);
                setIsDrawingModalOpen(false);
                toast({
                  title: "Structure Applied",
                  description: `Transferred ${name || newSmiles} to analysis dashboard.`,
                });
              }}
              onAnalyzeImmediately={(newSmiles, name) => {
                setSmiles(newSmiles);
                if (name) setCompoundName(name);
                setIsDrawingModalOpen(false);
                handleAnalyze(newSmiles, name);
              }}
              isAnalyzing={isAnalyzing}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

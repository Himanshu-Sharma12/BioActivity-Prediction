import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertCircle, 
  FlaskConical, 
  ArrowRight,
  Atom,
  Weight,
  Activity,
  Droplet,
  Circle,
  TrendingUp,
  Zap,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import SafetyAssessment from "@/components/safety-assessment";
import TherapeuticPredictionCard from "@/components/therapeutic-prediction-card";
import CombinatorialMedicineCard from "@/components/combinatorial-medicine-card";
import UnknownCompoundCard from "@/components/unknown-compound-card";
import { AnalysisResult } from "@/types/molecular";
import { cn } from "@/lib/utils";
import { getMolecularName } from "@/lib/molecular-utils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Sparkles as SparklesIcon } from "lucide-react";

export default function SafetyPage() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const handleBenchmarkAnalyze = async (name: string, smiles: string) => {
    setIsBenchmarking(true);
    try {
      const res = await apiRequest('POST', '/api/compounds/analyze', { smiles, name });
      const data = await res.json();
      setCurrentAnalysis(data);
      sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to run benchmark:', e);
    } finally {
      setIsBenchmarking(false);
    }
  };

  useEffect(() => {
    // Check if there's analysis data in sessionStorage
    const storedAnalysis = sessionStorage.getItem('currentAnalysis');
    if (storedAnalysis) {
      try {
        setCurrentAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error('Error parsing stored analysis:', error);
      }
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading safety assessment...</p>
        </div>
      </div>
    );
  }

  if (!currentAnalysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <Card className="border-2 border-dashed border-border/50">
              <CardContent className="pt-16 pb-16 text-center">
                <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-3">No Compound Data Available</h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  To view the safety assessment, you need to analyze a compound first.
                  The safety analysis includes toxicity prediction, drug-likeness evaluation,
                  and comprehensive risk assessment.
                </p>
                <Link href="/analyze">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600">
                    <FlaskConical className="mr-2 w-5 h-5" />
                    Analyze a Custom Compound
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>

                {/* Instant Benchmark Evaluator */}
                <div className="mt-8 pt-6 border-t border-border/50 text-left">
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Or Evaluate a Reference Compound Instantly
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', desc: 'Analgesic' },
                      { name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', desc: 'Antipyretic' },
                      { name: 'Caffeine', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', desc: 'CNS Stimulant' },
                      { name: 'Ibuprofen', smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', desc: 'NSAID' },
                      { name: 'Metformin', smiles: 'CN(C)C(=N)NC(=N)N', desc: 'Antidiabetic' },
                      { name: 'Amoxicillin', smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)C(c3ccc(cc3)O)N)C(=O)O)C', desc: 'Antibiotic' },
                    ].map((b) => (
                      <button
                        key={b.name}
                        disabled={isBenchmarking}
                        onClick={() => handleBenchmarkAnalyze(b.name, b.smiles)}
                        className="p-3 rounded-lg border border-border/70 hover:border-primary/60 bg-card/60 hover:bg-accent/40 text-left transition-all group disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="group-hover:text-primary transition-colors">{b.name}</span>
                          <span className="text-[10px] text-muted-foreground">{b.desc}</span>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate mt-1">{b.smiles}</div>
                      </button>
                    ))}
                  </div>
                  {isBenchmarking && (
                    <div className="flex items-center justify-center gap-2 text-xs text-primary mt-4 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Computing RDKit descriptors and screening Brenk / PAINS structural alerts...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Info Cards */}
            <div className="grid md:grid-cols-3 gap-4 mt-8">
              <Card className="border-orange-200 dark:border-orange-900/30 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl mb-2">🧪</div>
                  <h3 className="font-semibold mb-1">Hepatotoxicity</h3>
                  <p className="text-xs text-muted-foreground">Liver toxicity risk assessment</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-900/30 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/20">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl mb-2">❤️</div>
                  <h3 className="font-semibold mb-1">Cardiotoxicity</h3>
                  <p className="text-xs text-muted-foreground">Heart toxicity evaluation</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-900/30 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
                <CardContent className="pt-6 text-center">
                  <div className="text-3xl mb-2">🧬</div>
                  <h3 className="font-semibold mb-1">Mutagenicity</h3>
                  <p className="text-xs text-muted-foreground">DNA damage potential</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Safety Assessment</h1>
              <p className="text-muted-foreground">
                Comprehensive toxicity analysis and risk evaluation
              </p>
            </div>
          </div>

          {/* Compound Info */}
          {currentAnalysis.compound?.name && (
            <Alert className="border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">Analyzing:</span> {currentAnalysis.compound.name}
                {currentAnalysis.compound.smiles && (
                  <span className="ml-2 text-xs opacity-75">({currentAnalysis.compound.smiles})</span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Safety Assessment Component */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Molecular Description Card */}
          <div className="xl:col-span-3 mb-6">
            <Card className="border border-border/80 bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
                    <Atom className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-foreground">Molecular Description</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Detailed physicochemical properties
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Molecular Weight */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950/80 transition-colors">
                        <Weight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Molecular Weight
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.molecularWeight?.toFixed(2) || 'N/A'} g/mol
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Mass of one mole
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* LogP */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-950/80 transition-colors">
                        <Droplet className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            LogP (Lipophilicity)
                          </p>
                          {currentAnalysis.prediction.descriptors.logP !== undefined && (
                            <Badge 
                              variant={currentAnalysis.prediction.descriptors.logP > 5 ? "destructive" : currentAnalysis.prediction.descriptors.logP < 0 ? "secondary" : "default"} 
                              className="text-xs px-2 py-0"
                            >
                              {currentAnalysis.prediction.descriptors.logP > 5 ? "High" : currentAnalysis.prediction.descriptors.logP < 0 ? "Low" : "Optimal"}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.logP?.toFixed(2) || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Partition coefficient
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* H-Bond Donors */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/80 transition-colors">
                        <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          H-Bond Donors
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.hbdCount?.toString() || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Hydrogen bond donors
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* H-Bond Acceptors */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/80 transition-colors">
                        <Circle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          H-Bond Acceptors
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.hbaCount?.toString() || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Hydrogen bond acceptors
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* TPSA */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-950/80 transition-colors">
                        <TrendingUp className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          TPSA
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.tpsa?.toFixed(2) || 'N/A'} Å²
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Topological polar surface
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rotatable Bonds */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-950/80 transition-colors">
                        <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Rotatable Bonds
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate">
                          {currentAnalysis.prediction.descriptors.rotatableBonds?.toString() || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Molecular flexibility
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Compound Name */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/80 transition-colors">
                        <Atom className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Compound Name
                        </p>
                        <p className="mt-1 text-lg font-bold text-foreground truncate" title={currentAnalysis.compound.name || getMolecularName(currentAnalysis.compound.smiles)}>
                          {currentAnalysis.compound.name || getMolecularName(currentAnalysis.compound.smiles)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Chemical identity
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SMILES */}
                  <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/90 p-4 transition-all hover:border-primary/50 hover:bg-accent/25 hover:shadow-md">
                    <div className="relative z-10 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 transition-colors">
                        <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          SMILES Notation
                        </p>
                        <p className="mt-1 text-sm font-mono font-bold text-foreground truncate" title={currentAnalysis.compound.smiles}>
                          {currentAnalysis.compound.smiles || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Structure representation
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Property Summary
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    These molecular descriptors are crucial for predicting ADME (Absorption, Distribution, 
                    Metabolism, and Excretion) properties. LogP indicates lipophilicity, TPSA relates to 
                    cell membrane permeability, and hydrogen bonding capacity affects solubility and bioavailability.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Safety Assessment */}
          <div className="xl:col-span-2">
            <SafetyAssessment 
              assessment={currentAnalysis.prediction.safetyAssessment}
              isLoading={false}
            />
          </div>

          {/* Sidebar with additional info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assessment Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">What is analyzed?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hepatotoxicity (liver damage)</li>
                    <li>• Cardiotoxicity (heart effects)</li>
                    <li>• Mutagenicity (genetic toxicity)</li>
                    <li>• hERG inhibition (cardiac risk)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Risk Levels</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-muted-foreground">Low Risk</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm text-muted-foreground">Medium Risk</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm text-muted-foreground">High Risk</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Need more details?</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Export the complete analysis report with all safety metrics.
                </p>
                <Link href="/export">
                  <Button variant="outline" className="w-full">
                    Export Results
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Unknown Novel Compound Deep AI Profile */}
        {currentAnalysis && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <UnknownCompoundCard analysis={currentAnalysis} />
          </div>
        )}

        {/* Therapeutic Disease Predictions & Medicine Formulations */}
        {currentAnalysis.therapeuticPrediction && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <TherapeuticPredictionCard
              prediction={currentAnalysis.therapeuticPrediction}
              isAiDeduction={currentAnalysis.isAiDeduction}
              aiDeductionRationale={currentAnalysis.aiDeductionRationale}
              compoundName={currentAnalysis.compound.name || undefined}
            />
          </div>
        )}

        {/* Autonomous Drug Combinations, Disease Synergy under Conditions & Medicine Engineering */}
        {currentAnalysis && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CombinatorialMedicineCard analysis={currentAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}

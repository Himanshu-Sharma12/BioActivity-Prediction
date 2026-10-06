import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pill, Microscope, Info, Lightbulb, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import MedicineInsightsCard from "@/components/medicine-insights-card";
import { apiRequest } from "@/lib/queryClient";
import type { MedicineNameAnalysisResult } from "@/types/molecular";

export default function IotAnalysisPage() {
  const [medicineName, setMedicineName] = useState("");
  const [medicineResult, setMedicineResult] = useState<MedicineNameAnalysisResult | null>(null);
  const { toast } = useToast();

  const medicineMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const response = await apiRequest('POST', '/api/medicine/analyze-name', { name });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error((errorPayload as { message?: string }).message || 'Failed to analyze medicine');
      }
      return response.json() as Promise<MedicineNameAnalysisResult>;
    },
    onSuccess: (data) => {
      setMedicineResult(data);
      toast({
        title: 'Medicine analyzed',
        description: `Insights generated for ${data?.medicine?.officialName || 'the provided medicine'}.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Medicine analysis failed',
        description: err instanceof Error ? err.message : 'Could not analyze medicine name',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <Microscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Medicine Analysis</h1>
              <p className="text-muted-foreground">
                Generate structured, regulator-aligned insights for prescription and over-the-counter medicines.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Provide any brand or generic name. The platform validates the label, lists active ingredients, indications, usage guidelines, interactions, safety warnings, and returns confidence scoring. Packaging imagery is generated when Gemini has high certainty.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border bg-white dark:bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                Medicine Name Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="medicine-name-input" className="text-sm font-medium text-foreground">
                  Medicine or Brand Name
                </Label>
                <Input
                  id="medicine-name-input"
                  value={medicineName}
                  onChange={(event) => setMedicineName(event.target.value)}
                  placeholder="e.g., Paracetamol, Tylenol, Metformin"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Gemini cross-checks the submitted name, assembles active ingredients, dosage guidance, interactions, and packaging context where possible.
                </p>

                {/* Quick Selection Pills */}
                <div className="pt-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Quick Reference Samples:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Aspirin 500mg',
                      'Paracetamol 500mg',
                      'Metformin 850mg',
                      'Amoxicillin 500mg',
                      'Ibuprofen 400mg',
                      'Atorvastatin 20mg'
                    ].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => {
                          setMedicineName(sample);
                          setMedicineResult(null);
                          medicineMutation.mutate({ name: sample });
                        }}
                        disabled={medicineMutation.isPending}
                        className="px-2.5 py-1 text-xs rounded-full bg-secondary/80 hover:bg-primary/10 hover:text-primary border border-border/60 transition-colors text-foreground"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-md"
                  disabled={medicineMutation.isPending}
                  onClick={() => {
                    if (!medicineName.trim()) {
                      toast({
                        title: 'Missing name',
                        description: 'Provide a medicine or brand name before running analysis.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setMedicineResult(null);
                    medicineMutation.mutate({ name: medicineName.trim() });
                  }}
                >
                  {medicineMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Medicine
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  disabled={medicineMutation.isPending}
                  onClick={() => {
                    setMedicineName('');
                    setMedicineResult(null);
                  }}
                >
                  Clear
                </Button>
              </div>

              <Alert>
                <AlertDescription className="text-xs leading-relaxed">
                  Structured output includes official naming, chemical composition, indications, administration guidance, safety warnings, and confidence scoring. Packaging imagery appears when Gemini is confident in the label.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {medicineResult ? (
              <div className="space-y-4">
                <MedicineInsightsCard
                  nameAnalysis={medicineResult}
                  isAnalyzing={medicineMutation.isPending}
                />
                
                {/* Cross-Link to Molecular Structure Workspace */}
                {medicineResult.activeIngredients && medicineResult.activeIngredients.length > 0 && (
                  <Card className="border border-primary/30 bg-gradient-to-r from-primary/5 via-card to-purple-500/5">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="space-y-0.5 text-center sm:text-left">
                        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                          Molecular Cheminformatics
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Inspect 2D/3D structure & Lipinski rules for <strong className="text-foreground">{medicineResult.activeIngredients[0].name}</strong>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const ingredient = medicineResult.activeIngredients[0];
                          const compoundName = ingredient.name;
                          // Navigate to /analyze with name
                          window.location.href = `/analyze?name=${encodeURIComponent(compoundName)}`;
                        }}
                        className="bg-primary hover:bg-primary/90 text-xs shrink-0"
                      >
                        <Microscope className="w-3.5 h-3.5 mr-1.5" />
                        Analyze Structure
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="border-2 border-dashed">
                <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-3">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  {medicineMutation.isPending
                    ? 'Analyzing medicine…'
                    : 'Run an analysis to see official naming, ingredient details, dosage guidance, and safety information here.'}
                </CardContent>
              </Card>
            )}

            {medicineResult && medicineResult.confidence.level === 'ambiguous' && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">
                  Gemini could not confidently match this medicine. Double-check spelling, include both brand and generic names, and specify dosage strength to improve certainty.
                </AlertDescription>
              </Alert>
            )}

            <Card className="border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="w-4 h-4 text-primary" />
                  Tips for Better Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>• Include both brand and generic names for medicines with multiple formulations.</p>
                <p>• Add the dosage strength (e.g., “Atorvastatin 20 mg tablet”) to improve ingredient disambiguation.</p>
                <p>• Spell out combination therapies (e.g., “Amoxicillin and Clavulanate Potassium”) for more complete composition listings.</p>
                <p>• If Gemini remains unsure, re-run with an alternate brand name or include the intended indication.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

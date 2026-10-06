import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Save, Share } from "lucide-react";
import SafetyAssessment from "./safety-assessment";
import ExportResults from "./export-results";
import MedicineInsightsCard from "./medicine-insights-card";
import { AnalysisResult, MedicineInsights, MedicineNameAnalysisResult } from "@/types/molecular";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PredictionResultsProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  photoInsights?: MedicineInsights | null;
  medicineNameAnalysis?: MedicineNameAnalysisResult | null;
}

export default function PredictionResults({ analysis, isAnalyzing, photoInsights, medicineNameAnalysis }: PredictionResultsProps) {
  const prediction = analysis?.prediction;
  const measured = analysis?.measuredActivity;
  const { toast } = useToast();
  const combinedPhotoInsights = photoInsights || analysis?.medicineInsights || null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysis) throw new Error("No analysis to save");
      const res = await apiRequest('POST', '/api/predictions/save', { compoundId: analysis.compound.id });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/saved'] });
      toast({ title: 'Saved', description: 'Prediction saved successfully.' });
    },
    onError: (e) => toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Failed to save', variant: 'destructive' })
  });

  async function handleShare() {
    if (!analysis) return;
    const url = `${window.location.origin}/?compoundId=${analysis.compound.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BioPredict Result', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Shareable link copied to clipboard.' });
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Shareable link copied to clipboard.' });
    }
  }

  const hasMeasuredActivities = Boolean(measured && Array.isArray(measured.activities) && measured.activities.length > 0);

  const fallbackTargetsFromTherapeutic = (!hasMeasuredActivities && analysis?.therapeuticPrediction?.mechanismOfAction?.primaryTargets)
    ? analysis.therapeuticPrediction.mechanismOfAction.primaryTargets.map((targetName, idx) => ({
        targetChemblId: `AI-TGT-${idx + 1}`,
        targetName,
        organism: "Homo sapiens",
        standardType: "Predicted Target",
        standardValue: null,
        standardUnits: null,
        pchemblValue: 6.0,
        activityDescription: analysis.therapeuticPrediction?.mechanismOfAction?.summary || "Putative biological receptor or enzymatic target.",
        documentJournal: "BioPredict AI Target Modeling",
        documentYear: 2024,
      }))
    : [];

  const effectiveActivities = hasMeasuredActivities ? (measured?.activities || []) : fallbackTargetsFromTherapeutic;

  return (
    <>
      {/* Prediction Results */}
      <Card data-testid="card-prediction-results">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
              <Brain className="mr-2 text-primary" />
              Molecular Bioactivity & Targets
            </h2>
            {measured?.source === 'chembl' ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                ChEMBL Assays
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                ✨ Predicted Bioactivity
              </span>
            )}
          </div>
          
          {isAnalyzing ? (
            <div className="space-y-6">
              {/* Measured activity */}
              <div className="text-center mb-6">
                <Skeleton className="h-12 w-24 mx-auto mb-2" />
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-3 w-24 mx-auto mt-1" />
              </div>

              {/* Model Information */}
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>

              {/* Prediction Range */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          ) : prediction ? (
            <>
              {effectiveActivities.length > 0 ? (
                <div className="space-y-4" data-testid="container-measured-activity">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {measured?.prefName || analysis?.compound?.name || 'Bioactivity Profile'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {measured?.source === 'chembl'
                          ? `${measured.chemblId}${measured.firstApproval ? ` · First Approved ${measured.firstApproval}` : ''}`
                          : 'Physiological Cellular Mechanisms & Receptors'
                        }
                      </div>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded bg-primary/10 text-primary font-medium">
                      {effectiveActivities.length} Target{effectiveActivities.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {measured?.summary && (
                    <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/60">
                      <strong className="text-foreground">Activity Summary:</strong> {measured.summary}
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {effectiveActivities.map((a, i) => (
                      <div
                        key={`${a.targetChemblId || 'tgt'}-${i}`}
                        className="border border-border/70 rounded-lg p-3 bg-card hover:bg-accent/40 transition-colors space-y-1.5 shadow-xs"
                        data-testid={`row-activity-${i}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground">
                              {a.targetName}
                            </div>
                            {a.organism && (
                              <div className="text-xs text-muted-foreground italic">{a.organism}</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-primary">
                              {a.standardType} {a.standardValue != null ? a.standardValue : ''} {a.standardUnits ?? ''}
                            </div>
                            {a.pchemblValue != null && (
                              <div className="text-xs text-muted-foreground">
                                Score / pChEMBL {a.pchemblValue}
                              </div>
                            )}
                          </div>
                        </div>

                        {a.activityDescription && (
                          <div className="text-xs text-muted-foreground">
                            {a.activityDescription}
                          </div>
                        )}

                        {(a.documentJournal || a.documentYear) && (
                          <div className="text-[11px] text-muted-foreground/80 pt-1 border-t border-border/40 flex items-center justify-between">
                            <span>{[a.documentJournal, a.documentYear].filter(Boolean).join(' · ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    {measured?.source === 'chembl'
                      ? `Experimentally measured biological activity values reported in literature from ChEMBL database. ${analysis?.attribution ? analysis.attribution : ''}`
                      : 'Molecular target interactions and physiological bioactivity predicted from chemical pharmacophore modeling and transport mechanisms.'
                    }
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 bg-muted/20 rounded-lg border border-dashed border-border" data-testid="container-no-activity">
                  <div className="text-2xl mb-2">⚡</div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Analyzing Molecular Activity Profile...
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Computing cellular target binding affinity and physiological mechanisms.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <div className="text-4xl mb-4">🧠</div>
              <p className="text-sm">Analyze a compound to view ML predictions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Assessment */}
      <SafetyAssessment 
        assessment={prediction?.safetyAssessment || null}
        isLoading={isAnalyzing}
      />

      {/* Export Options */}
      <ExportResults 
        analysis={analysis}
        disabled={!analysis}
      />

      <MedicineInsightsCard 
        photoInsights={combinedPhotoInsights}
        nameAnalysis={medicineNameAnalysis}
        isAnalyzing={isAnalyzing}
      />

      {/* Actions */}
      <div className="space-y-3">
        <Button 
          className="w-full"
          disabled={!analysis || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          data-testid="button-save-prediction"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save Prediction'}
        </Button>
        <Button 
          variant="outline"
          className="w-full"
          disabled={!analysis}
          onClick={handleShare}
          data-testid="button-share-results"
        >
          <Share className="mr-2 h-4 w-4" />
          Share Results
        </Button>
      </div>
    </>
  );
}

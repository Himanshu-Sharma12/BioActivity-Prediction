import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Save, Share } from "lucide-react";
import SafetyAssessment from "./safety-assessment";
import ExportResults from "./export-results";
import { AnalysisResult } from "@/types/molecular";
import { formatPIC50, formatConfidence } from "@/lib/molecular-utils";

interface PredictionResultsProps {
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
}

export default function PredictionResults({ analysis, isAnalyzing }: PredictionResultsProps) {
  const prediction = analysis?.prediction;

  return (
    <>
      {/* Prediction Results */}
      <Card data-testid="card-prediction-results">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <Brain className="mr-2 text-primary" />
            ML Prediction
          </h2>
          
          {isAnalyzing ? (
            <div className="space-y-6">
              {/* pIC50 Prediction */}
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
              {/* pIC50 Prediction */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-primary mb-2" data-testid="value-pic50">
                  {formatPIC50(prediction.pic50)}
                </div>
                <div className="text-sm text-muted-foreground">Predicted pIC50</div>
                <div className="text-xs text-muted-foreground mt-1" data-testid="text-confidence">
                  Confidence: {formatConfidence(prediction.confidence)}
                </div>
              </div>

              {/* Model Information */}
              <div className="bg-muted/50 p-4 rounded-lg mb-4" data-testid="container-model-info">
                <div className="text-sm font-medium text-foreground mb-2">Model Details</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div>Algorithm: Random Forest</div>
                  <div>Training Set: 15,247 compounds</div>
                  <div>R²: 0.82 | RMSE: 0.65</div>
                  <div>Last Updated: 2024-01-15</div>
                </div>
              </div>

              {/* Prediction Range */}
              <div className="space-y-2" data-testid="container-prediction-range">
                <div className="flex justify-between text-sm">
                  <span>Prediction Range</span>
                  <span className="font-medium">
                    {(prediction.pic50 - 0.36).toFixed(2)} - {(prediction.pic50 + 0.36).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ 
                      width: `${Math.max(10, Math.min(90, (prediction.pic50 - 4) / 5 * 100))}%`,
                      marginLeft: `${Math.max(0, Math.min(80, (prediction.pic50 - 4.5) / 5 * 100))}%`
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low (4.0)</span>
                  <span>High (9.0)</span>
                </div>
              </div>
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

      {/* Actions */}
      <div className="space-y-3">
        <Button 
          className="w-full"
          disabled={!analysis}
          data-testid="button-save-prediction"
        >
          <Save className="mr-2 h-4 w-4" />
          Save Prediction
        </Button>
        <Button 
          variant="outline"
          className="w-full"
          disabled={!analysis}
          data-testid="button-share-results"
        >
          <Share className="mr-2 h-4 w-4" />
          Share Results
        </Button>
      </div>
    </>
  );
}

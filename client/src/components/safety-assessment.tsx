import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";
import { SafetyAssessment } from "@/types/molecular";
import { getRiskColor, getRiskBgColor, getOverallRiskDisplay, formatProbability } from "@/lib/molecular-utils";

interface SafetyAssessmentProps {
  assessment: SafetyAssessment | null;
  isLoading: boolean;
}

export default function SafetyAssessmentComponent({ assessment, isLoading }: SafetyAssessmentProps) {
  const overallRiskDisplay = assessment ? getOverallRiskDisplay(assessment.overallRisk) : null;

  return (
    <Card data-testid="card-safety-assessment">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Shield className="mr-2 text-primary" />
          Safety Assessment
        </h3>
        
        {isLoading ? (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <Skeleton className="h-10 w-32 mx-auto" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : assessment && overallRiskDisplay ? (
          <>
            {/* Risk Level */}
            <div className="text-center mb-4">
              <div className={`inline-flex items-center px-4 py-2 ${overallRiskDisplay.bgColor} ${overallRiskDisplay.color} border rounded-full`}>
                <i className={`${overallRiskDisplay.icon} mr-2`}></i>
                <span className="font-medium" data-testid="text-overall-risk">{overallRiskDisplay.text}</span>
              </div>
            </div>

            {/* Risk Factors */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3" data-testid="risk-hepatotoxicity">
                <div className={`w-3 h-3 rounded-full ${getRiskBgColor(assessment.hepatotoxicity.risk)}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Hepatotoxicity</div>
                  <div className="text-xs text-muted-foreground">
                    {assessment.hepatotoxicity.risk} Risk ({formatProbability(assessment.hepatotoxicity.probability)})
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3" data-testid="risk-cardiotoxicity">
                <div className={`w-3 h-3 rounded-full ${getRiskBgColor(assessment.cardiotoxicity.risk)}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Cardiotoxicity</div>
                  <div className="text-xs text-muted-foreground">
                    {assessment.cardiotoxicity.risk} Risk ({formatProbability(assessment.cardiotoxicity.probability)})
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3" data-testid="risk-mutagenicity">
                <div className={`w-3 h-3 rounded-full ${getRiskBgColor(assessment.mutagenicity.risk)}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Mutagenicity</div>
                  <div className="text-xs text-muted-foreground">
                    {assessment.mutagenicity.risk} Risk ({formatProbability(assessment.mutagenicity.probability)})
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3" data-testid="risk-herg-inhibition">
                <div className={`w-3 h-3 rounded-full ${getRiskBgColor(assessment.hergInhibition.risk)}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">hERG Inhibition</div>
                  <div className="text-xs text-muted-foreground">
                    {assessment.hergInhibition.risk} Risk ({formatProbability(assessment.hergInhibition.probability)})
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between items-center text-sm">
                <span>Safety Score</span>
                <span className={`font-bold ${getRiskColor(assessment.overallRisk)}`} data-testid="text-safety-score">
                  {assessment.overallScore.toFixed(1)}/10
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground py-4">
            <div className="text-4xl mb-2">🛡️</div>
            <p className="text-sm">Analyze a compound to view safety assessment</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

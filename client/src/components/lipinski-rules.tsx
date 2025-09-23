import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle } from "lucide-react";
import { LipinskiRules } from "@/types/molecular";

interface LipinskiRulesProps {
  rules: LipinskiRules | null;
  isLoading: boolean;
}

export default function LipinskiRulesComponent({ rules, isLoading }: LipinskiRulesProps) {
  return (
    <Card data-testid="card-lipinski-rules">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <CheckCircle className="mr-2 text-success" />
          Lipinski's Rule of Five
        </h3>
        
        <div className="space-y-3">
          {isLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <Skeleton className="h-6 w-48" />
              </div>
            </>
          ) : rules ? (
            <>
              {rules.rules.map((rule, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between"
                  data-testid={`rule-${index}`}
                >
                  <span className="text-sm">{rule.name}</span>
                  {rule.passed ? (
                    <CheckCircle className="h-4 w-4 text-success" data-testid={`icon-rule-${index}-passed`} />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" data-testid={`icon-rule-${index}-failed`} />
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center" data-testid="overall-result">
                  {rules.passed === rules.total ? (
                    <CheckCircle className="text-success mr-2 h-5 w-5" />
                  ) : (
                    <XCircle className="text-warning mr-2 h-5 w-5" />
                  )}
                  <span className={`text-sm font-medium ${
                    rules.passed === rules.total ? 'text-success' : 'text-warning'
                  }`}>
                    {rules.passed === rules.total 
                      ? `Drug-like (${rules.passed}/${rules.total} rules passed)` 
                      : `Potential issues (${rules.passed}/${rules.total} rules passed)`
                    }
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">Analyze a compound to view Lipinski rules</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

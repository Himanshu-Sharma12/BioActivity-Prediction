import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, AlertTriangle, CheckCircle2, Info, FlaskConical, BookOpen } from "lucide-react";
import { SafetyAssessment, StructuralAlert, RuleSet } from "@/types/molecular";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SafetyAssessmentProps {
  assessment: SafetyAssessment | null;
  isLoading: boolean;
}

type ConcernLevel = SafetyAssessment["concernLevel"];
type Severity = StructuralAlert["severity"];

/**
 * Display copy for the concern level.
 *
 * `none` must read as "nothing matched", never as "this compound is safe" — the
 * screened alert sets cover a subset of known liabilities, so a clean result is
 * an absence of evidence, not evidence of absence.
 */
const concernDisplay: Record<ConcernLevel, {
  text: string;
  detail: string;
  color: string;
  bgColor: string;
}> = {
  none: {
    text: "No Alerts Matched",
    detail: "No substructure from the screened alert sets was found.",
    color: "text-success",
    bgColor: "bg-success/10 border-success/20",
  },
  low: {
    text: "Low-Severity Alerts",
    detail: "Only low-severity substructure alerts matched.",
    color: "text-success",
    bgColor: "bg-success/10 border-success/20",
  },
  moderate: {
    text: "Moderate-Severity Alerts",
    detail: "At least one moderate-severity substructure alert matched.",
    color: "text-warning",
    bgColor: "bg-warning/10 border-warning/20",
  },
  high: {
    text: "High-Severity Alerts",
    detail: "At least one high-severity substructure alert matched.",
    color: "text-destructive",
    bgColor: "bg-destructive/10 border-destructive/20",
  },
};

const severityBadgeClass: Record<Severity, string> = {
  low: "bg-success/10 text-success border-success/30",
  moderate: "bg-warning/10 text-warning border-warning/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
};

function RuleTable({ title, ruleSet, testId }: { title: string; ruleSet: RuleSet; testId: string }) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden" data-testid={testId}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary flex-shrink-0" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <Badge
          variant="outline"
          className={ruleSet.passed ? severityBadgeClass.low : severityBadgeClass.moderate}
        >
          {ruleSet.violations === 0
            ? "No violations"
            : `${ruleSet.violations} violation${ruleSet.violations === 1 ? "" : "s"}`}
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Rule</TableHead>
            <TableHead className="text-xs text-right">Value</TableHead>
            <TableHead className="text-xs text-right">Threshold</TableHead>
            <TableHead className="text-xs text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ruleSet.rules.map((rule) => (
            <TableRow key={rule.name}>
              <TableCell className="text-xs font-medium text-foreground">{rule.name}</TableCell>
              <TableCell className="text-xs text-right font-mono text-muted-foreground">
                {rule.value}
              </TableCell>
              <TableCell className="text-xs text-right font-mono text-muted-foreground">
                {rule.threshold}
              </TableCell>
              <TableCell className="text-xs text-right">
                <span className={rule.passed ? "text-success font-medium" : "text-destructive font-medium"}>
                  {rule.passed ? "PASS" : "FAIL"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-start gap-2 px-4 py-3 border-t border-border/50 bg-muted/20">
        <BookOpen className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">{ruleSet.citation}</p>
      </div>
    </div>
  );
}

export default function SafetyAssessmentComponent({ assessment, isLoading }: SafetyAssessmentProps) {
  const concern = assessment ? concernDisplay[assessment.concernLevel] : null;

  return (
    <Card data-testid="card-safety-assessment">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Shield className="mr-2 text-primary" />
          Safety Assessment
        </h3>

        {isLoading ? (
          <div className="space-y-6">
            <div className="text-center mb-6 py-6">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }}></div>
                <div className="absolute w-20 h-20 rounded-full bg-primary/30 animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                  <Shield className="w-8 h-8 text-white animate-bounce" style={{ animationDuration: '1s' }} />
                </div>
              </div>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-sm font-medium text-primary animate-pulse">Screening structural alerts...</p>
                <p className="text-xs text-muted-foreground">Matching Brenk and PAINS substructures and evaluating rule sets</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { icon: AlertTriangle, label: 'Structural alerts', delay: '0ms' },
                { icon: FlaskConical, label: 'Lipinski rules', delay: '200ms' },
                { icon: FlaskConical, label: 'Veber rules', delay: '400ms' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-900/50 animate-pulse"
                    style={{ animationDelay: item.delay, animationDuration: '1.5s' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-400 animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : assessment && concern ? (
          <>
            {/* Concern level header */}
            <div className="text-center mb-6 relative">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="w-48 h-48 rounded-full bg-gradient-to-r from-primary to-purple-500 blur-3xl"></div>
              </div>
              <div className="relative">
                <div className={`inline-flex items-center gap-3 px-6 py-3 ${concern.bgColor} ${concern.color} border-2 rounded-2xl shadow-lg backdrop-blur-sm`}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                    {assessment.concernLevel === 'none' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-medium opacity-80">Concern Level</div>
                    <span className="text-lg font-bold" data-testid="text-concern-level">{concern.text}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{concern.detail}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="mb-6 p-4 rounded-xl border border-border/50 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-900/50">
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-safety-summary">
                {assessment.summary}
              </p>
            </div>

            {/* Structural alerts */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Structural Alerts</h4>
                <span className="text-xs text-muted-foreground" data-testid="text-alert-counts">
                  {assessment.alertCounts.total} matched
                  {assessment.alertCounts.total > 0 && (
                    <> · {assessment.alertCounts.high} high · {assessment.alertCounts.moderate} moderate · {assessment.alertCounts.low} low</>
                  )}
                </span>
              </div>

              {assessment.structuralAlerts.length === 0 ? (
                <div
                  className="flex items-start gap-3 p-4 rounded-xl border border-dashed border-border/60 bg-muted/20"
                  data-testid="empty-structural-alerts"
                >
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No substructure from the screened Brenk or PAINS alert sets matched this structure.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3" data-testid="list-structural-alerts">
                  {assessment.structuralAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-slate-50/50 to-transparent dark:from-slate-900/40"
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-foreground">{alert.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className={`text-xs ${severityBadgeClass[alert.severity]}`}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {alert.source}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.concern}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Drug-likeness rule sets */}
            <div className="space-y-4 mb-6">
              <RuleTable
                title="Lipinski's Rule of Five"
                ruleSet={assessment.drugLikeness.lipinski}
                testId="table-lipinski"
              />
              <RuleTable
                title="Veber Rules"
                ruleSet={assessment.drugLikeness.veber}
                testId="table-veber"
              />
            </div>

            {/* Coverage and disclaimer — always visible, never collapsed */}
            <div className="space-y-3 pt-6 border-t-2 border-dashed border-border/50">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-coverage-brenk">
                    {assessment.coverage.brenk}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-coverage-pains">
                    {assessment.coverage.pains}
                  </p>
                </div>
              </div>

              <p
                className="text-xs font-medium text-foreground leading-relaxed p-3 rounded-lg border border-warning/30 bg-warning/10"
                data-testid="text-coverage-note"
              >
                {assessment.coverage.note}
              </p>

              <p
                className="text-xs text-muted-foreground leading-relaxed p-3 rounded-lg border border-border/50 bg-muted/20"
                data-testid="text-disclaimer"
              >
                {assessment.disclaimer}
              </p>
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

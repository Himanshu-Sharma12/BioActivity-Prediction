import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  HeartPulse, 
  Pill, 
  Activity, 
  Sparkles, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Microscope,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Brain
} from "lucide-react";
import type { TherapeuticPrediction } from "@/types/molecular";

interface TherapeuticPredictionCardProps {
  prediction?: TherapeuticPrediction | null;
  isLoading?: boolean;
  isAiDeduction?: boolean;
  aiDeductionRationale?: string;
  compoundName?: string;
}

export default function TherapeuticPredictionCard({
  prediction,
  isLoading,
  isAiDeduction,
  aiDeductionRationale,
  compoundName
}: TherapeuticPredictionCardProps) {
  if (isLoading) {
    return (
      <Card className="border border-border/80 shadow-md">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) {
    return null;
  }

  const { targetDiseases, mechanismOfAction, potentialMedicines, therapeuticIndex, synthesisAndDerivatives } = prediction;

  const getCategoryColor = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('oncol') || cat.includes('cancer')) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (cat.includes('cardio') || cat.includes('heart')) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (cat.includes('neuro') || cat.includes('brain')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (cat.includes('immun') || cat.includes('inflam')) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (cat.includes('infect') || cat.includes('antibiot')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    if (cat.includes('metabol') || cat.includes('diabet')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    return 'bg-primary/10 text-primary border-primary/20';
  };

  const getRelevanceBadge = (relevance: string) => {
    switch (relevance) {
      case 'primary':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-semibold">Primary Indication</Badge>;
      case 'secondary':
        return <Badge variant="secondary" className="text-[10px] uppercase font-semibold">Secondary Effect</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground">Investigational</Badge>;
    }
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg overflow-hidden">
      {/* Novel / Unindexed Compound AI Deduction Banner */}
      {isAiDeduction && (
        <div className="bg-gradient-to-r from-purple-600/20 via-primary/20 to-pink-600/20 border-b border-primary/30 p-3 px-6 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5 text-xs">
            <span className="font-bold text-foreground">
              Unindexed Chemical Entity — AI Structure Deduction Active
            </span>
            <p className="text-muted-foreground leading-relaxed">
              {aiDeductionRationale || "This compound was not indexed in PubChem; its chemical scaffold and SMILES notation were deduced from medicinal chemistry naming rules and verified with RDKit."}
            </p>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md">
              <HeartPulse className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Therapeutic Disease Impact & Medicine Potential
              </span>
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                Target disease indications, mechanism of action, and formulation candidates for {compoundName || 'this molecule'}
              </span>
            </div>
          </CardTitle>
          <Badge variant="outline" className="border-primary/40 text-primary text-xs w-fit">
            <Brain className="w-3 h-3 mr-1" />
            Pharmacological Prediction
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Mechanism of Action Banner */}
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Activity className="w-3.5 h-3.5" />
            Predicted Mechanism of Action (MoA)
          </div>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {mechanismOfAction.summary}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted-foreground font-medium">Primary Targets:</span>
            {mechanismOfAction.primaryTargets.map((target, idx) => (
              <Badge key={idx} variant="secondary" className="font-mono text-xs bg-card border border-border/60">
                <Target className="w-3 h-3 mr-1 text-primary" />
                {target}
              </Badge>
            ))}
          </div>
        </div>

        {/* Target Diseases Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-primary" />
              Target Disease Indications ({targetDiseases.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Efficacy & Pathological Targets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {targetDiseases.map((disease, idx) => (
              <div 
                key={idx} 
                className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2 hover:border-primary/50 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{disease.disease}</h4>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getCategoryColor(disease.category)}`}>
                      {disease.category}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {getRelevanceBadge(disease.relevance)}
                    <div className="text-[11px] font-mono text-muted-foreground mt-1">
                      {disease.confidenceScore}% Confidence
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                  {disease.mechanismRationale}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Potential Medicines That Can Be Formulated */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-primary" />
              Formulation Candidates & Potential Medicines
            </span>
            <span className="text-[11px] text-muted-foreground">Dosage forms & clinical translation</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {potentialMedicines.map((med, idx) => (
              <div 
                key={idx} 
                className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5 p-4 space-y-2.5 hover:border-primary/40 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-primary shrink-0" />
                      <h4 className="font-bold text-sm text-foreground">{med.medicineName}</h4>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium block mt-0.5">
                      Class: {med.drugClass}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary shrink-0">
                    {med.developmentStage}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-card/60 p-2.5 rounded-lg border border-border/50">
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Dosage Form</span>
                    <span className="font-semibold text-foreground">{med.dosageForm}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-semibold block">Route</span>
                    <span className="font-semibold text-foreground">{med.proposedRoute}</span>
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Indication:</strong> {med.targetIndication}
                  </div>
                  <div className="text-muted-foreground text-[11px] italic">
                    {med.formulationNotes}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Window & Chemical Optimization */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* Therapeutic Margin */}
          <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                Therapeutic Window Margin
              </span>
              <Badge 
                variant={therapeuticIndex.window === 'wide' ? 'default' : therapeuticIndex.window === 'narrow' ? 'destructive' : 'secondary'}
                className="text-[10px] uppercase"
              >
                {therapeuticIndex.window} Window
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {therapeuticIndex.assessment}
            </p>
          </div>

          {/* Chemical Derivatives & Optimization */}
          <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-primary" />
              Medicinal Chemistry Optimization
            </span>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              {synthesisAndDerivatives.suggestedModifications.map((mod, idx) => (
                <li key={idx} className="leading-tight">{mod}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

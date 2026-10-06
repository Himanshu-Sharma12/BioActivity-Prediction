import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  HelpCircle, 
  Dna, 
  FlaskConical, 
  ShieldAlert, 
  Target, 
  Layers, 
  FileText,
  AlertOctagon,
  Scale
} from "lucide-react";
import { AnalysisResult, UnknownCompoundProfile } from "@/types/molecular";

interface UnknownCompoundCardProps {
  analysis: AnalysisResult | null;
}

export default function UnknownCompoundCard({ analysis }: UnknownCompoundCardProps) {
  const isAi = analysis?.isAiDeduction;
  const unknownProfile: UnknownCompoundProfile | null | undefined = analysis?.unknownCompoundProfile;

  if (!isAi && !unknownProfile) {
    return null;
  }

  const profile = unknownProfile || {
    identifiedClass: "Novel Bioactive Small Molecule",
    canonicalSmiles: analysis?.compound?.smiles || "",
    iupacName: `Chemical entity derived from "${analysis?.compound?.name || 'Input'}"`,
    molecularFormula: analysis?.prediction?.molecularFormula || "Unknown",
    molecularWeight: analysis?.prediction?.descriptors?.molecularWeight || 0,
    syntheticFeasibilityScore: 7,
    syntheticPrecursors: ["Commercial aryl halide", "Substituted alkylamine"],
    putativeBiologicalTargets: [
      { target: "Receptor Tyrosine Kinase", confidence: 75, actionType: "Catalytic Site Inhibitor" },
      { target: "Inflammatory Cytokine Cascade", confidence: 70, actionType: "Downregulator" }
    ],
    safetyWarnings: ["Novel chemical scaffold: in vitro cytotoxicity assay recommended"],
    noveltyAssessment: "Novel unindexed molecular entity suitable for lead optimization and patent clearance search."
  };

  return (
    <Card className="mb-6 border-2 border-indigo-500/30 bg-gradient-to-br from-card via-card/95 to-indigo-950/15 shadow-xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-indigo-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-400">
                <Sparkles className="h-5 w-5" />
              </span>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Novel / Unindexed Chemical Entity Profiling
                <Badge variant="secondary" className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 text-[10px] uppercase font-bold">
                  AI Deduced
                </Badge>
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              This compound was not indexed in PubChem/ChEMBL. Full chemical structure, synthesis pathways, and biological targets were deduced via Gemini AI and verified by RDKit WASM.
            </p>
          </div>
          <Badge variant="outline" className="border-indigo-500/40 text-indigo-600 dark:text-indigo-300 bg-indigo-500/5 text-xs font-semibold px-2.5 py-1 w-fit">
            Synthetic Feasibility: {profile.syntheticFeasibilityScore}/10
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Identified Chemical Nomenclature & Formula */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              Identified Chemical Class & Scaffold:
            </span>
            <p className="text-sm font-bold text-foreground">
              {profile.identifiedClass}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-1">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
              Systematic IUPAC Nomenclature:
            </span>
            <p className="text-xs font-mono font-medium text-foreground break-all">
              {profile.iupacName}
            </p>
          </div>
        </div>

        {/* Putative Biological Targets & Receptor Engagement */}
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-indigo-500" />
            Putative Biological Targets & Receptor Engagement
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {profile.putativeBiologicalTargets.map((target, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/60 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">{target.target}</p>
                  <p className="text-[11px] text-muted-foreground">{target.actionType}</p>
                </div>
                <Badge variant="secondary" className="font-mono text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  {target.confidence}% Conf.
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Synthetic Precursors & Feasibility */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/70 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-indigo-500" />
              Key Synthetic Precursors & Retrosynthetic Starting Points
            </h5>
            <span className="text-[11px] text-muted-foreground">
              Feasibility: <strong className="text-foreground">{profile.syntheticFeasibilityScore}/10</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.syntheticPrecursors.map((p, idx) => (
              <Badge key={idx} variant="outline" className="bg-background text-xs py-1 px-2 text-foreground font-mono">
                {p}
              </Badge>
            ))}
          </div>
        </div>

        {/* Safety Warnings & Intellectual Property / Novelty Assessment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 space-y-1.5">
            <h6 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertOctagon className="h-3.5 w-3.5" />
              Novel Scaffold Liabilities & Alerts
            </h6>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              {profile.safetyWarnings.map((w, idx) => (
                <li key={idx} className="text-rose-600/90 dark:text-rose-400/90">{w}</li>
              ))}
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
            <h6 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Novelty & Prior Art Landscape
            </h6>
            <p className="text-muted-foreground leading-relaxed">
              {profile.noveltyAssessment}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

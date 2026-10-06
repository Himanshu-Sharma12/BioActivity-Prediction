import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, 
  Layers, 
  FlaskConical, 
  ShieldAlert, 
  Clock, 
  Dna, 
  Activity, 
  Pill, 
  Search, 
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  Thermometer
} from "lucide-react";
import { AnalysisResult, CombinatorialPartner, CombinatorialAnalysisResult } from "@/types/molecular";

interface CombinatorialMedicineCardProps {
  analysis: AnalysisResult | null;
}

export default function CombinatorialMedicineCard({ analysis }: CombinatorialMedicineCardProps) {
  const [selectedPartnerIndex, setSelectedPartnerIndex] = useState(0);
  const [customPartnerInput, setCustomPartnerInput] = useState("");
  const [isEvaluatingCustom, setIsEvaluatingCustom] = useState(false);
  const [dynamicResult, setDynamicResult] = useState<CombinatorialAnalysisResult | null>(null);

  const compound = analysis?.compound;
  const combinatorialData = dynamicResult || analysis?.combinatorialProfile;

  if (!compound || !combinatorialData || !combinatorialData.autonomousCombinations?.length) {
    return null;
  }

  const combinations = combinatorialData.autonomousCombinations;
  const currentComb: CombinatorialPartner = combinations[selectedPartnerIndex] || combinations[0];

  const handleEvaluateCustom = async () => {
    if (!customPartnerInput.trim()) return;
    setIsEvaluatingCustom(true);
    try {
      const res = await fetch("/api/compounds/combinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: compound.name || compound.smiles,
          smiles: compound.smiles,
          partnerName: customPartnerInput.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDynamicResult(data);
        setSelectedPartnerIndex(0);
        if (analysis) {
          try {
            const stored = sessionStorage.getItem('currentAnalysis');
            const current = stored ? JSON.parse(stored) : analysis;
            sessionStorage.setItem('currentAnalysis', JSON.stringify({ ...current, combinatorialProfile: data }));
          } catch {
            // ignore storage error
          }
        }
      }
    } catch (err) {
      console.error("Custom combination evaluation failed:", err);
    } finally {
      setIsEvaluatingCustom(false);
    }
  };

  return (
    <Card className="mb-6 border border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/5 shadow-lg overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </span>
              <CardTitle className="text-lg font-bold text-foreground">
                Autonomous Drug Combinations & Condition-Specific Formulations
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Predicting disease synergy, clinical conditions for efficacy, and autonomous medicine engineering for <strong className="text-foreground">{compound.name || "this molecule"}</strong>.
            </p>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 w-fit text-xs font-semibold px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            AI Combinatorial Engine
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* Custom Combination Interactive Bar */}
        <div className="p-3 rounded-xl bg-background/80 border border-border/70 flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={customPartnerInput}
              onChange={(e) => setCustomPartnerInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEvaluateCustom()}
              placeholder="Test pairing with any drug or compound (e.g. Metformin, Curcumin, Paclitaxel, Piperine)..."
              className="pl-9 h-9 text-xs bg-card"
            />
          </div>
          <Button
            size="sm"
            onClick={handleEvaluateCustom}
            disabled={isEvaluatingCustom || !customPartnerInput.trim()}
            className="w-full sm:w-auto h-9 text-xs gap-1.5 px-4"
          >
            {isEvaluatingCustom ? "Analyzing Pair..." : "Evaluate Custom Pair"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Combination Selector Tabs */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Predicted Synergistic Partners ({combinations.length})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {combinations.map((comb, idx) => {
              const isSelected = idx === selectedPartnerIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPartnerIndex(idx)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-muted/30 border-border hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {comb.partnerName}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className={`text-[10px] font-mono px-1.5 py-0.5 ${
                        comb.synergyIndex < 0.7 
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}
                    >
                      CI {comb.synergyIndex.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {comb.partnerRole}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Combination Deep Dive */}
        {currentComb && (
          <div className="space-y-5 animate-in fade-in-50 duration-300">
            {/* Top Partner Overview Banner */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-foreground">
                    {compound.name || "Compound"} + {currentComb.partnerName}
                  </h4>
                  <Badge variant="outline" className="text-xs font-semibold border-primary/40 bg-primary/5 text-primary">
                    {currentComb.partnerRole}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Chou-Talalay Combination Index: <span className="font-semibold text-foreground">{currentComb.synergyIndex.toFixed(2)}</span> — {currentComb.synergyAssessment}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Synergy Level</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {currentComb.synergyIndex < 0.7 ? "High Therapeutic Synergy" : "Synergistic Co-Action"}
                  </p>
                </div>
              </div>
            </div>

            {/* Target Diseases Treated under Combination */}
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Target Diseases & Therapeutic Synergy Effects
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentComb.targetDiseases.map((target, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-card border border-border/70 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{target.disease}</span>
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                        +{target.efficacyBoostPct}% Efficacy
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {target.category}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {target.synergyMechanism}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Under Which Conditions Section (User's specific requirement) */}
            <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-3">
              <h5 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5" />
                Under Which Conditions & Patient Context This Works
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/15">
                  <span className="font-semibold text-foreground block mb-1 flex items-center gap-1">
                    <FlaskConical className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    Physiological Microenvironment:
                  </span>
                  <p className="text-muted-foreground">
                    {currentComb.requiredConditions?.physiologicalContext || "Standard physiological pH and tissue perfusion."}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/15">
                  <span className="font-semibold text-foreground block mb-1 flex items-center gap-1">
                    <Dna className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    Patient Biomarkers / Eligibility:
                  </span>
                  <p className="text-muted-foreground">
                    {currentComb.requiredConditions?.patientBiomarkers || "Patients with elevated target receptor expression."}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/15">
                  <span className="font-semibold text-foreground block mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    Dosing Regimen & Timing:
                  </span>
                  <p className="text-muted-foreground">
                    {currentComb.requiredConditions?.administrationTiming || "Co-administered simultaneously with meal."}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/15">
                  <span className="font-semibold text-foreground block mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Contraindicated Conditions:
                  </span>
                  <ul className="text-muted-foreground list-disc list-inside space-y-0.5">
                    {currentComb.requiredConditions?.contraindicatedConditions?.map((c, i) => (
                      <li key={i} className="text-rose-600/90 dark:text-rose-400/90">{c}</li>
                    )) || <li>Severe hepatic or renal impairment</li>}
                  </ul>
                </div>
              </div>
            </div>

            {/* What Type of Medicine Can Be Made Section (User's specific requirement) */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
              <h5 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="h-3.5 w-3.5" />
                What Type of Medicine Can Be Made (Autonomous Formulation)
              </h5>

              <div className="p-3.5 rounded-xl bg-card border border-primary/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div>
                    <h6 className="text-sm font-bold text-foreground">
                      {currentComb.medicineFormulation?.medicineName || "Combinatorial Candidate"}
                    </h6>
                    <p className="text-xs text-primary font-medium">
                      {currentComb.medicineFormulation?.formulationType}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs font-mono bg-primary/10 text-primary border-primary/30">
                    Route: {currentComb.medicineFormulation?.deliveryRoute || "Oral"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium block">Optimal Active Dose Ratio:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {currentComb.medicineFormulation?.doseRatio}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium block">Formulation Technology & Excipients:</span>
                    <p className="text-foreground/90 mt-0.5">
                      {currentComb.medicineFormulation?.excipientsAndTech}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground font-medium block">Storage & Stability:</span>
                    <p className="text-foreground/80 mt-0.5">
                      {currentComb.medicineFormulation?.stabilityAndStorage}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

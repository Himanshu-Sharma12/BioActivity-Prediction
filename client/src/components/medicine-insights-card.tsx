import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pill, ShieldAlert, Stethoscope, Syringe } from "lucide-react";
import type {
  MedicineInsights,
  MedicineNameAnalysisResult,
} from "@/types/molecular";

interface MedicineInsightsCardProps {
  photoInsights?: MedicineInsights | null;
  nameAnalysis?: MedicineNameAnalysisResult | null;
  isAnalyzing?: boolean;
}

function renderList(items: string[] | undefined, emptyLabel = "Not available") {
  if (!items || items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-1 space-y-1 text-xs">
      {items.map((item, idx) => (
        <li key={idx} className="text-foreground/90">• {item}</li>
      ))}
    </ul>
  );
}

export default function MedicineInsightsCard({
  photoInsights,
  nameAnalysis,
  isAnalyzing,
}: MedicineInsightsCardProps) {
  const hasPhotoInsights = Boolean(photoInsights);
  const hasNameAnalysis = Boolean(nameAnalysis);

  if (!hasPhotoInsights && !hasNameAnalysis) {
    return null;
  }

  const insights = photoInsights;
  const analysis = nameAnalysis;

  return (
    <Card data-testid="card-medicine-insights">
      <CardContent className="p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            Medicine Insights
          </h3>
          {isAnalyzing && <Badge variant="outline">Updating…</Badge>}
        </header>

        {analysis && (
          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Official Name</p>
              <p className="text-xs text-muted-foreground">{analysis.medicine.officialName}</p>
              {analysis.medicine.brandNames?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {analysis.medicine.brandNames.map((brand) => (
                    <Badge key={brand} variant="secondary">{brand}</Badge>
                  ))}
                </div>
              ) : null}
            </div>

            {analysis.activeIngredients?.length ? (
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Syringe className="h-4 w-4 text-primary" /> Active Ingredients
                </p>
                <ScrollArea className="max-h-40 mt-2 pr-2">
                  <div className="space-y-3">
                    {analysis.activeIngredients.map((ingredient, idx) => (
                      <div key={`${ingredient.name}-${idx}`} className="rounded-md border border-border/60 p-3">
                        <p className="text-xs font-semibold text-foreground">{ingredient.name}</p>
                        <p className="text-xs text-muted-foreground">{ingredient.purpose}</p>
                        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
                          {ingredient.chemicalClass && <span><span className="font-medium text-foreground/80">Class:</span> {ingredient.chemicalClass}</span>}
                          {ingredient.strengths?.length ? (
                            <span><span className="font-medium text-foreground/80">Strengths:</span> {ingredient.strengths.join(", ")}</span>
                          ) : null}
                          {ingredient.smiles && (
                            <span className="font-mono break-all"><span className="font-medium text-foreground/80">SMILES:</span> {ingredient.smiles}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : null}

            {analysis.chemicalComposition?.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Chemical Composition</p>
                <div className="space-y-2 text-xs">
                  {analysis.chemicalComposition.map((component, idx) => (
                    <div key={`${component.compound}-${idx}`} className="rounded-md border border-border/60 p-3">
                      <p className="font-medium text-foreground/90">{component.compound}</p>
                      <p className="text-muted-foreground">Role: {component.role || "Unknown"}</p>
                      {component.smiles && (
                        <p className="font-mono break-all text-muted-foreground/80 mt-1">SMILES: {component.smiles}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.indications?.length ? (
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" /> Indications
                </p>
                {renderList(analysis.indications, "No indications identified")}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">Usage Guidelines</p>
                <p><span className="font-medium text-foreground/80">Dosage:</span> {analysis.usageGuidelines.typicalDosage || "Not available"}</p>
                <p><span className="font-medium text-foreground/80">Timing:</span> {analysis.usageGuidelines.timing || "Not available"}</p>
                <p><span className="font-medium text-foreground/80">Route:</span> {analysis.usageGuidelines.route || "Not available"}</p>
                {analysis.usageGuidelines.ageRestrictions ? (
                  <p><span className="font-medium text-foreground/80">Age Restrictions:</span> {analysis.usageGuidelines.ageRestrictions}</p>
                ) : null}
                <p><span className="font-medium text-foreground/80">Overdose Risks:</span> {analysis.usageGuidelines.overdoseRisks || "Not available"}</p>
              </div>

              <div className="rounded-md border border-border/60 p-3 space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-primary" /> Safety Information
                </p>
                <div className="text-xs space-y-1">
                  <p><span className="font-medium text-foreground/80">Prescription required:</span> {analysis.safetyInformation.prescriptionRequired ? "Yes" : "No"}</p>
                  <div>
                    <span className="font-medium text-foreground/80">Side effects:</span>
                    {renderList(analysis.safetyInformation.sideEffects)}
                  </div>
                  <div>
                    <span className="font-medium text-foreground/80">Contraindications:</span>
                    {renderList(analysis.safetyInformation.contraindications)}
                  </div>
                  <p><span className="font-medium text-foreground/80">Pregnancy:</span> {analysis.safetyInformation.pregnancyWarnings || "Not specified"}</p>
                  <p><span className="font-medium text-foreground/80">Liver:</span> {analysis.safetyInformation.liverWarnings || "Not specified"}</p>
                  <p><span className="font-medium text-foreground/80">Kidney:</span> {analysis.safetyInformation.kidneyWarnings || "Not specified"}</p>
                  <div>
                    <span className="font-medium text-foreground/80">Interactions:</span>
                    {renderList(analysis.safetyInformation.interactions)}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence: {(analysis.confidence.score ?? 0).toFixed(2)} ({analysis.confidence.level})</span>
              {analysis.confidence.rationale && (
                <span className="max-w-[60%] truncate" title={analysis.confidence.rationale}>
                  {analysis.confidence.rationale}
                </span>
              )}
            </div>

            {analysis.imageBase64 && (
              <div className="rounded-md border border-border/60 overflow-hidden">
                <img src={analysis.imageBase64} alt={`${analysis.medicine.officialName} packaging`} className="w-full object-cover" />
              </div>
            )}
          </section>
        )}

        {analysis && insights ? <Separator /> : null}

        {!analysis && insights && (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">Photo-based summary</p>
            <p className="text-sm font-medium text-foreground">{insights.summary}</p>
            {insights.compoundCandidates?.length ? (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Top candidates:</span>
                <ul className="mt-1 space-y-1">
                  {insights.compoundCandidates.slice(0, 3).map((candidate, idx) => (
                    <li key={`${candidate.name}-${idx}`}>
                      {candidate.name} ({(candidate.confidence * 100).toFixed(0)}% confidence)
                      {candidate.smiles ? <span className="block font-mono break-all text-muted-foreground/80">{candidate.smiles}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 text-xs">
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">Usage</p>
                <p><span className="font-medium text-foreground/80">Dosage:</span> {insights.usageGuidelines.dosage || "Not available"}</p>
                <p><span className="font-medium text-foreground/80">Timing:</span> {insights.usageGuidelines.timing || "Not available"}</p>
                <p><span className="font-medium text-foreground/80">Route:</span> {insights.usageGuidelines.route || "Not available"}</p>
                <p><span className="font-medium text-foreground/80">Instructions:</span> {insights.usageGuidelines.instructions || "Not available"}</p>
              </div>
              <div className="rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">Safety</p>
                <p><span className="font-medium text-foreground/80">Prescription:</span> {insights.safety.prescriptionStatus || "Not specified"}</p>
                <div>
                  <span className="font-medium text-foreground/80">Warnings:</span>
                  {renderList(insights.safety.warnings)}
                </div>
                <div>
                  <span className="font-medium text-foreground/80">Contraindications:</span>
                  {renderList(insights.safety.contraindications)}
                </div>
                <div>
                  <span className="font-medium text-foreground/80">Side effects:</span>
                  {renderList(insights.safety.sideEffects)}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Confidence: {(insights.confidence.score ?? 0).toFixed(2)} ({insights.confidence.labelReadable ? "Label readable" : "Label unclear"})
              {insights.confidence.rationale ? ` — ${insights.confidence.rationale}` : ""}
            </div>
            {insights.rxNorm?.rxcui || insights.openFDALabel ? (
              <div className="rounded-md border border-border/60 p-3 text-xs">
                <p className="text-sm font-medium text-foreground">Regulatory Enrichment</p>
                {insights.rxNorm?.rxcui && (
                  <p>RxNorm ID: {insights.rxNorm.rxcui}</p>
                )}
                {insights.openFDALabel?.warnings?.length ? (
                  <div className="mt-2">
                    <p className="font-medium text-foreground/80">FDA Label Warnings:</p>
                    {renderList(insights.openFDALabel.warnings)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import CompoundInput from "@/components/compound-input";
import MolecularVisualization from "@/components/molecular-visualization";
import PredictionResults from "@/components/prediction-results";
import TherapeuticPredictionCard from "@/components/therapeutic-prediction-card";
import CombinatorialMedicineCard from "@/components/combinatorial-medicine-card";
import UnknownCompoundCard from "@/components/unknown-compound-card";
import { LoadingOverlay } from "@/components/loading-animation";
import { AnalysisResult, MedicineInsights, MedicineNameAnalysisResult } from "@/types/molecular";
import { apiRequest } from "@/lib/queryClient";

export default function Dashboard() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [currentMedicineInsights, setCurrentMedicineInsights] = useState<MedicineInsights | null>(null);
  const [currentMedicineNameAnalysis, setCurrentMedicineNameAnalysis] = useState<MedicineNameAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'analyzing' | 'generating' | 'calculating' | 'predicting'>('analyzing');

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setCurrentAnalysis(result);
    setCurrentMedicineInsights(result.medicineInsights ?? null);
    setCurrentMedicineNameAnalysis(null);
    setIsAnalyzing(false);
    // Store in sessionStorage for access in other pages
    sessionStorage.setItem('currentAnalysis', JSON.stringify(result));
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
    // Simulate loading phases
    setLoadingPhase('analyzing');
    setTimeout(() => setLoadingPhase('generating'), 1500);
    setTimeout(() => setLoadingPhase('calculating'), 3000);
    setTimeout(() => setLoadingPhase('predicting'), 4500);
  };

  const handleAnalysisError = () => {
    setIsAnalyzing(false);
  };

  // If route has ?compoundId=... or ?smiles=... load that analysis initially
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('compoundId');
    const urlSmiles = params.get('smiles');
    const urlName = params.get('name');
    
    // Check if there's a pending compound from IoT analysis or welcome page
    const pendingCompound = sessionStorage.getItem('pendingCompound');
    
    if (urlSmiles) {
      setIsAnalyzing(true);
      setLoadingPhase('analyzing');
      apiRequest('POST', '/api/compounds/analyze', { smiles: urlSmiles, name: urlName || undefined })
        .then(res => res.json())
        .then((data) => {
          setCurrentAnalysis(data);
          setCurrentMedicineInsights(data?.medicineInsights ?? null);
          setCurrentMedicineNameAnalysis(null);
          sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
        })
        .catch((err) => {
          console.error('Failed to analyze URL compound:', err);
        })
        .finally(() => setIsAnalyzing(false));
    } else if (pendingCompound) {
      try {
        const { smiles, name } = JSON.parse(pendingCompound);
        // Clear the pending compound
        sessionStorage.removeItem('pendingCompound');
        
        // Auto-trigger analysis with the compound data
        setIsAnalyzing(true);
        setLoadingPhase('analyzing');
        
        apiRequest('POST', '/api/compounds/analyze', { smiles, name })
          .then(res => res.json())
          .then((data) => {
            setCurrentAnalysis(data);
            setCurrentMedicineInsights(data?.medicineInsights ?? null);
            setCurrentMedicineNameAnalysis(null);
            sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
          })
          .catch(() => {})
          .finally(() => setIsAnalyzing(false));
      } catch (error) {
        console.error('Failed to parse pending compound:', error);
      }
    } else if (id) {
      setIsAnalyzing(true);
      apiRequest('GET', `/api/compounds/${id}`)
        .then(res => res.json())
        .then((data) => {
          setCurrentAnalysis(data);
          setCurrentMedicineInsights(data?.medicineInsights ?? null);
          setCurrentMedicineNameAnalysis(null);
          sessionStorage.setItem('currentAnalysis', JSON.stringify(data));
        })
        .catch(() => {})
        .finally(() => setIsAnalyzing(false));
    } else {
      const stored = sessionStorage.getItem('currentAnalysis');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCurrentAnalysis(parsed);
          setCurrentMedicineInsights(parsed?.medicineInsights ?? null);
        } catch {
          // ignore corrupted cache
        }
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <LoadingOverlay 
        isLoading={isAnalyzing} 
        phase={loadingPhase}
        message="Please wait while we analyze your compound..."
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Molecular Analysis</h1>
          <p className="text-muted-foreground">
            Enter a compound to analyze its molecular properties and safety profile
          </p>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-4 space-y-6">
            <CompoundInput
              currentCompound={currentAnalysis?.compound}
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisError={handleAnalysisError}
              onMedicineInsightsChange={setCurrentMedicineInsights}
              onMedicineNameAnalysis={setCurrentMedicineNameAnalysis}
              isAnalyzing={isAnalyzing}
              enableMedicineFeatures={false}
            />
          </div>

          {/* Visualization Panel */}
          <div className="lg:col-span-5 space-y-6">
            <MolecularVisualization 
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
            />
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            <PredictionResults 
              analysis={currentAnalysis}
              isAnalyzing={isAnalyzing}
              photoInsights={currentMedicineInsights}
              medicineNameAnalysis={currentMedicineNameAnalysis}
            />
          </div>
        </div>

        {/* Unknown Novel Compound Deep AI Profile */}
        {currentAnalysis && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <UnknownCompoundCard analysis={currentAnalysis} />
          </div>
        )}

        {/* Therapeutic Disease Predictions & Potential Medicines Panel */}
        {currentAnalysis && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <TherapeuticPredictionCard
              prediction={currentAnalysis.therapeuticPrediction}
              isLoading={isAnalyzing}
              isAiDeduction={currentAnalysis.isAiDeduction}
              aiDeductionRationale={currentAnalysis.aiDeductionRationale}
              compoundName={currentAnalysis.compound.name || undefined}
            />
          </div>
        )}

        {/* Autonomous Drug Combinations, Disease Synergy under Conditions & Medicine Engineering */}
        {currentAnalysis && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <CombinatorialMedicineCard analysis={currentAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}

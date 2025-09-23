import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Atom } from "lucide-react";
import CompoundInput from "@/components/compound-input";
import MolecularVisualization from "@/components/molecular-visualization";
import PredictionResults from "@/components/prediction-results";
import { AnalysisResult } from "@/types/molecular";

export default function Dashboard() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setCurrentAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
  };

  const handleAnalysisError = () => {
    setIsAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm" data-testid="header-navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Atom className="text-primary text-2xl" data-testid="logo-icon" />
                <h1 className="text-xl font-bold text-foreground" data-testid="app-title">BioPredict</h1>
              </div>
              <div className="hidden md:block">
                <span className="text-sm text-muted-foreground" data-testid="app-subtitle">
                  Molecular Bioactivity Prediction Platform
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
                data-testid="button-help"
              >
                <i className="fas fa-question-circle"></i>
                <span className="hidden sm:inline">Help</span>
              </button>
              <button 
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
                data-testid="button-settings"
              >
                <i className="fas fa-cog"></i>
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-4 space-y-6">
            <CompoundInput
              onAnalysisComplete={handleAnalysisComplete}
              onAnalysisStart={handleAnalysisStart}
              onAnalysisError={handleAnalysisError}
              isAnalyzing={isAnalyzing}
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
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12" data-testid="footer-status">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
            <div className="flex items-center space-x-4 mb-2 sm:mb-0">
              <span className="flex items-center" data-testid="status-ml-models">
                <i className="fas fa-circle text-success text-xs mr-2"></i>
                ML Models Active
              </span>
              <span data-testid="text-last-updated">Last Updated: 2024-01-15</span>
            </div>
            <div className="flex items-center space-x-4">
              <span data-testid="text-api-status">API Status: Online</span>
              <span data-testid="text-version">Version: 2.1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

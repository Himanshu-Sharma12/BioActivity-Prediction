import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Sparkles, Zap, FlaskConical } from "lucide-react";
import MolecularSketcher from "@/components/molecular-sketcher";
import { useToast } from "@/hooks/use-toast";

export default function DrawPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [initialSmiles, setInitialSmiles] = useState<string>("c1ccccc1O");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    // Read smiles from URL query parameters (?smiles=...)
    const params = new URLSearchParams(window.location.search);
    const querySmiles = params.get("smiles");
    if (querySmiles) {
      setInitialSmiles(querySmiles);
      return;
    }

    // Fallback: check sessionStorage
    const stored = sessionStorage.getItem("currentAnalysis");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.compound?.smiles) {
          setInitialSmiles(parsed.compound.smiles);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const handleApplySmiles = (smiles: string, name?: string) => {
    // Save to pendingCompound so /analyze picks it up automatically
    sessionStorage.setItem(
      "pendingCompound",
      JSON.stringify({ smiles, name: name || "Custom Drawn Molecule" })
    );

    // If opened via window.open from dashboard, notify parent tab
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          {
            type: "BIOPREDICT_LOAD_SMILES",
            smiles,
            name: name || "Custom Drawn Molecule",
          },
          "*"
        );
      } catch {
        // ignore cross-origin error
      }
    }

    toast({
      title: "Structure Saved",
      description: `Transferred ${name || smiles} to Analysis Dashboard.`,
    });

    setLocation("/analyze");
  };

  const handleAnalyzeImmediately = (smiles: string, name?: string) => {
    setIsAnalyzing(true);
    sessionStorage.setItem(
      "pendingCompound",
      JSON.stringify({ smiles, name: name || "Custom Drawn Molecule" })
    );

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(
          {
            type: "BIOPREDICT_ANALYZE_SMILES",
            smiles,
            name: name || "Custom Drawn Molecule",
          },
          "*"
        );
      } catch {
        // ignore
      }
    }

    toast({
      title: "Launching Analysis",
      description: `Analyzing ${name || smiles}...`,
    });

    setLocation("/analyze");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header Navigation */}
      <div className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/analyze">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              <h1 className="text-sm font-bold text-foreground">
                SMILES Molecular Drawing Studio
              </h1>
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                Widescreen Mode
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Draw or modify molecules, then transfer directly to bioactivity prediction</span>
          </div>
        </div>
      </div>

      {/* Main Studio Canvas Container */}
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <MolecularSketcher
          initialSmiles={initialSmiles}
          onApplySmiles={handleApplySmiles}
          onAnalyzeImmediately={handleAnalyzeImmediately}
          isAnalyzing={isAnalyzing}
        />
      </div>
    </div>
  );
}

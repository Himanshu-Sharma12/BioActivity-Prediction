import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  ArrowRight, 
  FlaskConical, 
  Shield, 
  BarChart3, 
  Zap, 
  CheckCircle, 
  Sparkles,
  Microscope,
  Activity,
  Brain,
  Search,
  Database,
  Pill,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  Box,
  FileText,
  Sliders,
  Paintbrush
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [quickInput, setQuickInput] = useState("");

  const benchmarkCompounds = [
    {
      name: "Aspirin",
      class: "Analgesic / NSAID",
      formula: "C₉H₈O₄",
      smiles: "CC(=O)Oc1ccccc1C(=O)O",
      mw: "180.16 g/mol",
      logP: "1.19",
      color: "from-blue-500/20 to-cyan-500/20",
      accent: "text-blue-500",
    },
    {
      name: "Caffeine",
      class: "CNS Stimulant",
      formula: "C₈H₁₀N₄O₂",
      smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C",
      mw: "194.19 g/mol",
      logP: "-0.07",
      color: "from-amber-500/20 to-orange-500/20",
      accent: "text-amber-500",
    },
    {
      name: "Paracetamol",
      class: "Analgesic / Antipyretic",
      formula: "C₈H₉NO₂",
      smiles: "CC(=O)Nc1ccc(O)cc1",
      mw: "151.16 g/mol",
      logP: "0.46",
      color: "from-emerald-500/20 to-teal-500/20",
      accent: "text-emerald-500",
    },
    {
      name: "Ibuprofen",
      class: "Nonsteroidal Anti-inflammatory",
      formula: "C₁₃H₁₈O₂",
      smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
      mw: "206.28 g/mol",
      logP: "3.50",
      color: "from-indigo-500/20 to-purple-500/20",
      accent: "text-indigo-500",
    },
    {
      name: "Metformin",
      class: "Biguanide Antidiabetic",
      formula: "C₄H₁₁N₅",
      smiles: "CN(C)C(=N)NC(=N)N",
      mw: "129.16 g/mol",
      logP: "-1.43",
      color: "from-rose-500/20 to-pink-500/20",
      accent: "text-rose-500",
    },
    {
      name: "Amoxicillin",
      class: "Beta-lactam Antibiotic",
      formula: "C₁₆H₁₉N₃O₅S",
      smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)C(c3ccc(cc3)O)N)C(=O)O)C",
      mw: "365.40 g/mol",
      logP: "0.87",
      color: "from-cyan-500/20 to-blue-500/20",
      accent: "text-cyan-500",
    },
  ];

  const handleQuickAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const input = quickInput.trim();
    // Check if input looks like SMILES or compound name
    const isSmiles = input.includes("=") || input.includes("(") || input.includes("@") || input.includes("#") || /^[A-Z][a-z]?\d*/.test(input);
    if (isSmiles) {
      setLocation(`/analyze?smiles=${encodeURIComponent(input)}&name=Custom Compound`);
    } else {
      setLocation(`/analyze?name=${encodeURIComponent(input)}`);
    }
  };

  const handleLaunchBenchmark = (compound: typeof benchmarkCompounds[0]) => {
    setLocation(`/analyze?smiles=${encodeURIComponent(compound.smiles)}&name=${encodeURIComponent(compound.name)}`);
  };

  const stats = [
    { label: "Deterministic Descriptor Engine", value: "RDKit WASM", sub: "In-memory C++ core (<100ms)", icon: Microscope },
    { label: "Drug-Likeness Rules", value: "Lipinski + Veber", sub: "Oral bioavailability benchmarks", icon: CheckCircle },
    { label: "Structural Alert Catalogs", value: "Brenk + PAINS", sub: "500+ literature patterns screened", icon: Shield },
    { label: "Measured Bioactivity Source", value: "ChEMBL v33", sub: "Target-specific assay lookup", icon: Zap },
  ];

  const pipelineStages = [
    {
      step: "01",
      title: "Molecular Ingestion",
      desc: "Accepts SMILES strings, IUPAC/common names via PubChem resolution, or pharmaceutical packaging scans.",
      icon: Fingerprint,
      badge: "PubChem API",
    },
    {
      step: "02",
      title: "RDKit WASM Engine",
      desc: "Locally computes physicochemical descriptors (MW, LogP, TPSA, Rotatable Bonds, HBD, HBA) with zero AI hallucination.",
      icon: Microscope,
      badge: "In-Memory C++",
    },
    {
      step: "03",
      title: "Drug-Likeness Filter",
      desc: "Evaluates Lipinski Rule of 5 and Veber rules for oral drug-likeness with strict boundary thresholds.",
      icon: BarChart3,
      badge: "Lipinski & Veber",
    },
    {
      step: "04",
      title: "Structural Alert Screening",
      desc: "Matches substructure catalogs against published Brenk liabilities and Baell PAINS pan-assay interference motifs.",
      icon: Shield,
      badge: "Brenk & PAINS",
    },
    {
      step: "05",
      title: "ChEMBL & AI Synthesis",
      desc: "Queries ChEMBL experimental assays, generates 3D ball-and-stick conformations, and synthesizes clinical safety warnings.",
      icon: Brain,
      badge: "ChEMBL + Gemini",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted/20">
      {/* Glow Ambient Lights */}
      <div className="relative overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-primary/15 via-purple-500/10 to-transparent blur-[120px] pointer-events-none -z-10" />

        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-16 pb-12">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Regulatory Badge */}
            <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 backdrop-blur-md rounded-full px-4 py-1.5 shadow-sm">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-semibold tracking-wide uppercase text-primary">
                Biotech-Grade In-Memory Cheminformatics Platform
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15]">
              Predict Chemical Safety &
              <span className="block mt-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Bioactivity Profiles In Seconds
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Deterministic physicochemical calculations powered by <strong className="text-foreground">RDKit WASM</strong>, 
              screened against <strong className="text-foreground">Brenk & PAINS</strong> alert sets, and backed by 
              measured experimental data from <strong className="text-foreground">ChEMBL</strong>.
            </p>

            {/* Quick Direct Analyzer Bar */}
            <form onSubmit={handleQuickAnalyze} className="max-w-xl mx-auto pt-2">
              <div className="relative flex items-center shadow-md rounded-xl border border-border bg-card p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Search className="w-5 h-5 ml-3 text-muted-foreground flex-shrink-0" />
                <Input
                  type="text"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="Enter SMILES (e.g. CCO) or Drug Name (e.g. Aspirin)..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm text-foreground placeholder:text-muted-foreground/70"
                />
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-md text-xs sm:text-sm font-medium px-4 py-2 h-auto"
                >
                  Analyze
                  <ArrowRight className="ml-1.5 w-4 h-4" />
                </Button>
              </div>
            </form>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link href="/analyze">
                <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-lg hover:shadow-primary/20 transition-all text-white font-medium">
                  <FlaskConical className="mr-2 w-5 h-5" />
                  Launch Workspace
                </Button>
              </Link>
              <Link href="/draw">
                <Button size="lg" variant="outline" className="border-border bg-card hover:bg-accent text-foreground shadow-xs font-medium">
                  <Paintbrush className="mr-2 w-5 h-5 text-indigo-500" />
                  2D Drawing Studio
                </Button>
              </Link>
              <Link href="/iot-analysis">
                <Button size="lg" variant="outline" className="border-border bg-card hover:bg-accent text-foreground shadow-xs font-medium">
                  <Pill className="mr-2 w-5 h-5 text-primary" />
                  Medicine Label Insights
                </Button>
              </Link>
            </div>

            {/* Quick Stat Pill Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 text-left">
              {stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <Card key={idx} className="border-border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-all hover:shadow-md">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center space-x-2 text-primary">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-xl font-bold text-foreground">{stat.value}</div>
                      <p className="text-xs text-muted-foreground">{stat.sub}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benchmark Compounds Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
                  <Zap className="w-4 h-4" />
                  One-Click Benchmark Molecules
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Test With Validated Reference Compounds
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Click any benchmark molecule to run an instant end-to-end physicochemical and safety evaluation.
                </p>
              </div>
              <Link href="/analyze">
                <Button variant="ghost" size="sm" className="mt-4 md:mt-0 text-primary hover:text-primary">
                  Open full molecular workspace <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {benchmarkCompounds.map((compound) => (
                <Card 
                  key={compound.name} 
                  className="group relative overflow-hidden border-border bg-card text-card-foreground shadow-sm hover:border-primary/60 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => handleLaunchBenchmark(compound)}
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold group-hover:text-primary transition-colors flex items-center gap-2 text-foreground">
                            {compound.name}
                            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                          </h3>
                          <Badge variant="outline" className="text-xs mt-1 font-normal bg-muted/40">
                            {compound.class}
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {compound.formula}
                        </Badge>
                      </div>

                      <div className="mt-3 p-2 rounded-md bg-muted/40 font-mono text-xs text-muted-foreground break-all border border-border/40">
                        {compound.smiles}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>MW: <strong className="text-foreground font-semibold">{compound.mw}</strong></span>
                      <span>LogP: <strong className="text-foreground font-semibold">{compound.logP}</strong></span>
                      <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5 font-medium group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        Analyze
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 5-Stage Scientific Architecture Pipeline */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">
                Architecture & Methodology
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold">
                How BioPredict Analyzes Compounds
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                A transparent, zero-hallucination workflow combining rigorous deterministic algorithms with curated clinical databases.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
              {pipelineStages.map((stage, idx) => {
                const Icon = stage.icon;
                return (
                  <Card key={idx} className="border-border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-all">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                          {stage.step}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                          {stage.badge}
                        </Badge>
                      </div>

                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Icon className="w-5 h-5" />
                      </div>

                      <h3 className="font-bold text-sm text-foreground">{stage.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {stage.desc}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Scientific Compliance & Transparency Disclaimer */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-purple-500/5 to-transparent p-6 text-sm text-muted-foreground flex flex-col sm:flex-row items-center gap-4">
            <Shield className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-foreground">Rigorous Medicinal Chemistry Baseline</h4>
              <p className="text-xs leading-relaxed">
                BioPredict distinguishes measured biological facts from computational alerts.
                Lipinski and Veber criteria evaluate drug-likeness; Brenk and PAINS patterns identify substructure liabilities; 
                ChEMBL provides published experimental assay metrics. Clean alert scans represent an absence of flagged liabilities, 
                not an absolute guarantee of safety.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-3xl mx-auto border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-card to-purple-500/10 shadow-xl overflow-hidden relative">
            <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <CardContent className="p-8 sm:p-12 space-y-5">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                Ready to Accelerate Your Compound Screening?
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
                Access full 2D and 3D molecular structures, automated Lipinski rule checks, 
                structural alert scans, and PDF/CSV compliance report generation.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <Link href="/analyze">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-lg">
                    Launch Molecular Workspace
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/export">
                  <Button size="lg" variant="outline">
                    <FileText className="mr-2 w-4 h-4" />
                    Export Sample Reports
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

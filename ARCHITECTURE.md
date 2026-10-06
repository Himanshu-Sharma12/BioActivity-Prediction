# BioPredictSafety - System Architecture

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (React + TypeScript)                   │
│                                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │   Welcome      │  │   Dashboard    │  │  IoT Analysis  │                │
│  │     Page       │  │   (Analyze)    │  │   (Image AI)   │                │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘                │
│           │                   │                    │                         │
│  ┌────────┴───────┐  ┌────────┴───────┐  ┌────────┴───────┐                │
│  │     Safety     │  │     Export     │  │    Chatbot     │                │
│  │   Assessment   │  │    Results     │  │  (Voice AI)    │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│                                                                               │
│  UI Components: Radix UI + Tailwind CSS + Framer Motion                     │
│  State Management: TanStack Query + React Hooks                             │
│  Routing: Wouter                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTP/REST API
                                │ (JSON)
┌───────────────────────────────┴─────────────────────────────────────────────┐
│                         SERVER LAYER (Express + Node.js)                     │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API ENDPOINTS                                 │   │
│  │                                                                       │   │
│  │  POST /api/compounds/analyze          ─── SMILES Analysis           │   │
│  │  POST /api/compounds/analyze-image    ─── Image Recognition (AI)    │   │
│  │  GET  /api/compounds/recent           ─── Recent Compounds          │   │
│  │  POST /api/gemini/generate-3d         ─── 3D Visualization (AI)     │   │
│  │  GET  /api/predictions/saved          ─── Saved Predictions         │   │
│  └───────────────────────────┬───────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┴───────────────────────────────────────────┐   │
│  │                      SERVICE LAYER                                    │   │
│  │                                                                       │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │   │
│  │  │  RDKit (WASM)    │  │  Safety Profile  │  │  Gemini AI       │ │   │
│  │  │  Cheminformatics │  │  (Deterministic) │  │  Services        │ │   │
│  │  │                  │  │                  │  │                  │ │   │
│  │  │ • SMILES Valid.  │  │ • Struct. Alerts │  │ • Image Analysis │ │   │
│  │  │ • Descriptors    │  │ • Lipinski/Veber │  │ • 3D Generation  │ │   │
│  │  │ • InChIKey/Canon.│  │ • Concern Level  │  │ • Insights AI    │ │   │
│  │  │ • 2D SVG Render  │  │ • ChEMBL Lookup  │  │ • Fallback Data  │ │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │   │
│  └───────────────────────────┬───────────────────────────────────────────┘   │
│                              │                                               │
│  ┌───────────────────────────┴───────────────────────────────────────────┐   │
│  │                      STORAGE LAYER                                    │   │
│  │                                                                       │   │
│  │  ┌────────────────┐              ┌────────────────┐                 │   │
│  │  │  MemStorage    │◄────OR──────►│   DbStorage    │                 │   │
│  │  │  (In-Memory)   │              │ (PostgreSQL)   │                 │   │
│  │  │                │              │                │                 │   │
│  │  │ • Development  │              │ • Production   │                 │   │
│  │  │ • Fast Access  │              │ • Persistent   │                 │   │
│  │  │ • No Setup     │              │ • Drizzle ORM  │                 │   │
│  │  └────────────────┘              └────────────────┘                 │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ SQL Queries
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (Neon PostgreSQL)                          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │   compounds      │  │   predictions    │  │   batchJobs      │          │
│  │                  │  │                  │  │                  │          │
│  │ • id (UUID)      │  │ • id (UUID)      │  │ • id (UUID)      │          │
│  │ • smiles         │  │ • compoundId     │  │ • status         │          │
│  │ • name           │  │ • canonicalSmiles│  │ • totalCompounds │          │
│  │ • createdAt      │  │ • inchiKey       │  │ • processed      │          │
│  │                  │  │ • descriptors    │  │ • results        │          │
│  │                  │  │ • safetyAssessmnt│  │ • createdAt      │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │ External API
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                                       │
│                                                                               │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │        Google Generative AI (Gemini)                   │                 │
│  │                                                         │                 │
│  │  • gemini-1.5-flash     ─── Label/image reading        │                 │
│  │  • gemini-1.5-flash-latest ── 3D coords + insights      │                 │
│  │    (override: GEMINI_3D_MODEL / GEMINI_TEXT_MODEL)      │                 │
│  │  • imagen-3.0-generate-001 ── Illustrative images       │                 │
│  │                                                         │                 │
│  │  Optional. Without GEMINI_API_KEY (or on any API       │                 │
│  │  error) each path degrades to fixed local behaviour.   │                 │
│  └────────────────────────────────────────────────────────┘                 │
│                                                                               │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │        ChEMBL REST API (EMBL-EBI)                      │                 │
│  │                                                         │                 │
│  │  • /molecule   ─── Exact-structure lookup by SMILES    │                 │
│  │  • /activity   ─── MEASURED potency per protein target │                 │
│  │  • /target     ─── Target name / organism resolution   │                 │
│  │                                                         │                 │
│  │  No API key. Data licensed CC BY-SA 3.0.               │                 │
│  └────────────────────────────────────────────────────────┘                 │
│                                                                               │
│  ┌────────────────────────────────────────────────────────┐                 │
│  │        PubChem PUG REST (NCBI)                         │                 │
│  │                                                         │                 │
│  │  • Name → SMILES resolution, reference structures      │                 │
│  └────────────────────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Diagram

### 1. SMILES Analysis Flow

```
┌──────────┐
│  USER    │
│  INPUT   │
│ (SMILES) │
└────┬─────┘
     │
     │ 1. Enter SMILES: "C"
     ▼
┌────────────────────┐
│   Dashboard UI     │
│  (React Component) │
└────────┬───────────┘
         │
         │ 2. POST /api/compounds/analyze
         │    { smiles: "C", name: "Methane" }
         ▼
┌─────────────────────────────────────┐
│       Express Route Handler          │
│  /api/compounds/analyze              │
└────┬────────────────────────────┬───┘
     │                            │
     │ 3. Validate SMILES         │
     ▼                            │
┌────────────────────┐            │
│  PubChem resolve +  │            │
│  RDKit isValidSmiles│            │
└────┬───────────────┘            │
     │                            │
     │ 4. Valid ✓                 │
     │                            │
     │ 5. Check if exists         │
     ▼                            │
┌────────────────────┐            │
│   Storage Layer    │◄───────────┘
│  .getCompoundBy    │
│   Smiles()         │
└────┬───────────────┘
     │
     │ 6. Not found → Create new
     │ 7. Found → Update name if different
     ▼
┌────────────────────┐
│  Create/Update     │
│   Compound         │
└────┬───────────────┘
     │
     │ 8. Compute Descriptors (RDKit WASM)
     ▼
┌─────────────────────────────────┐
│    services/rdkit.ts            │
│   .analyzeSmiles()              │
│                                 │
│  → cLogP, MW, TPSA, HBD/HBA,    │
│    rot. bonds, rings, atoms     │
│  → canonical SMILES, InChIKey,  │
│    molecular formula, 2D SVG    │
└────┬────────────────────────────┘
     │
     │ 9. Match Structural Alerts
     ▼
┌─────────────────────────────────┐
│  services/structural-alerts.ts  │
│   .findStructuralAlerts()       │
│                                 │
│  31 published SMARTS patterns   │
│  (Brenk 2008 / PAINS 2010)      │
│  → substructure MATCHES, with   │
│    severity + matched atoms     │
│  (matches, not predictions)     │
└────┬────────────────────────────┘
     │
     │ 10. Build Safety Profile
     ▼
┌─────────────────────────────────┐
│    services/safety.ts           │
│   .assessCompound()             │
│                                 │
│  → concernLevel                 │
│    (none/low/moderate/high)     │
│  → plain-language summary       │
│  → Lipinski + Veber rule checks │
│  → coverage + RUO disclaimer    │
│                                 │
│  No probability. No 0-10 score. │
│  Deterministic: same SMILES in, │
│  same profile out.              │
└────┬────────────────────────────┘
     │
     │ 11. Save Prediction
     ▼
┌────────────────────┐
│  Storage Layer     │
│  .createPrediction │
└────┬───────────────┘
     │
     │ 12. Look up MEASURED activity
     ▼
┌─────────────────────────────────┐
│    services/chembl.ts           │
│   .lookupMeasuredActivity()     │
│                                 │
│  Exact-structure match in       │
│  ChEMBL, then one row per       │
│  protein target (best potency)  │
│                                 │
│  → experimental pChEMBL values, │
│    assay description, organism, │
│    source publication           │
│                                 │
│  Returns null when there is no  │
│  measured activity on record —  │
│  it does not invent a number.   │
└────┬────────────────────────────┘
     │
     │ 13. Return Results
     ▼
┌─────────────────────────────────┐
│     JSON Response               │
│                                 │
│  {                              │
│    compound: {...},             │
│    prediction: {...},           │
│    lipinskiRules: {...},        │
│    veberRules: {...},           │
│    structuralAlerts: [...],     │
│    measuredActivity: {..}|null, │
│    attribution: "...",          │
│    disclaimer: "...",           │
│    structure: {...}             │
│  }                              │
└────┬────────────────────────────┘
     │
     │ 14. Display Results
     ▼
┌─────────────────────────────────┐
│   Dashboard UI Update           │
│                                 │
│  • 2D/3D Visualization          │
│  • Molecular Descriptors        │
│  • Structural Alerts + concern  │
│  • Lipinski / Veber Rules       │
│  • Measured ChEMBL activity     │
│  • Research-use-only notice     │
└─────────────────────────────────┘
```

### 2. Image Analysis Flow (IoT Analysis)

```
┌──────────┐
│  USER    │
│  UPLOAD  │
│  IMAGE   │
└────┬─────┘
     │
     │ 1. Upload/Capture Image
     ▼
┌────────────────────┐
│  IoT Analysis UI   │
│  (React Component) │
└────────┬───────────┘
         │
         │ 2. Convert to Base64
         │ 3. POST /api/compounds/analyze-image
         │    { image: "data:image/jpeg;base64,..." }
         ▼
┌──────────────────────────────────────┐
│     Express Route Handler            │
│  /api/compounds/analyze-image        │
└────┬─────────────────────────────┬───┘
     │                             │
     │ 4. Extract base64 data      │
     ▼                             │
┌──────────────────────────────────┐   │
│   GeminiImageAnalysisService     │   │
│   .analyzeCompoundImage()        │   │
└────┬─────────────────────────────┘   │
     │                                 │
     │ 5. Call Gemini Vision API       │
     │    (gemini-1.5-flash)           │
     ▼                                 │
┌──────────────────────────────────┐   │
│   Gemini AI Vision API           │   │
│   (gemini-1.5-flash)             │   │
│                                  │   │
│   On success → parsed label      │   │
│   On error / no key → fallback   │   │
└────┬─────────────────────────────┘   │
     │                                 │
     │ 6. Fallback to fixed profile    │
     ▼                                 │
┌────────────────────────────────────┐ │
│  FALLBACK (gemini-image-photo.ts)  │ │
│                                    │ │
│  One fixed, clearly-labelled       │ │
│  reference profile (Paracetamol),  │ │
│  returned with confidence 0.35 and │ │
│  labelReadable: false so the UI    │ │
│  can show it was NOT read from the │ │
│  photo. Nothing is randomised.     │ │
│                                    │ │
│  Optional RxNorm (NLM) lookup      │ │
│  enriches the parsed drug name.    │ │
└────┬───────────────────────────────┘ │
     │                                 │
     │ 7. Return Analysis Result       │
     ▼                                 │
┌────────────────────────────────────┐ │
│      JSON Response                 │ │
│                                    │ │
│  {                                 │ │
│    medicineInsights: {             │ │
│      compoundCandidates: [...],    │ │
│      confidence: {...}  ← Gemini's │ │
│        self-reported confidence in │ │
│        READING THE LABEL, not a    │ │
│        bioactivity estimate        │ │
│    },                              │ │
│    compound: {...},                │ │
│    prediction: {...},  ← the same  │ │
│      deterministic RDKit + alert   │ │
│      pipeline as the SMILES flow   │ │
│    lipinskiRules: {...},           │ │
│    structure: {...}                │ │
│  }                                 │ │
└────┬───────────────────────────────┘ │
     │                                 │
     │ 8. Display Results              │
     ▼                                 │
┌────────────────────────────────────┐ │
│   IoT Analysis UI Update           │ │
│                                    │ │
│  • Compound Name & Formula         │ │
│  • Molecular Descriptors (RDKit)   │ │
│  • Structural Alerts + concern lvl │ │
│  • Lipinski Drug-likeness          │ │
│  • Label info read by Gemini       │ │
│  • Research-use-only disclaimer    │ │
└────────────────────────────────────┘ │
```

### 3. Voice Chatbot Flow

```
┌──────────┐
│  USER    │
│  VOICE   │
│  INPUT   │
└────┬─────┘
     │
     │ 1. Click Microphone Button
     ▼
┌────────────────────────────────┐
│   AdvancedChatbot Component    │
│   (React + Web Speech API)     │
└────┬───────────────────────────┘
     │
     │ 2. Start Recognition
     ▼
┌────────────────────────────────┐
│  Browser Web Speech API        │
│  webkitSpeechRecognition       │
└────┬───────────────────────────┘
     │
     │ 3. Speech → Text
     │    "What is aspirin?"
     ▼
┌────────────────────────────────┐
│   Process Query Locally        │
│   (Pattern Matching)           │
│                                │
│   Patterns:                    │
│   • "what is [compound]"       │
│   • "analyze [smiles]"         │
│   • "safety of [compound]"     │
│   • "how to use"               │
└────┬───────────────────────────┘
     │
     │ 4. Generate Response
     ▼
┌────────────────────────────────┐
│   AI Response Generator        │
│   (Predefined Knowledge Base)  │
└────┬───────────────────────────┘
     │
     │ 5. Display Text Response
     ▼
┌────────────────────────────────┐
│   Chat Bubble UI               │
│   (Markdown Formatted)         │
└────────────────────────────────┘
```

## 🔄 Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         App.tsx                                  │
│                     (Main Container)                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Navbar     │  │    Router    │  │   Footer     │         │
│  └──────────────┘  └──────┬───────┘  └──────────────┘         │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────┐         │
│  │                 Route Switch                       │         │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐      │         │
│  │  │ Welcome   │ │ Dashboard │ │  IoT      │      │         │
│  │  │  Page     │ │   Page    │ │ Analysis  │      │         │
│  │  └───────────┘ └───────────┘ └───────────┘      │         │
│  │  ┌───────────┐ ┌───────────┐                    │         │
│  │  │  Safety   │ │  Export   │                    │         │
│  │  │   Page    │ │   Page    │                    │         │
│  │  └───────────┘ └───────────┘                    │         │
│  └─────────────────────────────────────────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐         │
│  │         Advanced Chatbot (Floating)               │         │
│  │         (Always Visible - All Pages)              │         │
│  └──────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘

                    ▲
                    │ Props & Context
                    │
        ┌───────────┴──────────┐
        │                      │
┌───────┴────────┐    ┌────────┴────────┐
│  QueryClient   │    │  Toast System   │
│  (TanStack)    │    │  (Notifications)│
└────────────────┘    └─────────────────┘
```

## 🗄️ Database Schema Relationships

```
┌──────────────────────┐
│     compounds        │
│                      │
│  id (PK)             │
│  smiles              │◄────────┐
│  name                │         │
│  createdAt           │         │
└──────────────────────┘         │
                                 │ Foreign Key
                                 │ (compoundId)
                                 │
                    ┌────────────┴────────────┐
                    │                         │
       ┌────────────┴──────────┐   ┌─────────┴──────────┐
       │    predictions        │   │    batchJobs       │
       │                       │   │                    │
       │  id (PK)              │   │  id (PK)           │
       │  compoundId (FK)      │   │  status            │
       │  canonicalSmiles      │   │  totalCompounds    │
       │  inchiKey             │   │  processedCompounds│
       │  molecularFormula     │   │  results (JSONB)   │
       │  descriptors (JSONB)  │   │                    │
       │  safetyAssessment     │   │  createdAt         │
       │  createdAt            │   │  completedAt       │
       └───────────────────────┘   └────────────────────┘
```

## 🔐 Security & Validation Flow

```
┌──────────────┐
│ User Input   │
└──────┬───────┘
       │
       │ 1. Client-Side Validation
       ▼
┌─────────────────────────────┐
│  React Hook Form + Zod      │
│  • Required fields          │
│  • Format validation        │
│  • Type checking            │
└──────┬──────────────────────┘
       │
       │ 2. HTTP Request
       ▼
┌─────────────────────────────┐
│  Express Middleware         │
│  • JSON parser (50MB limit) │
│  • URL encoding             │
│  • CORS handling            │
└──────┬──────────────────────┘
       │
       │ 3. Server-Side Validation
       ▼
┌─────────────────────────────┐
│  Zod Schema Validation      │
│  • insertCompoundSchema     │
│  • insertPredictionSchema   │
│  • Type safety enforcement  │
└──────┬──────────────────────┘
       │
       │ 4. Business Logic Validation
       ▼
┌─────────────────────────────┐
│  RDKit (WASM)               │
│  • Full SMILES parse        │
│  • Valence validation       │
│  • Rejects impossible atoms │
└──────┬──────────────────────┘
       │
       │ 5. Process Request
       ▼
┌─────────────────────────────┐
│  Service Layer Processing   │
└─────────────────────────────┘
```

## 🎯 Deterministic Analysis Pipeline

> There is no trained model in this system. Every number below is either a
> computed physicochemical property, a published rule evaluated against it, a
> substructure match against a cited alert set, or a measured value retrieved
> from ChEMBL. The same SMILES always produces the same output.

```
         Input: SMILES String
                  │
                  ▼
         ┌────────────────┐
         │ RDKit parse +  │
         │ valence check  │
         └────────┬───────┘
                  │
                  ▼
    ┌─────────────────────────────┐
    │  Compute Descriptors         │
    │  (RDKit WASM, MinimalLib)    │
    │                              │
    │  • Crippen cLogP             │
    │  • MW (average mass)         │
    │  • TPSA                      │
    │  • Rotatable Bonds           │
    │  • H-Bond Donors/Acceptors   │
    │  • Heavy Atom Count          │
    │  • Ring Count                │
    │  • Canonical SMILES          │
    │  • InChIKey                  │
    │  • Molecular formula (Hill)  │
    │  • 2D structure SVG          │
    └─────────────┬────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌──────────────────┐ ┌──────────────────────┐
│ Structural       │ │ Rule-Based           │
│ Alerts (SMARTS)  │ │ Drug-Likeness        │
│                  │ │                      │
│ 31 patterns from │ │ Lipinski Rule of 5   │
│ • Brenk et al.,  │ │  ✓ MW ≤ 500          │
│   ChemMedChem    │ │  ✓ cLogP ≤ 5         │
│   2008           │ │  ✓ HBD ≤ 5           │
│ • Baell &        │ │  ✓ HBA ≤ 10          │
│   Holloway,      │ │  (1 violation OK)    │
│   J Med Chem     │ │                      │
│   2010 (PAINS)   │ │ Veber et al.,        │
│                  │ │ J Med Chem 2002      │
│ Output: MATCHES  │ │  ✓ Rot. bonds ≤ 10   │
│ with severity    │ │  ✓ TPSA ≤ 140 Å²     │
│ and matched      │ │                      │
│ atom indices.    │ │ Each carries its     │
│                  │ │ literature citation. │
│ A match is NOT   │ │                      │
│ a probability    │ │                      │
│ of harm.         │ │                      │
└─────────┬────────┘ └─────────┬────────────┘
          │                    │
          └─────────┬──────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │  SafetyProfile         │
         │  (services/safety.ts)  │
         │                        │
         │  • concernLevel:       │
         │    none | low |        │
         │    moderate | high     │
         │    — taken from the    │
         │    HIGHEST matched     │
         │    alert severity      │
         │  • plain-language      │
         │    summary             │
         │  • alert list + counts │
         │  • Lipinski + Veber    │
         │  • coverage statement  │
         │  • RUO disclaimer      │
         │                        │
         │  Emits no probability  │
         │  and no numeric score. │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  Measured Bioactivity  │
         │  (services/chembl.ts)  │
         │                        │
         │  Experimental values   │
         │  per protein target:   │
         │  pChEMBL, assay type,  │
         │  organism, source pub. │
         │                        │
         │  null = "no measured   │
         │  activity on record"   │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────┐
         │  Final Results     │
         │  • Descriptors     │
         │  • Alerts          │
         │  • Drug-likeness   │
         │  • Measured data   │
         └────────────────────┘
```

### Why there is no pIC50 prediction

The previous version of this system exposed a `predictPIC50()` that returned a
single potency number for a compound, with no target specified. That was not an
accuracy problem that a better model could fix — it was a category error.

IC50 is a property of a **(compound, target, assay)** triple. A target-free IC50
has no meaning: the same molecule routinely spans several log units across
different targets. Asking "what is this compound's IC50?" is like asking how far
away a city is without saying from where.

The honest replacement is measured, per-target data, which is what
`services/chembl.ts` now retrieves. Where ChEMBL has no record for a compound,
the API returns `null` — "no measured activity on record" — rather than
producing a number.

The same reasoning applied to the four toxicity endpoints (hepatotoxicity,
cardiotoxicity, mutagenicity, hERG) and the 0–10 `overallScore` that were
removed alongside it: they were emitted with `Math.random()` noise, so the same
compound scored differently on every request, and the accompanying "confidence"
value was computed from the prediction itself rather than from any measure of
uncertainty.

## ⚠️ Known Limitations

These are the boundaries of what this system can actually tell you. They are
stated here so that nothing in the UI or the API is mistaken for more than it is.

**Research use only.** Everything produced here consists of computed
physicochemical properties, published rules evaluated against them, cited
substructure matches, and third-party measured data. None of it is an
experimental measurement made by this system, and none of it is a validated
toxicity prediction. It must not be used to make safety decisions about human or
animal exposure. This disclaimer is returned on every analysis response.

**Structural alerts are a curated subset, not a complete catalogue.** The system
ships 31 SMARTS patterns — by the module's own `coverage` statement, 25 of
roughly 105 Brenk alerts and 6 of roughly 480 PAINS_A patterns. RDKit's full
`FilterCatalog` is not exposed in the WASM MinimalLib build. As the coverage note
puts it: *absence of an alert is not evidence of safety.*

**No trained toxicity model is loaded.** There is no hERG, DILI or Ames
prediction in this system, and `concernLevel` is not one. Adding real predictions
would mean self-hosting something like ADMET-AI (MIT licence, pretrained on TDC
datasets) behind a Python sidecar process. That is possible future work — it is
**not** something that exists today.

**QED and the full PAINS catalogue are unavailable.** Both require descriptors
that the RDKit WASM build does not expose. They would need a Python RDKit
sidecar.

**ChEMBL coverage is partial and external.** A compound absent from ChEMBL simply
has no published, curated measurement on record — which is not the same as being
inactive. Lookups depend on a live network call to EMBL-EBI with an 8-second
timeout; a failure degrades to "no measured data available" rather than failing
the analysis. ChEMBL data is used under CC BY-SA 3.0 and attributed in the API
response.

**Gemini features are advisory.** The 3D coordinate generation, image label
reading and medicine insights are LLM output. Where Gemini reports a
"confidence", that is the model's own self-assessment of how well it read a
label — it is not a bioactivity or safety estimate. All Gemini paths fall back to
fixed, clearly-marked local behaviour when the API is unavailable.

**Descriptors are computed, not measured.** cLogP in particular is Crippen's
computed estimate, not an experimental logP.

## 📱 Frontend State Management

```
┌────────────────────────────────────────────┐
│          TanStack Query                     │
│       (Server State Manager)                │
│                                             │
│  ┌─────────────┐  ┌─────────────┐         │
│  │ Query Cache │  │ Mutation    │         │
│  │             │  │ Manager     │         │
│  │ • Compounds │  │             │         │
│  │ • Predictions│  │ • Create    │         │
│  │ • BatchJobs │  │ • Update    │         │
│  └─────────────┘  └─────────────┘         │
└───────────────┬────────────────────────────┘
                │
                │ Provides data to
                ▼
┌────────────────────────────────────────────┐
│         React Components                    │
│                                             │
│  ┌──────────────────────────────┐          │
│  │    Local State (useState)    │          │
│  │  • Form inputs               │          │
│  │  • UI toggles                │          │
│  │  • Modal states              │          │
│  └──────────────────────────────┘          │
│                                             │
│  ┌──────────────────────────────┐          │
│  │  Session Storage             │          │
│  │  • Pending compounds         │          │
│  │  • Navigation data           │          │
│  └──────────────────────────────┘          │
└─────────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

```
┌──────────────────────────────────────────┐
│         Development Environment           │
│                                           │
│  ┌────────────┐      ┌────────────┐     │
│  │   Vite     │      │    tsx     │     │
│  │  Dev Server│◄────►│  Server    │     │
│  │  (Port 3000)│      │ (Port 5001)│     │
│  └────────────┘      └────────────┘     │
│       │                    │             │
│       │ HMR                │ Auto-reload │
│       ▼                    ▼             │
│  [Frontend]           [Backend]          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│         Production Architecture           │
│                                           │
│  ┌────────────────────────────┐          │
│  │      Build Process         │          │
│  │                            │          │
│  │  1. vite build (Client)    │          │
│  │  2. esbuild (Server)       │          │
│  └─────────────┬──────────────┘          │
│                │                          │
│                ▼                          │
│  ┌────────────────────────────┐          │
│  │      dist/                 │          │
│  │  • client/ (Static files)  │          │
│  │  • server/ (Node.js)       │          │
│  └─────────────┬──────────────┘          │
│                │                          │
│                ▼                          │
│  ┌────────────────────────────┐          │
│  │   Node.js Production       │          │
│  │   Server (Port 5001)       │          │
│  │                            │          │
│  │  • Serves static files     │          │
│  │  • Handles API requests    │          │
│  │  • Connects to PostgreSQL  │          │
│  └────────────────────────────┘          │
└──────────────────────────────────────────┘

         │
         │ Database Connection
         ▼
┌──────────────────────────────────────────┐
│      Neon PostgreSQL (Cloud)             │
│                                           │
│  • Serverless PostgreSQL                 │
│  • Auto-scaling                          │
│  • Connection pooling                    │
└──────────────────────────────────────────┘
```

## 📊 Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Wouter, TanStack Query |
| **UI Library** | Radix UI, Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express.js, TypeScript, tsx |
| **Database** | PostgreSQL (Neon), Drizzle ORM |
| **Cheminformatics** | RDKit (`@rdkit/rdkit`, WASM MinimalLib, BSD-3) |
| **Bioactivity Data** | ChEMBL REST API (EMBL-EBI, CC BY-SA 3.0), PubChem PUG REST |
| **AI** | Google Generative AI (Gemini) — 3D coords, image/label reading, insights |
| **Validation** | Zod, React Hook Form |
| **File Generation** | jsPDF, jsPDF-AutoTable |
| **Voice AI** | Web Speech API (Browser Native) |
| **Testing** | Vitest (`npm test`) |
| **Dev Tools** | ESBuild, Drizzle Kit, PostCSS, Autoprefixer |

---

*Generated: November 6, 2025*  
*Version: 1.0.0*  
*Project: BioPredictSafety - Bioactivity Prediction Platform*

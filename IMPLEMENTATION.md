# BioPredictSafety — Implementation Reference

What this application computes, how it computes it, and — equally important — what it
deliberately does not claim.

Every capability described here traces to code in this repository. Where something is a
limitation, it is stated as one rather than omitted.

---

## What this application is

A compound analysis tool. Given a SMILES string or a compound name, it computes molecular
properties, evaluates published drug-likeness rules, matches published structural alerts,
and looks up experimentally measured bioactivity.

**It does not predict toxicity.** No trained toxicity model is loaded. Nothing in the
analysis pipeline is probabilistic, and the same input always produces the same output.

> **Research use only.** Not for use in diagnostic or therapeutic procedures. The values
> here are computed physicochemical properties and published structural alerts — not
> experimental measurements of safety, and not validated toxicity predictions. They must
> not be used to make safety decisions about human or animal exposure.

---

## Analysis pipeline

```
SMILES or compound name
         │
         ├─→ PubChem PUG REST ──────────→ resolve name to structure
         │
         ▼
   RDKit (WASM) parse ──── invalid? ────→ HTTP 400, no result fabricated
         │
         ├─→ descriptors ──────────────→ MW, cLogP, TPSA, HBD/HBA, RotB, rings
         ├─→ canonical SMILES, InChIKey, molecular formula
         ├─→ 2D structure SVG (rendered server-side)
         │
         ├─→ structural alerts ────────→ 31 Brenk / PAINS SMARTS patterns
         ├─→ Lipinski Ro5, Veber ──────→ rule checks with citations
         │
         ├─→ RDKit sidecar (optional) ─→ full FilterCatalog (1,585 patterns) + QED
         │                               skipped entirely when not configured
         │
         └─→ ChEMBL REST ──────────────→ MEASURED activity per protein target
```

### 1. Structure resolution

`server/services/pubchem.ts` resolves a compound name to a structure via PubChem PUG REST
(public, no API key). Input that is already valid SMILES skips this step.

### 2. Descriptors — `server/services/rdkit.ts`

Computed by **RDKit compiled to WebAssembly** (`@rdkit/rdkit`, BSD-3-Clause) — the same C++
code that Python RDKit uses, so values match the reference implementation.

| Field | Source |
|---|---|
| `molecularWeight` | `amw` (average molecular weight) |
| `logP` | `CrippenClogP` — a *computed* partition coefficient, not measured |
| `tpsa` | Topological polar surface area |
| `hbdCount` / `hbaCount` | H-bond donors / acceptors |
| `rotatableBonds`, `ringCount`, `atomCount` | — |
| `molecularFormula` | Derived from the atom graph, Hill notation |
| `inchiKey`, `canonicalSmiles` | — |

Also produced: a 2D structure SVG, rendered on the server so the client never downloads
RDKit's ~7 MB WASM payload.

**Implementation notes.** The WASM module is a process-wide singleton, warmed at boot in
`server/index.ts` to avoid paying ~95 ms initialisation on the first request. Every molecule
is explicitly `.delete()`d in a `finally` block — Emscripten heap objects are not garbage
collected, and omitting this leaks memory until the process dies.

**Validation.** `RDKit.get_mol()` returns `null` for unparseable input and also checks
valence, so pentavalent carbon and unclosed rings are rejected. Note that `get_mol("")`
returns a *valid empty molecule*, so empty input is guarded separately.

### 3. Structural alerts — `server/services/structural-alerts.ts`

31 SMARTS patterns matched as substructure searches:

- **Brenk et al.**, *ChemMedChem* 2008, 3:435–444 — reactive and metabolically liable groups.
- **PAINS** — Baell & Holloway, *J Med Chem* 2010, 53:2719–2740 — assay interference.

**A match means the substructure is present. It is not a toxicity prediction and not a
probability.** It is a flag for closer inspection.

Compiled patterns are cached for the process lifetime. A pattern that fails to compile is
skipped rather than thrown, so one bad SMARTS cannot break analysis of every molecule.

> **Coverage is a curated subset** — 25 of roughly 105 Brenk alerts and 6 of roughly 480
> PAINS_A patterns. RDKit's full `FilterCatalog` is not exposed in the WASM build. The API
> reports its own coverage in every response, alongside the note:
> **"Absence of an alert is not evidence of safety."**

### 3b. Optional Python RDKit sidecar — `sidecar/`, `server/services/sidecar.ts`

RDKit's WASM build exposes no `FilterCatalog` and no QED. An **optional** FastAPI
service running full Python RDKit fills both gaps.

| Endpoint | Returns |
|---|---|
| `GET /health` | status, RDKit version, catalogues loaded, pattern count |
| `POST /alerts` | Complete FilterCatalog hits — PAINS_A/B/C, BRENK, NIH, CHEMBL, ZINC |
| `POST /qed` | QED score plus its 8 component properties |
| `POST /scaffold` | Murcko scaffold |

Measured on RDKit 2026.03.6, those seven catalogues total **1,585 patterns**, against
the 31 the built-in WASM path screens.

**It is strictly optional.** `RDKIT_SIDECAR_URL` is read per call; when unset, the client
returns `null` before attempting any network request. Failures are absorbed — 2.5 s
timeout, and a circuit breaker that opens after three consecutive failures and stops
trying for 30 s, so a dead sidecar cannot slow every request. A 4xx does not trip the
breaker, since that means the service is alive and the input was bad. Nothing ever throws.

When the sidecar does not answer, the response is **byte-identical** to the sidecar-free
one: no extra keys, and `coverage` wording unchanged.

**Catalogue hits are reported separately**, in `extendedAlerts`, and are deliberately not
merged into `structuralAlerts`. FilterCatalog entries carry no severity grading, so
`concernLevel` stays driven by the curated set whose severities are attributable —
assigning severities to catalogue hits would be inventing information.

`coverage.source` is only present when the sidecar actually contributed, so the payload
never overclaims its own coverage in either state.

**QED** (Bickerton et al., *Nature Chemistry* 2012, 4:90–98) is a published drug-likeness
desirability score in [0, 1]. It is **not** a safety or toxicity score. Note its `HBA`
differs from the pipeline's `hbaCount` (4 vs 3 for aspirin) — QED uses its own internal
property definitions. Both are correct under their own definition, which is why QED's
properties stay namespaced under `safety.qed.properties` and never overwrite descriptors.

Run it with Docker or a local venv — see `sidecar/README.md`.

### 4. Drug-likeness — `server/services/safety.ts`

Deterministic rule evaluation, each returned with its citation:

- **Lipinski's Rule of Five** — Lipinski et al., *Adv Drug Deliv Rev* 1997, 23:3–25.
  MW ≤ 500, LogP ≤ 5, HBD ≤ 5, HBA ≤ 10. One violation is permitted.
- **Veber** — Veber et al., *J Med Chem* 2002, 45:2615–2623.
  Rotatable bonds ≤ 10, TPSA ≤ 140 Å².

The assembled `SafetyProfile` carries a `concernLevel` (`none` / `low` / `moderate` /
`high`, taken from the highest-severity matched alert), a plain-language `summary`, the
alert list and counts, both rule sets, coverage, and the disclaimer.

**No probability and no numeric score are emitted.** A single blended figure would imply a
precision that substructure matching does not have.

### 5. Measured bioactivity — `server/services/chembl.ts`

Queries the **ChEMBL REST API** (EMBL-EBI; public, no key; data CC BY-SA 3.0) for
experimentally measured activity, returning per protein target: assay type, value and
units, pChEMBL value, organism, assay description, and source journal and year.

Results are collapsed to one row per target (keeping the most potent measurement) and
ChEMBL's `Unchecked` / `NON-PROTEIN TARGET` placeholders are filtered out — the raw feed
repeats the same assay many times and sorting purely by potency surfaces single-paper
outliers rather than a compound's well-known targets.

Where a compound has no ChEMBL record, the response says **"no measured activity on
record"** rather than inventing a number. Network failure degrades to the same answer and
never fails the wider analysis.

---

## Why there is no pIC50 prediction

Earlier versions displayed a predicted `pIC50` with a `confidence` score. That has been
removed, and it is worth being explicit that this was **not** an accuracy problem that a
better model would solve.

IC50 is a property of a *(compound, protein target, assay)* triple — the concentration at
which a compound inhibits **that specific target under that specific protocol** by half.
A compound has no single IC50. The same molecule routinely spans four or more log units
across different targets, and shifts with ATP concentration, cell line and incubation time.

Asking for a compound's IC50 with no target named is a category error, like asking which
lock a key opens without specifying the door. QSAR models are always built per target, and
only trust their output inside a defined applicability domain.

The replacement is strictly better: **measured** values from ChEMBL, each attached to a
named target and a citable publication.

The former `confidence` value is gone for the same reason. It was computed as
`0.85 − |pIC50 − 6.0| × 0.1` — a function of the prediction itself, carrying no information
about model uncertainty. Genuine confidence requires ensemble variance or conformal
prediction over a real model.

---

## Determinism

Identical input produces byte-identical output. This is asserted in the test suite, not
merely intended.

Earlier versions injected `Math.random()` into every toxicity value, so analysing the same
compound twice returned different risk levels. Alerts are now matched against the RDKit
canonical SMILES, so equivalent spellings of the same molecule — `CC(=O)Oc1ccccc1C(=O)O`
and `CC(=O)OC1=CC=CC=C1C(=O)O` — also give identical results.

---

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/compounds/analyze` | Full analysis from SMILES or name |
| `POST /api/compounds/analyze-image` | Identify a compound from a photo, then analyse |
| `POST /api/medicine/analyze-name` | Medicine-name insights |
| `GET /api/compounds/recent` | Recently analysed compounds |
| `GET /api/compounds/:id` | Single compound with its analysis |
| `POST /api/batch/process` | Batch analysis (async job) |
| `GET /api/batch/:id` | Batch job status and results |
| `POST /api/export` | Export as CSV or JSON |
| `POST /api/predictions/save` · `DELETE /api/predictions/save/:compoundId` · `GET /api/predictions/saved` | Saved analyses |
| `POST /api/gemini/generate-3d` · `POST /api/gemini/insights` | Gemini-backed 3D structure and insights |

`POST /api/compounds/analyze` returns `compound`, `prediction`, `lipinskiRules`,
`veberRules`, `structuralAlerts`, `measuredActivity`, `attribution`, `disclaimer` and
`structure`. Invalid structures return **HTTP 400** — never a fabricated result.

Client routes: `/`, `/analyze`, `/iot-analysis`, `/safety`, `/export`.

---

## Persistence

Storage is selected at boot in `server/storage.ts`:

- **`DATABASE_URL` set** → PostgreSQL via Drizzle (`DbStorage`). Run `npm run db:push` to
  create the schema.
- **Unset** → in-memory, with a warning at boot stating that data will be lost on restart.
- **Set but unusable** → falls back to in-memory and logs an error, rather than crashing or
  silently appearing to work.

Tables: `compounds`, `predictions`, `batch_jobs`, `saved_predictions`.

> `DbStorage` existed for some time but was never instantiated — `storage` was hardcoded to
> the in-memory implementation, so everything was discarded on restart. Saved analyses were
> worse: a `Set` inside a route closure.

**The Postgres path is wired but unproven.** Its queries have not been exercised against a
real database in this repository. Treat the first run with a real `DATABASE_URL` as the
actual test.

### Caching

`server/services/cache.ts` is a bounded LRU with TTL, used in front of ChEMBL (24 h).
Measured bioactivity changes on ChEMBL's release cycle, so a long TTL is safe, and it
removes the slowest step of a repeat analysis. `null` is cached too — "no ChEMBL record" is
a real answer worth remembering rather than re-fetching every time.

---

## Hardening

- **`helmet`** for security headers. CSP is disabled in development (Vite HMR injects
  inline scripts) and enabled in production.
- **Rate limiting** — 60 requests/minute per IP on `/api`, and 10/minute on the routes that
  cost money or fan out to third parties (`analyze-image`, `medicine/analyze-name`,
  `gemini/*`, `batch/*`). Every endpoint is unauthenticated, and several proxy to paid
  Gemini calls.
- **Body limits** — 256 kB by default, 12 MB only on the image-upload route. This was
  previously 50 MB on every route.
- **Batch bounds** — at most 100 compounds per submission, each SMILES at most 1,000
  characters, validated before any work starts. Previously unbounded.

---

## Testing

```bash
npm test          # vitest run
npm run test:watch
```

98 tests across seven files — server services, storage, and client components.

Client component tests run in jsdom via a `// @vitest-environment jsdom` docblock; server
suites stay in the faster node environment.

The single most important client test asserts that the research-use disclaimer and the
"Absence of an alert is not evidence of safety" note render in **both** the empty and the
populated state, and that no percentage, probability or score appears anywhere in the
rendered output. It fails if those guardrails are ever removed.

Descriptors are asserted against **PubChem reference values**, not against the
implementation's own output — the failure mode being guarded against is values that look
plausible but are wrong. Specific regressions covered:

- Chlorine must not be counted as carbon. The previous regex implementation matched `/C/g`,
  so chloroform `ClC(Cl)Cl` read as four carbons; it is `CHCl3`.
- Lowercase aromatic atoms must be counted. `/C/g` missed them entirely.
- Nitroaromatics must match in **both** charge forms. RDKit canonicalises nitro groups to
  `[N+](=O)[O-]`, so a SMARTS written only for the neutral pentavalent form silently misses
  every nitroaromatic — a major genotoxicity class.
- Analysis must be deterministic, and equivalent SMILES spellings must agree.
- The response must contain no `probability`, `confidence`, `overallScore` or `pic50`
  field — a guard against reintroducing fabricated quantitative output.

> Vitest is pinned to 2.x. Vitest 5 requires Vite 6+, and this project is on Vite 5.4.

---

## Running it

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY for the Gemini-backed features
npm run dev              # http://localhost:5001
```

```bash
npm run build && npm start   # production
npm run check                # typecheck
npm test                     # 98 tests
```

Optional environment: `DATABASE_URL` for persistence, `RDKIT_SIDECAR_URL` for the Python
sidecar. The app runs without either.

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on push and pull request.
The suite is fully offline and needs no secrets.

The Gemini features (3D structure generation, photo identification, medicine insights)
degrade gracefully when `GEMINI_API_KEY` is absent. The core analysis pipeline does not
require it. **Never commit `.env` or hardcode a key** — keys belong in the environment.

---

## Known limitations

These are real constraints, listed so they are not mistaken for oversights.

1. **No trained toxicity model is loaded.** There is no hepatotoxicity, cardiotoxicity,
   mutagenicity or hERG prediction. Structural alerts are substructure matches, not
   predictions.
2. **Structural alert coverage is partial** — a curated subset of Brenk and PAINS, not the
   complete catalogues. Absence of an alert is not evidence of safety.
3. **QED and RDKit's full `FilterCatalog` require the optional sidecar.** Without it the
   app screens 31 curated patterns rather than the full 1,585, and reports no QED. The
   `coverage` field states which applies.
4. **cLogP is computed, not measured.** Crippen cLogP is an estimate from atomic
   contributions.
5. **ChEMBL coverage is partial and external.** Novel compounds legitimately have no record,
   which means no published assay data was found — not that the compound is inactive.
   Availability depends on an external service.
6. **Gemini-derived output is advisory** and is not part of the deterministic pipeline. The
   `confidence` field on photo identification is the model's self-assessment of reading the
   label, not a bioactivity estimate.
7. **Analysis is single-compound and synchronous.** RDKit runs in-process at roughly 1 ms per
   molecule; large batch workloads would warrant worker threads or a Python service.

### Possible future work — not implemented

Real toxicity prediction would mean self-hosting **ADMET-AI** (MIT licence, pretrained on 41
Therapeutics Data Commons datasets including hERG, DILI and Ames) behind a Python sidecar.

If that is ever added, every prediction must ship with its training-set size, held-out
performance, and an applicability-domain flag — per the **OECD (Q)SAR validation
principles**, a model will otherwise emit a confident-looking number for a molecule nothing
like anything it was trained on. ADMET-AI's DrugBank-percentile framing ("more hERG-risky
than 87% of approved drugs") is a more honest presentation than a bare probability.

---

## Data sources and attribution

| Source | Use | Licence |
|---|---|---|
| [RDKit](https://www.rdkit.org/) | Descriptors, parsing, SMARTS, SVG | BSD-3-Clause |
| [ChEMBL](https://www.ebi.ac.uk/chembl/) (EMBL-EBI) | Measured bioactivity | CC BY-SA 3.0 |
| [PubChem](https://pubchem.ncbi.nlm.nih.gov/) (NCBI) | Name resolution, properties | Public domain |
| Brenk et al., *ChemMedChem* 2008 | Structural alerts | Published literature |
| Baell & Holloway, *J Med Chem* 2010 | PAINS filters | Published literature |
| Lipinski et al., *Adv Drug Deliv Rev* 1997 | Rule of Five | Published literature |
| Veber et al., *J Med Chem* 2002 | Oral bioavailability rules | Published literature |

ChEMBL's CC BY-**SA** share-alike applies to redistribution of derived datasets, not to
ordinary API querying. Responses carry the required attribution string.

---

See [ARCHITECTURE.md](ARCHITECTURE.md) for system design and request flows, and
[QUICK_START.md](QUICK_START.md) for setup.

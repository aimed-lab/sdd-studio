#!/bin/bash
# Usage: create_issues.sh  (run from repo root)
set -e
mk() { # $1=color $2=title $3=extra-label $4=body
  gh issue create --title "[$(echo $1 | tr a-z A-Z)] $2" --label "$1,testing-system,$3" --body "$4"
}

# ---------- GREEN ----------
mk green "Add target filter to Compounds page" enhancement "**Use Cases**: UC-07 | **Severity**: P2 | **Classification**: GREEN

### Problem
\`/compounds\` only offers a search box and a status filter; a computational biologist cannot filter compounds by target (e.g. JAK2).

### Proposed Fix
Add a target dropdown built from the distinct target values in the compound list, combined with existing filters."

mk green "Make disease-group target counts link to the filtered Target Board" enhancement "**Use Cases**: UC-02 | **Severity**: P2 | **Classification**: GREEN

### Problem
Disease Groups cards on \`/disease\` show 'N Targets' but give no way to see them. Counts also disagree with the Target Board (Melanoma says 6, only 4 exist).

### Proposed Fix
Make the Targets stat a link to \`/disease-biology/target-board?disease=<name>\`, have the Target Board read the \`disease\` query param as its initial filter, and derive the count from the actual target list instead of a literal."

mk green "Add sorting and filtering to the cohort table" enhancement "**Use Cases**: UC-05 | **Severity**: P3 | **Classification**: GREEN

### Problem
\`/disease\` Cohorts tab table has no sort or filter.

### Proposed Fix
Clickable column headers for Name/Disease/Size/Status sort, plus a status filter chip row."

mk green "Remove or populate empty gene-therapy modality" bug "**Use Cases**: UC-08 | **Severity**: P3 | **Classification**: GREEN

### Problem
\`modalityConfig\` in \`src/app/drug/page.tsx\` defines gene-therapy but no drug uses it, so the modality never appears and users can't tell it's supported.

### Proposed Fix
Show all defined modalities in the By Class tab, with an explicit 'No candidates yet' state for empty ones."

mk green "Add filters to Decision Report pages" enhancement "**Use Cases**: UC-20 | **Severity**: P3 | **Classification**: GREEN

### Problem
Decision pages under disease-biology, pharmacology, clinical, regulatory show all records unfiltered.

### Proposed Fix
Add decision-type filter chips (Go / Conditional Go / No-Go) on each decision page."

mk green "Mechanism card selection does nothing — show detail panel" bug "**Use Cases**: UC-06 | **Severity**: P3 | **Classification**: GREEN

### Problem
\`src/app/disease-biology/mechanisms/page.tsx\` tracks \`selectedStudy\` and draws a ring, but no detail is shown.

### Proposed Fix
When a study is selected, render a detail panel below the grid with id, pathway, method, status, confidence, evidence, and a 'related targets' link list."

# ---------- YELLOW ----------
mk yellow "Add evidence provenance (source + date) to displayed facts" enhancement "**Use Cases**: UC-01, UC-02, UC-04, UC-06, UC-19 (all personas) | **Severity**: P1 | **Classification**: YELLOW

### Problem
No fact on the platform cites a source. Users cannot verify prevalence figures, compound counts, confidence scores.

### Proposed Plan
Introduce a shared \`Provenance\` type ({source, url?, pmid?, retrieved}) and a \`<SourceBadge>\` component; attach provenance to target, disease subtype and MoA records; mark all illustrative/demo data explicitly as 'Demo data' so it is never mistaken for curated fact."

mk yellow "Entity detail pages (target, compound, disease subtype)" enhancement "**Use Cases**: UC-01, UC-04, UC-13 | **Severity**: P2 | **Classification**: YELLOW

### Problem
Cards and rows are not clickable; there is no detail view for any entity.

### Proposed Plan
Add \`/targets/[gene]\` detail page aggregating everything the app knows about a target (target card data, target-board entries, compounds, drugs, MoA studies, subtypes mentioning it) plus outbound links (UniProt, Open Targets, ChEMBL, PDB)."

mk yellow "Integrate ClinicalTrials.gov for real trial landscape" enhancement "**Use Cases**: UC-09, UC-10 | **Severity**: P1 | **Classification**: YELLOW

### Problem
\`/clinical/trials\` only shows 4 internal simulated trials; no real trial data.

### Proposed Plan
Add \`/api/trials\` proxying ClinicalTrials.gov API v2 (\`/api/v2/studies?query.term=...\`), and a 'Trial Landscape' tab on \`/clinical/trials\` with search by target/condition, phase and status filters, NCT links."

mk yellow "Modality comparison matrix" enhancement "**Use Cases**: UC-08 | **Persona**: Drug Development Director | **Severity**: P1 | **Classification**: YELLOW

### Proposed Plan
Add a 'Compare' tab on \`/drug\`: rows = modality attributes (typical timeline, CMC complexity, delivery, regulatory path, precedent), columns = modalities present for a chosen indication, with the candidates listed per column."

mk yellow "Regulatory submission / milestone tracker" enhancement "**Use Cases**: UC-11 | **Severity**: P1 | **Classification**: YELLOW

### Problem
Regulatory section covers licensing, IRB and business decisions, but not FDA/EMA status of candidates.

### Proposed Plan
Add \`/regulatory/submissions\` page with per-candidate milestone timeline (pre-IND → IND → EOP2 → NDA/BLA → approval), designations, and links to Drugs@FDA for approved drugs."

mk yellow "Pathway visualization for mechanisms of action" enhancement "**Use Cases**: UC-06, UC-17 | **Severity**: P1 | **Classification**: YELLOW

### Proposed Plan
Render each MoA study as a simple node→edge pathway diagram (SVG, no new heavy dependency) from a structured \`steps\` array, with links out to Reactome/KEGG."

mk yellow "Executive portfolio dashboard" enhancement "**Use Cases**: UC-20, UC-17 | **Persona**: VP Drug Development | **Severity**: P2 | **Classification**: YELLOW

### Proposed Plan
Portfolio summary on \`/projects/performance\`: one row per program with stage, latest decision, next milestone, key risk — aggregated from existing decision and candidate data."

mk yellow "EGFR resistance mutation catalog" enhancement "**Use Cases**: UC-16, UC-18 | **Severity**: P1 | **Classification**: YELLOW

### Proposed Plan
Add a 'Resistance' section on the target detail page: mutation, approximate frequency, mechanism, affected drugs, rescue strategies, PubMed references."

mk yellow "Exportable target-validation dossier" enhancement "**Use Cases**: UC-19, UC-20 | **Severity**: P1 | **Classification**: YELLOW

### Proposed Plan
On the target detail page, add 'Export dossier' which produces a printable/Markdown summary of all evidence for the target (print stylesheet → PDF via browser)."

mk yellow "Combination / multi-target strategy view" enhancement "**Use Cases**: UC-17 | **Severity**: P1 | **Classification**: YELLOW

### Proposed Plan
Select 2–3 targets → show shared pathways, existing combination drugs/trials from ClinicalTrials.gov, overlapping toxicity notes."

# ---------- RED ----------
mk red "Data architecture: static arrays vs Prisma DB vs live external APIs" enhancement "**Use Cases**: all 20 | **Severity**: P1 | **Classification**: RED

### Problem
39 of 40 pages render hardcoded arrays. Prisma/SQLite schema exists but is unused; production uses Vercel Postgres only for users.

### Options
A) Seed Postgres with curated data and query it server-side.
B) Fetch live from external APIs (ChEMBL, Open Targets, CT.gov) with caching; no local store.
C) Hybrid: internal program data in Postgres, public reference data via live APIs with provenance.
Needs multi-agent decision."

mk red "Canonical source of truth per entity" enhancement "**Use Cases**: UC-01, UC-03 | **Severity**: P1 | **Classification**: RED

### Problem
Targets exist in /targets (6), /disease-biology/target-board (10), candidates; compounds in /compounds, /search, /drug, /pharmacology/candidates — with conflicting values.

### Options
A) One shared \`src/data/*\` module per entity consumed by all pages.
B) Move to DB (depends on architecture issue).
C) Keep page-local but reconcile values."

mk red "MVP scope for portfolio/decision features" enhancement "**Use Cases**: UC-08, UC-11, UC-17, UC-20 | **Classification**: RED

### Problem
Executive features requested: portfolio dashboard, regulatory tracking, modality comparison, combination strategy, development-plan builder. Which to build first?"

mk red "External data integration strategy: build vs embed vs link" enhancement "**Use Cases**: UC-03, UC-10, UC-13, UC-14 | **Classification**: RED

### Options
A) Full server-side integration of each API.
B) Link-out only with deep links.
C) Integrate the 2–3 highest value (ChEMBL, CT.gov, Open Targets) and link out for the rest."

mk red "AI/predictive features: mocked vs real" enhancement "**Use Cases**: UC-14, UC-15 | **Classification**: RED

### Problem
Pages reference GeneTerrain, PETS, CPA, Drug-GPT, etc., but no models are called. Users can't tell what is real.

### Options
A) Label all simulated/predictive output as 'Demo' now; integrate later.
B) Wire the existing /api/assistant LLM proxy to answer prediction prompts with evidence.
C) Remove predictive claims until real."

mk red "Role-based views (bench scientist vs executive)" enhancement "**Use Cases**: all | **Classification**: RED

### Options
A) Role-based default landing page.
B) Persona-specific dashboards.
C) No change; rely on navigation."

# Test Report: Dr. Elena Morales — Drug Development Director

**Persona**: VP of Drug Development at a mid-size pharma company
**Focus**: Portfolio-level decisions, competitive intelligence, GO/NO-GO assessments
**Expectations**: Executive summaries, risk assessment, market analysis, IP landscape
**Date**: 2026-11-09

---

## Primary Use Cases (Assigned)

### UC-08: Compare drug modalities for Melanoma targets
**Pages visited**: `/drug` (By Class/Modality tab), `/business`
**Outcome**: PARTIAL
**Time estimate**: 15 minutes
**Problems**:
- P2: The Drug page `/drug` has a "By Class/Modality" tab that groups 10 hardcoded drugs by modality (small-molecule, antibody, peptide, oligonucleotide, cell-therapy). For Melanoma, it shows: small-molecule (Vemurafenib analog), antibody (Anti-PD-L1-BRAF), cell-therapy (NK-BRAF-CAR). This is a start but far from a proper comparison matrix.
- P1: **No side-by-side comparison view** — cannot compare modalities on pros/cons, development risk, cost, timeline, or regulatory path. Each modality card only shows target, indication, and stage.
- P1: **All data is hardcoded** — only 10 drugs total in the static array. No database query. No way to add new compounds.
- P2: **No risk/benefit analysis per modality** — a VP needs to know manufacturing complexity, CMC timeline, regulatory precedent, estimated cost-of-goods for each modality.
- P2: **No connection between modality and market data** — the Business page has market data but it's not linked to modality analysis.
- P3: Gene therapy modality defined in code but has zero drugs, so the category exists but is empty.

**Reflection**: *"I can see a list of drugs grouped by modality, which is basic but useful. However, I cannot actually compare them strategically. There's no head-to-head matrix, no risk profiling, no timeline comparison. I'd need to manually pull this together in a spreadsheet. For a platform claiming to support drug development decisions, this is a critical gap."*

**Evidence**: `src/app/drug/page.tsx:38-45` defines 6 modality types but no comparison logic. Cards at lines 199-229 show only target/indication/stage per drug — no strategic data.

---

### UC-11: Review regulatory status of a drug candidate
**Pages visited**: `/regulatory/decisions`, `/regulatory/licensing`, `/regulatory/business`, `/regulatory/clinical-docs`, `/regulatory/irb`
**Outcome**: FAILURE
**Time estimate**: 20 minutes (gave up)
**Problems**:
- P1: **No FDA/EMA submission tracking exists anywhere** — the regulatory section has Decision Reports, Copyright/OSDD2 License, and Business Optimization pages, but none show regulatory agency interactions (IND filings, FDA meetings, submission timelines).
- P1: **Decision Reports page** (`/regulatory/decisions`) shows 5 hardcoded internal Go/No-Go decisions about IP filing, OSDD2 adoption, and partnership deals — NOT regulatory agency status. It's about internal decisions, not regulatory submissions.
- P2: **No drug label information** — no page shows approved labels, black box warnings, or post-market requirements.
- P2: **No regulatory timeline visualization** — there's no Gantt chart or milestone timeline for IND→Phase 1→Phase 2→Phase 3→NDA/BLA→Approval.
- P2: **Business page** shows market data and competitors but no regulatory pathway guidance per indication.
- P3: The Clinical Decisions page (`/clinical/decisions`) has IND Filing and FIH Dosing decisions, which is closer but still internal-only — no FDA interaction tracking.
- P1: **All data is hardcoded** across all regulatory pages.

**Reflection**: *"This is a deal-breaker. As a VP of Drug Dev, regulatory status is one of the first things I check every morning. I need to know where each program stands with the FDA — what's been submitted, what feedback we've received, what's the timeline to next milestone. This platform has nothing like that. The 'Decision Reports' are internal Go/No-Go records, which are useful but completely different from regulatory agency tracking."*

**Evidence**: `src/app/regulatory/decisions/page.tsx:26-77` — 5 hardcoded decisions, all internal. No `regulatory-submissions`, `fda-interactions`, or similar page/route exists.

---

### UC-17: Design multi-target drug strategy (BRAF + MEK + PD-L1)
**Pages visited**: `/drug`, `/disease-biology/mechanisms`, `/targets`, `/business`
**Outcome**: FAILURE
**Time estimate**: 25 minutes (gave up)
**Problems**:
- P1: **No combination strategy feature** — the platform has no page, tool, or view for designing multi-target strategies. You cannot select multiple targets and evaluate combination rationale.
- P1: **No synergy evidence** — there's no data on drug-drug interactions, combination indices, synergy scores, or clinical evidence for combinations.
- P2: The Drug page shows one bispecific antibody (Anti-PD-L1-BRAF) that targets PD-L1 + BRAF, but there's no strategic analysis around it — just a row in a table.
- P2: The Mechanisms page shows individual MoA studies (BRAF, EGFR, JAK2, Tau) but they're siloed — no cross-pathway analysis or combination rationale.
- P1: **No pathway visualization** — cannot see how BRAF, MEK, and PD-L1 pathways intersect or where combination targeting would be synergistic.
- P2: **No competitive intelligence on combinations** — the Business page tracks competitors individually but doesn't analyze combination approaches in the competitive landscape.
- P3: No risk assessment framework for multi-target strategies (overlapping toxicity, CMC complexity, regulatory precedent for combinations).

**Reflection**: *"Combination therapy is the future of oncology, and every VP I know is evaluating multi-target strategies. This platform can't even show me two targets side by side, let alone evaluate synergy or design a combination approach. I'd need to go to ClinicalTrials.gov, PubMed, and our internal research to piece this together manually."*

**Evidence**: No route for combination analysis exists in the codebase. `src/app/drug/page.tsx` has the bispecific antibody at line 30 but no combination analysis UI.

---

### UC-20: Generate comprehensive drug development plan with GO/NO-GO criteria
**Pages visited**: `/clinical/decisions`, `/regulatory/decisions`, `/business`, `/clinical/trials`
**Outcome**: FAILURE
**Time estimate**: 30 minutes (gave up)
**Problems**:
- P1: **No drug development plan generator** — no template, wizard, or structured form for building a development plan with milestones, resources, and decision gates.
- P1: **No GO/NO-GO decision framework** — the Clinical Decisions page has 4 hardcoded Go/Conditional Go/No-Go decisions, but these are records of past decisions, not a configurable framework with criteria.
- P2: The Trial Simulations page (`/clinical/trials`) has simulated outcomes (PFS, Tau PET change, SVR35) which are useful data points but not connected to a development plan.
- P2: **No resource estimation** — no FTE counts, budget projections, timeline estimates, or external vendor requirements.
- P1: **No milestone tracking** — cannot define IND, Phase transitions, NDA/BLA filing milestones with dates and dependencies.
- P2: **No risk register** — no structured risk identification, probability/impact scoring, or mitigation plans.
- P1: **No export/report generation** — even if data existed, there's no way to compile it into a board-ready development plan document.
- P3: The Regulatory Decisions page has useful decision records but they're isolated — not part of an integrated plan.

**Reflection**: *"A drug development plan is the single most important document I oversee. It needs to integrate target validation, preclinical data, clinical trial design, regulatory strategy, competitive intelligence, and business case — all with GO/NO-GO gates. This platform has fragments of this information scattered across pages, but nothing that ties them together into a coherent plan. I cannot use this for portfolio management."*

**Evidence**: No `/plan`, `/development-plan`, or similar route exists. Decision records at `src/app/clinical/decisions/page.tsx:18-59` and `src/app/regulatory/decisions/page.tsx:26-77` are static, disconnected lists.

---

## Cross-Cutting Analysis: All 20 Use Cases from Strategic Lens

### UC-01: Search for EGFR target metadata
**Outcome**: PARTIAL | **Time**: 3 min
The Targets page shows EGFR with gene symbol, organism, disease area, compound count (42), and target class (Kinase). **Missing**: UniProt ID, PDB structures, literature references, and provenance for any fact. The compound count "42" is hardcoded and not backed by any query. The Target Board at `/disease-biology/target-board` adds druggability (High) and validation level (Clinical) for EGFR T790M, which is more useful. **Strategic concern**: Compound count is fabricated — I cannot make decisions based on unverifiable numbers.

### UC-02: Look up Melanoma and find associated targets
**Outcome**: PARTIAL | **Time**: 5 min
The Disease page shows Melanoma with subtypeCount=4, targetCount=6, activePrograms=2, ICD code C43. The Subtypes tab shows BRAF V600E and NRAS Mutant with biomarkers and unmet need level. **Missing**: Actual list of 6 targets (not shown), evidence levels for each association, links to Open Targets/GWAS. **Strategic concern**: "6 targets" is a static number with no way to drill down.

### UC-03: Search for Vemurafenib compound
**Outcome**: PARTIAL | **Time**: 5 min
The `/search` page queries ChEMBL API live — this works! Searching "Vemurafenib" returns real data with ChEMBL ID, MW, LogP, SMILES, phase. **Missing**: IC50/activity data, selectivity profile, structure rendering. The Compounds page (`/compounds`) also has a "Vemurafenib" entry but with hardcoded data that differs slightly from ChEMBL. **Strategic concern**: Two conflicting data sources for the same compound (live API vs hardcoded) — which do I trust?

### UC-04: Browse BRAF V600E Melanoma subtypes
**Outcome**: PARTIAL | **Time**: 3 min
Disease Subtypes tab shows BRAF V600E Melanoma with prevalence (~50%), biomarkers (BRAF V600E, MEK, PD-L1), standard of care (BRAF/MEK inhibitors), unmet need (high). This is useful context. **Missing**: Literature references for any claim, clinical trial data, approved therapies list, treatment guidelines links. All hardcoded.

### UC-05: View patient cohort data
**Outcome**: PARTIAL | **Time**: 2 min
Cohorts tab shows 5 cohorts (BRAF-MEL-2024, TAU-AD-2023, etc.) with size, source, data types, and status (recruiting/active/completed). **Missing**: Real-time enrollment numbers, institutional contacts, data access procedures, timeline. All hardcoded.

### UC-06: Look up drug's MoA and evidence chain
**Outcome**: PARTIAL | **Time**: 5 min
Mechanisms page shows 4 MoA studies with pathway, method, confidence %, and one-sentence evidence. BRAF V600E → MEK → ERK Cascade shows 92% confidence with GeneTerrain evidence. **Missing**: Full evidence chain (no linked publications, no pathway visualization, no supporting data). Evidence streams (Terrain2Drug, Market2Drug, Paper2Drug) are listed as counts only (12, 8, 15 analyses) with no drill-down. **Strategic concern**: "92% confidence" based on what? No way to audit.

### UC-07: Find compounds targeting JAK2
**Outcome**: PARTIAL | **Time**: 5 min
The Compounds page shows 10 hardcoded compounds; filtering by target for JAK2 is not directly possible (no target filter — only search box and status filter). Search for "JAK2" in the search box would work but is client-side only. The Candidates page (`/pharmacology/candidates`) has JAK2-Sel-7 and JAK2-Opt-2 with IC50 values (8nM, 5nM) and selectivity. **Missing**: Full activity table with assay types, dose-response curves, selectivity panels. All hardcoded.

### UC-09: Trace target → disease → drug → trial pathway for BRAF
**Outcome**: FAILURE | **Time**: 10 min
Must manually navigate: Targets page (BRAF card) → Disease page (Melanoma card) → Drug page (Vemurafenib analog, SDD-0012) → Trial Simulations (BRAF-301). These are 4 separate pages with no cross-links. **Missing**: Knowledge graph, connected drill-down, or any linked navigation. No breadcrumb trail. **Strategic concern**: A VP needs this pathway view for every program review meeting.

### UC-10: Assess clinical trial landscape for EGFR
**Outcome**: FAILURE | **Time**: 5 min
Trial Simulations page shows 4 hardcoded simulated trials. None of these are real ClinicalTrials.gov data. No integration with external trial databases. The Business page's competitive landscape mentions AstraZeneca's AZD3759 in Phase 2 and Merck's MK-1026 (discontinued) but these are just rows — no links to actual trials.

### UC-12: Examine repositioning opportunities for Alzheimer's
**Outcome**: PARTIAL | **Time**: 5 min
Drug page's Repositioning tab shows 3 repositioned drugs but none target Alzheimer's specifically. Metformin is repositioned for Pancreatic Cancer. Thalidomide for Multiple Myeloma. **Missing**: No way to search repositioning candidates by target disease. No evidence for shared pathways or target overlap. The existing repositioning view is a static display, not a discovery tool.

### UC-13: Evaluate target druggability
**Outcome**: PARTIAL | **Time**: 5 min
Target Board shows druggability scores (High/Medium/Low) for 10 targets. BRAF V600E = High, MAPT = Medium. **Missing**: Structural data (PDB links, binding sites), known ligands, pharmacophore models, tractability assessment methodology. The druggability rating is a single badge with no supporting analysis.

### UC-14: Identify novel targets through network pharmacology
**Outcome**: FAILURE | **Time**: 5 min
The Mechanisms page mentions "GeneTerrain" and "Terrain2Drug" methods but provides no interactive network analysis. Evidence streams show analysis counts (12 network, 8 clinical, 15 literature) but you can't run analyses or view results. No network visualization exists anywhere.

### UC-15: Predict drug-target interactions with evidence chain
**Outcome**: FAILURE | **Time**: 5 min
No prediction capability. The platform shows static facts about known drug-target pairs but cannot generate predictions. No confidence scores for novel interactions, no literature+patent+trial evidence chains.

### UC-16: Assess resistance mechanisms for EGFR inhibitors
**Outcome**: PARTIAL | **Time**: 5 min
The Mechanisms page has "EGFR → PI3K → AKT Resistance" study at 65% confidence (Investigating status). The Drug page has Osimertinib-R repositioned for NSCLC (C797S). Disease Subtypes shows EGFR-mutant NSCLC with biomarkers including EGFR C797S. **Missing**: Comprehensive resistance mutation catalog, frequency data, rescue strategies, clinical evidence.

### UC-18: Evaluate target x modality x residue-specific approach (EGFR C797S + covalent inhibitor)
**Outcome**: FAILURE | **Time**: 10 min
Some related data exists: Drug page has Osimertinib-R (covalent EGFR inhibitor, EGFR T790M target), Candidates page has EGFR-4G-1 (EGFR C797S, 22nM, hERG flag). **Missing**: Residue-level structural analysis, binding mode visualization, selectivity implications at atomic level. No 3D structure viewer, no residue mapping, no covalent binding analysis tools.

### UC-19: Build target validation evidence dossier
**Outcome**: FAILURE | **Time**: 10 min
Evidence is scattered: Targets page has basic target info, Mechanisms has MoA studies, Target Board has druggability, Biomarkers has companion diagnostics, Business has competitive landscape. **Missing**: No way to compile these into an exportable dossier. No scoring system across evidence dimensions. No export functionality at all.

---

## Issue Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P1-Critical | 14 | Core functionality missing or broken |
| P2-Major | 12 | Significant gaps in existing features |
| P3-Minor | 4 | Polish and enhancement issues |

### Issue Classification for GitHub

#### GREEN (Autonomous Fix) — 8 issues
1. **Inconsistent compound data between Search and Compounds pages** — Search uses live ChEMBL API; Compounds page uses hardcoded data that may conflict. Fix: remove hardcoded compounds, query database or ChEMBL.
2. **Gene therapy modality defined but empty** — `modalityConfig` defines gene-therapy but no drugs use it. Fix: either add a gene-therapy drug example or remove the category.
3. **No target filter on Compounds page** — only search box and status filter. Fix: add target dropdown filter.
4. **Disease groups show targetCount but no target list** — "6 targets" with no way to see them. Fix: link to filtered targets view.
5. **No cross-links between pages** — Target cards don't link to related diseases, drugs, or trials. Fix: add navigation links.
6. **Cohort status should link to recruitment information** — "recruiting" badge has no actionable next step. Fix: add cohort detail view.
7. **Drug page missing structure rendering** — SMILES strings are stored but not visualized. Fix: add molecule visualization library (e.g., RDKit.js or SmilesDrawer).
8. **Decision Reports have no filtering** — both Clinical and Regulatory decision pages show all records with no filter by program, date, or decision type. Fix: add filter controls.

#### YELLOW (AI Review Required) — 10 issues
1. **All pages use hardcoded data instead of database queries** — This affects every page except /search. Requires: schema design for each entity type, API routes, database seeding strategy.
2. **No modality comparison matrix** — UC-08 requires a strategic comparison view. Requires: new component design, data model for modality attributes (risk, cost, timeline, regulatory precedent).
3. **No regulatory submission tracking** — UC-11 requires FDA/EMA interaction tracking. Requires: new data model, new page, possibly external API integration.
4. **No combination therapy analysis** — UC-17 requires multi-target strategy design. Requires: pathway interaction data model, synergy scoring, combination UI.
5. **No drug development plan builder** — UC-20 requires integrated milestone planning. Requires: project management-style UI, milestone template system, resource modeling.
6. **No knowledge graph / connected navigation** — UC-09 requires target→disease→drug→trial pathway. Requires: graph data model, visualization library (e.g., D3, Cytoscape.js).
7. **No ClinicalTrials.gov integration** — UC-10 needs real trial data. Requires: ClinicalTrials.gov API integration, data mapping.
8. **No network pharmacology analysis** — UC-14 needs interactive network tools. Requires: GeneTerrain integration, network visualization.
9. **No export/report generation** — UC-19 requires exportable dossiers. Requires: PDF/DOCX generation, template system.
10. **No evidence provenance system** — Every data point lacks source attribution. Requires: provenance data model, citation UI.

#### RED (Multi-AI Consensus Required) — 6 issues
1. **Architecture: Static data vs. Database vs. External API strategy** — The fundamental question: should pages query the SQLite database (which has Target, Compound, Activity, Experiment models already), external APIs (ChEMBL, Open Targets, ClinicalTrials.gov), or both? This affects every page and determines the data freshness strategy.
2. **Data model: What is the canonical source of truth for each entity?** — Targets appear in /targets (6 entries), /disease-biology/target-board (10 entries), and /pharmacology/candidates (via target field). Which is authoritative? How do they stay in sync?
3. **Feature scope: What constitutes MVP for portfolio management?** — A VP needs: (a) portfolio dashboard, (b) program-level status, (c) decision gates, (d) competitive intelligence, (e) regulatory tracking. Which subset is build-next vs. later? Resource estimation needed.
4. **Integration strategy: Build vs. embed vs. link for external data** — For ClinicalTrials.gov, Open Targets, ChEMBL, PubMed: should the platform integrate these APIs, embed iframes, or link out? Each has UX, maintenance, and compliance implications.
5. **AI/Predictive features: What's realistic in the current architecture?** — The platform references GeneTerrain, BioReason-Pro, DT-GPT, LFM2-2.6B, etc. Are these real integrations or aspirational? The current code shows no AI model calls. Need to decide: mock-up only, or actual model integration?
6. **User segmentation: Should the UI adapt to user roles?** — A VP sees different information than a bench scientist. The current platform shows everything to everyone. Should there be role-based views, dashboards, or at minimum navigation customization?

---

## Overall Platform Assessment (Elena's Strategic Lens)

### Strengths
1. **Visually polished UI** — Cards, tables, badges, and color coding are clean and professional
2. **Good data model awareness** — The pages show understanding of drug discovery workflow (targets, diseases, compounds, trials, mechanisms, regulatory, business)
3. **Competitive intelligence page** (`/business`) is the most useful page for a VP — shows competitors, patents, and market analysis
4. **Decision framework exists** — Go/Conditional Go/No-Go records with confidence scores are a good pattern
5. **Biomarker companion diagnostic tracking** — useful strategic data (sensitivity, specificity, CDx potential)

### Critical Weaknesses
1. **Static prototype, not a functional platform** — 39 of 40+ pages use hardcoded arrays. This is a demo, not a tool.
2. **No data integration** — Only one live API (ChEMBL search). No connection to the database schema that already has Target, Compound, Activity, Experiment models.
3. **No cross-entity navigation** — Pages are siloed. Cannot trace from target to compound to trial.
4. **No strategic analysis tools** — No comparison matrices, no portfolio views, no scenario planning, no risk frameworks.
5. **No export or reporting** — Cannot generate any documents, reports, or shareable outputs.
6. **No provenance** — No fact is attributed to a source. This makes the platform untrustworthy for decision-making.

### Elena's Bottom Line
*"This looks like a well-designed mockup of what a drug discovery platform should be. The pages are there, the data categories are right, and the visual design is professional. But it's not a tool I can use today. Every number is hardcoded, nothing connects to anything else, and I can't build a development plan, track regulatory submissions, or compare drug strategies. For a board presentation about what we're building — sure. For actual portfolio management — no."*

### Priority Recommendations (VP Perspective)
1. **Connect the database** — The Prisma schema already defines the models. Wire them up.
2. **Build the portfolio dashboard** — A single page showing all programs, their status, next milestone, and key risks.
3. **Add cross-links** — Every entity should link to related entities (target → disease → compound → trial).
4. **Integrate ClinicalTrials.gov** — Real trial data is essential for competitive intelligence.
5. **Add export** — PDF reports for board meetings, Excel exports for analysis.

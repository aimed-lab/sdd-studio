# Test Report: Personas 1 & 2

## Persona 1: Dr. Sarah Kim — Basic Biomedical Researcher
Postdoc in cancer biology. Strong biology, minimal computational skills, wants PubMed-linked evidence and provenance for every fact.

---

### UC-01: Search for EGFR and view complete metadata

**Relevant pages**: `/targets`, `/search`, `/disease-biology/target-board`

**Outcome**: PARTIAL

**Time estimate**: 8 minutes (including confusion navigating between pages)

**What the page shows**:
- `/targets` page: EGFR card with gene name, full name ("Epidermal Growth Factor Receptor"), organism (Homo sapiens), disease area (NSCLC), compound count (42), target class (Kinase). ID: TGT-001.
- `/disease-biology/target-board`: Lists "EGFR T790M" as TGT-004 with type=Protein, disease=NSCLC, druggability=High, validation=Clinical, evidence=Terrain2Drug, status=Completed.

**Problems identified**:
1. **P1-CRITICAL — No UniProt ID displayed**. The Prisma schema has a `uniprotId` field on Target, but the targets page uses hardcoded data that doesn't include UniProt IDs. Dr. Kim would need this for cross-referencing with UniProt.
2. **P1-CRITICAL — No literature references or PubMed links**. No provenance for any data point. Dr. Kim can't verify where "42 compounds" comes from or cite anything.
3. **P2-MAJOR — No disease associations list**. EGFR is linked only to "Non-Small Cell Lung Cancer" but EGFR is relevant to colorectal cancer, glioblastoma, head & neck cancers, etc.
4. **P2-MAJOR — No click-through/detail page**. Cards are non-interactive (no link to a detail view). The target board has different data from the targets page (TGT-001 EGFR vs TGT-004 EGFR T790M) with no explanation of the relationship.
5. **P3-MINOR — Inconsistent EGFR entries**. `/targets` has "EGFR" broadly; `/disease-biology/target-board` has "EGFR T790M" specifically. These aren't linked or explained.
6. **P2-MAJOR — Hardcoded static data**. All data is in the React component source; no database queries, no API calls. The "42 compounds" is a literal number in code.

**Reflection**: "I found basic information about EGFR but I can't trust any of it — there are no references, no links to UniProt or PubMed, and the compound count seems invented. The same target appears in two different pages with different information. This doesn't meet the standard I need for a literature review or grant application."

---

### UC-02: Look up Melanoma and find all associated targets with evidence levels

**Relevant pages**: `/disease`, `/disease-biology/target-board`, `/targets`

**Outcome**: PARTIAL

**Time estimate**: 12 minutes (navigating between 3 pages to piece together information)

**What the pages show**:
- `/disease` (Disease Groups tab): Melanoma card — "Malignant tumors arising from melanocytes", 4 subtypes, 6 targets, 2 active programs, ICD: C43.
- `/disease` (Subtypes tab): BRAF V600E Melanoma (prevalence ~50%, biomarkers: BRAF V600E/MEK/PD-L1, SoC: BRAF/MEK inhibitors, unmet need: high) and NRAS Mutant Melanoma (prevalence ~20%, biomarkers: NRAS Q61/MEK, SoC: checkpoint immunotherapy, unmet need: high).
- `/targets`: BRAF listed for Melanoma (35 compounds). No other melanoma targets listed on this page.
- `/disease-biology/target-board`: BRAF V600E (Gene, Melanoma, druggability High), miR-21 (RNA, Melanoma, druggability Medium), TERT promoter (DNA, Melanoma, druggability Medium), CD8+ T cells (Cell, Melanoma, druggability High).

**Problems identified**:
1. **P1-CRITICAL — No linked navigation between disease and targets**. Dr. Kim has to manually navigate to 3 different pages and mentally cross-reference. The disease page says "6 targets" but doesn't link to them.
2. **P1-CRITICAL — No evidence levels or provenance**. Disease page claims "6 targets" but only 4 melanoma targets appear on target board. No evidence scoring (genetic, pharmacological, literature) like Open Targets provides.
3. **P2-MAJOR — No GWAS, Open Targets, or literature evidence**. The evidence column on target board shows "Terrain2Drug", "Paper2Drug", "Market2Drug" — platform-specific labels with no external validation links.
4. **P2-MAJOR — Missing targets**. Melanoma disease card says 6 targets, but only 4 are findable across all pages. The 2 missing targets don't appear anywhere.
5. **P3-MINOR — Static cohort data**. The cohorts tab shows "BRAF-MEL-2024" with 450 patients at UAB Cancer Center, status "active". This is hardcoded and potentially outdated.

**Reflection**: "I found some melanoma targets but the information is fragmented across multiple pages with no cross-linking. The disease page tells me there are 6 targets but I can only find 4. There's no evidence scoring or literature backing — I can't assess which targets are most validated. I'd go back to Open Targets Platform instead."

---

### UC-09: Trace BRAF in Melanoma — target → disease → drug → trial pathway

**Relevant pages**: `/targets`, `/disease`, `/drug`, `/clinical/trials`, `/disease-biology/mechanisms`

**Outcome**: FAILURE

**Time estimate**: 20+ minutes (manually checking every page, ultimately failing to complete the chain)

**What the pages show**:
- `/targets`: BRAF card with basic info, 35 compounds. No links.
- `/disease`: Melanoma group with BRAF V600E subtype. No links to drugs.
- `/drug`: 10 drugs listed. BRAF-related: "Vemurafenib analog" (SDD-0012, preclinical), "Anti-PD-L1-BRAF" (SDD-0091, discovery). Also Dabrafenib (SDD-0145, lead) on compounds page.
- `/clinical/trials`: "Phase II BRAF Inhibitor in Melanoma" (BRAF-301, SDD-0012 vs Vemurafenib, N=240, PFS). These are simulated trial designs, not real ClinicalTrials.gov data.
- `/disease-biology/mechanisms`: BRAF V600E → MEK → ERK Cascade (MOA-001, MAPK/ERK pathway, validated, 92% confidence).

**Problems identified**:
1. **P1-CRITICAL — No knowledge graph or linked pathway**. There is no way to trace from BRAF target → Melanoma disease → Drug candidates → Clinical trials in a connected way. Each page is an isolated silo.
2. **P1-CRITICAL — No clickable cross-references**. The drug page mentions "BRAF V600E" as a target but doesn't link to the target page. The trial page mentions "SDD-0012" but doesn't link to the drug page.
3. **P2-MAJOR — Trial data is simulated, not real**. The trials page shows "Trial Simulations" — virtual trial designs, not actual ClinicalTrials.gov registrations. No NCT numbers, no real sponsor data.
4. **P2-MAJOR — Incomplete drug pipeline**. Only 2-3 BRAF drugs shown out of hundreds that exist for BRAF melanoma. No approved drugs like actual Vemurafenib, Dabrafenib, Encorafenib.
5. **P2-MAJOR — No linked evidence chain**. MoA page shows confidence scores but no linked publications or clinical evidence supporting the pathway.

**Reflection**: "I spent 20 minutes clicking through pages trying to build a picture of the BRAF-Melanoma drug landscape. Each page is a dead end — I can see some drugs target BRAF and some trials test BRAF inhibitors, but nothing is connected. The trials are simulations, not real data. I would not use this platform for pathway tracing — PubChem, Open Targets, or even a simple PubMed search would be faster and more complete."

---

### UC-19: Build a target validation evidence dossier

**Relevant pages**: All pages, export functionality

**Outcome**: FAILURE

**Time estimate**: N/A (feature does not exist)

**What is available**:
- No export functionality on any page
- No dossier builder or report generator
- No way to compile evidence across dimensions
- No scoring framework for genetic, functional, pharmacological evidence

**Problems identified**:
1. **P1-CRITICAL — Feature does not exist**. There is no evidence dossier builder, no export capability, no report generation.
2. **P1-CRITICAL — No data aggregation**. Even manually, you can't assemble evidence across dimensions because each page has isolated, incomplete data.
3. **P1-CRITICAL — No evidence scoring**. No framework for rating genetic evidence, functional evidence, pharmacological evidence — core components of target validation.
4. **P2-MAJOR — No PDF/document export**. No page has any export button (CSV, PDF, etc.).

**Reflection**: "This feature simply doesn't exist. I can't compile any kind of evidence dossier from this platform. For target validation, I'd need scored evidence from multiple sources — genetics (GWAS, ClinVar), functional (CRISPR screens), pharmacological (known drugs, clinical success rates), and literature. None of that is available here."

---

## Persona 2: Dr. Marcus Chen — Computational Biologist
Associate Professor, target identification specialist. Deep computational/bioinformatics expertise. Expects API access, bulk data export, reproducible analysis.

---

### UC-07: Find all compounds targeting JAK2 with activity values

**Relevant pages**: `/compounds`, `/search`, `/targets`

**Outcome**: PARTIAL

**Time estimate**: 10 minutes

**What the pages show**:
- `/compounds` page: Sortable/filterable table of 10 hardcoded compounds. Filtering by "JAK2" returns 0 results (no JAK2 compound in this list). The compound list has BRAF, EGFR, BCR-ABL, HER2, ALK, MEK targets.
- `/search` page: ChEMBL search — searching "JAK2" might return ChEMBL results, but returns compound names/SMILES/MW/LogP/maxPhase. No IC50/EC50 activity data in results.
- `/targets` page: JAK2 card shows "22 compounds" but no way to see them.
- `/drug` page: JAK2-Sel-7 (SDD-0056, myelofibrosis, preclinical, selective JAK2 inhibitor, MW 442.8).

**Problems identified**:
1. **P1-CRITICAL — No activity data (IC50/EC50/Ki)**. No page shows quantitative bioactivity data. The compound table has MW/LogP/QED but no activity values.
2. **P1-CRITICAL — Compounds page doesn't include JAK2 compounds**. The 10 hardcoded compounds don't include any JAK2 hits. The targets page claims 22 JAK2 compounds exist but there's no way to view them.
3. **P2-MAJOR — No selectivity data**. No selectivity panels (JAK2 vs JAK1/JAK3/TYK2).
4. **P2-MAJOR — ChEMBL search only returns basic molecular properties**. The `/api/search` endpoint queries ChEMBL but only returns chemblId, name, SMILES, MW, LogP, maxPhase, moleculeType — no activity data.
5. **P1-CRITICAL — No API access**. No documented REST API for programmatic queries. No bulk export.
6. **P3-MINOR — No assay type information**. Even if activity data existed, there's no assay type/condition metadata.

**Reflection**: "This is essentially useless for my workflow. I need IC50 values and selectivity data to prioritize hits — neither exists. The compound page doesn't even include JAK2 compounds despite the target page claiming 22 exist. I'd query ChEMBL directly via their Python API to get what I need in 5 lines of code."

---

### UC-12: Examine repositioning opportunities — drugs for Alzheimer's

**Relevant pages**: `/drug` (Repositioning tab), `/disease`, `/disease-biology/mechanisms`

**Outcome**: PARTIAL

**Time estimate**: 8 minutes

**What the pages show**:
- `/drug` (Repositioning tab): 3 repositioned drugs — Osimertinib-R (NSCLC T790M → NSCLC C797S, phase-1), Metformin (T2D → Pancreatic cancer, phase-2), Thalidomide (Morning sickness → Multiple Myeloma, approved). **None target Alzheimer's.**
- `/disease` (Alzheimer's group): 3 subtypes, 8 targets, 1 active program. Subtypes: Early-onset AD (APP, PSEN1, PSEN2) and Late-onset AD (APOE4, Tau, Amyloid-β).
- `/drug` (All Drugs): Tau-Phos-1 (SDD-0034, GSK-3β, Alzheimer's, discovery), TAU-ASO-1 (SDD-0115, MAPT mRNA, Alzheimer's, discovery). Both are de novo, not repositioned.

**Problems identified**:
1. **P1-CRITICAL — No Alzheimer's repositioning candidates**. The repositioning tab has zero AD drugs. The platform doesn't identify shared-target overlaps.
2. **P1-CRITICAL — No evidence for repositioning logic**. No shared targets, pathway overlaps, or mechanistic rationale connecting existing drugs to new indications.
3. **P2-MAJOR — Only 3 repositioned drugs total**. This is a trivially small dataset. Real drug repositioning databases (RepoDB, DGIdb) have thousands of entries.
4. **P2-MAJOR — No computational repositioning tools**. No network analysis, gene expression signature matching, or structural similarity search.
5. **P2-MAJOR — Hardcoded data**. All repositioning candidates are manually curated in the React component.

**Reflection**: "Zero Alzheimer's repositioning candidates in the database. The repositioning feature is cosmetic — 3 hand-picked drugs with no computational backing. For real repositioning analysis, I'd use LINCS L1000, connectivity mapping, or network-based approaches with tools like Cytoscape or my own scripts. This platform doesn't support any of that."

---

### UC-14: Identify novel targets for NSCLC through network pharmacology

**Relevant pages**: `/disease-biology/mechanisms`, `/disease-biology/target-board`, `/analysis`

**Outcome**: FAILURE

**Time estimate**: 15 minutes (exploring, then realizing the feature doesn't exist)

**What the pages show**:
- `/disease-biology/mechanisms`: Shows 4 MoA studies. EGFR → PI3K → AKT Resistance (MOA-004) is NSCLC-related but at 65% confidence, "Investigating" status. Evidence mentions "BioReason-Pro" and "multi-agent LLM analysis".
- `/disease-biology/target-board`: EGFR T790M and MALAT1 lncRNA are NSCLC targets. Only 2 entries. No novel target discovery.
- Evidence streams: "Terrain2Drug" (12 analyses), "Market2Drug" (8), "Paper2Drug" (15) — counts only, no clickable data.
- `/analysis` page: AI chat interface with mock conversations. Drug-GPT, BioGPT listed but return mock responses ("In production environment, this would connect to the selected AI model...").

**Problems identified**:
1. **P1-CRITICAL — No network pharmacology tool**. No GeneTerrain visualization, no network analysis, no protein-protein interaction networks.
2. **P1-CRITICAL — No novel target discovery workflow**. The platform shows known targets but has no way to discover new ones.
3. **P1-CRITICAL — Evidence streams are labels only**. "Terrain2Drug: 12 analyses" has no clickable content — no way to see what those 12 analyses found.
4. **P2-MAJOR — AI chat is mocked**. The analysis page has a chat interface but it returns placeholder text for new queries. Pre-loaded conversation about ADMET is hardcoded.
5. **P2-MAJOR — Only 2 NSCLC targets in database**. For a disease with dozens of known actionable targets (EGFR, ALK, ROS1, RET, KRAS, MET, HER2, BRAF, NTRK, etc.), having 2 is inadequate.

**Reflection**: "No network pharmacology capability at all. The 'Terrain2Drug' and 'Paper2Drug' evidence streams are mentioned but never shown. The AI chat is a mock. For novel target identification in NSCLC, I'd use STRING, Open Targets, or run my own network propagation analysis. This platform is a static showcase, not an analytical tool."

---

### UC-15: Predict drug-target interactions with evidence chain

**Relevant pages**: `/analysis`, `/disease-biology/mechanisms`, `/models`

**Outcome**: FAILURE

**Time estimate**: 10 minutes (quickly discovering no predictive capability)

**What the pages show**:
- `/analysis`: Mock AI chat. Cannot actually predict anything.
- `/disease-biology/mechanisms`: 4 static MoA studies with confidence scores but no evidence chains or literature links.
- `/models`: Model catalogue page listing Claude, GPT-4o, Gemini, Drug-GPT, BioGPT, FROGENT, DrugCLIP. Shows connection status, pricing, leaderboard. Drug-GPT and BioGPT are "not installed". FROGENT and DrugCLIP have "Setup via MCP" buttons but link to `/plugins` page.

**Problems identified**:
1. **P1-CRITICAL — No prediction capability**. No drug-target interaction prediction model is functional. Drug-GPT is "not installed", BioGPT is "not installed".
2. **P1-CRITICAL — No evidence chain linking**. No connected path from prediction → literature → patent → trial evidence.
3. **P2-MAJOR — Models page is informational only**. Beautiful model catalogue but none of the models actually work. API key management is UI-only (doesn't persist to backend).
4. **P2-MAJOR — No patent or trial evidence integration**. No connection to patent databases, ClinicalTrials.gov, or literature databases.
5. **P3-MINOR — FROGENT and DrugCLIP listed but not installable**. "Setup via MCP" button leads to plugins page which doesn't have installation functionality.

**Reflection**: "Nothing works. The models page is a well-designed catalogue of AI models but none are connected. Drug-GPT and FROGENT look promising but are marked 'not installed' with no clear path to activation. For drug-target interaction prediction, I'd use my own DeepDTA/TransformerCPI models or query STITCH/DrugBank directly. This platform has no computational backend."

---

## Summary of Issues Found

### Persona 1 (Dr. Sarah Kim) — 4 use cases tested
| UC | Outcome | P1 (Critical) | P2 (Major) | P3 (Minor) |
|----|---------|----------------|-------------|-------------|
| UC-01 | PARTIAL | 2 | 3 | 1 |
| UC-02 | PARTIAL | 2 | 3 | 1 |
| UC-09 | FAILURE | 2 | 3 | 0 |
| UC-19 | FAILURE | 3 | 1 | 0 |
| **Total** | **0 success / 2 partial / 2 failure** | **9** | **10** | **2** |

### Persona 2 (Dr. Marcus Chen) — 4 use cases tested
| UC | Outcome | P1 (Critical) | P2 (Major) | P3 (Minor) |
|----|---------|----------------|-------------|-------------|
| UC-07 | PARTIAL | 3 | 2 | 1 |
| UC-12 | PARTIAL | 2 | 3 | 0 |
| UC-14 | FAILURE | 3 | 2 | 0 |
| UC-15 | FAILURE | 3 | 2 | 0 |
| **Total** | **0 success / 2 partial / 2 failure** | **11** | **9** | **1** |

### Cross-cutting systemic issues:
1. **ALL data is hardcoded** — no database queries, no external API integration (except ChEMBL search)
2. **No cross-page navigation** — pages are isolated silos with no linked drill-down
3. **No provenance/references** — no PubMed links, no DOIs, no data source citations
4. **No export capability** — no CSV, PDF, or API export anywhere
5. **No predictive/computational features** — all AI/ML features are mocked
6. **No detail pages** — cards and rows are not clickable to detail views
7. **Inconsistent data** — same entities appear differently across pages (e.g., EGFR vs EGFR T790M)

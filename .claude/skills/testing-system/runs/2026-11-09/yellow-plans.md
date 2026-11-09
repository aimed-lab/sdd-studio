# YELLOW plans — run 2026-11-09

Context for reviewers: Next.js 14 app (app router, client components, Tailwind). Almost every page renders hardcoded arrays.
GREEN fixes already landed on branch `testing-system/green-fixes`: live ChEMBL search (`src/app/api/search/route.ts`),
`MoleculeViewer`, `ExportCsvButton`, cross-links, `src/data/target-board.ts` (first shared data module).
Open RED issues that may overlap: #24 data architecture, #25 canonical source of truth, #26 MVP scope,
#27 integration strategy, #28 mocked vs real AI, #29 role-based views.

Constraint for every plan: do not add new unsourced "facts". Anything curated must cite a source (PMID/URL);
anything illustrative must be visibly labeled as demo data.

---

## Y-14 Evidence provenance (#14)
- Add `src/components/data-provenance.tsx` with two exports:
  - `<DemoDataNotice />` — a small, consistent banner: "Illustrative demo data — not curated. Figures are not sourced."
  - `<SourceLine source={{ name, url, retrieved? }} />` — "Source: X (retrieved …)".
- Place `<DemoDataNotice />` at the top of every page whose content is a hardcoded array (targets, target-board, disease,
  drug, compounds, mechanisms, candidates, optimization, simulations, trials, cohorts, biomarkers, all decisions,
  perturbation, regulatory pages, business). Live pages (search) use `<SourceLine>` (already shows source).
- No data changes. Effort: S. Risk: low (copy only).

## Y-15 Entity detail page `/targets/[gene]` (#15)
- New dynamic route aggregating everything about a gene from page-local arrays.
- Requires moving targets, compounds, drugs, MoA studies and subtypes out of page files into `src/data/*.ts`
  so both list and detail pages can import them.
- Effort: M. Risk: medium — it decides the canonical data location, which is the subject of RED #24/#25.

## Y-16 ClinicalTrials.gov trial landscape (#16)
- New `src/app/api/trials/route.ts`: GET `?term=&phase=&status=` → proxies
  `https://clinicaltrials.gov/api/v2/studies?query.term=…&filter.overallStatus=…&pageSize=25&fields=…`,
  maps to `{ nctId, title, phases[], status, sponsor, conditions[], interventions[], startDate, enrollment }`,
  returns `{ results, total, source }`. 15 s timeout, 1 h revalidate, 502 on upstream failure.
- `/clinical/trials` gets Tabs: "Trial Landscape (ClinicalTrials.gov)" + existing "Internal Simulations"
  (existing content unchanged, labeled as simulations). Landscape tab: search box (default "EGFR"),
  phase/status filters, table with NCT links, ExportCsvButton, SourceLine.
- Effort: M. Risk: low — read-only public API, no auth, same pattern as ChEMBL search.

## Y-17 Modality comparison matrix (#17)
- "Compare" tab on `/drug`: pick an indication → columns are modalities present for it; rows are the candidates
  (name, target, stage, MoA) from the existing drug list.
- Add generic attribute rows (typical development timeline, CMC complexity, regulatory path) as static text.
- Effort: S/M. Risk: medium — generic attribute rows would be unsourced claims.

## Y-18 Regulatory milestone tracker (#18)
- New `/regulatory/submissions` page: per internal candidate a milestone timeline (pre-IND → IND → EOP2 → NDA/BLA).
- Milestone data would be new hardcoded entries for internal candidates; approved reference drugs link to Drugs@FDA.
- Effort: M. Risk: high — adds a new page of hardcoded fictional milestones.

## Y-19 Pathway visualization for MoA studies (#19)
- Add `steps: string[]` to each MoA study (already implied by titles, e.g. BRAF V600E → MEK → ERK).
- New `<PathwayDiagram steps=[…] />` inline-SVG component (node boxes + arrows, theme-aware colors, wraps on mobile).
- Render in each card and the detail panel; add an outbound "Search Reactome" link per pathway
  (`https://reactome.org/content/query?q=<pathway>`).
- Effort: S. Risk: low — visualizes what is already stated, no new claims.

## Y-20 Executive portfolio dashboard (#20)
- `/projects/performance` gains a "Portfolio" table: one row per program with stage, latest decision, next milestone.
- Needs decisions from 4 decision pages + candidates in one place → requires shared data modules (same issue as Y-15).
- Effort: M. Risk: medium — depends on RED #25 and #26.

## Y-21 EGFR resistance catalog (#21)
- Add a curated, cited "Known resistance mechanisms" section for EGFR on `/targets?q=EGFR` (expanding the EGFR card)
  — or on the MoA-004 detail panel.
- Entries: T790M, C797S, MET amplification, HER2 amplification, small-cell transformation; each with mechanism,
  affected drug generation, and a PubMed ID verified via the PubMed API before inclusion.
- Effort: S/M. Risk: low if every row is cited and verified.

## Y-22 Exportable target-validation dossier (#22)
- "Export dossier" on target detail → printable summary.
- Depends on Y-15 (detail page). Effort: M. Risk: medium (dependency).

## Y-23 Combination / multi-target strategy view (#23)
- Select 2–3 genes → query `/api/trials` (Y-16) with combined terms to list real combination trials, plus shared
  pathways from MoA steps (Y-19).
- Effort: M. Risk: medium — depends on Y-16 and Y-19 landing first; synergy/toxicity claims excluded.

# RED proposals — run 2026-11-09

State of the branch `testing-system/green-fixes` when these were written:
- Live server-side proxies with provenance: `/api/search` (ChEMBL), `/api/trials` (ClinicalTrials.gov v2).
- Every illustrative page carries a non-dismissible `DemoDataNotice`; CSV exports of demo pages carry a `data_status` column.
- First curated, cited dataset: `src/data/curated/egfr-resistance.ts` (5 rows, PMIDs verified against abstracts).
- First shared demo-data module: `src/data/target-board.ts`.
- Production users/invitations live in Vercel Postgres (`src/lib/db.ts`); the Prisma schema targets SQLite and is unused by any page.
- Deployed on Vercel (serverless; no writable local filesystem; SQLite is not viable in production).

Escalated YELLOW items folded in: #15 and #22 → #25; #18 and #20 → #26; #17 and #23 → #27.

---

## #24 Data architecture: static arrays vs DB vs live APIs
Options: (A) seed Postgres with everything; (B) live external APIs only; (C) hybrid.
**Proposal: C.**
- Public reference data (compounds, bioactivity, trials, target–disease associations, literature) comes from live
  external APIs through server proxies with caching and provenance, following the ChEMBL / ClinicalTrials.gov pattern.
- Internal program data (projects, candidates, decisions, experiments) goes in Vercel Postgres, the store already used
  in production. Do not adopt Prisma+SQLite for it: SQLite cannot persist on Vercel serverless.
- Until internal data entry exists, the demo arrays stay, labelled (already done).
- Next step: mark `prisma/schema.prisma` as legacy in docs. No new Prisma work.

## #25 Canonical source of truth per entity (+ #15 detail pages, + #22 dossier)
Options: (A) one shared `src/data/<entity>.ts` per entity now; (B) wait for DB; (C) reconcile values page-locally.
**Proposal: A, with strict separation of three data classes:**
- `src/data/demo/*.ts` holds illustrative entities, one file per entity type, consumed by every page that shows that
  entity. Duplicated or conflicting copies are removed (e.g. Vemurafenib currently differs between /compounds and ChEMBL).
- `src/data/curated/*.ts` holds cited reference sets (e.g. EGFR resistance).
- Live data comes from API routes.
- #15: build `/targets/[gene]` only on top of live + curated sections (ChEMBL target activities, CT.gov trials,
  Open Targets associations, curated sets). Demo entries for the gene appear in a clearly separated, banner-labelled
  section. This answers the reviewer's concern that a detail page would make demo data look authoritative.
- #22: the dossier exports only live + curated sections, each row with its source, never demo rows.

## #26 MVP scope for portfolio / decision features (+ #18 regulatory tracker, + #20 portfolio dashboard)
**Proposal:** Scientist-facing read-only "target workspace" first (#25 detail page with live and curated data), because
it serves 4 of 5 personas with real data. Defer #18 and #20 until internal program data can be entered and
stored in Postgres (#24). A portfolio or regulatory view of fictional programs has no decision value. For approved
reference drugs, #18 can later be met with live openFDA / Drugs@FDA lookups, without fabricating milestones.

## #27 External integration strategy: build vs embed vs link (+ #17 modality matrix, + #23 combination view)
**Proposal:** Integrate (server proxy plus provenance) the 3 sources that answer most use cases: ChEMBL (done),
ClinicalTrials.gov (done), Open Targets GraphQL (next: target–disease associations, tractability). Link out for
UniProt, RCSB PDB, Reactome, CIViC, PubMed and Drugs@FDA. No iframes.
- #17: deferred. No sourced modality-attribute dataset exists. Revisit when Open Targets tractability (which covers
  small molecule, antibody and PROTAC modalities) is integrated, and show that, not generic claims.
- #23: deferred until CT.gov results can be filtered at intervention level (a trial counts only when 2+ of its
  interventions map to the selected targets), and shared pathways come from Reactome or Open Targets, not the demo MoA steps.

## #28 AI / predictive features: mocked vs real
Options: (A) label all simulated output now; (B) wire the existing `/api/assistant` LLM proxy into predictions;
(C) remove predictive claims.
**Proposal: A now, C for wording.**
- Every simulated or predicted figure (MoA confidence, trial simulations, perturbation results, optimization metrics)
  is already under the demo banner.
- Additionally replace phrases that claim a method was run ("identified through multi-agent LLM analysis",
  "CPA model predicts…") with neutral placeholder wording in the demo arrays.
- Do not wire LLM output in as predictions (B) until an evaluation exists. LLM output presented as drug–target
  prediction without validation is a scientific-integrity risk.

## #29 Role-based views
**Proposal:** No role-specific UI now (C). Revisit after #26. Personas need different data, not different chrome,
and the data does not exist yet. Cheap follow-up later: role-based default landing page.

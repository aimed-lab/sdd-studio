# YELLOW plans — run 2026-11-14

Constraint for every plan: **no new unsourced facts**. Anything curated must be verified against its source at
implementation time. Anything illustrative must be labelled. Open RED issues that plans must not pre-empt: #24 data
architecture, #25 canonical entity registry, #26 MVP/portfolio scope, #27 integration stages (Stage 1: ChEMBL
activities, Open Targets; Stage 2: UniProt/PDB with a detail page), #28 AI claims, #29 role views, #32 SSO, and new
#70 public access, #71 assistant funding, #72 structure search, #73 MCP.

Shared helper `src/lib/upstream.ts` (timeouts, provenance, input caps) must be used for any upstream call.

## #57 EGFR/eGFR collision
In `/api/trials`, when `term` looks like a gene symbol (`^[A-Z][A-Z0-9-]{1,9}$`, case-sensitive uppercase) and the
caller does not pass `fields=all`, search Condition, Keyword, Intervention, BriefTitle and OfficialTitle only:
`AREA[Condition]X OR AREA[Keyword]X OR AREA[InterventionName]X OR AREA[BriefTitle]X OR AREA[OfficialTitle]X`. This
excludes outcome-measure text, where "eGFR" lives. The UI shows "Gene-symbol mode: searching titles, conditions,
keywords and interventions" with a link to search all fields. Verify on live CT.gov that the EGFR+cancer kidney
false-positives drop and recall on EGFR-mutant NSCLC is kept (report before/after counts in the PR).

## #58 Real drug names on demo pages with wrong values
On /compounds, /drug and /pharmacology/candidates, any row using a **real drug name** gets its SMILES, MW, ALogP and
QED replaced with ChEMBL-verified values. It gets a ChEMBL ID link and a status of "Approved — reference compound"
where `max_phase = 4`. Demo IC50/selectivity values next to real names are removed (blank with "—"). Fictional
candidates keep their fictional names and stay under the demo banner. Values are fetched once from ChEMBL at
implementation time and recorded with the ChEMBL ID.

## #59 Live / Curated / Demo indicators
New `<DataClassBadge kind="live|curated|demo">`, shown on sidebar entries (small dot plus tooltip) and in page
headers. On /targets, replace the page-wide banner with precise text: "Verified: UniProt IDs and the EGFR resistance
table. Illustrative: target IDs, compound counts, disease areas." The class of each page is declared in one map in
`src/data/page-classes.ts`.

## #60 Trial landscape upgrade
- Add Intervention (`query.intr`) and Location (`query.locn`, free text such as "Birmingham, Alabama"; no geocoding).
- Put all filters in the URL (term, condition, intervention, location, phase, status).
- Add Conditions, start date, last-update date and the ClinicalTrials.gov record URL to rows and to the CSV.
- Add query and total columns to the CSV, and say when the export is partial.
- Below `md`, render rows as stacked cards.
- Server validation uses the existing caps.

## #61 Mechanism and bioactivity (per #27 Stage 1 consensus)
New `GET /api/compound/[chemblId]` (ID validated `^CHEMBL\d+$`). Through the upstream helper it returns:
- ChEMBL `/mechanism` rows (action type, target name and ChEMBL target ID).
- Up to 50 `/activity` rows with `pchembl_value` set and no `data_validity_comment`, giving target, standard
  type/relation/value/units, pChEMBL, assay ChEMBL ID, assay type and document ID.

On /search, an expandable "Mechanism & activity" panel per row. Values are never averaged across assay types.

## #62 Curated EGFR table
- Add CSV export.
- Add a "Plain language" column: one sentence per row restating the existing mechanism text without new facts.
- Add cited rows for post-osimertinib resistance only after fetching each PMID and confirming the abstract supports
  the exact row. Drop any row that can't be verified.

## #63 PDB ligand-filtered link
On target cards, add a link-out to RCSB search filtered by the UniProt accession AND a ligand chemical-component ID
for the curated reference drugs (EGFR + osimertinib = YY3, verified on RCSB). Link-out only, with no new proxy (Stage 2
of #27 owns integration).

## #64 Read-only public API
- Add a documented section to `docs/api-reference.md` for `/api/search` and `/api/trials`: parameters, errors,
  provenance schema, limits.
- Add `Access-Control-Allow-Origin: *` for GET on these two routes only.
- Add batch lookup `GET /api/search?ids=CHEMBL1,CHEMBL2` (≤ 50 IDs).
- Add the upstream data release to provenance: ChEMBL `/status.json` and CT.gov `/api/v2/version`, cached 24 h.

## #65 Start page instead of the demo portfolio
`/` renders a Start page instead of redirecting to /projects. It shows the three live tools, the curated sets, and one
line saying which sections are illustrative, with links. No new content claims.

## #66 Compound interoperability
- Return `standard_inchi_key` and the parent ChEMBL ID.
- Label salts as "Salt of CHEMBLxxx".
- Add an SDF download link-out to ChEMBL's `/molecule/{id}.sdf`.

## #67 Trial landscape summary
One extra CT.gov request with `pageSize=200` and minimal fields (Phase, OverallStatus, LeadSponsorName) gives facet
counts above the table. When total > 200 it says "summary of first 200 of N".

## #68 Compound ↔ trial cross-links
- A "Trials" link on /search rows opens `/clinical/trials?intervention=<pref_name>` (depends on #60).
- Trial intervention names link to `/search?q=<name>`.

## #69 Glossary tooltips
`src/data/glossary.ts` holds about 15 terms (pChEMBL, QED, ALogP, HBA/HBD, PSA, max phase, recruiting, Phase 2/3,
InChIKey, SMILES, ChEMBL ID, NCT ID, UniProt accession). Each has a plain definition and a source URL to the
authoritative documentation (ChEMBL docs, ClinicalTrials.gov glossary). Shown as tooltips on column headers and labels.

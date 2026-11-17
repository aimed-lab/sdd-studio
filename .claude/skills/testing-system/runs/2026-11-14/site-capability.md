# Run 2026-11-14 — site capability audit (studio.smartdrugdiscovery.org, main @ ae78956)

Method: page source read (`src/app/**`, `src/components/**`), live public endpoints called with curl
(`/api/search`, `/api/trials`), answers checked against ChEMBL, ClinicalTrials.gov v2 (direct API), PubMed and RCSB.
No data was written to the site.

## Summary

- Three things work and give correct answers: **/search** (live ChEMBL), the **Trial Landscape** tab (live CT.gov) and the
  **curated EGFR resistance table** (all 5 PMIDs checked against PubMed, and each row's numbers match the abstract). The 6 UniProt
  accessions on /targets are correct. T04 count (45) matches a direct CT.gov query exactly.
- Completion: **full 8 · partial 14 · none 8**. Mean site quality **2.2 / 5**. Easy lookups average 3.2, medium 2.2, hard 1.3.
- The hard tasks (T21–T28) can only be answered from demo data, or not at all. The site has no target-to-drug, mechanism,
  bioactivity, regulatory, Open Targets or location-filtered trial data.
- The demo data is clearly labelled, but some of it is **wrong in ways that look real**: wrong SMILES for vemurafenib and trametinib,
  approved drugs labelled "Hit/Screening", a "Validated · 92%" MoA on a placeholder row, and the same IDs pointing to
  different entities on different pages.
- **#36 is a false alarm caused by the workflow, not by ChEMBL or CT.gov**: the smoke test calls `target.smartdrugdiscovery.org`,
  which is a different app and returns 404. The same endpoints on `studio.` return 200 with real rows.

## Task table

| Task | Path | Completion | Expert min | Site quality | Verified |
|---|---|---|---|---|---|
| T01 EGFR UniProt + name | /targets (EGFR card) | full | 1 | 4 | P00533, "Epidermal growth factor receptor": correct. The page banner says the IDs are placeholders (S-07) |
| T02 Vemurafenib ID/SMILES/MW/status | /search?q=vemurafenib | full | 1 | 5 | CHEMBL1229517, MW 489.93, max_phase 4 = Approved: correct vs ChEMBL. /compounds shows a **wrong SMILES** and "Preclinical" (S-04) |
| T03 Imatinib 2D structure | /search?q=imatinib (SmilesDrawer) | full | 1 | 4 | CHEMBL941 parent listed first. SMILES matches ChEMBL canonical |
| T04 Recruiting Ph3 EGFR NSCLC | /clinical/trials (term EGFR, cond NSCLC, Ph3, Recruiting) | full | 2 | 4 | Site 45 = direct CT.gov 45. e.g. NCT04853342, NCT06970639, NCT07100080. Free-text term includes trials that only mention EGFR |
| T05 Approved drugs for BRAF V600E | /search by name only | partial | 6 | 2 | Works only if the user already knows the names: vemurafenib CHEMBL1229517, dabrafenib CHEMBL2028663, encorafenib CHEMBL3301612 (all phase 4). No target→drug query (S-17) |
| T06 Melanoma program targets | /targets, /disease-biology/target-board | partial | 3 | 1 | Demo only, and the two pages disagree: 1 (BRAF) vs 4 (BRAF V600E, miR-21, TERT promoter, CD8+ T cells) (S-06) |
| T07 EGFR trial CSV with source/date | Trial Landscape → Export CSV | full | 2 | 4 | CSV has `source`, `retrieved` (ISO) and all row fields. It has no query/filter columns and only exports loaded rows (25 of 4,314) (S-15) |
| T08 Lay explanation of C797S | /targets curated row | partial | 3 | 2 | Row is correct (Thress 2015, 6/15 cfDNA) but written in technical language. There is no plain-language layer |
| T09 Source for MET amp → gefitinib resistance | /targets curated table | full | 1 | 4 | Engelman 2007 Science PMID 17463250: abstract confirms "4 of 18 (22%)" and the ERBB3/PI3K mechanism |
| T10 Ruxolitinib targets + MoA | /search?q=ruxolitinib | partial | 4 | 2 | Gives only the ID and "Approved". ChEMBL MoA = JAK1/JAK2 inhibitor (FDA label), not shown. An unnamed isomer CHEMBL1287854 is listed above RUXOLITINIB CHEMBL1789941 (S-08) |
| T11 MW/logP/HBA/HBD/QED for 3 EGFR TKIs | /search ×3 (+CSV) | full | 4 | 4 | Erlotinib 393.44/3.41/7/1/0.42, gefitinib 446.91/4.28/7/1/0.52, osimertinib 499.62/4.51/8/2/0.31 match ChEMBL. Salt forms are listed first. /compounds shows conflicting values (erlotinib QED 0.81) |
| T12 EGFR TKI resistance with citations | /targets curated table | partial | 2 | 4 | All 5 PMIDs/DOIs resolve and support their rows. The table is missing post-osimertinib mechanisms (MET amp on 3rd-gen, PIK3CA, BRAF, fusions) and has no export (S-20) |
| T13 JAK2 inhibitors with IC50 | none (/search?q=JAK2 → 1 molecule) | none | 10 | 0 | No bioactivity anywhere. A JAK2 search returns only BMS-911543. The "Search ChEMBL for JAK2" link is misleading (S-09) |
| T14 True BRAF+MEK combo trials | Trial Landscape (term "BRAF MEK") | partial | 12 | 2 | 11 recruiting hits, including an exercise program and an MDSC study (false positives). A CT.gov intervention query (BRAFi AND MEKi) gives 154 in total. No intervention field (S-15) |
| T15 BRAF → melanoma → drugs → trials | /targets → board (demo) → /search → trials | partial | 10 | 2 | Only the trials and search steps are real. The drug-target link is missing and the demo IDs collide (S-05) |
| T16 KRAS G12C NSCLC by sponsor/phase | Trial Landscape (142 trials) + CSV | partial | 8 | 3 | Count is plausible. Sponsor and phase columns are present, but there is no grouping or summary, so the user must page 6× and pivot in Excel |
| T17 Is "92% confidence" sourced? | /disease-biology/mechanisms | full | 2 | 3 | Row text says "Placeholder — no analysis has been run", yet the status badge says **Validated** with a 92% bar (S-03) |
| T18 50 "kinase inhibitor" compounds via API | GET /api/search | partial | 5 | 1 | total=2550, but the API returns at most 25 and has no offset, so 50 is impossible. Free-text hits are mostly unnamed compounds (S-16) |
| T19 PDB EGFR–osimertinib (Cys797) | /targets → "PDB structures" link | partial | 8 | 2 | The link opens all 394 P00533 entries. RCSB with ligand YY3 gives 10 (4ZAU, 6JWL, 6JX0, 6JX4, 6JXT, 6LUD, 7JXM, 7JXP, 7JXW, 7K1H). No ligand filter and no residue/covalent info (S-21) |
| T20 Osimertinib FDA history/label | none (/search shows "Approved" only) | none | 10 | 1 | No regulatory data (S-22) |
| T21 MAPT tractability by modality | none (board: "MAPT druggability Medium", demo) | none | 10 | 1 | Only demo data. /targets?q=MAPT shows a "Search Open Targets" link |
| T22 Prioritise NSCLC targets (genetic + lit) | none (demo board) | none | 15 | 1 | Only demo data. No Open Targets association scores (S-23) |
| T23 AD repositioning candidates | /drug "repositioned" (demo) | none | 15 | 1 | Only demo data |
| T24 JAK2 validation dossier (exportable) | /targets JAK2 card (UniProt O60674 correct) | none | 20 | 1 | No dossier and no evidence export. Demo IDs conflict (SDD-0127 = crizotinib / CAR-NK / selective JAK2) |
| T25 EGFR inhibitor selectivity WT/mutant/HER2 | none | none | 20 | 0 | No bioactivity data (S-17) |
| T26 Strategies vs C797S | /targets curated C797S row; /drug (demo) | partial | 15 | 2 | The curated row is correct. Demo "Osimertinib-R: covalent EGFR inhibitor repositioned for C797S" is scientifically impossible (S-10) |
| T27 BRAF+MEK+PD-1 triplet | Trial Landscape (free text) | partial | 20 | 2 | Can surface trials, but cannot filter by intervention and has no toxicity data |
| T28 GO/NO-GO from real evidence | /pharmacology/decisions etc. (demo) | none | 30 | 1 | All decision pages are demo data |
| T29 Patient match, EGFR L858R post-osimertinib, Birmingham | Trial Landscape | partial | 15 | 2 | 23 recruiting worldwide. CT.gov geo filter (100 mi of Birmingham) gives 9. No location or eligibility filter (S-15) |
| T30 Answer via agent/MCP/API | GET /api/search, /api/trials (undocumented) | partial | 10 | 2 | The JSON endpoints work and carry provenance, but docs/api-reference.md calls them internal and does not list them. No MCP. The "ChEMBL MCP Server" on /plugins is a catalog entry only (S-19) |

## Issues

### Bugs

**S-01 BUG P1: smoke-test workflow points at the wrong host.** Tasks: all live-data tasks (monitoring). `.github/workflows/upstream-smoke.yml:18` sets `BASE_URL: https://target.smartdrugdiscovery.org`. That host returns `404 text/html` for both `/api/search` and `/api/trials`, so `curl -sf` exits 22. `studio.` returns `200 application/json` with rows. Fix: set BASE_URL to `https://studio.smartdrugdiscovery.org`.

**S-02 BUG P2: the gene-symbol/eGFR collision survives the default "cancer" condition.** Tasks: T04, T07, T15. Live `GET /api/trials?term=EGFR&condition=cancer` returns NCT02828709 first ("IRE for SRMs", kidney cancer), and its outcome measures include "estimated Glomerular Filtration Rate (eGFR)". 133 kidney-cancer trials match term EGFR. This is the default view of /clinical/trials (trial-landscape.tsx:60, trials/page.tsx:113). Fix: for gene symbols, search `AREA[Condition] OR AREA[Keyword] OR AREA[InterventionName]`, or append `NOT "glomerular filtration"`, and default the condition to the target's disease.

**S-03 BUG P2: placeholder MoA rows carry "Validated" status and confidence bars.** Tasks: T17. `src/app/disease-biology/mechanisms/page.tsx:37-39` has `status: "Validated", confidence: 92` next to `evidence: "Placeholder — no analysis has been run"`. The same pattern appears on the decisions pages (95%, 91%). Fix: use status "Placeholder" and hide the confidence for uncurated rows.

**S-04 BUG P2: real drugs on /compounds have wrong structures and stages.** Tasks: T02, T03, T05, T11. `src/app/compounds/page.tsx:24` vemurafenib SMILES `CCCS(=O)(=O)Nc1ccc(F)c(C(=O)c2cc[nH]c2C)c1F` lacks the chlorophenyl-pyrrolopyridine, so it does not match the MW of 489.92. Line 33 trametinib lacks the cyclopropyl. Approved drugs are labelled Screening/Hit/Preclinical. Erlotinib QED 0.81 vs ChEMBL 0.42. Fix: either take SMILES and properties from ChEMBL, or rename the rows to fictional SDD codes with no real drug names.

**S-05 BUG P2: the same IDs mean different entities on different pages.** Tasks: T06, T15, T24.
- TGT-002 is BRAF on /targets (targets/page.tsx:36) and MAPT on the board (src/data/target-board.ts:14). TGT-004 is PTGS2 vs EGFR T790M.
- SDD-0012 is "Vemurafenib" on /compounds and "Vemurafenib analog, MW 510.4" on /drug.
- SDD-0127 is crizotinib on /compounds, NK-BRAF-CAR on /drug, and "selective JAK2" in trial JAK-301. That trial's arm links to /drug (clinical/trials/page.tsx:52, 94).

Fix: one shared ID registry in `src/data/`, imported by every page.

**S-06 BUG P2: counts disagree between pages.** Tasks: T06.
- Melanoma has 1 target on /targets but 4 on /disease-biology/target-board.
- Target cards show compound counts of 42 (EGFR) and 22 (JAK2), but the linked `/compounds?target=` shows 4 and 0.

Fix: derive the counts from the shared data, not literals.

**S-07 BUG P3: the demo banner contradicts real data on the same page.** Tasks: T01, T12. /targets shows `DemoDataNotice` ("Entries, scores, IDs … are placeholders", data-provenance.tsx:19), yet the UniProt IDs are real and the curated panel sits below it. Fix: put the banner on individual fields (compound counts, target IDs) and mark UniProt as "verified".

**S-08 BUG P3: ChEMBL search ordering puts the wrong record first.** Tasks: T02, T10, T11. In live results, ruxolitinib returns CHEMBL1287854 (unnamed) above RUXOLITINIB, and erlotinib and osimertinib list the salt first. Fix (in api/search/route.ts): rank an exact `pref_name` match first, then the parent molecule.

**S-09 BUG P3: misleading "Search ChEMBL for JAK2" link.** Tasks: T13. compounds/page.tsx:197 links to the molecule-name search, which returns only BMS-911543 for "JAK2". Fix: link to the ChEMBL target report, or label the link "molecule names containing…".

**S-10 BUG P3: scientifically impossible demo drug.** Tasks: T26. drug/page.tsx:34 has "Osimertinib-R: covalent EGFR inhibitor repositioned for NSCLC (C797S)". C797S removes the covalent attachment site. Fix: replace it with a non-covalent or allosteric example, or remove it.

**S-11 BUG P3: upstream User-Agent names the wrong app.** Tasks: T30. `src/lib/upstream.ts:5` advertises `target.smartdrugdiscovery.org`. This is the same host confusion as S-01. Fix: use the studio host.

**S-12 BUG P3: phase label is wrong for some ChEMBL phases.** Tasks: T02, T05. search/page.tsx:82-86 and route.ts:58 map ChEMBL `max_phase` 0.5 (early phase 1), -1 and null (unknown) to "Preclinical". Fix: label 0.5 as "Early Ph1" and -1/null as "Unknown".

**S-13 BUG P3: accessibility gaps.** Tasks: T03, T11.
- molecule-viewer.tsx:53 sets `aria-label="2D structure: <raw SMILES>"`, so screen readers read SMILES.
- On /compounds, sortable `<th onClick>` has no button or `aria-sort` (compounds/page.tsx:97-108), so it is not keyboard operable.

Fix: pass the compound name to the label, and wrap headers in a button with `aria-sort`.

**S-14 BUG P3: Trial Landscape requests can overlap.** Tasks: T04, T16. trial-landscape.tsx:70-102 has no AbortController, so a phase or status change can race an in-flight query. "Load 25 more" can also append a page token from the previous query. Fix: abort stale requests and reset the token when filters change.

### Missing features

**S-15 FEATURE P2: Trial Landscape lacks intervention, location and eligibility search, and filters are not shareable.** Tasks: T07, T14, T16, T27, T29.
- Only `query.term` and `query.cond` are used (api/trials/route.ts:57-61). Missing: `query.intr`, `filter.geo` / `query.locn`, eligibility.
- Status options omit ENROLLING_BY_INVITATION, SUSPENDED and WITHDRAWN, and there is no phase N/A option.
- Only `term` is read from the URL.
- The CSV has no query/filter columns and does not say it is partial.

Fix: add Intervention and Near-location fields, put all filters in the URL, and add query/total columns to the CSV.

**S-16 FEATURE P2: no paging in ChEMBL search.** Tasks: T18, T30. route.ts:37 fixes `limit=25` with no offset, while the API reports total 2550 for "kinase inhibitor". Fix: accept `offset` and `limit` up to 100, and add "Load more" in the UI.

**S-17 FEATURE P2: no target-centric data (mechanism, approved drugs per target, IC50).** Tasks: T05, T10, T13, T15, T25. Fix: proxy ChEMBL `/mechanism` and `/activity` (pChEMBL, assay type, document) and show them on /search rows and target cards.

**S-18 FEATURE P2: no real evidence for synthesis tasks.** Tasks: T21–T24, T28. Fix: add Open Targets GraphQL proxy for associations and tractability on target cards, plus an exportable "target dossier" made only from live and curated sources.

**S-19 FEATURE P2: no documented public API or MCP.** Tasks: T18, T30. docs/api-reference.md:5 says the routes are "internal … not a public API" and omits /api/search and /api/trials. Fix: document both, including the provenance schema and rate limits, and consider a thin MCP wrapper.

**S-20 FEATURE P3: curated resistance table is incomplete for current use.** Tasks: T08, T12, T26.
- No CSV export.
- No 3rd-gen (post-osimertinib) mechanisms.
- No plain-language column.

Fix: add the export, extend the table with cited rows, and add a short lay summary.

**S-21 FEATURE P3: PDB link is unfiltered.** Tasks: T19. The link returns all 394 EGFR entries. Fix: add ligand-filtered links (e.g. YY3/osimertinib) and an inline list of entries with resolution and covalent-bond annotation.

**S-22 FEATURE P3: no regulatory or label data.** Tasks: T20. Fix: link or proxy Drugs@FDA/openFDA by ChEMBL ID.

**S-23 FEATURE P3: no disease-level genetic or literature prioritisation.** Tasks: T22. Fix: covered by S-18 (Open Targets association scores by datatype).

**S-24 FEATURE P3: no plain-language or guided mode for lay and novice users.** Tasks: T08, T06. Fix: add a short "what this means" line for curated rows and live results.

**Counts:** BUG 14 (P1 1, P2 5, P3 8) · FEATURE 10 (P2 5, P3 5) · total 24.

## Issue #36 diagnosis: "Upstream smoke test failing"

- **Symptom:** every scheduled run since 2026-11-10 fails in about 10 s. Both steps exit with `Process completed with exit code 22`, which is curl `-f` reporting HTTP ≥ 400. The issue therefore reports "ChEMBL=failure, ClinicalTrials.gov=failure".
- **Root cause:** `.github/workflows/upstream-smoke.yml:18` sets `BASE_URL: https://target.smartdrugdiscovery.org`. That is the separate DiseaseToTarget app, which has no `/api/search` or `/api/trials` routes. Reproduced from here:
  - `target.…/api/search?q=imatinib` → **404 text/html**
  - `target.…/api/trials?term=EGFR&condition=cancer` → **404 text/html**
  - `studio.…/api/search?q=imatinib` → **200 application/json**, 5 results, `source.name=="ChEMBL"`, `retrieved` set
  - `studio.…/api/trials?term=EGFR&condition=cancer` → **200**, total 4314, `results[0].nctId` = "NCT02828709"
- **Ruled out:**
  - The jq expressions are not the cause. They pass against the studio response, and failure happens at curl before jq runs.
  - CT.gov blocking runner IPs is not the cause. The proxy calls CT.gov from Vercel, not from the runner, and ChEMBL fails identically.
  - Vercel deployment protection is not the cause. It would return 401/403, and studio answers 200 publicly.
  - A real outage is not the cause. Both upstreams answer live, and the studio proxy works.
- **Recommended fix:**
  1. Change `BASE_URL` to `https://studio.smartdrugdiscovery.org`, or make it a repo variable `${{ vars.SMOKE_BASE_URL }}`.
  2. Use `curl -sS --fail-with-body -w '\nHTTP %{http_code}\n'` so the log shows the status code and body.
  3. Add a host-sanity check (`content-type` must be `application/json`) so a wrong host is reported as "wrong host", not as an upstream failure.
  4. Fix the matching User-Agent in `src/lib/upstream.ts:5` (S-11).
  5. Run the workflow with `workflow_dispatch`, confirm it is green, then close #36.
- **Side note:** the schedule is `17 11 * * *`, but runs start around 17:00–19:00 UTC because of GitHub scheduler delay. This is harmless but explains the timestamps.

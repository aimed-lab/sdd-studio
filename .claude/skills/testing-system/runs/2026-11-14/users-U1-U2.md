# Run 2026-11-14 — simulated users U1 and U2

Users: **U1 Dr. Sarah Kim** (cancer-biology postdoc, medium tech, weekly UI user, wants provenance, PubMed and UniProt) and
**U2 Dr. Marcus Chen** (computational biologist, high tech, API-first, wants bulk data and reproducibility).
Ratings use the 0–5 rubric in `profiles-and-use-cases.md`. The expert ceiling is `site-capability.md`; the AI-alone view is
`ai-alone-baseline.md`, re-scored for what each user needs (U1 caps any unsourced answer at 3 and docks answers with unchecked
PMIDs; U2 credits AI-written code he can run himself). Times are site-attempt minutes in character.

Evidence was gathered read-only: page source under `src/app/**` and live GETs to
`studio.smartdrugdiscovery.org/api/search` and `/api/trials` on 2026-11-14 (no POST/PUT/DELETE; nothing built or run).

## U1 — Dr. Sarah Kim (cancer-biology postdoc)

| Task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 2 | full | 4 | 3 | +1 | Bookmarked /targets; UniProt P00533 links out so I can verify, though the 'IDs are placeholders' banner made me double-check. |
| T02 Vemurafenib ID/SMILES/MW/status | 3 | full | 4 | 3 | +1 | /search gives CHEMBL1229517 + ChEMBL link; I nearly used /compounds first and its SMILES is wrong, which shook me. |
| T03 Imatinib 2D structure | 2 | full | 4 | 2 | +2 | Rendered structure from the ChEMBL SMILES; the chat can only give me a string. |
| T04 Recruiting Ph3 EGFR NSCLC | 4 | full | 4 | 1 | +3 | Live count and real NCT links; I had to guess that 'Trial Simulations' in the menu is where the real trials live. |
| T05 Approved drugs for BRAF V600E | 6 | partial | 2 | 3 | -1 | I already know vemurafenib/dabrafenib/encorafenib; the site only confirms phase 4, nothing about V600E or the label. |
| T06 Melanoma program targets | 4 | partial | 1 | 0 | +1 | /targets says 1, the Target Board says 4; I cannot tell which list is the program's. |
| T07 EGFR trial CSV with source/date | 3 | full | 3 | 0 | +3 | Source and retrieval date are in the CSV, but it holds only the 25 rows I loaded, which I only noticed in Excel. |
| T08 Lay explanation of C797S | 3 | partial | 2 | 4 | -2 | The curated row is accurate but written for me, not for my mother; the chat explanation was better for that. |
| T09 Source for MET amp -> gefitinib resistance | 2 | full | 4 | 3 | +1 | Engelman 2007 with PMID and DOI, and the numbers match the abstract: exactly what I come here for. |
| T10 Ruxolitinib targets + MoA | 4 | partial | 2 | 3 | -1 | Only an ID and 'Approved', and an unnamed isomer is listed first; no JAK1/JAK2 mechanism. |
| T11 MW/logP/HBA/HBD/QED for 3 TKIs | 6 | full | 4 | 2 | +2 | Values match ChEMBL once I skip the salt rows; the chat's HBA/logP were slightly off with no method. |
| T12 EGFR TKI resistance with citations | 3 | partial | 3 | 2 | +1 | Five verified PMIDs, but nothing post-osimertinib (MET on 3rd-gen, PIK3CA, fusions), which is my actual project. |
| T13 JAK2 inhibitors with IC50 | 8 | none | 0 | 2 | -2 | /compounds?target=JAK2 shows 0 and 'Search ChEMBL for JAK2' returns one molecule; I went to ChEMBL directly. |
| T14 True BRAF+MEK combo trials | 12 | partial | 2 | 3 | -1 | 'BRAF MEK' free text pulls in an exercise study; I weeded rows by hand. The chat at least named the real pivotal trials. |
| T15 BRAF -> melanoma -> drugs -> trials | 12 | partial | 2 | 2 | +0 | The trials step is real; the target-to-drug step is demo and the IDs collide across pages. |
| T16 KRAS G12C NSCLC by sponsor/phase | 10 | partial | 3 | 2 | +1 | Sponsor and phase columns exist, but I had to click 'Load 25 more' six times and pivot in Excel. |
| T17 Is the '92% confidence' sourced? | 3 | full | 3 | 1 | +2 | The row literally says 'Placeholder' next to a 'Validated 92%' badge; I now ignore the Biology section. |
| T18 50 'kinase inhibitor' compounds via API | 6 | partial | 1 | 2 | -1 | The UI says '25 of 2550' with no way to see more; I don't know there is an API. |
| T19 PDB EGFR-osimertinib (Cys797) | 10 | partial | 2 | 3 | -1 | The PDB link dumps all 394 EGFR entries; I filtered on RCSB myself. |
| T20 Osimertinib FDA history/label | 3 | none | 1 | 3 | -2 | Site says 'Approved' only; I went to Drugs@FDA. The chat timeline was right but unsourced. |
| T21 MAPT tractability by modality | 6 | none | 1 | 3 | -2 | /targets?q=MAPT has no match (and no search box); the board's 'Medium' is demo. |
| T22 Prioritise NSCLC targets | 8 | none | 1 | 3 | -2 | Only the demo Target Board; no Open Targets scores to cite in a lab meeting. |
| T23 AD repositioning candidates | 5 | none | 1 | 2 | -1 | Outside my field and the /drug list is demo; I can't vet an unsourced chat list either. |
| T24 JAK2 validation dossier | 10 | none | 1 | 2 | -1 | Nothing exportable; SDD-0127 means three different things on three pages. |
| T25 EGFR inhibitor selectivity | 5 | none | 0 | 2 | -2 | No bioactivity data anywhere on the site. |
| T26 Strategies vs C797S | 10 | partial | 2 | 2 | +0 | Curated C797S row is good, but 'Osimertinib-R covalent for C797S' on /drug is impossible and I spotted it at once; the chat gave 2 wrong PMIDs. |
| T27 BRAF+MEK+PD-1 triplet | 15 | partial | 2 | 3 | -1 | Trial search surfaces candidates but no intervention filter and no toxicity; the chat rationale was good but needed PMID checks. |
| T28 GO/NO-GO from real evidence | 3 | none | 1 | 2 | -1 | Decision pages are all demo; not my decision to make anyway. |
| T29 Patient match, Birmingham | 15 | partial | 2 | 1 | +1 | 23 recruiting worldwide, no location filter; I opened each on CT.gov to check sites for a clinician colleague. |
| T30 Answer via agent/MCP/API | 5 | none | 1 | 0 | +1 | 'ChEMBL MCP Server' on Tool Plugins is a catalog card I can't use; nothing tells me an API exists. |

**Totals (U1):** full 8 · partial 13 · none 9 · not_attempted 0 · mean site_q **2.10** · mean ai_q **2.13** · mean delta **-0.03** · total **188 min** (site better on 13 tasks, AI better on 15, tie on 2)

**Reflection (U1).** I come here for one thing: facts I can cite, and when the site has them (the EGFR resistance table, live
ChEMBL search, the trial landscape) it beats a chatbot because every number has a PMID or a ChEMBL link and a retrieval date. The trouble is that
those pages are not in the menu: I reach /search and /targets only through bookmarks, and the menu sends me to demo pages with "Validated 92%" badges and a
covalent drug "for C797S" that cannot exist. Once I saw that, I started double-checking everything, which cancels much of the time I save. For
anything beyond lookups (IC50s, post-osimertinib resistance, FDA history) I go straight to ChEMBL, PubMed or Drugs@FDA, so overall it is a tie with the chat.

## U2 — Dr. Marcus Chen (computational biologist)

| Task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 2 | full | 3 | 3 | +0 | Correct, but /targets is a static page with no JSON and a banner saying IDs are placeholders; I re-checked with UniProt REST. |
| T02 Vemurafenib ID/SMILES/MW/status | 3 | full | 5 | 3 | +2 | Found /api/search in devtools; JSON with queryUrl and retrieved timestamp is exactly reproducible. |
| T03 Imatinib 2D structure | 2 | full | 4 | 3 | +1 | UI renders it; I would take the API SMILES into RDKit anyway. |
| T04 Recruiting Ph3 EGFR NSCLC | 3 | full | 4 | 1 | +3 | /api/trials with PHASE3+RECRUITING gives total 47 today plus NCT IDs; term is free text so I still sanity-check. |
| T05 Approved drugs for BRAF V600E | 5 | partial | 2 | 3 | -1 | No target->drug endpoint; I fell back to ChEMBL /mechanism directly. |
| T06 Melanoma program targets | 3 | partial | 1 | 0 | +1 | Demo only, no API, and two pages disagree. |
| T07 EGFR trial CSV with source/date | 4 | full | 3 | 2 | +1 | UI CSV has source/retrieved but only loaded rows and no query; I paged the API with pageToken and built my own. |
| T08 Lay explanation of C797S | 2 | partial | 2 | 4 | -2 | Not my need; the curated row is technical. I would just ask a chat model. |
| T09 Source for MET amp -> gefitinib resistance | 3 | full | 4 | 3 | +1 | Curated row is verified, but UI-only; I copied the PMID by hand. |
| T10 Ruxolitinib targets + MoA | 4 | partial | 2 | 3 | -1 | API lists unnamed CHEMBL1287854 first and has no mechanism field. |
| T11 MW/logP/HBA/HBD/QED for 3 TKIs | 5 | full | 4 | 2 | +2 | Three API calls + pandas; salts come first and there is no parent ID or InChIKey to dedupe on. |
| T12 EGFR TKI resistance with citations | 3 | partial | 3 | 2 | +1 | Good citations but not machine-readable and missing post-osimertinib mechanisms. |
| T13 JAK2 inhibitors with IC50 | 5 | none | 0 | 2 | -2 | No /activity proxy; went straight to ChEMBL. |
| T14 True BRAF+MEK combo trials | 12 | partial | 3 | 3 | +0 | term='BRAF AND MEK' passes Essie syntax; I post-filtered the interventions field against a BRAFi/MEKi list. |
| T15 BRAF -> melanoma -> drugs -> trials | 10 | partial | 2 | 2 | +0 | Only the trials and compound hops are real; the join between them is mine to build. |
| T16 KRAS G12C NSCLC by sponsor/phase | 8 | full | 4 | 2 | +2 | Paged 6x with pageToken and groupby'd sponsor x phase in pandas: the API made this easy. |
| T17 Is the '92% confidence' sourced? | 3 | full | 3 | 1 | +2 | Read the page and source: placeholder row with a Validated badge. |
| T18 50 'kinase inhibitor' compounds via API | 6 | partial | 1 | 3 | -2 | limit=50&offset=25 silently returns the same first 25; I only noticed by diffing IDs. The chat wrote working ChEMBL paging code. |
| T19 PDB EGFR-osimertinib (Cys797) | 6 | partial | 2 | 3 | -1 | Unfiltered RCSB link; I wrote the RCSB ligand query (YY3) myself. |
| T20 Osimertinib FDA history/label | 2 | none | 1 | 3 | -2 | No regulatory data; openFDA directly. |
| T21 MAPT tractability by modality | 4 | none | 1 | 3 | -2 | Demo only; I queried Open Targets GraphQL myself. |
| T22 Prioritise NSCLC targets | 5 | none | 1 | 2 | -1 | Demo board; no association scores to rank or reproduce. |
| T23 AD repositioning candidates | 4 | none | 1 | 2 | -1 | Demo list; chat rationale is plausible but not reproducible. |
| T24 JAK2 validation dossier | 6 | none | 1 | 2 | -1 | No dossier and no evidence endpoint to assemble one. |
| T25 EGFR inhibitor selectivity | 4 | none | 0 | 2 | -2 | No bioactivity data; would need ChEMBL /activity by target. |
| T26 Strategies vs C797S | 8 | partial | 2 | 2 | +0 | One good curated row; the /drug demo entry is scientifically impossible. |
| T27 BRAF+MEK+PD-1 triplet | 12 | partial | 2 | 3 | -1 | API search + intervention post-filter finds trials; no toxicity or results fields. |
| T28 GO/NO-GO from real evidence | 2 | none | 1 | 2 | -1 | All decision pages are demo; not my role. |
| T29 Patient match, Birmingham | 10 | partial | 2 | 1 | +1 | No location field in the API; I used CT.gov filter.geo directly. |
| T30 Answer via agent/MCP/API | 15 | partial | 3 | 0 | +3 | Wrapped /api/search and /api/trials as notebook tools; they work, but are undocumented, need 'term', reject lowercase enums and send no CORS. |

**Totals (U2):** full 9 · partial 13 · none 8 · not_attempted 0 · mean site_q **2.23** · mean ai_q **2.23** · mean delta **+0.00** · total **161 min** (site better on 12 tasks, AI better on 14, tie on 4)

**Reflection (U2).** The two JSON endpoints are the best part of the site: they return clean rows with `queryUrl`, a `retrieved` timestamp and
working `pageToken` paging, and I had KRAS G12C sponsor-by-phase in pandas in eight minutes. But I found them through devtools, because the docs call
them internal, and they fail in ways a pipeline does not notice: `limit`/`offset` are silently ignored, a SMILES query returns 10,000 unrelated hits, and
the rows carry no InChIKey or parent ID. Everything target-centric (activity, mechanism, Open Targets, PDB) I still pull from the upstream APIs myself,
so the site saves me time on trials and little else. A chat model that writes the upstream query code gets me about as far.

## New issues (not in S-01…S-24)

### U1 (UI user)

**U1-01 BUG P1: the live-data pages are not in the navigation.** The sidebar (`src/app/auth-gate.tsx:96-148`, `navGroups`) lists only
Projects/Biology/Pharmacology/Clinical/Regulation pages, which are mostly demo pages. `/search` (live ChEMBL), `/targets` (real UniProt IDs and the curated
resistance table), `/compounds` and `/drug` have no menu entry. `/` redirects to `/projects` (`src/app/page.tsx:4`). The only in-app link to `/search` is the
zero-match fallback on `/compounds` (`compounds/page.tsx:205`). `/targets` is reachable only from a selected MoA row, a /drug row or /compounds.
Observed: a weekly user relies on bookmarks, and a new user would find only demo pages. **Fix:** add a "Live data" group at the top of the sidebar
(Compound search · ChEMBL, Targets & curated evidence, Trial landscape · CT.gov), or a header search box that routes to `/search`.

**U1-02 BUG P2: "Trial Simulations" label hides the live trial landscape.** `auth-gate.tsx:133` labels `/clinical/trials` "Trial Simulations",
but its default tab is the live "Trial Landscape (ClinicalTrials.gov)" (`clinical/trials/page.tsx:124-127`). A user looking for real trials skips a
menu item that says "simulations". **Fix:** rename it to "Trials (live CT.gov + demo programs)", or split it into two entries.

**U1-03 BUG P3: /targets has no search box.** `targets/page.tsx:110-112` filters only from the `?q=` URL parameter, and the page has no `<input>`.
To check MAPT I had to edit the URL. **Fix:** add a filter input that writes `?q=` and shows the existing Open Targets fallback.

**U1-04 BUG P3: /search does not put the query in the URL.** `search/page.tsx:51-80` reads `?q=` once on load, but submitting the form calls
`runSearch` without `router.replace`. A search I type cannot be bookmarked or shared, and Back does not restore it. **Fix:** on submit, `router.replace(`/search?q=…`)`
and let the existing effect run the search.

- S-03: impact for this user: the "Validated · 92%" placeholder made her stop trusting the whole Biology menu, which is where the sidebar sends her.
- S-04 / S-05: impact for this user: she reached `/compounds` before `/search` once (neither is in the menu, U1-01) and saw a wrong vemurafenib SMILES next to the real drug name. That is the most damaging trust failure for a provenance-first user.
- S-10: impact for this user: a cancer biologist spots "covalent … for C797S" in seconds and then discounts the site's science.
- S-20: impact for this user: her project is post-osimertinib resistance, so the missing 3rd-generation rows matter most. She also wants a "copy citation / RIS" button, not just CSV.

### U2 (API user)

**U2-01 BUG P2: unknown query parameters are silently ignored.** `GET /api/search?q=kinase%20inhibitor&limit=50&offset=25` returned the same first 25
rows (CHEMBL4536936, CHEMBL237352, …) as the call without paging, with HTTP 200 and no warning. `/api/trials?…&pageSize=100` returned 25. A pipeline
asking for 50 believes it got the second page. `api/search/route.ts:30-37` and `api/trials/route.ts:43-48` read only the known keys. **Fix:** return 400 for
unknown parameters, or echo the applied `limit`/`offset`/`pageSize` in the response, and implement them (see S-16).

**U2-02 BUG P2: structure and accession queries fall through to free-text search.** `GET /api/search?q=CC(=O)Oc1ccccc1C(=O)O` (aspirin SMILES)
returns `total: 10000`, led by CHEMBL82353, ALMECILLIN and ORTHOTOLIDINE, with no warning. `q=P00533` returns 0 with no hint. Only `^CHEMBL\d+$` is
special-cased (`route.ts:35-37`). **Fix:** detect SMILES and InChIKey and route them to ChEMBL `molecule?molecule_structures__standard_inchi_key=` or
`/similarity/{smiles}/{cutoff}`, or return 400 "structure search not supported". Answer UniProt accessions with a pointer to the target lookup.

**U2-03 FEATURE P2: /api/trials requires `term`, so condition-only queries fail.** `GET /api/trials?condition=melanoma` → 400
`"Query parameter 'term' is required"` (`api/trials/route.ts:50`). Landscape pulls by disease are the most common bulk use. **Fix:** require at least one of
term / condition / (future) intervention.

**U2-04 BUG P3: enum parameters are case-sensitive, single-valued and do not list allowed values.** `status=recruiting` → "Unknown status 'recruiting'".
`status=RECRUITING,NOT_YET_RECRUITING` is rejected, although CT.gov `filter.overallStatus` accepts comma lists. `phase=3` → "Unknown phase '3'"
(`route.ts:53-54`). **Fix:** normalise case, accept comma-separated lists, map `3` to `PHASE3`, and include `"allowed": [...]` in the 400 body.

**U2-05 FEATURE P2: compound rows lack join keys.** `api/search/route.ts:48-60` returns chemblId, name, SMILES and properties, but no InChIKey, no parent
ChEMBL ID and no salt flag. Osimertinib returns OSIMERTINIB MESYLATE first (595.73 Da), and there is no field to collapse salts to parents or to join with
PubChem or other sets. **Fix:** add `standardInchiKey`, `parentChemblId` (from `molecule_hierarchy`) and `firstApproval`. This also fixes the ordering in S-08.

**U2-06 FEATURE P3: provenance has no upstream data release.** `source` gives name, queryUrl, `retrieved` and `cacheTtlSeconds`, but not the ChEMBL release
or the CT.gov data timestamp. `retrieved` is the cache fill time (two calls minutes apart both showed `02:49:19.000Z`), which is honest but undocumented.
**Fix:** add `release` (ChEMBL `/status.json` `chembl_db_version`, CT.gov `/api/v2/version` `dataTimestamp`) and document what `retrieved` means.

**U2-07 FEATURE P3: trial rows are too thin for downstream analysis.** `FIELDS` (`api/trials/route.ts:19-29`) omits the record URL, LastUpdatePostDate,
PrimaryCompletionDate, locations (city/state/country) and intervention type. T29 and T14 need these. **Fix:** add these fields, or accept a
whitelisted `fields=` parameter.

**U2-08 FEATURE P3: no CORS header on the read-only proxies.** A GET with `Origin: https://example.org` returns no `Access-Control-Allow-Origin`, so
browser notebooks (Observable, JupyterLite) cannot call the API. **Fix:** send `Access-Control-Allow-Origin: *` on the GET-only `/api/search` and `/api/trials`.

**U2-09 BUG P3: the ChEMBL search CSV is not reproducible.** `search/page.tsx:155-158` passes only `source.name` and `retrieved` to the CSV, without
the query string or `queryUrl`, and the filename embeds the raw query. S-15 covers the trial CSV only. **Fix:** add `query` and `queryUrl` columns and sanitise the filename.

**U2-10 FEATURE P3: curated evidence is not machine-readable.** The EGFR resistance table and target cards are compiled into TSX
(`src/data/curated/egfr-resistance`, `targets/page.tsx:15-90`), and no endpoint serves them. **Fix:** `GET /api/curated/egfr-resistance` and
`GET /api/targets` returning the same rows with PMIDs, DOIs and the reviewed date.

- S-16: impact for this user: the 25-row cap is what breaks T18 outright, and U2-01 makes it silent.
- S-19: impact for this user: he found the endpoints only through devtools; docs/api-reference.md calling them "not a public API" makes him unwilling to build on them.
- S-12: impact for this user: in the JSON, `maxPhase` null is coerced to 0 (`route.ts:58`), so "unknown" and "preclinical" cannot be told apart programmatically.
- S-17 / S-18: impact for this user: every target-centric task (T05, T10, T13, T21–T25) sends him back to the upstream APIs, so the site's value to him is trials plus a compound lookup.

**New issue count:** U1 4 (BUG 4: P1 1, P2 1, P3 2) · U2 10 (BUG 4, FEATURE 6; P2 4, P3 6) · **total 14**.

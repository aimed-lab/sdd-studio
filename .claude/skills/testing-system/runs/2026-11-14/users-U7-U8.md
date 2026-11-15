# Run 2026-11-14 — simulated users U7 and U8

Inputs: `profiles-and-use-cases.md`, `site-capability.md` (expert ceiling, S-01…S-24), `ai-alone-baseline.md`.
Extra evidence for this report: page source read at `main` @ ae78956, plus read-only GET calls to
`studio.smartdrugdiscovery.org/api/search` and `/api/trials` on 2026-11-15 UTC. Nothing was written to the site.

Two findings shape both users' scores more than any S-issue does:

1. **The verified live tools cannot be reached from the navigation.** The sidebar (`src/app/auth-gate.tsx:95-146`, `:313-321`)
   has no link to `/search`, `/targets` or `/compounds`, and `/` redirects to `/projects` (`src/app/page.tsx:4`), which is demo data.
   The live ClinicalTrials.gov search is at `/clinical/trials`, but the sidebar calls it **"Trial Simulations"** (`auth-gate.tsx:133`).
   `/targets` can only be reached from links inside demo pages (`disease-biology/mechanisms/page.tsx:200`, `drug/page.tsx:169`,
   `compounds/page.tsx:192`). `/search` can only be reached from a zero-result link on `/compounds` (`compounds/page.tsx:205`), and
   `/compounds` is not in the sidebar either.
2. **The JSON API accepts any parameter without complaint.** `limit=50&offset=25` returns the same 25 rows, and `location=Birmingham`
   returns the same total of 45. The response gives no sign that these parameters were ignored.

Scoring: 0–5 rubric from `profiles-and-use-cases.md`. delta = site_q − ai_q. A task the user would not try gets
`not_attempted`, time 0 and site_q 0. Its ai_q is still recorded, because this user would simply ask a chat AI.

---

## U7 — Dr. Aisha Bello, oncologist / physician-scientist (low tech, high clinical, visits between clinics)

She has about 5 minutes per visit and expects a search box. After logging in she lands on the `/projects` demo. She finds
real trial data only after opening Clinical → "Trial Simulations", even though she expects that page to be fake. She reaches
`/targets` once, by following a gene link on the Mechanisms page, and bookmarks it. She never finds `/search`.

| Task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 6 | partial | 2 | 4 | −2 | "Found an EGFR card by clicking around Biology, but the banner says the IDs are placeholders, so I don't trust it." |
| T02 Vemurafenib ID/SMILES/MW/status | 4 | none | 0 | 4 | −4 | "There's no search box anywhere in the menu. I know it's approved and I don't need SMILES anyway." |
| T03 Imatinib 2D structure | 3 | none | 0 | 2 | −2 | "Couldn't find a structure viewer. I'd just image-search it." |
| T04 Recruiting Ph3 EGFR NSCLC | 5 | full | 4 | 1 | +3 | "It's under 'Trial Simulations'?! But it gives 45 trials, live and linked. The chatbot's list is all closed to accrual; I know MARIPOSA is." |
| T05 Approved drugs for BRAF V600E | 2 | none | 0 | 4 | −4 | "I prescribe these. The site couldn't list them, and the AI got them right." |
| T06 Melanoma program targets | 3 | partial | 1 | 0 | +1 | "The Target Board shows 4 melanoma targets. I didn't notice it's demo until I saw 'CD8+ T cells' listed as a target." |
| T07 EGFR trial CSV with source/date | 3 | full | 3 | 0 | +3 | "Useful to send to our research nurse. But it only exported the 25 rows on screen, and the default list started with kidney trials." |
| T08 Lay explanation of C797S | 4 | partial | 2 | 4 | −2 | "The curated row is accurate but I can't hand it to a patient. The AI's wording is what I'd actually use." |
| T09 Source for MET amp → gefitinib resistance | 3 | full | 4 | 4 | 0 | "Engelman 2007 with a PubMed link. Good. I'd have recalled it anyway." |
| T10 Ruxolitinib target + MoA | 2 | none | 0 | 4 | −4 | "JAK1/2. I know that. The site has no way for me to look up a drug." |
| T11 MW/logP/QED of 3 TKIs | 0 | not_attempted | 0 | 3 | −3 | "Not clinically relevant to me." |
| T12 EGFR TKI resistance with citations | 4 | partial | 3 | 3 | 0 | "Citations are real, which I like. But what I see in clinic is post-osimertinib resistance (MET, fusions, transformation), and that's missing." |
| T13 JAK2 inhibitors IC50 | 0 | not_attempted | 0 | 2 | −2 | "Bench question, not mine." |
| T14 True BRAF+MEK combo trials | 6 | partial | 2 | 3 | −1 | "11 'BRAF MEK' hits, including an exercise study. I stopped checking after the third false positive." |
| T15 BRAF → melanoma → drugs → trials | 8 | partial | 2 | 2 | 0 | "Only the trial step worked. Nothing linked BRAF to its drugs." |
| T16 KRAS G12C NSCLC by sponsor/phase | 5 | partial | 3 | 2 | +1 | "Sponsor and phase columns are enough for me to see who is recruiting. No summary, but fine." |
| T17 Is "92% confidence" sourced? | 3 | full | 3 | 1 | +2 | "A green 'Validated 92%' next to 'Placeholder — no analysis has been run'. That makes me doubt the rest of the site." |
| T18 50 compounds via API | 0 | not_attempted | 0 | 1 | −1 | "I don't write code." |
| T19 PDB EGFR–osimertinib | 0 | not_attempted | 0 | 2 | −2 | "Not my field." |
| T20 Osimertinib FDA history/label | 3 | none | 0 | 4 | −4 | "Only says 'Approved'. The AI timeline (2015 accelerated … 2024 LAURA) matches what I know; I'd confirm on the label." |
| T21 MAPT tractability | 0 | not_attempted | 0 | 2 | −2 | "Neurology, not oncology." |
| T22 Prioritise NSCLC targets | 4 | none | 1 | 3 | −2 | "The board shows scores with no source. I nearly quoted one before I saw the demo banner." |
| T23 AD repositioning | 0 | not_attempted | 0 | 3 | −3 | "Not my area." |
| T24 JAK2 dossier | 0 | not_attempted | 0 | 2 | −2 | "Not my area." |
| T25 EGFR selectivity WT/mutant/HER2 | 2 | none | 0 | 2 | −2 | "Wild-type sparing matters for rash and diarrhoea, but there's nothing here." |
| T26 C797S strategies | 5 | partial | 3 | 2 | +1 | "Searching trials for 'C797S' gives 8 recruiting lung studies, which is useful. 'Osimertinib-R covalent for C797S' on /drug is nonsense, though." |
| T27 BRAF+MEK+PD-1 triplet | 6 | partial | 2 | 4 | −2 | "The AI's IMspire150/COMBI-i summary is what I need. The site gives raw trials and no toxicity data." |
| T28 GO/NO-GO | 0 | not_attempted | 0 | 2 | −2 | "Portfolio decisions aren't my job." |
| T29 Patient match, L858R post-osimertinib, Birmingham | 15 | partial | 2 | 1 | +1 | "There's no location filter. Typing 'Birmingham' into the term box gave 1 trial. I opened CT.gov tab after tab and ran out of time before clinic." |
| T30 Answer via agent/API | 0 | not_attempted | 0 | 0 | 0 | "Not something I'd do." |

**U7 totals:** full 4 · partial 10 · none 7 · not_attempted 9. Mean site_q **1.23**, mean ai_q **2.37**, mean delta **−1.13**,
total site time **96 min**.

**Reflection (U7):** I came for one thing, which is recruiting trials my patient can actually get to. The live trial search is
genuinely better than asking a chatbot, which confidently gave me trials that closed to accrual months ago. But I nearly
missed it, because the menu calls it "Trial Simulations". It has no way to say "near Birmingham", so for my real patient I
still ended up on ClinicalTrials.gov. Everything else is either hidden or demo data that looks real, and one "Validated 92%"
placeholder is enough to make me stop trusting a site.

---

## U8 — Kenji Watanabe, ML engineer at an AI-biotech (very high tech, low bio, API/MCP only)

He never uses the UI: it needs a login and admin approval, and he wants machine access anyway. `docs/api-reference.md` says
the routes are internal and does not list `/api/search` or `/api/trials`. He finds them in about 10 minutes by reading
`src/app/api/` in the repo. He judges every answer by whether it is structured, paginated and carries provenance. He cannot
check the biology himself, so he cannot catch an AI's wrong PMID or a free-text false positive.

| Task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 3 | none | 0 | 3 | −3 | "There's no target endpoint (`/api/targets` is 404). I'll call UniProt REST myself." |
| T02 Vemurafenib ID/SMILES/MW/status | 2 | full | 5 | 3 | +2 | "Clean JSON with `source.queryUrl` and `retrieved`. Exactly what I want." |
| T03 Imatinib 2D structure | 2 | full | 4 | 3 | +1 | "I take the SMILES and render it in RDKit. The parent record comes first." |
| T04 Recruiting Ph3 EGFR NSCLC | 3 | full | 4 | 1 | +3 | "`phase=PHASE3&status=RECRUITING` gives total 45 and a page token. I can't tell which ones only *mention* EGFR." |
| T05 Approved drugs for BRAF V600E | 8 | partial | 2 | 3 | −1 | "No target→drug query. I asked a chatbot for the names, then looked each one up. That's backwards." |
| T06 Melanoma program targets | 2 | none | 0 | 0 | 0 | "This data is UI-only and demo. There's no endpoint for it." |
| T07 EGFR trials CSV with source/date | 6 | full | 4 | 0 | +4 | "I paged through with `nextPageToken` and wrote my own file with `queryUrl` and `retrieved` on every row. Rows have no record URL." |
| T08 Lay explanation of C797S | 1 | none | 0 | 4 | −4 | "Nothing in the API. The chatbot explanation is what I needed as a non-biologist." |
| T09 Source for MET amp → gefitinib | 2 | none | 0 | 3 | −3 | "The curated table is hard-coded in a React component with no endpoint. I'd check the AI's PMID with E-utilities." |
| T10 Ruxolitinib target + MoA | 4 | partial | 1 | 3 | −2 | "`results[0]` is CHEMBL1287854 with no name. My pipeline took it as ruxolitinib. No mechanism field." |
| T11 MW/logP/HBA/HBD/QED ×3 | 4 | full | 4 | 2 | +2 | "Matches ChEMBL, but the salt comes first, so I had to filter on `name == query`. `logP` is really ALogP and isn't labelled as such." |
| T12 Resistance mechanisms with citations | 2 | none | 0 | 2 | −2 | "No endpoint. A 1-in-5 wrong-PMID rate from the AI is unusable as training labels." |
| T13 JAK2 inhibitors IC50 | 3 | none | 0 | 1 | −1 | "No activity endpoint. A single IC50 without the assay is noise to me." |
| T14 True BRAF+MEK combo trials | 8 | partial | 2 | 2 | 0 | "No `intervention` parameter. String-matching `interventions[]` needs a drug list I don't have." |
| T15 BRAF → melanoma → drugs → trials | 12 | partial | 2 | 2 | 0 | "I can chain two of the four hops. The drug-target hop doesn't exist." |
| T16 KRAS G12C NSCLC by sponsor/phase | 6 | full | 4 | 1 | +3 | "6 pages of 25, then a groupby in pandas. Easy." |
| T17 Is "92%" sourced? | 0 | not_attempted | 0 | 1 | −1 | "UI-only, so I won't log in for it." |
| T18 50 "kinase inhibitor" compounds | 8 | partial | 1 | 3 | −2 | "`limit=50&offset=25` returned the same 25 rows with a 200 and no warning. The AI wrote a working ChEMBL client I could run myself." |
| T19 PDB EGFR–osimertinib | 3 | none | 0 | 2 | −2 | "No structure endpoint. I'd query the RCSB search API directly." |
| T20 Osimertinib FDA history | 2 | none | 0 | 2 | −2 | "Nothing in the API. The AI's dates have no source, so I can't use them." |
| T21 MAPT tractability | 2 | none | 0 | 2 | −2 | "I'd call Open Targets GraphQL myself." |
| T22 Prioritise NSCLC targets | 2 | none | 0 | 2 | −2 | "Same. There are no association scores to pull." |
| T23 AD repositioning | 2 | none | 0 | 2 | −2 | "No endpoint, and the AI's answer has no source." |
| T24 JAK2 dossier | 3 | none | 0 | 1 | −1 | "I want a JSON dossier. Neither gives one." |
| T25 EGFR selectivity | 2 | none | 0 | 1 | −1 | "No activity data at all." |
| T26 C797S strategies | 5 | partial | 2 | 2 | 0 | "`term=C797S` gives 8 recruiting trials. That's the only machine-readable piece." |
| T27 BRAF+MEK+PD-1 triplet | 6 | partial | 2 | 3 | −1 | "I got trial rows but no toxicity or results fields." |
| T28 GO/NO-GO | 2 | none | 0 | 1 | −1 | "No data to compute anything from." |
| T29 Patient match, Birmingham | 10 | partial | 1 | 1 | 0 | "`location=Birmingham` was silently ignored (total still 45), and rows have no sites. I had to call CT.gov once per NCT ID." |
| T30 Answer via agent/API | 15 | partial | 2 | 0 | +2 | "I wrapped the two GET routes as agent tools by hand. No OpenAPI, no MCP, no version, no CORS. It works, but it's undocumented." |

**U8 totals:** full 6 · partial 9 · none 14 · not_attempted 1. Mean site_q **1.33**, mean ai_q **1.87**, mean delta **−0.53**,
total site time **130 min**.

**Reflection (U8):** The two JSON routes are actually nice. They have a consistent shape, an honest 502 instead of fake data,
and a `source` block with the exact upstream query and retrieval time, which is more provenance than most vendors give me.
But I had to read the source code to find them. They silently ignore every parameter they don't know, and two endpoints
cover only about a third of what I'd want. For everything else I'd skip this site and call ChEMBL, CT.gov and Open Targets
directly. A chatbot is useful to me only for writing that client code or explaining biology, never as a data source.

---

## New issues (not in S-01…S-24)

**U7-01 BUG P1: the verified live tools are missing from the navigation.**
- Evidence: the sidebar groups in `src/app/auth-gate.tsx:95-146` and the top-level items at `:313-321` contain no link to
  `/search`, `/targets` or `/compounds`, and `src/app/page.tsx:4` redirects `/` to `/projects`, which is demo data.
- Search of `src/`: `/targets` is linked only from demo pages (`mechanisms/page.tsx:200`, `drug/page.tsx:169`,
  `compounds/page.tsx:192`). `/search` is linked only from a zero-result link at `compounds/page.tsx:205`.
- Effect: a low-tech user cannot reach the three things the capability audit found to be correct.
- Fix: add a top-level "Live data" group with "Compound search (ChEMBL)", "Targets", and "Trial finder (ClinicalTrials.gov)".
  Make `/` land on a page with one search box that routes to these.

**U7-02 BUG P2: the live ClinicalTrials.gov search is labelled "Trial Simulations".**
- Evidence: `auth-gate.tsx:133` labels `/clinical/trials` "Trial Simulations". The page itself defaults to the real
  "Trial Landscape (ClinicalTrials.gov)" tab (`clinical/trials/page.tsx:30-33`).
- Effect: a clinician reads "simulations" as fake and skips it.
- Fix: rename the sidebar entry "Trial finder (ClinicalTrials.gov)". Move the demo designs to their own "Trial designs (demo)" entry.

**U7-03 FEATURE P2: login and admin approval are required to read public data.**
- Evidence: `auth-gate.tsx:38-40` renders `LoginPage` for every route. `AccountStatusGate` holds new accounts on "pending
  administrator review" (`components/pending-approval-screen.tsx:64, 97`).
- Effect: an occasional user between clinics must remember a password, and a first-time user waits for a human just to
  search ClinicalTrials.gov or ChEMBL. The underlying `/api/*` routes are already public.
- Fix: allow anonymous read-only access to the live public-data pages (`/search`, `/targets`, the trial finder), and keep
  demo, internal and admin modules behind login.

**U7-04 BUG P3: the trial results table is unusable on a phone.**
- Evidence: `clinical/trials/page.tsx:22` uses `p-8`. `trial-landscape.tsx:187-224` renders 8 columns in an `overflow-x-auto`
  table, and the title cell is `min-w-[240px]`. On a 375 px screen, phase and status are off-screen.
- Fix: below `md`, render each trial as a card showing NCT ID, title, phase and status, with sponsor and interventions
  collapsed. Use `p-4` on small screens.

**U7-05 FEATURE P3: trial rows have no detail view, so every candidate trial means leaving the site.**
- Evidence: each row shows only title, phase, status, sponsor, interventions, start date and N (`trial-landscape.tsx:199-223`).
  There is no eligibility summary, no US sites or contacts, and no last-updated date.
- Effect: for T29, matching one patient meant opening many CT.gov tabs.
- Fix: add an expandable row that fetches `/api/v2/studies/{nct}` on demand and shows key inclusion/exclusion criteria,
  sites (with any in the user's state listed first), contact, and last update.
- The API counterpart of this issue is U8-05.

**U8-01 BUG P2: unsupported query parameters are silently ignored.**
- Evidence (live):
  - `GET /api/search?q=kinase%20inhibitor&limit=50&offset=25` returns 200 with 25 rows, and `source.queryUrl` still shows `limit=25`.
  - `GET /api/trials?…&location=Birmingham&pageSize=100` returns total 45 and 25 rows, identical to the query without those parameters.
- Code: `api/search/route.ts:30` reads only `q`. `api/trials/route.ts:43-48` reads only term, condition, phase, status and pageToken.
- Effect: a client cannot tell that its filter was not applied, so it ships wrong data. In T29 the "Birmingham" results were
  really worldwide.
- Fix: return 400 listing the supported parameters for any unknown one, or add an `ignoredParams` array to the response.

**U8-02 BUG P2: an upstream 4xx is reported as an outage.**
- Evidence: `GET /api/search?q=a` and `q=ab` return **502** "Source unavailable: ChEMBL could not be reached" in about 0.3 s.
  ChEMBL itself answers **400** to the same query (checked directly).
- Code: `src/lib/upstream.ts:32` turns every non-OK upstream status into `UpstreamError`, and `:52-55` maps that to 502
  "could not be reached".
- Effect: clients retry a request that can never succeed, and monitoring records a false outage.
- Fix: pass an upstream 4xx through as 400 with the upstream message. Keep 502/504 for timeouts, network errors and 5xx.
  Add a machine-readable `code` and `retryable` to error bodies.

**U8-03 FEATURE P3: search rows have no parent/salt linkage and no standard identifier.**
- Evidence: `/api/search?q=osimertinib` returns these as unrelated rows: OSIMERTINIB MESYLATE (CHEMBL3545063), the parent
  CHEMBL3353410, a sulfate CHEMBL4472934, and deuterated forms. The row schema at `api/search/route.ts:48-60` has no InChIKey,
  parent ID or salt flag.
- Effect: deduplication for ML datasets needs a second call per row.
- Fix: include `parentChemblId`, `isParent` and `standardInchiKey` from ChEMBL `molecule_hierarchy` and `molecule_structures`.

**U8-04 BUG P3: field mapping loses information.**
- `name` falls back to the ChEMBL ID when `pref_name` is null (`route.ts:50`), so a client cannot tell named records from
  unnamed ones. This made `results[0]` look like a real ruxolitinib record in T10.
- `logP` is ChEMBL ALogP (`route.ts:53`), but neither the field name nor the docs say so.
- Fix: return `name: null` and expose `prefName`, rename the field to `alogp` (or document the method), and publish a field
  dictionary.

**U8-05 FEATURE P3: trial rows lack the fields needed for follow-up.**
- Evidence: `api/trials/route.ts:19-29` requests 9 fields only. There is no record URL, no `LastUpdatePostDate`, no
  `LocationCity`/`LocationState`/`LocationFacility`, and no eligibility fields.
- Effect: patient matching or freshness checks need one extra CT.gov call per NCT ID.
- Fix: add `url`, `lastUpdated`, and an opt-in `fields=locations,eligibility` parameter.

**U8-06 FEATURE P3: API contract ergonomics are weak.**
- Enum values are case-sensitive and errors do not list the allowed values: `status=recruiting` returns 400 "Unknown status 'recruiting'".
- There is no `/api/v1` prefix or version field.
- A cross-origin request with an `Origin` header gets no `Access-Control-Allow-Origin`, so browser notebooks cannot call the API.
- Fix: accept enum values in any case and list the allowed ones in the 400 body, add a version prefix, and send a permissive
  CORS header on the two read-only GET routes.

**U8-07 FEATURE P3: no explicit batch lookup.**
- Evidence: `q=CHEMBL941,CHEMBL553` happens to return both compounds through ChEMBL free-text search. This is undocumented,
  and the ChEMBL-ID regex at `route.ts:35` does not handle lists.
- Fix: add `ids=CHEMBL941,CHEMBL553` (up to 100) that maps to ChEMBL `molecule_chembl_id__in`.

## Existing issues with special impact

### U7

- **S-15: impact for this user:** this is her core task. With no location field she typed the city into the term box:
  `term=EGFR L858R Birmingham` returns **1** recruiting trial, while a CT.gov geo filter gives 9. The workaround silently
  under-counts and could make her tell a patient there are no options nearby.
- **S-02: impact for this user:** the default view (EGFR + "cancer") opens with a kidney-cancer trial. On her first visit
  this looked like the site did not understand oncology.
- **S-03 / S-10: impact for this user:** she has the clinical knowledge to spot "Validated 92%" on a placeholder and a
  "covalent inhibitor for C797S". Each one cost the whole site credibility, including the real data.
- **S-20 / S-24: impact for this user:** post-osimertinib resistance and patient-friendly wording are what she would use
  in clinic. Both are missing.

### U8

- **S-19: impact for this user:** without documentation of the two routes, discovering the API took him 10 minutes of
  reading source. Most engineers would stop at "internal, not a public API" (`docs/api-reference.md:5`).
- **S-16: impact for this user:** combined with U8-01, a request for more rows returns 200 with the first 25 again.
- **S-08: impact for this user:** a script that takes `results[0]` gets the wrong record for ruxolitinib, erlotinib and
  osimertinib. A human would notice; a pipeline will not.
- **S-12: impact for this user:** `maxPhase` coerces null to 0 (`route.ts:58`), so "unknown" turns into "preclinical"
  labels in training data.
- **S-17 / S-18: impact for this user:** with no mechanism, activity or Open Targets endpoints, 14 of 30 tasks return
  nothing machine-readable.

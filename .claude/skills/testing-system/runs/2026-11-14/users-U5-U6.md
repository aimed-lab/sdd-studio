# Run 2026-11-14: user simulation, U5 and U6

Users: **U5 Dr. Elena Morales**, drug-development VP (low tech, medium bio, occasional use; needs portfolio, GO/NO-GO and combination answers) and **U6 Tomás Rivera**, undergraduate research assistant (low tech, low bio, first visit; needs simple lookups and plain explanations).

Method: the expert ceiling in `site-capability.md` and the AI-alone baseline in `ai-alone-baseline.md`, adjusted for each user's route through the UI. Navigation was read from `src/app/auth-gate.tsx`, `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/*`. Live GET calls to `/api/search` and `/api/trials` were made on 2026-11-14. No write requests were sent.

Key route facts that drive both users' scores:
- `/` redirects to `/projects`, a demo portfolio (`src/app/page.tsx:4`).
- The sidebar has **no link to /search, /targets or /compounds** (`auth-gate.tsx:97-146, 313-321`). The three real data features can only be reached through links inside demo pages (Mechanisms → gene → /targets → compound count → /compounds → "Search ChEMBL") or by typing the URL.
- The real ClinicalTrials.gov landscape is under the label **"Trial Simulations"** (`auth-gate.tsx:133`).
- The in-site "Ask AI" assistant works only after the user adds their own LLM API key (`feedback-widget.tsx:323`).

Neither user typed a URL by hand. Time counts start after sign-in. U6's first-visit onboarding (invitation code plus admin approval) is not counted in the table; see U6-01.

## U5: Dr. Elena Morales (drug-development VP)

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 6 | full | 3 | 4 | -1 | "Found P00533 on the EGFR card, but the banner right above it says IDs are placeholders. Which do I believe?" |
| T02 Vemurafenib ID/SMILES/MW/status | 8 | partial | 2 | 4 | -2 | "/compounds says Screening, the ChEMBL search says Approved. I know it's approved, so the first page is just wrong." |
| T03 Imatinib 2D structure | 7 | full | 4 | 2 | +2 | "The picture is nice, but it took me seven minutes to find a search box. Why isn't it in the menu?" |
| T04 Recruiting Ph3 EGFR NSCLC | 4 | full | 4 | 1 | +3 | "Almost skipped 'Trial Simulations', but the live tab gave me 45. That's a number I can use." |
| T05 Approved BRAF V600E drugs | 6 | partial | 2 | 4 | -2 | "I had to type the drug names I already knew. It can't go from target to drugs." |
| T06 Melanoma program targets | 5 | partial | 1 | 0 | +1 | "One page says 1 target, the board says 4. In a portfolio review that kills credibility." |
| T07 EGFR trials CSV | 3 | full | 3 | 0 | +3 | "Export is one click. Only later did I see the file has 25 rows, not 4,314." |
| T08 Lay explanation of C797S | 6 | partial | 2 | 4 | -2 | "The row is correct but too dense for a board slide. The chat AI wrote me a better paragraph." |
| T09 Source for MET amp → gefitinib | 5 | full | 4 | 3 | +1 | "Engelman 2007 with a working PubMed link. I can put that in a deck." |
| T10 Ruxolitinib targets + MoA | 5 | partial | 2 | 4 | -2 | "Unnamed record first, then 'Approved', and no mechanism. I know it's JAK1/2 anyway." |
| T11 MW/logP/HBA/HBD/QED ×3 | 10 | partial | 3 | 3 | 0 | "Salt forms came up first, so I nearly compared the mesylate. Not my job; I'd send it to chemistry." |
| T12 EGFR-TKI resistance + citations | 4 | partial | 3 | 3 | 0 | "Good citations, but nothing after osimertinib, which is the question my programs face. No export." |
| T13 JAK2 inhibitors + IC50 | 4 | none | 0 | 2 | -2 | "A JAK2 search gave one molecule. Nothing usable." |
| T14 True BRAF+MEK combo trials | 10 | partial | 2 | 3 | -1 | "11 hits including an exercise study. I can't filter by drug, so I can't trust the list for a competitive review." |
| T15 BRAF → melanoma → drugs → trials | 15 | partial | 2 | 2 | 0 | "Only the trials step was real. The IDs change meaning between pages." |
| T16 KRAS G12C NSCLC by sponsor/phase | 12 | partial | 2 | 2 | 0 | "142 trials, 25 at a time, no sponsor summary. I'd have an analyst do it in Excel." |
| T17 Is "92% confidence" sourced? | 4 | partial | 2 | 1 | +1 | "The green 'Validated 92%' is what I saw first. I only spotted 'Placeholder' because the task told me to look." |
| T18 50 kinase inhibitors via API | 0 | not_attempted | 0 | 1 | -1 | "I don't write code. I'd delegate this." |
| T19 PDB EGFR–osimertinib | 5 | none | 1 | 3 | -2 | "The link opened 394 structures. Not my field, so I closed it." |
| T20 Osimertinib FDA history/label | 8 | none | 1 | 4 | -3 | "The Regulation menu is IRB templates and demo licensing. No label history at all, and that's what I need most." |
| T21 MAPT tractability by modality | 6 | none | 1 | 3 | -2 | "'Druggability: Medium' with no source behind it. I can't take that to a portfolio committee." |
| T22 Prioritise NSCLC targets | 10 | none | 1 | 3 | -2 | "The Target Board looks like the answer, but it's demo. The AI list was closer to what I know." |
| T23 AD repositioning candidates | 8 | none | 1 | 3 | -2 | "'Repositioned' entries are illustrative. Wasted eight minutes." |
| T24 JAK2 validation dossier | 10 | none | 1 | 2 | -1 | "No dossier, no export, and SDD-0127 is three different things." |
| T25 EGFR inhibitor selectivity | 3 | none | 0 | 2 | -2 | "No potency data anywhere. Gave up." |
| T26 Strategies vs C797S | 12 | partial | 2 | 2 | 0 | "The curated row is fine. 'Covalent inhibitor repositioned for C797S' is nonsense; I'd fire the slide author." |
| T27 BRAF+MEK+PD-1 triplet | 15 | partial | 2 | 4 | -2 | "Trials surface but nothing on toxicity. The AI's IMspire150/COMBI-i summary was what I wanted." |
| T28 GO/NO-GO from real evidence | 15 | none | 1 | 2 | -1 | "Decision Reports says 'Evidence-based' and then says don't use it for decisions. This was the page I came for." |
| T29 Patient-trial match, Birmingham | 8 | partial | 2 | 1 | +1 | "23 trials worldwide and no way to filter by location." |
| T30 Answer via agent/API | 3 | none | 0 | 0 | 0 | "'Ask AI' wants my own API key. I don't have one, and I'm not getting one for this." |

**U5 totals:** full 5 · partial 14 · none 10 · not_attempted 1 · **mean site_q 1.80** · **mean ai_q 2.40** · **mean delta −0.60** · **total 217 min**.

**Reflection (U5):** I came for decisions (GO/NO-GO, combinations, competitive landscape, regulatory status), and those are exactly the pages that are demo or missing. The demo pages are well dressed: "Evidence-based go/no-go decisions", green "Validated" badges, confidence bars. In a hurry I would have taken them at face value. The live trial search is the one thing I'd come back for, but it's hidden under "Trial Simulations", and the real compound search isn't in the menu at all. Today a chat AI plus a quick check on ClinicalTrials.gov gets me further in less time. I'd revisit once there are real target evidence, label history and a trial summary I can hand to my team.

## U6: Tomás Rivera (undergraduate research assistant, first visit)

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 EGFR UniProt + name | 12 | partial | 2 | 4 | -2 | "I clicked Target Board first and copied 'TGT-004' as the ID. Later found P00533, but the yellow box says IDs are placeholders, so I'm not sure." |
| T02 Vemurafenib ID/SMILES/MW/status | 15 | partial | 1 | 4 | -3 | "I copied the SMILES and 'Screening' from the compounds table. I didn't know it was wrong." |
| T03 Imatinib 2D structure | 12 | full | 3 | 2 | +1 | "The drawing showed up once I found 'Search ChEMBL' through a link. No idea what QED or PSA mean." |
| T04 Recruiting Ph3 EGFR NSCLC | 10 | partial | 2 | 1 | +1 | "Typed 'EGFR-mutant lung cancer' as the condition and got 3 trials. Turns out 'lung cancer' gives 45, and nothing told me." |
| T05 Approved BRAF V600E drugs | 10 | none | 1 | 4 | -3 | "Searching 'BRAF V600E' gave odd molecules. I'd just ask ChatGPT." |
| T06 Melanoma program targets | 6 | partial | 1 | 0 | +1 | "The board shows 4, so I wrote 4. Didn't see the other page says 1." |
| T07 EGFR trials CSV | 5 | full | 4 | 0 | +4 | "The export button worked and has a source column. Easy." |
| T08 Lay explanation of C797S | 10 | partial | 1 | 4 | -3 | "'6/15 cfDNA'? I don't understand the row. ChatGPT explained it like a textbook." |
| T09 Source for MET amp → gefitinib | 10 | full | 3 | 3 | 0 | "The PubMed link opened a real paper. I can't follow the abstract, but I have the citation." |
| T10 Ruxolitinib targets + MoA | 8 | partial | 1 | 4 | -3 | "The first result has no name, just a code. I picked it. No 'what it does' anywhere." |
| T11 MW/logP/HBA/HBD/QED ×3 | 15 | partial | 2 | 3 | -1 | "I used the first row, which turned out to be the salt. No column explains HBA or QED." |
| T12 EGFR-TKI resistance + citations | 8 | partial | 3 | 2 | +1 | "A table with real links. That's better than ChatGPT's list, where I can't tell which PMIDs are real." |
| T13 JAK2 inhibitors + IC50 | 8 | none | 0 | 2 | -2 | "Searching JAK2 gave one compound. I thought that was the only JAK2 inhibitor." |
| T14 True BRAF+MEK combo trials | 12 | partial | 1 | 2 | -1 | "11 results, one about exercise. I couldn't tell which ones were real combinations." |
| T15 BRAF → melanoma → drugs → trials | 20 | none | 1 | 2 | -1 | "I kept clicking between Biology, Pharmacology and Clinical and got lost." |
| T16 KRAS G12C NSCLC by sponsor/phase | 15 | partial | 2 | 1 | +1 | "Got a list of 142 but couldn't make the sponsor table. ChatGPT's list looked confident, but I learned later half aren't recruiting." |
| T17 Is "92% confidence" sourced? | 5 | none | 1 | 1 | 0 | "It says Validated with a green bar, so yes? I missed the grey 'Placeholder' text." |
| T18 50 kinase inhibitors via API | 10 | none | 0 | 1 | -1 | "Nothing in the menu says there's an API. ChatGPT gave me a script I couldn't run." |
| T19 PDB EGFR–osimertinib | 10 | none | 1 | 3 | -2 | "The PDB link opened 394 structures. I don't know which ones have the drug." |
| T20 Osimertinib FDA history/label | 6 | none | 0 | 4 | -4 | "Nothing about FDA anywhere I looked." |
| T21 MAPT tractability by modality | 8 | none | 1 | 3 | -2 | "I don't know what 'tractability' or 'modality' mean, and the site doesn't say. Wrote down 'Medium' from the board." |
| T22 Prioritise NSCLC targets | 10 | none | 1 | 3 | -2 | "I used the Target Board ranking. Didn't realise it was made up." |
| T23 AD repositioning candidates | 10 | none | 1 | 3 | -2 | "The drug page lists repositioned drugs, so I copied them. The yellow box is easy to scroll past." |
| T24 JAK2 validation dossier | 10 | none | 1 | 2 | -1 | "No button makes a report. Didn't know what should go in one anyway." |
| T25 EGFR inhibitor selectivity | 5 | none | 0 | 2 | -2 | "Couldn't find anything. Gave up." |
| T26 Strategies vs C797S | 15 | partial | 1 | 1 | 0 | "Wrote down 'Osimertinib-R' as a strategy. Learned afterwards it's impossible." |
| T27 BRAF+MEK+PD-1 triplet | 15 | partial | 1 | 4 | -3 | "Trial titles mean nothing to me. ChatGPT's explanation of why the three drugs go together made sense." |
| T28 GO/NO-GO from real evidence | 10 | none | 1 | 2 | -1 | "The Decision Reports page has Go and No-Go badges, so I thought it was finished work." |
| T29 Patient-trial match, Birmingham | 15 | partial | 2 | 1 | +1 | "No location filter, so I opened trials one by one looking for Alabama." |
| T30 Answer via agent/API | 5 | none | 0 | 0 | 0 | "The chat bubble says to set up an API key. I don't know what that is." |

**U6 totals:** full 3 · partial 13 · none 14 · not_attempted 0 · **mean site_q 1.30** · **mean ai_q 2.27** · **mean delta −0.97** · **total 310 min** (plus about 10 min of sign-in and an admin-approval wait of unknown length, not counted).

**Reflection (U6):** I didn't know where to start. The site opened on a projects page full of names and scores, and the search box I needed wasn't in the menu. I copied several things that turned out to be demo data (a wrong structure, a "Validated" mechanism, a made-up drug) because the yellow warning is small and I was looking at the tables, not the banner. The parts that are real (trial search, CSV export, PubMed-linked table) were useful once I found them, but nothing explains words like QED, tractability or cfDNA. For most questions I'd go back to ChatGPT, which explains things better, even though I now know it can give me trials that aren't recruiting and PMIDs that don't exist.

## New issues (not covered by S-01…S-24)

**U5-01 BUG P1: the three real data features are missing from the navigation.**
- Evidence: the sidebar groups (`src/app/auth-gate.tsx:97-146`) and utilities (`:313-321`) contain no link to `/search`, `/targets` or `/compounds`. `src/app/page.tsx:4` redirects `/` to the demo `/projects`. They are reachable only through links inside demo pages (`disease-biology/mechanisms/page.tsx:200`, `drug/page.tsx:169`, `compounds/page.tsx:205`).
- Observed: both users spent 6–15 minutes on T01–T03 before reaching a live page. U6 used demo pages instead.
- Fix: add a top sidebar group "Live data", with "Search ChEMBL" (`/search`), "Targets & evidence" (`/targets`) and "Clinical trials (live)", and land `/` on a start page with a search box.

**U5-02 BUG P2: the live ClinicalTrials.gov landscape is labelled "Trial Simulations".**
- Evidence: `auth-gate.tsx:133` labels `/clinical/trials` as "Trial Simulations". The page's default tab is the live landscape (`clinical/trials/page.tsx:124-127`).
- Observed: U5 nearly skipped it, and U6 skipped it at first because it sounded like a simulator.
- Fix: rename it "Clinical Trials (live)" and make "Illustrative internal programs (demo)" a secondary item.

**U5-03 BUG P2: Decision Report subtitles claim "Evidence-based go/no-go decisions" on demo pages.**
- Evidence: `pharmacology/decisions/page.tsx:98`, `disease-biology/decisions/page.tsx:101` and `clinical/decisions/page.tsx:89` use that subtitle directly above `DemoDataNotice`.
- This is distinct from S-03, which covers the status badges and confidence bars. Here the page heading itself asserts evidence.
- Fix: change the subtitle to "Illustrative go/no-go report template (demo)", and keep the heading neutral until real reports exist.

**U5-04 FEATURE P2: no landscape summary for trial searches.**
- Evidence: Trial Landscape only lists rows, 25 at a time (`trial-landscape.tsx:176, 244`). There are no counts by phase, sponsor or status. T16 needs 6 pages plus a pivot in Excel.
- S-15 covers filters and the CSV contents, not aggregation.
- Fix: add a summary strip above the table (count by phase, top 10 sponsors, count by status) computed from a full fetch, or use CT.gov `countTotal` per facet, and export it.

**U5-05 BUG P3: the landing page is a fabricated portfolio with named people.**
- Evidence: `/projects` (`projects/page.tsx:62-200`) shows A.G.E. scores, an "EGFR-T790M Resistance Program", and tasks such as "Prepare IND toxicology package" assigned to "Dr. Lucia Romano". It is the first screen after sign-in.
- Impact: a VP reads it as real team status.
- Fix: mark each card as "Sample project", or replace the landing page with an empty state that says "No projects yet" and links to the live tools.

**U5-06 FEATURE P2: the "Ask AI" assistant is unusable without the user's own LLM API key.**
- Evidence: `feedback-widget.tsx:323` shows "Set up an API key in Settings to activate the assistant", and the assistant route is bring-your-own-key.
- Impact: the only guided help for occasional and novice users is dead on arrival (T30, plus every "where do I find X?" moment).
- Fix: provide a small server-side quota for platform-help questions, or a static FAQ fallback that answers "where is X" from the assistant's own data-status map.

**U6-01 FEATURE P2: no read-only guest access, so a first-time user waits on an invite code and admin approval.**
- Evidence: `login/page.tsx:65` ("New users need an invitation code"), and `pending-approval-screen.tsx:62` ("Awaiting Approval", polls every 15 s).
- The live data is already public through `GET /api/search` and `/api/trials`, but the UI is fully gated.
- Fix: a guest mode limited to `/search`, `/targets` and the Trial Landscape, with demo pages and write actions still behind sign-in.

**U6-02 BUG P2: Trial Landscape silently collapses on natural-language conditions.**
- Evidence (live, term=EGFR, Phase 3, Recruiting): condition "lung cancer" gives **45**, "NSCLC" gives **47**, and "EGFR-mutant lung cancer" gives **3**. Nothing tells the user why.
- Fix: when the condition contains a gene or mutation word, move it to the term automatically, or show a hint: "Few results. Try a broader condition, e.g. 'lung cancer'."

**U6-03 BUG P3: a condition-only trial search is rejected.**
- Evidence: `api/trials/route.ts:48` returns 400 "Query parameter 'term' is required" when only the condition is given (live: `term=&condition=lung cancer EGFR`).
- Impact: a novice who only knows the disease cannot search.
- Fix: accept term or condition, and require at least one.

**U6-04 FEATURE P2: compound search does not say it matches molecule names only.**
- Evidence (live): `q=EGFR` returns 50 molecules (zalutumumab, depatuxizumab, unnamed CHEMBL4068839…) with no erlotinib, gefitinib or osimertinib. `q=melanoma` returns 495 entries, led by "MELANOMA-ASSOCIATED ANTIGEN 3".
- Impact: a novice reads the result as "the EGFR drugs" (T05, T13).
- This is distinct from S-09 (one link label) and S-17 (missing target data). It is about how the search box describes itself.
- Fix: put helper text under the box ("Searches drug and compound names"). When the query is a gene symbol or a disease, show a banner: "Looking for drugs that act on EGFR? See Targets → EGFR."

**U6-05 FEATURE P3: column headers have no definitions.**
- Evidence: `search/page.tsx:169` renders "MW, LogP, HBA/HBD, PSA, QED, Phase" with no tooltip or glossary. Trial phase badges ("Ph 3") and status values are also undefined. The same goes for the curated-table terms (cfDNA) and task vocabulary (tractability, modality).
- S-24 asks for a plain-language line for rows. This issue is about the headers and vocabulary.
- Fix: a `title`/tooltip with a one-line definition on each header, plus a /glossary page linked from the sidebar.

**U6-06 FEATURE P2: the only clear map of which pages are live and which are demo is hidden in the AI system prompt.**
- Evidence: `api/assistant/route.ts:13-17` lists exactly which features are LIVE, CURATED and ILLUSTRATIVE. No page in the UI says this, and the per-page banner is small `text-xs` (`data-provenance.tsx:9`).
- Impact: U6 copied demo values on T02, T06, T17, T22, T23, T26 and T28.
- Fix: a visible "What's real on this site" page or start-panel built from the same text, plus a "LIVE", "CURATED" or "DEMO" chip next to each sidebar item.

### Existing issues that matter especially to these users

- **S-03:** for U5, this is the most dangerous demo pattern. Badges and bars are what a busy executive reads. Combined with U5-03, the decision pages look finished.
- **S-04:** U6 copied the wrong vemurafenib SMILES and "Screening" stage as fact (T02). A novice has no way to spot it.
- **S-05 / S-06:** for U5, conflicting IDs and counts across pages end trust in the whole site during a portfolio review (T06, T15, T24).
- **S-07:** for both users the banner is small and at the top, so they scrolled past it to tables that look real. For U6 its "IDs are placeholders" also discredited the one correct UniProt ID.
- **S-08:** U6 picked the unnamed ruxolitinib isomer and the salt forms because they were listed first (T10, T11).
- **S-10:** U6 recorded "Osimertinib-R" as a real strategy (T26). U5 caught it, but it hurt the site's credibility.
- **S-15:** for U5 the missing intervention filter blocks combination landscaping, her core use (T14, T27). For U6 the missing location filter turned T29 into opening trials one by one.
- **S-18 / S-22:** for U5 these are the reason to use the site at all: target evidence, tractability and regulatory history (T20–T24, T28). Without them she gets more from a chat AI.
- **S-24:** for U6 this is the core need. He went back to ChatGPT for every explanation task (T08, T27).

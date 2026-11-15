# Run 2026-11-14 — simulated users U3 and U4

Method: each user attempts all 30 tasks in character on studio.smartdrugdiscovery.org (main @ ae78956). The expert ceiling comes from
`site-capability.md`, and the AI-alone scores come from `ai-alone-baseline.md`, adjusted for what each user needs and can verify.
Extra checks done for this report: read-only GETs to `/api/search` and `/api/trials`, and source reads of `src/app/auth-gate.tsx`,
`src/app/search/page.tsx`, `src/app/api/search/route.ts`, `src/components/trial-landscape.tsx`, `src/lib/upstream.ts` and
`src/app/pharmacology/candidates/page.tsx`. No writes were sent.

Two observations shape both users' times:
- **The live pages are not in the sidebar.** Home redirects to `/projects`, which is demo data. `/search`, `/targets` and `/compounds` have no nav entry, so both users reach them only through a bookmark or a typed URL (U3-01).
- **The real ClinicalTrials.gov landscape sits under a menu item called "Trial Simulations"** (U4-01).

---

## U3 — Dr. Priya Patel, medicinal chemist (biotech)

Needs: structures, IC50, selectivity, residue-level design. Medium tech skill. Uses the site, mainly `/search` from a bookmark.
She checks chemistry claims herself, so she spots wrong SMILES and impossible chemistry. She is less sure about clinical content.

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 | 2 | full | 4 | 4 | 0 | "/targets isn't in the menu. I typed the URL. P00533 is right, but the banner says the IDs are placeholders, so I checked UniProt anyway." |
| T02 | 1 | full | 5 | 4 | +1 | "/search gave CHEMBL1229517, MW 489.93, phase 4 and canonical SMILES in the CSV. This is the part of the site I actually use." |
| T03 | 2 | full | 3 | 2 | +1 | "It renders, but only as a 140×90 thumbnail. There's no zoom and no SVG/MOL download, and the SMILES is hidden in a hover tooltip." |
| T04 | 6 | full | 4 | 1 | +3 | "Not my area. 45 recruiting Ph3 trials, live. I'd never have looked under 'Trial Simulations' if a colleague hadn't told me." |
| T05 | 6 | partial | 2 | 4 | -2 | "I have to know the drug names already. There's no 'approved drugs for this target' view. The AI listed vemurafenib, dabrafenib and encorafenib straight away." |
| T06 | 4 | partial | 1 | 0 | +1 | "/targets says 1 melanoma target and the Target Board says 4. I can't report either." |
| T07 | 3 | full | 4 | 0 | +4 | "The CSV has source and retrieval date, which is good. It only holds the 25 rows I had loaded." |
| T08 | 3 | partial | 2 | 4 | -2 | "The C797S row is correct, but it's written for me, not for our CEO. The AI's lay paragraph was better." |
| T09 | 3 | full | 4 | 4 | 0 | "Engelman 2007 with a PMID that resolves. I knew the paper. Most of the time went on finding /targets." |
| T10 | 3 | partial | 2 | 4 | -2 | "An unnamed isomer, CHEMBL1287854, is listed above RUXOLITINIB, and there's no mechanism. JAK1/JAK2 isn't on the page." |
| T11 | 5 | full | 4 | 3 | +1 | "The values match ChEMBL. The salt is listed first, 'LogP' is really ALogP with no label, and there's no Ro5 flag. I still had to think." |
| T12 | 3 | partial | 4 | 3 | +1 | "Five verified citations, but nothing after osimertinib and no export." |
| T13 | 10 | none | 0 | 2 | -2 | "This is my core need, and the site has no bioactivity at all. 'Search ChEMBL for JAK2' returned one molecule. I went to ChEMBL directly." |
| T14 | 10 | partial | 2 | 3 | -1 | "'BRAF MEK' brings back an exercise study. There's no intervention filter, so I couldn't trust the list." |
| T15 | 10 | partial | 2 | 2 | 0 | "Only the search and trials steps are real. The board's target IDs don't match /targets." |
| T16 | 8 | partial | 3 | 2 | +1 | "142 trials, with sponsor and phase in the CSV. I had to page through six times and pivot in Excel." |
| T17 | 2 | full | 3 | 1 | +2 | "'Validated, 92%' sits next to 'Placeholder — no analysis has been run'. Easy to find, and it made me trust the page less." |
| T18 | 8 | partial | 1 | 2 | -1 | "I found /api/search in the network tab. It caps at 25 with no offset, so 50 compounds is impossible." |
| T19 | 8 | partial | 2 | 3 | -1 | "The PDB link dumps all 394 EGFR entries. There's no YY3 filter and no Cys797 covalent annotation, which is the residue-level information I need." |
| T20 | 4 | none | 1 | 4 | -3 | "It just says 'Approved'. The 'Regulation' menu has IRB and licensing demos, not FDA history." |
| T21 | 6 | none | 1 | 3 | -2 | "'MAPT druggability Medium' is demo data, with no pocket or ligand flags. The AI was at least directionally right." |
| T22 | 8 | none | 1 | 3 | -2 | "Demo board only. No genetic or literature scores." |
| T23 | 6 | none | 1 | 3 | -2 | "The 'repositioned' drugs on /drug are demo data. The AI rationale was more useful." |
| T24 | 10 | none | 1 | 2 | -1 | "No dossier. SDD-0127 is crizotinib on one page and 'selective JAK2' on another." |
| T25 | 12 | none | 0 | 2 | -2 | "Selectivity is my job. The only selectivity on the site is '>100x' on demo Candidate Molecules, with no comparator and no assay." |
| T26 | 12 | partial | 2 | 2 | 0 | "The curated C797S row is fine. 'Osimertinib-R, a covalent inhibitor for C797S' is chemically impossible, and after that I stopped trusting /drug." |
| T27 | 10 | partial | 2 | 4 | -2 | "Trials surface, but there's no toxicity data and no intervention filter. The AI's IMspire150 and COMBI-i summary was better." |
| T28 | 12 | none | 1 | 2 | -1 | "Every decision page is demo. Nothing I could put in a slide for the portfolio review." |
| T29 | 8 | partial | 2 | 1 | +1 | "23 recruiting worldwide, with no location filter. At least they really are recruiting." |
| T30 | 6 | partial | 2 | 0 | +2 | "The JSON endpoints work and carry provenance, but they're undocumented and there's no MCP." |

**U3 totals:** completion full 8 · partial 14 · none 8 · not_attempted 0.
Mean site_q **2.20** (66/30) · mean ai_q **2.47** (74/30) · mean delta **−0.27** · total time **191 min**.
By tier: easy (T01–T10) site 3.1 vs AI 2.7, medium (T11–T20) site 2.2 vs AI 2.5, hard (T21–T30) site 1.3 vs AI 2.2.

**Reflection (Priya):** "For one compound lookup, /search is better than asking a chatbot: the numbers are ChEMBL's, the SMILES is canonical and the CSV says where it came from. But I can't paste a structure into it. When I tried, it gave me an unrelated naphthalene ester with no warning. It also has no IC50, no selectivity and no ligand-filtered PDB, and that is most of what a medicinal chemist does. The demo pages hurt more than they help: wrong vemurafenib SMILES, an 'Osimertinib-R' that can't exist, and potency numbers with no assay behind them. I now check everything that isn't on /search."

---

## U4 — Dr. James Wright, clinical pharmacologist

Needs: the real trial landscape and regulatory status. Medium tech skill. Uses the site for trials. He cannot judge SMILES or salt forms,
and he won't touch an API. He tolerates about 10–15 minutes on a task he cares about and gives up faster on chemistry.

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 | 3 | full | 4 | 4 | 0 | "A colleague had to tell me /targets exists. It isn't in the sidebar. The answer is correct." |
| T02 | 2 | full | 4 | 4 | 0 | "'Approved' and MW are fine. I'd rather have the approval date and a label link than a SMILES." |
| T03 | 2 | full | 3 | 2 | +1 | "A thumbnail is enough for a teaching slide, but I can't enlarge or download it." |
| T04 | 4 | full | 4 | 1 | +3 | "45 live trials, which is exactly what the AI can't give me. The Ph3 filter quietly includes Ph2/3, and there's no Conditions column, so I opened NCTs to confirm EGFR-mutant." |
| T05 | 5 | partial | 2 | 4 | -2 | "I typed the three drug names I already knew. The site can't tell me which drugs hit V600E." |
| T06 | 4 | partial | 1 | 0 | +1 | "The two pages give different counts. I wouldn't quote either." |
| T07 | 3 | full | 4 | 0 | +4 | "Source and date are in the CSV. The search terms and filters I used aren't, and a protocol appendix needs them." |
| T08 | 3 | partial | 2 | 4 | -2 | "I'd explain this to a patient differently. The AI draft was usable as it was." |
| T09 | 4 | full | 4 | 4 | 0 | "Engelman 2007, a PMID that resolves, and the 22% figure. Good." |
| T10 | 4 | partial | 2 | 4 | -2 | "No mechanism and no label. I know it's JAK1/2 from practice." |
| T11 | 5 | full | 3 | 3 | 0 | "The mesylate salt was listed first and I nearly used 595.73 for osimertinib. Nothing says 'salt' or points to the parent." |
| T12 | 4 | partial | 4 | 3 | +1 | "Verified citations, but nothing on post-osimertinib resistance, which is what my clinic sees now." |
| T13 | 6 | none | 0 | 2 | -2 | "No IC50 data. I gave up and asked a chemist." |
| T14 | 10 | partial | 2 | 3 | -1 | "11 hits including an exercise program. I need intervention = BRAFi AND MEKi, and it can't do that. The AI's list is the classic pivotal trials, all completed." |
| T15 | 8 | partial | 2 | 2 | 0 | "The trials step is live, but the drugs aren't linked to the trials. I retyped names between pages." |
| T16 | 8 | partial | 3 | 2 | +1 | "No grouping, so I pivoted the CSV in Excel. The statuses are current, unlike the AI's, which had CodeBreaK 200 still recruiting." |
| T17 | 2 | full | 3 | 1 | +2 | "'Validated, 92%' on a placeholder row. In a regulatory document that would be a finding." |
| T18 | 3 | none | 0 | 1 | -1 | "I don't write code, and the UI never mentions an API. The AI's script is no use to me if I can't run it." |
| T19 | 5 | partial | 2 | 3 | -1 | "Outside my field. 394 PDB entries is not an answer." |
| T20 | 5 | none | 1 | 3 | -2 | "This is my core question. There's a menu called 'Regulation', and it has IRB and licensing demos but no FDA history or label. I'd have to re-check every AI date against Drugs@FDA anyway." |
| T21 | 4 | none | 1 | 3 | -2 | "Demo data. Not my question to answer." |
| T22 | 6 | none | 1 | 3 | -2 | "The demo board has no scores I could defend." |
| T23 | 6 | none | 1 | 3 | -2 | "The repositioning list is demo data. The AI gave mechanistic reasons, at least." |
| T24 | 6 | none | 1 | 2 | -1 | "No dossier, and the IDs contradict each other between pages." |
| T25 | 6 | none | 0 | 2 | -2 | "No selectivity data. The 'Candidate Molecules' numbers are demo." |
| T26 | 10 | partial | 1 | 2 | -1 | "'Osimertinib-R for C797S' looked plausible to me. A chemist had to tell me it's impossible. The curated row is fine, but the demo row misled me." |
| T27 | 15 | partial | 2 | 4 | -2 | "Trials but no toxicity, and I can't filter on interventions. The AI cited IMspire150 and COMBI-i with correct status." |
| T28 | 10 | none | 1 | 2 | -1 | "Every decision report is illustrative. I can't sign off a GO/NO-GO from them." |
| T29 | 15 | partial | 2 | 1 | +1 | "23 recruiting worldwide. With no location or eligibility filter I checked sites by hand. The real answer is about 9 within 100 miles. A clinic visit doesn't allow that long." |
| T30 | 3 | none | 0 | 0 | 0 | "I don't use APIs, and nothing in the UI tells me one exists." |

**U4 totals:** completion full 8 · partial 12 · none 10 · not_attempted 0.
Mean site_q **2.00** (60/30) · mean ai_q **2.40** (72/30) · mean delta **−0.40** · total time **171 min**.
On his core clinical tasks (T04, T07, T14, T16, T20, T27, T29), site 2.57 vs AI 2.00, delta **+0.57**. On the other 23 tasks, site 1.83 vs AI 2.52.

**Reflection (James):** "The trial landscape is the one thing here I'd use instead of ClinicalTrials.gov's own UI. It is live, it gets statuses right where a chatbot gets them wrong, and the CSV is dated. But I found it under a menu item called 'Trial Simulations', which I had skipped as fake. It can't filter by intervention or location, so the questions that matter in clinic (true BRAF+MEK combinations, trials near Birmingham) still mean 15 minutes of hand-checking. The 'Regulation' section has nothing on approvals or labels, and that's the other half of my job."

---

## New issues (not covered by S-01…S-24)

**U3-01 BUG P1: the live-data pages are not reachable from navigation.** Users: both. Tasks: T01–T03, T05, T09–T12.
- Evidence: `src/app/auth-gate.tsx:95-146` (navGroups) and `:313-321` (utilities) have no entry for `/search`, `/targets` or `/compounds`.
- `src/app/page.tsx:4` redirects home to `/projects`, which is demo data.
- The only in-app link to `/search` is the misleading "Search ChEMBL for …" link on `/compounds` (`compounds/page.tsx:205`).
- A user who isn't told the URLs sees only demo pages.

Fix: add a top "Live data" group (Compound search · ChEMBL, Targets · UniProt + curated evidence, Trial landscape · ClinicalTrials.gov), and land home on it rather than `/projects`.

**U3-02 BUG P2: pasting a SMILES into compound search returns an unrelated compound without warning.** Tasks: T03, T11, T25.
- Evidence: `GET /api/search?q=<afatinib SMILES>` returned `CHEMBL82353`, an unrelated trifluoromethyl-naphthalene ester, as the only hit (3 of 3 repeats).
- The first call returned 502 "ChEMBL could not be reached".
- `api/search/route.ts:35-37` recognises only `CHEMBL\d+` and sends everything else to the free-text `molecule/search` endpoint.

Fix: detect SMILES or InChIKey input. Route it to ChEMBL `molecule?molecule_structures__canonical_smiles__flexmatch=` (exact) or `/similarity/{smiles}/90`. Otherwise reject it with "This looks like a structure; structure search is not supported yet".

**U3-03 BUG P3: an upstream error status is reported as "could not be reached".** Tasks: T02, T30.
- Evidence: `src/lib/upstream.ts:32` throws the same `UpstreamError` for any non-OK status.
- `sourceUnavailable` (`upstream.ts:54-58`) always says the source "could not be reached".
- In the U3-02 repro, ChEMBL was up (a direct call returned 200), yet the user was told it was down.

Fix: carry the upstream status through. Map 4xx to "ChEMBL could not process this query" and keep "unreachable" for timeouts and 5xx.

**U3-04 FEATURE P2: no structure (substructure or similarity) search.** Tasks: T11, T13, T25, T26. For a medicinal chemist, a structure is the main way to query. `search/page.tsx:108` says "compound name, synonym, or ChEMBL ID" only. Fix: add a SMILES box with exact, similarity (threshold) and substructure modes through ChEMBL's `/similarity` and `/substructure` endpoints, keeping the same provenance line.

**U3-05 FEATURE P3: the structure thumbnail can't be enlarged, copied or exported.** Tasks: T03.
- `search/page.tsx:181-182` draws a fixed 140×90 SVG.
- The SMILES is available only as a `title` tooltip.
- There is no copy button, no InChIKey and no SVG/MOL download.

Fix: click to open a large view with Copy SMILES, Copy InChIKey, Download SVG and Download MOL.

**U3-06 BUG P3: descriptor columns don't name their calculation method.** Tasks: T11. The `search/page.tsx:169` header says "LogP" but the value is ChEMBL `alogp` (`route.ts:53`). HBA/HBD follow ChEMBL's convention, not Lipinski's, and there is no Ro5 column. This explains why the AI and the site "disagree" on HBA. Fix: rename the column "ALogP (ChEMBL)", add a header tooltip naming the method, and add `num_ro5_violations`.

**U3-07 BUG P2: demo potency and selectivity numbers have no comparator or assay.** Tasks: T13, T25.
- Evidence: `pharmacology/candidates/page.tsx:25-34` shows `ic50: "12 nM"`, `selectivity: ">100x"` and similar values for rows named after real chemotypes ("Vemurafenib analog", "Osimertinib-R").
- These are the only potency and selectivity values on the site. "Selectivity >100x" has no "vs" target, so it is meaningless even as illustration, and it sits beside real drug names.

Fix: add a "vs" column and an "assay: illustrative" note, or replace the values with "—" until real ChEMBL activity data exists (S-17).

**U3-08 FEATURE P3: salt forms are not labelled or linked to the parent.** Tasks: T02, T11.
- Evidence: `/api/search?q=osimertinib` lists `OSIMERTINIB MESYLATE` (MW 595.73) before `OSIMERTINIB` (499.62).
- Nothing marks the row as a salt or names its parent. `route.ts` doesn't request `molecule_hierarchy`.
- U4 nearly used the salt MW.

Fix: request `molecule_hierarchy`, show a "salt of CHEMBL3353410" badge, and offer a "parents only" toggle. This is separate from the ordering fix in S-08.

**U4-01 BUG P2: the live trial landscape is listed as "Trial Simulations".** Tasks: T04, T07, T14, T16, T27, T29. Evidence: `auth-gate.tsx:133` `{ href: "/clinical/trials", label: "Trial Simulations" }`, while the page opens on the live "Trial Landscape (ClinicalTrials.gov)" tab (`clinical/trials/page.tsx:124-131`). A clinical user reads "simulations" as synthetic and skips it. Fix: rename the item "Trials (ClinicalTrials.gov)" and move the demo designs to their own "Trial design (demo)" entry.

**U4-02 FEATURE P2: the trial table hides Conditions and leaves out the dates and flags clinicians screen on.** Tasks: T04, T14, T16, T29.
- `api/trials/route.ts:80` returns `conditions`, but the table header at `trial-landscape.tsx:191` doesn't render them. A user can't spot eGFR or exercise false positives without opening each NCT.
- `PrimaryCompletionDate`, `LastUpdatePostDate`, `HasResults` and location count are not requested (`route.ts:19-29`).

Fix: show a Conditions column, and add those four fields to the table and the CSV.

**U4-03 BUG P3: the "Phase 3" filter silently includes Phase 2/3 trials.** Tasks: T04, T16. Evidence: `filter.advanced=AREA[Phase]PHASE3` (`route.ts:60`). In `/api/trials?term=osimertinib&condition=lung cancer&status=RECRUITING&phase=PHASE3`, NCT07100080 (PHASE2/PHASE3) counts toward the 17. That distorts a "how many Phase 3s" answer. Fix: label the option "Phase 3 (incl. Phase 2/3)" or add a "pure Phase 3 only" toggle, and show the combined phase in the row, which the table already does.

**U4-04 FEATURE P3: compounds and trials are not cross-linked.** Tasks: T15, T27. `/search` rows have no "Trials for this drug" link (`search/page.tsx:177-211`), and trial interventions are plain text (`trial-landscape.tsx:221`), so the user retypes names between pages. Fix: add a `/clinical/trials?term=<pref_name>` link on each approved or clinical compound, and link each intervention to `/search?q=<name>`.

**U4-05 FEATURE P3: nothing in the UI says which pages are live and which are demo.** Tasks: all.
- The only complete map of live, curated and demo pages is in the assistant's system prompt (`api/assistant/route.ts:15-18`).
- Users must open each page to read its banner, and the "Regulation", "Clinical" and "Pharmacology" groups mix live and demo items with no marker.

Fix: put LIVE, CURATED and DEMO badges on sidebar items, and add a one-screen "What's real here" help page linked from the header.

**New issue count: 13** (BUG 7: P1 1, P2 3, P3 3 · FEATURE 6: P2 2, P3 4).

## Existing issues that matter most to these users

- **S-17:** impact for U3. This is the central gap. With no IC50, mechanism or target-to-drug data, T13 and T25 score 0, and those are her daily tasks. She goes back to ChEMBL directly.
- **S-04:** impact for U3. A wrong vemurafenib SMILES on `/compounds` next to the correct one on `/search` makes her distrust every structure that isn't on `/search`.
- **S-10:** impact for both. U3 recognises "Osimertinib-R" as impossible and loses trust in the site. U4 does not recognise it and is misled. That is worse, because the clinician is the one who would repeat it.
- **S-08:** impact for U3. It also affects research code names: `/api/search?q=AZD9291` ranks OSIMERTINIB **4th**, behind three unnamed analogues. Chemists search by code name all the time, so ranking should also prefer an exact synonym match.
- **S-21:** impact for U3. Her residue-level design question (Cys797, covalent warhead) is where an unfiltered list of 394 PDB entries fails hardest.
- **S-05:** impact for U3. SDD-0127 means three different molecules, so she can't build a dossier (T24).
- **S-15:** impact for U4. This is the central gap. With no intervention, location or eligibility filter, T14, T27 and T29 stay partial and take 10–15 minutes, which a clinician won't spend.
- **S-22:** impact for U4. His second core need. The sidebar's "Regulation" group promises regulatory content but holds only IRB, licensing and business demos, which makes the missing FDA data more noticeable.
- **S-02:** impact for U4. With no Conditions column (U4-02), he can't see the eGFR kidney trials that come in with the default "cancer" condition.
- **S-19:** impact for U3 and U4. U3 found the API only through browser dev tools. U4 never would.

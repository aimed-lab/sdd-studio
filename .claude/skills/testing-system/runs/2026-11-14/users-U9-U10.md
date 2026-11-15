# Run 2026-11-14: simulated users U9 and U10

Method: each user attempted all 30 tasks in character. The expert ceiling and verified facts come from `site-capability.md`. The AI-alone facts come from `ai-alone-baseline.md`, re-scored from each user's point of view. Page source was read from `src/app/**`, and the live public GETs `/api/search` and `/api/trials` were called (for example `q=Tagrisso`, `q=Gleevec`, `term=EGFR&condition=lung cancer`). No write requests were sent.

Assumption for both users: the whole site sits behind an invitation-code login (`auth-gate.tsx:38-40`, `login/page.tsx:65`). For this study, each user was given an invite link. After signing in, both land on `/projects` (`src/app/page.tsx:4`).

---

## U9: Linda Okafor, patient advocate and science journalist (low tech, low bio, normally uses AI chat)

How she moves through the site: she only uses the sidebar. She never types URLs and has never heard of `/search` or `/targets`. She reads the demo banners about half the time. She cannot judge SMILES, IC50s or PMIDs. Her priorities are plain language, a source she can quote, and real trials for patients.

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 | 6 | none | 0 | 3 | -3 | "There's no search box anywhere. The Target Board lists 'EGFR T790M' as TGT-004, but there's no protein name or ID I could quote." |
| T02 | 6 | none | 1 | 3 | -2 | "Candidate Molecules shows 'Vemurafenib analog, MW 510.4'. I nearly wrote that down before I noticed the demo banner." |
| T03 | 4 | none | 0 | 2 | -2 | "Nothing in the menu draws a molecule. The chatbot gave me a string of letters it called SMILES." |
| T04 | 8 | full | 4 | 1 | +3 | "I almost skipped 'Trial Simulations' because I wanted real trials, not simulated ones. Inside it was live ClinicalTrials.gov with links. I trust this more than the chatbot, whose trials turned out to be closed." |
| T05 | 8 | none | 1 | 4 | -3 | "I don't know the drug names, so I can't search for them. The chatbot just told me: vemurafenib, dabrafenib, encorafenib." |
| T06 | 4 | partial | 1 | 0 | +1 | "The Target Board says melanoma has 4: BRAF V600E, miR-21, TERT, CD8+ T cells. I'd have reported '4' without realising it's demo data." |
| T07 | 5 | full | 3 | 0 | +3 | "Export CSV worked and has a source and date column. I didn't notice it was only 25 rows." |
| T08 | 10 | none | 0 | 4 | -4 | "I never found the curated resistance table, and it isn't in the menu. The chatbot explained C797S in two sentences my readers would understand." |
| T09 | 8 | none | 0 | 3 | -3 | "The chatbot named Engelman 2007, Science. I had to Google it to make sure it was real." |
| T10 | 5 | none | 0 | 4 | -4 | "I couldn't find a drug lookup at all. The chatbot said it blocks JAK1 and JAK2, which is good enough for a story." |
| T11 | 2 | not_attempted | 0 | 2 | -2 | "logP? QED? I have no idea what these are and there's no glossary, so I skipped it." |
| T12 | 6 | none | 0 | 2 | -2 | "The site gave me nothing I could find. The chatbot listed papers with PMIDs. I can't tell that one in five might be wrong, and I would have printed them." |
| T13 | 2 | not_attempted | 0 | 1 | -1 | "IC50 and assay context are beyond me. The chatbot's single number sounded authoritative." |
| T14 | 10 | partial | 2 | 2 | 0 | "'BRAF MEK' brought up 11 trials, one of them an exercise programme. I can't tell which ones really combine the two drugs." |
| T15 | 15 | partial | 1 | 2 | -1 | "I got lost between the demo Target Board and the trial tab. Only the trials looked real." |
| T16 | 10 | partial | 2 | 1 | +1 | "142 trials, but no way to group them by company. I gave up pivoting in Excel." |
| T17 | 6 | partial | 2 | 1 | +1 | "A big green 'Validated 92%' sits next to small grey 'Placeholder' text. As a journalist, that's a story in itself. I wasn't sure which one to believe." |
| T18 | 0 | not_attempted | 0 | 0 | 0 | "Programmatic retrieval isn't something I do." |
| T19 | 0 | not_attempted | 0 | 2 | -2 | "I asked the chatbot for a 3D picture and it gave me a code, 4ZAU. The site has nothing in the menu for this." |
| T20 | 8 | none | 0 | 3 | -3 | "This is exactly my kind of question. The site has nothing. The chatbot gave a neat timeline, but I can't tell what changed after its cutoff." |
| T21 | 4 | none | 1 | 3 | -2 | "The Target Board says 'MAPT druggability Medium', but it's demo data. The chatbot explained tau antibodies versus pills in plain English." |
| T22 | 1 | not_attempted | 0 | 2 | -2 | "Prioritising targets by genetic evidence is a scientist's job, not mine." |
| T23 | 10 | none | 1 | 3 | -2 | "My readers ask about Alzheimer's drugs. The site only had demo 'repositioned' rows. The chatbot gave real candidates with reasons." |
| T24 | 0 | not_attempted | 0 | 1 | -1 | "A validation dossier isn't for me." |
| T25 | 0 | not_attempted | 0 | 1 | -1 | "Selectivity across mutants is beyond me." |
| T26 | 5 | none | 1 | 2 | -1 | "Candidate Molecules lists 'Osimertinib-R'. I thought it was a new drug for C797S. The chatbot's citations look real, but two of them aren't." |
| T27 | 8 | partial | 2 | 3 | -1 | "The trial tab found some triplet trials. The chatbot explained why you'd combine the three drugs and named IMspire150." |
| T28 | 0 | not_attempted | 0 | 1 | -1 | "GO/NO-GO for an internal programme isn't my job. The decision pages looked official, though." |
| T29 | 15 | partial | 2 | 1 | +1 | "This is why I came. I found 23 recruiting trials but had no way to filter to Alabama, so I opened each one on CT.gov and got through about 8. The chatbot suggested trials that are closed, which is dangerous for a patient." |
| T30 | 0 | not_attempted | 0 | 0 | 0 | "Agents and APIs aren't something I use." |

**U9 totals**

| Metric | Value |
|---|---|
| Completion | full 2 · partial 7 · none 12 · not_attempted 9 |
| Mean site_q | 0.80 (24/30) |
| Mean ai_q | 1.90 (57/30) |
| Mean delta | −1.10 (−33/30) |
| Total minutes | 166 (realistically she would have stopped after about 30) |

**Reflection (U9).** "I went in hoping for a trustworthy source I could link to in an article. I came out mostly confused about what was real. The only thing I could use was the trial search, and it's hidden under a menu item called 'Trial Simulations'. The 'Validated 92%' badge on a placeholder row made me trust everything else on the site less. For explanations I'll keep using a chatbot. I'd come back only for live trial lists, and only if I could filter by location and get a plain-English summary."

---

## U10: Dr. Rafael Duarte, structural biologist (high tech, high bio, regular user)

How he moves through the site: he bookmarks `/targets` and `/search`, edits URLs by hand, keeps RCSB, PyMOL and ChEMBL open in other tabs, and opens devtools without a second thought. He checks every structural claim himself, but he isn't a clinician.

| task | time_min | completion | site_q | ai_q | delta | note |
|---|---|---|---|---|---|---|
| T01 | 1 | full | 4 | 4 | 0 | "P00533 is correct. The 'placeholders' banner right above it made me open UniProt to check anyway." |
| T02 | 2 | full | 4 | 4 | 0 | "/search is correct. I wanted an InChIKey and an SDF download, and neither is there. The /compounds SMILES is wrong." |
| T03 | 1 | full | 3 | 2 | +1 | "The 2D depiction is fine, but there's no 3D view, no conformer and no MOL file to drop into PyMOL." |
| T04 | 3 | full | 4 | 1 | +3 | "45 trials, live, with CT.gov links. Not my field, but it's clearly better than recalling trials from memory." |
| T05 | 6 | partial | 2 | 4 | -2 | "There's no target-to-drug query. I had to type in the names I already knew." |
| T06 | 3 | partial | 1 | 0 | +1 | "/targets says 1 and the board says 4. Both are demo data." |
| T07 | 2 | full | 4 | 0 | +4 | "The CSV includes source and retrieval date. It's missing the query string, but it's usable." |
| T08 | 3 | partial | 2 | 4 | -2 | "The curated row (Thress 2015) is correct but too technical for a lay reader. It also never says that Ser797 has no thiol for the acrylamide to attack." |
| T09 | 1 | full | 4 | 4 | 0 | "Engelman 2007, PMID 17463250. Verified in one click." |
| T10 | 4 | partial | 2 | 4 | -2 | "The results show an unnamed isomer first and no mechanism. I already knew it's a JAK1/2 type-I inhibitor." |
| T11 | 4 | full | 4 | 3 | +1 | "The descriptors match ChEMBL. The salt forms are listed first, which is annoying." |
| T12 | 3 | partial | 4 | 3 | +1 | "Five verified PMIDs is worth something, but nothing after osimertinib is covered." |
| T13 | 5 | none | 0 | 2 | -2 | "There's no bioactivity data, so I went to ChEMBL directly." |
| T14 | 10 | partial | 2 | 3 | -1 | "Free-text search mixes in false positives, and there's no intervention field." |
| T15 | 10 | partial | 2 | 2 | 0 | "Only the trials and search steps use real data. The drug link in between is demo data." |
| T16 | 8 | partial | 3 | 2 | +1 | "The sponsor and phase columns are there, but I had to page through 6 times and pivot it myself." |
| T17 | 2 | full | 3 | 1 | +2 | "The row text says 'Placeholder' and the badge says 'Validated 92%'. That's a contradiction." |
| T18 | 5 | partial | 1 | 2 | -1 | "I found /api/search in the network tab. It caps at 25 results with no offset, so 50 isn't possible." |
| T19 | 8 | partial | 2 | 3 | -1 | "The PDB link returns all 394 EGFR entries. I built the YY3 ligand query myself and got 10. The site has nothing on Cys797, resolution or mutant state." |
| T20 | 6 | none | 1 | 4 | -3 | "All it shows is 'Approved'. I went to Drugs@FDA." |
| T21 | 8 | none | 1 | 3 | -2 | "I wanted pocket and ligandability flags, and there aren't any. Open Targets is one link away, but that's not the site doing the work." |
| T22 | 10 | none | 1 | 3 | -2 | "The board is demo data. There are no association scores." |
| T23 | 8 | none | 1 | 3 | -2 | "/drug is demo data. There's nothing I could cite." |
| T24 | 12 | none | 1 | 2 | -1 | "A JAK2 dossier needs JH1/JH2 structures and the ruxolitinib complex. The site has a UniProt ID and an unfiltered PDB link." |
| T25 | 10 | none | 0 | 2 | -2 | "Selectivity is a residue-level question (T790 gatekeeper, HER2 Cys805). There's no data at all." |
| T26 | 12 | partial | 2 | 3 | -1 | "The curated C797S row is right. 'Osimertinib-R, covalent, repositioned for C797S' is chemically impossible and undermines it. I checked the AI's EAI045 claim myself." |
| T27 | 12 | partial | 2 | 4 | -2 | "The trials surfaced, but there's no toxicity data. The AI's rationale was better than mine on this one." |
| T28 | 15 | none | 1 | 2 | -1 | "Every decision page is demo data. I gave up." |
| T29 | 10 | partial | 2 | 1 | +1 | "There's no location filter, so I opened NCT pages one by one. It's still better than an AI listing closed trials." |
| T30 | 10 | partial | 2 | 0 | +2 | "The endpoints work and include provenance, but I only found them through devtools. There are no docs and no MCP." |

**U10 totals**

| Metric | Value |
|---|---|
| Completion | full 8 · partial 14 · none 8 · not_attempted 0 |
| Mean site_q | 2.17 (65/30) |
| Mean ai_q | 2.50 (75/30) |
| Mean delta | −0.33 (−10/30) |
| Total minutes | 194 |

**Reflection (U10).** "For structural work the site is a launcher, not a tool: it gets me to UniProt and an unfiltered RCSB search, and from there I do everything myself. The live ChEMBL and trial lookups are accurate and faster than my bookmarks. But there is no ligand code, no residue annotation, no 3D view and no file I can load into PyMOL. The 'covalent inhibitor for C797S' demo row is the kind of error that would make a structural reviewer stop trusting the platform."

---

## New issues (not covered by S-01…S-24)

**U9-01 BUG P1: the live-data pages are missing from the navigation.**
- Evidence: the sidebar (`src/app/auth-gate.tsx:96-149` navGroups, plus NavItems at :313-321) has no entry for `/search`, `/targets`, `/compounds`, `/drug` or `/disease`.
- `/search`, the only live ChEMBL page, is linked only from `/compounds/page.tsx:205`, and `/compounds` is itself orphaned.
- `/targets` is reachable only by selecting a row on Mechanisms of Action (`mechanisms/page.tsx:200`), or from `/compounds:192` and `/drug:169`.
- A sidebar-only user (U9) never reaches the three real data sources.
- Fix: add a top "Live & curated data" group (Search ChEMBL, Targets + curated resistance, Trial Landscape) and a global search box in the header.

**U9-02 BUG P2: the live trial search is labelled "Trial Simulations".**
- Evidence: `auth-gate.tsx:133` and `module-access.ts:88`. The page it opens has the live ClinicalTrials.gov tab as its default (`clinical/trials/page.tsx:126`).
- Users looking for real trials skip the item because of the word "simulations".
- Fix: rename it "Clinical trials (live + demo)" or "Trial Landscape".

**U9-03 FEATURE P2: there is no public, read-only view.**
- Evidence: unauthenticated visitors only ever see the login page (`auth-gate.tsx:38-40`), which requires an invitation code ("New users need an invitation code", `login/page.tsx:65`).
- A journalist or patient advocate trying the site once cannot get in.
- Fix: serve `/search`, the Trial Landscape and the curated EGFR panel publicly in read-only mode, with demo modules hidden.

**U9-04 BUG P2: the first page after login is demo data.**
- Evidence: `src/app/page.tsx:4` redirects to `/projects`, a demo project directory with A.G.E. scores.
- There is no "start here" page and no statement of what is real.
- Fix: make the landing page a short "What's real on this site" panel with the three live entry points, and put the demo modules below it.

**U9-05 FEATURE P2: the in-site help assistant needs the user's own API key.**
- Evidence: `feedback-widget.tsx:42` ("users bring their own API key") and :323-334 ("Set up an API key in Settings…").
- Lay users have no key, so the only help channel does nothing for them, and there is no static help page for them to fall back on.
- Fix: offer a small hosted quota (or FAQ answers when no key is set), plus a static "How to use this site" page linked from the sidebar.

**U9-06 FEATURE P3: jargon has no tooltips or glossary.**
- Evidence:
  - Search column headers `MW, LogP, HBA/HBD, PSA, QED` (`search/page.tsx:169`).
  - Evidence labels `Terrain2Drug / Paper2Drug / Market2Drug` (`mechanisms/page.tsx:77-79`).
  - "A.G.E." on Projects.
  - "OSDD2" in the navigation.
- Fix: add `title` or `abbr` tooltips and a one-page glossary linked from each table.

**U9-07 FEATURE P3: trial results are not explained for patients.**
- Evidence: the status and phase badges show raw values ("Ph 3", "Recruiting") with no explanation (`trial-landscape.tsx:27-49`), and there is no "discuss with your doctor; eligibility not checked" notice.
- Fix: add a one-line explanation of each phase and status, plus a patient-safety disclaimer on the Landscape tab.

**U9-08 BUG P2: a demo page in the navigation reuses real drug names.**
- This extends S-04/S-10 to a page that is linked from the navigation.
- Evidence: `pharmacology/candidates/page.tsx:25` ("Vemurafenib analog", MW 510.4, IC50 12 nM) and :28 ("Osimertinib-R", target EGFR T790M). Unlike `/compounds` and `/drug`, this page is in the sidebar (Pharmacology → Candidate Molecules), so lay users actually see it.
- Fix: rename the rows to fictional SDD codes with no real drug names, as already proposed for S-04/S-10.

**U9-09 FEATURE P3: search doesn't show which synonym matched, and unnamed records show their ID as the name.**
- Evidence (live):
  - `q=Tagrisso` returns OSIMERTINIB MESYLATE and OSIMERTINIB, but nowhere mentions "Tagrisso".
  - Unnamed hits show `CHEMBL4784911` in the Name column, labelled "Preclinical" (phase 0).
- A lay user can't confirm that "Tagrisso" was understood, and reads the IDs as drug names.
- Fix: return and display the matched synonym or brand name, and show "(no preferred name)" for unnamed records.

**U10-01 FEATURE P2: compound rows have no structure-interoperability fields.**
- Evidence: `search/page.tsx:169` shows only 2D/descriptors. There is no InChIKey, no PDB chemical-component code (e.g. YY3 for osimertinib, STI for imatinib) and no SDF/MOL download.
- Fix: add the InChIKey, a link to the "PDB ligand" (RCSB chem-comp search by InChIKey) and an "SDF" link (ChEMBL `/molecule/{id}.sdf`).

**U10-02 FEATURE P3: there is no 3D structure viewer.**
- Evidence: `molecule-viewer.tsx` is 2D SmilesDrawer only. Target cards link out to RCSB (`targets/page.tsx:233-249`).
- Fix: embed Mol* for selected PDB entries on target cards (for example the curated EGFR–osimertinib set once S-21 lands).

**U10-03 FEATURE P3: target cards have no residue or feature annotation.**
- Evidence: target cards show only UniProt, organism, disease and compound count (`targets/page.tsx:170-209`).
- There is no kinase-domain range, no gatekeeper (T790), no covalent cysteine (C797) and no clinically relevant variants. S-21 covers only PDB filtering.
- Fix: pull the UniProt features API (domain, binding site, active site, natural variant) into a collapsible residue table on each card.

**U10-04 BUG P3: /targets has no search input.**
- Evidence: `TargetsContent` reads `?q=` (`targets/page.tsx:109-112`) but renders no input, so filtering means editing the URL by hand.
- Fix: add a gene/name search field bound to `?q=`.

**U10-05 FEATURE P3: compounds can't be searched by structure.**
- Evidence: the placeholder and description allow only name, synonym or ChEMBL ID (`search/page.tsx:112-114`).
- There is no SMILES exact, similarity or substructure search, although ChEMBL's `/similarity` and `/substructure` endpoints exist.
- Fix: add a "Structure (SMILES)" mode with a Tanimoto threshold, proxied the same way as name search.

**Counts:** U9: BUG 4 (P1 1, P2 3), FEATURE 5 (P2 2, P3 3). U10: BUG 1 (P3), FEATURE 4 (P2 1, P3 3). **Total new: 14.**

### Existing S-issues that hit these users especially hard

- **S-03 (U9):** for a journalist, "Validated 92%" on a placeholder row is the single most damaging finding. It made her distrust the real trial data on other pages too.
- **S-07 (U9, U10):** the page-wide "placeholders" banner sits above real UniProt IDs. U9 couldn't tell real from fake, and U10 re-checked every ID by hand.
- **S-15 (U9):** without a location or eligibility filter, her core use case (T29, matching a patient near Birmingham) took 15 minutes and was still incomplete.
- **S-24 (U9):** without a plain-language layer, every science task sent her back to a chatbot (T08, T10, T21, T23).
- **S-10 (U10):** "Osimertinib-R, covalent, for C797S" is the error a structural biologist notices first. See also U9-08 for the same row on a page in the navigation.
- **S-21 (U10):** the unfiltered 394-entry PDB link was his main pain point (T19, T24). He needs the ligand filter plus resolution, mutant state and covalent-bond annotation.
- **S-17 / S-18 (U10):** with no bioactivity or tractability data, every residue-level selectivity and pocket question (T21, T25) went to ChEMBL, Open Targets or RCSB.
- **S-19 (U10):** he found the JSON endpoints only through devtools. A documented API with a "copy as API URL" link on result pages would turn him into an API user.

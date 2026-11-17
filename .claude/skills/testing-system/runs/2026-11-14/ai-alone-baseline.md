# AI-alone baseline — run 2026-11-14

**Comparator:** a capable general chat LLM with no tools, no browsing, no database access.
**Method:** for each task an answer was first written from memory only (knowledge cutoff mid-2026; today 2026-11-14), then checked against live sources: ChEMBL (v34 MCP), ClinicalTrials.gov API v2, PubMed, Open Targets Platform GraphQL, RCSB PDB search API, and (for one FDA history check) Wikipedia. Scores use the 0–5 rubric in `profiles-and-use-cases.md`.

## Summary

- **Mean ai_alone_quality:** Easy 2.7 · Medium 2.5 · Hard 2.2 · **Overall 2.47 / 5** (74/30).
- **AI alone does well at:** stable lookups (UniProt, ChEMBL IDs, SMILES, MW, approval years), plain-language explanation (C797S), landmark citations (Engelman 2007, Thress 2015, Kobayashi/Pao 2005), and synthesis of rationale for combinations (BRAF+MEK+PD-1). All 20 NCT IDs and 5 ChEMBL IDs recalled from memory were real and pointed to the right trial or compound.
- **AI alone does badly at:** anything live. Every Phase 3 EGFR-NSCLC trial recalled from memory (FLAURA2, MARIPOSA, MARIPOSA-2, LAURA, ADAURA2, SAFFRON) is now **ACTIVE_NOT_RECRUITING**, so a "recruiting" answer would have been 0/3 correct. Counts, patient–trial matching, CSV export, bulk/programmatic retrieval, site-specific questions and agent/MCP use are not possible at all.
- **Hallucinated identifiers:** **3**, all PMIDs (3 of 16 PMIDs checked = 19%). Each one was close to the real number (off by 1–2, or a real paper on a neighbouring topic), so it looks plausible. 0 of 20 NCT IDs, 0 of 5 ChEMBL IDs and 0 of 2 PDB IDs were fabricated.
- **Stale or wrong-status facts:** 9 trial statuses (6 EGFR, 3 KRAS G12C), plus small descriptor errors (HBA counts, logP method).

## Results table

| Task | ai_alone_quality | ai_alone_minutes | failure_modes | verified_fact_checks |
|---|---|---|---|---|
| T01 EGFR UniProt + name | 4 | 1 | no provenance link or date (minor) | P00533 "Epidermal growth factor receptor": correct (RCSB 4ZAU lists UniProt P00533) |
| T02 Vemurafenib ChEMBL/SMILES/MW/status | 4 | 2 | unsourced; user must verify | CHEMBL1229517 ✓; SMILES identical to ChEMBL canonical ✓; MW 489.93 ✓; max_phase 4, first approval 2011 ✓ |
| T03 Imatinib 2D structure | 2 | 2 | can't render an image; gives SMILES or text only | SMILES recalled = ChEMBL CHEMBL941 canonical ✓ |
| T04 Recruiting Ph3 EGFR-mut NSCLC: count + 3 NCT | 1 | 3 (+10 to verify) | stale status; can't count | Recalled NCT04035486, NCT04487080, NCT04988295, NCT03521154, NCT05120349, NCT05261399: all real but all ACTIVE_NOT_RECRUITING. Live: 40 hits for "NSCLC AND EGFR", Ph3, recruiting (about 30 truly EGFR-mutant), e.g. NCT06350097, NCT04181060, NCT07185997 |
| T05 Approved drugs for BRAF V600E | 4 | 2 | no label citations | vemurafenib, dabrafenib, encorafenib (+ MEK partners trametinib, cobimetinib, binimetinib) correct; tovorafenib nuance is reasonable |
| T06 Site's melanoma program targets | 0 | 1 | can't do (site-specific data) | n/a |
| T07 Export EGFR trials to CSV with source and date | 0 | 1 | can't do (no retrieval or export); risk of invented rows | n/a |
| T08 Plain-language C797S | 4 | 1 | genuinely good; unsourced unless asked | Thress et al. Nat Med 2015, PMID 25939061 ✓ supports the claim |
| T09 Primary source: MET amp → gefitinib resistance | 4 | 1 | genuinely good | Engelman Science 2007, PMID 17463250 ✓ (abstract states it directly); Bean PNAS 2007, PMID 18093943 ✓ |
| T10 Ruxolitinib targets + MoA | 4 | 1 | unsourced | CHEMBL1789941, JAK1/2 inhibitor ✓; JAK2 IC50 2.8 nM matches a ChEMBL record (CHEMBL2155751) |
| T11 MW/logP/HBA/HBD/QED of 3 EGFR TKIs | 3 | 2 | numbers slightly wrong; calculation method not stated | MW all ✓ (393.44/446.91/499.62); QED ✓ ±0.01 (0.42/0.52/0.31); HBA erlotinib 6 vs ChEMBL 7, osimertinib 7 vs 8; gefitinib logP 3.75 vs ChEMBL ALogP 4.28 |
| T12 EGFR-TKI resistance mechanisms + citations | 3 | 3 (+15 to verify) | 1 hallucinated PMID | T790M (15728811, 15737014) ✓, MET (17463250) ✓, SCLC transformation (21430269) ✓, C797S (25939061) ✓, AXL (22751098) ✓; HER2 cited as 22961667 ✗ |
| T13 JAK2 inhibitors IC50 + assay context | 2 | 3 | no assay context; a single value hides the spread | Ruxolitinib JAK2: 58 ChEMBL IC50 records ranging 0.12 nM to 4,982 nM (biochemical vs whole-blood pSTAT5); Quintás-Cardama Blood 2010, PMID 20130243 ✓ |
| T14 True BRAF+MEK combination trials, melanoma | 3 | 2 | historic pivotal trials only; not complete or current | NCT01584648 (COMBI-d), NCT01597908 (COMBI-v), NCT01689519 (coBRIM), NCT01909453 (COLUMBUS), NCT01682083 (COMBI-AD), NCT01072175: all ✓ real, correct arms, all COMPLETED |
| T15 BRAF → melanoma → drugs → active trials | 2 | 3 | the active-trials step is stale or unknown | Drug layer correct; trial layer would list completed trials |
| T16 KRAS G12C NSCLC trials by sponsor and phase | 2 | 3 | stale statuses; no counts | IDs ✓, but CodeBreaK 200 NCT04303780 is COMPLETED, KRYSTAL-12 NCT04685135 is ANR, Krascendo-1 NCT06497556 is ANR; still recruiting: NCT04613596, NCT05920356, NCT06119581 |
| T17 Is the site's "92% confidence" sourced? | 1 | 1 | can't do (site-specific); generic advice only | n/a |
| T18 Retrieve 50 "kinase inhibitor" compounds programmatically | 2 | 3 | can write code but can't run it; no data returned | n/a (code untested) |
| T19 PDB: EGFR + osimertinib | 3 | 2 | incomplete | 4ZAU ✓ (WT EGFR + AZD9291, 2.8 Å; Yosaatmadja J Struct Biol 2015, PMID 26522274 ✓); RCSB ligand YY3 gives 10 entries: 4ZAU, 6JWL, 6JX0, 6JX4, 6JXT, 6LUD, 7JXM, 7JXP, 7JXW, 7K1H. Memory recalled 2 |
| T20 Osimertinib FDA history + label | 4 | 2 | unsourced; can't confirm changes after cutoff | Nov 2015 accelerated, Mar 2017 full, Apr 2018 1L, Dec 2020 adjuvant, Feb 2024 + chemo, Sep 2024 stage III (LAURA): all match the secondary source; none after Sep 2024 found |
| T21 MAPT tractability by modality | 3 | 3 | partly wrong detail; no Open Targets flags | OT ENSG00000186868: SM "Structure with Ligand", "High-Quality Ligand" and "Druggable Family" = true, pockets = false; AB "Advanced Clinical" = true; PR literature/binder = true. AI said "small molecule low", which is directionally fair but misses these flags |
| T22 Prioritise NSCLC targets (genetic + literature) | 3 | 3 | no scores or provenance | OT MONDO_0005233 top: EGFR 0.89, KRAS 0.83, ALK 0.81, ERBB2 0.81, ROS1 0.81, MET 0.81, DICER1 0.79, RET 0.78, TP53 0.77, BRAF 0.76. AI list overlaps 8 of 10; missed DICER1 and TP53 ranking |
| T23 Alzheimer's repositioning candidates | 3 | 3 | unsourced; staleness risk (GLP-1 RA readouts) | rationale sound; not citable as given |
| T24 Exportable JAK2 validation dossier | 2 | 5 | not exportable; unsourced; numbers unverified | n/a |
| T25 EGFR inhibitor selectivity (mutant/WT/HER2) | 2 | 3 | numbers from memory; no assay context | Cross Cancer Discov 2014, PMID 24893891 ✓; individual IC50s not checked |
| T26 C797S strategies with evidence | 2 | 4 (+15 to verify) | 2 hallucinated PMIDs; pipeline status may be stale | EAI045, Jia Nature 2016, PMID 27251290 ✓; To et al. 2019 cited as 31092402 ✗; Niederst 2015 cited as 25964295 ✗ |
| T27 BRAF+MEK+PD-1 triplet rationale | 4 | 3 | genuinely good; trial status OK | IMspire150 NCT02908672 + Gutzmer Lancet 2020, PMID 32534646 ✓; COMBI-i NCT02967692 (TERMINATED) + Dummer JCO 2022, PMID 35030011 ✓; KEYNOTE-022 NCT02130466 ✓ |
| T28 GO/NO-GO from real evidence | 2 | 4 | no access to program data; generic framework | n/a |
| T29 Patient-trial match (L858R, post-osimertinib, Birmingham AL) | 1 | 3 | can't do live matching; would suggest non-recruiting trials | Recalled SAFFRON and MARIPOSA-2 are ANR. Live recruiting with a Birmingham site: e.g. NCT05642572 (Lung-MAP capmatinib + osimertinib, MET-amp), NCT06618287 (BMS-986507 + osimertinib), NCT05967689 (zipalertinib, uncommon mutations). None were known from memory |
| T30 Answer via agent/MCP or API | 0 | 1 | can't do by definition | n/a |

## Notable errors found

1. **Hallucinated PMID, HER2 amplification (T12).** The AI gave Takezawa et al., Cancer Discov 2012, PMID 22961667. PubMed 22961667 is Ercan et al., "Reactivation of ERK signaling causes resistance to EGFR kinase inhibitors" (Cancer Discov 2012): a real resistance paper, but not the HER2 one. The correct Takezawa paper is **PMID 22956644**.
2. **Hallucinated PMID, JBJ-04-125-02 + osimertinib (T26).** The AI gave To et al., Cancer Discov 2019, PMID 31092402. PubMed 31092402 is Khot et al., "First-in-Human RNA Polymerase I Transcription Inhibitor CX-5461…", which has nothing to do with EGFR. The correct paper is **PMID 31092401**.
3. **Hallucinated PMID, C797S allelic context (T26).** The AI gave Niederst et al., Clin Cancer Res 2015, PMID 25964295. PubMed 25964295 is Khan et al., "Polymorphism at 19q13.41 Predicts Breast Cancer Survival…". The correct paper is **PMID 25964297**.
4. **Stale "recruiting" trials (T04, T29).** From memory the AI offers FLAURA2 (NCT04035486), MARIPOSA (NCT04487080), MARIPOSA-2 (NCT04988295), LAURA (NCT03521154), ADAURA2 (NCT05120349) and SAFFRON (NCT05261399) as current options. ClinicalTrials.gov lists all six as **ACTIVE_NOT_RECRUITING**. The live recruiting Ph3 set is mostly 2024–2026 starts (e.g. NCT06350097 osimertinib ± Dato-DXd; NCT07185997 ALPACCA; NCT07754123 HS-10504 for C797S) that the AI does not know.
5. **Stale KRAS G12C statuses (T16).** CodeBreaK 200 (NCT04303780) is **COMPLETED**; KRYSTAL-12 (NCT04685135) and divarasib Krascendo-1 (NCT06497556) are **ACTIVE_NOT_RECRUITING**.
6. **Descriptor mismatches (T11).** The AI gave erlotinib HBA 6, osimertinib HBA 7 and gefitinib logP 3.75. ChEMBL CHEMBL553, CHEMBL3353410 and CHEMBL939 give HBA 7, HBA 8 and ALogP 4.28. The differences come from calculation conventions, but the AI did not say which method it used.
7. **Single IC50 hides an assay spread (T13).** The AI gave "ruxolitinib JAK2 IC50 = 2.8 nM". ChEMBL holds 58 JAK2 IC50 records for CHEMBL1789941 against CHEMBL2971, ranging from 0.12 nM (biochemical) to 677–4,982 nM (whole-blood pSTAT5). The quoted value matches only one assay (CHEMBL2155751, HTRF).
8. **Incomplete structure list (T19).** The AI recalled 4ZAU and 6JX0. RCSB lists 10 entries containing osimertinib (ligand YY3).

## Notes on fairness

- Times assume the user accepts the AI answer. Where IDs must be trusted (T04, T12, T26), add 10–15 minutes of manual verification. Without it, roughly 1 in 5 PMIDs would be wrong and every trial status would be unchecked.
- Explanation and synthesis tasks (T08, T09, T27) scored 4. With sourcing they are close to 5, and a site would add little beyond provenance and links.
- The four "can't do" tasks (T06, T07, T17, T30) and the live tasks (T04, T16, T29) account for most of the gap a tool-backed site can close.

# #78 plain-language review: input for the three reviewers

Source of truth: `src/data/curated/egfr-resistance.ts` (each row: alteration, setting, mechanism, evidence, PMID).
Rule set by the #62 reviewer: each `plainLanguage` sentence **only restates its row in everyday words**. No new facts, no
prevalence figures beyond the row's evidence, no treatment advice. A person must approve before release.
Audience: the public "EGFR resistance (curated)" page (patients, advocates, students) and the CSV export.

| # | Alteration | Setting | Mechanism (row) | Evidence (row) | Current sentence | PMID |
|---|---|---|---|---|---|---|
| 1 | EGFR T790M | After 1st-generation TKIs | Second-site gatekeeper point mutation (threonine-to-methionine at 790) in the EGFR kinase domain. | Found at relapse in a gefitinib-responsive patient; structural modeling and biochemistry showed it confers gefitinib resistance. | A second change in the EGFR gene appeared when the cancer came back, and it stopped gefitinib from working. | 15728811 |
| 2 | EGFR C797S | After osimertinib | Mutation of the cysteine that covalent 3rd-generation inhibitors bind. | Acquired C797S detected in plasma cfDNA in 6 of 15 AZD9291-resistant patients; mutant construct conferred resistance in cells. | A change in EGFR removes the spot where osimertinib attaches, so the drug can no longer block it. | 25939061 |
| 3 | Loss of T790M | After osimertinib | The T790M clone disappears at resistance, and other resistance mechanisms compete, including acquired KRAS mutations and targetable gene fusions. | Of 41 patients with tumor sequencing after osimertinib resistance, 28 (68%) had lost T790M; time to treatment discontinuation was shorter with T790M loss (6.1 vs 15.2 months). Among the 13 with maintained T790M, C797S was seen in 9. | In many patients the EGFR change that osimertinib targets disappeared, and the cancer grew through other routes instead, often sooner. | 30073261 |
| 4 | MET amplification | After 1st-generation TKIs | Focal MET amplification drives ERBB3 (HER3)-dependent PI3K activation, bypassing EGFR. | Detected in 4 of 18 (22%) specimens with acquired gefitinib/erlotinib resistance; MET inhibition restored sensitivity in cells. | The cancer makes extra copies of another growth gene, MET, which lets it keep growing even while EGFR is blocked. | 17463250 |
| 5 | HER2 (ERBB2) amplification | After 1st-generation TKIs | HER2 amplification sustains signaling despite EGFR inhibition. | Amplified in 12% of tumors with acquired resistance vs 1% of untreated lung adenocarcinomas. | Extra copies of the HER2 gene let the cancer keep growing despite EGFR treatment. | 22956644 |
| 6 | Acquired RET fusion | After osimertinib | A RET gene fusion (e.g. CCDC6-RET) signals around the blocked EGFR. | Found in 2 of 41 osimertinib-resistance biopsies; CCDC6-RET was sufficient to confer EGFR-TKI resistance in cells, and osimertinib plus the RET inhibitor BLU-667 produced rapid responses in 2 patients. | Two genes became fused into one, creating a new growth signal that does not depend on EGFR. | 30257958 |
| 7 | Small-cell transformation | After 1st-generation TKIs | NSCLC transforms histologically into small cell lung cancer while retaining the original EGFR mutation. | 5 of 37 (14%) resistant tumors transformed to SCLC and were sensitive to standard SCLC treatment. | The tumor changed into a different type of lung cancer that EGFR drugs do not treat. | 21430269 |
| 8 | Squamous (histologic) transformation | After osimertinib | The tumor changes histology, mainly to squamous cell carcinoma; off-target genetic alterations also emerge early. | Among 62 patients, histologic transformation (primarily squamous) was found in 15% of first-line and 14% of later-line osimertinib cases; 5 of 27 first-line patients had off-target genetic resistance. | Some tumors changed into a squamous type of lung cancer after osimertinib, and these patients tended to do worse. | 31911548 |

## Round 2: merged draft (from reviewers A science, B readability, C fidelity)

1. In one patient whose cancer came back after first responding to gefitinib (an early EGFR-blocking drug), a second change appeared in the EGFR gene; lab studies showed this change makes gefitinib stop working.
2. In some patients (6 of 15) whose cancer grew on osimertinib (a newer EGFR-blocking drug), a change in EGFR altered the exact spot where the drug attaches; in lab cells, this change made the drug stop working.
3. In one study, most patients (28 of 41) whose cancer stopped responding to osimertinib had lost the EGFR change the drug targets; other resistance routes appeared, and these patients stayed on osimertinib for a shorter time on average.
4. In some tumors (4 of 18) that stopped responding to early EGFR-blocking drugs, the cancer had made extra copies of another growth gene, MET, which lets growth signals go around the blocked EGFR.
5. Extra copies of another growth gene, HER2, were found in 12% of tumors that had become resistant to early EGFR-blocking drugs, compared with 1% of untreated lung tumors; HER2 can keep growth signals on despite these drugs.
6. In a few patients (2 of 41) whose cancer grew on osimertinib, the RET gene had fused with another gene, creating a growth signal that works around the blocked EGFR.
7. In one study, some tumors (5 of 37) that stopped responding to early EGFR-blocking drugs changed into a different kind of lung cancer, small-cell lung cancer, while keeping their EGFR change; these tumors responded to standard small-cell treatment.
8. In one study of 62 patients, about 1 in 7 tumors that stopped responding to osimertinib changed into a different kind of lung cancer, mostly one called squamous cell cancer; other gene changes also appeared early.

## Votes
- Round 1: all three reviewers proposed edits to all 8 (independently).
- Round 2 (merged draft): science ACCEPT ×8; readability ACCEPT ×6, AMEND #3 and #6 (plain wording); fidelity ACCEPT ×7, AMEND #3 ("on average" unsupported, so the row's figures are used instead).
- Round 3 (#3 and #6 combined amendments): ACCEPT ×3 for both. Unanimous on all 8.

Final text is in `src/data/curated/egfr-resistance.ts` (`plainLanguage`).

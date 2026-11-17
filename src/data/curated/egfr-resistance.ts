// Curated reference set: every row is checked against the cited PubMed abstract, and `excerpt` is copied from it.
// `plainLanguage` only restates the row in everyday words. The 8 current sentences were reviewed on 2026-11-14 by three
// independent reviewers (scientific accuracy vs PubMed abstracts, lay readability, fidelity/safety) to unanimous agreement;
// record: .claude/skills/testing-system/runs/2026-11-14/plain-language-review.md. Re-review any new or edited sentence.
export interface ResistanceMechanism {
  alteration: string;
  category: "On-target (EGFR)" | "Bypass signaling" | "Histologic transformation";
  setting: "After 1st-generation TKIs" | "After osimertinib";
  mechanism: string;
  affects: string;
  evidence: string;
  plainLanguage: string;
  excerpt: string;
  curator: string;
  verified: string;
  citation: { pmid: string; doi: string; short: string; year: number };
}

export const EGFR_RESISTANCE_REVIEWED = "2026-11-14";

// Set to true only after a person has reviewed every plainLanguage sentence (#62).
export const PLAIN_LANGUAGE_HUMAN_REVIEWED = true;

const AI_CURATOR = "AI-curated (Claude), checked against the PubMed abstract";

export const egfrResistance: ResistanceMechanism[] = [
  {
    alteration: "EGFR T790M",
    category: "On-target (EGFR)",
    setting: "After 1st-generation TKIs",
    mechanism: "Second-site gatekeeper point mutation (threonine-to-methionine at 790) in the EGFR kinase domain.",
    affects: "1st-generation reversible TKIs (gefitinib, erlotinib)",
    evidence: "Found at relapse in a gefitinib-responsive patient; structural modeling and biochemistry showed it confers gefitinib resistance.",
    plainLanguage:
      "In one patient whose cancer came back after first responding to gefitinib (an early EGFR-blocking drug), a second change appeared in the EGFR gene; lab studies showed this change makes gefitinib stop working.",
    excerpt: "a second point mutation, resulting in threonine-to-methionine amino acid change at position 790 of EGFR",
    curator: AI_CURATOR,
    verified: "2026-11-09",
    citation: { pmid: "15728811", doi: "10.1056/NEJMoa044238", short: "Kobayashi et al., N Engl J Med", year: 2005 },
  },
  {
    alteration: "EGFR C797S",
    category: "On-target (EGFR)",
    setting: "After osimertinib",
    mechanism: "Mutation of the cysteine that covalent 3rd-generation inhibitors bind.",
    affects: "Covalent 3rd-generation TKIs (osimertinib / AZD9291)",
    evidence: "Acquired C797S detected in plasma cfDNA in 6 of 15 AZD9291-resistant patients; mutant construct conferred resistance in cells.",
    plainLanguage:
      "In some patients (6 of 15) whose cancer grew on osimertinib (a newer EGFR-blocking drug), a change in EGFR altered the exact spot where the drug attaches; in lab cells, this change made the drug stop working.",
    excerpt: "six cases acquired the C797S mutation",
    curator: AI_CURATOR,
    verified: "2026-11-09",
    citation: { pmid: "25939061", doi: "10.1038/nm.3854", short: "Thress et al., Nat Med", year: 2015 },
  },
  {
    alteration: "Loss of T790M",
    category: "On-target (EGFR)",
    setting: "After osimertinib",
    mechanism: "The T790M clone disappears at resistance, and other resistance mechanisms compete, including acquired KRAS mutations and targetable gene fusions.",
    affects: "Osimertinib given for T790M-positive resistance to an earlier EGFR TKI",
    evidence: "Of 41 patients with tumor sequencing after osimertinib resistance, 28 (68%) had lost T790M; time to treatment discontinuation was shorter with T790M loss (6.1 vs 15.2 months). Among the 13 with maintained T790M, C797S was seen in 9.",
    plainLanguage:
      "In one study, most patients (28 of 41) whose cancer stopped responding to osimertinib had lost the EGFR change the drug targets; the cancer found other ways to keep growing, and these patients stayed on osimertinib for a shorter time (about 6 vs 15 months).",
    excerpt: "Among 28 individuals (68%) with loss of T790M, a range of competing resistance mechanisms was detected",
    curator: AI_CURATOR,
    verified: "2026-11-14",
    citation: { pmid: "30073261", doi: "10.1001/jamaoncol.2018.2969", short: "Oxnard et al., JAMA Oncol", year: 2018 },
  },
  {
    alteration: "MET amplification",
    category: "Bypass signaling",
    setting: "After 1st-generation TKIs",
    mechanism: "Focal MET amplification drives ERBB3 (HER3)-dependent PI3K activation, bypassing EGFR.",
    affects: "1st-generation TKIs (gefitinib, erlotinib)",
    evidence: "Detected in 4 of 18 (22%) specimens with acquired gefitinib/erlotinib resistance; MET inhibition restored sensitivity in cells.",
    plainLanguage:
      "In some tumors (4 of 18) that stopped responding to early EGFR-blocking drugs, the cancer had made extra copies of another growth gene, MET, which lets growth signals go around the blocked EGFR.",
    excerpt: "MET amplification was detected in 4 of 18 (22%) lung cancer specimens that had developed resistance to gefitinib or erlotinib",
    curator: AI_CURATOR,
    verified: "2026-11-09",
    citation: { pmid: "17463250", doi: "10.1126/science.1141478", short: "Engelman et al., Science", year: 2007 },
  },
  {
    alteration: "HER2 (ERBB2) amplification",
    category: "Bypass signaling",
    setting: "After 1st-generation TKIs",
    mechanism: "HER2 amplification sustains signaling despite EGFR inhibition.",
    affects: "EGFR TKIs; mutually exclusive with T790M in this series",
    evidence: "Amplified in 12% of tumors with acquired resistance vs 1% of untreated lung adenocarcinomas.",
    plainLanguage:
      "Extra copies of another growth gene, HER2, were found in 12% of tumors that had become resistant to early EGFR-blocking drugs, compared with 1% of untreated lung tumors; HER2 can keep growth signals on despite these drugs.",
    excerpt: "HER2 was amplified in 12% of tumors with acquired resistance versus only 1% of untreated lung adenocarcinomas",
    curator: AI_CURATOR,
    verified: "2026-11-09",
    citation: { pmid: "22956644", doi: "10.1158/2159-8290.CD-12-0108", short: "Takezawa et al., Cancer Discov", year: 2012 },
  },
  {
    alteration: "Acquired RET fusion",
    category: "Bypass signaling",
    setting: "After osimertinib",
    mechanism: "A RET gene fusion (e.g. CCDC6-RET) signals around the blocked EGFR.",
    affects: "Osimertinib and other EGFR TKIs",
    evidence: "Found in 2 of 41 osimertinib-resistance biopsies; CCDC6-RET was sufficient to confer EGFR-TKI resistance in cells, and osimertinib plus the RET inhibitor BLU-667 produced rapid responses in 2 patients.",
    plainLanguage:
      "In a few patients (2 of 41) whose cancer grew on osimertinib, the RET gene had joined with another gene, creating a growth signal that works around the blocked EGFR.",
    excerpt: "CCDC6-RET was sufficient to confer resistance to EGFR tyrosine kinase inhibitors (TKI)",
    curator: AI_CURATOR,
    verified: "2026-11-14",
    citation: { pmid: "30257958", doi: "10.1158/2159-8290.CD-18-1022", short: "Piotrowska et al., Cancer Discov", year: 2018 },
  },
  {
    alteration: "Small-cell transformation",
    category: "Histologic transformation",
    setting: "After 1st-generation TKIs",
    mechanism: "NSCLC transforms histologically into small cell lung cancer while retaining the original EGFR mutation.",
    affects: "EGFR TKIs",
    evidence: "5 of 37 (14%) resistant tumors transformed to SCLC and were sensitive to standard SCLC treatment.",
    plainLanguage:
      "In one study, some tumors (5 of 37) that stopped responding to early EGFR-blocking drugs changed into a different kind of lung cancer, small-cell lung cancer, while keeping their EGFR change; these tumors responded to standard small-cell treatment.",
    excerpt: "five resistant tumors (14%) transformed from NSCLC into small cell lung cancer (SCLC)",
    curator: AI_CURATOR,
    verified: "2026-11-09",
    citation: { pmid: "21430269", doi: "10.1126/scitranslmed.3002003", short: "Sequist et al., Sci Transl Med", year: 2011 },
  },
  {
    alteration: "Squamous (histologic) transformation",
    category: "Histologic transformation",
    setting: "After osimertinib",
    mechanism: "The tumor changes histology, mainly to squamous cell carcinoma; off-target genetic alterations also emerge early.",
    affects: "First-line and later-line osimertinib",
    evidence: "Among 62 patients, histologic transformation (primarily squamous) was found in 15% of first-line and 14% of later-line osimertinib cases; 5 of 27 first-line patients had off-target genetic resistance.",
    plainLanguage:
      "In one study of 62 patients, about 1 in 7 tumors that stopped responding to osimertinib changed into a different kind of lung cancer, mostly one called squamous cell cancer; other gene changes also appeared early.",
    excerpt: "histologic transformation, primarily squamous transformation, was identified in 15% of first-line osimertinib cases and 14% of later-line cases",
    curator: AI_CURATOR,
    verified: "2026-11-14",
    citation: { pmid: "31911548", doi: "10.1158/1078-0432.CCR-19-3563", short: "Schoenfeld et al., Clin Cancer Res", year: 2020 },
  },
];

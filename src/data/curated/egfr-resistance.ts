// Curated reference set: every row is checked against the cited PubMed abstract, and `excerpt` is copied from it.
// `plainLanguage` only restates the row in everyday words; it must be reviewed by a person before release.
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
export const PLAIN_LANGUAGE_HUMAN_REVIEWED = false;

const AI_CURATOR = "AI-curated (Claude), checked against the PubMed abstract";

export const egfrResistance: ResistanceMechanism[] = [
  {
    alteration: "EGFR T790M",
    category: "On-target (EGFR)",
    setting: "After 1st-generation TKIs",
    mechanism: "Second-site gatekeeper point mutation (threonine-to-methionine at 790) in the EGFR kinase domain.",
    affects: "1st-generation reversible TKIs (gefitinib, erlotinib)",
    evidence: "Found at relapse in a gefitinib-responsive patient; structural modeling and biochemistry showed it confers gefitinib resistance.",
    plainLanguage: "A second change in the EGFR gene appeared when the cancer came back, and it stopped gefitinib from working.",
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
    plainLanguage: "A change in EGFR removes the spot where osimertinib attaches, so the drug can no longer block it.",
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
    plainLanguage: "In many patients the EGFR change that osimertinib targets disappeared, and the cancer grew through other routes instead, often sooner.",
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
    plainLanguage: "The cancer makes extra copies of another growth gene, MET, which lets it keep growing even while EGFR is blocked.",
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
    plainLanguage: "Extra copies of the HER2 gene let the cancer keep growing despite EGFR treatment.",
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
    plainLanguage: "Two genes became fused into one, creating a new growth signal that does not depend on EGFR.",
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
    plainLanguage: "The tumor changed into a different type of lung cancer that EGFR drugs do not treat.",
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
    plainLanguage: "Some tumors changed into a squamous type of lung cancer after osimertinib, and these patients tended to do worse.",
    excerpt: "histologic transformation, primarily squamous transformation, was identified in 15% of first-line osimertinib cases and 14% of later-line cases",
    curator: AI_CURATOR,
    verified: "2026-11-14",
    citation: { pmid: "31911548", doi: "10.1158/1078-0432.CCR-19-3563", short: "Schoenfeld et al., Clin Cancer Res", year: 2020 },
  },
];

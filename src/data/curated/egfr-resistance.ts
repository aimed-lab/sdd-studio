// Curated reference set: every row is checked against the cited abstract (PubMed). Not demo data.
export interface ResistanceMechanism {
  alteration: string;
  category: "On-target (EGFR)" | "Bypass signaling" | "Histologic transformation";
  mechanism: string;
  affects: string;
  evidence: string;
  citation: { pmid: string; doi: string; short: string; year: number };
}

export const EGFR_RESISTANCE_REVIEWED = "2026-11-09";

export const egfrResistance: ResistanceMechanism[] = [
  {
    alteration: "EGFR T790M",
    category: "On-target (EGFR)",
    mechanism: "Second-site gatekeeper point mutation (threonine-to-methionine at 790) in the EGFR kinase domain.",
    affects: "1st-generation reversible TKIs (gefitinib, erlotinib)",
    evidence: "Found at relapse in a gefitinib-responsive patient; structural modeling and biochemistry showed it confers gefitinib resistance.",
    citation: { pmid: "15728811", doi: "10.1056/NEJMoa044238", short: "Kobayashi et al., N Engl J Med", year: 2005 },
  },
  {
    alteration: "EGFR C797S",
    category: "On-target (EGFR)",
    mechanism: "Mutation of the cysteine that covalent 3rd-generation inhibitors bind.",
    affects: "Covalent 3rd-generation TKIs (osimertinib / AZD9291)",
    evidence: "Acquired C797S detected in plasma cfDNA in 6 of 15 AZD9291-resistant patients; mutant construct conferred resistance in cells.",
    citation: { pmid: "25939061", doi: "10.1038/nm.3854", short: "Thress et al., Nat Med", year: 2015 },
  },
  {
    alteration: "MET amplification",
    category: "Bypass signaling",
    mechanism: "Focal MET amplification drives ERBB3 (HER3)-dependent PI3K activation, bypassing EGFR.",
    affects: "1st-generation TKIs (gefitinib, erlotinib)",
    evidence: "Detected in 4 of 18 (22%) specimens with acquired gefitinib/erlotinib resistance; MET inhibition restored sensitivity in cells.",
    citation: { pmid: "17463250", doi: "10.1126/science.1141478", short: "Engelman et al., Science", year: 2007 },
  },
  {
    alteration: "HER2 (ERBB2) amplification",
    category: "Bypass signaling",
    mechanism: "HER2 amplification sustains signaling despite EGFR inhibition.",
    affects: "EGFR TKIs; mutually exclusive with T790M in this series",
    evidence: "Amplified in 12% of tumors with acquired resistance vs 1% of untreated lung adenocarcinomas.",
    citation: { pmid: "22956644", doi: "10.1158/2159-8290.CD-12-0108", short: "Takezawa et al., Cancer Discov", year: 2012 },
  },
  {
    alteration: "Small-cell transformation",
    category: "Histologic transformation",
    mechanism: "NSCLC transforms histologically into small cell lung cancer while retaining the original EGFR mutation.",
    affects: "EGFR TKIs",
    evidence: "5 of 37 (14%) resistant tumors transformed to SCLC and were sensitive to standard SCLC treatment.",
    citation: { pmid: "21430269", doi: "10.1126/scitranslmed.3002003", short: "Sequist et al., Sci Transl Med", year: 2011 },
  },
];

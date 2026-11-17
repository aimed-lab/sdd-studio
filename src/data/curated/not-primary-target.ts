// Approved drugs that ChEMBL links to a gene by mechanism of action, but whose FDA label indication is defined by a
// different gene, so the gene is not the drug's primary target. Drug-aware trial search leaves these drugs out of
// that gene's query.
//
// ChEMBL has no "primary target" field, and an automatic rule (dropping small molecules that also hit another protein
// family) was tested and rejected: it also removed fedratinib, pacritinib and momelotinib from JAK2 and alectinib and
// crizotinib from ALK. So each pair is added by hand, only after reading the current FDA label.
export interface NotPrimaryTarget {
  gene: string;
  drug: string;
  drugChemblId: string;
  /** Gene that defines the drug's labelled indication. */
  primaryTarget: string;
  /** Short restatement of the label's indication, without new facts. */
  reason: string;
  sourceUrl: string;
  verified: string;
}

export const notPrimaryTargets: NotPrimaryTarget[] = [
  {
    gene: "EGFR",
    drug: "brigatinib",
    drugChemblId: "CHEMBL3545311",
    primaryTarget: "ALK",
    // openFDA label set_id 0fe9ff20-d402-41f3-bc1e-7002ea7007db (effective 2026-01-12), section 1: indicated for
    // ALK-positive metastatic NSCLC; section 12.1 lists EGFR deletion and point mutations among several kinases.
    reason: "FDA label indication is ALK-positive metastatic NSCLC",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=0fe9ff20-d402-41f3-bc1e-7002ea7007db",
    verified: "2026-11-15",
  },
];

export function notPrimaryFor(gene: string): NotPrimaryTarget[] {
  const g = gene.toUpperCase();
  return notPrimaryTargets.filter((x) => x.gene === g);
}

// Each definition paraphrases the linked documentation page (checked 2026-11-14). Only sourced thresholds are stated.
export interface GlossaryEntry {
  term: string;
  definition: string;
  source: { label: string; url: string };
}

const CHEMBL_COMPOUND_FAQ = {
  label: "ChEMBL documentation: drug and compound questions",
  url: "https://chembl.gitbook.io/chembl-interface-documentation/frequently-asked-questions/drug-and-compound-questions",
};

export const glossary = {
  maxPhase: {
    term: "Max phase",
    definition:
      "ChEMBL's highest stage of development reached by a compound across all indications: 4 approved, 3, 2 or 1 for clinical phases (Phase 2 also covers some Phase 2/3 trials, Phase 1 some Phase 1/2), 0.5 early Phase 1, −1 unknown, and blank for preclinical compounds.",
    source: CHEMBL_COMPOUND_FAQ,
  },
  mw: {
    term: "MW",
    definition: "Molecular weight in g/mol, calculated by ChEMBL with RDKit for the molecule shown (here the parent form).",
    source: CHEMBL_COMPOUND_FAQ,
  },
  alogp: {
    term: "ALogP",
    definition:
      "Calculated lipophilicity: the logarithm of the octanol/water partition coefficient, computed by ChEMBL with the Wildman–Crippen atomic-contribution method.",
    source: CHEMBL_COMPOUND_FAQ,
  },
  hbaHbd: {
    term: "HBA / HBD",
    definition:
      "Counts of hydrogen-bond acceptors and donors, which ChEMBL calculates by matching SMARTS patterns. These differ from the simpler Lipinski counts of nitrogen and oxygen atoms.",
    source: CHEMBL_COMPOUND_FAQ,
  },
  psa: {
    term: "PSA",
    definition: "Polar surface area, calculated by ChEMBL with Ertl's fragment-based method.",
    source: CHEMBL_COMPOUND_FAQ,
  },
  qed: {
    term: "QED",
    definition:
      "Quantitative estimate of drug-likeness (Bickerton et al., Nature Chemistry 2012). Values run from 0 (least drug-like) to 1 (most drug-like); ChEMBL reports the weighted version.",
    source: CHEMBL_COMPOUND_FAQ,
  },
  pchembl: {
    term: "pChEMBL",
    definition:
      "The negative log of a molar potency or affinity value (such as IC50, EC50, Ki or Kd), so different measurements can be compared on one scale: an IC50 of 1 nM is a pChEMBL of 9.",
    source: {
      label: "ChEMBL documentation: ChEMBL data questions",
      url: "https://chembl.gitbook.io/chembl-interface-documentation/frequently-asked-questions/chembl-data-questions",
    },
  },
  smiles: {
    term: "SMILES",
    definition:
      "Simplified Molecular Input Line Entry System: a way of writing a molecule's structure as a short line of ordinary characters.",
    source: { label: "Daylight: SMILES theory manual", url: "https://www.daylight.com/dayhtml/doc/theory/theory.smiles.html" },
  },
  uniprotAccession: {
    term: "UniProt accession",
    definition:
      "The stable identifier of a UniProtKB protein entry, 6 or 10 letters and digits long (e.g. P00533 for EGFR), recommended for citing the entry.",
    source: { label: "UniProt help: accession numbers", url: "https://www.uniprot.org/help/accession_numbers" },
  },
  pdbId: {
    term: "PDB ID",
    definition:
      "The identifier of an experimentally determined structure in the Protein Data Bank. Entries deposited before July 2027 also carry a short 4-character ID such as 4ZAU.",
    source: { label: "RCSB PDB: identifiers in PDB", url: "https://www.rcsb.org/docs/general-help/identifiers-in-pdb" },
  },
  ligandId: {
    term: "Ligand (chemical component) ID",
    definition:
      "The PDB's identifier for a small molecule or residue in its Chemical Component Dictionary, 3 or 5 characters long (osimertinib is YY3).",
    source: { label: "RCSB PDB: identifiers in PDB", url: "https://www.rcsb.org/docs/general-help/identifiers-in-pdb" },
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof glossary;

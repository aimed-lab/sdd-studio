// Curated target–drug–ligand mappings for ligand-filtered PDB links. Each pair is verified against the RCSB chemical
// component record and a ChEMBL mechanism record; add a pair only after verifying it the same way.
export interface PdbLigandLink {
  gene: string;
  uniprotId: string;
  drug: string;
  drugChemblId: string;
  ligandId: string;
  chemblMechanismId: number;
  entriesAtVerification: number;
  verified: string;
}

export const pdbLigandLinks: PdbLigandLink[] = [
  {
    gene: "EGFR",
    uniprotId: "P00533",
    drug: "Osimertinib",
    drugChemblId: "CHEMBL3353410",
    // RCSB chemical component YY3: synonym "Osimertinib" (PDB reference data); DrugBank DB09330 by InChIKey.
    ligandId: "YY3",
    // ChEMBL mechanism 2424: osimertinib, Epidermal growth factor receptor erbB1 inhibitor (CHEMBL203).
    chemblMechanismId: 2424,
    // RCSB search (UniProt P00533 AND ligand YY3) returned 10 entries: 4ZAU, 6JWL, 6JX0, 6JX4, 6JXT, 6LUD, 7JXM, 7JXP, 7JXW, 7K1H.
    entriesAtVerification: 10,
    verified: "2026-11-14",
  },
];

const ACCESSION_ATTR = "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession";

export function rcsbSearchUrl(uniprotId: string, ligandId?: string): string {
  const accession = {
    type: "terminal",
    service: "text",
    parameters: { attribute: ACCESSION_ATTR, operator: "exact_match", value: uniprotId },
  };
  const query = ligandId
    ? {
        type: "group",
        logical_operator: "and",
        nodes: [
          accession,
          {
            type: "terminal",
            service: "text",
            parameters: {
              attribute: "rcsb_nonpolymer_entity_container_identifiers.nonpolymer_comp_id",
              operator: "exact_match",
              value: ligandId,
            },
          },
        ],
      }
    : accession;
  return `https://www.rcsb.org/search?request=${encodeURIComponent(JSON.stringify({ query, return_type: "entry" }))}`;
}

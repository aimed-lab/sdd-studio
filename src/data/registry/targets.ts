// Target registry (#25 Stage 1): the single source for the program target list used by /targets and /targets/[gene].
// Every field states its data class. Curated fields name their source and verification date; demo fields are
// illustrative program data and are never shown to anonymous visitors or used as evidence.
import { boardTargets } from "@/data/target-board";

export type FieldClass = "curated" | "live" | "demo";

export interface Field<T> {
  value: T;
  dataClass: FieldClass;
  /** Where a curated value comes from (database and record). */
  source?: string;
}

export interface RegistryTarget {
  gene: Field<string>;
  name: Field<string>;
  organism: Field<string>;
  /** UniProt molecular-function keyword used as the class label. */
  targetClass: Field<string>;
  uniprotId: Field<string>;
  hgncId: Field<string>;
  chemblTargetId: Field<string>;
  /** Curated reference sets that apply to this target. */
  curatedSets: Field<("egfr-resistance")[]>;
  programDiseaseArea: Field<string>;
  /** Filter key on the demo target board. */
  programDiseaseKey: Field<string>;
  /** ID of this target's row on the demo target board, if it has one. */
  boardId: Field<string | null>;
}

/** Date the curated identity fields were last checked against UniProtKB, HGNC and ChEMBL. */
export const TARGET_REGISTRY_VERIFIED = "2026-11-14";

const curated = <T,>(value: T, source: string): Field<T> => ({ value, dataClass: "curated", source });
const demo = <T,>(value: T): Field<T> => ({ value, dataClass: "demo" });

/** Board row for a gene: the demo board names rows "<GENE> <variant>" or "<GENE> (<alias>)". */
const boardIdFor = (gene: string) =>
  boardTargets.find((b) => b.name.split(/[\s(]/)[0].toUpperCase() === gene)?.id ?? null;

interface Seed {
  gene: string;
  name: string;
  targetClass: string;
  uniprotId: string;
  hgncId: string;
  chemblTargetId: string;
  curatedSets?: ("egfr-resistance")[];
  programDiseaseArea: string;
  programDiseaseKey: string;
}

// Identity verified on 2026-11-14:
// - gene, recommended name, organism, molecular-function keyword and HGNC cross-reference from rest.uniprot.org/uniprotkb/<accession>
// - ChEMBL single-protein target by UniProt accession from ebi.ac.uk/chembl/api/data/target.json?target_components__accession=<accession>
const seeds: Seed[] = [
  { gene: "EGFR", name: "Epidermal growth factor receptor", targetClass: "Kinase", uniprotId: "P00533", hgncId: "HGNC:3236", chemblTargetId: "CHEMBL203", curatedSets: ["egfr-resistance"], programDiseaseArea: "Non-Small Cell Lung Cancer", programDiseaseKey: "NSCLC" },
  { gene: "BRAF", name: "Serine/threonine-protein kinase B-raf", targetClass: "Kinase", uniprotId: "P15056", hgncId: "HGNC:1097", chemblTargetId: "CHEMBL5145", programDiseaseArea: "Melanoma", programDiseaseKey: "Melanoma" },
  { gene: "ALK", name: "ALK tyrosine kinase receptor", targetClass: "Kinase", uniprotId: "Q9UM73", hgncId: "HGNC:427", chemblTargetId: "CHEMBL4247", programDiseaseArea: "Non-Small Cell Lung Cancer", programDiseaseKey: "NSCLC" },
  { gene: "PTGS2", name: "Prostaglandin G/H synthase 2", targetClass: "Oxidoreductase", uniprotId: "P35354", hgncId: "HGNC:9605", chemblTargetId: "CHEMBL230", programDiseaseArea: "Inflammation / Pain", programDiseaseKey: "Inflammation" },
  { gene: "BACE1", name: "Beta-secretase 1", targetClass: "Protease", uniprotId: "P56817", hgncId: "HGNC:933", chemblTargetId: "CHEMBL4822", programDiseaseArea: "Alzheimer's Disease", programDiseaseKey: "Alzheimer's" },
  { gene: "JAK2", name: "Tyrosine-protein kinase JAK2", targetClass: "Kinase", uniprotId: "O60674", hgncId: "HGNC:6192", chemblTargetId: "CHEMBL2971", programDiseaseArea: "Myeloproliferative Disorders", programDiseaseKey: "MPN" },
];

export const registryTargets: RegistryTarget[] = seeds.map((s) => {
  const uniprot = `UniProtKB ${s.uniprotId}, verified ${TARGET_REGISTRY_VERIFIED}`;
  return {
    gene: curated(s.gene, uniprot),
    name: curated(s.name, uniprot),
    organism: curated("Homo sapiens", uniprot),
    targetClass: curated(s.targetClass, `${uniprot} (molecular-function keyword)`),
    uniprotId: curated(s.uniprotId, uniprot),
    hgncId: curated(s.hgncId, `${uniprot} (HGNC cross-reference)`),
    chemblTargetId: curated(s.chemblTargetId, `ChEMBL target by UniProt accession, verified ${TARGET_REGISTRY_VERIFIED}`),
    curatedSets: curated(s.curatedSets ?? [], "src/data/curated"),
    programDiseaseArea: demo(s.programDiseaseArea),
    programDiseaseKey: demo(s.programDiseaseKey),
    boardId: demo(boardIdFor(s.gene)),
  };
});

/** Gene symbols: letters, digits and hyphens, starting with a letter (HGNC style). */
export const GENE_SYMBOL = /^[A-Za-z][A-Za-z0-9-]{0,14}$/;

export const findRegistryTarget = (gene: string): RegistryTarget | undefined =>
  registryTargets.find((t) => t.gene.value === gene.toUpperCase());

export const targetHref = (gene: string) => `/targets/${encodeURIComponent(gene.toUpperCase())}`;

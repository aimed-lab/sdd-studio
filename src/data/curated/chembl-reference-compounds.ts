// Curated reference set: values copied from ChEMBL parent molecule records and mechanism data.
// Re-check against ChEMBL when CHEMBL_RELEASE changes. Not demo data.
export const CHEMBL_RELEASE = "ChEMBL_37";
export const CHEMBL_RETRIEVED = "2026-11-15";

export interface ReferenceCompound {
  name: string;
  chemblId: string;
  smiles: string;
  mw: number;
  alogp: number;
  qed: number;
  maxPhase: number;
  /** Gene symbols (or complex names) of ChEMBL mechanism-of-action targets */
  mechanismTargets: string[];
  actionTypes: string[];
}

export const referenceCompounds: ReferenceCompound[] = [
  {
    name: "Vemurafenib",
    chemblId: "CHEMBL1229517",
    smiles: "CCCS(=O)(=O)Nc1ccc(F)c(C(=O)c2c[nH]c3ncc(-c4ccc(Cl)cc4)cc23)c1F",
    mw: 489.93,
    alogp: 5.54,
    qed: 0.33,
    maxPhase: 4.0,
    mechanismTargets: ["BRAF"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Erlotinib",
    chemblId: "CHEMBL553",
    smiles: "C#Cc1cccc(Nc2ncnc3cc(OCCOC)c(OCCOC)cc23)c1",
    mw: 393.44,
    alogp: 3.41,
    qed: 0.42,
    maxPhase: 4.0,
    mechanismTargets: ["EGFR"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Imatinib",
    chemblId: "CHEMBL941",
    smiles: "Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1",
    mw: 493.62,
    alogp: 4.59,
    qed: 0.39,
    maxPhase: 4.0,
    mechanismTargets: ["ABL1", "PDGFRB", "KIT", "BCR-ABL1"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Sorafenib",
    chemblId: "CHEMBL1336",
    smiles: "CNC(=O)c1cc(Oc2ccc(NC(=O)Nc3ccc(Cl)c(C(F)(F)F)c3)cc2)ccn1",
    mw: 464.83,
    alogp: 5.55,
    qed: 0.46,
    maxPhase: 4.0,
    mechanismTargets: ["RAF1", "PDGFRB", "KIT", "FLT3", "BRAF", "Vascular endothelial growth factor receptor", "RET"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Gefitinib",
    chemblId: "CHEMBL939",
    smiles: "COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1",
    mw: 446.91,
    alogp: 4.28,
    qed: 0.52,
    maxPhase: 4.0,
    mechanismTargets: ["EGFR"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Lapatinib",
    chemblId: "CHEMBL554",
    smiles: "CS(=O)(=O)CCNCc1ccc(-c2ccc3ncnc(Nc4ccc(OCc5cccc(F)c5)c(Cl)c4)c3c2)o1",
    mw: 581.07,
    alogp: 6.14,
    qed: 0.18,
    maxPhase: 4.0,
    mechanismTargets: ["ERBB2", "EGFR"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Crizotinib",
    chemblId: "CHEMBL601719",
    smiles: "C[C@@H](Oc1cc(-c2cnn(C3CCNCC3)c2)cnc1N)c1c(Cl)ccc(F)c1Cl",
    mw: 450.35,
    alogp: 5.04,
    qed: 0.53,
    maxPhase: 4.0,
    mechanismTargets: ["MET", "ALK", "ALK-EML4", "ALK-NPM1", "ROS1", "MST1R"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Dabrafenib",
    chemblId: "CHEMBL2028663",
    smiles: "CC(C)(C)c1nc(-c2cccc(NS(=O)(=O)c3c(F)cccc3F)c2F)c(-c2ccnc(N)n2)s1",
    mw: 519.57,
    alogp: 5.36,
    qed: 0.37,
    maxPhase: 4.0,
    mechanismTargets: ["BRAF"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Osimertinib",
    chemblId: "CHEMBL3353410",
    smiles: "C=CC(=O)Nc1cc(Nc2nccc(-c3cn(C)c4ccccc34)n2)c(OC)cc1N(C)CCN(C)C",
    mw: 499.62,
    alogp: 4.51,
    qed: 0.31,
    maxPhase: 4.0,
    mechanismTargets: ["EGFR"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Trametinib",
    chemblId: "CHEMBL2103875",
    smiles: "CC(=O)Nc1cccc(-n2c(=O)n(C3CC3)c(=O)c3c(Nc4ccc(I)cc4F)n(C)c(=O)c(C)c32)c1",
    mw: 615.4,
    alogp: 3.94,
    qed: 0.33,
    maxPhase: 4.0,
    mechanismTargets: ["MAP2K2", "MAP2K1"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Metformin",
    chemblId: "CHEMBL1431",
    smiles: "CN(C)C(=N)NC(=N)N",
    mw: 129.17,
    alogp: -1.03,
    qed: 0.25,
    maxPhase: 4.0,
    mechanismTargets: ["Mitochondrial complex I (NADH dehydrogenase)", "GPD2"],
    actionTypes: ["inhibitor"],
  },
  {
    name: "Thalidomide",
    chemblId: "CHEMBL468",
    smiles: "O=C1CCC(N2C(=O)c3ccccc3C2=O)C(=O)N1",
    mw: 258.23,
    alogp: 0.09,
    qed: 0.72,
    maxPhase: 4.0,
    mechanismTargets: ["CRL4(CRBN) E3 ubiquitin ligase"],
    actionTypes: ["inhibitor"],
  },
];

export const findReferenceCompound = (name: string) =>
  referenceCompounds.find((c) => c.name.toLowerCase() === name.toLowerCase());

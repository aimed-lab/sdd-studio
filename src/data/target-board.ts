export interface BoardTarget {
  id: string;
  name: string;
  type: "Gene" | "Protein" | "RNA" | "DNA" | "Cell";
  disease: string;
  druggability: "High" | "Medium" | "Low";
  validation: string;
  evidence: string;
  status: "Active" | "Paused" | "Completed" | "Discovery";
}

export const boardTargets: BoardTarget[] = [
  { id: "TGT-001", name: "BRAF V600E", type: "Gene", disease: "Melanoma", druggability: "High", validation: "Clinical", evidence: "Terrain2Drug", status: "Active" },
  { id: "TGT-002", name: "MAPT (Tau)", type: "Protein", disease: "Alzheimer's", druggability: "Medium", validation: "Preclinical", evidence: "Terrain2Drug", status: "Active" },
  { id: "TGT-003", name: "JAK2 V617F", type: "Gene", disease: "MPN", druggability: "High", validation: "Clinical", evidence: "Terrain2Drug", status: "Paused" },
  { id: "TGT-004", name: "EGFR T790M", type: "Protein", disease: "NSCLC", druggability: "High", validation: "Clinical", evidence: "Terrain2Drug", status: "Completed" },
  { id: "TGT-005", name: "miR-21", type: "RNA", disease: "Melanoma", druggability: "Medium", validation: "In vitro", evidence: "Paper2Drug", status: "Active" },
  { id: "TGT-006", name: "MALAT1 lncRNA", type: "RNA", disease: "NSCLC", druggability: "Low", validation: "In vitro", evidence: "Paper2Drug", status: "Discovery" },
  { id: "TGT-007", name: "TERT promoter", type: "DNA", disease: "Melanoma", druggability: "Medium", validation: "Preclinical", evidence: "Terrain2Drug", status: "Active" },
  { id: "TGT-008", name: "BRCA1 methylation", type: "DNA", disease: "Breast Cancer", druggability: "Medium", validation: "Clinical", evidence: "Market2Drug", status: "Active" },
  { id: "TGT-009", name: "CD8+ T cells", type: "Cell", disease: "Melanoma", druggability: "High", validation: "Clinical", evidence: "Market2Drug", status: "Active" },
  { id: "TGT-010", name: "Tumor-assoc. macrophages", type: "Cell", disease: "NSCLC", druggability: "Medium", validation: "Preclinical", evidence: "Terrain2Drug", status: "Discovery" },
];

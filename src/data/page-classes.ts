export type DataClass = "live" | "curated" | "demo" | "mixed" | "planned" | "app";

export interface PageClass {
  kind: DataClass;
  /** For mixed pages: what each section is. */
  sections?: { label: string; kind: Exclude<DataClass, "mixed"> }[];
}

// One entry per route. "app" pages hold account, admin or support data, not scientific content.
export const pageClasses: Record<string, PageClass> = {
  "/": { kind: "app" },
  "/search": { kind: "live" },
  "/targets": {
    kind: "mixed",
    sections: [
      { label: "Gene, protein name, organism, class and accession (UniProtKB); reference-compound counts (ChEMBL); EGFR resistance table (PubMed)", kind: "curated" },
      { label: "Target IDs (TGT-…) and program disease areas", kind: "demo" },
    ],
  },
  "/compounds": { kind: "curated" },
  "/clinical/trials": {
    kind: "mixed",
    sections: [
      { label: "Trial Landscape tab (ClinicalTrials.gov)", kind: "live" },
      { label: "Internal trial designs tab", kind: "demo" },
    ],
  },
  "/drug": { kind: "demo" },
  "/pharmacology/candidates": { kind: "demo" },
  "/disease": { kind: "demo" },
  "/disease-biology/target-board": { kind: "demo" },
  "/disease-biology/mechanisms": { kind: "demo" },
  "/disease-biology/perturbation": { kind: "demo" },
  "/disease-biology/decisions": { kind: "demo" },
  "/pharmacology/optimization": { kind: "demo" },
  "/pharmacology/simulations": { kind: "demo" },
  "/pharmacology/decisions": { kind: "demo" },
  "/clinical/cohorts": { kind: "demo" },
  "/clinical/biomarkers": { kind: "demo" },
  "/clinical/decisions": { kind: "demo" },
  "/regulatory/irb": { kind: "demo" },
  "/regulatory/clinical-docs": { kind: "demo" },
  "/regulatory/licensing": { kind: "demo" },
  "/regulatory/business": { kind: "demo" },
  "/regulatory/transactions": { kind: "demo" },
  "/regulatory/decisions": { kind: "demo" },
  "/projects": { kind: "demo" },
  "/projects/performance": { kind: "demo" },
  "/projects/reports": { kind: "demo" },
  "/business": { kind: "demo" },
  "/experiments": { kind: "demo" },
  "/analysis": { kind: "demo" },
  "/design": { kind: "planned" },
  "/models": { kind: "planned" },
  "/services": { kind: "planned" },
  "/plugins": { kind: "planned" },
  "/projects/team": { kind: "app" },
  "/admin": { kind: "app" },
  "/settings": { kind: "app" },
  "/support": { kind: "app" },
  "/security": { kind: "app" },
  "/login": { kind: "app" },
};

export const pageClassFor = (path: string): PageClass | undefined => pageClasses[path];

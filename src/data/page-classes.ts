export type DataClass = "live" | "curated" | "demo" | "mixed" | "planned" | "app" | "project";

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
      { label: "Evidence panel: disease associations and tractability (Open Targets Platform)", kind: "live" },
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
  "/projects": {
    kind: "mixed",
    sections: [
      { label: "Example campaigns (invented) and the developer sandbox (test data)", kind: "demo" },
      { label: "Campaign titles; their data needs the project key", kind: "project" },
    ],
  },
  "/projects/[slug]": {
    kind: "mixed",
    sections: [
      { label: "Example campaigns and the developer sandbox (test data)", kind: "demo" },
      { label: "Campaigns: the lab's own unpublished results, shown to key holders and the signed-in Owner and Admins", kind: "project" },
    ],
  },
  "/projects/demo": { kind: "demo" },
  "/projects/performance": { kind: "demo" },
  "/projects/reports": { kind: "demo" },
  "/business": { kind: "demo" },
  "/experiments": { kind: "demo" },
  "/analysis": { kind: "demo" },
  "/design": { kind: "planned" },
  "/models": { kind: "planned" },
  "/services": { kind: "planned" },
  "/plugins": { kind: "planned" },
  "/targets/[gene]": {
    kind: "mixed",
    sections: [
      { label: "Identity: UniProt, HGNC and ChEMBL target IDs, class (curated registry; HGNC live for other genes)", kind: "curated" },
      { label: "Open Targets evidence, ChEMBL approved drugs and trial searches", kind: "live" },
      { label: "Program fields (members only)", kind: "demo" },
    ],
  },
  "/projects/team": { kind: "app" },
  "/admin": { kind: "app" },
  "/settings": { kind: "app" },
  "/support": { kind: "app" },
  "/security": { kind: "app" },
  "/login": { kind: "app" },
  "/docs": { kind: "app" },
  "/docs/[slug]": { kind: "app" },
};

/** Exact route first, then dynamic routes such as "/targets/[gene]" (one segment per bracket). */
export const pageClassFor = (path: string): PageClass | undefined =>
  pageClasses[path] ??
  Object.entries(pageClasses).find(([route]) => {
    if (!route.includes("[")) return false;
    const re = new RegExp("^" + route.replace(/\[[^\]]+\]/g, "[^/]+") + "$");
    return re.test(path);
  })?.[1];

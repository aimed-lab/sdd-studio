/**
 * ILLUSTRATIVE DEMO FIXTURE for the Projects workspace (Stage 1 of docs/redesign-plan.md).
 *
 * Every project, compound, score, round, file and person below is invented to show the layout.
 * None of it is a result from any real campaign. The types mirror the planned Postgres tables
 * (projects, iterations, artifacts, project_records) so Stage 2 can swap this fixture for real
 * data without changing the UI.
 */

export type Visibility = "private" | "team" | "released";
export type ReleaseState = "draft" | "internal" | "candidate" | "released" | "superseded" | "withdrawn";
export type Sensitivity = "public" | "unpublished" | "confidential";
export type ActorType = "human" | "agent" | "token";
export type IterationSource = "cli" | "agent" | "box-webhook";
export type ArtifactKind =
  | "decision-sheet" | "data" | "figure" | "structure" | "manuscript" | "report" | "app" | "harness" | "log";
export type DecisionFlag = "GO" | "WATCH" | "HOLD" | "NO-GO";
export type DomainFit = "in" | "near" | "out";
export type ProjectRole = "owner" | "developer" | "reviewer" | "viewer";

export interface DemoIteration {
  n: number;
  label: string;
  date: string;
  source: IterationSource;
  actor: ActorType;
  files: number;
  newFiles: number;
  status: "committed" | "open" | "failed";
  summary: string;
}

export interface DemoArtifact {
  path: string;
  kind: ArtifactKind;
  iteration: number;
  sizeKb: number;
  sensitivity: Sensitivity;
  release: ReleaseState;
  actor: ActorType;
  sha: string; // first 12 hex characters (illustrative)
}

export interface DemoRound {
  round: number;
  generator: string;
  candidates: number;
  gateClean: number;
  J: number;
  event: string;
}

export interface DemoCompound {
  id: string;
  lineage: string;
  firstRound: number;
  flag: DecisionFlag;
  action: number;
  candidacy: number;
  goodBinders: number;
  antiBinders: number;
  novelty: "novel" | "near-known" | "known";
  panel: number;
  // Chemical-property report (illustrative values)
  mw: number;
  logP: number;
  tpsa: number;
  hbd: number;
  hba: number;
  qed: number;
  lipinski: number; // rule-of-five violations
  herg: "low" | "medium" | "high";
  domain: DomainFit;
}

export interface DemoTier {
  tag: string;
  label: string;
  count: number;
  state: "pass" | "frontier" | "pending";
}

export interface DemoDocument {
  name: string;
  versions: string[]; // oldest first; the last one is current
}

export interface DemoMember {
  label: string;
  initials: string;
  role: ProjectRole;
}

export interface DemoProject {
  slug: string;
  title: string;
  modality: "small molecule" | "antibody";
  target: string;
  area: string;
  lead: string;
  color: string;
  status: "active" | "archived";
  visibility: Visibility;
  description: string;
  updated: string;
  members: DemoMember[];
  iterations: DemoIteration[];
  artifacts: DemoArtifact[];
  rounds: DemoRound[];
  compounds: DemoCompound[];
  tiers: DemoTier[];
  documents: DemoDocument[];
  decisionRule?: string;
}

const C = (
  id: string, lineage: string, firstRound: number, flag: DecisionFlag, action: number, candidacy: number,
  goodBinders: number, antiBinders: number, novelty: DemoCompound["novelty"], panel: number,
  mw: number, logP: number, tpsa: number, hbd: number, hba: number, qed: number, lipinski: number,
  herg: DemoCompound["herg"], domain: DomainFit,
): DemoCompound => ({
  id, lineage, firstRound, flag, action, candidacy, goodBinders, antiBinders, novelty, panel,
  mw, logP, tpsa, hbd, hba, qed, lipinski, herg, domain,
});

export const DEMO_PROJECTS: DemoProject[] = [
  {
    slug: "example-np-analogs",
    title: "Example campaign A: natural-product analogs",
    modality: "small molecule",
    target: "Example enzyme X",
    area: "Oncology (example)",
    lead: "Example lead",
    color: "#3b4fcc",
    status: "active",
    visibility: "team",
    description:
      "Illustrative small-molecule campaign laid out like a natural-product-analog autoresearch run: rounds of generation, tiered gates, a go/no-go decision sheet and a chemical-property report.",
    updated: "2026-11-14",
    members: [
      { label: "Example lead", initials: "EL", role: "owner" },
      { label: "Developer 1", initials: "D1", role: "developer" },
      { label: "Developer 2", initials: "D2", role: "developer" },
      { label: "Reviewer", initials: "RV", role: "reviewer" },
    ],
    iterations: [
      { n: 12, label: "r012-polar-bioisostere", date: "2026-11-14", source: "cli", actor: "token", files: 41, newFiles: 9, status: "committed", summary: "Polar bioisostere round; decision sheet refreshed." },
      { n: 11, label: "r011-scaffold-hop", date: "2026-11-07", source: "agent", actor: "agent", files: 38, newFiles: 12, status: "committed", summary: "Scaffold hop from two lineages; new figures." },
      { n: 10, label: "r010-fragment-grow", date: "2026-10-31", source: "cli", actor: "token", files: 33, newFiles: 7, status: "committed", summary: "Fragment growing; manuscript v1.3 draft." },
      { n: 9, label: "manual-upload-2026-10-28", date: "2026-10-28", source: "box-webhook", actor: "human", files: 3, newFiles: 3, status: "committed", summary: "Slides dropped into Box by hand; indexed as draft." },
    ],
    artifacts: [
      { path: "Results/r012-polar-bioisostere/tables/decision_sheet.csv", kind: "decision-sheet", iteration: 12, sizeKb: 84, sensitivity: "unpublished", release: "internal", actor: "token", sha: "a41c09e2b7f3" },
      { path: "Results/r012-polar-bioisostere/tables/round_summary.csv", kind: "data", iteration: 12, sizeKb: 3, sensitivity: "unpublished", release: "candidate", actor: "token", sha: "5d2e7a10c9b4" },
      { path: "Results/r012-polar-bioisostere/figures/funnel.png", kind: "figure", iteration: 12, sizeKb: 212, sensitivity: "unpublished", release: "candidate", actor: "token", sha: "e09b3c47d1a8" },
      { path: "Results/r012-polar-bioisostere/structures/top10.sdf", kind: "structure", iteration: 12, sizeKb: 46, sensitivity: "confidential", release: "draft", actor: "token", sha: "7f81a2c6e3d0" },
      { path: "Results/r012-polar-bioisostere/iteration.md", kind: "report", iteration: 12, sizeKb: 5, sensitivity: "unpublished", release: "internal", actor: "token", sha: "c3a9f05e8b12" },
      { path: "Results/r011-scaffold-hop/tables/decision_sheet.csv", kind: "decision-sheet", iteration: 11, sizeKb: 79, sensitivity: "unpublished", release: "superseded", actor: "agent", sha: "2b6d4e91f0a7" },
      { path: "Results/Manuscript/manuscript_v1.3.docx", kind: "manuscript", iteration: 10, sizeKb: 1840, sensitivity: "unpublished", release: "internal", actor: "human", sha: "91e0c7b5a3d6" },
      { path: "Results/Manuscript/manuscript_v1.2.pdf", kind: "manuscript", iteration: 8, sizeKb: 2210, sensitivity: "public", release: "released", actor: "human", sha: "48f2a6d1c0e9" },
      { path: "Plan/HARNESS.md", kind: "harness", iteration: 12, sizeKb: 12, sensitivity: "unpublished", release: "internal", actor: "agent", sha: "0d7c3b9e5f21" },
    ],
    rounds: [
      { round: 1, generator: "Seed library", candidates: 1200, gateClean: 64, J: 41.2, event: "Baseline" },
      { round: 2, generator: "Fragment growing", candidates: 900, gateClean: 71, J: 44.0, event: "" },
      { round: 3, generator: "Fragment growing", candidates: 850, gateClean: 80, J: 47.5, event: "" },
      { round: 4, generator: "Scaffold hop", candidates: 1000, gateClean: 58, J: 46.1, event: "Gate tightened (toxicity)" },
      { round: 5, generator: "Matched pairs", candidates: 640, gateClean: 73, J: 50.3, event: "" },
      { round: 6, generator: "Matched pairs", candidates: 610, gateClean: 77, J: 52.8, event: "" },
      { round: 7, generator: "Scaffold hop", candidates: 980, gateClean: 69, J: 53.4, event: "Lineage L3 opened" },
      { round: 8, generator: "Polar bioisostere", candidates: 720, gateClean: 88, J: 56.0, event: "Manuscript v1.2" },
      { round: 9, generator: "Polar bioisostere", candidates: 700, gateClean: 91, J: 57.9, event: "" },
      { round: 10, generator: "Fragment growing", candidates: 820, gateClean: 84, J: 58.4, event: "" },
      { round: 11, generator: "Scaffold hop", candidates: 940, gateClean: 79, J: 59.1, event: "Expert panel review" },
      { round: 12, generator: "Polar bioisostere", candidates: 760, gateClean: 96, J: 61.7, event: "Decision sheet v4" },
    ],
    compounds: [
      C("EX-A-0012", "L1", 3, "GO", 8.6, 82.4, 7, 0, "novel", 5, 342.4, 2.1, 88.3, 2, 6, 0.71, 0, "low", "in"),
      C("EX-A-0047", "L1", 5, "GO", 8.1, 79.0, 6, 0, "novel", 4, 356.4, 2.4, 82.1, 2, 6, 0.68, 0, "low", "in"),
      C("EX-A-0103", "L2", 6, "GO", 7.7, 76.3, 6, 1, "near-known", 4, 389.5, 2.9, 74.6, 1, 6, 0.64, 0, "low", "in"),
      C("EX-A-0158", "L3", 8, "WATCH", 6.9, 71.8, 5, 1, "novel", 3, 412.5, 3.4, 69.0, 1, 7, 0.58, 0, "medium", "near"),
      C("EX-A-0161", "L3", 8, "WATCH", 6.5, 69.2, 5, 2, "novel", 3, 428.5, 3.7, 63.2, 1, 7, 0.55, 0, "medium", "near"),
      C("EX-A-0204", "L2", 9, "WATCH", 6.2, 66.0, 4, 1, "near-known", 3, 377.4, 1.6, 101.9, 3, 7, 0.61, 0, "low", "in"),
      C("EX-A-0233", "L4", 10, "HOLD", 5.4, 61.5, 4, 2, "novel", 2, 468.6, 4.3, 58.4, 1, 6, 0.47, 0, "medium", "near"),
      C("EX-A-0251", "L1", 10, "HOLD", 5.1, 58.9, 3, 1, "known", 2, 330.4, 1.9, 92.7, 2, 6, 0.66, 0, "low", "in"),
      C("EX-A-0290", "L4", 11, "HOLD", 4.8, 55.2, 3, 2, "novel", 2, 502.6, 4.9, 54.1, 1, 8, 0.39, 1, "high", "out"),
      C("EX-A-0318", "L3", 12, "NO-GO", 3.6, 47.4, 2, 3, "novel", 1, 521.7, 5.4, 49.8, 0, 8, 0.31, 2, "high", "out"),
      C("EX-A-0322", "L2", 12, "NO-GO", 3.1, 44.0, 2, 2, "known", 1, 298.3, 0.8, 121.4, 4, 8, 0.52, 0, "low", "near"),
      C("EX-A-0327", "L4", 12, "NO-GO", 2.7, 40.6, 1, 4, "near-known", 0, 486.6, 4.6, 61.0, 1, 7, 0.36, 0, "high", "out"),
    ],
    tiers: [
      { tag: "T0", label: "Structure sanity", count: 10140, state: "pass" },
      { tag: "T1", label: "Property gates", count: 4210, state: "pass" },
      { tag: "T2", label: "Liability filters", count: 1980, state: "pass" },
      { tag: "T3", label: "Docking consensus", count: 640, state: "pass" },
      { tag: "T4", label: "Selectivity panel", count: 212, state: "pass" },
      { tag: "T5", label: "Expert panel", count: 48, state: "frontier" },
      { tag: "T6", label: "Ready to make", count: 12, state: "pending" },
    ],
    documents: [
      { name: "Manuscript", versions: ["v1.0", "v1.1", "v1.2", "v1.3"] },
      { name: "Supplement", versions: ["v1.0", "v1.2"] },
      { name: "Word (.docx)", versions: ["v1.3"] },
    ],
    decisionRule:
      "Illustrative rule: GO when candidacy ≥ 75 with no anti-target binders; WATCH 65–75; HOLD 50–65 or applicability domain near/out; NO-GO below 50. Auto-proposed flags are confirmed by a person.",
  },
  {
    slug: "example-antibody",
    title: "Example campaign B: antibody prioritisation",
    modality: "antibody",
    target: "Example antigen Y",
    area: "Women's health (example)",
    lead: "Example lead",
    color: "#0f766e",
    status: "active",
    visibility: "private",
    description:
      "Illustrative antibody campaign: iterations of repertoire triage, structure models and assay summaries. It shows that the workspace also fits projects without a small-molecule decision sheet.",
    updated: "2026-11-12",
    members: [
      { label: "Example lead", initials: "EL", role: "owner" },
      { label: "Developer 1", initials: "D1", role: "developer" },
      { label: "Viewer", initials: "VW", role: "viewer" },
    ],
    iterations: [
      { n: 3, label: "it03-structure-models", date: "2026-11-12", source: "agent", actor: "agent", files: 22, newFiles: 6, status: "committed", summary: "Structure models for the top 6 clones." },
      { n: 2, label: "it02-triage", date: "2026-11-05", source: "cli", actor: "token", files: 16, newFiles: 10, status: "committed", summary: "Repertoire triage table and assay plots." },
      { n: 1, label: "it01-handoff", date: "2026-10-30", source: "box-webhook", actor: "human", files: 19, newFiles: 19, status: "committed", summary: "Data hand-off package indexed from Box." },
    ],
    artifacts: [
      { path: "Results/it03-structure-models/structures/clone_models.zip", kind: "structure", iteration: 3, sizeKb: 5120, sensitivity: "confidential", release: "draft", actor: "agent", sha: "6a0e2f9c4b17" },
      { path: "Results/it02-triage/tables/triage.csv", kind: "data", iteration: 2, sizeKb: 410, sensitivity: "unpublished", release: "internal", actor: "token", sha: "f3b1d8e07c52" },
      { path: "Results/it02-triage/figures/assay_plots.png", kind: "figure", iteration: 2, sizeKb: 640, sensitivity: "unpublished", release: "internal", actor: "token", sha: "9c47a0e3b6d1" },
      { path: "Data/handoff_manifest.csv", kind: "data", iteration: 1, sizeKb: 2, sensitivity: "unpublished", release: "internal", actor: "human", sha: "1e8d5c2a7f90" },
    ],
    rounds: [],
    compounds: [],
    tiers: [],
    documents: [{ name: "Work plan", versions: ["v0.1", "v0.2"] }],
  },
];

export const demoProject = (slug: string) => DEMO_PROJECTS.find((p) => p.slug === slug);

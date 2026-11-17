// Shared by the server page and the client workspace, so it must not live in a "use client" module.
export const PROJECT_VIEWS = [
  "overview", "funnel", "decision", "rounds", "properties", "iterations", "artifacts", "release", "team",
] as const;
export type ProjectView = (typeof PROJECT_VIEWS)[number];

export const parseProjectView = (v: string | undefined): ProjectView =>
  (PROJECT_VIEWS as readonly string[]).includes(v ?? "") ? (v as ProjectView) : "overview";

// Views of a project stored in Studio's database (today the developer sandbox).
export const LIVE_VIEWS = ["overview", "tables", "iterations", "artifacts", "tokens"] as const;
export type LiveView = (typeof LIVE_VIEWS)[number];

export const parseLiveView = (v: string | undefined): LiveView =>
  (LIVE_VIEWS as readonly string[]).includes(v ?? "") ? (v as LiveView) : "overview";

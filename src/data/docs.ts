// In-app documentation (/docs). Each page renders a markdown file from this repository, so the
// repository stays the single source. Only pages that were written or checked recently are listed;
// older files in docs/ that describe superseded behaviour are left out until they are updated.

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: "Start here" | "Developers" | "Reference";
  /** Path from the repository root. */
  file: string;
  /** Optional: render only from this heading line (inclusive) up to `until` (exclusive). */
  from?: string;
  until?: string;
}

export const DOC_PAGES: DocPage[] = [
  {
    slug: "members-and-invitations",
    title: "Members and invitations",
    description: "Joining with a personal code, inviting people, roles, and removing access.",
    section: "Start here",
    file: "docs/members-and-invitations.md",
  },
  {
    slug: "ai-agents",
    title: "AI agents and usage limits",
    description: "The Literature Mining and Clinical Trial Feasibility agents, run records, the lab budget and using your own Anthropic key.",
    section: "Start here",
    file: "docs/ai-agents.md",
  },
  {
    slug: "developer-guide",
    title: "Developer guide",
    description: "Push iterations to the developer sandbox with sdd.mjs: tokens, folder layout, commands, limits.",
    section: "Developers",
    file: "docs/developer-guide.md",
  },
  {
    slug: "agent-workflow",
    title: "Agent workflow",
    description: "The skill an AI agent follows to write and push iteration results.",
    section: "Developers",
    file: "skills/sdd-studio-push/SKILL.md",
  },
  {
    slug: "projects-api",
    title: "Projects API and sdd tool",
    description: "Endpoints, push format, limits and tables behind the developer sandbox.",
    section: "Reference",
    file: "docs/projects-api.md",
  },
  {
    slug: "data-api",
    title: "Data API",
    description: "The public read-only API for ChEMBL, ClinicalTrials.gov and Open Targets, and the MCP endpoint.",
    section: "Reference",
    file: "docs/api-reference.md",
    // Only the public part; the rest of that file covers internal endpoints.
    from: "## Read-only JSON API",
    until: "## POST /api/assistant",
  },
  {
    slug: "projects-plan",
    title: "Projects plan",
    description: "The approved plan for the Projects workspace, stage by stage.",
    section: "Reference",
    file: "docs/redesign-plan.md",
  },
];

export const DOC_SECTIONS = ["Start here", "Developers", "Reference"] as const;

export const docPage = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);

export const GITHUB_BLOB = "https://github.com/aimed-lab/sdd-studio/blob/main/";

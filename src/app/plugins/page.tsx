"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataClassBadge } from "@/components/data-provenance";
import { cn } from "@/lib/utils";

// Only integrations that work today are listed, each checked by hand against the live service on CHECKED.
// A setup step is marked `tested` only if it was run exactly as written. Re-check before changing a date.
const CHECKED = "17 November 2026";
const STUDIO = "https://studio.smartdrugdiscovery.org";
const MCP_URL = `${STUDIO}/api/mcp`;
const RAW = "https://raw.githubusercontent.com/aimed-lab/sdd-studio/main";
const REPO = "https://github.com/aimed-lab/sdd-studio/blob/main";
const BIO_PLUGIN = "https://github.com/anthropics/knowledge-work-plugins/tree/main/bio-research";
const BIO_PLUGIN_MCP = "https://github.com/anthropics/knowledge-work-plugins/blob/main/bio-research/.mcp.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type Kind = "MCP server" | "REST API" | "Command-line tool" | "Agent skill";
type Access = "open" | "token";

interface Step {
  title: string;
  code?: string;
  note?: string;
  /** Run exactly as written on CHECKED. */
  tested: boolean;
}

interface Integration {
  id: string;
  name: string;
  kind: Kind;
  thirdParty?: { by: string };
  summary: string;
  access: Access;
  accessText: string;
  tools?: { name: string; what: string }[];
  steps: Step[];
  limits: string[];
  links: { label: string; href: string }[];
}

// ── Studio's own integrations ──────────────────────────────────────────────────

const STUDIO_ITEMS: Integration[] = [
  {
    id: "sdd-studio-mcp",
    name: "SDD Studio MCP endpoint",
    kind: "MCP server",
    summary:
      "Read-only MCP server for the public data Studio shows. Each tool runs the same handler as its REST route, with the same validation, caching and provenance; it never returns demo data. Not listed in public MCP registries: share the URL directly.",
    access: "open",
    accessText: "Open: no sign-in, no key",
    tools: [
      { name: "search_compounds", what: "ChEMBL molecules by name, synonym or ChEMBL ID, or a batch of up to 50 IDs" },
      { name: "get_compound", what: "Mechanisms of action and bioactivity rows for one ChEMBL ID" },
      { name: "search_trials", what: "ClinicalTrials.gov studies, 25 per page, with gene-symbol disambiguation" },
      { name: "structure_search", what: "ChEMBL similarity or substructure search by SMILES" },
      { name: "get_target_evidence", what: "Open Targets disease associations and tractability for one gene" },
    ],
    steps: [
      {
        title: "Claude Code",
        code: `claude mcp add --transport http sdd-studio ${MCP_URL}`,
        note: "Add --scope project to write a shared .mcp.json in your repository instead. Check with: claude mcp list",
        tested: true,
      },
      {
        title: "Claude Desktop or claude.ai",
        note: "Settings → Connectors → Add → Add custom connector, then paste the URL above (steps from the MCP documentation's remote-server guide; the desktop config file is for local servers). Not yet tried by us.",
        tested: false,
      },
      {
        title: "Any MCP client, or a quick test",
        code: `curl -s ${MCP_URL} \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
        note: "Streamable HTTP, stateless, JSON only. Send POST; the Accept header must list both types.",
        tested: true,
      },
    ],
    limits: [
      "20 requests at once, then 1 every 3 s (20 per minute), per IP address and per server instance; every POST counts",
      "15 s per call; slow substructure searches can run out of time",
      "Over the limit: HTTP 429 with Retry-After",
    ],
    links: [
      { label: "Docs: MCP endpoint", href: "/docs/mcp-endpoint" },
      { label: "Source", href: `${REPO}/src/app/api/mcp/route.ts` },
    ],
  },
  {
    id: "sdd-data-api",
    name: "SDD Studio data API and OpenAPI spec",
    kind: "REST API",
    summary:
      "Read-only JSON routes for ChEMBL, ClinicalTrials.gov and Open Targets, each response with a source block (upstream, query URL, retrieval time, data release). /openapi.json (OpenAPI 3.1) describes /api/search, /api/compound/{chemblId}, /api/trials and /api/target-evidence and is contract-tested against production every night. /api/structure works but is not in the spec yet.",
    access: "open",
    accessText: "Open: no sign-in, no key",
    steps: [
      {
        title: "Call a route",
        code: `curl -s "${STUDIO}/api/search?q=imatinib&limit=1"`,
        tested: true,
      },
      {
        title: "Give an agent framework the spec",
        code: `curl -s ${STUDIO}/openapi.json`,
        tested: true,
      },
    ],
    limits: [
      "Per IP and server instance: /api/search and /api/trials 60 at once then 1 per second; /api/compound 15 then 1 every 4 s; /api/target-evidence 20 then 1 every 3 s; /api/structure 10 then 1 every 6 s",
      "Over the limit: HTTP 429 with Retry-After",
      "No CORS: browser calls from other websites are blocked; scripts and servers are not affected",
      "Unauthenticated and may change; not a versioned API",
    ],
    links: [
      { label: "Docs: Data API", href: "/docs/data-api" },
      { label: "openapi.json", href: `${STUDIO}/openapi.json` },
    ],
  },
  {
    id: "sdd-cli",
    name: "sdd push tool (sdd.mjs)",
    kind: "Command-line tool",
    summary:
      "One file, Node 18 or later, no install. Pushes a project iteration to Studio: each file's path, checksum, size and kind, plus the summary tables you declare (CSV or TSV). File contents are not uploaded. Also shows a project's iterations.",
    access: "token",
    accessText: "Download and sandbox status: open. Pushing: a push token (sandbox) or a project push key (campaigns)",
    steps: [
      {
        title: "Download and set up a project folder",
        code: `curl -O ${RAW}/tools/sdd-cli/sdd.mjs\nnode sdd.mjs init --project sandbox\nnode sdd.mjs status`,
        tested: true,
      },
      {
        title: "Check what would be sent",
        code: "node sdd.mjs push --label r001-first-try --dir Results/r001-first-try --dry-run",
        note: "Tested as a dry run, which sends nothing and needs no token.",
        tested: true,
      },
      {
        title: "Push",
        code: "export SDD_PROJECT_TOKEN=sdd_pt_...\nnode sdd.mjs push --label r001-first-try --dir Results/r001-first-try",
        note: "Create the token in Studio under Projects → Developer sandbox → Push tokens; it is shown once. The sandbox accepts test data only. Campaign push keys come from the platform owner.",
        tested: false,
      },
    ],
    limits: [
      "Sandbox: 4 MB per request; 2,000 files and 10 tables per push; 5,000 rows per table",
      "30 pushes per token per hour; 300 per project per day",
      "The sandbox keeps the latest 20 iterations and accepts files marked test only",
    ],
    links: [
      { label: "Docs: Developer guide", href: "/docs/developer-guide" },
      { label: "Docs: Projects API", href: "/docs/projects-api" },
      { label: "Source", href: `${REPO}/tools/sdd-cli/sdd.mjs` },
    ],
  },
  {
    id: "sdd-studio-push-skill",
    name: "sdd-studio-push agent skill",
    kind: "Agent skill",
    summary:
      "Instructions a Claude Code agent follows after each computational run: lay out the iteration folder, write iteration.md, label predictions as in-silico, push with sdd.mjs --agent, and log the push. It never releases anything; release is a human step in Studio.",
    access: "token",
    accessText: "File: open. Pushing: the same token or key as sdd.mjs",
    steps: [
      {
        title: "Add it to a project folder (Claude Code)",
        code: `mkdir -p .claude/skills/sdd-studio-push\ncurl -o .claude/skills/sdd-studio-push/SKILL.md \\\n  ${RAW}/skills/sdd-studio-push/SKILL.md`,
        note: "Claude Code then lists sdd-studio-push among its skills. Put it under ~/.claude/skills/ instead to use it in every project.",
        tested: true,
      },
    ],
    limits: ["Needs sdd.mjs and sdd.project.json in the project folder"],
    links: [
      { label: "Docs: Agent workflow", href: "/docs/agent-workflow" },
      { label: "Source", href: `${REPO}/skills/sdd-studio-push/SKILL.md` },
    ],
  },
];

// ── Third-party services ───────────────────────────────────────────────────────

const THIRD_PARTY_ITEMS: Integration[] = [
  {
    id: "clinicaltrials-api",
    name: "ClinicalTrials.gov API v2",
    kind: "REST API",
    thirdParty: { by: "U.S. National Library of Medicine" },
    summary:
      "The public trial registry API that Studio itself calls for /api/trials, the search_trials tool and the Trial Landscape tab. Use it directly for fields Studio does not return.",
    access: "open",
    accessText: "Open: no key",
    steps: [
      {
        title: "Search studies",
        code: 'curl -s "https://clinicaltrials.gov/api/v2/studies?query.term=EGFR&pageSize=1&fields=NCTId,BriefTitle"',
        tested: true,
      },
      {
        title: "API version and data date",
        code: "curl -s https://clinicaltrials.gov/api/v2/version",
        tested: true,
      },
    ],
    limits: ["ClinicalTrials.gov's API pages state no rate limit; through Studio, /api/trials allows 60 at once then 1 per second"],
    links: [
      { label: "ClinicalTrials.gov API docs", href: "https://clinicaltrials.gov/data-api/api" },
      { label: "Docs: Studio's /api/trials", href: "/docs/data-api#get-apitrials" },
    ],
  },
  {
    id: "chembl-mcp",
    name: "ChEMBL MCP server",
    kind: "MCP server",
    thirdParty: { by: "listed as deepsense.ai in Anthropic's bio-research plugin" },
    summary:
      "Hosted MCP server for ChEMBL, including bioactivity by target and ADMET-related properties that Studio's tools do not return. Studio does not use it; Studio calls the ChEMBL REST API directly.",
    access: "open",
    accessText: "Open: no sign-in (checked from Claude Code)",
    tools: ["compound_search", "drug_search", "target_search", "get_bioactivity", "get_mechanism", "get_admet"].map((name) => ({ name, what: "" })),
    steps: [
      { title: "Claude Code", code: "claude mcp add --transport http chembl https://hcls.mcp.claude.com/chembl/mcp", tested: true },
    ],
    limits: ["No rate limit published by the plugin"],
    links: [
      { label: "Plugin .mcp.json (URL source)", href: BIO_PLUGIN_MCP },
      { label: "Docs: Other MCP servers", href: "/docs/mcp-endpoint#other-mcp-servers-for-drug-discovery" },
    ],
  },
  {
    id: "open-targets-mcp",
    name: "Open Targets Platform MCP server",
    kind: "MCP server",
    thirdParty: { by: "Open Targets" },
    summary:
      "Open Targets' own MCP server: entity search and free-form GraphQL queries against the Open Targets Platform. Its README marks it experimental. Studio does not use it; Studio's get_target_evidence runs one fixed GraphQL query itself.",
    access: "open",
    accessText: "Open: no sign-in (checked from Claude Code)",
    tools: [
      "search_entities", "query_open_targets_graphql", "batch_query_open_targets_graphql",
      "get_open_targets_graphql_schema", "get_type_dependencies",
    ].map((name) => ({ name, what: "" })),
    steps: [
      { title: "Claude Code", code: "claude mcp add --transport http open-targets https://mcp.platform.opentargets.org/mcp", tested: true },
    ],
    limits: ["No rate limit published for the hosted service"],
    links: [
      { label: "Source (Apache-2.0)", href: "https://github.com/opentargets/platform-mcp" },
      { label: "Docs: Other MCP servers", href: "/docs/mcp-endpoint#other-mcp-servers-for-drug-discovery" },
    ],
  },
  {
    id: "pubmed-mcp",
    name: "PubMed MCP server",
    kind: "MCP server",
    thirdParty: { by: "listed as the U.S. National Library of Medicine in Anthropic's bio-research plugin" },
    summary: "Hosted MCP server for PubMed: article search, metadata and related articles. Studio does not use it.",
    access: "open",
    accessText: "Open: no sign-in (checked from Claude Code)",
    tools: [
      "search_articles", "get_article_metadata", "get_full_text_article", "find_related_articles",
      "lookup_article_by_citation", "convert_article_ids", "get_copyright_status",
    ].map((name) => ({ name, what: "" })),
    steps: [
      { title: "Claude Code", code: "claude mcp add --transport http pubmed https://pubmed.mcp.claude.com/mcp", tested: true },
    ],
    limits: ["No rate limit published by the plugin"],
    links: [
      { label: "Plugin .mcp.json (URL source)", href: BIO_PLUGIN_MCP },
      { label: "Docs: Other MCP servers", href: "/docs/mcp-endpoint#other-mcp-servers-for-drug-discovery" },
    ],
  },
];

// ── Small pieces ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="absolute right-2 top-2 rounded-md border border-input bg-background/90 px-2 py-1 text-[10px] font-medium hover:bg-muted"
      aria-label="Copy to clipboard"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function A({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:/.test(href);
  const cls = "inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Calls tools/list on this deployment's MCP endpoint from the browser and shows what came back. */
function LiveToolsCheck() {
  const [state, setState] = useState<
    { status: "idle" | "running" } | { status: "ok"; tools: string[]; ms: number } | { status: "error"; message: string }
  >({ status: "idle" });

  const run = async () => {
    setState({ status: "running" });
    const started = performance.now();
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.result?.tools) {
        setState({ status: "error", message: body?.error?.message ?? body?.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ status: "ok", tools: body.result.tools.map((t: { name: string }) => t.name), ms: Math.round(performance.now() - started) });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={state.status === "running"}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {state.status === "running" ? "Asking the endpoint…" : "List tools now"}
        </button>
        <span className="text-xs text-muted-foreground">Sends a real tools/list request to this site&apos;s /api/mcp (counts toward your rate limit).</span>
      </div>
      <div aria-live="polite" className="mt-2 text-xs">
        {state.status === "ok" && (
          <p>
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {state.tools.length} tools returned in {state.ms} ms:
            </span>{" "}
            <span className="font-mono">{state.tools.join(", ")}</span>
          </p>
        )}
        {state.status === "error" && <p className="text-red-700 dark:text-red-400">The endpoint did not answer: {state.message}</p>}
      </div>
    </div>
  );
}

function IntegrationCard({ item }: { item: Integration }) {
  return (
    <Card id={item.id} className="scroll-mt-20 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{item.kind}</span>
          {item.thirdParty ? (
            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300">
              Third-party
            </span>
          ) : (
            <span className="rounded-full border border-sky-300 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:border-sky-700 dark:text-sky-300">
              Run by SDD Studio
            </span>
          )}
        </div>
        <CardTitle className="pt-1 text-base leading-snug">{item.name}</CardTitle>
        {item.thirdParty && <p className="text-xs text-muted-foreground">By {item.thirdParty.by}. Not run by this site.</p>}
        <CardDescription className="text-xs leading-relaxed">{item.summary}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <p
          className={cn(
            "rounded-md px-2.5 py-1.5 text-xs",
            item.access === "open"
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
          )}
        >
          <span className="font-semibold">Who can use it: </span>
          {item.accessText}
        </p>

        {item.tools && (
          <div>
            <p className="mb-1 text-xs font-medium">Tools ({item.tools.length})</p>
            {item.tools.some((t) => t.what) ? (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {item.tools.map((t) => (
                  <li key={t.name}>
                    <span className="font-mono text-foreground">{t.name}</span> — {t.what}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-wrap gap-1">
                {item.tools.map((t) => (
                  <span key={t.name} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          <p className="text-xs font-medium">Set up</p>
          {item.steps.map((s) => (
            <div key={s.title} className="space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{s.title}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0 text-[10px]",
                    s.tested ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                  )}
                >
                  {s.tested ? `Tested ${CHECKED}` : "Not tested by us"}
                </span>
              </p>
              {s.code && (
                <div className="relative">
                  <pre className="overflow-x-auto whitespace-pre rounded-md border bg-muted/60 px-3 py-2 pr-16 font-mono text-[11px] leading-relaxed">
                    {s.code}
                  </pre>
                  <CopyButton text={s.code} />
                </div>
              )}
              {s.note && <p className="text-xs leading-relaxed text-muted-foreground">{s.note}</p>}
            </div>
          ))}
        </div>

        {item.id === "sdd-studio-mcp" && <LiveToolsCheck />}

        <div>
          <p className="mb-1 text-xs font-medium">Limits</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {item.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
          {item.links.map((l) => (
            <A key={l.href} href={l.href}>
              {l.label}
            </A>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PluginsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold">Tool Plugins</h1>
        <p className="mt-2 text-muted-foreground">
          Ways to use Studio&apos;s data from your own AI tools and scripts. Only integrations that work today are listed. Each
          was checked against the live service on {CHECKED}; a setup step marked &ldquo;Tested&rdquo; was run exactly as
          shown.
        </p>
      </header>

      <section aria-labelledby="studio-heading" className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="studio-heading" className="text-xl font-semibold">
            From SDD Studio
          </h2>
          <DataClassBadge kind="live" size="sm" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {STUDIO_ITEMS.map((item) => (
            <IntegrationCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section aria-labelledby="third-party-heading" className="mb-10">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 id="third-party-heading" className="text-xl font-semibold">
            Third-party services
          </h2>
          <DataClassBadge kind="curated" size="sm" />
        </div>
        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">
          Run by others. The three MCP servers are the ones Anthropic&apos;s{" "}
          <a href={BIO_PLUGIN} target="_blank" rel="noopener noreferrer" className="underline">
            bio-research plugin
          </a>{" "}
          for Claude configures, alongside others. Studio does not monitor them and cannot vouch for their availability or
          results.
        </p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {THIRD_PARTY_ITEMS.map((item) => (
            <IntegrationCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section aria-labelledby="planned-heading" className="max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 id="planned-heading" className="text-xl font-semibold">
            Planned
          </h2>
          <DataClassBadge kind="planned" size="sm" />
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Project tools on the MCP endpoint, for authenticated callers only</span>{" "}
            (list projects, query records, push a draft iteration; every call audited). Proposed as Stage 5 of the{" "}
            <Link href="/docs/projects-plan" className="underline">
              Projects plan
            </Link>{" "}
            for the owner&apos;s review. Not built.
          </li>
        </ul>
      </section>
    </div>
  );
}

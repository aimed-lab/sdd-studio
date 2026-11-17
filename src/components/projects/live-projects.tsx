"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectDataNotice } from "@/components/data-provenance";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ActorBadge, Badge, DataTable, Panel, ReleaseBadge, Stats, type Column } from "@/components/projects/vault-ui";
import type { ReleaseState } from "@/data/projects-demo";
import type { LiveView } from "@/components/projects/views";
import { LiveTable } from "@/components/projects/live-table";
import { clearProjectKey, getProjectKey, keyHeaders, setProjectKey } from "@/components/projects/project-key";

// ── API shapes (GET /api/v1/projects/…) ──────────────────────────────────────

interface LiveProjectSummary { slug: string; title: string; description: string | null; kind: string; open: boolean; iterations: number | null; latestAt: string | null }
interface LiveIteration { n: number; label: string; source: string; actorType: string; gitSha: string | null; summary: string | null; files: number; newFiles: number; status: string; createdAt: string }
interface LiveArtifact { iteration: number; path: string; kind: string; sha256: string; size: number; sensitivity: string; release: string; actorType: string }
interface LiveTable { name: string; iteration: number; rows: number; expectedRows: number | null }
interface LiveProject {
  project: { slug: string; title: string; description: string | null; kind: string };
  iterations: LiveIteration[];
  artifacts: LiveArtifact[];
  tables: LiveTable[];
}


const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const sizeText = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

function SensitivityTag({ value }: { value: string }) {
  const tone = value === "test" ? "yellow" : value === "public" ? "green" : value === "confidential" ? "red" : "violet";
  return <Badge tone={tone}>{value}</Badge>;
}

// ── Cards on /projects ────────────────────────────────────────────────────────

export function LiveProjectCards() {
  const [projects, setProjects] = useState<LiveProjectSummary[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/v1/projects")
      .then((r) => r.json())
      .then((d) => (d.ok ? setProjects(d.projects) : setError(true)))
      .catch(() => setError(true));
  }, []);
  if (error) return <p className="vx-faint" style={{ fontSize: 12 }}>Live projects could not be loaded right now.</p>;
  if (!projects) return <p className="vx-faint" style={{ fontSize: 12 }}>Loading live projects…</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <Link key={p.slug} href={`/projects/${p.slug}`} className="vx-card" aria-disabled={!p.open}>
          <div className="vx-card-stripe" style={{ background: p.kind === "sandbox" ? "#b45309" : "#3b4fcc" }} />
          <div style={{ padding: "14px 16px" }} className="space-y-2">
            <strong style={{ fontSize: 14.5 }}>{p.title}</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.kind === "sandbox" ? <Badge tone="yellow">sandbox · test data only</Badge> : <Badge tone="accent">campaign</Badge>}
              {!p.open && <Badge title="Ask the platform owner for this project's key">needs a project key</Badge>}
            </div>
            {p.description && <p className="vx-muted" style={{ fontSize: 12.5 }}>{p.description}</p>}
          </div>
          {p.open && (
            <div className="vx-mini" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div><strong>{p.iterations}</strong><span>iterations</span></div>
              <div><strong style={{ fontSize: 13 }}>{day(p.latestAt)}</strong><span>latest push</span></div>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

// ── Workspace for a live project ──────────────────────────────────────────────

export function LiveProjectWorkspace({ slug, view, table }: { slug: string; view: LiveView; table: string | null }) {
  const [data, setData] = useState<LiveProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    setError(null);
    setNeedsKey(false);
    setHasKey(!!getProjectKey(slug));
    fetch(`/api/v1/projects/${encodeURIComponent(slug)}`, { headers: keyHeaders(slug) })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (d.needsKey) setNeedsKey(true);
        else if (!d.ok) setError(d.error || `HTTP ${r.status}`);
        else setData(d);
      })
      .catch(() => setError("Could not reach Studio."));
  }, [slug, reloadKey]);

  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [view, table, data]);

  if (needsKey) {
    return (
      <KeyGate
        slug={slug}
        hadKey={hasKey}
        onSaved={() => setReloadKey((k) => k + 1)}
      />
    );
  }
  if (error) {
    return (
      <div className="vx-wrap">
        <h1 className="vx-h1">Project unavailable</h1>
        <p className="vx-lede">{error}</p>
        <Link href="/projects">Back to projects</Link>
      </div>
    );
  }
  if (!data) return <div className="vx-wrap vx-faint">Loading project…</div>;

  const p = data.project;
  const href = (v: LiveView, t?: string) => (v === "overview" ? `/projects/${slug}` : `/projects/${slug}?view=${v}${t ? `&table=${t}` : ""}`);
  const current = (v: LiveView, t?: string) => (view === v && (t === undefined || t === table) ? "page" : undefined);

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-4 pt-3 md:px-5">{p.kind === "sandbox" ? <SandboxNotice /> : <ProjectDataNotice />}</div>
      <div className="vx-topbar">
        <Link href="/projects" className="vx-topbar-sub" style={{ color: "var(--vx-text-faint)" }}>Projects</Link>
        <span className="vx-topbar-sub" aria-hidden>/</span>
        <span className="vx-topbar-title">{p.title}</span>
        <span style={{ flex: 1 }} />
        {p.kind === "sandbox" && <Badge tone="yellow" title="Developers push test data here. Nothing on this page is a result.">Sandbox · test data</Badge>}
        {p.kind !== "sandbox" && <Badge tone="violet" title="Unpublished project data. Do not share outside the team.">Campaign · unpublished</Badge>}
        <button type="button" className="vx-btn" onClick={() => setReloadKey((k) => k + 1)}>Refresh</button>
        {hasKey && p.kind !== "sandbox" && (
          <button type="button" className="vx-btn" title="Remove this project's key from this browser" onClick={() => { clearProjectKey(slug); setData(null); setReloadKey((k) => k + 1); }}>
            Forget key
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav ref={navRef} aria-label="Project sections" className="vx-sidenav">
          <div className="vx-nav-label">Project</div>
          <Link href={href("overview")} className="vx-nav-item" aria-current={current("overview")}>Overview</Link>
          <div className="vx-nav-label">Tables</div>
          {data.tables.length === 0 && <span className="vx-nav-item" aria-disabled="true">No tables yet</span>}
          {data.tables.map((t) => (
            <Link key={t.name} href={href("tables", t.name)} className="vx-nav-item" aria-current={current("tables", t.name)}>
              {t.name}<span className="vx-nav-badge" title={t.expectedRows != null && t.rows < t.expectedRows ? "Upload not finished" : undefined}>{t.expectedRows != null && t.rows < t.expectedRows ? `${t.rows}/${t.expectedRows}` : t.rows}</span>
            </Link>
          ))}
          <div className="vx-nav-label">Data</div>
          <Link href={href("iterations")} className="vx-nav-item" aria-current={current("iterations")}>
            Iterations<span className="vx-nav-badge">{data.iterations.length}</span>
          </Link>
          <Link href={href("artifacts")} className="vx-nav-item" aria-current={current("artifacts")}>
            Artifacts<span className="vx-nav-badge">{data.artifacts.length}</span>
          </Link>
          <div className="vx-nav-label">{p.kind === "sandbox" ? "Developers" : "Access"}</div>
          <Link href={href("tokens")} className="vx-nav-item" aria-current={current("tokens")}>{p.kind === "sandbox" ? "Push tokens" : "Keys and pushing"}</Link>
        </nav>

        <div className="vx-wrap min-w-0 flex-1">
          {view === "overview" && <LiveOverview data={data} />}
          {view === "tables" && (table ?? data.tables[0]?.name) && (
            <LiveTable
              key={table ?? data.tables[0]?.name}
              slug={slug}
              table={(table ?? data.tables[0]?.name)!}
              note={p.kind === "sandbox" ? "Values are test data." : "Computed values are in-silico results."}
            />
          )}
          {view === "tables" && !data.tables.length && <p className="vx-faint">No tables pushed yet.</p>}
          {view === "iterations" && <LiveIterations data={data} />}
          {view === "artifacts" && <LiveArtifacts data={data} />}
          {view === "tokens" && (p.kind === "sandbox" ? <PushTokens slug={slug} /> : <CampaignAccess slug={slug} />)}
        </div>
      </div>
    </div>
  );
}

function LiveOverview({ data }: { data: LiveProject }) {
  const latest = data.iterations[0];
  return (
    <>
      <h1 className="vx-h1">{data.project.title}</h1>
      <p className="vx-lede">{data.project.description}</p>
      <Stats
        items={[
          { label: "Iterations", value: data.iterations.length, delta: latest ? `latest ${day(latest.createdAt)}` : "none yet" },
          { label: "Files indexed", value: data.artifacts.length, delta: "bytes stay in Box" },
          { label: "Tables", value: data.tables.length, delta: data.tables.map((t) => t.name).join(", ") || "none yet" },
          { label: "Latest push", value: latest ? `#${latest.n}` : "—", delta: latest?.label },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest iteration">
          {latest ? (
            <div className="space-y-1" style={{ fontSize: 12.5 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="vx-id">#{latest.n} {latest.label}</span>
                <ActorBadge actor={latest.actorType === "agent" ? "agent" : "token"} />
              </div>
              {latest.summary && <p className="vx-muted">{latest.summary}</p>}
              <p className="vx-faint">{latest.files} files, {latest.newFiles} new · {day(latest.createdAt)}</p>
            </div>
          ) : (
            <span className="vx-faint">Nothing pushed yet. See Push tokens to send the first iteration.</span>
          )}
        </Panel>
        {data.project.kind !== "sandbox" ? (
          <Panel title="Tables">
            <ul className="space-y-1" style={{ fontSize: 12.5 }}>
              {data.tables.map((t) => (
                <li key={t.name}>
                  <Link href={`/projects/${data.project.slug}?view=tables&table=${t.name}`}>{t.name}</Link>{" "}
                  <span className="vx-faint">
                    {t.rows.toLocaleString()} rows · iteration {t.iteration}
                    {t.expectedRows != null && t.rows < t.expectedRows ? ` · upload not finished (${t.expectedRows.toLocaleString()} expected)` : ""}
                  </span>
                </li>
              ))}
              {!data.tables.length && <li className="vx-faint">No tables yet.</li>}
            </ul>
          </Panel>
        ) : (
        <Panel title="Push from a folder">
          <ol className="list-decimal space-y-1 pl-5" style={{ fontSize: 12.5 }}>
            <li>Create a push token under <strong>Push tokens</strong>.</li>
            <li>In the project folder: <span className="vx-mono">node sdd.mjs init</span>, then edit <span className="vx-mono">sdd.project.json</span>.</li>
            <li><span className="vx-mono">SDD_PROJECT_TOKEN=… node sdd.mjs push --label r001-test</span></li>
          </ol>
          <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            Get <a href="https://github.com/aimed-lab/sdd-studio/blob/main/tools/sdd-cli/sdd.mjs" target="_blank" rel="noreferrer">sdd.mjs</a> and the{" "}
            <a href="https://github.com/aimed-lab/sdd-studio/blob/main/skills/sdd-studio-push/SKILL.md" target="_blank" rel="noreferrer">agent skill</a>.
            The sandbox accepts files marked <span className="vx-mono">test</span> only and keeps the latest 20 iterations.
          </p>
        </Panel>
        )}
      </div>
    </>
  );
}

function LiveIterations({ data }: { data: LiveProject }) {
  const cols: Column<LiveIteration>[] = [
    { key: "n", label: "#", align: "right", render: (x) => <span className="vx-num">{x.n}</span>, value: (x) => x.n },
    { key: "label", label: "Label", render: (x) => <span className="vx-id">{x.label}</span>, value: (x) => x.label },
    { key: "date", label: "Pushed", render: (x) => day(x.createdAt), value: (x) => x.createdAt },
    { key: "via", label: "Via", render: (x) => (x.source === "agent" ? "agent skill" : "sdd push"), value: (x) => x.source },
    { key: "files", label: "Files", align: "right", render: (x) => <span className="vx-num">{x.files}</span>, value: (x) => x.files },
    { key: "new", label: "New", align: "right", render: (x) => <span className="vx-num">{x.newFiles}</span>, value: (x) => x.newFiles },
    { key: "git", label: "Git", render: (x) => <span className="vx-mono vx-faint">{x.gitSha?.slice(0, 7) ?? "—"}</span>, value: (x) => x.gitSha ?? "" },
    { key: "summary", label: "Summary", render: (x) => <span className="vx-muted" style={{ whiteSpace: "normal", display: "block", minWidth: 220, fontSize: 12 }}>{x.summary ?? ""}</span>, value: (x) => x.summary ?? "" },
  ];
  return (
    <>
      <h1 className="vx-h1">Iterations</h1>
      <p className="vx-lede">Each push is one iteration. Pushing the same label and files again changes nothing.</p>
      {data.iterations.length ? <DataTable rows={data.iterations} columns={cols} initialSort={{ key: "n", dir: "desc" }} caption="Iterations" /> : <p className="vx-faint">No iterations yet.</p>}
    </>
  );
}

function LiveArtifacts({ data }: { data: LiveProject }) {
  const cols: Column<LiveArtifact>[] = [
    {
      key: "path", label: "File", value: (a) => a.path,
      render: (a) => {
        const i = a.path.lastIndexOf("/");
        return <div><span className="vx-id">{a.path.slice(i + 1)}</span><div className="vx-faint" style={{ fontSize: 11 }}>{a.path.slice(0, i + 1)}</div></div>;
      },
    },
    { key: "kind", label: "Kind", render: (a) => <Badge>{a.kind}</Badge>, value: (a) => a.kind },
    { key: "it", label: "Iter.", align: "right", render: (a) => <span className="vx-num">{a.iteration}</span>, value: (a) => a.iteration },
    { key: "size", label: "Size", align: "right", render: (a) => <span className="vx-num">{sizeText(a.size)}</span>, value: (a) => a.size },
    { key: "sens", label: "Sensitivity", render: (a) => <SensitivityTag value={a.sensitivity} />, value: (a) => a.sensitivity },
    { key: "rel", label: "Release", render: (a) => <ReleaseBadge state={a.release as ReleaseState} />, value: (a) => a.release },
    { key: "sha", label: "SHA-256", render: (a) => <span className="vx-mono vx-faint">{a.sha256.slice(0, 12)}…</span>, value: (a) => a.sha256 },
  ];
  return (
    <>
      <h1 className="vx-h1">Artifacts</h1>
      <p className="vx-lede">The file index. Studio stores each file&apos;s path, checksum and size, not the file itself.</p>
      {data.artifacts.length ? <DataTable rows={data.artifacts} columns={cols} csvName={`${data.project.slug}_artifacts.csv`} initialSort={{ key: "it", dir: "desc" }} caption="Artifacts" /> : <p className="vx-faint">No files yet.</p>}
    </>
  );
}

// ── Push tokens ───────────────────────────────────────────────────────────────

interface TokenInfo { id: string; prefix: string; label: string | null; createdAt: string; expiresAt: string; revokedAt: string | null; lastUsedAt: string | null }

function PushTokens({ slug }: { slug: string }) {
  const { user } = useAuth();
  const email = user?.email ?? "";
  const [tokens, setTokens] = useState<TokenInfo[] | null>(null);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(90);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!email) return;
    fetch(`/api/v1/projects/${encodeURIComponent(slug)}/tokens?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setTokens(d.tokens) : setError(d.error)))
      .catch(() => setError("Could not load tokens."));
  }, [slug, email]);
  useEffect(load, [load]);

  async function create() {
    setBusy(true); setError(""); setFresh(null);
    try {
      const r = await fetch(`/api/v1/projects/${encodeURIComponent(slug)}/tokens`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, label, days }),
      });
      const d = await r.json();
      if (!d.ok) setError(d.error);
      else { setFresh(d.token); setLabel(""); load(); }
    } catch { setError("Could not reach Studio."); }
    setBusy(false);
  }

  async function revoke(id: string) {
    setError("");
    const r = await fetch(`/api/v1/projects/${encodeURIComponent(slug)}/tokens`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!d.ok) setError(d.error || "Could not revoke the token.");
    load();
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <>
      <h1 className="vx-h1">Push tokens</h1>
      <p className="vx-lede">
        A push token lets a script, cluster job or agent push iterations to this project. It is shown once; keep it in an
        environment variable, never in the project folder or a repository. Sandbox tokens write test data only.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="New token">
          <div className="space-y-2" style={{ fontSize: 12.5 }}>
            <label className="block">
              <span className="vx-faint">Label (where it will run)</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Cheaha job, laptop agent"
                className="mt-1 w-full rounded-md border px-2 py-1" style={{ background: "var(--vx-surface)", borderColor: "var(--vx-border)" }} />
            </label>
            <label className="block">
              <span className="vx-faint">Expires after</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full rounded-md border px-2 py-1"
                style={{ background: "var(--vx-surface)", borderColor: "var(--vx-border)" }}>
                {[7, 30, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
            <button type="button" className="vx-btn" disabled={busy || !email} onClick={create}>{busy ? "Creating…" : "Create token"}</button>
            {error && <p style={{ color: "var(--vx-error)" }}>{error}</p>}
          </div>
          {fresh && (
            <div className="mt-3 space-y-2 rounded-md border p-2" style={{ borderColor: "var(--vx-warning)", fontSize: 12 }}>
              <p><strong>Copy it now: this token will not be shown again.</strong></p>
              <code className="block break-all vx-mono" style={{ fontSize: 11.5 }}>{fresh}</code>
              <button type="button" className="vx-btn" onClick={() => { navigator.clipboard.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? "Copied" : "Copy token"}
              </button>
              <pre className="vx-mono whitespace-pre-wrap" style={{ fontSize: 11, background: "var(--vx-bg2)", padding: 8, borderRadius: 6 }}>
{`export SDD_PROJECT_TOKEN=<paste token>
node sdd.mjs init --project ${slug} --studio ${origin}
node sdd.mjs push --label r001-test`}
              </pre>
            </div>
          )}
        </Panel>
        <Panel title="Your tokens">
          {!tokens ? <span className="vx-faint">Loading…</span> : tokens.length === 0 ? <span className="vx-faint">None yet.</span> : (
            <ul className="space-y-2" style={{ fontSize: 12.5 }}>
              {tokens.map((t) => {
                const dead = !!t.revokedAt || new Date(t.expiresAt) < new Date();
                return (
                  <li key={t.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", opacity: dead ? 0.55 : 1 }}>
                    <span className="vx-mono">{t.prefix}…</span>
                    <span>{t.label ?? "—"}</span>
                    <span className="vx-faint">
                      {t.revokedAt ? `revoked ${day(t.revokedAt)}` : `expires ${day(t.expiresAt)}`} · last used {day(t.lastUsedAt)}
                    </span>
                    {!dead && <button type="button" className="vx-btn" onClick={() => revoke(t.id)}>Revoke</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

// ── Campaign access ───────────────────────────────────────────────────────────

function KeyGate({ slug, hadKey, onSaved }: { slug: string; hadKey: boolean; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    const key = value.trim();
    if (!key.startsWith("sdd_pt_")) { setError("A project key starts with sdd_pt_."); return; }
    setChecking(true); setError("");
    const r = await fetch(`/api/v1/projects/${encodeURIComponent(slug)}`, { headers: { "X-SDD-Project-Key": key } }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setChecking(false);
    if (!d.ok) { setError(d.error || "That key was not accepted."); return; }
    // A push key can write; it belongs in a script's environment, not in a browser.
    if (d.access !== "read") { setError("That is a push key. In the browser, use a read key; keep push keys for scripts."); return; }
    setProjectKey(slug, key);
    onSaved();
  }
  return (
    <div className="vx-wrap" style={{ maxWidth: 560 }}>
      <div className="vx-step-label">Campaign</div>
      <h1 className="vx-h1">This project needs a key</h1>
      <p className="vx-lede">
        {hadKey ? "The key saved in this browser is no longer accepted (revoked or expired). " : ""}
        Campaigns hold unpublished data, so Studio asks for a project key from the platform owner. It is checked on the
        server for every request and is kept only in this browser.
      </p>
      <label className="block" style={{ fontSize: 12.5 }}>
        <span className="vx-faint">Project key</span>
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="sdd_pt_…"
          className="mt-1 w-full rounded-md border px-2 py-1 vx-mono"
          style={{ background: "var(--vx-surface)", borderColor: "var(--vx-border)" }}
        />
      </label>
      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" className="vx-btn" disabled={checking || !value.trim()} onClick={save}>{checking ? "Checking…" : "Open project"}</button>
        <Link href="/projects" className="vx-faint" style={{ fontSize: 12 }}>Back to projects</Link>
      </div>
      {error && <p style={{ color: "var(--vx-error)", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
    </div>
  );
}

function CampaignAccess({ slug }: { slug: string }) {
  return (
    <>
      <h1 className="vx-h1">Keys and pushing</h1>
      <p className="vx-lede">
        This campaign is opened with a project key issued by the platform owner. A <strong>read</strong> key opens it in
        Studio; a <strong>push</strong> key also lets a script or agent write iterations with{" "}
        <span className="vx-mono">sdd.mjs push --token-file …</span>. Keys are checked on the server, expire, and can be
        revoked at any time.
      </p>
      <Panel title="On this browser">
        <p style={{ fontSize: 12.5 }}>
          The key for this project is saved in this browser only. Use <strong>Forget key</strong> at the top on shared
          computers.
        </p>
      </Panel>
      <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 10 }}>
        How keys are issued and revoked: <a href="/docs/projects-api">Projects API</a>. Project: <span className="vx-mono">{slug}</span>.
      </p>
    </>
  );
}

/** The sandbox's own notice (kept here so this file stays under the page-label wording check). */
function SandboxNotice() {
  return (
    <div role="note" className="vx-badge vx-badge-yellow" style={{ display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 12 }}>
      <strong>Test data.</strong> Developers push test iterations here to try the workflow. Nothing in the sandbox is a
      result; do not cite or use it for decisions.
    </div>
  );
}

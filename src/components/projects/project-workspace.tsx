"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DemoArtifact, DemoCompound, DemoIteration, DemoProject, DemoRound, ProjectRole } from "@/data/projects-demo";
import {
  ActorBadge, Badge, DataTable, DocumentsStrip, DomainBadge, FLAG_COLOR, FlagLabel, Panel, ReleaseBadge,
  ScoreBar, SensitivityBadge, Stats, type Column,
} from "@/components/projects/vault-ui";
import type { ProjectView } from "@/components/projects/views";


interface NavEntry {
  view?: ProjectView;
  label: string;
  badge?: number;
  /** Shown but not clickable until real data arrives. */
  later?: string;
}

function navSections(p: DemoProject): { label: string; items: NavEntry[] }[] {
  const LATER = "Needs ingested project data (Stage 3 of the plan)";
  return [
    { label: "Project", items: [{ view: "overview", label: "Overview" }] },
    {
      label: "Campaign",
      items: [
        { label: "1 · Intake", later: LATER },
        { label: "2 · Command", later: LATER },
        { view: "funnel", label: "3 · Tier funnel" },
        { label: "4 · Review & gate", later: LATER },
        { label: "5 · Ready to make", later: LATER },
        { view: "decision", label: "6 · Decision sheet", badge: p.compounds.length || undefined },
        { label: "7 · Connectivity", later: LATER },
        { label: "8 · Secondary targets", later: LATER },
        { view: "rounds", label: "9 · Autoresearch", badge: p.rounds.length || undefined },
      ],
    },
    {
      label: "Data",
      items: [
        { view: "properties", label: "Chemical properties" },
        { view: "iterations", label: "Iterations", badge: p.iterations.length },
        { view: "artifacts", label: "Artifacts", badge: p.artifacts.length },
      ],
    },
    {
      label: "Share",
      items: [
        { view: "release", label: "Release" },
        { view: "team", label: "Team", badge: p.members.length },
      ],
    },
  ];
}

export function ProjectWorkspace({ project: p, view }: { project: DemoProject; view: ProjectView }) {
  // On phones the section nav is a horizontal strip; keep the current section visible in it.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [view]);
  return (
    <div className="flex min-h-full flex-col">
      <div className="vx-topbar">
        <Link href="/projects" className="vx-topbar-sub" style={{ color: "var(--vx-text-faint)" }}>
          Projects
        </Link>
        <span className="vx-topbar-sub" aria-hidden>/</span>
        <span className="vx-topbar-title">{p.title}</span>
        <span className="vx-divider" aria-hidden />
        <span className="vx-topbar-sub">
          {p.target} · {p.modality}
        </span>
        <span style={{ flex: 1 }} />
        <Badge tone={p.visibility === "released" ? "green" : p.visibility === "team" ? "accent" : "plain"}>
          {p.visibility}
        </Badge>
        <Badge tone="yellow" title="Every value on this page is invented to show the layout.">
          Demo fixture
        </Badge>
      </div>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav ref={navRef} aria-label="Project sections" className="vx-sidenav">
          {navSections(p).map((s) => (
            <div key={s.label} className="contents md:block">
              <div className="vx-nav-label">{s.label}</div>
              {s.items.map((it) =>
                it.view ? (
                  <Link
                    key={it.label}
                    href={it.view === "overview" ? `/projects/${p.slug}` : `/projects/${p.slug}?view=${it.view}`}
                    aria-current={view === it.view ? "page" : undefined}
                    className="vx-nav-item"
                  >
                    {it.label}
                    {it.badge != null && <span className="vx-nav-badge">{it.badge}</span>}
                  </Link>
                ) : (
                  <span key={it.label} className="vx-nav-item" aria-disabled="true" title={it.later}>
                    {it.label}
                  </span>
                )
              )}
            </div>
          ))}
        </nav>

        <div className="vx-wrap min-w-0 flex-1">
          {view === "overview" && <Overview p={p} />}
          {view === "funnel" && <Funnel p={p} />}
          {view === "decision" && <Decision p={p} />}
          {view === "rounds" && <Rounds p={p} />}
          {view === "properties" && <Properties p={p} />}
          {view === "iterations" && <Iterations p={p} />}
          {view === "artifacts" && <Artifacts p={p} />}
          {view === "release" && <Release p={p} />}
          {view === "team" && <Team p={p} />}
        </div>
      </div>
    </div>
  );
}

function Heading({ step, title, lede }: { step?: string; title: string; lede: string }) {
  return (
    <>
      {step && <div className="vx-step-label">{step}</div>}
      <h1 className="vx-h1">{title}</h1>
      <p className="vx-lede">{lede}</p>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="vx-panel" style={{ padding: 20, color: "var(--vx-text-faint)" }}>
      {children}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function Overview({ p }: { p: DemoProject }) {
  const latest = p.iterations[0];
  const go = p.compounds.filter((c) => c.flag === "GO").length;
  const bestJ = p.rounds.length ? Math.max(...p.rounds.map((r) => r.J)) : null;
  return (
    <>
      <Heading title={p.title} lede={p.description} />
      <Stats
        items={[
          { label: "Iterations", value: p.iterations.length, delta: latest ? `latest ${latest.date}` : undefined },
          { label: "Artifacts", value: p.artifacts.length, delta: `${p.artifacts.filter((a) => a.release === "released").length} released` },
          { label: "GO compounds", value: p.compounds.length ? go : "—", delta: p.compounds.length ? `of ${p.compounds.length} on the sheet` : "no decision sheet" },
          { label: "Best J(t)", value: bestJ != null ? bestJ.toFixed(1) : "—", delta: p.rounds.length ? `${p.rounds.length} rounds` : "no rounds" },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Latest iteration">
          {latest ? (
            <div className="space-y-2">
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span className="vx-id">#{latest.n} {latest.label}</span>
                <ActorBadge actor={latest.actor} />
              </div>
              <p className="vx-muted" style={{ fontSize: 12.5 }}>{latest.summary}</p>
              <p className="vx-faint" style={{ fontSize: 12 }}>
                {latest.files} files, {latest.newFiles} new · {latest.date} ·{" "}
                <Link href={`/projects/${p.slug}?view=iterations`}>all iterations</Link>
              </p>
            </div>
          ) : (
            <span className="vx-faint">No iterations yet.</span>
          )}
        </Panel>
        <Panel title="Documents">
          <DocumentsStrip docs={p.documents} />
        </Panel>
        <Panel title="How results reach this page">
          <ol className="list-decimal space-y-1 pl-5" style={{ fontSize: 12.5 }}>
            <li>The team or its agent writes an iteration into the project&apos;s Box folder.</li>
            <li>
              <span className="vx-mono">sdd push --label …</span> (or the{" "}
              <a href="https://github.com/aimed-lab/sdd-studio/blob/main/skills/sdd-studio-push/SKILL.md" target="_blank" rel="noreferrer">
                sdd-studio-push agent skill
              </a>
              ) uploads only new files to Box and registers the iteration here.
            </li>
            <li>Studio indexes the files and loads summary tables (decision sheet, rounds) as draft.</li>
            <li>The project lead requests a release; the Studio Owner approves it.</li>
          </ol>
          <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 8 }}>
            The upload API and CLI arrive in Stage 3; this page shows the layout with demo data.
          </p>
        </Panel>
        <Panel title="Project">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1" style={{ fontSize: 12.5 }}>
            <dt className="vx-faint">Target</dt><dd>{p.target}</dd>
            <dt className="vx-faint">Modality</dt><dd>{p.modality}</dd>
            <dt className="vx-faint">Area</dt><dd>{p.area}</dd>
            <dt className="vx-faint">Lead</dt><dd>{p.lead}</dd>
            <dt className="vx-faint">Storage</dt><dd>Box folder (primary copy of every file)</dd>
            <dt className="vx-faint">Updated</dt><dd>{p.updated}</dd>
          </dl>
        </Panel>
      </div>
    </>
  );
}

// ── 3 · Tier funnel ───────────────────────────────────────────────────────────

function Funnel({ p }: { p: DemoProject }) {
  const max = Math.max(1, ...p.tiers.map((t) => t.count));
  return (
    <>
      <Heading
        step={`${p.modality} · tiered gates`}
        title="Tier funnel"
        lede="Each tier is a cheaper-to-costlier gate. Compounds that clear a tier advance. The frontier is where the campaign waits for a person's decision."
      />
      {p.tiers.length === 0 ? (
        <Empty>This project has no tiered funnel.</Empty>
      ) : (
        <div className="vx-panel" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {p.tiers.map((t) => (
            <div key={t.tag} className={t.state === "frontier" ? "vx-tier frontier" : "vx-tier"} style={t.state === "pending" ? { opacity: 0.6 } : undefined}>
              <span className="vx-tier-tag">{t.tag}</span>
              <span className="vx-tier-lbl">{t.label}</span>
              <span className="vx-tier-bw">
                <span className="vx-tier-bf" style={{ display: "block", width: `${Math.max(2, (100 * Math.log10(t.count + 1)) / Math.log10(max + 1))}%` }} />
              </span>
              <span className="vx-tier-cnt">{t.count.toLocaleString()}</span>
              <span className="vx-faint vx-mono hidden sm:inline" style={{ width: 70, textAlign: "right", fontSize: 10 }}>
                {t.state === "frontier" ? "FRONTIER" : t.state === "pass" ? "cleared" : "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 10 }}>Bar length is on a log scale. Counts are illustrative.</p>
    </>
  );
}

// ── 6 · Decision sheet ────────────────────────────────────────────────────────

const decisionCols: Column<DemoCompound>[] = [
  { key: "id", label: "Compound", render: (c) => <span className="vx-id">{c.id}</span>, value: (c) => c.id },
  { key: "lineage", label: "Lineage", render: (c) => <span className="vx-faint">{c.lineage}</span>, value: (c) => c.lineage },
  { key: "flag", label: "Flag", render: (c) => <FlagLabel flag={c.flag} />, value: (c) => ["NO-GO", "HOLD", "WATCH", "GO"].indexOf(c.flag) },
  { key: "action", label: "Action", align: "right", render: (c) => <span className="vx-num">{c.action.toFixed(1)}</span>, value: (c) => c.action },
  { key: "candidacy", label: "Candidacy", render: (c) => <ScoreBar value={c.candidacy} min={30} max={90} />, value: (c) => c.candidacy },
  { key: "good", label: "GOOD", align: "right", title: "Desired-target binders", render: (c) => <span className="vx-num">{c.goodBinders}</span>, value: (c) => c.goodBinders },
  { key: "anti", label: "ANTI", align: "right", title: "Anti-target binders", render: (c) => <span className={c.antiBinders >= 3 ? "vx-num num-bad" : "vx-num"}>{c.antiBinders}</span>, value: (c) => c.antiBinders },
  { key: "novelty", label: "Novelty", render: (c) => <span style={{ fontSize: 11.5 }}>{c.novelty}</span>, value: (c) => c.novelty },
  { key: "panel", label: "Panel", align: "right", title: "Expert panel points", render: (c) => <span className="vx-num">{c.panel}</span>, value: (c) => c.panel },
  { key: "domain", label: "Domain", render: (c) => <DomainBadge fit={c.domain} />, value: (c) => ["out", "near", "in"].indexOf(c.domain) },
  { key: "round", label: "First seen", align: "right", render: (c) => <span className="vx-num">R{c.firstRound}</span>, value: (c) => c.firstRound },
];

function Decision({ p }: { p: DemoProject }) {
  const counts = (["GO", "WATCH", "HOLD", "NO-GO"] as const).map((k) => [k, p.compounds.filter((c) => c.flag === k).length] as const);
  return (
    <>
      <Heading
        step="6 · Decision sheet"
        title="Go / no-go decision sheet"
        lede="The last gate before synthesis. Flags are proposed automatically and confirmed by a person. Sort any column; export what you see."
      />
      {p.compounds.length === 0 ? (
        <Empty>This project has no decision sheet. Antibody and other campaigns can declare their own summary tables in sdd.project.yaml.</Empty>
      ) : (
        <>
          <div className="vx-chips">
            {counts.map(([k, n]) => (
              <span key={k} className="vx-chip">
                <span className="vx-dot" style={{ background: FLAG_COLOR[k] }} aria-hidden />
                <span className="vx-muted" style={{ fontSize: 12 }}>{k}</span>
                <strong>{n}</strong>
              </span>
            ))}
          </div>
          <DataTable
            rows={p.compounds}
            columns={decisionCols}
            csvName={`${p.slug}_decision_sheet_DEMO.csv`}
            initialSort={{ key: "candidacy", dir: "desc" }}
            caption="Decision sheet"
          />
          {p.decisionRule && <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 10 }}>{p.decisionRule}</p>}
        </>
      )}
    </>
  );
}

// ── 9 · Autoresearch ──────────────────────────────────────────────────────────

function Rounds({ p }: { p: DemoProject }) {
  const r = p.rounds;
  const js = r.map((x) => x.J);
  const jmin = Math.min(...js), jmax = Math.max(...js);
  const cols: Column<DemoRound>[] = [
    { key: "round", label: "Round", render: (x) => <strong>R{x.round}</strong>, value: (x) => x.round },
    { key: "gen", label: "Generator", render: (x) => x.generator, value: (x) => x.generator },
    { key: "cand", label: "Candidates", align: "right", render: (x) => <span className="vx-num">{x.candidates.toLocaleString()}</span>, value: (x) => x.candidates },
    { key: "clean", label: "Gate-clean", align: "right", render: (x) => <span className="vx-num">{x.gateClean.toLocaleString()}</span>, value: (x) => x.gateClean },
    { key: "J", label: "J(t)", title: "Best composite score that round", render: (x) => <ScoreBar value={x.J} min={jmin} max={jmax} />, value: (x) => x.J },
    { key: "event", label: "Event", render: (x) => <span className="vx-muted" style={{ fontSize: 11.5 }}>{x.event}</span>, value: (x) => x.event },
  ];
  return (
    <>
      <Heading
        step="9 · Autoresearch"
        title="Round history"
        lede="Every design–make–test cycle: which generator ran, how many candidates it proposed, how many cleared the gates, and the best composite score J(t) that round."
      />
      {r.length === 0 ? (
        <Empty>This project has no autoresearch rounds.</Empty>
      ) : (
        <>
          <div className="vx-chips">
            {[
              ["Rounds", r.length],
              ["Candidates", r.reduce((s, x) => s + x.candidates, 0).toLocaleString()],
              ["Gate-clean", r.reduce((s, x) => s + x.gateClean, 0).toLocaleString()],
              ["Best J(t)", jmax.toFixed(1)],
            ].map(([k, v]) => (
              <span key={k} className="vx-chip">
                <strong>{v}</strong>
                <span className="vx-muted" style={{ fontSize: 12 }}>{k}</span>
              </span>
            ))}
          </div>
          <DataTable rows={r} columns={cols} csvName={`${p.slug}_rounds_DEMO.csv`} initialSort={{ key: "round", dir: "desc" }} caption="Autoresearch rounds" />
        </>
      )}
    </>
  );
}

// ── Chemical-property report ──────────────────────────────────────────────────

const cls = (good: boolean, bad: boolean) => (bad ? "vx-num num-bad" : good ? "vx-num num-good" : "vx-num");

const propCols: Column<DemoCompound>[] = [
  { key: "id", label: "Compound", render: (c) => <span className="vx-id">{c.id}</span>, value: (c) => c.id },
  { key: "flag", label: "Flag", render: (c) => <FlagLabel flag={c.flag} />, value: (c) => ["NO-GO", "HOLD", "WATCH", "GO"].indexOf(c.flag) },
  { key: "mw", label: "MW", align: "right", title: "Molecular weight (Da); Ro5 limit 500", render: (c) => <span className={cls(false, c.mw > 500)}>{c.mw.toFixed(1)}</span>, value: (c) => c.mw },
  { key: "logp", label: "logP", align: "right", title: "Ro5 limit 5", render: (c) => <span className={cls(false, c.logP > 5)}>{c.logP.toFixed(1)}</span>, value: (c) => c.logP },
  { key: "tpsa", label: "TPSA", align: "right", title: "Topological polar surface area (Å²); >140 limits permeability", render: (c) => <span className={cls(false, c.tpsa > 140)}>{c.tpsa.toFixed(1)}</span>, value: (c) => c.tpsa },
  { key: "hbd", label: "HBD", align: "right", title: "H-bond donors; Ro5 limit 5", render: (c) => <span className={cls(false, c.hbd > 5)}>{c.hbd}</span>, value: (c) => c.hbd },
  { key: "hba", label: "HBA", align: "right", title: "H-bond acceptors; Ro5 limit 10", render: (c) => <span className={cls(false, c.hba > 10)}>{c.hba}</span>, value: (c) => c.hba },
  { key: "qed", label: "QED", align: "right", title: "Quantitative estimate of drug-likeness (0–1)", render: (c) => <span className={cls(c.qed >= 0.6, c.qed < 0.4)}>{c.qed.toFixed(2)}</span>, value: (c) => c.qed },
  { key: "ro5", label: "Ro5 viol.", align: "right", title: "Lipinski rule-of-five violations", render: (c) => <span className={cls(c.lipinski === 0, c.lipinski > 1)}>{c.lipinski}</span>, value: (c) => c.lipinski },
  {
    key: "herg", label: "hERG risk", title: "Cardiac-liability flag",
    render: (c) => <Badge tone={c.herg === "low" ? "green" : c.herg === "medium" ? "yellow" : "red"}>{c.herg}</Badge>,
    value: (c) => ["low", "medium", "high"].indexOf(c.herg),
  },
  { key: "domain", label: "Domain", render: (c) => <DomainBadge fit={c.domain} />, value: (c) => ["out", "near", "in"].indexOf(c.domain) },
];

function Properties({ p }: { p: DemoProject }) {
  return (
    <>
      <Heading
        title="Chemical-property report"
        lede="Drug-likeness and liability checks for every compound on the decision sheet, with the applicability-domain call that says how far to trust each computed score. Values outside common limits are red."
      />
      {p.compounds.length === 0 ? (
        <Empty>No compounds in this project.</Empty>
      ) : (
        <DataTable rows={p.compounds} columns={propCols} csvName={`${p.slug}_properties_DEMO.csv`} initialSort={{ key: "qed", dir: "desc" }} caption="Chemical properties" />
      )}
      <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 10 }}>
        Limits: rule of five, Lipinski CA et al., Adv Drug Deliv Rev 2001 (
        <a href="https://doi.org/10.1016/s0169-409x(00)00129-0" target="_blank" rel="noreferrer">PMID 11259830</a>); TPSA ≤ 140 Å², Veber DF et al.,
        J Med Chem 2002 (<a href="https://doi.org/10.1021/jm020017n" target="_blank" rel="noreferrer">PMID 12036371</a>); QED, Bickerton GR et al.,
        Nat Chem 2012 (<a href="https://doi.org/10.1038/nchem.1243" target="_blank" rel="noreferrer">PMID 22270643</a>). The compound values here are illustrative.
      </p>
    </>
  );
}

// ── Iterations and artifacts ──────────────────────────────────────────────────

const SOURCE_LABEL: Record<DemoIteration["source"], string> = { cli: "sdd push", agent: "agent skill", "box-webhook": "Box folder" };

function Iterations({ p }: { p: DemoProject }) {
  const cols: Column<DemoIteration>[] = [
    { key: "n", label: "#", align: "right", render: (x) => <span className="vx-num">{x.n}</span>, value: (x) => x.n },
    { key: "label", label: "Label", render: (x) => <span className="vx-id">{x.label}</span>, value: (x) => x.label },
    { key: "date", label: "Date", render: (x) => x.date, value: (x) => x.date },
    { key: "source", label: "Via", render: (x) => SOURCE_LABEL[x.source], value: (x) => x.source },
    { key: "actor", label: "By", render: (x) => <ActorBadge actor={x.actor} />, value: (x) => x.actor },
    { key: "files", label: "Files", align: "right", render: (x) => <span className="vx-num">{x.files}</span>, value: (x) => x.files },
    { key: "new", label: "New", align: "right", title: "Files not seen before (unchanged files are skipped)", render: (x) => <span className="vx-num">{x.newFiles}</span>, value: (x) => x.newFiles },
    { key: "status", label: "Status", render: (x) => <Badge tone={x.status === "committed" ? "green" : x.status === "failed" ? "red" : "yellow"}>{x.status}</Badge>, value: (x) => x.status },
    { key: "summary", label: "Summary", render: (x) => <span className="vx-muted" style={{ fontSize: 12, whiteSpace: "normal", display: "block", minWidth: 260 }}>{x.summary}</span>, value: (x) => x.summary },
  ];
  return (
    <>
      <Heading
        title="Iterations"
        lede="Each push from a cluster job, a developer's agent or the Box folder becomes one iteration. Re-pushing unchanged files costs nothing: only new files are uploaded."
      />
      <DataTable rows={p.iterations} columns={cols} initialSort={{ key: "n", dir: "desc" }} caption="Iterations" />
    </>
  );
}

function Artifacts({ p }: { p: DemoProject }) {
  const cols: Column<DemoArtifact>[] = [
    {
      key: "path", label: "File in Box", value: (a) => a.path,
      render: (a) => {
        const i = a.path.lastIndexOf("/");
        return (
          <div>
            <span className="vx-id">{a.path.slice(i + 1)}</span>
            <div className="vx-faint" style={{ fontSize: 11 }}>{a.path.slice(0, i + 1)}</div>
          </div>
        );
      },
    },
    { key: "kind", label: "Kind", render: (a) => <Badge>{a.kind}</Badge>, value: (a) => a.kind },
    { key: "it", label: "Iter.", align: "right", render: (a) => <span className="vx-num">{a.iteration}</span>, value: (a) => a.iteration },
    { key: "size", label: "Size", align: "right", render: (a) => <span className="vx-num">{a.sizeKb >= 1024 ? `${(a.sizeKb / 1024).toFixed(1)} MB` : `${a.sizeKb} KB`}</span>, value: (a) => a.sizeKb },
    { key: "sens", label: "Sensitivity", render: (a) => <SensitivityBadge value={a.sensitivity} />, value: (a) => a.sensitivity },
    { key: "rel", label: "Release", render: (a) => <ReleaseBadge state={a.release} />, value: (a) => a.release },
    { key: "by", label: "By", render: (a) => <ActorBadge actor={a.actor} />, value: (a) => a.actor },
    { key: "sha", label: "SHA-256", render: (a) => <span className="vx-mono vx-faint">{a.sha}…</span>, value: (a) => a.sha },
  ];
  return (
    <>
      <Heading
        title="Artifacts"
        lede="Every file Studio knows about. The bytes stay in the project's Box folder; Studio keeps the checksum, sensitivity and release state. Agents and CLI tokens can only create draft or internal artifacts."
      />
      <DataTable rows={p.artifacts} columns={cols} csvName={`${p.slug}_artifacts_DEMO.csv`} initialSort={{ key: "it", dir: "desc" }} caption="Artifacts" />
    </>
  );
}

// ── Release and team ─────────────────────────────────────────────────────────

function Release({ p }: { p: DemoProject }) {
  const candidates = p.artifacts.filter((a) => a.release === "candidate");
  const released = p.artifacts.filter((a) => a.release === "released");
  return (
    <>
      <Heading
        title="Release to smartdrugdiscovery.org"
        lede="Released artifacts appear on this project's public page. A release needs two people: the project lead requests it, and the Studio Owner approves it after the IP and publication checks."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Release candidates (${candidates.length})`}>
          {candidates.length ? (
            <ul className="space-y-2">
              {candidates.map((a) => (
                <li key={a.path} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                  <span className="vx-id" style={{ wordBreak: "break-all" }}>{a.path.split("/").pop()}</span>
                  <SensitivityBadge value={a.sensitivity} />
                </li>
              ))}
            </ul>
          ) : (
            <span className="vx-faint">No candidates.</span>
          )}
          <div style={{ marginTop: 12 }}>
            <button type="button" className="vx-btn" disabled title="The release workflow arrives in Stage 6">
              Request release
            </button>
          </div>
        </Panel>
        <Panel title={`Released (${released.length})`}>
          {released.length ? (
            <ul className="space-y-2">
              {released.map((a) => (
                <li key={a.path} className="vx-id" style={{ fontSize: 12.5 }}>{a.path.split("/").pop()}</li>
              ))}
            </ul>
          ) : (
            <span className="vx-faint">Nothing released yet.</span>
          )}
          <p className="vx-faint" style={{ fontSize: 11.5, marginTop: 10 }}>Public page: /p/{p.slug} (Stage 6)</p>
        </Panel>
        <Panel title="Release states">
          <ul className="space-y-1.5" style={{ fontSize: 12.5 }}>
            <li><ReleaseBadge state="draft" /> written by an agent or token; team only</li>
            <li><ReleaseBadge state="internal" /> checked by a developer; team only</li>
            <li><ReleaseBadge state="candidate" /> proposed for release by the project lead</li>
            <li><ReleaseBadge state="released" /> approved by the Studio Owner; public</li>
            <li><ReleaseBadge state="superseded" /> replaced by a newer version of the same file</li>
            <li><ReleaseBadge state="withdrawn" /> taken down after release</li>
          </ul>
        </Panel>
        <Panel title="Before anything is released">
          <ul className="list-disc space-y-1 pl-5" style={{ fontSize: 12.5 }}>
            <li>No patient-level data or PHI, ever, on the hosted service.</li>
            <li>IP and publication plans checked with the team and institutions.</li>
            <li>Computed scores labelled as in-silico results with their limitations.</li>
            <li>Attribution approved by the team.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

const ROLE_TEXT: Record<ProjectRole, string> = {
  owner: "Manages members, requests releases",
  developer: "Pushes iterations, edits drafts",
  reviewer: "Reads everything, comments, marks internal",
  viewer: "Reads team artifacts",
};

function Team({ p }: { p: DemoProject }) {
  return (
    <>
      <Heading
        title="Team"
        lede="Project roles are separate from Studio-wide roles. Ingest tokens belong to the project, expire after 90 days and can only add drafts."
      />
      <div className="vx-table-wrap">
        <table className="vx-table">
          <thead>
            <tr><th scope="col">Member</th><th scope="col">Project role</th><th scope="col">Can</th></tr>
          </thead>
          <tbody>
            {p.members.map((m) => (
              <tr key={m.label}>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span
                      aria-hidden
                      style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--vx-navy)", color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {m.initials}
                    </span>
                    {m.label}
                  </span>
                </td>
                <td><Badge tone={m.role === "owner" ? "accent" : "plain"}>{m.role}</Badge></td>
                <td className="vx-muted" style={{ fontSize: 12 }}>{ROLE_TEXT[m.role]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

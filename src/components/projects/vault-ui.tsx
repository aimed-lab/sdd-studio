"use client";

import { useMemo, useState } from "react";
import type {
  ActorType, DecisionFlag, DemoDocument, DomainFit, ReleaseState, Sensitivity,
} from "@/data/projects-demo";

export const FLAG_COLOR: Record<DecisionFlag, string> = {
  GO: "var(--vx-success)",
  WATCH: "var(--vx-warning)",
  HOLD: "var(--vx-hold)",
  "NO-GO": "var(--vx-error)",
};

type Tone = "plain" | "accent" | "green" | "yellow" | "red" | "violet" | "teal";

export function Badge({ tone = "plain", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span className={tone === "plain" ? "vx-badge" : `vx-badge vx-badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

const RELEASE_TONE: Record<ReleaseState, Tone> = {
  draft: "plain",
  internal: "accent",
  candidate: "yellow",
  released: "green",
  superseded: "plain",
  withdrawn: "red",
};

export function ReleaseBadge({ state }: { state: ReleaseState }) {
  return <Badge tone={RELEASE_TONE[state]}>{state}</Badge>;
}

const SENS_TONE: Record<Sensitivity, Tone> = { public: "green", unpublished: "violet", confidential: "red" };
export function SensitivityBadge({ value }: { value: Sensitivity }) {
  return <Badge tone={SENS_TONE[value]}>{value}</Badge>;
}

const ACTOR_LABEL: Record<ActorType, string> = { human: "person", agent: "agent", token: "CLI token" };
export function ActorBadge({ actor }: { actor: ActorType }) {
  return <Badge tone={actor === "agent" ? "teal" : "plain"}>{ACTOR_LABEL[actor]}</Badge>;
}

export function DomainBadge({ fit }: { fit: DomainFit }) {
  const tone: Tone = fit === "in" ? "green" : fit === "near" ? "yellow" : "red";
  return (
    <Badge tone={tone} title="Applicability domain: is the compound inside the chemical space the scoring models were built on?">
      {fit === "in" ? "in domain" : fit === "near" ? "near edge" : "out of domain"}
    </Badge>
  );
}

export function FlagLabel({ flag }: { flag: DecisionFlag }) {
  return (
    <span style={{ fontWeight: 700, color: FLAG_COLOR[flag], display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="vx-dot" style={{ background: FLAG_COLOR[flag] }} aria-hidden />
      {flag}
    </span>
  );
}

export function ScoreBar({ value, min = 0, max = 100, label }: { value: number; min?: number; max?: number; label?: string }) {
  const w = max > min ? Math.max(0, Math.min(100, (100 * (value - min)) / (max - min))) : 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="vx-bar" role="img" aria-label={label ?? `${value.toFixed(1)}`}>
        <span style={{ width: `${w}%` }} />
      </div>
      <span className="vx-num" style={{ minWidth: 40, textAlign: "right" }}>{value.toFixed(1)}</span>
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: React.ReactNode; delta?: string }[] }) {
  return (
    <div className="vx-stats">
      {items.map((s) => (
        <div key={s.label} className="vx-stat">
          <div className="vx-stat-value">{s.value}</div>
          <div className="vx-stat-label">{s.label}</div>
          {s.delta && <div className="vx-stat-delta">{s.delta}</div>}
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="vx-panel">
      <div className="vx-panel-h">
        <span>{title}</span>
        {action}
      </div>
      <div className="vx-panel-b">{children}</div>
    </section>
  );
}

export function DocumentsStrip({ docs }: { docs: DemoDocument[] }) {
  return (
    <div>
      {docs.map((d) => (
        <div key={d.name} className="vx-docs-row">
          <span className="vx-docs-name">{d.name}</span>
          {d.versions.map((v, i) => (
            <span key={v} className={i === d.versions.length - 1 ? "vx-ver latest" : "vx-ver"} title={i === d.versions.length - 1 ? "Current version" : "Earlier version"}>
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Sortable table with CSV export ────────────────────────────────────────────

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  /** Value used for sorting and for CSV export. */
  value: (row: T) => string | number;
  title?: string;
}

export function DataTable<T>({
  rows, columns, csvName, initialSort, caption,
}: {
  rows: T[];
  columns: Column<T>[];
  csvName?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  caption?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const out = rows.slice().sort((a, b) => {
      const x = col.value(a), y = col.value(b);
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [columns.map((c) => esc(c.label)).join(",")]
      .concat(sorted.map((r) => columns.map((c) => esc(c.value(r))).join(",")))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: csvName ?? "table.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {csvName && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button type="button" className="vx-btn" onClick={exportCsv}>
            ↓ Export CSV ({sorted.length} rows)
          </button>
        </div>
      )}
      <div className="vx-table-wrap">
        <table className="vx-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={c.align === "right" ? "r" : undefined}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    title={c.title}
                    scope="col"
                  >
                    <button type="button" onClick={() => toggle(c.key)}>
                      {c.label}
                      {active ? (sort!.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === "right" ? "r" : undefined}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

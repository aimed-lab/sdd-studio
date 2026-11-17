"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoleculeViewer } from "@/components/molecule-viewer";
import { keyHeaders } from "@/components/projects/project-key";
import { ADMET_PATH, putAdmetHandoff } from "@/lib/admet/handoff";

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

interface Page {
  rows: Row[];
  columns: string[];
  total: number;
  matched: number;
  expected: number | null;
  iteration: number | null;
}

const PAGE = 100;
const SMILES_COLS = ["smiles", "canonical_smiles", "smiles_canonical", "SMILES", "Smiles", "canonical_SMILES"];
const ID_COLS = ["compound_id", "id", "molecule_id", "mol_id", "name", "compound", "chembl_id"];

const fmt = (v: Cell) => (v == null ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(6)))) : String(v));

function csvEscape(v: Cell) {
  const s = v == null ? "" : String(v);
  const t = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${t.replace(/"/g, '""')}"`;
}

/** A pushed table explored on the server: search, sort, pages of 100, row details with the structure drawn. */
export function LiveTable({ slug, table, note }: { slug: string; table: string; note?: string }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(0);
    setSort(null);
    setQInput("");
    setDetail(null);
  }, [table]);

  const url = (offset: number, limit: number) => {
    const p = new URLSearchParams({ table, limit: String(limit), offset: String(offset) });
    if (q) p.set("q", q);
    if (sort) {
      p.set("sort", sort.col);
      p.set("dir", sort.desc ? "desc" : "asc");
    }
    return `/api/v1/projects/${encodeURIComponent(slug)}/records?${p}`;
  };

  const req = useRef(0);
  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    fetch(url(page * PAGE, PAGE), { headers: keyHeaders(slug) })
      .then((r) => r.json())
      .then((d) => {
        if (id !== req.current) return;
        if (d.ok) setData({ rows: d.rows, columns: d.columns ?? [], total: d.total, matched: d.matched, expected: d.expected ?? null, iteration: d.iteration });
        else setError(d.error || "Could not load the table.");
      })
      .catch(() => id === req.current && setError("Could not load the table."))
      .finally(() => id === req.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, table, page, q, sort]);

  const columns = useMemo(() => {
    const keys = [...(data?.columns ?? [])];
    for (const r of data?.rows ?? []) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
    return keys;
  }, [data]);
  const numeric = useMemo(() => {
    const out = new Set<string>();
    for (const c of columns) if ((data?.rows ?? []).every((r) => r[c] == null || typeof r[c] === "number") && (data?.rows ?? []).some((r) => typeof r[c] === "number")) out.add(c);
    return out;
  }, [columns, data]);
  const smilesCol = columns.find((c) => SMILES_COLS.includes(c));
  const idCol = columns.find((c) => ID_COLS.includes(c)) ?? columns[0];

  // Click cycles: descending → ascending → original order.
  function toggleSort(col: string) {
    setSort((s) => (s?.col === col ? (s.desc ? { col, desc: false } : null) : { col, desc: true }));
    setPage(0);
  }

  async function exportAll() {
    if (!data) return;
    const all: Row[] = [];
    const n = data.matched;
    for (let off = 0; off < n; off += 1000) {
      setExporting(`${Math.min(off + 1000, n)} / ${n}`);
      const d = await fetch(url(off, 1000), { headers: keyHeaders(slug) }).then((r) => r.json()).catch(() => null);
      if (!d?.ok) {
        setExporting(null);
        setError("Export stopped: could not load all rows.");
        return;
      }
      all.push(...d.rows);
    }
    const csv = [columns.map((c) => csvEscape(c)).join(",")].concat(all.map((r) => columns.map((c) => csvEscape(r[c] ?? null)).join(","))).join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href, download: `${slug}_${table}_it${data.iteration}${q ? "_filtered" : ""}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    setExporting(null);
  }

  /** Sends this page of structures to the browser-side ADMET screener. */
  function openInAdmetScreener() {
    if (!data || !smilesCol) return;
    const rows = data.rows
      .map((r) => ({ smiles: typeof r[smilesCol] === "string" ? (r[smilesCol] as string) : "", name: fmt(r[idCol] ?? null) }))
      .filter((r) => r.smiles);
    if (!putAdmetHandoff({ source: `${table} (${slug}), page ${page + 1}`, rows })) {
      setError("Could not open the screener: this browser would not keep the structures for the next page.");
      return;
    }
    router.push(ADMET_PATH);
  }

  const pages = data ? Math.max(1, Math.ceil(data.matched / PAGE)) : 1;
  const incomplete = data?.expected != null && data.total < data.expected;

  return (
    <>
      <div className="vx-step-label">Table</div>
      <h1 className="vx-h1">{table}</h1>
      <p className="vx-lede">
        Iteration {data?.iteration ?? "—"} · {data ? `${data.total.toLocaleString()} rows` : "…"}
        {data && q ? ` · ${data.matched.toLocaleString()} match "${q}"` : ""}. Click a row for all its values{smilesCol ? " and the structure" : ""}; click a column to sort.
        {note ? ` ${note}` : ""}
      </p>
      {incomplete && (
        <p className="vx-badge vx-badge-yellow" style={{ marginBottom: 10 }}>
          Upload not finished: {data!.total.toLocaleString()} of {data!.expected!.toLocaleString()} rows so far.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search all columns (ID, SMILES fragment, flag…)"
          aria-label="Search this table"
          className="rounded-md border px-2 py-1"
          style={{ minWidth: 260, flex: "1 1 260px", maxWidth: 420, background: "var(--vx-surface)", borderColor: "var(--vx-border)", fontSize: 12.5 }}
        />
        <span className="vx-faint" style={{ fontSize: 12 }}>
          {loading ? "Loading…" : data ? `Page ${page + 1} of ${pages}` : ""}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="vx-btn" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <button type="button" className="vx-btn" disabled={page + 1 >= pages || loading} onClick={() => setPage((p) => p + 1)}>Next →</button>
        <button type="button" className="vx-btn" disabled={!data || !!exporting} onClick={exportAll}>
          {exporting ? `Exporting ${exporting}` : `↓ CSV (${(data?.matched ?? 0).toLocaleString()} rows)`}
        </button>
        {smilesCol && (
          <button
            type="button"
            className="vx-btn"
            disabled={!data || data.rows.length === 0 || loading}
            onClick={openInAdmetScreener}
            title="Screen this page of structures for computed properties and rule checks, in your browser"
          >
            Open in ADMET screener
          </button>
        )}
      </div>

      {error && <p style={{ color: "var(--vx-error)", fontSize: 12.5 }}>{error}</p>}

      {data && data.rows.length > 0 && (
        <div className="vx-table-wrap" style={{ maxHeight: "70vh", overflow: "auto" }}>
          <table className="vx-table">
            <caption className="sr-only">{table}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col" className={numeric.has(c) ? "r" : undefined} aria-sort={sort?.col === c ? (sort.desc ? "descending" : "ascending") : undefined}>
                    <button type="button" onClick={() => toggleSort(c)}>
                      {c}
                      {sort?.col === c ? (sort.desc ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} onClick={() => setDetail(r)} style={{ cursor: "pointer" }} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setDetail(r)}>
                  {columns.map((c) => (
                    <td key={c} className={numeric.has(c) ? "r" : undefined} style={c === smilesCol ? { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" } : undefined}>
                      {r[c] == null ? <span className="vx-faint">—</span> : c === idCol ? <span className="vx-id">{fmt(r[c])}</span> : numeric.has(c) ? <span className="vx-num">{fmt(r[c])}</span> : fmt(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.rows.length === 0 && <p className="vx-faint">No rows{q ? ` match "${q}"` : ""}.</p>}

      {detail && (
        <div role="dialog" aria-modal="true" aria-label="Row details" className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetail(null)} style={{ background: "rgba(0,0,0,.35)" }}>
          <div className="vault h-full w-full max-w-md overflow-y-auto p-4" style={{ background: "var(--vx-surface)", borderLeft: "1px solid var(--vx-border)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <strong className="vx-id" style={{ fontSize: 14 }}>{fmt(detail[idCol] ?? null) || "Row"}</strong>
              <span style={{ flex: 1 }} />
              <button type="button" className="vx-btn" onClick={() => setDetail(null)} autoFocus>Close</button>
            </div>
            {smilesCol && typeof detail[smilesCol] === "string" && (
              <div className="vx-panel" style={{ padding: 8, marginBottom: 12, display: "flex", justifyContent: "center", background: "#fff" }}>
                <MoleculeViewer smiles={detail[smilesCol] as string} name={fmt(detail[idCol] ?? null)} width={360} height={240} actions />
              </div>
            )}
            <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, 40%) 1fr", gap: "4px 10px", fontSize: 12.5 }}>
              {columns.map((c) => (
                <div key={c} style={{ display: "contents" }}>
                  <dt className="vx-faint" style={{ wordBreak: "break-word" }}>{c}</dt>
                  <dd style={{ wordBreak: "break-word" }} className={numeric.has(c) ? "vx-num" : undefined}>{detail[c] == null ? "—" : fmt(detail[c])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

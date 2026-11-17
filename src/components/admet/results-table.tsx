"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { MoleculeViewer } from "@/components/molecule-viewer";
import type { ScreenedRow } from "@/lib/admet/screen";
import { hBondTotal } from "@/lib/admet/rules";
import { cn } from "@/lib/utils";

type SortKey =
  | "line"
  | "name"
  | "mw"
  | "clogp"
  | "hbd"
  | "hba"
  | "rotb"
  | "tpsa"
  | "lipinski"
  | "veber"
  | "pains"
  | "brenk";

const COLUMNS: { key: SortKey; label: string; numeric: boolean; title?: string }[] = [
  { key: "name", label: "Name", numeric: false },
  { key: "mw", label: "MW", numeric: true, title: "Average molecular weight, g/mol" },
  { key: "clogp", label: "cLogP", numeric: true, title: "Crippen calculated logP" },
  { key: "hbd", label: "HBD", numeric: true, title: "Hydrogen-bond donors (OH and NH hydrogens)" },
  { key: "hba", label: "HBA", numeric: true, title: "Hydrogen-bond acceptors (N and O atoms)" },
  { key: "rotb", label: "RotB", numeric: true, title: "Rotatable bonds" },
  { key: "tpsa", label: "TPSA", numeric: true, title: "Topological polar surface area, Å²" },
  { key: "lipinski", label: "Ro5", numeric: true, title: "Lipinski rule-of-5 thresholds crossed" },
  { key: "veber", label: "Veber", numeric: true, title: "Veber criteria thresholds crossed" },
  { key: "pains", label: "PAINS", numeric: true, title: "Matching PAINS patterns" },
  { key: "brenk", label: "Brenk", numeric: true, title: "Matching Brenk patterns" },
];

/** Sort value for a row; rows that failed to parse have none and sink to the end. */
function valueOf(row: ScreenedRow, key: SortKey): number | string | null {
  if (key === "line") return row.line;
  if (key === "name") return (row.name || row.smiles).toLowerCase();
  const d = row.descriptors;
  if (!d) return null;
  switch (key) {
    case "mw":
      return d.mw;
    case "clogp":
      return d.clogp;
    case "hbd":
      return d.hbdLipinski;
    case "hba":
      return d.hbaLipinski;
    case "rotb":
      return d.rotatableBonds;
    case "tpsa":
      return d.tpsa;
    case "lipinski":
      return row.lipinski?.violations.length ?? null;
    case "veber":
      return row.veber?.violations.length ?? null;
    case "pains":
      return row.alerts?.PAINS.length ?? null;
    case "brenk":
      return row.alerts?.Brenk.length ?? null;
    default:
      return null;
  }
}

const fmt = (n: number | undefined, places: number) =>
  n === undefined || Number.isNaN(n) ? "—" : n.toFixed(places);

function RuleCell({ result }: { result?: { pass: boolean; violations: { text: string }[] } }) {
  if (!result) return <span className="text-muted-foreground">&mdash;</span>;
  if (result.pass) return <span className="text-emerald-700 dark:text-emerald-400">Pass</span>;
  return (
    <span className="text-amber-700 dark:text-amber-400" title={result.violations.map((v) => v.text).join("; ")}>
      {result.violations.length}
    </span>
  );
}

function AlertCell({ names, tone }: { names: string[] | undefined; tone: "pains" | "brenk" }) {
  if (!names) return <span className="text-muted-foreground">&mdash;</span>;
  if (names.length === 0) return <span className="text-emerald-700 dark:text-emerald-400">0</span>;
  return (
    <span
      className={cn(
        tone === "pains" ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400",
        "font-medium"
      )}
      title={names.join("; ")}
    >
      {names.length}
    </span>
  );
}

export function ResultsTable({ rows }: { rows: ScreenedRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "line", desc: false });
  const [open, setOpen] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = valueOf(a, sort.key);
      const bv = valueOf(b, sort.key);
      if (av === null && bv === null) return a.line - b.line;
      if (av === null) return 1; // unreadable rows last, whichever way we sort
      if (bv === null) return -1;
      const cmp = typeof av === "string" || typeof bv === "string" ? String(av).localeCompare(String(bv)) : av - bv;
      return sort.desc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Computed descriptors and rule checks, one row per input structure. Click a column to sort, or a row for
          detail.
        </caption>
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th scope="col" className="w-8" />
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                title={c.title}
                aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                className={cn("px-2 py-2 font-medium", c.numeric ? "text-right" : "text-left")}
              >
                <button
                  type="button"
                  onClick={() => toggle(c.key)}
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  {c.label}
                  {sort.key === c.key ? (sort.desc ? "↓" : "↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const isOpen = open === row.line;
            const d = row.descriptors;
            return (
              <Fragment key={row.line}>
                <tr className={cn("border-t hover:bg-muted/40", row.error && "bg-rose-50/60 dark:bg-rose-950/20")}>
                  <td className="px-1 py-1.5 align-top">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : row.line)}
                      aria-expanded={isOpen}
                      aria-label={`Detail for ${row.name || row.smiles}`}
                      className="rounded p-1 hover:bg-muted"
                    >
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="max-w-[22rem] px-2 py-1.5">
                    <span className="font-medium">{row.name || `Line ${row.line}`}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{row.smiles}</span>
                    {row.error && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-rose-700 dark:text-rose-400">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        {row.error}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.mw, 1)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.clogp, 2)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.hbdLipinski, 0)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.hbaLipinski, 0)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.rotatableBonds, 0)}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{fmt(d?.tpsa, 1)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <RuleCell result={row.lipinski} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <RuleCell result={row.veber} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <AlertCell names={row.alerts?.PAINS} tone="pains" />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <AlertCell names={row.alerts?.Brenk} tone="brenk" />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t bg-muted/20">
                    <td />
                    <td colSpan={COLUMNS.length} className="px-2 py-3">
                      <div className="flex flex-wrap gap-6">
                        {!row.error && (
                          <div className="rounded-md border bg-white p-2">
                            <MoleculeViewer
                              smiles={row.smiles}
                              name={row.name || `line-${row.line}`}
                              width={240}
                              height={180}
                              actions
                            />
                          </div>
                        )}
                        <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                          {d && (
                            <>
                              <dt className="text-muted-foreground">Exact mass</dt>
                              <dd className="font-mono">{fmt(d.exactMw, 4)}</dd>
                              <dt className="text-muted-foreground">Heavy atoms</dt>
                              <dd className="font-mono">{fmt(d.heavyAtoms, 0)}</dd>
                              <dt className="text-muted-foreground">Aromatic rings</dt>
                              <dd className="font-mono">{fmt(d.aromaticRings, 0)}</dd>
                              <dt className="text-muted-foreground">Fraction sp3 carbon</dt>
                              <dd className="font-mono">{fmt(d.fractionCsp3, 3)}</dd>
                              <dt className="text-muted-foreground">HBD / HBA (RDKit refined)</dt>
                              <dd className="font-mono">
                                {fmt(d.hbd, 0)} / {fmt(d.hba, 0)}
                              </dd>
                              <dt className="text-muted-foreground">Donors + acceptors</dt>
                              <dd className="font-mono">
                                {hBondTotal(d)} <span className="text-muted-foreground">(Veber alternative: &le; 12)</span>
                              </dd>
                            </>
                          )}
                          {row.canonicalSmiles && (
                            <>
                              <dt className="text-muted-foreground">Canonical SMILES</dt>
                              <dd className="break-all font-mono">{row.canonicalSmiles}</dd>
                            </>
                          )}
                          {row.lipinski && row.lipinski.violations.length > 0 && (
                            <>
                              <dt className="text-muted-foreground">Ro5 thresholds crossed</dt>
                              <dd>{row.lipinski.violations.map((v) => v.text).join(", ")}</dd>
                            </>
                          )}
                          {row.veber && row.veber.violations.length > 0 && (
                            <>
                              <dt className="text-muted-foreground">Veber thresholds crossed</dt>
                              <dd>{row.veber.violations.map((v) => v.text).join(", ")}</dd>
                            </>
                          )}
                          {row.alerts && row.alerts.PAINS.length > 0 && (
                            <>
                              <dt className="text-muted-foreground">PAINS patterns</dt>
                              <dd className="font-mono text-[11px]">{row.alerts.PAINS.join(", ")}</dd>
                            </>
                          )}
                          {row.alerts && row.alerts.Brenk.length > 0 && (
                            <>
                              <dt className="text-muted-foreground">Brenk patterns</dt>
                              <dd className="font-mono text-[11px]">{row.alerts.Brenk.join(", ")}</dd>
                            </>
                          )}
                          {row.alerts && row.alerts.PAINS.length === 0 && row.alerts.Brenk.length === 0 && (
                            <>
                              <dt className="text-muted-foreground">Substructure alerts</dt>
                              <dd>No PAINS or Brenk pattern matched.</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { MoleculeViewer } from "@/components/molecule-viewer";
import { GlossaryTerm } from "@/components/glossary-term";
import type { GlossaryKey } from "@/data/glossary";
import {
  CHEMBL_RELEASE,
  CHEMBL_RETRIEVED,
  referenceCompounds,
  type ReferenceCompound,
} from "@/data/curated/chembl-reference-compounds";

type SortKey = "name" | "mw" | "alogp" | "qed";
type SortDir = "asc" | "desc";

const targetOptions = Array.from(new Set(referenceCompounds.flatMap((c) => c.mechanismTargets))).sort();

const phaseLabel = (p: number) => (p >= 4 ? "Approved (ChEMBL max phase 4)" : `ChEMBL max phase ${p}`);

function SortHeader({
  field,
  label,
  term,
  sortKey,
  sortDir,
  onSort,
}: {
  field: SortKey;
  label: string;
  term?: GlossaryKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      aria-sort={sortKey === field ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
    >
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSort(field)}
          className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
        >
          {label}
          {sortKey === field && (
            <span className="text-foreground" aria-hidden="true">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
          )}
        </button>
        {term && <GlossaryTerm k={term} iconOnly />}
      </span>
    </th>
  );
}

export default function CompoundsPage() {
  return (
    <Suspense>
      <CompoundsContent />
    </Suspense>
  );
}

function CompoundsContent() {
  const initialTarget = (useSearchParams().get("target") ?? "").toUpperCase();
  const [search, setSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState<string>(initialTarget || "all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = referenceCompounds.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(q) ||
        c.chemblId.toLowerCase().includes(q) ||
        c.mechanismTargets.some((t) => t.toLowerCase().includes(q));
      const matchTarget = targetFilter === "all" || c.mechanismTargets.some((t) => t.toUpperCase() === targetFilter.toUpperCase());
      return matchSearch && matchTarget;
    });
    return [...result].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = typeof aVal === "number" ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [search, sortKey, sortDir, targetFilter]);

  const csvRows = filtered.map((c: ReferenceCompound) => ({
    name: c.name,
    chembl_id: c.chemblId,
    smiles: c.smiles,
    mw: c.mw,
    alogp: c.alogp,
    qed: c.qed,
    max_phase: c.maxPhase,
    mechanism_targets: c.mechanismTargets,
    action_types: c.actionTypes,
    data_status: "curated from ChEMBL",
    chembl_release: CHEMBL_RELEASE,
  }));


  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reference compounds</h1>
        <p className="text-muted-foreground mt-1">
          Approved drugs used as reference points across the site. Structures, properties and mechanism targets are
          copied from ChEMBL parent records. Search all of ChEMBL on{" "}
          <Link href="/search" className="text-primary hover:underline">
            Compound search
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Filter by name, ChEMBL ID or target..."
              aria-label="Filter reference compounds"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              aria-label="Filter by mechanism target"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All mechanism targets</option>
              {initialTarget && !targetOptions.some((t) => t.toUpperCase() === initialTarget) && (
                <option value={initialTarget}>{initialTarget}</option>
              )}
              {targetOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ExportCsvButton rows={csvRows} filename="reference-compounds" source={{ name: `ChEMBL ${CHEMBL_RELEASE.replace("ChEMBL_", "")}`, retrieved: CHEMBL_RETRIEVED }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <SortHeader field="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ChEMBL ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <GlossaryTerm k="smiles">Structure</GlossaryTerm>
                  </th>
                  <SortHeader field="mw" label="MW" term="mw" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader field="alogp" label="ALogP" term="alogp" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader field="qed" label="QED" term="qed" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <GlossaryTerm k="maxPhase">Status</GlossaryTerm>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Mechanism targets (ChEMBL)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((c) => (
                  <tr key={c.chemblId} className="hover:bg-muted/50 transition-colors align-top">
                    <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm font-mono">
                      <a
                        href={`https://www.ebi.ac.uk/chembl/compound_report_card/${c.chemblId}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {c.chemblId}
                      </a>
                    </td>
                    <td className="px-4 py-2" title={c.smiles}>
                      <MoleculeViewer smiles={c.smiles} name={c.name} width={130} height={85} />
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">{c.mw.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{c.alogp.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{c.qed.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">{phaseLabel(c.maxPhase)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {c.mechanismTargets.map((t) =>
                          /^[A-Z0-9-]+$/.test(t) ? (
                            <Link key={t} href={`/targets?q=${encodeURIComponent(t)}`} className="text-primary hover:underline">
                              {t}
                            </Link>
                          ) : (
                            <span key={t}>{t}</span>
                          )
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">{c.actionTypes.join(", ")}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No reference compound matches.
                      {targetFilter !== "all" && (
                        <>
                          {" "}
                          <Link href={`/search?q=${encodeURIComponent(targetFilter)}`} className="text-primary hover:underline">
                            Search ChEMBL compound names containing &ldquo;{targetFilter}&rdquo;
                          </Link>
                          {" · "}
                          <a
                            href={`https://platform.opentargets.org/search?q=${encodeURIComponent(targetFilter)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Drugs known to act on {targetFilter} (Open Targets)
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Showing {filtered.length} of {referenceCompounds.length} reference compounds. Source:{" "}
            <a href="https://www.ebi.ac.uk/chembl/" target="_blank" rel="noopener noreferrer" className="underline">
              ChEMBL
            </a>{" "}
            release {CHEMBL_RELEASE.replace("ChEMBL_", "")}, parent molecule records and mechanism data, retrieved {CHEMBL_RETRIEVED}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

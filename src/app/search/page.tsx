"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { MoleculeViewer } from "@/components/molecule-viewer";
import { cn } from "@/lib/utils";

interface SearchResult {
  chemblId: string;
  name: string;
  smiles: string | null;
  mw: number | null;
  logP: number | null;
  hba: number | null;
  hbd: number | null;
  psa: number | null;
  qed: number | null;
  maxPhase: number;
  moleculeType: string;
}

interface SourceInfo {
  name: string;
  url: string;
  retrieved: string;
}

const fmt = (v: number | null, digits: number) => (v === null ? "—" : v.toFixed(digits));

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSubmitted(q.trim());

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search request failed");
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setSource(data.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch search results. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const phaseLabel = (phase: number) => {
    if (phase >= 4) return "Approved";
    if (phase >= 1) return `Phase ${Math.floor(phase)}`;
    return "Preclinical";
  };

  const phaseClass = (phase: number) => {
    if (phase >= 4) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (phase >= 1) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  const searched = submitted !== "";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search ChEMBL</h1>
        <p className="text-muted-foreground mt-1">
          Live compound search against the EMBL-EBI ChEMBL database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compound Search</CardTitle>
          <CardDescription>Enter a compound name, synonym, or ChEMBL ID</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. vemurafenib, ruxolitinib, CHEMBL25..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {searched && !loading && !error && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Results</CardTitle>
                <CardDescription>
                  {results.length > 0
                    ? `Showing ${results.length} of ${total} compound${total === 1 ? "" : "s"} matching "${submitted}"`
                    : `No results found for "${submitted}"`}
                </CardDescription>
              </div>
              {results.length > 0 && (
                <ExportCsvButton rows={results} filename={`chembl-${submitted}`} />
              )}
            </div>
          </CardHeader>
          {results.length > 0 && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      {["Structure", "ChEMBL ID", "Name", "Type", "MW", "LogP", "HBA/HBD", "PSA", "QED", "Phase"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r) => (
                      <tr key={r.chemblId} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-2">
                          {r.smiles ? (
                            <div title={r.smiles}>
                              <MoleculeViewer smiles={r.smiles} width={140} height={90} />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{"—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono">
                          <a
                            href={`https://www.ebi.ac.uk/chembl/compound_report_card/${r.chemblId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {r.chemblId}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.moleculeType}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">{fmt(r.mw, 2)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">{fmt(r.logP, 2)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">
                          {r.hba ?? "—"}/{r.hbd ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">{fmt(r.psa, 1)}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">{fmt(r.qed, 2)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", phaseClass(r.maxPhase))}>
                            {phaseLabel(r.maxPhase)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {source && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Source:{" "}
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                    {source.name}
                  </a>{" "}
                  (live query), retrieved {new Date(source.retrieved).toLocaleString()}
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {!searched && !loading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Enter a search query to get started</p>
              <p className="text-sm mt-1">
                Search by compound name, drug name, or ChEMBL identifier
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

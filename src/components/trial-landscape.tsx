"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { SourceLine } from "@/components/data-provenance";
import { cn } from "@/lib/utils";

interface TrialRow {
  nctId: string;
  title: string;
  phases: string[];
  status: string;
  sponsor: string;
  conditions: string[];
  interventions: string[];
  startDate: string;
  enrollment: number | null;
}

interface Source {
  name: string;
  url: string;
  retrieved: string;
}

const PHASE_OPTIONS: [string, string][] = [
  ["", "Any phase"],
  ["EARLY_PHASE1", "Early Phase 1"],
  ["PHASE1", "Phase 1"],
  ["PHASE2", "Phase 2"],
  ["PHASE3", "Phase 3"],
  ["PHASE4", "Phase 4"],
];

const STATUS_OPTIONS: [string, string][] = [
  ["", "Any status"],
  ["RECRUITING", "Recruiting"],
  ["NOT_YET_RECRUITING", "Not yet recruiting"],
  ["ACTIVE_NOT_RECRUITING", "Active, not recruiting"],
  ["COMPLETED", "Completed"],
  ["TERMINATED", "Terminated"],
];

const pretty = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const prettyPhase = (p: string) => (p === "NA" ? "N/A" : p.replace("EARLY_PHASE", "Early Ph ").replace("PHASE", "Ph "));

const statusClass = (s: string) =>
  s === "RECRUITING"
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    : s === "COMPLETED"
      ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";

const selectClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function TrialLandscape({ initialTerm }: { initialTerm: string }) {
  const [term, setTerm] = useState(initialTerm);
  const [condition, setCondition] = useState("cancer");
  const [phase, setPhase] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append: string | null) => {
      if (!term.trim()) return;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ term: term.trim() });
      if (condition.trim()) params.set("condition", condition.trim());
      if (phase) params.set("phase", phase);
      if (status) params.set("status", status);
      if (append) params.set("pageToken", append);
      try {
        const res = await fetch(`/api/trials?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Trial search failed");
        setRows((prev) => (append ? [...prev, ...data.results] : data.results));
        setTotal(data.total);
        setNextToken(data.nextPageToken);
        setSource(data.source);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Trial search failed");
        if (!append) setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [term, condition, phase, status]
  );

  useEffect(() => {
    load(null);
    // Re-query when filters change; free-text fields submit via the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search registered trials</CardTitle>
          <CardDescription>
            Searches ClinicalTrials.gov. Keep a condition set when searching gene symbols &mdash; e.g. &ldquo;EGFR&rdquo;
            alone also matches kidney trials that measure eGFR (glomerular filtration rate).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(null);
            }}
            className="flex flex-col gap-3 md:flex-row md:flex-wrap"
          >
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Target, drug or keyword (e.g. EGFR, osimertinib)"
              aria-label="Search term"
              maxLength={100}
              className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="Condition (optional)"
              aria-label="Condition"
              maxLength={100}
              className="md:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select value={phase} onChange={(e) => setPhase(e.target.value)} aria-label="Phase" className={selectClass}>
              {PHASE_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={selectClass}>
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading || !term.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading && rows.length === 0 ? "Searching..." : "Search"}
            </button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && source && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Results</CardTitle>
                <CardDescription>
                  Showing {rows.length} of {total.toLocaleString()} trial{total === 1 ? "" : "s"}
                </CardDescription>
              </div>
              <ExportCsvButton
                rows={rows}
                filename={`ctgov-${term.trim()}`}
                source={{ name: source.name, retrieved: source.retrieved }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {["NCT ID", "Title", "Phase", "Status", "Sponsor", "Interventions", "Start", "N"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.nctId} className="align-top hover:bg-muted/40">
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <a
                          href={`https://clinicaltrials.gov/study/${r.nctId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {r.nctId}
                        </a>
                      </td>
                      <td className="px-3 py-2 min-w-[240px]">{r.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.phases.map(prettyPhase).join(" / ")}</td>
                      <td className="px-3 py-2">
                        {r.status && (
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", statusClass(r.status))}>
                            {pretty(r.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[140px]">{r.sponsor}</td>
                      <td className="px-3 py-2 min-w-[160px] text-muted-foreground">{r.interventions.join("; ")}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.startDate}</td>
                      <td className="px-3 py-2 tabular-nums">{r.enrollment ?? ""}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                        No registered trials match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <SourceLine name={source.name} url={source.url} retrieved={source.retrieved} />
              {nextToken && (
                <button
                  onClick={() => load(nextToken)}
                  disabled={loading}
                  className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Load 25 more"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

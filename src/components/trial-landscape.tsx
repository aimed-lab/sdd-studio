"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { SourceLine } from "@/components/data-provenance";
import { cn } from "@/lib/utils";

interface TrialRow {
  nctId: string;
  url: string | null;
  title: string;
  phases: string[];
  status: string;
  sponsor: string;
  conditions: string[];
  keywords: string[];
  interventions: string[];
  interventionDetails: { name: string; type: string }[];
  startDate: string;
  lastUpdate: string;
  enrollment: number | null;
  symbolMatch: "direct" | "via_drug" | "eligibility_or_outcome_only" | null;
  viaDrug?: string[] | null;
}

interface Source {
  name: string;
  url: string;
  queryUrl?: string;
  retrieved: string;
}

interface Disambiguation {
  symbol: string;
  exclude: string;
  reason: string;
  applied: boolean;
  queryTerm: string;
}

interface DrugAware {
  applied: boolean;
  note: string | null;
  queryTerm: string;
  targets: { chemblId: string; name: string }[];
  drugs: { name: string; chemblId: string; firstApproval: number | null }[];
  omitted: string[];
  excluded?: { name: string; chemblId: string; primaryTarget: string; reason: string; sourceUrl: string }[];
  selection: string;
  source: Source & { release?: { version: string; date: string | null } };
}

interface Summary {
  total: number;
  counted: number;
  exact: boolean;
  note: string;
  byPhase: { label: string; n: number }[];
  byStatus: { label: string; n: number }[];
  bySponsor: { label: string; n: number }[];
}

export interface TrialFilters {
  term: string;
  condition: string;
  intervention: string;
  location: string;
  phase: string;
  status: string;
  disambiguate: boolean;
  fieldsGeneOnly: boolean;
  /** Opt-in (#57 option c): also search approved drugs acting on the gene, per ChEMBL. */
  drugAware?: boolean;
}

const PHASE_OPTIONS: [string, string][] = [
  ["", "Any phase"],
  ["EARLY_PHASE1", "Early Phase 1"],
  ["PHASE1", "Phase 1 (incl. Phase 1/2)"],
  ["PHASE2", "Phase 2 (incl. Phase 1/2, 2/3)"],
  ["PHASE3", "Phase 3 (incl. Phase 2/3)"],
  ["PHASE4", "Phase 4"],
];

const STATUS_OPTIONS: [string, string][] = [
  ["", "Any status"],
  ["RECRUITING", "Recruiting"],
  ["NOT_YET_RECRUITING", "Not yet recruiting"],
  ["ACTIVE_NOT_RECRUITING", "Active, not recruiting"],
  ["ENROLLING_BY_INVITATION", "Enrolling by invitation"],
  ["COMPLETED", "Completed"],
  ["TERMINATED", "Terminated"],
  ["SUSPENDED", "Suspended"],
  ["WITHDRAWN", "Withdrawn"],
];

const LINKABLE_INTERVENTIONS = new Set(["DRUG", "BIOLOGICAL"]);
const SINGLE_TOKEN = /^[A-Za-z0-9-]{2,15}$/;

const pretty = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const prettyPhase = (p: string) => (p === "NA" ? "N/A" : p.replace("EARLY_PHASE", "Early Ph ").replace("PHASE", "Ph "));
const prettyPhases = (label: string) => label.split("/").map(prettyPhase).join("/");

const statusClass = (s: string) =>
  s === "RECRUITING"
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    : s === "COMPLETED"
      ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";

const inputClass = "rounded-md border border-input bg-background px-3 py-2 text-sm";
const selectClass = `${inputClass} focus:outline-none focus:ring-2 focus:ring-ring`;

export function filtersToParams(f: TrialFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.term.trim()) p.set("term", f.term.trim());
  if (f.condition.trim()) p.set("condition", f.condition.trim());
  if (f.intervention.trim()) p.set("intervention", f.intervention.trim());
  if (f.location.trim()) p.set("location", f.location.trim());
  if (f.phase) p.set("phase", f.phase);
  if (f.status) p.set("status", f.status);
  if (!f.disambiguate) p.set("disambiguate", "false");
  if (f.fieldsGeneOnly) p.set("fieldsGeneOnly", "true");
  if (f.drugAware && !f.fieldsGeneOnly && SINGLE_TOKEN.test(f.term.trim())) p.set("mode", "drug-aware");
  return p;
}

const hasQuery = (f: TrialFilters) =>
  !!(f.term.trim() || f.condition.trim() || f.intervention.trim() || f.location.trim());

function Interventions({ items }: { items: { name: string; type: string }[] }) {
  return (
    <>
      {items.map((i, idx) => (
        <span key={`${i.name}-${idx}`}>
          {idx > 0 && "; "}
          {LINKABLE_INTERVENTIONS.has(i.type) ? (
            <Link
              href={`/search?q=${encodeURIComponent(i.name)}`}
              title={`Search ChEMBL for ${i.name}`}
              className="text-primary hover:underline"
            >
              {i.name}
            </Link>
          ) : (
            i.name
          )}
        </span>
      ))}
    </>
  );
}

function MatchNote({ row, term, ambiguous }: { row: TrialRow; term: string; ambiguous: Disambiguation | null }) {
  if (row.symbolMatch === "via_drug" && row.viaDrug?.length) {
    return (
      <p className="mt-1 text-xs text-sky-700 dark:text-sky-400">
        Added by drug name: {row.viaDrug.join(", ")} (approved drug acting on {term}, per ChEMBL).
      </p>
    );
  }
  if (row.symbolMatch !== "eligibility_or_outcome_only") return null;
  if (row.viaDrug === null) {
    return (
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
        Neither &ldquo;{term}&rdquo; nor an added drug name appears in the title, conditions or interventions; the match is in
        other text (e.g. eligibility, outcomes or a brand-name synonym).
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
      &ldquo;{term}&rdquo; appears only in eligibility or outcome text
      {ambiguous ? ` — may refer to ${ambiguous.symbol === "EGFR" ? "eGFR (kidney function)" : "another meaning"}` : ""}.
    </p>
  );
}

function TrialTable({ rows, term, ambiguous }: { rows: TrialRow[]; term: string; ambiguous: Disambiguation | null }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              {["NCT ID", "Title", "Conditions", "Phase", "Status", "Sponsor", "Interventions", "Start", "Updated", "N"].map((h) => (
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
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {r.nctId}
                    </a>
                  ) : (
                    r.nctId
                  )}
                </td>
                <td className="px-3 py-2 min-w-[240px]">
                  {r.title}
                  <MatchNote row={r} term={term} ambiguous={ambiguous} />
                </td>
                <td className="px-3 py-2 min-w-[160px] text-muted-foreground">{r.conditions.join("; ")}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.phases.map(prettyPhase).join(" / ")}</td>
                <td className="px-3 py-2">
                  {r.status && (
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", statusClass(r.status))}>
                      {pretty(r.status)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 min-w-[140px]">{r.sponsor}</td>
                <td className="px-3 py-2 min-w-[160px] text-muted-foreground">
                  <Interventions items={r.interventionDetails} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.startDate}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.lastUpdate}</td>
                <td className="px-3 py-2 tabular-nums">{r.enrollment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-3">
        {rows.map((r) => (
          <li key={r.nctId} className="rounded-lg border p-3 text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">
                  {r.nctId}
                </a>
              ) : (
                <span className="font-mono">{r.nctId}</span>
              )}
              {r.status && (
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusClass(r.status))}>
                  {pretty(r.status)}
                </span>
              )}
            </div>
            <p className="font-medium">{r.title}</p>
            <MatchNote row={r} term={term} ambiguous={ambiguous} />
            <p className="text-xs text-muted-foreground">
              {[r.phases.map(prettyPhase).join(" / "), r.sponsor, r.enrollment ? `N=${r.enrollment}` : ""].filter(Boolean).join(" · ")}
            </p>
            {r.conditions.length > 0 && <p className="text-xs text-muted-foreground">Conditions: {r.conditions.join("; ")}</p>}
            {r.interventionDetails.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Interventions: <Interventions items={r.interventionDetails} />
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Start {r.startDate || "—"} · Updated {r.lastUpdate || "—"}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function csvRows(rows: TrialRow[], f: TrialFilters, total: number, disambiguation: Disambiguation | null, drugAware: DrugAware | null) {
  const span = `rows 1-${rows.length} of ${total}${rows.length < total ? " (partial export)" : ""}`;
  return rows.map((r) => ({
    query_term: f.term,
    query_condition: f.condition,
    query_intervention: f.intervention,
    query_location: f.location,
    query_phase: f.phase,
    query_status: f.status,
    query_mode: drugAware ? "drug-aware" : "default",
    query_sent: drugAware?.queryTerm ?? disambiguation?.queryTerm ?? f.term,
    export_rows: span,
    nctId: r.nctId,
    url: r.url ?? "",
    title: r.title,
    conditions: r.conditions.join("; "),
    phases: r.phases.join("/"),
    status: r.status,
    sponsor: r.sponsor,
    interventions: r.interventions.join("; "),
    startDate: r.startDate,
    lastUpdate: r.lastUpdate,
    enrollment: r.enrollment ?? "",
    symbolMatch: r.symbolMatch ?? "",
    viaDrug: r.viaDrug?.join("; ") ?? "",
  }));
}

export function TrialLandscape({
  initial,
  onSearch,
}: {
  initial: TrialFilters;
  onSearch?: (filters: TrialFilters) => void;
}) {
  const [draft, setDraft] = useState<TrialFilters>(initial);
  const [active, setActive] = useState<TrialFilters>(initial);
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [disambiguation, setDisambiguation] = useState<Disambiguation | null>(null);
  const [drugAware, setDrugAware] = useState<DrugAware | null>(null);
  const [excludedCount, setExcludedCount] = useState<number | null | "counting">(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [hiddenRows, setHiddenRows] = useState<TrialRow[]>([]);
  const [hiddenTotal, setHiddenTotal] = useState<number | null>(null);
  const [hiddenToken, setHiddenToken] = useState<string | null>(null);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [hiddenError, setHiddenError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const inFlight = useRef<AbortController | null>(null);
  const sideFlight = useRef<AbortController | null>(null);

  const load = useCallback(async (filters: TrialFilters, append: string | null) => {
    if (!hasQuery(filters)) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    if (!append) {
      sideFlight.current?.abort();
      setNextToken(null);
      setHiddenOpen(false);
      setHiddenRows([]);
      setHiddenTotal(null);
      setHiddenToken(null);
      setHiddenError(null);
      setSummary(null);
      setSummaryError(null);
      setExcludedCount(null);
    }
    setLoading(true);
    setError(null);
    const params = filtersToParams(filters);
    if (append) params.set("pageToken", append);
    try {
      const res = await fetch(`/api/trials?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(data.error ?? "Trial search failed");
      setRows((prev) => (append ? [...prev, ...data.results] : data.results));
      setTotal(data.total);
      setNextToken(data.nextPageToken);
      setSource(data.source);
      setDisambiguation(data.disambiguation);
      setDrugAware(data.drugAware ?? null);
      if (!append && data.disambiguation?.applied) {
        // Counted only after the results render, as one cached count-only request.
        const side = new AbortController();
        sideFlight.current = side;
        setExcludedCount("counting");
        const countParams = filtersToParams(filters);
        countParams.set("withExcludedCount", "true");
        fetch(`/api/trials?${countParams}`, { signal: side.signal })
          .then((r) => r.json())
          .then((d) => !side.signal.aborted && setExcludedCount(typeof d.excludedCount === "number" ? d.excludedCount : null))
          .catch(() => !side.signal.aborted && setExcludedCount(null));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Trial search failed");
      if (!append) setRows([]);
    } finally {
      if (inFlight.current === controller) setLoading(false);
    }
  }, []);

  const loadHidden = async (append: string | null) => {
    setHiddenOpen(true);
    setHiddenLoading(true);
    setHiddenError(null);
    const params = filtersToParams({ ...active, drugAware: false });
    params.set("view", "excluded");
    if (append) params.set("pageToken", append);
    try {
      const res = await fetch(`/api/trials?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load hidden trials");
      setHiddenRows((prev) => (append ? [...prev, ...data.results] : data.results));
      setHiddenTotal(data.total);
      setHiddenToken(data.nextPageToken);
    } catch (err) {
      setHiddenError(err instanceof Error ? err.message : "Could not load hidden trials");
    } finally {
      setHiddenLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    const params = filtersToParams(active);
    params.set("view", "summary");
    try {
      const res = await fetch(`/api/trials?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the summary");
      setSummary(data);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Could not load the summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const submit = (filters: TrialFilters) => {
    setDraft(filters);
    setActive(filters);
    onSearch?.(filters);
    load(filters, null);
  };

  useEffect(() => {
    load(initial, null);
    // Initial filters only; later searches go through submit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: keyof TrialFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const termIsSymbol = SINGLE_TOKEN.test(draft.term.trim());
  const ambiguous = disambiguation?.applied ? disambiguation : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search registered trials</CardTitle>
          <CardDescription>
            Searches ClinicalTrials.gov. Gene symbols that collide with other terms (e.g. EGFR vs eGFR, a kidney-function
            measure) are disambiguated by default; excluded trials stay one click away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input value={draft.term} onChange={set("term")} placeholder="Target or keyword (e.g. EGFR)" aria-label="Search term" maxLength={100} className={inputClass} />
              <input value={draft.condition} onChange={set("condition")} placeholder="Condition (e.g. non-small cell lung cancer)" aria-label="Condition" maxLength={100} className={inputClass} />
              <input value={draft.intervention} onChange={set("intervention")} placeholder="Intervention / drug (e.g. osimertinib)" aria-label="Intervention" maxLength={100} className={inputClass} />
              <input value={draft.location} onChange={set("location")} placeholder="Location (e.g. Birmingham, Alabama)" aria-label="Location" maxLength={100} className={inputClass} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select value={draft.phase} onChange={set("phase")} aria-label="Phase" className={selectClass}>
                {PHASE_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={draft.status} onChange={set("status")} aria-label="Status" className={selectClass}>
                {STATUS_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              {termIsSymbol && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={draft.fieldsGeneOnly} onChange={set("fieldsGeneOnly")} />
                  Gene in title, condition, keyword or intervention only
                </label>
              )}
              {termIsSymbol && (
                <label
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  title="Adds approved drugs whose ChEMBL mechanism of action targets this gene (at most 10), so trials that name only the drug are found too."
                >
                  <input
                    type="checkbox"
                    checked={!!draft.drugAware && !draft.fieldsGeneOnly}
                    disabled={draft.fieldsGeneOnly}
                    onChange={set("drugAware")}
                  />
                  Also search approved drugs for this target
                </label>
              )}
              <button
                type="submit"
                disabled={loading || !hasQuery(draft)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading && rows.length === 0 ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!error && disambiguation && (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {disambiguation.applied ? (
            <>
              Excluded trials mentioning &ldquo;{disambiguation.exclude}&rdquo; ({disambiguation.reason}){" "}
              <strong>
                {excludedCount === "counting"
                  ? "Counting hidden trials…"
                  : typeof excludedCount === "number"
                    ? `${excludedCount.toLocaleString()} trial${excludedCount === 1 ? "" : "s"} hidden.`
                    : "An unknown number of trials hidden."}
              </strong>{" "}
              <button type="button" onClick={() => (hiddenOpen ? setHiddenOpen(false) : loadHidden(null))} className="underline">
                {hiddenOpen ? "Hide them" : "Show them"}
              </button>
              {" · "}
              <button type="button" onClick={() => submit({ ...active, disambiguate: false })} className="underline">
                Turn off
              </button>
            </>
          ) : (
            <>
              Disambiguation for &ldquo;{disambiguation.symbol}&rdquo; is off, so results may include {disambiguation.exclude} (kidney-function) matches.{" "}
              <button type="button" onClick={() => submit({ ...active, disambiguate: true })} className="underline">
                Turn on
              </button>
            </>
          )}
        </div>
      )}

      {!error && drugAware && (
        <div role="status" className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
          {drugAware.applied ? (
            <>
              <strong>Drug-aware search:</strong> also matching {drugAware.drugs.length} approved drug
              {drugAware.drugs.length === 1 ? "" : "s"} acting on {active.term.trim()} (ChEMBL{" "}
              {drugAware.targets.map((t) => t.chemblId).join(", ")}):{" "}
              {drugAware.drugs.map((d, i) => (
                <span key={d.chemblId}>
                  {i > 0 && ", "}
                  <Link href={`/search?q=${d.chemblId}`} className="underline">
                    {d.name}
                  </Link>
                </span>
              ))}
              .{" "}
              {drugAware.omitted.length > 0 && <>Not included (cap of 10): {drugAware.omitted.join(", ")}. </>}
              {drugAware.excluded?.map((d) => (
                <span key={d.chemblId}>
                  Left out: {d.name}, whose primary target is {d.primaryTarget} (
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {d.reason}
                  </a>
                  ).{" "}
                </span>
              ))}
              Trials found only through a drug are marked &ldquo;Added by drug name&rdquo;.{" "}
            </>
          ) : (
            <>{drugAware.note} </>
          )}
          <button type="button" onClick={() => submit({ ...active, drugAware: false })} className="underline">
            Turn off
          </button>
          <span className="block text-xs mt-1 opacity-80">
            {drugAware.selection}
            {drugAware.source.release ? ` ${drugAware.source.release.version}.` : ""}
          </span>
        </div>
      )}

      {!error && hiddenOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Possible kidney-function matches{hiddenTotal !== null ? ` (${hiddenTotal.toLocaleString()})` : ""}
            </CardTitle>
            <CardDescription>
              Trials that mention &ldquo;{disambiguation?.exclude}&rdquo;. These may include real {disambiguation?.symbol} trials
              (e.g. NCT03066206) — review before discarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hiddenError && <p className="text-sm text-destructive">{hiddenError}</p>}
            {hiddenLoading && hiddenRows.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
            {hiddenRows.length > 0 && <TrialTable rows={hiddenRows} term={active.term} ambiguous={null} />}
            {hiddenToken && (
              <button onClick={() => loadHidden(hiddenToken)} disabled={hiddenLoading} className="mt-3 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                {hiddenLoading ? "Loading..." : "Load 25 more"}
              </button>
            )}
          </CardContent>
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
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={loadSummary}
                  disabled={summaryLoading || total === 0}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {summaryLoading ? "Summarising…" : "Landscape summary"}
                </button>
                <ExportCsvButton
                  rows={csvRows(rows, active, total, disambiguation, drugAware)}
                  filename={`ctgov-${active.term.trim() || active.condition.trim() || "trials"}`}
                  source={{ name: source.name, retrieved: source.retrieved }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {summaryError && <p className="text-sm text-destructive">{summaryError}</p>}
            {summary && (
              <div className="rounded-lg border p-3 space-y-3">
                <p className={cn("text-xs", summary.exact ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400 font-medium")}>
                  {summary.note}
                </p>
                <div className="grid gap-4 sm:grid-cols-3 text-sm">
                  {(
                    [
                      ["By phase", summary.byPhase, prettyPhases],
                      ["By status", summary.byStatus, pretty],
                      ["By lead sponsor (top 10)", summary.bySponsor, (s: string) => s],
                    ] as [string, { label: string; n: number }[], (s: string) => string][]
                  ).map(([heading, items, fmt]) => (
                    <div key={heading}>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{heading}</p>
                      <ul className="space-y-0.5">
                        {items.map((i) => (
                          <li key={i.label} className="flex justify-between gap-2">
                            <span className="truncate" title={i.label}>{fmt(i.label)}</span>
                            <span className="tabular-nums">{i.n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rows.length > 0 ? (
              <TrialTable rows={rows} term={active.term} ambiguous={ambiguous} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No registered trials match these filters.</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <SourceLine name={source.name} url={source.url} retrieved={source.retrieved} />
                {(drugAware?.applied || disambiguation?.applied) && (
                  <p className="text-xs text-muted-foreground break-all">
                    Query sent: <code className="font-mono">{drugAware?.queryTerm ?? disambiguation?.queryTerm}</code>
                  </p>
                )}
              </div>
              {nextToken && (
                <button
                  onClick={() => load(active, nextToken)}
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

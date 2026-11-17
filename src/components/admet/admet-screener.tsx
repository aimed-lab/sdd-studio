"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ResultsTable } from "@/components/admet/results-table";
import { RuleReference } from "@/components/admet/rule-reference";
import { EXAMPLE_INPUT, MAX_MOLECULES, parseInput, type ParsedInput } from "@/lib/admet/input";
import { EXPORT_COLUMNS, exportSourceNote, toExportRows } from "@/lib/admet/export";
import { takeAdmetHandoff } from "@/lib/admet/handoff";
import { Screener, type AlertCatalog, type ScreenedRow } from "@/lib/admet/screen";

/** Yields to the browser so the progress bar paints and the page stays usable. */
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));
const CHUNK = 10;

type Phase = "idle" | "loading" | "screening" | "done";

export function AdmetScreener() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<ScreenedRow[]>([]);
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<AlertCatalog | undefined>();
  const [rdkitVersion, setRdkitVersion] = useState<string>("");
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const screenerRef = useRef<Screener | null>(null);
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      screenerRef.current?.dispose();
      screenerRef.current = null;
    };
  }, []);

  const getScreener = useCallback(async () => {
    if (screenerRef.current) return screenerRef.current;
    setPhase("loading");
    const screener = await Screener.create();
    screenerRef.current = screener;
    setCatalog(screener.catalog);
    setRdkitVersion(screener.rdkitVersion);
    return screener;
  }, []);

  const run = useCallback(
    async (input: string) => {
      setError(null);
      const result = parseInput(input);
      setParsed(result);
      setRows([]);
      if (result.molecules.length === 0) {
        setPhase("idle");
        setError(
          result.skipped.length > 0
            ? "No readable structure in that input — see the skipped rows below."
            : "Paste one SMILES per line, or upload a CSV with a SMILES column."
        );
        return;
      }

      cancelRef.current = false;
      try {
        const screener = await getScreener();
        setPhase("screening");
        setProgress({ done: 0, total: result.molecules.length });
        const out: ScreenedRow[] = [];
        for (let i = 0; i < result.molecules.length; i++) {
          if (cancelRef.current) break;
          out.push(screener.screen(result.molecules[i]));
          if ((i + 1) % CHUNK === 0 || i === result.molecules.length - 1) {
            setProgress({ done: i + 1, total: result.molecules.length });
            setRows([...out]);
            await yieldToBrowser();
          }
        }
        setRows(out);
        setPhase("done");
      } catch (e) {
        setPhase("idle");
        setError(e instanceof Error ? e.message : "The screener could not start.");
      }
    },
    [getScreener]
  );

  // Structures handed over from another page, e.g. a campaign's compounds table.
  useEffect(() => {
    const handoff = takeAdmetHandoff();
    if (!handoff) return;
    const asText = handoff.rows.map((r) => (r.name ? `${r.smiles}\t${r.name}` : r.smiles)).join("\n");
    setText(asText);
    setHandoffNote(`${handoff.rows.length} structure${handoff.rows.length === 1 ? "" : "s"} from ${handoff.source}`);
    void run(asText);
    // Runs once, for a hand-off that is already in sessionStorage on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setHandoffNote(null);
    const content = await file.text();
    setText(content);
    void run(content);
  };

  const summary = useMemo(() => {
    const ok = rows.filter((r) => !r.error);
    return {
      total: rows.length,
      ok: ok.length,
      invalid: rows.length - ok.length,
      ro5: ok.filter((r) => r.lipinski?.pass).length,
      veber: ok.filter((r) => r.veber?.pass).length,
      pains: ok.filter((r) => (r.alerts?.PAINS.length ?? 0) > 0).length,
      brenk: ok.filter((r) => (r.alerts?.Brenk.length ?? 0) > 0).length,
    };
  }, [rows]);

  const busy = phase === "loading" || phase === "screening";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Structures</CardTitle>
          <CardDescription>
            One SMILES per line, with an optional name after a tab or comma. Or upload a CSV, TSV or .smi file with a
            SMILES column. Up to {MAX_MOLECULES} structures at a time. Nothing is uploaded: the structures stay in
            this browser tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            spellCheck={false}
            aria-label="SMILES input"
            placeholder={"CC(=O)Oc1ccccc1C(=O)O\taspirin"}
            className="w-full rounded-md border bg-background p-3 font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void run(text)}
              disabled={busy || text.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {phase === "loading" ? "Loading RDKit…" : phase === "screening" ? "Screening…" : "Screen"}
            </button>
            {phase === "screening" && (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Upload file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.smi,text/csv,text/plain,text/tab-separated-values"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => {
                setHandoffNote(null);
                setText(EXAMPLE_INPUT);
              }}
              disabled={busy}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Load five known drugs
            </button>
          </div>

          {phase === "loading" && (
            <p className="text-xs text-muted-foreground">
              Fetching the RDKit WebAssembly build (about 7 MB). It is cached for the rest of the visit.
            </p>
          )}
          {phase === "screening" && progress.total > 0 && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Screened {progress.done} of {progress.total}
                {screenerRef.current ? ` against ${screenerRef.current.patternCount} substructure patterns` : ""}.
              </p>
            </div>
          )}
          {handoffNote && <p className="text-xs text-muted-foreground">Loaded {handoffNote}.</p>}
          {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
          {screenerRef.current && screenerRef.current.unusablePatterns.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {screenerRef.current.unusablePatterns.length} substructure pattern(s) could not be compiled by this
              RDKit build and were not applied.
            </p>
          )}
        </CardContent>
      </Card>

      {parsed && (parsed.truncated || parsed.skipped.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rows not screened</CardTitle>
            <CardDescription>
              {parsed.truncated
                ? `Only the first ${MAX_MOLECULES} structures were screened. Split a larger set into batches.`
                : "Everything the parser could not read as a structure."}
            </CardDescription>
          </CardHeader>
          {parsed.skipped.length > 0 && (
            <CardContent>
              <ul className="space-y-1 text-xs">
                {parsed.skipped.slice(0, 20).map((s) => (
                  <li key={s.line} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">Line {s.line}</span>
                    <code className="truncate font-mono">{s.text}</code>
                    <span className="shrink-0 text-amber-700 dark:text-amber-400">{s.reason}</span>
                  </li>
                ))}
                {parsed.skipped.length > 20 && (
                  <li className="text-muted-foreground">and {parsed.skipped.length - 20} more.</li>
                )}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Results</CardTitle>
                <CardDescription>
                  {summary.ok} structure{summary.ok === 1 ? "" : "s"} screened
                  {summary.invalid > 0 ? `, ${summary.invalid} unreadable` : ""}
                  {parsed?.format === "table" && parsed.smilesColumn
                    ? ` · column "${parsed.smilesColumn}"`
                    : ""}
                  . Computed in this browser with RDKit {rdkitVersion || "—"}.
                </CardDescription>
              </div>
              <ExportCsvButton
                rows={toExportRows(rows)}
                columns={EXPORT_COLUMNS}
                filename={`admet_screen_${new Date().toISOString().slice(0, 10)}.csv`}
                source={{ name: exportSourceNote(rdkitVersion) }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Meets all four Ro5 thresholds:</dt>
                <dd className="font-medium">
                  {summary.ro5}/{summary.ok}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted-foreground">Meets both Veber criteria:</dt>
                <dd className="font-medium">
                  {summary.veber}/{summary.ok}
                </dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted-foreground">With a PAINS match:</dt>
                <dd className="font-medium">{summary.pains}</dd>
              </div>
              <div className="flex gap-1">
                <dt className="text-muted-foreground">With a Brenk match:</dt>
                <dd className="font-medium">{summary.brenk}</dd>
              </div>
            </dl>
            <ResultsTable rows={rows} />
          </CardContent>
        </Card>
      )}

      <RuleReference catalog={catalog} />
    </div>
  );
}

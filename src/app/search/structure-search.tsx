"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MainModule } from "@rdkit/rdkit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/export-csv-button";
import { SourceLine } from "@/components/data-provenance";
import { MoleculeViewer } from "@/components/molecule-viewer";
import { loadRDKit } from "@/lib/rdkit";
import { cn } from "@/lib/utils";

// RDKit.js runs only in the browser and only in Structure mode. It is loaded by
// the app's single loader (src/lib/rdkit.ts) from the pinned @rdkit/rdkit
// package, because the build claims the global window.initRDKitModule and two
// loaders would pair one version's glue with another's .wasm.
type RDKitModule = MainModule;

interface Hit {
  chemblId: string;
  parentChemblId: string | null;
  isParent: boolean;
  name: string;
  similarity: number | null;
  maxPhase: number | null;
  smiles: string | null;
  chemblUrl: string;
}

interface StructureResponse {
  state: "ok" | "zero_hits" | "invalid_query" | "too_broad" | "timeout" | "upstream_error";
  error?: string;
  method?: string;
  methodDocs?: string;
  results: Hit[];
  total?: number;
  totalIsLowerBound?: boolean;
  maxRetrievable?: number;
  source?: { name: string; url: string; retrieved: string; release?: { version: string; date: string | null } };
}

const STATE_STYLE: Record<string, string> = {
  timeout: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  upstream_error: "border-destructive text-destructive",
  invalid_query: "border-destructive text-destructive",
  too_broad: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
};

const STATE_TITLE: Record<string, string> = {
  timeout: "Search incomplete (timed out)",
  upstream_error: "ChEMBL error",
  invalid_query: "Invalid structure",
  too_broad: "Query too broad",
};

const phaseLabel = (p: number | null) =>
  p === null || p < 0 ? "Unknown" : p >= 4 ? "Approved" : p >= 1 ? `Phase ${Math.floor(p)}` : p > 0 ? "Early Phase 1" : "Preclinical";

export function StructureSearch({ initialSmiles }: { initialSmiles: string }) {
  const [smiles, setSmiles] = useState(initialSmiles);
  const [mode, setMode] = useState<"similarity" | "substructure">("similarity");
  const [threshold, setThreshold] = useState(80);
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [rdkitError, setRdkitError] = useState<string | null>(null);
  const [canonical, setCanonical] = useState<{ smiles: string; svg: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [response, setResponse] = useState<StructureResponse | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const lastQuery = useRef<{ smiles: string; mode: string; threshold: number } | null>(null);

  useEffect(() => {
    loadRDKit().then(setRdkit, (e: Error) => setRdkitError(e.message));
  }, []);

  // Validate and canonicalise as the user types.
  useEffect(() => {
    if (!rdkit || !smiles.trim()) {
      setCanonical(null);
      setParseError(null);
      return;
    }
    const mol = rdkit.get_mol(smiles.trim());
    try {
      if (!mol || !mol.is_valid()) {
        setCanonical(null);
        setParseError("RDKit could not parse this SMILES.");
      } else {
        setCanonical({ smiles: mol.get_smiles(), svg: mol.get_svg(240, 160) });
        setParseError(null);
      }
    } finally {
      mol?.delete();
    }
  }, [rdkit, smiles]);

  const run = useCallback(
    async (offset: number) => {
      const query = offset === 0 ? { smiles: canonical?.smiles ?? smiles.trim(), mode, threshold } : lastQuery.current;
      if (!query) return;
      lastQuery.current = query;
      setLoading(true);
      const params = new URLSearchParams({ smiles: query.smiles, mode: query.mode, offset: String(offset) });
      if (query.mode === "similarity") params.set("threshold", String(query.threshold));
      try {
        const res = await fetch(`/api/structure?${params}`);
        const data = (await res.json()) as StructureResponse;
        if (!data.state) data.state = res.ok ? "ok" : "upstream_error";
        setResponse(data);
        setHits((prev) => (offset > 0 && data.state === "ok" ? [...prev, ...data.results] : data.results ?? []));
      } catch {
        setResponse({ state: "upstream_error", error: "Could not reach the search service.", results: [] });
        if (offset === 0) setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [canonical, smiles, mode, threshold]
  );

  const canSearch = !!smiles.trim() && !parseError && !loading;
  const problem = response && STATE_TITLE[response.state] ? response : null;
  const retrievable = response?.maxRetrievable ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Structure search</CardTitle>
          <CardDescription>
            Paste a SMILES string. It is checked and drawn in your browser with RDKit.js before anything is sent to ChEMBL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[1fr_auto]">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSearch) run(0);
              }}
            >
              <label className="block text-sm font-medium" htmlFor="smiles-input">
                SMILES
              </label>
              <input
                id="smiles-input"
                value={smiles}
                onChange={(e) => setSmiles(e.target.value)}
                maxLength={200}
                spellCheck={false}
                placeholder="e.g. Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
              <div className="flex flex-wrap items-end gap-4">
                <fieldset className="flex gap-3 text-sm">
                  <legend className="sr-only">Search type</legend>
                  {(["similarity", "substructure"] as const).map((m) => (
                    <label key={m} className="inline-flex items-center gap-1.5">
                      <input type="radio" name="structure-mode" checked={mode === m} onChange={() => setMode(m)} />
                      {m === "similarity" ? "Similarity" : "Substructure"}
                    </label>
                  ))}
                </fieldset>
                {mode === "similarity" && (
                  <label className="flex items-center gap-2 text-sm">
                    Tanimoto ≥
                    <input
                      type="number"
                      min={70}
                      max={100}
                      step={5}
                      value={threshold}
                      onChange={(e) => setThreshold(Math.min(100, Math.max(70, Number(e.target.value) || 70)))}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1"
                    />
                    %
                  </label>
                )}
                <button
                  type="submit"
                  disabled={!canSearch}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Searching..." : "Search ChEMBL"}
                </button>
              </div>
              {rdkitError && (
                <p className="text-xs text-muted-foreground">
                  {rdkitError}. The structure will be checked by ChEMBL only.
                </p>
              )}
              {!rdkit && !rdkitError && <p className="text-xs text-muted-foreground">Loading RDKit.js…</p>}
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
              {canonical && (
                <p className="text-xs text-muted-foreground break-all">
                  Searching as (RDKit canonical SMILES): <span className="font-mono text-foreground">{canonical.smiles}</span>
                </p>
              )}
            </form>
            <div className="flex min-h-[160px] min-w-[240px] items-center justify-center rounded-md border bg-white">
              {canonical ? (
                <div aria-label="Query structure as parsed" dangerouslySetInnerHTML={{ __html: canonical.svg }} />
              ) : (
                <span className="px-4 text-center text-xs text-muted-foreground">Query structure preview</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {problem && (
        <div role="alert" className={cn("rounded-md border px-4 py-3 text-sm", STATE_STYLE[problem.state])}>
          <strong>{STATE_TITLE[problem.state]}.</strong> {problem.error}
        </div>
      )}

      {response && (response.state === "ok" || response.state === "zero_hits") && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Results</CardTitle>
                <CardDescription>
                  {response.state === "zero_hits"
                    ? "No ChEMBL compounds match this structure at this setting (the search completed)."
                    : `Showing ${hits.length} of ${response.totalIsLowerBound ? "at least " : ""}${response.total?.toLocaleString()} matches${
                        (response.total ?? 0) > retrievable ? ` (the first ${retrievable} can be loaded here)` : ""
                      }`}
                </CardDescription>
              </div>
              {hits.length > 0 && response.source && (
                <ExportCsvButton
                  rows={hits.map((h) => ({ query_smiles: lastQuery.current?.smiles, mode: lastQuery.current?.mode, ...h }))}
                  filename="chembl-structure-search"
                  source={{ name: response.source.name, retrieved: response.source.retrieved }}
                />
              )}
            </div>
          </CardHeader>
          {hits.length > 0 && (
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      {["Structure", "ChEMBL ID", "Name", "Similarity", "Parent", "Phase"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {hits.map((h) => (
                      <tr key={h.chemblId} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          {h.smiles ? <MoleculeViewer smiles={h.smiles} name={h.name} width={130} height={85} actions /> : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          <a href={h.chemblUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {h.chemblId}
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          {h.name === h.chemblId ? <span className="italic text-muted-foreground">(unnamed)</span> : h.name}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{h.similarity === null ? "—" : `${h.similarity.toFixed(0)}%`}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {h.isParent ? "parent" : h.parentChemblId ? `salt/form of ${h.parentChemblId}` : "—"}
                        </td>
                        <td className="px-3 py-2">{phaseLabel(h.maxPhase)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  {response.source && (
                    <SourceLine name={response.source.name} url={response.source.url} retrieved={response.source.retrieved} />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Method: {response.method}
                    {response.source?.release && ` · ${response.source.release.version}`}
                    {response.methodDocs && (
                      <>
                        {" · "}
                        <a href={response.methodDocs} target="_blank" rel="noopener noreferrer" className="underline">
                          ChEMBL documentation
                        </a>
                      </>
                    )}
                  </p>
                </div>
                {hits.length < retrievable && (
                  <button
                    onClick={() => run(hits.length)}
                    disabled={loading}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    {loading ? "Loading..." : "Load 25 more"}
                  </button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

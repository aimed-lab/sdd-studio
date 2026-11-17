"use client";

import { AGENT_NAMES, STATUS_LABELS, runTitle, usd } from "@/lib/agents/client";
import { cn } from "@/lib/utils";

// ── Types (mirror what the server stores in agent_runs.output) ──────────────

interface Source {
  name: string;
  url: string;
  queryUrl: string;
  retrieved: string;
  note?: string;
}

export interface RunRecord {
  id: string;
  user_email: string;
  agent: "literature" | "trials";
  status: "ok" | "no_data" | "refused" | "error";
  inputs: Record<string, unknown>;
  sources: Source[];
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  key_source: "lab" | "member" | null;
  output: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface Cited {
  text: string;
  pmids: string[];
  removedPmids: string[];
  studyType?: string;
}
interface LitRecord {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  year: string;
  authors: string;
  doi: string | null;
  publicationTypes: string[];
  givenToModel: boolean;
}
interface LitOutput {
  query?: string;
  queryTranslation?: string | null;
  totalMatches?: number;
  records?: LitRecord[];
  answer?: { synthesis: Cited[]; findings: Cited[]; gaps: string[] } | null;
  verification?: {
    checkedAgainst: number;
    kept: number;
    dropped: { kind: string; text: string; pmids: string[]; reason: string }[];
    removedCitations: number;
  };
  fellBack?: boolean;
  requestedModel?: string;
}

interface Row {
  label: string;
  trials: number | null;
  pctOfTotal: number | null;
}
interface Facts {
  totalTrials: number;
  analysedTrials: number;
  allAnalysed: boolean;
  byStatus: Row[];
  byPhase: Row[];
  countsExact: boolean;
  enrollment: { trialsWithCount: number; actual: number; estimated: number; median: number | null; buckets: { label: string; trials: number }[] };
  sponsorClass: { label: string; trials: number }[];
  startYears: { year: number; trials: number }[];
  recruiting: {
    trials: number;
    analysedTrials: number;
    allAnalysed: boolean;
    recruitingSites: number;
    trialsWithoutRecruitingSite: number;
    countries: { country: string; recruitingSites: number; trials: number }[];
    otherCountries: { countries: number; recruitingSites: number } | null;
    topTrials: { nctId: string; title: string; phases: string[]; recruitingSites: number; enrollment: number | null }[];
  };
}
interface TrialOutput {
  facts?: Facts;
  narrative?: Record<"overview" | "recruitment" | "landscape" | "caveats", string[]> | null;
  numberCheck?: { removed: { section: string; sentence: string; reason: string }[] };
  fellBack?: boolean;
  requestedModel?: string;
}

// ── Shared pieces ───────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("en-US"));

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
      {children}
    </section>
  );
}

/** Single-series magnitude bar inside a table cell; the number beside it is the value. */
function InlineBar({ value, max }: { value: number | null; max: number }) {
  if (value === null || !max) return null;
  return (
    <div className="h-2 w-full min-w-[4rem] rounded-full bg-muted" aria-hidden="true">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, (100 * value) / max)}%` }} />
    </div>
  );
}

function CountTable({ rows, unit = "Trials", showPct = true }: { rows: { label: string; value: number | null; pct?: number | null }[]; unit?: string; showPct?: boolean }) {
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr>
          <th className="py-1 pr-3 font-medium" scope="col"></th>
          <th className="py-1 pr-3 text-right font-medium" scope="col">{unit}</th>
          {showPct && <th className="py-1 pr-3 text-right font-medium" scope="col">% of all</th>}
          <th className="w-1/3 py-1 font-medium" scope="col"><span className="sr-only">Bar</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t" title={`${r.label}: ${fmt(r.value)}`}>
            <th scope="row" className="py-1 pr-3 text-left font-normal">{r.label}</th>
            <td className="py-1 pr-3 text-right tabular-nums">{fmt(r.value)}</td>
            {showPct && <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">{r.pct === null || r.pct === undefined ? "–" : `${r.pct}%`}</td>}
            <td className="py-1"><InlineBar value={r.value} max={max} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AiNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
      {children}
    </p>
  );
}

// ── Literature ──────────────────────────────────────────────────────────────

function Cites({ pmids, index }: { pmids: string[]; index: Map<string, number> }) {
  return (
    <span className="ml-1 whitespace-nowrap text-xs">
      {pmids.map((p) => (
        <a
          key={p}
          href={`#pmid-${p}`}
          title={`PMID ${p}`}
          className="mr-0.5 rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-primary hover:underline"
        >
          [{index.get(p) ?? p}]
        </a>
      ))}
    </span>
  );
}

function LiteratureView({ out }: { out: LitOutput }) {
  const records = out.records ?? [];
  const index = new Map(records.map((r, i) => [r.pmid, i + 1]));
  const v = out.verification;
  return (
    <div className="space-y-8">
      {out.answer && (
        <Section title="Answer">
          <AiNote>
            Written by Claude from the abstracts listed below, and only those. Every statement cites the records it rests on; the
            server checked each citation against the {v?.checkedAgainst ?? records.filter((r) => r.givenToModel).length} abstracts
            given to Claude{v ? `, kept ${v.kept} statements, removed ${v.dropped.length} that cited nothing from the set and ${v.removedCitations} citation${v.removedCitations === 1 ? "" : "s"} to records outside it` : ""}.
            Read the cited abstracts before relying on a statement.
          </AiNote>
          <div className="space-y-2 leading-relaxed">
            {out.answer.synthesis.map((s, i) => (
              <p key={i}>
                {s.text}
                <Cites pmids={s.pmids} index={index} />
              </p>
            ))}
          </div>
          {out.answer.findings.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium" scope="col">Finding</th>
                    <th className="px-3 py-2 font-medium" scope="col">Evidence type</th>
                    <th className="px-3 py-2 font-medium" scope="col">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {out.answer.findings.map((f, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="px-3 py-2">{f.text}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{f.studyType}</td>
                      <td className="px-3 py-2"><Cites pmids={f.pmids} index={index} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {out.answer.gaps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Not answered by the retrieved abstracts</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {out.answer.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {v && v.dropped.length > 0 && (
            <details className="rounded-md border px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none font-medium">Removed by the citation check ({v.dropped.length})</summary>
              <ul className="mt-2 space-y-2">
                {v.dropped.map((d, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-muted-foreground line-through">{d.text}</span>
                    <br />
                    <span className="text-red-700 dark:text-red-400">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
      )}

      <Section
        title={`PubMed records (${records.length})`}
        note={
          <>
            Query <code className="rounded bg-muted px-1">{out.query}</code>
            {out.queryTranslation && out.queryTranslation !== out.query && (
              <> (PubMed searched it as <code className="rounded bg-muted px-1">{out.queryTranslation}</code>)</>
            )}
            {typeof out.totalMatches === "number" && <>; {fmt(out.totalMatches)} records matched in all, the first {records.length} were read.</>}
          </>
        }
      >
        <ol className="space-y-3">
          {records.map((r, i) => (
            <li key={r.pmid} id={`pmid-${r.pmid}`} className="scroll-mt-20 rounded-md border p-3 text-sm target:ring-2 target:ring-primary">
              <div className="flex gap-2">
                <span className="font-mono text-xs text-muted-foreground">[{i + 1}]</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                    {r.title || `PMID ${r.pmid}`}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {[r.authors, r.journal, r.year].filter(Boolean).join(" · ")} · PMID {r.pmid}
                    {r.doi && (
                      <>
                        {" · "}
                        <a className="underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer">
                          doi:{r.doi}
                        </a>
                      </>
                    )}
                  </p>
                  {r.publicationTypes.length > 0 && <p className="text-[11px] text-muted-foreground">{r.publicationTypes.join("; ")}</p>}
                  {r.givenToModel ? (
                    <details>
                      <summary className="cursor-pointer select-none text-xs text-muted-foreground">Abstract</summary>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">{r.abstract}</p>
                    </details>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">No abstract in PubMed; not given to Claude.</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

// ── Trials ──────────────────────────────────────────────────────────────────

const NARRATIVE_TITLES: Record<string, string> = {
  overview: "Overview",
  recruitment: "Recruitment",
  landscape: "Landscape",
  caveats: "Caveats",
};

function TrialsView({ out, inputs }: { out: TrialOutput; inputs: Record<string, unknown> }) {
  const f = out.facts;
  const removed = out.numberCheck?.removed ?? [];
  const ctgovSearch = `https://clinicaltrials.gov/search?${new URLSearchParams({
    cond: String(inputs.condition ?? ""),
    ...(inputs.intervention ? { intr: String(inputs.intervention) } : {}),
    ...(inputs.location ? { locStr: String(inputs.location) } : {}),
  })}`;
  return (
    <div className="space-y-8">
      {out.narrative && (
        <Section title="Feasibility narrative">
          <AiNote>
            Written by Claude around the figures below, which the server computed from ClinicalTrials.gov. Claude was told to use
            only those numbers; the server removed {removed.length} sentence{removed.length === 1 ? "" : "s"} containing a number
            that is not in the figures. Check the tables before relying on a statement.
          </AiNote>
          <div className="grid gap-4 md:grid-cols-2">
            {(["overview", "recruitment", "landscape", "caveats"] as const).map((k) =>
              out.narrative?.[k]?.length ? (
                <div key={k} className="rounded-md border p-3">
                  <h3 className="mb-1 text-sm font-semibold">{NARRATIVE_TITLES[k]}</h3>
                  <p className="text-sm leading-relaxed">{out.narrative[k].join(" ")}</p>
                </div>
              ) : null
            )}
          </div>
          {removed.length > 0 && (
            <details className="rounded-md border px-3 py-2 text-sm">
              <summary className="cursor-pointer select-none font-medium">Removed by the number check ({removed.length})</summary>
              <ul className="mt-2 space-y-2">
                {removed.map((d, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-muted-foreground line-through">{d.sentence}</span>
                    <br />
                    <span className="text-red-700 dark:text-red-400">{d.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>
      )}

      {f && (
        <Section
          title="Computed figures"
          note={
            <>
              {fmt(f.totalTrials)} trials on ClinicalTrials.gov match{" "}
              <a className="underline" href={ctgovSearch} target="_blank" rel="noopener noreferrer">
                this search
              </a>
              .{" "}
              {f.allAnalysed
                ? "Every matching record was analysed."
                : `Status and phase totals are exact (one count query each). Enrollment, sponsor and start-year figures come from the first ${fmt(f.analysedTrials)} records in ClinicalTrials.gov's relevance order, not a random sample.`}
            </>
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-semibold">By overall status</h3>
              <CountTable rows={f.byStatus.map((r) => ({ label: r.label, value: r.trials, pct: r.pctOfTotal }))} />
            </div>
            <div className="rounded-md border p-3">
              <h3 className="mb-1 text-sm font-semibold">By phase</h3>
              <p className="mb-2 text-[11px] text-muted-foreground">A trial listed as Phase 1/Phase 2 counts under both, so rows can add up to more than the total.</p>
              <CountTable rows={f.byPhase.map((r) => ({ label: r.label, value: r.trials, pct: r.pctOfTotal }))} />
            </div>
            <div className="rounded-md border p-3">
              <h3 className="mb-1 text-sm font-semibold">Recruiting sites by country</h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {fmt(f.recruiting.recruitingSites)} sites marked recruiting across {fmt(f.recruiting.analysedTrials)} recruiting trials
                {f.recruiting.allAnalysed ? "" : ` (of ${fmt(f.recruiting.trials)}; the rest were not fetched)`}.
                {f.recruiting.trialsWithoutRecruitingSite > 0 && ` ${fmt(f.recruiting.trialsWithoutRecruitingSite)} recruiting trials list no site marked recruiting.`}
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium" scope="col">Country</th>
                    <th className="py-1 pr-3 text-right font-medium" scope="col">Sites</th>
                    <th className="py-1 pr-3 text-right font-medium" scope="col">Trials</th>
                    <th className="w-1/3 py-1 font-medium" scope="col"><span className="sr-only">Bar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {f.recruiting.countries.map((c) => (
                    <tr key={c.country} className="border-t" title={`${c.country}: ${fmt(c.recruitingSites)} recruiting sites in ${fmt(c.trials)} trials`}>
                      <th scope="row" className="py-1 pr-3 text-left font-normal">{c.country}</th>
                      <td className="py-1 pr-3 text-right tabular-nums">{fmt(c.recruitingSites)}</td>
                      <td className="py-1 pr-3 text-right tabular-nums text-muted-foreground">{fmt(c.trials)}</td>
                      <td className="py-1"><InlineBar value={c.recruitingSites} max={f.recruiting.countries[0]?.recruitingSites ?? 0} /></td>
                    </tr>
                  ))}
                  {f.recruiting.otherCountries && (
                    <tr className="border-t text-muted-foreground">
                      <th scope="row" className="py-1 pr-3 text-left font-normal">{fmt(f.recruiting.otherCountries.countries)} other countries</th>
                      <td className="py-1 pr-3 text-right tabular-nums">{fmt(f.recruiting.otherCountries.recruitingSites)}</td>
                      <td className="py-1 pr-3 text-right">–</td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border p-3">
              <h3 className="mb-1 text-sm font-semibold">Planned or actual enrollment</h3>
              <p className="mb-2 text-[11px] text-muted-foreground">
                {fmt(f.enrollment.trialsWithCount)} of {fmt(f.analysedTrials)} analysed trials give a number ({fmt(f.enrollment.actual)} actual,{" "}
                {fmt(f.enrollment.estimated)} estimated); median {fmt(f.enrollment.median)} participants.
              </p>
              <CountTable rows={f.enrollment.buckets.map((b) => ({ label: `${b.label} participants`, value: b.trials }))} showPct={false} />
            </div>
            <div className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-semibold">Lead sponsor type</h3>
              <CountTable rows={f.sponsorClass.map((s) => ({ label: s.label, value: s.trials }))} showPct={false} />
            </div>
            <div className="rounded-md border p-3">
              <h3 className="mb-1 text-sm font-semibold">Trials by start year</h3>
              <p className="mb-2 text-[11px] text-muted-foreground">Start date as registered (actual or anticipated); the current year is partial.</p>
              <CountTable rows={f.startYears.map((y) => ({ label: String(y.year), value: y.trials }))} showPct={false} />
            </div>
          </div>
          {f.recruiting.topTrials.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <caption className="px-3 pt-3 text-left text-sm font-semibold">Recruiting trials with the most recruiting sites</caption>
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium" scope="col">Trial</th>
                    <th className="px-3 py-2 font-medium" scope="col">Phase</th>
                    <th className="px-3 py-2 text-right font-medium" scope="col">Recruiting sites</th>
                    <th className="px-3 py-2 text-right font-medium" scope="col">Enrollment</th>
                  </tr>
                </thead>
                <tbody>
                  {f.recruiting.topTrials.map((t) => (
                    <tr key={t.nctId} className="border-t align-top">
                      <td className="px-3 py-2">
                        <a className="font-mono text-xs text-primary hover:underline" href={`https://clinicaltrials.gov/study/${t.nctId}`} target="_blank" rel="noopener noreferrer">
                          {t.nctId}
                        </a>
                        <div className="text-xs">{t.title}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{t.phases.join(" / ") || "Not specified"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(t.recruitingSites)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(t.enrollment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

// ── Run record ──────────────────────────────────────────────────────────────

const statusStyle: Record<string, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  no_data: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  refused: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function RunView({ run, mine }: { run: RunRecord; mine: boolean }) {
  const out = (run.output ?? {}) as Record<string, unknown>;
  const requested = (out.requestedModel as string | undefined) ?? null;
  const fellBack = !!out.fellBack;
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{AGENT_NAMES[run.agent] ?? run.agent} run</p>
        <h1 className="text-2xl font-bold leading-snug">{runTitle(run)}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("rounded-full px-2 py-0.5 font-medium", statusStyle[run.status])}>{STATUS_LABELS[run.status] ?? run.status}</span>
          <span>{new Date(run.created_at).toLocaleString()}</span>
          {!mine && <span>· run by {run.user_email}</span>}
        </div>
        {run.agent === "literature" && (run.inputs.target || run.inputs.compound) ? (
          <p className="text-sm text-muted-foreground">
            {[run.inputs.target && `Target: ${run.inputs.target}`, run.inputs.compound && `Compound: ${run.inputs.compound}`].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </header>

      {run.error && (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {run.error}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-xs text-muted-foreground">Model</dt>
          <dd className="font-mono text-xs">
            {run.model ?? "not called"}
            {fellBack && requested && <span className="block font-sans text-[11px] text-muted-foreground">fallback from {requested}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Input tokens</dt>
          <dd className="tabular-nums">{fmt(run.input_tokens)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Output tokens</dt>
          <dd className="tabular-nums">{fmt(run.output_tokens)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cost</dt>
          <dd className="tabular-nums">{usd(run.cost_usd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid by</dt>
          <dd>{run.key_source === "lab" ? "Lab budget" : run.key_source === "member" ? "Member's own key" : "No AI call"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duration</dt>
          <dd className="tabular-nums">{run.duration_ms === null ? "–" : `${(run.duration_ms / 1000).toFixed(1)} s`}</dd>
        </div>
      </dl>

      <Section title="Data sources">
        <ul className="space-y-2 text-sm">
          {run.sources.map((s, i) => (
            <li key={i} className="rounded-md border px-3 py-2">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                {s.name}
              </a>
              <span className="text-xs text-muted-foreground"> · retrieved {new Date(s.retrieved).toLocaleString()}</span>
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              <a href={s.queryUrl} target="_blank" rel="noopener noreferrer" className="block break-all font-mono text-[11px] text-muted-foreground underline">
                {s.queryUrl}
              </a>
            </li>
          ))}
          {!run.sources.length && <li className="text-xs text-muted-foreground">No source was reached.</li>}
        </ul>
      </Section>

      {run.agent === "literature" ? <LiteratureView out={out as LitOutput} /> : <TrialsView out={out as TrialOutput} inputs={run.inputs} />}
    </div>
  );
}

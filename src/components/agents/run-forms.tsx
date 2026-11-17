"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MEMBER_KEY_HEADER, agentHeaders, savedAnthropicKey } from "@/lib/agents/client";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Agent = "literature" | "trials";

interface OverBudget {
  message: string;
}

function useRun(agent: Agent, email: string | undefined, onFinished: () => void) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [overBudget, setOverBudget] = useState<OverBudget | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function run(body: Record<string, unknown>, withOwnKey = false) {
    setError(null);
    setRunning(true);
    setElapsed(0);
    const start = Date.now();
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    try {
      const key = withOwnKey ? savedAnthropicKey() : null;
      if (withOwnKey && !key) {
        setError("No Anthropic key is saved in this browser. Add one in Settings → API Keys.");
        return;
      }
      const res = await fetch(`/api/agents/${agent}`, {
        method: "POST",
        headers: agentHeaders(email, { "Content-Type": "application/json", ...(key ? { [MEMBER_KEY_HEADER]: key } : {}) }),
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; runId?: string; error?: string; code?: string };
      if (res.status === 402 && data.code === "over_budget") {
        setOverBudget({ message: data.error ?? "The lab's AI budget is used up." });
        return;
      }
      if (!res.ok || !data.runId) {
        setError(data.error ?? `The run could not start (HTTP ${res.status}).`);
        return;
      }
      setOverBudget(null);
      onFinished();
      router.push(`/services/runs/${data.runId}`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      if (timer.current) clearInterval(timer.current);
      setRunning(false);
    }
  }

  return { run, running, elapsed, error, overBudget };
}

function RunFooter({
  running,
  elapsed,
  error,
  overBudget,
  onOwnKey,
  label,
}: {
  running: boolean;
  elapsed: number;
  error: string | null;
  overBudget: OverBudget | null;
  onOwnKey: () => void;
  label: string;
}) {
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => setHasKey(!!savedAnthropicKey()), [overBudget]);
  return (
    <div className="space-y-3">
      {overBudget && (
        <div role="alert" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p>{overBudget.message}</p>
          {hasKey ? (
            <>
              <p className="text-xs">
                You can run it with your own Anthropic key, saved in this browser. The key is sent with this one request over HTTPS,
                used for this run only, and never stored on the server. Anthropic bills your account.
              </p>
              <button
                type="button"
                onClick={onOwnKey}
                disabled={running}
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 dark:bg-transparent dark:hover:bg-amber-900/40"
              >
                Run with my own key
              </button>
            </>
          ) : (
            <p className="text-xs">
              To keep going, add your own Anthropic key in{" "}
              <a className="underline" href="/settings">
                Settings → API Keys
              </a>
              , then run again.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={running}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Running…" : label}
        </button>
        {running && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Working: searching the source, then waiting for Claude ({elapsed} s). The run record opens when it is done.
          </span>
        )}
      </div>
    </div>
  );
}

export function LiteratureRunForm({ email, onFinished }: { email: string | undefined; onFinished: () => void }) {
  const [form, setForm] = useState({ question: "", target: "", compound: "", pubmedQuery: "", maxRecords: "20", sort: "relevance" });
  const { run, running, elapsed, error, overBudget } = useRun("literature", email, onFinished);
  const body = () => ({ ...form, maxRecords: Number(form.maxRecords) });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(body());
      }}
    >
      <div>
        <label htmlFor="lit-question" className="text-sm font-medium">
          Question or topic
        </label>
        <textarea
          id="lit-question"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          value={form.question}
          onChange={set("question")}
          placeholder="e.g. What resistance mechanisms to osimertinib are reported in EGFR-mutant NSCLC?"
          className={cn(inputClass, "mt-1 resize-y")}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="lit-target" className="text-sm font-medium">
            Target <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input id="lit-target" maxLength={60} value={form.target} onChange={set("target")} placeholder="e.g. EGFR" className={cn(inputClass, "mt-1")} />
        </div>
        <div>
          <label htmlFor="lit-compound" className="text-sm font-medium">
            Compound <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input id="lit-compound" maxLength={80} value={form.compound} onChange={set("compound")} placeholder="e.g. osimertinib" className={cn(inputClass, "mt-1")} />
        </div>
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer select-none font-medium">PubMed search options</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="lit-query" className="text-sm font-medium">
              PubMed query <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="lit-query"
              maxLength={300}
              value={form.pubmedQuery}
              onChange={set("pubmedQuery")}
              placeholder='PubMed syntax, e.g. "osimertinib"[tiab] AND resistance[tiab]'
              className={cn(inputClass, "mt-1 font-mono text-xs")}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              If empty: the target and compound are searched in titles and abstracts; with neither, the question itself is the query.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="lit-max" className="text-sm font-medium">
                Records to read
              </label>
              <select id="lit-max" value={form.maxRecords} onChange={set("maxRecords")} className={cn(inputClass, "mt-1")}>
                {["10", "20", "30", "40"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lit-sort" className="text-sm font-medium">
                Order
              </label>
              <select id="lit-sort" value={form.sort} onChange={set("sort")} className={cn(inputClass, "mt-1")}>
                <option value="relevance">PubMed best match</option>
                <option value="date">Most recent first</option>
              </select>
            </div>
          </div>
        </div>
      </details>
      <RunFooter running={running} elapsed={elapsed} error={error} overBudget={overBudget} onOwnKey={() => run(body(), true)} label="Search and summarize" />
    </form>
  );
}

export function TrialsRunForm({ email, onFinished }: { email: string | undefined; onFinished: () => void }) {
  const [form, setForm] = useState({ condition: "", intervention: "", location: "" });
  const { run, running, elapsed, error, overBudget } = useRun("trials", email, onFinished);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="tr-condition" className="text-sm font-medium">
            Condition
          </label>
          <input
            id="tr-condition"
            required
            minLength={2}
            maxLength={100}
            value={form.condition}
            onChange={set("condition")}
            placeholder="e.g. glioblastoma"
            className={cn(inputClass, "mt-1")}
          />
        </div>
        <div>
          <label htmlFor="tr-intervention" className="text-sm font-medium">
            Intervention <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="tr-intervention"
            maxLength={100}
            value={form.intervention}
            onChange={set("intervention")}
            placeholder="e.g. temozolomide"
            className={cn(inputClass, "mt-1")}
          />
        </div>
        <div>
          <label htmlFor="tr-location" className="text-sm font-medium">
            Location <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input id="tr-location" maxLength={100} value={form.location} onChange={set("location")} placeholder="e.g. United States" className={cn(inputClass, "mt-1")} />
        </div>
      </div>
      <RunFooter running={running} elapsed={elapsed} error={error} overBudget={overBudget} onOwnKey={() => run(form, true)} label="Assess feasibility" />
    </form>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import {
  InSilicoNote, KIND_LABEL, StatusBadge, TestDataBadge, type Job, describeParams, shortWhen,
} from "@/components/jobs/job-ui";

/*
 * The job list at /jobs, and — for an Owner or Admin — the runner tokens a SPARC runner polls with.
 * Everything shown here comes from /api/v1/jobs, which decides what this account may see; the
 * buttons below are a convenience, not the permission check.
 */

type Filter = "all" | "open" | "finished";

const FILTERS: { key: Filter; label: string; statuses: string[] }[] = [
  { key: "open", label: "Waiting and running", statuses: ["pending", "queued", "claimed", "submitted", "running"] },
  { key: "finished", label: "Finished", statuses: ["succeeded", "failed", "cancelled", "rejected"] },
  { key: "all", label: "All", statuses: [] },
];

export function JobList() {
  const { user } = useAuth();
  const isAdmin = hasRole(user?.role, "Admin");
  const [filter, setFilter] = useState<Filter>("open");
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? [];
    const qs = new URLSearchParams();
    for (const s of statuses) qs.append("status", s);
    try {
      const res = await fetch(`/api/v1/jobs?${qs.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; jobs?: Job[]; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Could not load jobs (HTTP ${res.status}).`);
        return;
      }
      setError(null);
      setJobs(data.jobs ?? []);
    } catch {
      setError("Network error while loading jobs.");
    }
  }, [filter]);

  useEffect(() => {
    setJobs(null);
    void load();
    // A claimed job changes on the runner's schedule, so the list refreshes itself while it is open.
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md border px-3 py-1.5 text-sm ${filter === f.key ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Link href="/jobs/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          Request a run
        </Link>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {jobs === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {jobs !== null && jobs.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No jobs here yet.{" "}
          <Link href="/jobs/new" className="text-primary hover:underline">
            Request a run
          </Link>{" "}
          — a request for the developer sandbox is completed as a labelled dry run, so you can try the whole path
          without using cluster time.
        </div>
      )}

      {jobs !== null && jobs.length > 0 && (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                  {job.title}
                </Link>
                <StatusBadge status={job.status} />
                {job.dryRun && <TestDataBadge />}
                <span className="ml-auto text-xs text-muted-foreground">{shortWhen(job.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {KIND_LABEL[job.kind] ?? job.kind} · {job.project} · {job.estGpuHours} GPU-h estimated
                {job.cluster ? ` · ${job.cluster}` : ""}
                {job.requestedBy ? ` · requested by ${job.requestedBy}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{describeParams(job.kind, job.params)}</p>
              {job.status === "succeeded" && job.resultIteration != null && (
                <p className="mt-1 text-xs">
                  Results:{" "}
                  <Link href={`/projects/${job.project}?view=iterations`} className="text-primary hover:underline">
                    iteration {job.resultIteration}
                  </Link>
                </p>
              )}
              {job.error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{job.error.slice(0, 300)}</p>}
            </li>
          ))}
        </ul>
      )}

      <InSilicoNote />

      {isAdmin && <RunnerPanel />}
    </div>
  );
}

interface Runner {
  id: string;
  prefix: string;
  label: string | null;
  projects: string[];
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

/** Owner and Admin only: the sandbox runner tokens, so a lab machine can poll this queue. */
function RunnerPanel() {
  const [runners, setRunners] = useState<Runner[] | null>(null);
  const [fresh, setFresh] = useState<{ token: string; prefix: string; expiresAt: string } | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/jobs/runners", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; runners?: Runner[]; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Could not load runner tokens (HTTP ${res.status}).`);
        return;
      }
      setError(null);
      setRunners(data.runners ?? []);
    } catch {
      setError("Network error while loading runner tokens.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const mint = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/jobs/runners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || null, days: 30 }),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; prefix?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.ok || !data.token) {
        setError(data.error ?? `Could not create a runner token (HTTP ${res.status}).`);
      } else {
        setFresh({ token: data.token, prefix: data.prefix!, expiresAt: data.expiresAt! });
        setLabel("");
        await load();
      }
    } catch {
      setError("Network error while creating a runner token.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await fetch("/api/v1/jobs/runners", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Sandbox runner tokens</h2>
        <p className="text-xs text-muted-foreground">
          A runner is a machine on the SPARC side. It polls this queue with a token of its own, submits through SPARCq
          and pushes results back. Tokens made here claim sandbox jobs only; a token for a campaign is issued by the
          platform owner with the admin key. Only the hash is stored, so a token is shown once.
        </p>
      </div>

      {fresh && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-medium text-emerald-900 dark:text-emerald-200">
            New runner token ({fresh.prefix}…, expires {fresh.expiresAt.slice(0, 10)}). Copy it now — it is not shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-background p-2 font-mono">{fresh.token}</code>
          <p className="mt-2 text-emerald-900 dark:text-emerald-200">
            On the runner machine: save it to a file and start the runner with{" "}
            <code className="font-mono">node tools/sparc-runner/runner.mjs --token-file &lt;file&gt;</code>
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="runner-label">
            Label (optional)
          </label>
          <input
            id="runner-label"
            className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="lab workstation"
            maxLength={60}
          />
        </div>
        <button type="button" onClick={mint} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50">
          New runner token
        </button>
      </div>

      {runners && runners.length > 0 && (
        <ul className="divide-y text-xs">
          {runners.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <code className="font-mono">{r.prefix}…</code>
              <span>{r.label ?? "no label"}</span>
              <span className="text-muted-foreground">
                {r.revokedAt ? `revoked ${r.revokedAt.slice(0, 10)}` : `expires ${r.expiresAt.slice(0, 10)}`} · last seen{" "}
                {r.lastSeenAt ? shortWhen(r.lastSeenAt) : "never"}
              </span>
              {!r.revokedAt && (
                <button type="button" onClick={() => revoke(r.id)} disabled={busy} className="ml-auto rounded border px-2 py-0.5 hover:bg-accent disabled:opacity-50">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {runners && runners.length === 0 && <p className="text-xs text-muted-foreground">No runner tokens yet.</p>}
    </section>
  );
}

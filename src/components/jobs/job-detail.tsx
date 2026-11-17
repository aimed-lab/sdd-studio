"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { hasRole } from "@/lib/roles";
import {
  InSilicoNote, KIND_LABEL, StatusBadge, TestDataBadge, type Job, type JobEvent, describeParams, when,
} from "@/components/jobs/job-ui";

/*
 * One job: what was asked for, where it is, what happened, and where the results landed.
 * The buttons offer the decisions /api/v1/jobs/{id}/decision allows; the server checks the role again.
 */

const OPEN = ["pending", "queued", "claimed", "submitted", "running"];

export function JobDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const isAdmin = hasRole(user?.role, "Admin");
  // Only read where single sign-on is off; the server then checks this account in the database.
  const email = user?.email ?? "";
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/jobs/${id}${email ? `?email=${encodeURIComponent(email)}` : ""}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; job?: Job; events?: JobEvent[]; stale?: boolean; error?: string };
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok || !data.ok || !data.job) {
        setError(data.error ?? `Could not load this job (HTTP ${res.status}).`);
        return;
      }
      setError(null);
      setJob(data.job);
      setEvents(data.events ?? []);
      setStale(!!data.stale);
    } catch {
      setError("Network error while loading this job.");
    }
  }, [id, email]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const decide = async (decision: "approve" | "reject" | "cancel" | "requeue") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/jobs/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) setError(data.error ?? `That did not work (HTTP ${res.status}).`);
      await load();
    } catch {
      setError("Network error — nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm">
        <p>This job does not exist, or it is not yours to see.</p>
        <Link href="/jobs" className="text-primary hover:underline">
          Back to compute jobs
        </Link>
      </div>
    );
  }
  if (!job) {
    return <p className="text-sm text-muted-foreground">{error ?? "Loading…"}</p>;
  }

  const mine = job.requestedBy && user?.email && job.requestedBy === user.email.trim().toLowerCase();
  const canCancel = (isAdmin || mine) && (job.status === "pending" || job.status === "queued");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">{job.title}</h1>
        <StatusBadge status={job.status} />
        {job.dryRun && <TestDataBadge />}
      </div>

      <p className="text-sm text-muted-foreground">
        {KIND_LABEL[job.kind] ?? job.kind} · project{" "}
        <Link href={`/projects/${job.project}`} className="text-primary hover:underline">
          {job.project}
        </Link>{" "}
        · requested {when(job.createdAt)}
        {job.requestedBy ? ` by ${job.requestedBy}` : ""}
        {job.requestedRole ? ` (${job.requestedRole})` : ""}
      </p>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {stale && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          No runner has reported on this job for several hours. Its runner may have stopped. An Owner or Admin can put
          it back in the queue for another runner.
        </p>
      )}

      {(isAdmin || canCancel) && OPEN.includes(job.status) && (
        <div className="flex flex-wrap gap-2">
          {isAdmin && job.status === "pending" && (
            <>
              <button type="button" onClick={() => decide("approve")} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                Approve
              </button>
              <button type="button" onClick={() => decide("reject")} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">
                Reject
              </button>
            </>
          )}
          {canCancel && (
            <button type="button" onClick={() => decide("cancel")} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">
              Cancel
            </button>
          )}
          {isAdmin && ["claimed", "submitted", "running"].includes(job.status) && (
            <button type="button" onClick={() => decide("requeue")} disabled={busy} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50">
              Put back in the queue
            </button>
          )}
        </div>
      )}

      <section className="rounded-lg border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">What was asked for</h2>
        <p className="text-sm">{describeParams(job.kind, job.params)}</p>
        <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Estimated GPU-hours</dt>
            <dd>{job.estGpuHours}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Cluster</dt>
            <dd>{job.cluster ?? (job.clusterPreference ? `${job.clusterPreference} (asked for)` : "the runner chooses")}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Compute-side job</dt>
            <dd>{job.externalId ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">No PHI asserted</dt>
            <dd>{job.noPhi ? "yes, by the requester" : "no"}</dd>
          </div>
        </dl>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Every parameter, as stored</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(job.params, null, 2)}</pre>
        </details>
      </section>

      {job.status === "succeeded" && (
        <section className="rounded-lg border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold">Results</h2>
          {job.resultIteration != null ? (
            <p className="text-sm">
              Pushed to {job.project} as{" "}
              <Link href={`/projects/${job.project}?view=iterations`} className="text-primary hover:underline">
                iteration {job.resultIteration}
              </Link>
              .
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Finished, but no iteration was recorded.</p>
          )}
          {job.dryRun && (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              This was a dry run: the iteration holds synthetic test data written by the runner, labelled as test data.
            </p>
          )}
          <InSilicoNote />
        </section>
      )}

      {job.error && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/40">
          <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Why it failed</h2>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-red-900 dark:text-red-200">{job.error}</pre>
        </section>
      )}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">History</h2>
        <ol className="mt-2 space-y-2 text-xs">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex flex-wrap items-baseline gap-2">
              <StatusBadge status={e.status} size="sm" />
              <span className="text-muted-foreground">{when(e.at)}</span>
              <span>{e.actor}</span>
              {e.note && <span className="text-muted-foreground">— {e.note}</span>}
            </li>
          ))}
          {events.length === 0 && <li className="text-muted-foreground">No entries yet.</li>}
        </ol>
      </section>
    </div>
  );
}

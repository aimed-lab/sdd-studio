/**
 * Compute jobs on SPARC Center clusters (docs/sparc-jobs-plan.md).
 *
 * Studio holds a queue of job requests and a record of what happened to each one. It never calls a
 * cluster and never holds a cluster credential: a runner on the SPARC side polls this queue with its
 * own token, submits through SPARCq, and pushes results back as a campaign iteration.
 *
 * Nothing here runs anything. The tables are a queue, an append-only event log, and runner tokens
 * stored the way project keys are stored (only the hash).
 */

import { createHash, randomBytes } from "node:crypto";
import { db, sql, type VercelPoolClient } from "@vercel/postgres";
import "@/lib/db"; // sets POSTGRES_URL from whichever variable Vercel provided
import { LimitError, ensureProjectsSchema } from "@/lib/projects-db";

export const JOB_KINDS = ["docking", "generative-design"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = [
  "pending", "queued", "claimed", "submitted", "running", "succeeded", "failed", "cancelled", "rejected",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A job no runner has taken yet. */
export const WAITING: JobStatus[] = ["pending", "queued"];
/** A job that is somewhere between a runner claiming it and a terminal status. */
export const IN_FLIGHT: JobStatus[] = ["claimed", "submitted", "running"];
export const TERMINAL: JobStatus[] = ["succeeded", "failed", "cancelled", "rejected"];
export const OPEN_STATUSES: JobStatus[] = [...WAITING, ...IN_FLIGHT];

/**
 * Conservative ceilings Studio enforces itself. Studio cannot see the clusters' accounting, so GPU
 * hours are the requester's estimate; docs/sparc-jobs-plan.md §5 says what replaces that later.
 */
export const JOB_LIMITS = {
  maxJobsPerPersonPerDay: 5,
  maxJobsPerProjectPerDay: 20,
  maxOpenPerProject: 10,
  maxGpuHoursPerJob: 12,
  maxGpuHoursPerProjectPer30Days: 48,
  maxClaimPerPoll: 4, // SPARCq's own per-user cap is 4 concurrent jobs
  staleAfterHours: 6,
  maxRunnersPerProject: 10,
  maxRunnerDays: 365,
} as const;

export interface JobRow {
  id: string;
  project_slug: string;
  kind: string;
  title: string;
  status: string;
  requested_by: string;
  requested_role: string | null;
  params: Record<string, unknown>;
  est_gpu_hours: string; // NUMERIC comes back as text
  cluster_preference: string | null;
  no_phi: boolean;
  dry_run: boolean;
  runner_id: string | null;
  cluster: string | null;
  external_id: string | null;
  result_iteration: number | null;
  error: string | null;
  created_at: string;
  decided_at: string | null;
  claimed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface JobEventRow {
  id: string;
  at: string;
  status: string;
  actor: string;
  actor_type: string;
  note: string | null;
}

export interface RunnerRow {
  id: string;
  prefix: string;
  label: string | null;
  created_by: string;
  projects: string[];
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
}

let migrated = false;

export async function ensureJobsSchema(): Promise<void> {
  if (migrated) return;
  await ensureProjectsSchema(); // sparc_jobs references projects(slug)
  await sql`
    CREATE TABLE IF NOT EXISTS sparc_jobs (
      id                 TEXT PRIMARY KEY,
      project_slug       TEXT NOT NULL REFERENCES projects(slug),
      kind               TEXT NOT NULL,
      title              TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'pending',
      requested_by       TEXT NOT NULL,
      requested_role     TEXT,
      params             JSONB NOT NULL,
      est_gpu_hours      NUMERIC(6,2) NOT NULL DEFAULT 1,
      cluster_preference TEXT,
      no_phi             BOOLEAN NOT NULL DEFAULT FALSE,
      dry_run            BOOLEAN NOT NULL DEFAULT FALSE,
      runner_id          TEXT,
      cluster            TEXT,
      external_id        TEXT,
      result_iteration   INTEGER,
      error              TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at         TIMESTAMPTZ,
      claimed_at         TIMESTAMPTZ,
      started_at         TIMESTAMPTZ,
      finished_at        TIMESTAMPTZ,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS sparc_jobs_project ON sparc_jobs (project_slug, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS sparc_jobs_status ON sparc_jobs (status, created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sparc_job_events (
      id         BIGSERIAL PRIMARY KEY,
      job_id     TEXT NOT NULL,
      at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status     TEXT NOT NULL,
      actor      TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      note       TEXT
    )`;
  await sql`CREATE INDEX IF NOT EXISTS sparc_job_events_job ON sparc_job_events (job_id, id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sparc_runners (
      id           TEXT PRIMARY KEY,
      token_hash   TEXT NOT NULL UNIQUE,
      prefix       TEXT NOT NULL,
      label        TEXT,
      created_by   TEXT NOT NULL,
      projects     JSONB NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL,
      revoked_at   TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ
    )`;
  migrated = true;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const asList = (values: readonly string[]) => JSON.stringify(values);

async function inTransaction<T>(fn: (c: VercelPoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    const out = await fn(client);
    await client.sql`COMMIT`;
    return out;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ── Runner tokens ───────────────────────────────────────────────────────────

/** Creates a runner token for the given projects. The token is returned once and never stored. */
export async function createRunner(args: {
  createdBy: string;
  label: string | null;
  projects: string[];
  days: number;
}): Promise<{ id: string; token: string; prefix: string; expiresAt: string; projects: string[] }> {
  await ensureJobsSchema();
  const token = "sdd_rt_" + randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url");
  const expires = new Date(Date.now() + args.days * 86_400_000).toISOString();
  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"runners:" + args.projects.join(",")}))`;
    const { rows } = await c.sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM sparc_runners
      WHERE revoked_at IS NULL AND expires_at > NOW()
        AND projects ?| ARRAY(SELECT jsonb_array_elements_text(${asList(args.projects)}::jsonb))`;
    if (Number(rows[0]?.n ?? 0) >= JOB_LIMITS.maxRunnersPerProject) {
      throw new LimitError(409, `There are already ${JOB_LIMITS.maxRunnersPerProject} active runner tokens for these projects. Revoke one first.`);
    }
    await c.sql`
      INSERT INTO sparc_runners (id, token_hash, prefix, label, created_by, projects, expires_at)
      VALUES (${id}, ${hash(token)}, ${token.slice(0, 11)}, ${args.label}, ${args.createdBy}, ${asList(args.projects)}::jsonb, ${expires})`;
    return { id, token, prefix: token.slice(0, 11), expiresAt: expires, projects: args.projects };
  });
}

export async function listRunners(projects: string[] | null): Promise<RunnerRow[]> {
  await ensureJobsSchema();
  const { rows } = projects
    ? await sql<RunnerRow>`
        SELECT id, prefix, label, created_by, projects, created_at, expires_at, revoked_at, last_seen_at
        FROM sparc_runners
        WHERE projects ?| ARRAY(SELECT jsonb_array_elements_text(${asList(projects)}::jsonb))
        ORDER BY created_at DESC LIMIT 100`
    : await sql<RunnerRow>`
        SELECT id, prefix, label, created_by, projects, created_at, expires_at, revoked_at, last_seen_at
        FROM sparc_runners ORDER BY created_at DESC LIMIT 100`;
  return rows;
}

export async function revokeRunner(id: string, projects: string[] | null): Promise<RunnerRow | null> {
  await ensureJobsSchema();
  const { rows } = projects
    ? await sql<RunnerRow>`
        UPDATE sparc_runners SET revoked_at = NOW()
        WHERE id = ${id} AND revoked_at IS NULL
          AND projects ?| ARRAY(SELECT jsonb_array_elements_text(${asList(projects)}::jsonb))
        RETURNING id, prefix, label, created_by, projects, created_at, expires_at, revoked_at, last_seen_at`
    : await sql<RunnerRow>`
        UPDATE sparc_runners SET revoked_at = NOW() WHERE id = ${id} AND revoked_at IS NULL
        RETURNING id, prefix, label, created_by, projects, created_at, expires_at, revoked_at, last_seen_at`;
  return rows[0] ?? null;
}

/** Resolves a runner token, or null if unknown, revoked or expired. Records when it was last seen. */
export async function verifyRunner(token: string): Promise<RunnerRow | null> {
  await ensureJobsSchema();
  if (!token.startsWith("sdd_rt_") || token.length > 100) return null;
  const { rows } = await sql<RunnerRow>`
    UPDATE sparc_runners SET last_seen_at = NOW()
    WHERE token_hash = ${hash(token)} AND revoked_at IS NULL AND expires_at > NOW()
    RETURNING id, prefix, label, created_by, projects, created_at, expires_at, revoked_at, last_seen_at`;
  return rows[0] ?? null;
}

// ── Events ──────────────────────────────────────────────────────────────────

async function addEvent(
  c: VercelPoolClient | null,
  jobId: string,
  status: string,
  actor: string,
  actorType: string,
  note: string | null,
) {
  const q = c ? c.sql : sql;
  await q`
    INSERT INTO sparc_job_events (job_id, status, actor, actor_type, note)
    VALUES (${jobId}, ${status}, ${actor}, ${actorType}, ${note})`;
}

export async function jobEvents(jobId: string, limit = 100): Promise<JobEventRow[]> {
  await ensureJobsSchema();
  const { rows } = await sql<JobEventRow>`
    SELECT id::text AS id, at, status, actor, actor_type, note FROM sparc_job_events
    WHERE job_id = ${jobId} ORDER BY id LIMIT ${limit}`;
  return rows;
}

// ── Requesting a job ────────────────────────────────────────────────────────

export interface NewJob {
  projectSlug: string;
  kind: JobKind;
  title: string;
  params: Record<string, unknown>;
  estGpuHours: number;
  clusterPreference: string | null;
  noPhi: boolean;
  dryRun: boolean;
  requestedBy: string;
  requestedRole: string;
  /** Owner and Admin requests skip the approval step. */
  autoApprove: boolean;
}

/** Registers one job request, with the quota checks and the first event in the same transaction. */
export async function createJob(job: NewJob): Promise<JobRow> {
  await ensureJobsSchema();
  const id = "job_" + randomBytes(9).toString("base64url");
  const status: JobStatus = job.autoApprove ? "queued" : "pending";
  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"jobs:" + job.projectSlug}))`;

    const mine = await c.sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM sparc_jobs
      WHERE requested_by = ${job.requestedBy} AND created_at > NOW() - INTERVAL '1 day'`;
    if (Number(mine.rows[0]?.n ?? 0) >= JOB_LIMITS.maxJobsPerPersonPerDay) {
      throw new LimitError(429, `You have requested ${JOB_LIMITS.maxJobsPerPersonPerDay} jobs in the last day. Try again later.`);
    }
    const today = await c.sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM sparc_jobs
      WHERE project_slug = ${job.projectSlug} AND created_at > NOW() - INTERVAL '1 day'`;
    if (Number(today.rows[0]?.n ?? 0) >= JOB_LIMITS.maxJobsPerProjectPerDay) {
      throw new LimitError(429, `This project has requested ${JOB_LIMITS.maxJobsPerProjectPerDay} jobs in the last day. Try again tomorrow.`);
    }
    const open = await c.sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM sparc_jobs
      WHERE project_slug = ${job.projectSlug}
        AND status IN (SELECT jsonb_array_elements_text(${asList(OPEN_STATUSES)}::jsonb))`;
    if (Number(open.rows[0]?.n ?? 0) >= JOB_LIMITS.maxOpenPerProject) {
      throw new LimitError(429, `This project already has ${JOB_LIMITS.maxOpenPerProject} jobs waiting or running. Wait for some to finish.`);
    }
    // Dry runs cost no cluster time, so they do not count against the GPU budget.
    if (!job.dryRun) {
      const spent = await c.sql<{ h: string }>`
        SELECT COALESCE(SUM(est_gpu_hours), 0)::text AS h FROM sparc_jobs
        WHERE project_slug = ${job.projectSlug} AND dry_run = FALSE
          AND created_at > NOW() - INTERVAL '30 days'
          AND status <> 'rejected' AND status <> 'cancelled'`;
      const used = Number(spent.rows[0]?.h ?? 0);
      if (used + job.estGpuHours > JOB_LIMITS.maxGpuHoursPerProjectPer30Days) {
        throw new LimitError(
          429,
          `This project has ${(JOB_LIMITS.maxGpuHoursPerProjectPer30Days - used).toFixed(1)} of its ${JOB_LIMITS.maxGpuHoursPerProjectPer30Days} GPU-hour budget left for the last 30 days; this request asks for ${job.estGpuHours}.`,
        );
      }
    }

    const { rows } = await c.sql<JobRow>`
      INSERT INTO sparc_jobs
        (id, project_slug, kind, title, status, requested_by, requested_role, params, est_gpu_hours,
         cluster_preference, no_phi, dry_run, decided_at)
      VALUES (${id}, ${job.projectSlug}, ${job.kind}, ${job.title}, ${status}, ${job.requestedBy},
              ${job.requestedRole}, ${JSON.stringify(job.params)}::jsonb, ${job.estGpuHours},
              ${job.clusterPreference}, ${job.noPhi}, ${job.dryRun},
              ${job.autoApprove ? new Date().toISOString() : null})
      RETURNING *`;
    await addEvent(c, id, status, job.requestedBy, "human", job.autoApprove ? "Requested and approved by the requester's role." : "Requested; waiting for an Owner or Admin.");
    return rows[0];
  });
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getJob(id: string): Promise<JobRow | null> {
  await ensureJobsSchema();
  const { rows } = await sql<JobRow>`SELECT * FROM sparc_jobs WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function listJobs(opts: {
  project?: string | null;
  requestedBy?: string | null;
  statuses?: readonly string[] | null;
  limit?: number;
}): Promise<JobRow[]> {
  await ensureJobsSchema();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const { rows } = await sql<JobRow>`
    SELECT * FROM sparc_jobs
    WHERE (${opts.project ?? null}::text IS NULL OR project_slug = ${opts.project ?? null})
      AND (${opts.requestedBy ?? null}::text IS NULL OR requested_by = ${opts.requestedBy ?? null})
      AND (${opts.statuses ? asList(opts.statuses) : null}::jsonb IS NULL
           OR status IN (SELECT jsonb_array_elements_text(${opts.statuses ? asList(opts.statuses) : null}::jsonb)))
    ORDER BY created_at DESC LIMIT ${limit}`;
  return rows;
}

/** What a project has spent and has waiting, for the job list header. */
export async function projectJobUsage(slug: string) {
  await ensureJobsSchema();
  const { rows } = await sql<{ open: number; day: number; hours: string }>`
    SELECT
      COUNT(*) FILTER (WHERE status IN (SELECT jsonb_array_elements_text(${asList(OPEN_STATUSES)}::jsonb)))::int AS open,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day')::int AS day,
      COALESCE(SUM(est_gpu_hours) FILTER (
        WHERE dry_run = FALSE AND created_at > NOW() - INTERVAL '30 days'
          AND status <> 'rejected' AND status <> 'cancelled'), 0)::text AS hours
    FROM sparc_jobs WHERE project_slug = ${slug}`;
  const r = rows[0];
  return {
    open: Number(r?.open ?? 0),
    day: Number(r?.day ?? 0),
    gpuHours: Number(r?.hours ?? 0),
    gpuHourBudget: JOB_LIMITS.maxGpuHoursPerProjectPer30Days,
  };
}

// ── State changes by a person ───────────────────────────────────────────────

export type Decision = "approve" | "reject" | "cancel" | "requeue";

const ALLOWED_FROM: Record<Decision, JobStatus[]> = {
  approve: ["pending"],
  reject: ["pending"],
  cancel: ["pending", "queued"],
  requeue: ["claimed", "submitted", "running"],
};
const DECISION_STATUS: Record<Decision, JobStatus> = {
  approve: "queued",
  reject: "rejected",
  cancel: "cancelled",
  requeue: "queued",
};

/**
 * Moves a job, if that move is allowed from its current status. Returns null when the job is not in
 * a status the decision applies to (someone else moved it first).
 */
export async function decideJob(args: {
  id: string;
  decision: Decision;
  actor: string;
  note: string | null;
}): Promise<JobRow | null> {
  await ensureJobsSchema();
  const to = DECISION_STATUS[args.decision];
  const from = ALLOWED_FROM[args.decision];
  return inTransaction(async (c) => {
    const { rows } = await c.sql<JobRow>`
      UPDATE sparc_jobs
      SET status = ${to},
          decided_at = CASE WHEN ${args.decision} IN ('approve', 'reject') THEN NOW() ELSE decided_at END,
          finished_at = CASE WHEN ${to} IN ('rejected', 'cancelled') THEN NOW() ELSE finished_at END,
          runner_id = CASE WHEN ${args.decision} = 'requeue' THEN NULL ELSE runner_id END,
          claimed_at = CASE WHEN ${args.decision} = 'requeue' THEN NULL ELSE claimed_at END,
          updated_at = NOW()
      WHERE id = ${args.id}
        AND status IN (SELECT jsonb_array_elements_text(${asList(from)}::jsonb))
      RETURNING *`;
    if (!rows[0]) return null;
    await addEvent(c, args.id, to, args.actor, "human", args.note);
    return rows[0];
  });
}

// ── State changes by a runner ───────────────────────────────────────────────

/** Hands queued jobs to a runner. Two runners never get the same job. */
export async function claimJobs(runner: RunnerRow, limit: number): Promise<JobRow[]> {
  await ensureJobsSchema();
  const n = Math.min(Math.max(limit, 1), JOB_LIMITS.maxClaimPerPoll);
  return inTransaction(async (c) => {
    const { rows } = await c.sql<JobRow>`
      UPDATE sparc_jobs SET status = 'claimed', runner_id = ${runner.id}, claimed_at = NOW(), updated_at = NOW()
      WHERE id IN (
        SELECT id FROM sparc_jobs
        WHERE status = 'queued'
          AND project_slug IN (SELECT jsonb_array_elements_text(${asList(runner.projects)}::jsonb))
        ORDER BY created_at
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *`;
    for (const job of rows) {
      await addEvent(c, job.id, "claimed", `runner ${runner.prefix}…`, "runner", runner.label ? `Claimed by ${runner.label}.` : "Claimed by a runner.");
    }
    return rows;
  });
}

/** A progress report from the runner that holds the job. */
export async function runnerUpdate(args: {
  id: string;
  runnerId: string;
  status: Extract<JobStatus, "submitted" | "running">;
  cluster?: string | null;
  externalId?: string | null;
  note?: string | null;
}): Promise<JobRow | null> {
  await ensureJobsSchema();
  return inTransaction(async (c) => {
    const { rows } = await c.sql<JobRow>`
      UPDATE sparc_jobs
      SET status = ${args.status},
          cluster = COALESCE(${args.cluster ?? null}, cluster),
          external_id = COALESCE(${args.externalId ?? null}, external_id),
          started_at = CASE WHEN ${args.status} = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
          updated_at = NOW()
      WHERE id = ${args.id} AND runner_id = ${args.runnerId}
        AND status IN ('claimed', 'submitted', 'running')
      RETURNING *`;
    if (!rows[0]) return null;
    await addEvent(c, args.id, args.status, `runner ${args.runnerId}`, "runner", args.note ?? null);
    return rows[0];
  });
}

/** The runner's final word on a job: results pushed as an iteration, or a failure. */
export async function runnerComplete(args: {
  id: string;
  runnerId: string;
  ok: boolean;
  iteration?: number | null;
  cluster?: string | null;
  externalId?: string | null;
  error?: string | null;
  note?: string | null;
}): Promise<JobRow | null> {
  await ensureJobsSchema();
  const status: JobStatus = args.ok ? "succeeded" : "failed";
  return inTransaction(async (c) => {
    const { rows } = await c.sql<JobRow>`
      UPDATE sparc_jobs
      SET status = ${status},
          result_iteration = COALESCE(${args.iteration ?? null}, result_iteration),
          cluster = COALESCE(${args.cluster ?? null}, cluster),
          external_id = COALESCE(${args.externalId ?? null}, external_id),
          error = ${args.ok ? null : (args.error ?? "The runner reported a failure without a message.")},
          finished_at = NOW(), updated_at = NOW()
      WHERE id = ${args.id} AND runner_id = ${args.runnerId}
        AND status IN ('claimed', 'submitted', 'running')
      RETURNING *`;
    if (!rows[0]) return null;
    await addEvent(c, args.id, status, `runner ${args.runnerId}`, "runner", args.note ?? args.error ?? null);
    return rows[0];
  });
}

/** True when a runner has held the job without an update for longer than the stale window. */
export const isStale = (job: JobRow): boolean =>
  IN_FLIGHT.includes(job.status as JobStatus) &&
  Date.now() - new Date(job.updated_at).getTime() > JOB_LIMITS.staleAfterHours * 3_600_000;

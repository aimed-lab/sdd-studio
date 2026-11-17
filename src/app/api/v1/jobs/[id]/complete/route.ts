import { NextRequest } from "next/server";
import { JOB_ID_RE, jobRunner, jobView } from "@/lib/jobs-api";
import { getJob, runnerComplete } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";
import { audit } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const CLUSTER_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const EXTERNAL_RE = /^[A-Za-z0-9._:-]{1,60}$/;

/**
 * POST /api/v1/jobs/{id}/complete — the runner's last word on a job.
 * Body: { ok: boolean, iteration?: number, cluster?, externalId?, error?, note? }
 * Authorization: Bearer sdd_rt_…
 *
 * The results themselves are not sent here: the runner pushes them as a project iteration with
 * tools/sdd-cli/sdd.mjs and names that iteration's number, so the job record points at the data.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await jobRunner(req);
  if ("response" in caller) return caller.response;
  if (!JOB_ID_RE.test(params.id)) return fail(404, "Job not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.ok !== "boolean") return fail(400, "ok must be true or false.");
  let iteration: number | null = null;
  if (b.iteration != null) {
    iteration = Number(b.iteration);
    if (!Number.isInteger(iteration) || iteration < 1 || iteration > 1e6) return fail(400, "iteration must be the iteration number the results were pushed as.");
  }
  if (b.ok && iteration == null) {
    return fail(400, "A successful job needs the iteration its results were pushed as. Push the results first, then report completion.");
  }
  for (const [name, re] of [["cluster", CLUSTER_RE], ["externalId", EXTERNAL_RE]] as const) {
    const v = b[name];
    if (v != null && (typeof v !== "string" || !re.test(v))) return fail(400, `${name} is not in the expected form.`);
  }
  for (const name of ["error", "note"] as const) {
    const v = b[name];
    if (v != null && (typeof v !== "string" || v.length > 2_000)) return fail(400, `${name}: at most 2000 characters.`);
  }
  if (!b.ok && (typeof b.error !== "string" || !b.error.trim())) {
    return fail(400, "A failed job needs an error message.");
  }

  try {
    const existing = await getJob(params.id);
    if (!existing) return fail(404, "Job not found.");
    const job = await runnerComplete({
      id: params.id,
      runnerId: caller.runner.id,
      ok: b.ok,
      iteration,
      cluster: typeof b.cluster === "string" ? b.cluster : null,
      externalId: typeof b.externalId === "string" ? b.externalId : null,
      error: typeof b.error === "string" ? b.error.trim().slice(0, 2_000) : null,
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 2_000) : null,
    });
    if (!job) return fail(409, "This job is not yours to finish, or it is already finished.");
    // The project audit log carries the compute outcome next to the pushes it produced.
    await audit(job.project_slug, `runner ${caller.runner.prefix}…`, "runner", b.ok ? "job_succeeded" : "job_failed", job.id, {
      kind: job.kind,
      dryRun: job.dry_run,
      cluster: job.cluster,
      externalId: job.external_id,
      iteration: job.result_iteration,
    });
    return json({ ok: true, job: jobView(job, { withRequester: true }) });
  } catch (err) {
    console.error("[/api/v1/jobs/:id/complete] POST", err);
    return fail(503, "Database unavailable.");
  }
}

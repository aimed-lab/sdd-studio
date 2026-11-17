import { NextRequest } from "next/server";
import { JOB_ID_RE, jobRunner, jobView } from "@/lib/jobs-api";
import { runnerUpdate } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const CLUSTER_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const EXTERNAL_RE = /^[A-Za-z0-9._:-]{1,60}$/;

/**
 * POST /api/v1/jobs/{id}/status — progress from the runner holding the job.
 * Body: { status: "submitted" | "running", cluster?, externalId?, note? }. Authorization: Bearer sdd_rt_…
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
  if (b.status !== "submitted" && b.status !== "running") return fail(400, 'status must be "submitted" or "running".');
  if (b.cluster != null && (typeof b.cluster !== "string" || !CLUSTER_RE.test(b.cluster))) {
    return fail(400, "cluster must be a cluster name (lowercase letters, digits and dashes).");
  }
  if (b.externalId != null && (typeof b.externalId !== "string" || !EXTERNAL_RE.test(b.externalId))) {
    return fail(400, "externalId must be the job id on the compute side (letters, digits, dot, dash, colon, underscore).");
  }
  if (b.note != null && (typeof b.note !== "string" || b.note.length > 300)) return fail(400, "note: at most 300 characters.");

  try {
    const job = await runnerUpdate({
      id: params.id,
      runnerId: caller.runner.id,
      status: b.status,
      cluster: typeof b.cluster === "string" ? b.cluster : null,
      externalId: typeof b.externalId === "string" ? b.externalId : null,
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
    });
    // Also the answer when another runner holds the job, or a person cancelled or requeued it.
    if (!job) return fail(409, "This job is not yours to update, or it is no longer running.");
    return json({ ok: true, job: jobView(job, { withRequester: true }) });
  } catch (err) {
    console.error("[/api/v1/jobs/:id/status] POST", err);
    return fail(503, "Database unavailable.");
  }
}

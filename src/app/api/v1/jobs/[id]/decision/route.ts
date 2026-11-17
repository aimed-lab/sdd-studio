import { NextRequest } from "next/server";
import { JOB_ID_RE, canSeeJob, isJobAdmin, jobActor, jobView } from "@/lib/jobs-api";
import { decideJob, getJob, type Decision } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const DECISIONS: Decision[] = ["approve", "reject", "cancel", "requeue"];

/**
 * POST /api/v1/jobs/{id}/decision — Body: { decision: "approve" | "reject" | "cancel" | "requeue", note? }.
 *
 *   approve, reject  — an Owner or Admin, on a pending job.
 *   cancel           — the requester, an Owner or an Admin, before the job runs.
 *   requeue          — an Owner or Admin, on a job whose runner stopped reporting; another runner takes it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!JOB_ID_RE.test(params.id)) return fail(404, "Job not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const caller = await jobActor(req, "Developer", (body as { email?: string })?.email ?? null);
  if ("response" in caller) return caller.response;
  const { actor } = caller;
  const decision = (body as { decision?: unknown })?.decision;
  if (typeof decision !== "string" || !(DECISIONS as readonly string[]).includes(decision)) {
    return fail(400, `decision must be one of ${DECISIONS.join(", ")}.`);
  }
  const rawNote = (body as { note?: unknown })?.note;
  if (rawNote != null && (typeof rawNote !== "string" || rawNote.length > 300)) {
    return fail(400, "note: at most 300 characters.");
  }
  const note = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim() : null;

  try {
    const job = await getJob(params.id);
    if (!job || !canSeeJob(actor, job)) return fail(404, "Job not found.");
    const admin = isJobAdmin(actor.role);
    if (decision !== "cancel" && !admin) return fail(403, "Only an Owner or Admin can approve, reject or requeue a job.");

    const moved = await decideJob({
      id: job.id,
      decision: decision as Decision,
      actor: actor.email,
      note,
    });
    if (!moved) return fail(409, `This job is ${job.status}; "${decision}" does not apply to it.`);
    return json({ ok: true, job: jobView(moved, { withRequester: true }) });
  } catch (err) {
    console.error("[/api/v1/jobs/:id/decision] POST", err);
    return fail(503, "Database unavailable.");
  }
}

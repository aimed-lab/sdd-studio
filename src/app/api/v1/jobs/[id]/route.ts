import { NextRequest } from "next/server";
import { JOB_ID_RE, canSeeJob, jobRequester, jobView } from "@/lib/jobs-api";
import { getJob, isStale, jobEvents } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET /api/v1/jobs/{id} — one job with its event log. The requester, an Owner or an Admin. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await jobRequester(req);
  if ("response" in caller) return caller.response;
  if (!JOB_ID_RE.test(params.id)) return fail(404, "Job not found.");
  try {
    const job = await getJob(params.id);
    // Same answer whether the job does not exist or is not this account's: no probing by id.
    if (!job || !canSeeJob(caller.user, job)) return fail(404, "Job not found.");
    return json({
      ok: true,
      job: jobView(job, { withRequester: true }),
      stale: isStale(job),
      events: (await jobEvents(job.id)).map((e) => ({
        at: e.at, status: e.status, actor: e.actor, actorType: e.actor_type, note: e.note,
      })),
    });
  } catch (err) {
    console.error("[/api/v1/jobs/:id] GET", err);
    return fail(503, "Database unavailable.");
  }
}

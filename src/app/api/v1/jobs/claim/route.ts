import { NextRequest } from "next/server";
import { jobRunner, jobView } from "@/lib/jobs-api";
import { JOB_LIMITS, claimJobs } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/v1/jobs/claim — a SPARC runner takes queued jobs for the projects its token lists.
 * Body: { max?: 1–4 }. Authorization: Bearer sdd_rt_…
 *
 * Two runners never receive the same job. A claimed job the runner does not finish stays claimed and
 * shows as stale after a few hours, so an Owner or Admin can send it back to the queue.
 */
export async function POST(req: NextRequest) {
  const caller = await jobRunner(req);
  if ("response" in caller) return caller.response;
  const { runner } = caller;

  let max = 1;
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "max" in body && body.max != null) max = Number((body as { max: unknown }).max);
  } catch {
    // An empty body is fine: claim one job.
  }
  if (!Number.isInteger(max) || max < 1 || max > JOB_LIMITS.maxClaimPerPoll) {
    return fail(400, `max must be a whole number from 1 to ${JOB_LIMITS.maxClaimPerPoll}.`);
  }

  try {
    const jobs = await claimJobs(runner, max);
    return json({
      ok: true,
      runner: { id: runner.id, prefix: runner.prefix, projects: runner.projects },
      // The runner needs the requester to attribute the run; it is a lab machine, not the browser.
      jobs: jobs.map((j) => jobView(j, { withRequester: true })),
      pollSeconds: 30,
    });
  } catch (err) {
    console.error("[/api/v1/jobs/claim] POST", err);
    return fail(503, "Database unavailable.");
  }
}

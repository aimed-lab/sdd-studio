import { NextRequest } from "next/server";
import { canSeeJob, isJobAdmin, jobRequester, jobView, parseJobRequest } from "@/lib/jobs-api";
import { JOB_STATUSES, createJob, listJobs } from "@/lib/jobs-db";
import { fail, json, SLUG_RE } from "@/lib/projects-api";
import { LimitError, getProject } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/*
 * Compute-job requests (docs/sparc-jobs-plan.md). A request is a record, not a run: a runner on the
 * SPARC side claims approved jobs and submits them through SPARCq.
 *
 * Who may request what, until per-campaign membership exists:
 *   sandbox   — Developer and up; always a dry run, completed with labelled test data;
 *   campaign  — Owner and Admin, the roles that can already read a campaign without a key.
 * An Owner's or Admin's own request starts queued; a Developer's starts pending and needs approval.
 */

/** GET /api/v1/jobs?project=&status=&mine=1 — jobs this account may see, newest first. */
export async function GET(req: NextRequest) {
  const caller = await jobRequester(req);
  if ("response" in caller) return caller.response;
  const { user } = caller;

  const sp = req.nextUrl.searchParams;
  const project = sp.get("project");
  if (project && !SLUG_RE.test(project)) return fail(400, "project must be a project slug.");
  const status = sp.getAll("status").filter((s) => (JOB_STATUSES as readonly string[]).includes(s));
  const admin = isJobAdmin(user.role);
  const mine = sp.get("mine") === "1" || !admin;

  try {
    const jobs = await listJobs({
      project,
      requestedBy: mine ? user.email.trim().toLowerCase() : null,
      statuses: status.length ? status : null,
      limit: Number(sp.get("limit") ?? 50),
    });
    return json({
      ok: true,
      scope: mine ? "mine" : "all",
      jobs: jobs.map((j) => jobView(j, { withRequester: canSeeJob(user, j) })),
    });
  } catch (err) {
    console.error("[/api/v1/jobs] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST /api/v1/jobs — request one job. Body: { project, kind, title, params, estGpuHours, cluster?, noPhi }. */
export async function POST(req: NextRequest) {
  const caller = await jobRequester(req, "Developer");
  if ("response" in caller) return caller.response;
  const { user } = caller;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const slug = typeof (body as { project?: unknown })?.project === "string" ? (body as { project: string }).project : "";
  if (!SLUG_RE.test(slug)) return fail(400, "project is required: the slug of the campaign, or sandbox.");

  const parsed = parseJobRequest(body);
  if ("error" in parsed) return fail(400, parsed.error);

  try {
    const project = await getProject(slug);
    if (!project) return fail(404, "Project not found.");
    const admin = isJobAdmin(user.role);
    if (project.kind !== "sandbox" && !admin) {
      return fail(403, "Only an Owner or Admin can request a run for a campaign. Use the sandbox for a test run.");
    }
    // The sandbox holds test data only, so a sandbox job is always completed as a labelled dry run.
    const dryRun = project.kind === "sandbox";

    const job = await createJob({
      projectSlug: slug,
      kind: parsed.kind,
      title: parsed.title,
      params: parsed.params,
      estGpuHours: parsed.estGpuHours,
      clusterPreference: parsed.clusterPreference,
      noPhi: true,
      dryRun,
      requestedBy: user.email.trim().toLowerCase(),
      requestedRole: user.role,
      autoApprove: admin,
    });

    return json(
      {
        ok: true,
        job: jobView(job, { withRequester: true }),
        url: `${req.nextUrl.origin}/jobs/${job.id}`,
        note: dryRun
          ? "Sandbox job: a runner will complete it with clearly labelled test data, not a cluster run."
          : job.status === "pending"
            ? "Waiting for an Owner or Admin to approve it."
            : "Queued. A SPARC runner will claim it on its next poll.",
      },
      201,
    );
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/jobs] POST", err);
    return fail(503, "Database unavailable.");
  }
}

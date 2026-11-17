import { NextRequest } from "next/server";
import { canSeeJob, isJobAdmin, jobActor, jobView, parseJobRequest } from "@/lib/jobs-api";
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
  const sp = req.nextUrl.searchParams;
  // `email` is used only where single sign-on is off and the server cannot read a session.
  const caller = await jobActor(req, "Developer", sp.get("email"));
  if ("response" in caller) return caller.response;
  const { actor } = caller;

  const project = sp.get("project");
  if (project && !SLUG_RE.test(project)) return fail(400, "project must be a project slug.");
  const status = sp.getAll("status").filter((s) => (JOB_STATUSES as readonly string[]).includes(s));
  const admin = isJobAdmin(actor.role);
  const mine = sp.get("mine") === "1" || !admin;

  try {
    const jobs = await listJobs({
      project,
      requestedBy: mine ? actor.email : null,
      statuses: status.length ? status : null,
      limit: Number(sp.get("limit") ?? 50),
    });
    return json({
      ok: true,
      scope: mine ? "mine" : "all",
      jobs: jobs.map((j) => jobView(j, { withRequester: canSeeJob(actor, j) })),
    });
  } catch (err) {
    console.error("[/api/v1/jobs] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST /api/v1/jobs — request one job. Body: { project, kind, title, params, estGpuHours, cluster?, noPhi }. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const caller = await jobActor(req, "Developer", (body as { email?: string })?.email ?? null);
  if ("response" in caller) return caller.response;
  const { actor } = caller;

  const slug = typeof (body as { project?: unknown })?.project === "string" ? (body as { project: string }).project : "";
  if (!SLUG_RE.test(slug)) return fail(400, "project is required: the slug of the campaign, or sandbox.");

  const parsed = parseJobRequest(body);
  if ("error" in parsed) return fail(400, parsed.error);

  try {
    const project = await getProject(slug);
    if (!project) return fail(404, "Project not found.");
    const admin = isJobAdmin(actor.role);
    if (project.kind !== "sandbox" && !admin) {
      return fail(403, "Only an Owner or Admin can request a run for a campaign. Use the sandbox for a test run.");
    }
    // Without a verified session the server cannot be sure who is asking, so real cluster time is off limits.
    if (project.kind !== "sandbox" && !actor.verified) {
      return fail(403, "A run for a campaign needs Studio sign-in, which is not configured on this deployment. The sandbox (dry runs) is available.");
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
      requestedBy: actor.email,
      requestedRole: actor.role,
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

import { NextRequest } from "next/server";
import { bearer, fail, json, parsePush, sandboxOnly, SLUG_RE } from "@/lib/projects-api";
import {
  LIMITS, commitIteration, findIterationByManifest, getProject, listIterations, pruneSandbox, verifyToken,
} from "@/lib/projects-db";

export const dynamic = "force-dynamic";

/** GET /api/v1/projects/{slug}/iterations — latest iterations, newest first. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  try {
    const project = await getProject(params.slug);
    const denied = sandboxOnly(project);
    if (denied) return denied;
    return json({ ok: true, iterations: await listIterations(params.slug) });
  } catch (err) {
    console.error("[/api/v1/projects/:slug/iterations] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/**
 * POST /api/v1/projects/{slug}/iterations — register one iteration: the file index (no file bytes;
 * those live in Box) and up to 10 summary tables. Requires a project push token. Re-sending the same
 * label and file contents returns the existing iteration.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const token = bearer(req.headers.get("authorization"));
  if (!token) return fail(401, "Push token required: Authorization: Bearer sdd_pt_…");

  const text = await req.text();
  if (Buffer.byteLength(text) > LIMITS.maxBodyBytes) {
    return fail(413, `Push is larger than ${LIMITS.maxBodyBytes / 1e6} MB. Push fewer table rows (summary tables) or fewer files.`);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "Body must be JSON.");
  }

  try {
    const project = await getProject(params.slug);
    const denied = sandboxOnly(project);
    if (denied) return denied;
    const tok = await verifyToken(params.slug, token);
    if (!tok) return fail(401, "Push token is unknown, revoked, expired or for another project.");

    const input = parsePush(body, project!);
    if ("error" in input) return fail(400, input.error);

    const existing = await findIterationByManifest(params.slug, input.manifestSha);
    if (existing) {
      return json({ ok: true, duplicate: true, iteration: existing.n, label: existing.label, files: existing.files, newFiles: 0 });
    }

    const actor = `${tok.created_by} (token ${tok.prefix}…)`;
    const { iteration, newFiles } = await commitIteration({
      slug: params.slug,
      label: input.label,
      manifestSha: input.manifestSha,
      source: input.source,
      actor,
      actorType: input.source === "agent" ? "agent" : "token",
      gitSha: input.gitSha,
      summary: input.summary,
      files: input.files,
      tables: input.tables,
    });
    if (project!.kind === "sandbox") await pruneSandbox(params.slug, LIMITS.keepIterations);

    return json({
      ok: true,
      duplicate: false,
      iteration: iteration.n,
      label: iteration.label,
      files: input.files.length,
      newFiles,
      unchanged: input.files.length - newFiles,
      tables: input.tables.map((t) => ({ name: t.name, rows: t.rows.length })),
      url: `${req.nextUrl.origin}/projects/${params.slug}?view=iterations`,
    }, 201);
  } catch (err) {
    console.error("[/api/v1/projects/:slug/iterations] POST", err);
    return fail(503, "Database unavailable.");
  }
}

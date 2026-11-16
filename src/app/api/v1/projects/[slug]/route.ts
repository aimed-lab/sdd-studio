import { NextRequest } from "next/server";
import { json, fail, sandboxOnly, SLUG_RE } from "@/lib/projects-api";
import { getProject, listArtifacts, listIterations, listTables } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET /api/v1/projects/{slug} — project summary: iterations, file index and tables. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  try {
    const project = await getProject(params.slug);
    const denied = sandboxOnly(project);
    if (denied) return denied;
    const [iterations, artifacts, tables] = await Promise.all([
      listIterations(params.slug),
      listArtifacts(params.slug),
      listTables(params.slug),
    ]);
    return json({
      ok: true,
      project: { slug: project!.slug, title: project!.title, description: project!.description, kind: project!.kind },
      iterations: iterations.map((i) => ({
        n: i.n, label: i.label, source: i.source, actorType: i.actor_type, gitSha: i.git_sha, summary: i.summary,
        files: i.files, newFiles: i.new_files, status: i.status, createdAt: i.created_at,
      })),
      artifacts: artifacts.map((a) => ({
        iteration: a.iteration_n, path: a.path, kind: a.kind, sha256: a.sha256, size: Number(a.size),
        sensitivity: a.sensitivity, release: a.release_state, actorType: a.actor_type,
      })),
      tables: tables.map((t) => ({ name: t.table_name, iteration: t.iteration_n, rows: t.rows })),
    });
  } catch (err) {
    console.error("[/api/v1/projects/:slug] GET", err);
    return fail(503, "Database unavailable.");
  }
}

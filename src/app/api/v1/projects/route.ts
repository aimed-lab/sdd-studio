import { json, fail } from "@/lib/projects-api";
import { listProjects } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET /api/v1/projects — projects Studio knows about (titles and counts only). */
export async function GET() {
  try {
    const projects = await listProjects();
    return json({
      ok: true,
      // Campaigns need a project key: only their title is listed here.
      projects: projects.map((p) =>
        p.kind === "sandbox"
          ? { slug: p.slug, title: p.title, description: p.description, kind: p.kind, open: true, iterations: p.iterations, latestAt: p.latest_at }
          : { slug: p.slug, title: p.title, description: null, kind: p.kind, open: false, iterations: null, latestAt: null },
      ),
    });
  } catch (err) {
    console.error("[/api/v1/projects] GET", err);
    return fail(503, "Database unavailable.");
  }
}

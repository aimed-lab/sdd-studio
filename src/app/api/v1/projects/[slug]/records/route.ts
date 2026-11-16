import { NextRequest } from "next/server";
import { json, fail, sandboxOnly, SLUG_RE } from "@/lib/projects-api";
import { getProject, readRecords } from "@/lib/projects-db";

export const dynamic = "force-dynamic";

/** GET /api/v1/projects/{slug}/records?table=&iteration=&limit=&offset= — rows of one pushed table. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const q = req.nextUrl.searchParams;
  const table = q.get("table") ?? "";
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(table)) return fail(400, "table is required (lowercase name).");
  const iteration = q.get("iteration");
  const n = iteration == null ? null : Number(iteration);
  if (n !== null && (!Number.isInteger(n) || n < 1)) return fail(400, "iteration must be a positive integer.");
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 500) || 500, 1), 1000);
  const offset = Math.max(Number(q.get("offset") ?? 0) || 0, 0);
  try {
    const project = await getProject(params.slug);
    const denied = sandboxOnly(project);
    if (denied) return denied;
    const result = await readRecords(params.slug, table, n, limit, offset);
    return json({ ok: true, table, ...result, limit, offset });
  } catch (err) {
    console.error("[/api/v1/projects/:slug/records] GET", err);
    return fail(503, "Database unavailable.");
  }
}

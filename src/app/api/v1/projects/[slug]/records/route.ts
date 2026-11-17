import { NextRequest } from "next/server";
import { json, fail, readGate, SLUG_RE } from "@/lib/projects-api";
import { getProject, readRecords } from "@/lib/projects-db";

export const dynamic = "force-dynamic";

const qp = (req: NextRequest, k: string) => req.nextUrl.searchParams.get(k)?.trim() || null;
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET /api/v1/projects/{slug}/records?table=&iteration=&limit=&offset=&q=&sort=&dir= — rows of one pushed table. */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const q = req.nextUrl.searchParams;
  const table = q.get("table") ?? "";
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(table)) return fail(400, "table is required (lowercase name).");
  const int = (v: string | null, fallback: number) => (v == null ? fallback : /^\d{1,9}$/.test(v) ? Number(v) : NaN);
  const iteration = q.get("iteration");
  const n = iteration == null ? null : int(iteration, 0);
  if (n !== null && !(n >= 1)) return fail(400, "iteration must be a positive integer.");
  const limit = int(q.get("limit"), 500);
  const offset = int(q.get("offset"), 0);
  if (!(limit >= 1 && limit <= 1000)) return fail(400, "limit must be 1–1000.");
  if (!(offset >= 0 && offset <= 1_000_000)) return fail(400, "offset must be 0–1,000,000.");
  const search = qp(req, "q");
  if (search && search.length > 100) return fail(400, "q: at most 100 characters.");
  const sort = (s0 => (s0 && s0.length <= 60 ? s0 : null))(qp(req, "sort"));
  const desc = qp(req, "dir") === "desc";
  try {
    const project = await getProject(params.slug);
    const denied = await readGate(project, req);
    if (denied) return denied;
    const result = await readRecords(params.slug, table, n, limit, offset, { q: search, sort, desc });
    return json({ ok: true, table, ...result, limit, offset });
  } catch (err) {
    console.error("[/api/v1/projects/:slug/records] GET", err);
    return fail(503, "Database unavailable.");
  }
}

import { NextRequest } from "next/server";
import { bearer, fail, json, parseRows, SLUG_RE } from "@/lib/projects-api";
import { LIMITS, LimitError, appendRows, getProject, limitsFor, verifyToken } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/v1/projects/{slug}/iterations/{n}/rows — appends one chunk of rows to a table that the push
 * declared with `expectedRows`. Body: { table, offset, rows }. Same push key as the iteration.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string; n: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  if (!/^\d{1,9}$/.test(params.n)) return fail(404, "Iteration not found.");
  const token = bearer(req.headers.get("authorization"));
  if (!token) return fail(401, "Push key required: Authorization: Bearer sdd_pt_…");

  const text = await req.text();
  if (Buffer.byteLength(text) > LIMITS.maxBodyBytes) return fail(413, "Chunk is larger than 4 MB; send smaller chunks.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "Body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, "Body must be a JSON object.");
  const b = body as Record<string, unknown>;
  if (typeof b.table !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(b.table)) return fail(400, "table is required.");
  if (typeof b.offset !== "number" || !Number.isInteger(b.offset) || b.offset < 0) return fail(400, "offset must be a whole number.");

  try {
    const project = await getProject(params.slug);
    if (!project) return fail(404, "Project not found.");
    if (project.kind === "sandbox") return fail(403, "The sandbox does not take tables in chunks.");
    const tok = await verifyToken(params.slug, token, "push");
    if (!tok) return fail(401, "Push key is unknown, revoked, expired, read-only or for another project.");
    const parsed = parseRows(b.rows, "chunk", limitsFor(project.kind).maxColumns);
    if ("error" in parsed) return fail(400, parsed.error);
    if (Buffer.byteLength(JSON.stringify(parsed.rows)) > LIMITS.maxTableBytes) return fail(413, "Chunk rows exceed 1 MB; send smaller chunks.");
    const r = await appendRows({ slug: params.slug, n: Number(params.n), tokenId: tok.id, table: b.table, offset: b.offset, rows: parsed.rows });
    return json({ ok: true, table: b.table, have: r.have, expected: r.expected, complete: r.have === r.expected });
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/projects/:slug/iterations/:n/rows] POST", err);
    return fail(503, "Database unavailable.");
  }
}

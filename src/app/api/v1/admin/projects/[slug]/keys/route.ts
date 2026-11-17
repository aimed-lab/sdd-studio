import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { fail, json, SLUG_RE } from "@/lib/projects-api";
import { LIMITS, LimitError, createProjectKey, getProject, listProjectKeys, revokeProjectKey } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/*
 * Project keys, managed by the platform owner with the admin key (X-Admin-Token).
 *   read: open a campaign in Studio (and read its API).  push: write iterations (and read).
 */

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? b : null;
  } catch {
    return null;
  }
}

/** GET — every key of the project (prefix, scope, label, dates; never the key). */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  try {
    if (!(await getProject(params.slug))) return fail(404, "Project not found.");
    const keys = await listProjectKeys(params.slug);
    return json({
      ok: true,
      keys: keys.map((k) => ({
        id: k.id, prefix: k.prefix, scope: k.scope, label: k.label, createdBy: k.created_by, createdAt: k.created_at,
        expiresAt: k.expires_at, revokedAt: k.revoked_at, lastUsedAt: k.last_used_at,
      })),
    });
  } catch (err) {
    console.error("[/api/v1/admin/projects/:slug/keys] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST { scope: "read" | "push", label?, days? } — issues a key and returns it once. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const b = await body(req);
  if (!b) return fail(400, "Body must be a JSON object.");
  const scope = b.scope;
  if (scope !== "read" && scope !== "push") return fail(400, 'scope must be "read" or "push".');
  const label = typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 60) : null;
  const days = b.days == null ? 90 : Number(b.days);
  if (!Number.isInteger(days) || days < 1 || days > LIMITS.maxTokenDays) return fail(400, `days must be 1–${LIMITS.maxTokenDays}.`);
  try {
    if (!(await getProject(params.slug))) return fail(404, "Project not found.");
    const k = await createProjectKey(params.slug, scope, label, days);
    return json({ ok: true, id: k.id, key: k.token, prefix: k.prefix, scope: k.scope, expiresAt: k.expiresAt }, 201);
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/admin/projects/:slug/keys] POST", err);
    return fail(503, "Database unavailable.");
  }
}

/** DELETE { id } — revokes a key. */
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const b = await body(req);
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id || id.length > 30) return fail(400, "id is required.");
  try {
    return (await revokeProjectKey(params.slug, id)) ? json({ ok: true }) : fail(404, "Key not found or already revoked.");
  } catch (err) {
    console.error("[/api/v1/admin/projects/:slug/keys] DELETE", err);
    return fail(503, "Database unavailable.");
  }
}

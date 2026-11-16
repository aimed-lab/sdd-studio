import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { fail, json, SLUG_RE } from "@/lib/projects-api";
import { createProject } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** POST /api/v1/admin/projects { slug, title, description? } — creates a campaign. Needs X-Admin-Token. */
export async function POST(req: NextRequest) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  let b: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail(400, "Body must be a JSON object.");
    b = raw;
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 500) : null;
  // Names used by Studio's own pages or the example campaigns cannot be campaign slugs.
  const RESERVED = ["sandbox", "demo", "team", "performance", "reports", "example-np-analogs", "example-antibody", "new", "admin"];
  if (!SLUG_RE.test(slug) || RESERVED.includes(slug)) return fail(400, `slug: lowercase letters, digits and dashes, not one of ${RESERVED.join(", ")}.`);
  if (!title || title.length > 120) return fail(400, "title: 1–120 characters.");
  try {
    const p = await createProject(slug, title, description);
    return p ? json({ ok: true, project: { slug: p.slug, title: p.title, kind: p.kind } }, 201) : fail(409, "A project with that slug already exists.");
  } catch (err) {
    console.error("[/api/v1/admin/projects] POST", err);
    return fail(503, "Database unavailable.");
  }
}

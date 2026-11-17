import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { setFirstOwner } from "@/lib/account-email";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/v1/admin/accounts/owner { email, dryRun? } — makes this account the Owner, only while
 * Studio has no active Owner. It never replaces an existing Owner (that is ownership transfer, in
 * Studio). Needs X-Admin-Token. dryRun reports what would happen without writing.
 */
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
  const email = typeof b.email === "string" ? b.email : "";
  try {
    const r = await setFirstOwner(email, b.dryRun === true);
    if (!r.ok) return fail(r.status, r.error);
    if (!r.dryRun) console.info("[/api/v1/admin/accounts/owner] first Owner set", { action: r.action });
    return json({ ok: true, dryRun: r.dryRun, email: email.trim().toLowerCase(), action: r.action, previous: r.previous });
  } catch (err) {
    console.error("[/api/v1/admin/accounts/owner] POST", err);
    return fail(503, "Database unavailable.");
  }
}

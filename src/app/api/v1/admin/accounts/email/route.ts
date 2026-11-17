import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { changeAccountEmail } from "@/lib/account-email";
import { fail, json } from "@/lib/projects-api";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * POST /api/v1/admin/accounts/email { from, to, dryRun? } — moves a Studio account to a new email,
 * keeping its role, status and history. Needs X-Admin-Token. Use it when someone's SDD sign-in
 * uses a different address from their Studio account. dryRun reports the changes without writing.
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
  const from = typeof b.from === "string" ? b.from : "";
  const to = typeof b.to === "string" ? b.to : "";
  try {
    const r = await changeAccountEmail(from, to, b.dryRun === true);
    if (!r.ok) return fail(r.status, r.error);
    if (!r.dryRun) console.info("[/api/v1/admin/accounts/email] account moved", { role: r.role, changes: r.changes });
    return json({ ok: true, dryRun: r.dryRun, from: from.trim().toLowerCase(), to: to.trim().toLowerCase(), role: r.role, status: r.status, changes: r.changes });
  } catch (err) {
    console.error("[/api/v1/admin/accounts/email] POST", err);
    return fail(503, "Database unavailable.");
  }
}

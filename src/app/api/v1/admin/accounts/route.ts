import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { listAccounts } from "@/lib/account-email";
import { fail, json } from "@/lib/projects-api";
import { ROLE_ORDER } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET /api/v1/admin/accounts[?role=Owner] — Studio accounts, highest role first. Needs X-Admin-Token. */
export async function GET(req: NextRequest) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const role = req.nextUrl.searchParams.get("role");
  if (role !== null && !(ROLE_ORDER as string[]).includes(role)) return fail(400, `role must be one of ${ROLE_ORDER.join(", ")}.`);
  try {
    const rows = await listAccounts(role);
    return json({
      ok: true,
      accounts: rows.map((r) => ({ email: r.email, name: r.name, role: r.role, status: r.account_status, registeredAt: r.registered_at })),
    });
  } catch (err) {
    console.error("[/api/v1/admin/accounts] GET", err);
    return fail(503, "Database unavailable.");
  }
}

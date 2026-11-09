import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, type DBUser } from "@/lib/db";
import { type AppRole, roleRank } from "@/lib/roles";
import { ssoEnabled } from "@/lib/sso/config";
import { SESSION_COOKIE, unseal } from "@/lib/sso/signed-cookie";

export type Authorization =
  | { ok: true; user: DBUser | null }
  | { ok: false; response: NextResponse };

const deny = (error: string, status: number): Authorization => ({
  ok: false,
  response: NextResponse.json({ ok: false, error }, { status }),
});

export function rankOf(role: string | null | undefined): number {
  const rank = roleRank(role as AppRole);
  return rank === -1 ? roleRank("User") : rank;
}

export async function getSessionUser(req: NextRequest): Promise<DBUser | null> {
  if (!ssoEnabled()) return null;
  const session = unseal<{ email: string }>(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session?.email) return null;
  return getUserByEmail(session.email);
}

/**
 * With SSO off, returns { ok: true, user: null } so routes keep their legacy behaviour
 * (and the elevated-role lock). With SSO on, requires an active signed-in account,
 * at or above `minRole` when given.
 */
export async function authorize(req: NextRequest, minRole?: AppRole): Promise<Authorization> {
  if (!ssoEnabled()) return { ok: true, user: null };
  let user: DBUser | null;
  try {
    user = await getSessionUser(req);
  } catch (err) {
    console.error("[authorize] user lookup failed:", err);
    return deny("Account service unavailable. Please try again.", 503);
  }
  if (!user) return deny("Sign in required", 401);
  if (user.account_status !== "active") return deny("Your account is not active", 403);
  if (minRole && rankOf(user.role) > roleRank(minRole)) return deny("You do not have permission for this action", 403);
  return { ok: true, user };
}

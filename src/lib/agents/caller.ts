import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { authorize, rankOf } from "@/lib/session";
import { roleRank } from "@/lib/roles";

/** Header the browser sends with the signed-in email; read only when single sign-on is off. */
export const MEMBER_EMAIL_HEADER = "x-sdd-email";
/** Header carrying a member's own Anthropic key for one request; never stored or logged. */
export const MEMBER_KEY_HEADER = "x-anthropic-key";

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

export interface Caller {
  email: string;
  role: string;
  /** True when the server verified the account (single sign-on). False under the legacy sign-in. */
  verified: boolean;
}

export const noStore = { "Cache-Control": "no-store" };
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

/**
 * The member making the request. With single sign-on on, the signed-in account (any email the browser
 * sends is ignored). With it off (the legacy sign-in, used by preview deployments), the server cannot
 * verify who is calling: it takes the email the browser sends and requires an active member account,
 * the same rule as the sandbox push-token routes.
 */
export async function resolveCaller(req: NextRequest): Promise<{ caller: Caller } | { response: NextResponse }> {
  const auth = await authorize(req);
  if (!auth.ok) return { response: auth.response };
  if (auth.user) return { caller: { email: auth.user.email.trim().toLowerCase(), role: auth.user.role, verified: true } };

  const claimed = (req.headers.get(MEMBER_EMAIL_HEADER) ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(claimed)) return { response: fail(401, "Sign in required") };
  let user;
  try {
    user = await getUserByEmail(claimed);
  } catch (err) {
    console.error("[agents] member lookup failed:", err);
    return { response: fail(503, "Account service unavailable. Please try again.") };
  }
  if (!user || user.account_status !== "active") return { response: fail(403, "Only active Studio members can run agents.") };
  return { caller: { email: claimed, role: user.role, verified: false } };
}

/** Owner and Admins may open any member's run, but only when the server verified who they are. */
export const canSeeAllRuns = (c: Caller) => c.verified && rankOf(c.role) <= roleRank("Admin");

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { ssoEnabled } from "@/lib/sso/config";
import { PENDING_COOKIE, unseal } from "@/lib/sso/signed-cookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!ssoEnabled()) return NextResponse.json({ ssoEnabled: false, authenticated: false });

  const pending = unseal<{ email: string }>(req.cookies.get(PENDING_COOKIE)?.value);
  let user;
  try {
    user = await getSessionUser(req);
  } catch (err) {
    console.error("[/api/me] lookup failed:", err);
    return NextResponse.json({ ssoEnabled: true, authenticated: false, error: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    ssoEnabled: true,
    authenticated: !!user,
    user: user
      ? {
          email: user.email,
          name: user.name,
          role: user.role,
          accountStatus: user.account_status,
          title: user.title,
          institution: user.institution,
          invitedBy: user.invited_by,
          invitedAt: user.invited_at,
          approvedBy: user.approved_by,
          approvedAt: user.approved_at,
        }
      : null,
    pendingInvite: !user && pending ? { email: pending.email } : null,
  });
}

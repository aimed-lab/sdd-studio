import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { baseUrl, safeNextPath, ssoEnabled } from "@/lib/sso/config";
import { exchangeCodeForIdentity } from "@/lib/sso/oidc";
import {
  OIDC_FLOW_COOKIE,
  PENDING_COOKIE,
  PENDING_TTL_SECONDS,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearCookie,
  setSealedCookie,
  unseal,
} from "@/lib/sso/signed-cookie";

export const dynamic = "force-dynamic";

const toLogin = (reason: string) => {
  const res = NextResponse.redirect(`${baseUrl()}/login?sso_error=${encodeURIComponent(reason)}`);
  clearCookie(res, OIDC_FLOW_COOKIE);
  return res;
};

export async function GET(req: NextRequest) {
  if (!ssoEnabled()) return NextResponse.redirect(`${baseUrl()}/login`);

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return toLogin("denied");

  const flow = unseal<{ state: string; nonce: string; verifier: string; next: string }>(
    req.cookies.get(OIDC_FLOW_COOKIE)?.value
  );
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return toLogin("expired");

  let identity;
  try {
    identity = await exchangeCodeForIdentity(code, flow.verifier, flow.nonce);
  } catch (err) {
    console.error("[/auth/callback] token exchange failed:", err);
    return toLogin("failed");
  }
  if (!identity.emailVerified) return toLogin("unverified_email");

  let user;
  try {
    user = await getUserByEmail(identity.email);
  } catch (err) {
    console.error("[/auth/callback] user lookup failed:", err);
    return toLogin("failed");
  }

  if (!user || user.account_status === "invited") {
    // Known to SSO but not yet admitted here: ask for an invitation code once.
    const res = NextResponse.redirect(`${baseUrl()}/login?sso=invite`);
    clearCookie(res, OIDC_FLOW_COOKIE);
    setSealedCookie(res, PENDING_COOKIE, { email: identity.email, name: identity.name }, PENDING_TTL_SECONDS);
    return res;
  }
  if (user.account_status === "rejected" || user.account_status === "suspended") {
    return toLogin(`account_${user.account_status}`);
  }

  const res = NextResponse.redirect(`${baseUrl()}${safeNextPath(flow.next)}`);
  clearCookie(res, OIDC_FLOW_COOKIE);
  clearCookie(res, PENDING_COOKIE);
  setSealedCookie(res, SESSION_COOKIE, { email: user.email }, SESSION_TTL_SECONDS);
  return res;
}

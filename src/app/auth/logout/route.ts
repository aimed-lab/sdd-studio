import { NextResponse } from "next/server";
import { baseUrl, ssoEnabled } from "@/lib/sso/config";
import { logoutUrl } from "@/lib/sso/oidc";
import { PENDING_COOKIE, SESSION_COOKIE, clearCookie } from "@/lib/sso/signed-cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  const loginPage = `${baseUrl()}/login`;
  // Also end the Keycloak session, or the next sign-in would silently reuse it.
  const target = (ssoEnabled() && (await logoutUrl(loginPage))) || loginPage;
  const res = NextResponse.redirect(target);
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, PENDING_COOKIE);
  return res;
}

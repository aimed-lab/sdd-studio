import { NextRequest, NextResponse } from "next/server";
import { baseUrl, safeNextPath, ssoEnabled } from "@/lib/sso/config";
import { authorizationUrl, newLoginFlow } from "@/lib/sso/oidc";
import { OIDC_FLOW_COOKIE, OIDC_FLOW_TTL_SECONDS, setSealedCookie } from "@/lib/sso/signed-cookie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!ssoEnabled()) return NextResponse.redirect(new URL("/login", req.url));

  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const flow = newLoginFlow();
  let target: string;
  try {
    target = await authorizationUrl(flow);
  } catch (err) {
    console.error("[/auth/login] discovery failed:", err);
    return NextResponse.redirect(`${baseUrl()}/login?sso_error=unavailable`);
  }

  const res = NextResponse.redirect(target);
  setSealedCookie(
    res,
    OIDC_FLOW_COOKIE,
    { state: flow.state, nonce: flow.nonce, verifier: flow.verifier, next },
    OIDC_FLOW_TTL_SECONDS
  );
  return res;
}

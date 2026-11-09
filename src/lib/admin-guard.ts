import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/session";
import { ssoEnabled } from "@/lib/sso/config";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

const digest = (value: string) => createHash("sha256").update(value).digest();

// With SSO on, admin routes require a signed-in Admin. Without it the server cannot
// verify a role, so they are disabled unless ADMIN_API_TOKEN is set, and then require it.
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (ssoEnabled()) {
    const auth = await authorize(req, "Admin");
    return auth.ok ? null : auth.response;
  }
  return requireAdminToken(req);
}

function requireAdminToken(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const provided = req.headers.get(ADMIN_TOKEN_HEADER) ?? "";
  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }

  return null;
}

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const ADMIN_TOKEN_HEADER = "x-admin-token";

const digest = (value: string) => createHash("sha256").update(value).digest();

// Login is client-side only, so the server cannot trust a claimed role.
// Admin routes are disabled unless ADMIN_API_TOKEN is set, and then require it.
export function requireAdminToken(req: NextRequest): NextResponse | null {
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

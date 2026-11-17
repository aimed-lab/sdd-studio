import { NextRequest, NextResponse } from "next/server";

// Per-IP token buckets for the public read-only data routes. State lives in this instance's memory,
// so limits apply per edge instance rather than globally — an accepted fallback until a Vercel WAF
// rate-limit rule is configured.
const BUDGETS = {
  data: { capacity: 60, refillPerSecond: 1 }, // /api/search, /api/trials: 60 burst, 60/min sustained
  compound: { capacity: 15, refillPerSecond: 0.25 }, // /api/compound fans out to ~5 upstream calls: 15 burst, 15/min
  structure: { capacity: 10, refillPerSecond: 1 / 6 }, // /api/structure: slow ChEMBL similarity/substructure, 10 burst, 10/min
  evidence: { capacity: 20, refillPerSecond: 1 / 3 }, // /api/target-evidence: 2 Open Targets GraphQL calls, 20 burst, 20/min
  mcp: { capacity: 20, refillPerSecond: 1 / 3 }, // /api/mcp: each tools/call runs one of the routes above, 20 burst, 20/min
  targetPage: { capacity: 30, refillPerSecond: 1 / 2 }, // /targets/[gene]: server-renders HGNC + ChEMBL lookups, 30 burst, 30/min
  projectsRead: { capacity: 60, refillPerSecond: 1 }, // GET /api/v1/projects/*: 60 burst, 60/min
  projectsWrite: { capacity: 10, refillPerSecond: 1 / 6 }, // pushes and token changes: 10 burst, 10/min
} as const;

type BucketName = keyof typeof BUDGETS;
const buckets = new Map<string, { tokens: number; updated: number }>();
const MAX_TRACKED = 10_000;

function take(key: string, budget: { capacity: number; refillPerSecond: number }): number {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: budget.capacity, updated: now };
  b.tokens = Math.min(budget.capacity, b.tokens + ((now - b.updated) / 1000) * budget.refillPerSecond);
  b.updated = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    return 0;
  }
  buckets.set(key, b);
  return Math.ceil((1 - b.tokens) / budget.refillPerSecond);
}

// ── Sign-in gate for pages ──────────────────────────────────────────────────
// Every Studio page needs a signed-in member. Only the sign-in screen and the sign-in flow are open.
// The data API, MCP endpoint and /api/v1 (project keys) stay open here and do their own checks.
// The session cookie is the one /auth/callback sets (src/lib/sso/signed-cookie.ts): base64url(JSON)
// + "." + base64url(HMAC-SHA256(SESSION_SECRET, body)), with an `exp` in seconds. Middleware runs on
// the edge, so it is verified with Web Crypto. Account status is checked again by every data route.
const SESSION_COOKIE = "sdd_session";
const OPEN_PAGES = ["/login"];
const OPEN_PREFIXES = ["/auth/"];

const ssoConfigured = () =>
  !!process.env.OIDC_CLIENT_ID && !!process.env.OIDC_CLIENT_SECRET && !!process.env.SESSION_SECRET;

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let hmacKey: Promise<CryptoKey> | null = null;
async function validSession(value: string | undefined): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!value || !secret) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  try {
    hmacKey ??= crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const body = value.slice(0, dot);
    const ok = await crypto.subtle.verify("HMAC", await hmacKey, fromBase64Url(value.slice(dot + 1)), new TextEncoder().encode(body));
    if (!ok) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as { email?: unknown; exp?: unknown };
    return typeof payload.email === "string" && typeof payload.exp === "number" && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (!path.startsWith("/api/")) {
    const open = OPEN_PAGES.includes(path) || OPEN_PREFIXES.some((p) => path.startsWith(p));
    // With single sign-on off (its kill switch), the browser-side gate in auth-gate.tsx still requires sign-in.
    if (!open && ssoConfigured() && !(await validSession(req.cookies.get(SESSION_COOKIE)?.value))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      if (path !== "/") url.searchParams.set("next", path + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    if (!path.startsWith("/targets/")) return NextResponse.next();
  }

  const bucket: BucketName = path.startsWith("/api/v1/")
    ? req.method === "GET" ? "projectsRead" : "projectsWrite"
    : path.startsWith("/targets/")
    ? "targetPage"
    : path.startsWith("/api/mcp")
    ? "mcp"
    : path.startsWith("/api/compound")
      ? "compound"
      : path.startsWith("/api/structure")
        ? "structure"
        : path.startsWith("/api/target-evidence")
          ? "evidence"
          : "data";
  const ip = req.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (buckets.size > MAX_TRACKED) buckets.clear();

  const retryAfter = take(`${bucket}:${ip}`, BUDGETS[bucket]);
  if (retryAfter > 0) {
    if (bucket === "targetPage") {
      return new NextResponse(`Too many requests. Try again in ${retryAfter} s.`, {
        status: 429,
        headers: { "Retry-After": String(retryAfter), "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.json(
      { results: [], error: `Too many requests. Try again in ${retryAfter} s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rate-limited data APIs.
    "/api/search", "/api/trials", "/api/compound/:path*", "/api/structure", "/api/target-evidence", "/api/mcp",
    "/api/v1/:path+",
    // Every page (sign-in gate; /targets/* is also rate-limited). Not API routes, Next.js assets or files
    // with an extension (public/ files such as /openapi.json and images).
    "/((?!api/|_next/|favicon\\.ico|.*\\.[A-Za-z0-9]+$).*)",
  ],
};

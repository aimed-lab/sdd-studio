import { NextRequest, NextResponse } from "next/server";

// Per-IP token buckets for the public read-only data routes. State lives in this instance's memory,
// so limits apply per edge instance rather than globally — an accepted fallback until a Vercel WAF
// rate-limit rule is configured.
const BUDGETS = {
  data: { capacity: 60, refillPerSecond: 1 }, // /api/search, /api/trials: 60 burst, 60/min sustained
  compound: { capacity: 15, refillPerSecond: 0.25 }, // /api/compound fans out to ~5 upstream calls: 15 burst, 15/min
  structure: { capacity: 10, refillPerSecond: 1 / 6 }, // /api/structure: slow ChEMBL similarity/substructure, 10 burst, 10/min
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

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const bucket: BucketName = path.startsWith("/api/compound") ? "compound" : path.startsWith("/api/structure") ? "structure" : "data";
  const ip = req.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (buckets.size > MAX_TRACKED) buckets.clear();

  const retryAfter = take(`${bucket}:${ip}`, BUDGETS[bucket]);
  if (retryAfter > 0) {
    return NextResponse.json(
      { results: [], error: `Too many requests. Try again in ${retryAfter} s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/search", "/api/trials", "/api/compound/:path*", "/api/structure"],
};

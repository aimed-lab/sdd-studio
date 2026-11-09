import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { secureCookies, sessionSecret } from "./config";

export const SESSION_COOKIE = "sdd_session";
export const OIDC_FLOW_COOKIE = "sdd_oidc";
export const PENDING_COOKIE = "sdd_pending";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const OIDC_FLOW_TTL_SECONDS = 10 * 60;
export const PENDING_TTL_SECONDS = 15 * 60;

const sign = (body: string) => createHmac("sha256", sessionSecret()).update(body).digest("base64url");

export function seal(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function unseal<T extends Record<string, unknown>>(value: string | undefined): (T & { exp: number }) | null {
  if (!value || !sessionSecret()) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(value.slice(dot + 1));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

export function setSealedCookie(res: NextResponse, name: string, payload: Record<string, unknown>, ttlSeconds: number) {
  res.cookies.set(name, seal(payload, ttlSeconds), {
    httpOnly: true,
    secure: secureCookies(),
    // 'lax', not 'strict': the callback arrives as a top-level navigation from Keycloak.
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds,
  });
}

export function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 0 });
}

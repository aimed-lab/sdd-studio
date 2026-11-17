import { NextRequest, NextResponse } from "next/server";
import { fail, json, sandboxOnly, SLUG_RE } from "@/lib/projects-api";
import { getUserByEmail } from "@/lib/db";
import { authorize } from "@/lib/session";
import { LIMITS, LimitError, audit, createToken, getProject, listTokens, revokeToken } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
// The database driver can send queries over fetch; never let Next.js cache them.
export const fetchCache = "force-no-store";
export const revalidate = 0;

/*
 * Push tokens for the sandbox. Tokens are limited to the sandbox (test data only), tied to an active
 * member's email, capped per person, and every create and revoke is written to the project audit log.
 * With single sign-on on, the member is the signed-in account and any email in the request is ignored;
 * with it off, the server cannot verify who is calling and takes the email the client sends.
 */

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
const NOT_MEMBER = "Only active Studio members can manage sandbox push tokens.";

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? b : null;
  } catch {
    return null;
  }
}

/** The member making the request: the signed-in account with SSO on, else the email the client sent. */
async function callerEmail(req: NextRequest, claimed: string): Promise<{ email: string } | { response: NextResponse }> {
  const auth = await authorize(req);
  if (!auth.ok) return { response: auth.response };
  return { email: auth.user ? auth.user.email.trim().toLowerCase() : claimed };
}

async function activeMember(email: string): Promise<boolean> {
  if (!EMAIL_RE.test(email)) return false;
  const user = await getUserByEmail(email);
  return user?.account_status === "active";
}

/** GET ?email= — that member's tokens (never the token itself). */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const caller = await callerEmail(req, (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase());
  if ("response" in caller) return caller.response;
  const email = caller.email;
  try {
    const denied = sandboxOnly(await getProject(params.slug));
    if (denied) return denied;
    if (!(await activeMember(email))) return fail(403, NOT_MEMBER);
    const tokens = await listTokens(params.slug, email);
    return json({
      ok: true,
      tokens: tokens.map((t) => ({
        id: t.id, prefix: t.prefix, label: t.label, createdAt: t.created_at, expiresAt: t.expires_at,
        revokedAt: t.revoked_at, lastUsedAt: t.last_used_at,
      })),
    });
  } catch (err) {
    console.error("[/api/v1/projects/:slug/tokens] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST { email, label?, days? } — creates a token and returns it once. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const body = await readBody(req);
  if (!body) return fail(400, "Body must be a JSON object.");
  const caller = await callerEmail(req, typeof body.email === "string" ? body.email.trim().toLowerCase() : "");
  if ("response" in caller) return caller.response;
  const email = caller.email;
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  const days = body.days == null ? 90 : Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > LIMITS.maxTokenDays) return fail(400, `days must be 1–${LIMITS.maxTokenDays}.`);
  try {
    const denied = sandboxOnly(await getProject(params.slug));
    if (denied) return denied;
    if (!(await activeMember(email))) return fail(403, NOT_MEMBER);
    const t = await createToken(params.slug, email, label, days);
    return json({ ok: true, id: t.id, token: t.token, prefix: t.prefix, expiresAt: t.expiresAt }, 201);
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/projects/:slug/tokens] POST", err);
    return fail(503, "Database unavailable.");
  }
}

/** DELETE { id, email } — revokes one of that member's tokens. */
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const body = await readBody(req);
  if (!body) return fail(400, "Body must be a JSON object.");
  const caller = await callerEmail(req, typeof body.email === "string" ? body.email.trim().toLowerCase() : "");
  if ("response" in caller) return caller.response;
  const email = caller.email;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || id.length > 30) return fail(400, "id is required.");
  try {
    const denied = sandboxOnly(await getProject(params.slug));
    if (denied) return denied;
    if (!(await activeMember(email))) return fail(403, NOT_MEMBER);
    const ok = await revokeToken(params.slug, id, email);
    if (ok) await audit(params.slug, email, "human", "revoke_token", id, null);
    return ok ? json({ ok: true }) : fail(404, "Token not found or already revoked.");
  } catch (err) {
    console.error("[/api/v1/projects/:slug/tokens] DELETE", err);
    return fail(503, "Database unavailable.");
  }
}

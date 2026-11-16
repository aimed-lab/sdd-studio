import { NextRequest } from "next/server";
import { fail, json, sandboxOnly, SLUG_RE } from "@/lib/projects-api";
import { getUserByEmail } from "@/lib/db";
import {
  LIMITS, audit, countActiveTokens, createToken, getProject, listTokens, revokeToken,
} from "@/lib/projects-db";

export const dynamic = "force-dynamic";

/*
 * Push tokens for the sandbox. Until single sign-on (#32) the server cannot verify who is calling,
 * so tokens are limited to the sandbox (test data only), are tied to an active member's email,
 * capped per person, and every create and revoke is written to the project audit log.
 */

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
const NOT_MEMBER = "Only active Studio members can manage sandbox push tokens.";

async function activeMember(email: string): Promise<boolean> {
  if (!EMAIL_RE.test(email)) return false;
  const user = await getUserByEmail(email);
  return user?.account_status === "active";
}

/** GET ?email= — that member's tokens (never the token itself). */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  const days = body.days == null ? 90 : Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > LIMITS.maxTokenDays) return fail(400, `days must be 1–${LIMITS.maxTokenDays}.`);
  try {
    const denied = sandboxOnly(await getProject(params.slug));
    if (denied) return denied;
    if (!(await activeMember(email))) return fail(403, NOT_MEMBER);
    if ((await countActiveTokens(params.slug, email)) >= LIMITS.maxTokensPerPerson) {
      return fail(409, `You already have ${LIMITS.maxTokensPerPerson} active tokens. Revoke one first.`);
    }
    const t = await createToken(params.slug, email, label, days);
    await audit(params.slug, email, "human", "create_token", t.prefix, { label, days });
    return json({ ok: true, id: t.id, token: t.token, prefix: t.prefix, expiresAt: t.expiresAt }, 201);
  } catch (err) {
    console.error("[/api/v1/projects/:slug/tokens] POST", err);
    return fail(503, "Database unavailable.");
  }
}

/** DELETE { id, email } — revokes one of that member's tokens. */
export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG_RE.test(params.slug)) return fail(404, "Project not found.");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
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

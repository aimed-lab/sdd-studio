import { NextRequest } from "next/server";
import { jobActor } from "@/lib/jobs-api";
import { JOB_LIMITS, createRunner, listRunners, revokeRunner } from "@/lib/jobs-db";
import { fail, json } from "@/lib/projects-api";
import { LimitError, audit } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/*
 * Runner tokens for the developer sandbox, managed by a signed-in Owner or Admin.
 *
 * A runner token lets a machine on the SPARC side claim jobs and report on them. Tokens minted here
 * are limited to the sandbox, where every job is a labelled dry run; a token that may claim a
 * campaign's jobs is issued by the platform owner with the admin key
 * (/api/v1/admin/jobs/runners). Only the hash of a token is stored, and it is shown once.
 */

const SANDBOX = ["sandbox"];

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? b : null;
  } catch {
    return null;
  }
}

/** GET — the sandbox's runner tokens (prefix, label, dates; never the token). */
export async function GET(req: NextRequest) {
  const caller = await jobActor(req, "Admin", req.nextUrl.searchParams.get("email"));
  if ("response" in caller) return caller.response;
  try {
    const runners = await listRunners(SANDBOX);
    return json({
      ok: true,
      runners: runners.map((r) => ({
        id: r.id, prefix: r.prefix, label: r.label, projects: r.projects, createdBy: r.created_by,
        createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, lastSeenAt: r.last_seen_at,
      })),
    });
  } catch (err) {
    console.error("[/api/v1/jobs/runners] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST { label?, days? } — mints a sandbox runner token and returns it once. */
export async function POST(req: NextRequest) {
  const b = (await body(req)) ?? {};
  const caller = await jobActor(req, "Admin", typeof b.email === "string" ? b.email : null);
  if ("response" in caller) return caller.response;
  const label = typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 60) : null;
  const days = b.days == null ? 30 : Number(b.days);
  if (!Number.isInteger(days) || days < 1 || days > JOB_LIMITS.maxRunnerDays) {
    return fail(400, `days must be 1–${JOB_LIMITS.maxRunnerDays}.`);
  }
  const email = caller.actor.email;
  try {
    const r = await createRunner({ createdBy: email, label, projects: SANDBOX, days });
    await audit("sandbox", email, "human", "create_runner_token", r.prefix, { label, days, projects: SANDBOX });
    return json({ ok: true, id: r.id, token: r.token, prefix: r.prefix, projects: r.projects, expiresAt: r.expiresAt }, 201);
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/jobs/runners] POST", err);
    return fail(503, "Database unavailable.");
  }
}

/** DELETE { id } — revokes a sandbox runner token. */
export async function DELETE(req: NextRequest) {
  const b = await body(req);
  const caller = await jobActor(req, "Admin", typeof b?.email === "string" ? b.email : null);
  if ("response" in caller) return caller.response;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id || id.length > 30) return fail(400, "id is required.");
  try {
    const revoked = await revokeRunner(id, SANDBOX);
    if (!revoked) return fail(404, "Runner token not found or already revoked.");
    await audit("sandbox", caller.actor.email, "human", "revoke_runner_token", revoked.prefix, null);
    return json({ ok: true });
  } catch (err) {
    console.error("[/api/v1/jobs/runners] DELETE", err);
    return fail(503, "Database unavailable.");
  }
}

import { NextRequest } from "next/server";
import { requireAdminToken } from "@/lib/admin-guard";
import { JOB_LIMITS, createRunner, listRunners, revokeRunner } from "@/lib/jobs-db";
import { fail, json, SLUG_RE } from "@/lib/projects-api";
import { LimitError, audit, getProject } from "@/lib/projects-db";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/*
 * Runner tokens for any project, managed by the platform owner with the admin key (X-Admin-Token),
 * because a runner on a lab machine cannot hold a browser session. A token may claim jobs only for
 * the projects listed when it was minted.
 */

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return typeof b === "object" && b !== null && !Array.isArray(b) ? b : null;
  } catch {
    return null;
  }
}

/** GET [?project=slug] — runner tokens, for one project or all of them. */
export async function GET(req: NextRequest) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const project = req.nextUrl.searchParams.get("project");
  if (project && !SLUG_RE.test(project)) return fail(400, "project must be a project slug.");
  try {
    const runners = await listRunners(project ? [project] : null);
    return json({
      ok: true,
      runners: runners.map((r) => ({
        id: r.id, prefix: r.prefix, label: r.label, projects: r.projects, createdBy: r.created_by,
        createdAt: r.created_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, lastSeenAt: r.last_seen_at,
      })),
    });
  } catch (err) {
    console.error("[/api/v1/admin/jobs/runners] GET", err);
    return fail(503, "Database unavailable.");
  }
}

/** POST { projects: ["slug", …], label?, days? } — mints a runner token and returns it once. */
export async function POST(req: NextRequest) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const b = await body(req);
  if (!b) return fail(400, "Body must be a JSON object.");
  const raw = Array.isArray(b.projects) ? b.projects : typeof b.project === "string" ? [b.project] : null;
  if (!raw || raw.length === 0 || raw.length > 20) return fail(400, "projects: 1–20 project slugs.");
  const projects: string[] = [];
  for (const p of raw) {
    if (typeof p !== "string" || !SLUG_RE.test(p)) return fail(400, `projects: "${String(p).slice(0, 20)}" is not a project slug.`);
    if (!projects.includes(p)) projects.push(p);
  }
  const label = typeof b.label === "string" && b.label.trim() ? b.label.trim().slice(0, 60) : null;
  const days = b.days == null ? 90 : Number(b.days);
  if (!Number.isInteger(days) || days < 1 || days > JOB_LIMITS.maxRunnerDays) {
    return fail(400, `days must be 1–${JOB_LIMITS.maxRunnerDays}.`);
  }
  try {
    for (const p of projects) if (!(await getProject(p))) return fail(404, `Project not found: ${p}`);
    const r = await createRunner({ createdBy: "admin", label, projects, days });
    for (const p of projects) await audit(p, "admin", "admin", "create_runner_token", r.prefix, { label, days, projects });
    return json({ ok: true, id: r.id, token: r.token, prefix: r.prefix, projects: r.projects, expiresAt: r.expiresAt }, 201);
  } catch (err) {
    if (err instanceof LimitError) return fail(err.status, err.message);
    console.error("[/api/v1/admin/jobs/runners] POST", err);
    return fail(503, "Database unavailable.");
  }
}

/** DELETE { id } — revokes any runner token. */
export async function DELETE(req: NextRequest) {
  const denied = requireAdminToken(req);
  if (denied) return denied;
  const b = await body(req);
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id || id.length > 30) return fail(400, "id is required.");
  try {
    const revoked = await revokeRunner(id, null);
    if (!revoked) return fail(404, "Runner token not found or already revoked.");
    for (const p of revoked.projects) await audit(p, "admin", "admin", "revoke_runner_token", revoked.prefix, null);
    return json({ ok: true });
  } catch (err) {
    console.error("[/api/v1/admin/jobs/runners] DELETE", err);
    return fail(503, "Database unavailable.");
  }
}

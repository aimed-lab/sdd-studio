/**
 * Validation and authentication for the compute-job API (docs/sparc-jobs-plan.md).
 *
 * Two kinds of caller:
 *   a person  — a signed-in account, checked against the database on every request;
 *   a runner  — a machine on the SPARC side holding a runner token (sdd_rt_…), which may only
 *               claim, update and complete jobs for the projects its token lists.
 *
 * Middleware does not gate /api/*, so each route calls these helpers itself.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getUserByEmail, type DBUser } from "@/lib/db";
import { JOB_KINDS, JOB_LIMITS, type JobKind, type JobRow, type RunnerRow, verifyRunner } from "@/lib/jobs-db";
import { bearer, fail } from "@/lib/projects-api";
import { type AppRole, hasRole, roleRank } from "@/lib/roles";
import { authorize, rankOf } from "@/lib/session";
import { ssoEnabled } from "@/lib/sso/config";

/** Roles that may approve a job, requeue a stale one, and see every project's jobs. */
export const JOB_ADMIN_ROLES: AppRole[] = ["Owner", "Admin"];

/** Job ids as the API mints them (jobs-db.createJob). */
export const JOB_ID_RE = /^job_[A-Za-z0-9_-]{6,24}$/;

export const isJobAdmin = (role: string | null | undefined) =>
  (JOB_ADMIN_ROLES as readonly string[]).includes(role ?? "");

// ── Who is calling ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

/** The person asking, and whether the server could verify that it is them. */
export interface JobActor {
  email: string;
  role: string;
  /** True when a signed-in session proved who this is. False on a deployment without single sign-on. */
  verified: boolean;
}

/**
 * The person making the request, at or above `minRole`.
 *
 * With single sign-on on (production), that is the signed-in account, checked against the database
 * on every request. With it off (preview deployments and local development) the server cannot verify
 * a session, so — exactly as the sandbox push-token routes already do — it takes the email the client
 * sends and checks that account's status and role in the database. An unverified caller may only
 * work with the sandbox, where every job is a dry run; the campaign routes refuse them.
 */
export async function jobActor(
  req: NextRequest,
  minRole: AppRole = "Developer",
  claimedEmail?: string | null,
): Promise<{ actor: JobActor } | { response: NextResponse }> {
  if (ssoEnabled()) {
    const auth = await authorize(req, minRole);
    if (!auth.ok) return { response: auth.response };
    if (!auth.user) return { response: fail(401, "Sign in required") };
    return { actor: { email: auth.user.email.trim().toLowerCase(), role: auth.user.role, verified: true } };
  }
  const email = (claimedEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { response: fail(401, "Studio sign-in is not configured on this deployment, so the request must name an active member's email.") };
  }
  let user: DBUser | null;
  try {
    user = await getUserByEmail(email);
  } catch (err) {
    console.error("[jobActor] user lookup failed:", err);
    return { response: fail(503, "Account service unavailable. Please try again.") };
  }
  if (!user || user.account_status !== "active") return { response: fail(403, "Only active Studio members can work with compute jobs.") };
  if (rankOf(user.role) > roleRank(minRole)) return { response: fail(403, "You do not have permission for this action") };
  return { actor: { email: user.email.trim().toLowerCase(), role: user.role, verified: false } };
}

/** The runner token on the request (`Authorization: Bearer sdd_rt_…`), or a refusal. */
export async function jobRunner(req: NextRequest): Promise<{ runner: RunnerRow } | { response: NextResponse }> {
  const token = bearer(req.headers.get("authorization")) ?? req.headers.get("x-sdd-runner-token");
  if (!token) return { response: fail(401, "Runner token required: Authorization: Bearer sdd_rt_…") };
  const runner = await verifyRunner(token);
  if (!runner) return { response: fail(401, "Runner token is unknown, revoked or expired.") };
  return { runner };
}

/** A person may see a job if they requested it, or if they can see every project's jobs. */
export const canSeeJob = (actor: JobActor, job: JobRow) =>
  isJobAdmin(actor.role) || job.requested_by === actor.email;

// ── Request validation ──────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const TITLE_RE = /^[A-Za-z0-9][A-Za-z0-9._ ()+-]{0,79}$/;
const TABLE_RE = /^[a-z][a-z0-9_]{0,39}$/;
const PDB_RE = /^[0-9][A-Za-z0-9]{3}$/;
const CLUSTER_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
// SMILES as typed: printable ASCII without spaces or quotes.
const SMILES_RE = /^[A-Za-z0-9@+\-[\]()\\/=#$:.%*]{1,300}$/;
const PLAIN = /^[^\u0000-\u001F\u007F‪-‮⁦-⁩]*$/;

export const MAX_PASTED_SMILES = 500;
export const MAX_LIGANDS = 5_000;
export const MAX_GENERATED = 1_000;

export const DESIGN_OBJECTIVES = [
  "potency",
  "selectivity",
  "qed",
  "synthetic-accessibility",
  "molecular-weight-window",
  "logp-window",
  "novelty",
] as const;

const relPath = (p: unknown): p is string =>
  typeof p === "string" && p.length > 0 && p.length <= 300 && PLAIN.test(p) &&
  !p.startsWith("/") && !p.includes("\\") && !p.split("/").some((s) => s === "" || s === "." || s === "..");

type Err = { error: string };
const isErr = <T>(v: T | Err): v is Err => typeof v === "object" && v !== null && "error" in (v as object);

function parseSmilesList(raw: unknown, where: string, max: number): string[] | Err {
  const list = typeof raw === "string" ? raw.split(/[\n,\s]+/) : Array.isArray(raw) ? raw : null;
  if (!list) return { error: `${where}: a list of SMILES is required.` };
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") return { error: `${where}: every entry must be text.` };
    const s = item.trim();
    if (!s) continue;
    if (!SMILES_RE.test(s)) return { error: `${where}: "${s.slice(0, 20)}…" does not look like a SMILES string.` };
    out.push(s);
    if (out.length > max) return { error: `${where}: at most ${max} structures. Put a larger set in a campaign table instead.` };
  }
  if (!out.length) return { error: `${where}: no structures given.` };
  return out;
}

type MoleculeSet =
  | { source: "smiles"; smiles: string[] }
  | { source: "campaign-table"; table: string; column: string; limit: number };

function parseMoleculeSet(raw: unknown, where: string, maxPasted: number, maxRows: number): MoleculeSet | Err {
  if (!isObj(raw)) return { error: `${where} is required.` };
  if (raw.source === "smiles") {
    const smiles = parseSmilesList(raw.smiles, `${where}.smiles`, maxPasted);
    if (isErr(smiles)) return smiles;
    return { source: "smiles", smiles };
  }
  if (raw.source === "campaign-table") {
    if (typeof raw.table !== "string" || !TABLE_RE.test(raw.table)) {
      return { error: `${where}.table must be the name of a table in this project (lowercase letters, digits and underscores).` };
    }
    if (typeof raw.column !== "string" || !raw.column.trim() || raw.column.length > 60 || !PLAIN.test(raw.column)) {
      return { error: `${where}.column must be the name of the column holding the structures.` };
    }
    const limit = raw.limit == null ? maxRows : Number(raw.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > maxRows) {
      return { error: `${where}.limit must be a whole number from 1 to ${maxRows}.` };
    }
    return { source: "campaign-table", table: raw.table, column: raw.column.trim(), limit };
  }
  return { error: `${where}.source must be "smiles" or "campaign-table".` };
}

function parseDocking(raw: unknown): Record<string, unknown> | Err {
  if (!isObj(raw)) return { error: "params is required." };

  // Receptor: a PDB entry to fetch, or a structure file already in the project.
  const r = raw.receptor;
  if (!isObj(r)) return { error: "params.receptor is required." };
  let receptor: Record<string, unknown>;
  if (r.source === "pdb") {
    if (typeof r.pdbId !== "string" || !PDB_RE.test(r.pdbId.trim())) {
      return { error: "params.receptor.pdbId must be a four-character PDB entry ID, for example 2PA3." };
    }
    const chain = r.chain == null || r.chain === "" ? null : r.chain;
    if (chain !== null && (typeof chain !== "string" || !/^[A-Za-z0-9]{1,4}$/.test(chain))) {
      return { error: "params.receptor.chain must be a chain identifier such as A." };
    }
    receptor = { source: "pdb", pdbId: r.pdbId.trim().toUpperCase(), chain };
  } else if (r.source === "campaign-file") {
    if (!relPath(r.path)) return { error: "params.receptor.path must be a file path inside the project." };
    receptor = { source: "campaign-file", path: r.path };
  } else {
    return { error: 'params.receptor.source must be "pdb" or "campaign-file".' };
  }

  const ligands = parseMoleculeSet(raw.ligands, "params.ligands", MAX_PASTED_SMILES, MAX_LIGANDS);
  if (isErr(ligands)) return ligands;

  // Binding site: an explicit box, or the ligand of a co-crystal structure to centre on.
  const s = raw.site;
  if (!isObj(s)) return { error: "params.site is required." };
  let site: Record<string, unknown>;
  if (s.mode === "box") {
    const coord = (v: unknown, name: string): number | Err => {
      const n = Number(v);
      if (!Number.isFinite(n) || Math.abs(n) > 1_000) return { error: `params.site.${name} must be a number in ångström (at most ±1000).` };
      return n;
    };
    const size = (v: unknown, name: string): number | Err => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0 || n > 100) return { error: `params.site.${name} must be a box edge in ångström, from 1 to 100.` };
      return n;
    };
    const center = isObj(s.center) ? s.center : {};
    const box = isObj(s.size) ? s.size : {};
    const cx = coord(center.x, "center.x"), cy = coord(center.y, "center.y"), cz = coord(center.z, "center.z");
    const sx = size(box.x, "size.x"), sy = size(box.y, "size.y"), sz = size(box.z, "size.z");
    for (const v of [cx, cy, cz, sx, sy, sz]) if (isErr(v)) return v;
    site = { mode: "box", center: { x: cx, y: cy, z: cz }, size: { x: sx, y: sy, z: sz } };
  } else if (s.mode === "reference-ligand") {
    if (typeof s.ligand !== "string" || !/^[A-Za-z0-9 _.:-]{1,40}$/.test(s.ligand.trim())) {
      return { error: "params.site.ligand must name the co-crystal ligand to centre the box on (its residue or chemical component ID)." };
    }
    const pad = s.padding == null ? 8 : Number(s.padding);
    if (!Number.isFinite(pad) || pad < 0 || pad > 30) return { error: "params.site.padding must be 0–30 ångström." };
    site = { mode: "reference-ligand", ligand: s.ligand.trim(), padding: pad };
  } else {
    return { error: 'params.site.mode must be "box" or "reference-ligand".' };
  }

  const exhaustiveness = raw.exhaustiveness == null ? 8 : Number(raw.exhaustiveness);
  if (!Number.isInteger(exhaustiveness) || exhaustiveness < 1 || exhaustiveness > 64) {
    return { error: "params.exhaustiveness must be a whole number from 1 to 64." };
  }
  const poses = raw.posesPerLigand == null ? 5 : Number(raw.posesPerLigand);
  if (!Number.isInteger(poses) || poses < 1 || poses > 50) {
    return { error: "params.posesPerLigand must be a whole number from 1 to 50." };
  }
  // The engine is the runner's to choose (docs/sparc-jobs-plan.md §9); a requester may name one.
  const engine = raw.engine == null || raw.engine === "" ? null : raw.engine;
  if (engine !== null && (typeof engine !== "string" || engine.length > 60 || !PLAIN.test(engine))) {
    return { error: "params.engine, if given, is at most 60 characters." };
  }

  return { receptor, ligands, site, exhaustiveness, posesPerLigand: poses, engine };
}

function parseGenerative(raw: unknown): Record<string, unknown> | Err {
  if (!isObj(raw)) return { error: "params is required." };

  const seeds = parseMoleculeSet(raw.seeds, "params.seeds", MAX_PASTED_SMILES, MAX_LIGANDS);
  if (isErr(seeds)) return seeds;

  if (!Array.isArray(raw.objectives) || raw.objectives.length === 0) {
    return { error: "params.objectives: choose at least one objective." };
  }
  const objectives: string[] = [];
  for (const o of raw.objectives) {
    if (typeof o !== "string" || !(DESIGN_OBJECTIVES as readonly string[]).includes(o)) {
      return { error: `params.objectives: unknown objective. Choose from ${DESIGN_OBJECTIVES.join(", ")}.` };
    }
    if (!objectives.includes(o)) objectives.push(o);
  }

  const count = raw.count == null ? 100 : Number(raw.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATED) {
    return { error: `params.count must be a whole number from 1 to ${MAX_GENERATED}.` };
  }

  const target = raw.target == null || raw.target === "" ? null : raw.target;
  if (target !== null && (typeof target !== "string" || !/^[A-Za-z0-9 _.:-]{1,60}$/.test(target))) {
    return { error: "params.target, if given, is a gene symbol or target name (at most 60 characters)." };
  }
  if (objectives.includes("potency") && !target) {
    return { error: 'params.target is required when "potency" is one of the objectives: say which target.' };
  }

  const keepScaffold = raw.keepScaffold === true;
  const notes = raw.notes == null || raw.notes === "" ? null : raw.notes;
  if (notes !== null && (typeof notes !== "string" || notes.length > 500 || !PLAIN.test(notes.replace(/\n/g, " ")))) {
    return { error: "params.notes: at most 500 characters of plain text." };
  }
  // The generator is an open question (docs/sparc-jobs-plan.md §9); a requester may name one.
  const generator = raw.generator == null || raw.generator === "" ? null : raw.generator;
  if (generator !== null && (typeof generator !== "string" || generator.length > 60 || !PLAIN.test(generator))) {
    return { error: "params.generator, if given, is at most 60 characters." };
  }

  return { seeds, objectives, count, target, keepScaffold, notes, generator };
}

export interface ParsedJobRequest {
  kind: JobKind;
  title: string;
  params: Record<string, unknown>;
  estGpuHours: number;
  clusterPreference: string | null;
  noPhi: true;
}

/** Validates a job request body. The project and the requester's role are checked by the route. */
export function parseJobRequest(body: unknown): ParsedJobRequest | Err {
  if (!isObj(body)) return { error: "Body must be a JSON object." };

  const kind = body.kind;
  if (typeof kind !== "string" || !(JOB_KINDS as readonly string[]).includes(kind)) {
    return { error: `kind must be one of ${JOB_KINDS.join(", ")}.` };
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!TITLE_RE.test(title)) {
    return { error: "title: 1–80 characters, letters, digits, spaces, dot, dash, underscore, plus or brackets." };
  }
  // The assertion is the requester's, is stored on the job, and is required: docs/sparc-jobs-plan.md §6.
  if (body.noPhi !== true) {
    return { error: "noPhi must be true: compute jobs take no protected health information and no human-subject data." };
  }
  const estGpuHours = body.estGpuHours == null ? 1 : Number(body.estGpuHours);
  if (!Number.isFinite(estGpuHours) || estGpuHours <= 0 || estGpuHours > JOB_LIMITS.maxGpuHoursPerJob) {
    return { error: `estGpuHours must be a number from 0.1 to ${JOB_LIMITS.maxGpuHoursPerJob}.` };
  }
  const cluster = body.cluster == null || body.cluster === "" ? null : body.cluster;
  if (cluster !== null && (typeof cluster !== "string" || !CLUSTER_RE.test(cluster))) {
    return { error: "cluster, if given, is a cluster name as the runner reports it (lowercase letters, digits and dashes)." };
  }

  const params = kind === "docking" ? parseDocking(body.params) : parseGenerative(body.params);
  if (isErr(params)) return params;

  return {
    kind: kind as JobKind,
    title,
    params,
    estGpuHours: Math.round(estGpuHours * 100) / 100,
    clusterPreference: cluster,
    noPhi: true,
  };
}

// ── Shapes sent to the browser and to runners ───────────────────────────────

/** A job as the job pages and the runner see it. The requester's email goes only to those who may see it. */
export function jobView(job: JobRow, opts: { withRequester: boolean }) {
  return {
    id: job.id,
    project: job.project_slug,
    kind: job.kind,
    title: job.title,
    status: job.status,
    params: job.params,
    estGpuHours: Number(job.est_gpu_hours),
    clusterPreference: job.cluster_preference,
    cluster: job.cluster,
    externalId: job.external_id,
    resultIteration: job.result_iteration,
    error: job.error,
    dryRun: job.dry_run,
    noPhi: job.no_phi,
    createdAt: job.created_at,
    decidedAt: job.decided_at,
    claimedAt: job.claimed_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    updatedAt: job.updated_at,
    ...(opts.withRequester ? { requestedBy: job.requested_by, requestedRole: job.requested_role } : {}),
  };
}

export { hasRole };

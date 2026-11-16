/**
 * Projects data layer (Stage 2–3 of docs/redesign-plan.md, sandbox first).
 *
 * File bytes are NOT stored here: Box is the primary storage. Studio keeps the file index
 * (path, checksum, size, kind, sensitivity, release state), the summary tables a push
 * declares, push tokens (hashed) and an append-only audit log.
 *
 * Until single sign-on (#32) is on, only projects of kind "sandbox" accept writes or open
 * reads; the sandbox accepts test data only.
 */

import { createHash, randomBytes } from "node:crypto";
import { sql } from "@vercel/postgres";
import "@/lib/db"; // sets POSTGRES_URL from whichever variable Vercel provided

export type ProjectKind = "sandbox" | "campaign";

export interface ProjectRow {
  slug: string;
  title: string;
  description: string | null;
  kind: ProjectKind;
  created_at: string;
}

export interface IterationRow {
  n: number;
  label: string;
  source: string;
  actor_type: string;
  actor: string;
  git_sha: string | null;
  summary: string | null;
  files: number;
  new_files: number;
  status: string;
  created_at: string;
}

export interface ArtifactRow {
  iteration_n: number;
  path: string;
  kind: string;
  sha256: string;
  size: string; // BIGINT comes back as text
  sensitivity: string;
  release_state: string;
  actor_type: string;
}

export interface TokenRow {
  id: string;
  project_slug: string;
  prefix: string;
  label: string | null;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

// Sandbox limits. A push is one request, so it must also stay under Vercel's 4.5 MB body limit.
export const LIMITS = {
  maxBodyBytes: 4_000_000,
  maxFiles: 2_000,
  maxTables: 10,
  maxRowsPerTable: 5_000,
  maxColumns: 100,
  maxCellChars: 2_000,
  keepIterations: 50, // sandbox keeps the latest 50 iterations; older ones are pruned
  maxTokensPerPerson: 5,
  maxTokenDays: 365,
} as const;

let migrated = false;

export async function ensureProjectsSchema(): Promise<void> {
  if (migrated) return;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      slug        TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      kind        TEXT NOT NULL DEFAULT 'campaign',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_tokens (
      id           TEXT PRIMARY KEY,
      project_slug TEXT NOT NULL REFERENCES projects(slug),
      token_hash   TEXT NOT NULL UNIQUE,
      prefix       TEXT NOT NULL,
      label        TEXT,
      created_by   TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL,
      revoked_at   TIMESTAMPTZ,
      last_used_at TIMESTAMPTZ
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_iterations (
      project_slug    TEXT NOT NULL REFERENCES projects(slug),
      n               INTEGER NOT NULL,
      label           TEXT NOT NULL,
      manifest_sha256 TEXT NOT NULL,
      source          TEXT NOT NULL,
      actor_type      TEXT NOT NULL,
      actor           TEXT NOT NULL,
      git_sha         TEXT,
      summary         TEXT,
      files           INTEGER NOT NULL DEFAULT 0,
      new_files       INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'committed',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_slug, n),
      UNIQUE (project_slug, manifest_sha256)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_artifacts (
      project_slug  TEXT NOT NULL,
      iteration_n   INTEGER NOT NULL,
      path          TEXT NOT NULL,
      kind          TEXT NOT NULL,
      sha256        TEXT NOT NULL,
      size          BIGINT NOT NULL,
      sensitivity   TEXT NOT NULL,
      release_state TEXT NOT NULL DEFAULT 'draft',
      actor_type    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (project_slug, iteration_n, path)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS project_artifacts_sha ON project_artifacts (project_slug, sha256)`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_records (
      project_slug TEXT NOT NULL,
      iteration_n  INTEGER NOT NULL,
      table_name   TEXT NOT NULL,
      row_index    INTEGER NOT NULL,
      data         JSONB NOT NULL,
      PRIMARY KEY (project_slug, iteration_n, table_name, row_index)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_audit (
      id           BIGSERIAL PRIMARY KEY,
      at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      project_slug TEXT NOT NULL,
      actor        TEXT NOT NULL,
      actor_type   TEXT NOT NULL,
      action       TEXT NOT NULL,
      target       TEXT,
      detail       JSONB
    )`;
  await sql`
    INSERT INTO projects (slug, title, description, kind)
    VALUES ('sandbox', 'Developer sandbox',
            'Test data only. Developers and their agents push iterations here to try the workflow before real campaigns move in.',
            'sandbox')
    ON CONFLICT (slug) DO NOTHING`;
  migrated = true;
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function listProjects() {
  await ensureProjectsSchema();
  const { rows } = await sql<ProjectRow & { iterations: number; latest_at: string | null }>`
    SELECT p.slug, p.title, p.description, p.kind, p.created_at,
           COUNT(i.n)::int AS iterations, MAX(i.created_at) AS latest_at
    FROM projects p LEFT JOIN project_iterations i ON i.project_slug = p.slug
    GROUP BY p.slug ORDER BY p.created_at`;
  return rows;
}

export async function getProject(slug: string): Promise<ProjectRow | null> {
  await ensureProjectsSchema();
  const { rows } = await sql<ProjectRow>`SELECT slug, title, description, kind, created_at FROM projects WHERE slug = ${slug}`;
  return rows[0] ?? null;
}

// ── Tokens ──────────────────────────────────────────────────────────────────

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(slug: string, createdBy: string, label: string | null, days: number) {
  await ensureProjectsSchema();
  const token = "sdd_pt_" + randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url");
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  await sql`
    INSERT INTO project_tokens (id, project_slug, token_hash, prefix, label, created_by, expires_at)
    VALUES (${id}, ${slug}, ${hashToken(token)}, ${token.slice(0, 11)}, ${label}, ${createdBy.toLowerCase()}, ${expires})`;
  return { id, token, prefix: token.slice(0, 11), expiresAt: expires };
}

export async function countActiveTokens(slug: string, email: string): Promise<number> {
  const { rows } = await sql`
    SELECT COUNT(*)::int AS c FROM project_tokens
    WHERE project_slug = ${slug} AND created_by = ${email.toLowerCase()} AND revoked_at IS NULL AND expires_at > NOW()`;
  return Number(rows[0]?.c ?? 0);
}

export async function listTokens(slug: string, email: string): Promise<TokenRow[]> {
  await ensureProjectsSchema();
  const { rows } = await sql<TokenRow>`
    SELECT id, project_slug, prefix, label, created_by, created_at, expires_at, revoked_at, last_used_at
    FROM project_tokens WHERE project_slug = ${slug} AND created_by = ${email.toLowerCase()}
    ORDER BY created_at DESC LIMIT 50`;
  return rows;
}

export async function revokeToken(slug: string, id: string, email: string): Promise<boolean> {
  await ensureProjectsSchema();
  const { rowCount } = await sql`
    UPDATE project_tokens SET revoked_at = NOW()
    WHERE id = ${id} AND project_slug = ${slug} AND created_by = ${email.toLowerCase()} AND revoked_at IS NULL`;
  return (rowCount ?? 0) > 0;
}

/** Resolves a bearer token to its row, or null if unknown, revoked, expired or for another project. */
export async function verifyToken(slug: string, token: string): Promise<TokenRow | null> {
  await ensureProjectsSchema();
  if (!token.startsWith("sdd_pt_") || token.length > 100) return null;
  const { rows } = await sql<TokenRow>`
    UPDATE project_tokens SET last_used_at = NOW()
    WHERE token_hash = ${hashToken(token)} AND project_slug = ${slug} AND revoked_at IS NULL AND expires_at > NOW()
    RETURNING id, project_slug, prefix, label, created_by, created_at, expires_at, revoked_at, last_used_at`;
  return rows[0] ?? null;
}

// ── Iterations ──────────────────────────────────────────────────────────────

export interface ManifestFile {
  path: string;
  sha256: string;
  size: number;
  kind: string;
  sensitivity: string;
}

export interface PushTable {
  name: string;
  file: string | null;
  rows: Record<string, string | number | boolean | null>[];
}

export async function findIterationByManifest(slug: string, manifestSha: string): Promise<IterationRow | null> {
  const { rows } = await sql<IterationRow>`
    SELECT n, label, source, actor_type, actor, git_sha, summary, files, new_files, status, created_at
    FROM project_iterations WHERE project_slug = ${slug} AND manifest_sha256 = ${manifestSha}`;
  return rows[0] ?? null;
}

export async function commitIteration(args: {
  slug: string;
  label: string;
  manifestSha: string;
  source: string;
  actor: string;
  actorType: "token" | "agent";
  gitSha: string | null;
  summary: string | null;
  files: ManifestFile[];
  tables: PushTable[];
}): Promise<{ iteration: IterationRow; newFiles: number }> {
  await ensureProjectsSchema();
  const { slug } = args;

  // Files whose checksum the project has not seen before.
  const shas = JSON.stringify(Array.from(new Set(args.files.map((f) => f.sha256))));
  const { rows: seen } = await sql<{ sha256: string }>`
    SELECT DISTINCT sha256 FROM project_artifacts
    WHERE project_slug = ${slug} AND sha256 IN (SELECT jsonb_array_elements_text(${shas}::jsonb))`;
  const seenSet = new Set(seen.map((r) => r.sha256));
  const newFiles = args.files.filter((f) => !seenSet.has(f.sha256)).length;

  // Next iteration number; the primary key rejects a concurrent duplicate, so retry once.
  let iteration: IterationRow | undefined;
  for (let attempt = 0; attempt < 2 && !iteration; attempt++) {
    try {
      const { rows } = await sql<IterationRow>`
        INSERT INTO project_iterations
          (project_slug, n, label, manifest_sha256, source, actor_type, actor, git_sha, summary, files, new_files)
        SELECT ${slug}, COALESCE(MAX(n), 0) + 1, ${args.label}, ${args.manifestSha}, ${args.source}, ${args.actorType},
               ${args.actor}, ${args.gitSha}, ${args.summary}, ${args.files.length}, ${newFiles}
        FROM project_iterations WHERE project_slug = ${slug}
        RETURNING n, label, source, actor_type, actor, git_sha, summary, files, new_files, status, created_at`;
      iteration = rows[0];
    } catch (err) {
      const again = await findIterationByManifest(slug, args.manifestSha);
      if (again) return { iteration: again, newFiles: again.new_files };
      if (attempt === 1) throw err;
    }
  }
  const n = iteration!.n;

  // Earlier versions of the same paths are superseded when their content changed.
  const filesJson = JSON.stringify(args.files);
  await sql`
    UPDATE project_artifacts a SET release_state = 'superseded'
    FROM jsonb_to_recordset(${filesJson}::jsonb) AS f(path TEXT, sha256 TEXT)
    WHERE a.project_slug = ${slug} AND a.path = f.path AND a.sha256 <> f.sha256
      AND a.release_state IN ('draft', 'internal')`;
  await sql`
    INSERT INTO project_artifacts (project_slug, iteration_n, path, kind, sha256, size, sensitivity, actor_type)
    SELECT ${slug}, ${n}, f.path, f.kind, f.sha256, f.size, f.sensitivity, ${args.actorType}
    FROM jsonb_to_recordset(${filesJson}::jsonb) AS f(path TEXT, kind TEXT, sha256 TEXT, size BIGINT, sensitivity TEXT)`;

  for (const t of args.tables) {
    await sql`
      INSERT INTO project_records (project_slug, iteration_n, table_name, row_index, data)
      SELECT ${slug}, ${n}, ${t.name}, (ord - 1)::int, value
      FROM jsonb_array_elements(${JSON.stringify(t.rows)}::jsonb) WITH ORDINALITY AS r(value, ord)`;
  }

  await audit(slug, args.actor, args.actorType, "push_iteration", `iteration ${n}`, {
    label: args.label,
    files: args.files.length,
    newFiles,
    tables: args.tables.map((t) => ({ name: t.name, rows: t.rows.length })),
  });
  return { iteration: iteration!, newFiles };
}

/** Sandbox only: keep the latest iterations and drop older ones with their files and tables. */
export async function pruneSandbox(slug: string, keep: number): Promise<void> {
  const { rows } = await sql<{ n: number }>`
    SELECT n FROM project_iterations WHERE project_slug = ${slug} ORDER BY n DESC OFFSET ${keep} LIMIT 1`;
  const cutoff = rows[0]?.n;
  if (cutoff == null) return;
  await sql`DELETE FROM project_records WHERE project_slug = ${slug} AND iteration_n <= ${cutoff}`;
  await sql`DELETE FROM project_artifacts WHERE project_slug = ${slug} AND iteration_n <= ${cutoff}`;
  await sql`DELETE FROM project_iterations WHERE project_slug = ${slug} AND n <= ${cutoff}`;
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function listIterations(slug: string, limit = 50): Promise<IterationRow[]> {
  await ensureProjectsSchema();
  const { rows } = await sql<IterationRow>`
    SELECT n, label, source, actor_type, actor, git_sha, summary, files, new_files, status, created_at
    FROM project_iterations WHERE project_slug = ${slug} ORDER BY n DESC LIMIT ${limit}`;
  return rows;
}

export async function listArtifacts(slug: string, limit = 500): Promise<ArtifactRow[]> {
  await ensureProjectsSchema();
  const { rows } = await sql<ArtifactRow>`
    SELECT iteration_n, path, kind, sha256, size::text AS size, sensitivity, release_state, actor_type
    FROM project_artifacts WHERE project_slug = ${slug}
    ORDER BY iteration_n DESC, path LIMIT ${limit}`;
  return rows;
}

/** Each table's latest iteration and row count. */
export async function listTables(slug: string) {
  await ensureProjectsSchema();
  const { rows } = await sql<{ table_name: string; iteration_n: number; rows: number }>`
    SELECT DISTINCT ON (table_name) table_name, iteration_n, COUNT(*) OVER (PARTITION BY table_name, iteration_n)::int AS rows
    FROM project_records WHERE project_slug = ${slug}
    ORDER BY table_name, iteration_n DESC`;
  return rows;
}

export async function readRecords(slug: string, table: string, iteration: number | null, limit: number, offset: number) {
  await ensureProjectsSchema();
  let n = iteration;
  if (n == null) {
    const { rows } = await sql<{ n: number | null }>`
      SELECT MAX(iteration_n) AS n FROM project_records WHERE project_slug = ${slug} AND table_name = ${table}`;
    n = rows[0]?.n ?? null;
  }
  if (n == null) return { iteration: null, total: 0, rows: [] as unknown[] };
  const { rows: count } = await sql<{ c: number }>`
    SELECT COUNT(*)::int AS c FROM project_records WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n}`;
  const { rows } = await sql<{ data: unknown }>`
    SELECT data FROM project_records WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n}
    ORDER BY row_index LIMIT ${limit} OFFSET ${offset}`;
  return { iteration: n, total: Number(count[0]?.c ?? 0), rows: rows.map((r) => r.data) };
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function audit(slug: string, actor: string, actorType: string, action: string, target: string | null, detail: unknown) {
  await sql`
    INSERT INTO project_audit (project_slug, actor, actor_type, action, target, detail)
    VALUES (${slug}, ${actor}, ${actorType}, ${action}, ${target}, ${JSON.stringify(detail ?? null)}::jsonb)`;
}

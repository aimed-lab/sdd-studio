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
import { db, sql, type VercelPoolClient } from "@vercel/postgres";
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
  scope?: string;
}

export type TokenScope = "push" | "read";

// Sandbox limits. A push is one request, so it must also stay under Vercel's 4.5 MB body limit.
// The database is shared with sign-in, so the sandbox is kept small.
export const LIMITS = {
  maxBodyBytes: 4_000_000,
  maxTableBytes: 1_000_000, // all table rows in one push, as JSON
  maxFiles: 2_000,
  maxTables: 10,
  maxRowsPerTable: 5_000,
  maxColumns: 100,
  maxCellChars: 2_000,
  keepIterations: 20, // the sandbox keeps the latest 20 iterations; older ones are pruned
  maxRecordRows: 100_000, // all table rows in the sandbox
  maxPushesPerTokenPerHour: 30,
  maxPushesPerDay: 300, // per project
  maxTokensPerPerson: 5,
  maxTokenDays: 365,
} as const;

// Campaigns hold real project data, written only with keys the owner issues, so tables can be larger.
// A single request still stays under 4 MB; large tables arrive in chunks (appendRows).
export const CAMPAIGN_LIMITS = {
  maxRowsPerTable: 50_000,
  maxColumns: 300,
  maxRecordRows: 1_000_000, // all table rows in one campaign
  maxKeysPerProject: 50,
} as const;

export const limitsFor = (kind: string) =>
  kind === "sandbox"
    ? { maxRowsPerTable: LIMITS.maxRowsPerTable, maxColumns: LIMITS.maxColumns, maxRecordRows: LIMITS.maxRecordRows }
    : { maxRowsPerTable: CAMPAIGN_LIMITS.maxRowsPerTable, maxColumns: CAMPAIGN_LIMITS.maxColumns, maxRecordRows: CAMPAIGN_LIMITS.maxRecordRows };

/** A request the limits refuse; the route turns it into this HTTP status. */
export class LimitError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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
  // JSONB does not keep key order, so each table's column order is stored as an array.
  await sql`
    CREATE TABLE IF NOT EXISTS project_tables (
      project_slug TEXT NOT NULL,
      iteration_n  INTEGER NOT NULL,
      table_name   TEXT NOT NULL,
      file_path    TEXT,
      columns      JSONB NOT NULL,
      row_count    INTEGER NOT NULL,
      PRIMARY KEY (project_slug, iteration_n, table_name)
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
  await sql`ALTER TABLE project_iterations ADD COLUMN IF NOT EXISTS token_id TEXT`;
  await sql`ALTER TABLE project_tokens ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'push'`;
  await sql`ALTER TABLE project_tables ADD COLUMN IF NOT EXISTS expected_rows INTEGER`;
  await sql`CREATE INDEX IF NOT EXISTS project_iterations_token ON project_iterations (token_id, created_at)`;
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

/** Admin only (routes check the admin key): creates a campaign project. */
export async function createProject(slug: string, title: string, description: string | null): Promise<ProjectRow | null> {
  await ensureProjectsSchema();
  const { rows } = await sql<ProjectRow>`
    INSERT INTO projects (slug, title, description, kind) VALUES (${slug}, ${title}, ${description}, 'campaign')
    ON CONFLICT (slug) DO NOTHING
    RETURNING slug, title, description, kind, created_at`;
  if (rows[0]) await audit(slug, "admin", "admin", "create_project", slug, { title });
  return rows[0] ?? null;
}

// ── Tokens ──────────────────────────────────────────────────────────────────

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Runs fn inside one transaction on one pooled connection. */
async function inTransaction<T>(fn: (c: VercelPoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    const out = await fn(client);
    await client.sql`COMMIT`;
    return out;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Creates a token unless the person already holds the maximum; the check and insert are one transaction. */
export async function createToken(slug: string, createdBy: string, label: string | null, days: number) {
  await ensureProjectsSchema();
  const email = createdBy.toLowerCase();
  const token = "sdd_pt_" + randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url");
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"tokens:" + slug + ":" + email}))`;
    const { rows } = await c.sql`
      SELECT COUNT(*)::int AS n FROM project_tokens
      WHERE project_slug = ${slug} AND created_by = ${email} AND revoked_at IS NULL AND expires_at > NOW()`;
    if (Number(rows[0]?.n ?? 0) >= LIMITS.maxTokensPerPerson) {
      throw new LimitError(409, `You already have ${LIMITS.maxTokensPerPerson} active tokens. Revoke one first.`);
    }
    await c.sql`
      INSERT INTO project_tokens (id, project_slug, token_hash, prefix, label, created_by, expires_at)
      VALUES (${id}, ${slug}, ${hashToken(token)}, ${token.slice(0, 11)}, ${label}, ${email}, ${expires})`;
    await c.sql`
      INSERT INTO project_audit (project_slug, actor, actor_type, action, target, detail)
      VALUES (${slug}, ${email}, 'human', 'create_token', ${token.slice(0, 11)}, ${JSON.stringify({ label, days })}::jsonb)`;
    return { id, token, prefix: token.slice(0, 11), expiresAt: expires };
  });
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

/**
 * Resolves a key to its row, or null if unknown, revoked, expired, for another project, or not allowed
 * to do `need`. A push key can also read; a read key cannot push.
 */
export async function verifyToken(slug: string, token: string, need: TokenScope = "push"): Promise<TokenRow | null> {
  await ensureProjectsSchema();
  if (!token.startsWith("sdd_pt_") || token.length > 100) return null;
  const scopes = need === "push" ? ["push"] : ["push", "read"];
  const { rows } = await sql<TokenRow>`
    UPDATE project_tokens SET last_used_at = NOW()
    WHERE token_hash = ${hashToken(token)} AND project_slug = ${slug} AND revoked_at IS NULL AND expires_at > NOW()
      AND scope IN (SELECT jsonb_array_elements_text(${JSON.stringify(scopes)}::jsonb))
    RETURNING id, project_slug, prefix, label, created_by, created_at, expires_at, revoked_at, last_used_at, scope`;
  return rows[0] ?? null;
}

/** Admin only: issues a read or push key for a project. The key is returned once. */
export async function createProjectKey(slug: string, scope: TokenScope, label: string | null, days: number) {
  await ensureProjectsSchema();
  const token = "sdd_pt_" + randomBytes(32).toString("base64url");
  const id = randomBytes(9).toString("base64url");
  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"keys:" + slug}))`;
    const { rows } = await c.sql`
      SELECT COUNT(*)::int AS n FROM project_tokens WHERE project_slug = ${slug} AND revoked_at IS NULL AND expires_at > NOW()`;
    if (Number(rows[0]?.n ?? 0) >= CAMPAIGN_LIMITS.maxKeysPerProject) {
      throw new LimitError(409, `This project already has ${CAMPAIGN_LIMITS.maxKeysPerProject} active keys. Revoke some first.`);
    }
    await c.sql`
      INSERT INTO project_tokens (id, project_slug, token_hash, prefix, label, created_by, expires_at, scope)
      VALUES (${id}, ${slug}, ${hashToken(token)}, ${token.slice(0, 11)}, ${label}, 'admin', ${expires}, ${scope})`;
    await c.sql`
      INSERT INTO project_audit (project_slug, actor, actor_type, action, target, detail)
      VALUES (${slug}, 'admin', 'admin', 'create_key', ${token.slice(0, 11)}, ${JSON.stringify({ scope, label, days })}::jsonb)`;
    return { id, token, prefix: token.slice(0, 11), scope, expiresAt: expires };
  });
}

/** Admin only: every key of a project (never the key itself). */
export async function listProjectKeys(slug: string): Promise<TokenRow[]> {
  await ensureProjectsSchema();
  const { rows } = await sql<TokenRow>`
    SELECT id, project_slug, prefix, label, created_by, created_at, expires_at, revoked_at, last_used_at, scope
    FROM project_tokens WHERE project_slug = ${slug} ORDER BY created_at DESC LIMIT 200`;
  return rows;
}

/** Admin only: revokes any key of a project. */
export async function revokeProjectKey(slug: string, id: string): Promise<boolean> {
  await ensureProjectsSchema();
  const { rowCount } = await sql`
    UPDATE project_tokens SET revoked_at = NOW() WHERE id = ${id} AND project_slug = ${slug} AND revoked_at IS NULL`;
  if ((rowCount ?? 0) > 0) await audit(slug, "admin", "admin", "revoke_key", id, null);
  return (rowCount ?? 0) > 0;
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
  /** Total rows when the table arrives in chunks: `rows` is the first chunk, the rest via appendRows. */
  expectedRows?: number;
}

export interface IncompleteTable {
  name: string;
  have: number;
  expected: number;
}

export type CommitResult =
  | { duplicate: true; iteration: IterationRow; incomplete: IncompleteTable[] }
  | { duplicate: false; iteration: IterationRow; newFiles: number };

async function incompleteTables(c: VercelPoolClient, slug: string, n: number): Promise<IncompleteTable[]> {
  const { rows } = await c.sql<{ table_name: string; row_count: number; expected_rows: number }>`
    SELECT table_name, row_count, expected_rows FROM project_tables
    WHERE project_slug = ${slug} AND iteration_n = ${n} AND expected_rows IS NOT NULL AND row_count < expected_rows`;
  return rows.map((r) => ({ name: r.table_name, have: r.row_count, expected: r.expected_rows }));
}

/**
 * Registers one iteration atomically: the duplicate check, limits, iteration row, file index,
 * superseding, tables and audit entry commit together or not at all. A per-project advisory lock
 * serialises pushes, so iteration numbers never collide.
 */
export async function commitIteration(args: {
  slug: string;
  sandbox: boolean;
  tokenId: string;
  label: string;
  manifestSha: string;
  source: string;
  actor: string;
  actorType: "token" | "agent";
  gitSha: string | null;
  summary: string | null;
  files: ManifestFile[];
  tables: PushTable[];
}): Promise<CommitResult> {
  await ensureProjectsSchema();
  const { slug } = args;
  const newRows = args.tables.reduce((sum, t) => sum + (t.expectedRows ?? t.rows.length), 0);

  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"push:" + slug}))`;

    const dup = await c.sql<IterationRow>`
      SELECT n, label, source, actor_type, actor, git_sha, summary, files, new_files, status, created_at
      FROM project_iterations WHERE project_slug = ${slug} AND manifest_sha256 = ${args.manifestSha}`;
    if (dup.rows[0]) {
      // A retried push: report tables whose chunks did not all arrive, so the client can resume.
      return { duplicate: true as const, iteration: dup.rows[0], incomplete: await incompleteTables(c, slug, dup.rows[0].n) };
    }

    const perToken = await c.sql`
      SELECT COUNT(*)::int AS n FROM project_iterations
      WHERE token_id = ${args.tokenId} AND created_at > NOW() - INTERVAL '1 hour'`;
    if (Number(perToken.rows[0]?.n ?? 0) >= LIMITS.maxPushesPerTokenPerHour) {
      throw new LimitError(429, `This token has pushed ${LIMITS.maxPushesPerTokenPerHour} iterations in the last hour. Try again later.`);
    }
    const perDay = await c.sql`
      SELECT COUNT(*)::int AS n FROM project_iterations
      WHERE project_slug = ${slug} AND created_at > NOW() - INTERVAL '1 day'`;
    if (Number(perDay.rows[0]?.n ?? 0) >= LIMITS.maxPushesPerDay) {
      throw new LimitError(429, `This project has had ${LIMITS.maxPushesPerDay} pushes today. Try again tomorrow.`);
    }

    if (!args.sandbox) {
      const total = await c.sql`SELECT COALESCE(SUM(COALESCE(expected_rows, row_count)), 0)::int AS n FROM project_tables WHERE project_slug = ${slug}`;
      if (Number(total.rows[0]?.n ?? 0) + newRows > CAMPAIGN_LIMITS.maxRecordRows) {
        throw new LimitError(507, `This project holds at most ${CAMPAIGN_LIMITS.maxRecordRows} table rows.`);
      }
    }
    if (args.sandbox) {
      // Make room first, so the sandbox never holds more than keepIterations.
      const cut = await c.sql<{ n: number }>`
        SELECT n FROM project_iterations WHERE project_slug = ${slug} ORDER BY n DESC OFFSET ${LIMITS.keepIterations - 1} LIMIT 1`;
      const cutoff = cut.rows[0]?.n;
      if (cutoff != null) {
        await c.sql`DELETE FROM project_records WHERE project_slug = ${slug} AND iteration_n <= ${cutoff}`;
        await c.sql`DELETE FROM project_tables WHERE project_slug = ${slug} AND iteration_n <= ${cutoff}`;
        await c.sql`DELETE FROM project_artifacts WHERE project_slug = ${slug} AND iteration_n <= ${cutoff}`;
        await c.sql`DELETE FROM project_iterations WHERE project_slug = ${slug} AND n <= ${cutoff}`;
      }
      const total = await c.sql`SELECT COALESCE(SUM(COALESCE(expected_rows, row_count)), 0)::int AS n FROM project_tables WHERE project_slug = ${slug}`;
      if (Number(total.rows[0]?.n ?? 0) + newRows > LIMITS.maxRecordRows) {
        throw new LimitError(507, `The sandbox holds at most ${LIMITS.maxRecordRows} table rows. Push smaller summary tables.`);
      }
    }

    // Files whose checksum the project has not seen before.
    const shas = JSON.stringify(Array.from(new Set(args.files.map((f) => f.sha256))));
    const seen = await c.sql<{ sha256: string }>`
      SELECT DISTINCT sha256 FROM project_artifacts
      WHERE project_slug = ${slug} AND sha256 IN (SELECT jsonb_array_elements_text(${shas}::jsonb))`;
    const seenSet = new Set(seen.rows.map((r) => r.sha256));
    const newFiles = args.files.filter((f) => !seenSet.has(f.sha256)).length;

    const ins = await c.sql<IterationRow>`
      INSERT INTO project_iterations
        (project_slug, n, label, manifest_sha256, source, actor_type, actor, token_id, git_sha, summary, files, new_files)
      SELECT ${slug}, COALESCE(MAX(n), 0) + 1, ${args.label}, ${args.manifestSha}, ${args.source}, ${args.actorType},
             ${args.actor}, ${args.tokenId}, ${args.gitSha}, ${args.summary}, ${args.files.length}, ${newFiles}
      FROM project_iterations WHERE project_slug = ${slug}
      RETURNING n, label, source, actor_type, actor, git_sha, summary, files, new_files, status, created_at`;
    const iteration = ins.rows[0];
    const n = iteration.n;

    // Earlier versions of the same paths are superseded when their content changed.
    const filesJson = JSON.stringify(args.files);
    await c.sql`
      UPDATE project_artifacts a SET release_state = 'superseded'
      FROM jsonb_to_recordset(${filesJson}::jsonb) AS f(path TEXT, sha256 TEXT)
      WHERE a.project_slug = ${slug} AND a.path = f.path AND a.sha256 <> f.sha256
        AND a.release_state IN ('draft', 'internal')`;
    await c.sql`
      INSERT INTO project_artifacts (project_slug, iteration_n, path, kind, sha256, size, sensitivity, actor_type)
      SELECT ${slug}, ${n}, f.path, f.kind, f.sha256, f.size, f.sensitivity, ${args.actorType}
      FROM jsonb_to_recordset(${filesJson}::jsonb) AS f(path TEXT, kind TEXT, sha256 TEXT, size BIGINT, sensitivity TEXT)`;

    for (const t of args.tables) {
      const columns: string[] = [];
      for (const row of t.rows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);
      await c.sql`
        INSERT INTO project_tables (project_slug, iteration_n, table_name, file_path, columns, row_count, expected_rows)
        VALUES (${slug}, ${n}, ${t.name}, ${t.file}, ${JSON.stringify(columns)}::jsonb, ${t.rows.length}, ${t.expectedRows ?? null})`;
      await c.sql`
        INSERT INTO project_records (project_slug, iteration_n, table_name, row_index, data)
        SELECT ${slug}, ${n}, ${t.name}, (ord - 1)::int, value
        FROM jsonb_array_elements(${JSON.stringify(t.rows)}::jsonb) WITH ORDINALITY AS r(value, ord)`;
    }

    const detail = { label: args.label, files: args.files.length, newFiles, tables: args.tables.map((t) => ({ name: t.name, rows: t.rows.length })) };
    await c.sql`
      INSERT INTO project_audit (project_slug, actor, actor_type, action, target, detail)
      VALUES (${slug}, ${args.actor}, ${args.actorType}, 'push_iteration', ${"iteration " + n}, ${JSON.stringify(detail)}::jsonb)`;
    return { duplicate: false as const, iteration, newFiles };
  });
}

/**
 * Appends one chunk of rows to a table declared with expectedRows in an iteration. Only the key that
 * pushed the iteration may append, within a day, and never beyond the declared row count.
 */
export async function appendRows(args: {
  slug: string;
  n: number;
  tokenId: string;
  table: string;
  offset: number;
  rows: PushTable["rows"];
}): Promise<{ have: number; expected: number }> {
  await ensureProjectsSchema();
  const { slug, n, table } = args;
  return inTransaction(async (c) => {
    await c.sql`SELECT pg_advisory_xact_lock(hashtext(${"append:" + slug + ":" + n + ":" + table}))`;
    const it = await c.sql`
      SELECT token_id, created_at > NOW() - INTERVAL '1 day' AS fresh FROM project_iterations WHERE project_slug = ${slug} AND n = ${n}`;
    if (!it.rows[0]) throw new LimitError(404, `Iteration ${n} not found.`);
    if (it.rows[0].token_id !== args.tokenId) throw new LimitError(403, "Only the key that pushed this iteration can add rows to it.");
    if (!it.rows[0].fresh) throw new LimitError(409, "Rows can be added only within a day of the push.");
    const meta = await c.sql<{ row_count: number; expected_rows: number | null; columns: string[] }>`
      SELECT row_count, expected_rows, columns FROM project_tables WHERE project_slug = ${slug} AND iteration_n = ${n} AND table_name = ${table}`;
    const m = meta.rows[0];
    if (!m || m.expected_rows == null) throw new LimitError(404, `Table ${table} in iteration ${n} does not take chunks.`);
    // Retried chunks are idempotent: the client says where the chunk starts.
    if (args.offset !== m.row_count) {
      if (args.offset + args.rows.length <= m.row_count) return { have: m.row_count, expected: m.expected_rows };
      throw new LimitError(409, `Expected the chunk to start at row ${m.row_count}, not ${args.offset}.`);
    }
    if (m.row_count + args.rows.length > m.expected_rows) {
      throw new LimitError(400, `Table ${table} was declared with ${m.expected_rows} rows; this chunk would exceed it.`);
    }
    const seen = new Set(m.columns);
    const columns = [...m.columns];
    const max = limitsFor("campaign").maxColumns;
    for (const row of args.rows) for (const k of Object.keys(row)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
    if (columns.length > max) throw new LimitError(400, `Table ${table} would have more than ${max} columns.`);
    await c.sql`
      INSERT INTO project_records (project_slug, iteration_n, table_name, row_index, data)
      SELECT ${slug}, ${n}, ${table}, (${m.row_count}::int + ord::int - 1), value
      FROM jsonb_array_elements(${JSON.stringify(args.rows)}::jsonb) WITH ORDINALITY AS r(value, ord)`;
    const have = m.row_count + args.rows.length;
    await c.sql`
      UPDATE project_tables SET row_count = ${have}, columns = ${JSON.stringify(columns)}::jsonb
      WHERE project_slug = ${slug} AND iteration_n = ${n} AND table_name = ${table}`;
    return { have, expected: m.expected_rows };
  });
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
  const { rows } = await sql<{ table_name: string; iteration_n: number; rows: number; expected_rows: number | null }>`
    SELECT DISTINCT ON (table_name) table_name, iteration_n, row_count AS rows, expected_rows
    FROM project_tables WHERE project_slug = ${slug}
    ORDER BY table_name, iteration_n DESC`;
  return rows;
}

export async function readRecords(
  slug: string,
  table: string,
  iteration: number | null,
  limit: number,
  offset: number,
  opts: { q?: string | null; sort?: string | null; desc?: boolean } = {},
) {
  await ensureProjectsSchema();
  let n = iteration;
  if (n == null) {
    const { rows } = await sql<{ n: number | null }>`
      SELECT MAX(iteration_n) AS n FROM project_tables WHERE project_slug = ${slug} AND table_name = ${table}`;
    n = rows[0]?.n ?? null;
  }
  if (n == null) return { iteration: null, total: 0, matched: 0, columns: [] as string[], rows: [] as unknown[] };
  const { rows: meta } = await sql<{ columns: string[]; row_count: number; expected_rows: number | null }>`
    SELECT columns, row_count, expected_rows FROM project_tables WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n}`;
  const columns = meta[0]?.columns ?? [];
  const q = opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;
  // Sort only by a column the table has; numbers sort numerically, text alphabetically, missing values last.
  const sortCol = opts.sort && columns.includes(opts.sort) ? opts.sort : null;
  const { rows: count } = await sql<{ c: number }>`
    SELECT COUNT(*)::int AS c FROM project_records
    WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n}
      AND (${q}::text IS NULL OR data::text ILIKE ${q})`;
  const { rows } = sortCol
    ? opts.desc
      ? await sql<{ data: unknown }>`
          SELECT data FROM project_records
          WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n} AND (${q}::text IS NULL OR data::text ILIKE ${q})
          ORDER BY CASE WHEN jsonb_typeof(data->${sortCol}) = 'number' THEN (data->>${sortCol})::float8 END DESC NULLS LAST,
                   data->>${sortCol} DESC NULLS LAST, row_index
          LIMIT ${limit} OFFSET ${offset}`
      : await sql<{ data: unknown }>`
          SELECT data FROM project_records
          WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n} AND (${q}::text IS NULL OR data::text ILIKE ${q})
          ORDER BY CASE WHEN jsonb_typeof(data->${sortCol}) = 'number' THEN (data->>${sortCol})::float8 END ASC NULLS LAST,
                   data->>${sortCol} ASC NULLS LAST, row_index
          LIMIT ${limit} OFFSET ${offset}`
    : await sql<{ data: unknown }>`
        SELECT data FROM project_records
        WHERE project_slug = ${slug} AND table_name = ${table} AND iteration_n = ${n} AND (${q}::text IS NULL OR data::text ILIKE ${q})
        ORDER BY row_index LIMIT ${limit} OFFSET ${offset}`;
  return {
    iteration: n,
    total: meta[0]?.row_count ?? 0,
    expected: meta[0]?.expected_rows ?? null,
    matched: Number(count[0]?.c ?? 0),
    columns,
    rows: rows.map((r) => r.data),
  };
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function audit(slug: string, actor: string, actorType: string, action: string, target: string | null, detail: unknown) {
  await sql`
    INSERT INTO project_audit (project_slug, actor, actor_type, action, target, detail)
    VALUES (${slug}, ${actor}, ${actorType}, ${action}, ${target}, ${JSON.stringify(detail ?? null)}::jsonb)`;
}

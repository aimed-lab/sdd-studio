import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { LIMITS, limitsFor, verifyToken, type ManifestFile, type ProjectRow, type PushTable } from "@/lib/projects-db";
import { getSessionUser } from "@/lib/session";
import { ssoEnabled } from "@/lib/sso/config";

export const ARTIFACT_KINDS = [
  "decision-sheet", "data", "figure", "structure", "manuscript", "report", "app", "harness", "log",
] as const;
export const SENSITIVITIES = ["test", "public", "unpublished", "confidential"] as const;

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (status: number, error: string) => json({ ok: false, error }, status);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

/** Member-managed push tokens exist only for the sandbox (test data). */
export function sandboxOnly(project: ProjectRow | null): NextResponse | null {
  if (!project) return fail(404, "Project not found.");
  if (project.kind !== "sandbox") return fail(403, "Keys for this project are issued by the platform owner.");
  return null;
}

export function bearer(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/** The project key a reader sends: `X-SDD-Project-Key: sdd_pt_…` (or a Bearer token). */
export const projectKey = (req: Request) => req.headers.get("x-sdd-project-key") ?? bearer(req.headers.get("authorization"));

/** Platform roles that may read every campaign when signed in with single sign-on. */
export const CAMPAIGN_READER_ROLES = ["Owner", "Admin"] as const;

/**
 * True for a signed-in, active Owner or Admin. Only with single sign-on on: the session is a signed
 * cookie checked on the server, and the role and status come from the database on every request.
 */
export async function isCampaignReader(req: NextRequest): Promise<boolean> {
  if (!ssoEnabled()) return false;
  const user = await getSessionUser(req);
  return !!user && user.account_status === "active" && (CAMPAIGN_READER_ROLES as readonly string[]).includes(user.role);
}

/**
 * Reads: the sandbox is open. A campaign needs a read or push key for that project, or a signed-in
 * Owner or Admin (single sign-on). Both are checked on the server on every request. Writes (pushes)
 * always need a push key.
 */
export async function readGate(project: ProjectRow | null, req: NextRequest): Promise<NextResponse | null> {
  return (await readAccess(project, req)).denied;
}

/**
 * Like readGate, and also says what opened a campaign: "read" or "push" for a key, "admin" for a
 * signed-in Owner or Admin.
 */
export async function readAccess(project: ProjectRow | null, req: NextRequest): Promise<{ denied: NextResponse | null; scope: string | null }> {
  if (!project) return { denied: fail(404, "Project not found."), scope: null };
  if (project.kind === "sandbox") return { denied: null, scope: null };
  const key = projectKey(req);
  const tok = key ? await verifyToken(project.slug, key, "read") : null;
  if (tok) return { denied: null, scope: tok.scope ?? "push" };
  if (await isCampaignReader(req)) return { denied: null, scope: "admin" };
  return { denied: json({ ok: false, needsKey: true, error: "This project needs a project key. Ask the platform owner for one." }, 401), scope: null };
}


const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Text Postgres cannot store (NUL, unpaired surrogates).
const BROKEN_TEXT = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// Control characters and bidirectional overrides that could disguise a file name.
const SPOOF_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
const cleanText = (v: string) => !BROKEN_TEXT.test(v);

function safePath(p: unknown): p is string {
  return (
    typeof p === "string" && p.length > 0 && p.length <= 300 &&
    cleanText(p) && !SPOOF_CHARS.test(p) &&
    !p.startsWith("/") && !p.includes("\\") &&
    !p.split("/").some((seg) => seg === ".." || seg === "." || seg === "")
  );
}

/** Validates table rows (used for pushes and for appended chunks). */
export function parseRows(
  raw: unknown,
  where: string,
  maxColumns: number,
): { rows: PushTable["rows"] } | { error: string } {
  if (!Array.isArray(raw)) return { error: `${where}.rows must be a list.` };
  const rows: PushTable["rows"] = [];
  for (let r = 0; r < raw.length; r++) {
    const row: unknown = raw[r];
    if (!isPlainObject(row)) return { error: `${where}.rows[${r}] must be an object.` };
    const keys = Object.keys(row);
    if (keys.length > maxColumns) return { error: `${where}.rows[${r}]: at most ${maxColumns} columns.` };
    const clean: PushTable["rows"][number] = {};
    for (const k of keys) {
      if (k.length === 0 || k.length > 60 || k === "__proto__" || !cleanText(k) || SPOOF_CHARS.test(k)) return { error: `${where}.rows[${r}]: column names must be 1–60 characters of plain text.` };
      const v = row[k];
      if (v === null || typeof v === "boolean") clean[k] = v;
      else if (typeof v === "number") {
        if (!Number.isFinite(v)) return { error: `${where}.rows[${r}].${k}: numbers must be finite.` };
        clean[k] = v;
      } else if (typeof v === "string") {
        if (v.length > LIMITS.maxCellChars) return { error: `${where}.rows[${r}].${k}: at most ${LIMITS.maxCellChars} characters.` };
        if (!cleanText(v)) return { error: `${where}.rows[${r}].${k}: contains characters that cannot be stored.` };
        clean[k] = v;
      } else return { error: `${where}.rows[${r}].${k}: only text, numbers, true/false or null.` };
    }
    rows.push(clean);
  }
  return { rows };
}

export interface PushInput {
  label: string;
  source: "cli" | "agent";
  gitSha: string | null;
  summary: string | null;
  files: ManifestFile[];
  tables: PushTable[];
  manifestSha: string;
}

/** Validates a push body. Returns the cleaned input or an error message. */
export function parsePush(body: unknown, project: ProjectRow): PushInput | { error: string } {
  if (!isPlainObject(body)) return { error: "Body must be a JSON object." };

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(label)) {
    return { error: "label: 1–80 characters, letters, digits, dot, dash, underscore or space." };
  }
  const source = body.source === undefined ? "cli" : body.source;
  if (source !== "cli" && source !== "agent") return { error: 'source must be "cli" or "agent".' };
  const gitSha = body.gitSha == null || body.gitSha === "" ? null : body.gitSha;
  if (gitSha !== null && (typeof gitSha !== "string" || !/^[0-9a-f]{7,40}$/i.test(gitSha))) {
    return { error: "gitSha must be 7–40 hex characters." };
  }
  const summary = body.summary == null || body.summary === "" ? null : body.summary;
  if (summary !== null && (typeof summary !== "string" || summary.length > 500 || !cleanText(summary) || SPOOF_CHARS.test(summary.replace(/[\n\t]/g, " ")))) {
    return { error: "summary: at most 500 characters of plain text." };
  }

  if (!Array.isArray(body.files) || body.files.length === 0) return { error: "files: a non-empty list is required." };
  if (body.files.length > LIMITS.maxFiles) return { error: `files: at most ${LIMITS.maxFiles} per push.` };
  const files: ManifestFile[] = [];
  const paths = new Set<string>();
  for (let i = 0; i < body.files.length; i++) {
    const f: unknown = body.files[i];
    if (!isPlainObject(f)) return { error: `files[${i}] must be an object.` };
    if (!safePath(f.path)) return { error: `files[${i}].path must be a relative path (at most 300 characters) without "..", ".", empty segments, control characters or direction overrides.` };
    if (paths.has(f.path)) return { error: `files[${i}].path is listed twice: ${f.path}` };
    if (typeof f.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(f.sha256)) return { error: `files[${i}].sha256 must be 64 lowercase hex characters.` };
    if (typeof f.size !== "number" || !Number.isInteger(f.size) || f.size < 0 || f.size > 1e12) return { error: `files[${i}].size must be a byte count.` };
    if (!(ARTIFACT_KINDS as readonly unknown[]).includes(f.kind)) return { error: `files[${i}].kind must be one of ${ARTIFACT_KINDS.join(", ")}.` };
    if (!(SENSITIVITIES as readonly unknown[]).includes(f.sensitivity)) return { error: `files[${i}].sensitivity must be one of ${SENSITIVITIES.join(", ")}.` };
    if (project.kind === "sandbox" && f.sensitivity !== "test") {
      return { error: `The sandbox accepts test data only: files[${i}] (${f.path}) is marked "${f.sensitivity}".` };
    }
    paths.add(f.path);
    files.push({ path: f.path, sha256: f.sha256, size: f.size, kind: f.kind as string, sensitivity: f.sensitivity as string });
  }

  const rawTables = body.tables ?? [];
  if (!Array.isArray(rawTables)) return { error: "tables must be a list." };
  const maxTables = limitsFor(project.kind).maxTables;
  if (rawTables.length > maxTables) return { error: `tables: at most ${maxTables} per push.` };
  const tables: PushTable[] = [];
  const names = new Set<string>();
  for (let i = 0; i < rawTables.length; i++) {
    const t: unknown = rawTables[i];
    if (!isPlainObject(t)) return { error: `tables[${i}] must be an object.` };
    if (typeof t.name !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(t.name)) return { error: `tables[${i}].name: lowercase letters, digits and underscores, starting with a letter.` };
    if (names.has(t.name)) return { error: `tables[${i}].name is used twice: ${t.name}` };
    const file = t.file == null ? null : t.file;
    if (file !== null && (typeof file !== "string" || !paths.has(file))) return { error: `tables[${i}].file must be one of the pushed files.` };
    // In the sandbox every table must come from a pushed (test) file, so its sensitivity is known.
    if (project.kind === "sandbox" && file === null) return { error: `tables[${i}].file is required in the sandbox.` };
    const lim = limitsFor(project.kind);
    const parsed = parseRows(t.rows, `tables[${i}]`, lim.maxColumns);
    if ("error" in parsed) return parsed;
    const rows = parsed.rows;
    let expectedRows: number | undefined;
    if (t.expectedRows != null) {
      // A large table arrives in chunks: this push carries the first rows, the rest are appended.
      if (project.kind === "sandbox") return { error: `tables[${i}]: the sandbox does not take tables in chunks.` };
      if (typeof t.expectedRows !== "number" || !Number.isInteger(t.expectedRows) || t.expectedRows < rows.length) {
        return { error: `tables[${i}].expectedRows must be a whole number at least the rows sent.` };
      }
      if (file === null) return { error: `tables[${i}].file is required for a table sent in chunks.` };
      expectedRows = t.expectedRows;
    }
    if ((expectedRows ?? rows.length) > lim.maxRowsPerTable) {
      return { error: `tables[${i}]: at most ${lim.maxRowsPerTable} rows in this project. Push a summary table instead.` };
    }
    names.add(t.name);
    tables.push({ name: t.name, file, rows, ...(expectedRows != null ? { expectedRows } : {}) });
  }

  const tableBytes = Buffer.byteLength(JSON.stringify(tables));
  if (tableBytes > LIMITS.maxTableBytes) {
    return { error: `Table rows total ${(tableBytes / 1e6).toFixed(1)} MB; at most ${LIMITS.maxTableBytes / 1e6} MB per push. Push summary tables.` };
  }

  // Same label, file contents and table rows → same iteration (re-running a push is a no-op).
  const canonical = JSON.stringify({
    label,
    files: files.map((f) => [f.path, f.sha256]).sort(),
    // A chunked table is identified by its file (whose checksum is in `files`) and row count.
    tables: tables
      .map((t) => [t.name, t.file, t.expectedRows != null ? `chunked:${t.expectedRows}` : createHash("sha256").update(JSON.stringify(t.rows)).digest("hex")])
      .sort(),
  });
  const manifestSha = createHash("sha256").update(canonical).digest("hex");
  return { label, source, gitSha, summary, files, tables, manifestSha };
}

#!/usr/bin/env node
// sdd — push a project iteration to SDD Studio.
//
//   sdd init   [--project sandbox] [--studio https://studio.smartdrugdiscovery.org]
//   sdd push   --label r012-polar-bioisostere [--dir Results/r012-polar-bioisostere] [--summary "…"]
//              [--git <sha>] [--agent] [--dry-run]
//   sdd status
//   sdd admin create-project --slug phgdh-npa --title "…" [--description "…"] [--studio URL]
//   sdd admin key --project phgdh-npa --scope read|push [--label "…"] [--days 90] [--studio URL]
//   sdd admin keys --project phgdh-npa [--studio URL]
//   sdd admin revoke --project phgdh-npa --id <key id> [--studio URL]
//   sdd admin move-account --from old@example.org --to new@example.org [--dry-run] [--studio URL]
//
// Reads sdd.project.json in the current folder (or a parent). The push key comes from the
// SDD_PROJECT_TOKEN environment variable, or from a file given with --token-file; it is never printed.
// Admin commands need SDD_ADMIN_TOKEN (the ADMIN_API_TOKEN set in Vercel). A new key is written to a
// private file under ~/.sdd/keys (mode 600) and only its file name and prefix are printed. File contents are not
// uploaded: Studio receives each file's path, SHA-256, size, kind and sensitivity, plus the summary
// tables the config declares (CSV or TSV). Node 18 or later; no dependencies.

import { createHash } from "node:crypto";
import { chmodSync, createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

const CONFIG = "sdd.project.json";
const DEFAULT_STUDIO = "https://studio.smartdrugdiscovery.org";
const MAX_BODY = 3_900_000;
const CHUNK_BYTES = 800_000; // table rows per request when a table is sent in chunks

// Always skipped, whatever sdd.project.json says: secrets must never be indexed (names and checksums are visible).
const ALWAYS_EXCLUDE = [
  "**/.git/**", "**/*.env", "**/.env*", "**/.ssh/**", "**/.aws/**", "**/.gnupg/**", "**/*.pem", "**/*.key", "**/*.p12",
  "**/*.pfx", "**/id_rsa*", "**/id_ecdsa*", "**/id_ed25519*", "**/*credentials*.json", "**/secrets/**", "**/*.secret",
  "**/.netrc", "**/.npmrc", "**/.pypirc", "**/sdd.project.json",
];

const DEFAULT_CONFIG = {
  project: "sandbox",
  studio: DEFAULT_STUDIO,
  include: ["Results/**", "Plan/**", "Reviews/**", "*_HARNESS.md", "HARNESS.md"],
  exclude: ["**/.DS_Store", "**/.git/**", "**/node_modules/**", "**/.venv/**", "**/__pycache__/**"],
  sensitivity: "test",
  tables: {
    "Results/*/tables/decision_sheet.*": "decision_sheet",
    "Results/*/tables/round_summary.*": "rounds",
  },
};

// ── tiny helpers ──────────────────────────────────────────────────────────────

function die(msg) {
  console.error(`sdd: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

/** Glob to RegExp: ** any depth, * within a segment, ? one character. Paths use "/". */
function globRe(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** The nearest folder with sdd.project.json, never the home folder or the filesystem root. */
function findConfig(start) {
  const stop = new Set([resolve(homedir()), resolve("/")]);
  let dir = resolve(start);
  for (;;) {
    if (stop.has(dir)) return null;
    if (existsSync(join(dir, CONFIG))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Regular files under root. Symbolic links are skipped, and excluded folders are not entered. */
function walk(root, dir, exclude, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p).split(sep).join("/");
    const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) {
      if (!exclude.some((r) => r.test(`${rel}/x`))) walk(root, p, exclude, out);
    } else if (st.isFile()) out.push(rel);
  }
  return out;
}

function sha256(file) {
  return new Promise((ok, bad) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", bad);
  });
}

function kindOf(path) {
  const p = path.toLowerCase();
  const name = p.split("/").pop();
  if (name.includes("harness")) return "harness";
  if (/decision[_-]?sheet/.test(name)) return "decision-sheet";
  if (/\.(png|jpe?g|svg|gif|webp|tiff?)$/.test(p)) return "figure";
  if (/\.(pdb|cif|mmcif|sdf|mol2?|molx|xyz|pdbqt)$/.test(p)) return "structure";
  if (/\.log$/.test(p) || p.includes("/logs/")) return "log";
  if (p.includes("manuscript")) return "manuscript";
  if (/\.(pdf|docx?|md|pptx?|html?)$/.test(p)) return "report";
  if (/\.(ipynb|py|r|js|ts|sh|zip)$/.test(p) && p.includes("/app")) return "app";
  return "data";
}

/** RFC 4180-style CSV/TSV parser; numbers become numbers, empty cells null. */
function parseDelimited(text, delim) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (rows.length === 0) return [];
  const head = rows[0].map((h, i) => (h.trim() || `col_${i + 1}`).slice(0, 60));
  return rows.slice(1).map((r) => {
    const o = {};
    head.forEach((h, i) => {
      const v = (r[i] ?? "").trim();
      o[h] = v === "" ? null : /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v) && Number.isFinite(Number(v)) ? Number(v) : v.slice(0, 2000);
    });
    return o;
  });
}

let TOKEN_FILE = null;
let STUDIO_FLAG = null;
function pushToken() {
  if (TOKEN_FILE) {
    const t = readFileSync(TOKEN_FILE, "utf8").trim();
    if (!t.startsWith("sdd_pt_")) die(`${TOKEN_FILE} does not contain a key.`);
    return t;
  }
  return process.env.SDD_PROJECT_TOKEN;
}

function studioOrigin(studio) {
  let url;
  try { url = new URL(studio); } catch { die(`"studio" is not a URL: ${studio}`); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) die(`refusing to send a key over ${url.protocol}//; "studio" must be https.`);
  if (url.origin !== DEFAULT_STUDIO && !local) console.warn(`sdd: note: sending to ${url.origin}, not ${DEFAULT_STUDIO}.`);
  return url.origin;
}

async function api(cfg, method, path, body) {
  let url;
  try { url = new URL(cfg.studio); } catch { die(`"studio" in ${CONFIG} is not a URL: ${cfg.studio}`); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) die(`refusing to send your token over ${url.protocol}//; "studio" must be https.`);
  // A config file can be edited by anyone with access to the folder: a key goes to another address only when
  // that address is also given on the command line.
  if (url.origin !== DEFAULT_STUDIO && !local && STUDIO_FLAG !== cfg.studio) {
    die(`${CONFIG} sends to ${url.origin}, not ${DEFAULT_STUDIO}. If that is intended, add --studio ${cfg.studio}`);
  }
  const token = pushToken();
  if (!token && method !== "GET") die("set SDD_PROJECT_TOKEN to your push key, or pass --token-file (Studio → Projects → Developer sandbox → Push tokens).");
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(String(cfg.project))) die(`"project" in ${CONFIG} must be a lowercase slug.`);
  // Rate-limited requests are retried after the time Studio asks for.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${cfg.studio.replace(/\/+$/, "")}/api/v1/projects/${cfg.project}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 20) {
      const wait = Math.min(120, Number(res.headers.get("retry-after")) || 10);
      process.stdout.write(`\n  rate limited; waiting ${wait} s…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
}

// ── commands ──────────────────────────────────────────────────────────────────

function init(args) {
  if (existsSync(CONFIG)) die(`${CONFIG} already exists here.`);
  const cfg = { ...DEFAULT_CONFIG, project: args.project || DEFAULT_CONFIG.project, studio: args.studio || DEFAULT_STUDIO };
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`Wrote ${CONFIG} for project "${cfg.project}". Edit include, exclude and tables to match your folder.`);
  console.log("Then: export SDD_PROJECT_TOKEN=… and run: sdd push --label <iteration-label>");
}

async function push(args) {
  const root = findConfig(process.cwd());
  if (!root) die(`no ${CONFIG} here or in a parent folder. Run "sdd init" in the project folder first.`);
  const cfg = { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(join(root, CONFIG), "utf8")) };
  const label = typeof args.label === "string" ? args.label : "";
  if (!label) die('--label is required, e.g. --label r012-polar-bioisostere');

  const include = cfg.include.map(globRe);
  const exclude = [...ALWAYS_EXCLUDE, ...(cfg.exclude || [])].map(globRe);
  const tableRules = Object.entries(cfg.tables || {}).map(([g, name]) => [globRe(g), name]);
  const scope = typeof args.dir === "string" ? args.dir.replace(/\\/g, "/").replace(/\/+$/, "") + "/" : "";

  const all = walk(root, root, exclude).filter(
    (p) => p !== CONFIG && (!scope || p.startsWith(scope)) && include.some((r) => r.test(p)) && !exclude.some((r) => r.test(p)),
  );
  if (all.length === 0) die(`no files matched include ${JSON.stringify(cfg.include)}${scope ? ` under ${scope}` : ""}.`);
  if (all.length > 2000) die(`${all.length} files matched; at most 2000 per push. Narrow include or use --dir.`);

  const files = [];
  for (const p of all) {
    files.push({ path: p, sha256: await sha256(join(root, p)), size: lstatSync(join(root, p)).size, kind: kindOf(p), sensitivity: cfg.sensitivity });
  }

  const tables = [];
  for (const p of all) {
    const rule = tableRules.find(([re]) => re.test(p));
    if (!rule || !/\.(csv|tsv|txt)$/i.test(p)) continue;
    if (tables.some((t) => t.name === rule[1])) { console.warn(`sdd: skipping ${p}: table "${rule[1]}" already taken by an earlier file in this push.`); continue; }
    const rows = parseDelimited(readFileSync(join(root, p), "utf8"), /\.tsv$/i.test(p) ? "\t" : ",");
    tables.push({ name: rule[1], file: p, rows });
  }

  // Tables too big for one request go in chunks: the push carries the first chunk and the row count,
  // the rest is appended afterwards. Studio checks its own row limits per project.
  const chunkRest = new Map();
  for (const t of tables) {
    if (Buffer.byteLength(JSON.stringify(t.rows)) <= CHUNK_BYTES && t.rows.length <= 5000) continue;
    // The push only declares the table; every row goes in chunks, so several big tables fit in one push.
    chunkRest.set(t.name, { all: t.rows, first: 0 });
    t.expectedRows = t.rows.length;
    t.rows = [];
  }

  const body = {
    label,
    source: args.agent ? "agent" : "cli",
    gitSha: typeof args.git === "string" ? args.git : null,
    summary: typeof args.summary === "string" ? args.summary : null,
    files,
    tables,
  };
  const size = Buffer.byteLength(JSON.stringify(body));
  console.log(`Project ${cfg.project} · ${files.length} files · ${tables.length} tables (${tables.map((t) => `${t.name}: ${t.expectedRows ?? t.rows.length} rows${t.expectedRows ? " in chunks" : ""}`).join(", ") || "none"}) · ${(size / 1e6).toFixed(2)} MB`);
  if (size > MAX_BODY) die("this push is over the 4 MB limit even with chunked tables. Push fewer files or smaller tables.");
  if (args["dry-run"]) {
    for (const f of files) console.log(`  ${f.kind.padEnd(14)} ${f.sha256.slice(0, 12)}  ${f.path}`);
    console.log("Dry run: nothing sent.");
    return;
  }

  const { status, data } = await api(cfg, "POST", "/iterations", body);
  if (!data.ok) die(`Studio refused the push (HTTP ${status}): ${data.error || "unknown error"}`);
  // Where each chunked table stands: a new push starts after the first chunk; a retried push resumes.
  const have = new Map();
  if (data.duplicate) {
    for (const t of data.incomplete ?? []) have.set(t.name, t.have);
    if (!have.size) {
      console.log(`Already in Studio as iteration ${data.iteration} (${data.label}); nothing new to push.`);
      return;
    }
    console.log(`Iteration ${data.iteration} (${data.label}) exists; finishing ${have.size} table(s) that did not finish last time.`);
  } else {
    for (const [name, c] of chunkRest) have.set(name, c.first);
    console.log(`Iteration ${data.iteration} (${data.label}): ${data.newFiles} new, ${data.unchanged} unchanged.`);
  }
  for (const [name, start] of have) {
    const c = chunkRest.get(name);
    if (!c) continue;
    let offset = start;
    for (const chunk of splitRows(c.all.slice(offset))) {
      const r = await api(cfg, "POST", `/iterations/${data.iteration}/rows`, { table: name, offset, rows: chunk });
      if (!r.data.ok) die(`Studio refused rows ${offset}–${offset + chunk.length} of ${name} (HTTP ${r.status}): ${r.data.error || "unknown error"}. Run the same push again to resume.`);
      offset = r.data.have;
      process.stdout.write(`\r  ${name}: ${offset} / ${c.all.length} rows`);
    }
    process.stdout.write("\n");
  }
  if (data.url) console.log(data.url);
}

/** Splits rows into chunks of at most CHUNK_BYTES of JSON and 5,000 rows. */
function splitRows(rows) {
  const out = [];
  let cur = [], bytes = 2;
  for (const r of rows) {
    const b = Buffer.byteLength(JSON.stringify(r)) + 1;
    if (cur.length && (bytes + b > CHUNK_BYTES || cur.length >= 5000)) { out.push(cur); cur = []; bytes = 2; }
    cur.push(r); bytes += b;
  }
  if (cur.length || !out.length) out.push(cur);
  return out;
}

// ── admin (platform owner) ────────────────────────────────────────────────────

async function admin(args) {
  const sub = args._[1];
  const adminToken = process.env.SDD_ADMIN_TOKEN;
  if (!adminToken) die("set SDD_ADMIN_TOKEN to the admin key (the ADMIN_API_TOKEN value set in Vercel).");
  const origin = studioOrigin(typeof args.studio === "string" ? args.studio : DEFAULT_STUDIO);
  const call = async (method, path, body) => {
    const res = await fetch(`${origin}/api/v1/admin${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) die(`HTTP ${res.status}: ${data.error || "admin key missing or not accepted"}`);
    return data;
  };
  const project = typeof args.project === "string" ? args.project : "";
  if (project && !/^[a-z0-9][a-z0-9-]{0,47}$/.test(project)) die("--project must be a lowercase slug.");
  if (sub === "create-project") {
    if (typeof args.slug !== "string" || typeof args.title !== "string") die('usage: sdd admin create-project --slug <slug> --title "<title>" [--description "<text>"]');
    const d = await call("POST", "/projects", { slug: args.slug, title: args.title, description: typeof args.description === "string" ? args.description : undefined });
    console.log(`Created project ${d.project.slug} (${d.project.title}).`);
  } else if (sub === "key") {
    if (!project || (args.scope !== "read" && args.scope !== "push")) die("usage: sdd admin key --project <slug> --scope read|push [--label <text>] [--days 90]");
    const d = await call("POST", `/projects/${project}/keys`, { scope: args.scope, label: typeof args.label === "string" ? args.label : undefined, days: args.days ? Number(args.days) : undefined });
    const dir = join(homedir(), ".sdd", "keys");
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = join(dir, `${project}.${d.scope}.${d.id}.key`);
    writeFileSync(file, d.key + "\n", { mode: 0o600 });
    chmodSync(file, 0o600);
    console.log(`Issued a ${d.scope} key for ${project} (${d.prefix}…, id ${d.id}, expires ${d.expiresAt.slice(0, 10)}).`);
    console.log(`Saved to ${file} (readable only by you). It is not shown here; share it privately.`);
  } else if (sub === "keys") {
    if (!project) die("usage: sdd admin keys --project <slug>");
    const d = await call("GET", `/projects/${project}/keys`);
    for (const k of d.keys) console.log(`  ${k.id}  ${k.prefix}…  ${k.scope.padEnd(4)}  ${(k.label ?? "").padEnd(24)}  ${k.revokedAt ? "revoked " + k.revokedAt.slice(0, 10) : "expires " + k.expiresAt.slice(0, 10)}  last used ${k.lastUsedAt ? k.lastUsedAt.slice(0, 10) : "never"}`);
    if (!d.keys.length) console.log("  no keys");
  } else if (sub === "move-account") {
    // For someone whose SDD sign-in uses a different email from their Studio account.
    if (typeof args.from !== "string" || typeof args.to !== "string") die("usage: sdd admin move-account --from <current email> --to <SDD sign-in email> [--dry-run]");
    const dryRun = args["dry-run"] === true;
    const d = await call("POST", "/accounts/email", { from: args.from, to: args.to, dryRun });
    const c = d.changes;
    console.log(`${dryRun ? "Dry run, nothing written: would move" : "Moved"} the ${d.role} account (${d.status}) from ${d.from} to ${d.to}.`);
    console.log(`  also updated: ${c.invitedBy} invited-by, ${c.approvedBy} approved-by, ${c.invitationsCreated} invitations created, ${c.invitationsAccepted} accepted, ${c.pushTokens} sandbox tokens.`);
  } else if (sub === "revoke") {
    if (!project || typeof args.id !== "string") die("usage: sdd admin revoke --project <slug> --id <key id>");
    await call("DELETE", `/projects/${project}/keys`, { id: args.id });
    console.log(`Revoked key ${args.id}.`);
  } else {
    die("usage: sdd admin create-project | key | keys | revoke | move-account (see the top of sdd.mjs)");
  }
}

async function status() {
  const root = findConfig(process.cwd());
  if (!root) die(`no ${CONFIG} here or in a parent folder.`);
  const cfg = { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(join(root, CONFIG), "utf8")) };
  const { status: code, data } = await api(cfg, "GET", "");
  if (!data.ok) die(`HTTP ${code}: ${data.error || "unknown error"}`);
  console.log(`${data.project.title} (${data.project.slug})`);
  for (const i of data.iterations.slice(0, 10)) console.log(`  #${i.n} ${i.label} · ${i.files} files, ${i.newFiles} new · ${i.createdAt}`);
  if (data.tables.length) console.log(`  tables: ${data.tables.map((t) => `${t.name} (${t.rows} rows, #${t.iteration})`).join(", ")}`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (typeof args["token-file"] === "string") TOKEN_FILE = args["token-file"];
if (typeof args.studio === "string") STUDIO_FLAG = args.studio;
if (cmd === "init") init(args);
else if (cmd === "admin") await admin(args);
else if (cmd === "push") await push(args);
else if (cmd === "status") await status();
else {
  console.log("Usage: sdd init | sdd push --label <label> [--dir <folder>] [--summary <text>] [--git <sha>] [--agent] [--dry-run] [--token-file <file>] | sdd status | sdd admin …");
  process.exit(cmd ? 1 : 0);
}

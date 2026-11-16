#!/usr/bin/env node
// sdd — push a project iteration to SDD Studio.
//
//   sdd init   [--project sandbox] [--studio https://studio.smartdrugdiscovery.org]
//   sdd push   --label r012-polar-bioisostere [--dir Results/r012-polar-bioisostere] [--summary "…"]
//              [--git <sha>] [--agent] [--dry-run]
//   sdd status
//
// Reads sdd.project.json in the current folder (or a parent). The push token comes from the
// SDD_PROJECT_TOKEN environment variable and is never written to disk. File contents are not
// uploaded: Studio receives each file's path, SHA-256, size, kind and sensitivity, plus the summary
// tables the config declares (CSV or TSV). Node 18 or later; no dependencies.

import { createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";

const CONFIG = "sdd.project.json";
const DEFAULT_STUDIO = "https://studio.smartdrugdiscovery.org";
const MAX_BODY = 3_900_000;

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

async function api(cfg, method, path, body) {
  let url;
  try { url = new URL(cfg.studio); } catch { die(`"studio" in ${CONFIG} is not a URL: ${cfg.studio}`); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) die(`refusing to send your token over ${url.protocol}//; "studio" must be https.`);
  if (url.origin !== DEFAULT_STUDIO && !local) console.warn(`sdd: note: sending to ${url.origin}, not ${DEFAULT_STUDIO}.`);
  const token = process.env.SDD_PROJECT_TOKEN;
  if (!token && method !== "GET") die("set SDD_PROJECT_TOKEN to your push token (Studio → Projects → Developer sandbox → Push tokens).");
  const res = await fetch(`${cfg.studio.replace(/\/+$/, "")}/api/v1/projects/${cfg.project}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
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
    if (rows.length > 5000) die(`${p} has ${rows.length} rows; at most 5000. Write a summary table (top rows or aggregates) for Studio.`);
    tables.push({ name: rule[1], file: p, rows });
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
  console.log(`Project ${cfg.project} · ${files.length} files · ${tables.length} tables (${tables.map((t) => `${t.name}: ${t.rows.length} rows`).join(", ") || "none"}) · ${(size / 1e6).toFixed(2)} MB`);
  if (size > MAX_BODY) die("this push is over the 4 MB limit. Push summary tables with fewer rows.");
  if (args["dry-run"]) {
    for (const f of files) console.log(`  ${f.kind.padEnd(14)} ${f.sha256.slice(0, 12)}  ${f.path}`);
    console.log("Dry run: nothing sent.");
    return;
  }

  const { status, data } = await api(cfg, "POST", "/iterations", body);
  if (!data.ok) die(`Studio refused the push (HTTP ${status}): ${data.error || "unknown error"}`);
  if (data.duplicate) {
    console.log(`Already in Studio as iteration ${data.iteration} (${data.label}); nothing new to push.`);
  } else {
    console.log(`Iteration ${data.iteration} (${data.label}): ${data.newFiles} new, ${data.unchanged} unchanged.`);
    console.log(data.url);
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
if (cmd === "init") init(args);
else if (cmd === "push") await push(args);
else if (cmd === "status") await status();
else {
  console.log("Usage: sdd init | sdd push --label <label> [--dir <folder>] [--summary <text>] [--git <sha>] [--agent] [--dry-run] | sdd status");
  process.exit(cmd ? 1 : 0);
}

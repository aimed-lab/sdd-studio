#!/usr/bin/env node
// Page-label check (#28).
//
// 1. Every page route under src/app must either render <DemoDataNotice /> (imported from
//    @/components/data-provenance) or be classified in src/data/page-classes.ts as
//    live, curated, mixed or app. A route classified demo or planned must carry the banner.
// 2. No method-execution claims ("predicts", "identified through", "validated via", ...
//    next to a model name) in src/app or src/components outside files that render the banner.
//
// Usage: node scripts/check-page-classes.mjs   (exit 1 on any failure)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");
const ALLOWED_WITHOUT_BANNER = new Set(["live", "curated", "mixed", "app"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function routeOf(file) {
  const rel = relative(APP, file).split(sep).slice(0, -1); // drop page.tsx
  const segs = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")"))); // route groups
  return "/" + segs.join("/");
}

const hasBanner = (src) =>
  /import\s*\{[^}]*\bDemoDataNotice\b[^}]*\}\s*from\s*["']@\/components\/data-provenance["']/.test(src) &&
  /<DemoDataNotice\b/.test(src);

// page-classes.ts: `"/route": { kind: "x"` (single- or multi-line)
const classesSrc = readFileSync(join(ROOT, "src", "data", "page-classes.ts"), "utf8");
const classes = new Map();
for (const m of classesSrc.matchAll(/"(\/[^"]*)"\s*:\s*\{\s*kind\s*:\s*"(\w+)"/g)) classes.set(m[1], m[2]);

const failures = [];
const pages = walk(APP).filter((f) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(f));
const seen = new Set();

for (const file of pages) {
  const route = routeOf(file);
  seen.add(route);
  const src = readFileSync(file, "utf8");
  const kind = classes.get(route);
  const banner = hasBanner(src);
  const rel = relative(ROOT, file);
  if (!kind && !banner) {
    failures.push(`${rel}: route ${route} has no <DemoDataNotice /> and no entry in src/data/page-classes.ts`);
  } else if (kind && !ALLOWED_WITHOUT_BANNER.has(kind) && !banner) {
    failures.push(`${rel}: route ${route} is classified "${kind}" but does not render <DemoDataNotice />`);
  } else if (kind && !["live", "curated", "demo", "mixed", "planned", "app"].includes(kind)) {
    failures.push(`src/data/page-classes.ts: route ${route} has unknown kind "${kind}"`);
  }
}
for (const route of classes.keys()) {
  if (!seen.has(route)) console.warn(`warning: page-classes.ts lists ${route}, which has no page file`);
}

// ── Method-execution claims ────────────────────────────────────────────────────
const VERB =
  String.raw`\b(?:predicts?|predicted\s+(?:by|with|using)|identified\s+(?:through|by|via|using|with)|validated\s+(?:via|by|through|using|with)|discovered\s+(?:by|via|using|with)|generated\s+by|designed\s+by|confirmed\s+(?:by|via|with))\b`;
const MODEL =
  String.raw`(?:Drug-GPT|Literature Bot|ADMET Predictor|AlphaFold\d?|PETS\b|CPA\b|GeneTerrain|PharmAlchemy|LFM2[\w.-]*|Nach01|DiffDock|Boltz[\w-]*|Chemprop|GNN|graph neural network|transformer|LLM|GPT[\w-]*|Claude|(?:ML|AI|deep[- ]learning|machine[- ]learning|ensemble)\s+models?|machine[- ]learning|deep[- ]learning|neural network|AI agents?|our (?:model|platform|pipeline)|digital twin)`;
const CLAIM = new RegExp(`${VERB}[^\\n]{0,80}?${MODEL}|${MODEL}[^\\n]{0,40}?\\bpredicts?\\b`, "i");

const scanRoots = [APP, join(ROOT, "src", "components")];
for (const root of scanRoots) {
  for (const file of walk(root)) {
    if (!/\.(tsx|ts|jsx|js)$/.test(file)) continue;
    if (file.includes(`${sep}api${sep}`)) continue; // API routes return data, not page copy
    const src = readFileSync(file, "utf8");
    if (hasBanner(src)) continue; // bannered demo/planned content is exempt
    src.split("\n").forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
      const m = line.match(CLAIM);
      if (m) failures.push(`${relative(ROOT, file)}:${i + 1}: method-execution claim outside a bannered file: "${m[0].trim()}"`);
    });
  }
}

if (failures.length) {
  console.error(`Page-label check failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nFix: render <DemoDataNotice /> on illustrative pages, or classify the route in src/data/page-classes.ts as live, curated, mixed or app; reword claims that imply a model was run."
  );
  process.exit(1);
}
console.log(`Page-label check passed: ${pages.length} pages labelled, no method-execution claims outside bannered files.`);

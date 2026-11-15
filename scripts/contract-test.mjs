#!/usr/bin/env node
// Contract test: calls the live read-only API and validates every response against public/openapi.json.
// Fails on drift in either direction: a response field the spec doesn't describe (additionalProperties: false),
// a documented field missing, or a documented parameter the handler rejects. Never asserts absolute counts.
// Usage: BASE_URL=https://studio.smartdrugdiscovery.org node scripts/contract-test.mjs
import { readFileSync } from "node:fs";

const BASE_URL = (process.env.BASE_URL || "https://studio.smartdrugdiscovery.org").replace(/\/+$/, "");
const spec = JSON.parse(readFileSync(new URL("../public/openapi.json", import.meta.url), "utf8"));

const resolve = (ref) => ref.replace(/^#\//, "").split("/").reduce((node, key) => node[key], spec);
const deref = (node) => (node && node.$ref ? deref(resolve(node.$ref)) : node);

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function validate(schema, value, path, errors) {
  schema = deref(schema);
  if (schema.oneOf) {
    const results = schema.oneOf.map((s) => {
      const errs = [];
      validate(s, value, path, errs);
      return errs;
    });
    const passing = results.filter((e) => e.length === 0).length;
    if (passing !== 1) errors.push(`${path}: matched ${passing} of oneOf (first failure: ${results[0][0] ?? "n/a"})`);
    return;
  }
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const ok = allowed.includes(actual) || (actual === "integer" && allowed.includes("number"));
    if (!ok) return errors.push(`${path}: expected ${allowed.join("|")}, got ${actual}`);
  }
  if (value === null) return;
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing required '${key}'`);
    const props = schema.properties ?? {};
    for (const [key, v] of Object.entries(value)) {
      if (props[key]) validate(props[key], v, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: undocumented field '${key}'`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.slice(0, 50).forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors));
  }
}

// Each case: path template, query, expected status. Valid calls use documented example values.
const CASES = [
  { path: "/api/search", query: { q: "imatinib" }, status: 200, nonEmpty: "results" },
  { path: "/api/search", query: { q: "kinase inhibitor", offset: "25", limit: "10" }, status: 200 },
  { path: "/api/search", query: { ids: "CHEMBL941,CHEMBL1" }, status: 200 },
  { path: "/api/search", query: { q: "imatinib", limt: "5" }, status: 400 },
  { path: "/api/search", query: { q: "CC(=O)Oc1ccccc1C(=O)O" }, status: 400 },
  { path: "/api/search", query: { q: "imatinib", limit: "101" }, status: 400 },
  { path: "/api/compound/{chemblId}", params: { chemblId: "CHEMBL941" }, query: {}, status: 200 },
  { path: "/api/compound/{chemblId}", params: { chemblId: "notanid" }, query: {}, status: 400 },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", withExcludedCount: "true" }, status: 200, nonEmpty: "results" },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", disambiguate: "false", phase: "PHASE3", status: "RECRUITING" }, status: 200 },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", fieldsGeneOnly: "true" }, status: 200 },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", view: "excluded" }, status: 200 },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", view: "summary" }, status: 200 },
  { path: "/api/trials", query: { intervention: "osimertinib", location: "Birmingham, Alabama" }, status: 200 },
  { path: "/api/trials", query: { term: "EGFR", pageToken: "__NEXT__" }, status: 200, needsToken: true },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", mode: "drug-aware" }, status: 200, nonEmpty: "results" },
  { path: "/api/trials", query: { term: "EGFR", condition: "non-small cell lung cancer", mode: "drug-aware", view: "summary" }, status: 200 },
  { path: "/api/trials", query: { term: "EGFR", mode: "drug-aware", fieldsGeneOnly: "true" }, status: 400 },
  { path: "/api/trials", query: { term: "EGFR", mode: "fuzzy" }, status: 400 },
  { path: "/api/trials", query: { phase: "PHASE3" }, status: 400 },
  { path: "/api/trials", query: { term: "EGFR", phase: "PHASE9" }, status: 400 },
  { path: "/api/target-evidence", query: { gene: "EGFR" }, status: 200 },
  { path: "/api/target-evidence", query: { gene: "mapt", limit: "5" }, status: 200 },
  { path: "/api/target-evidence", query: { gene: "EGFR;{}" }, status: 400 },
  { path: "/api/target-evidence", query: { gene: "EGFR", limit: "51" }, status: 400 },
  { path: "/api/target-evidence", query: { gene: "NOTAGENE1" }, status: 404 },
];

const failures = [];
const exercised = new Map();
let nextToken = null;

for (const c of CASES) {
  const query = { ...c.query };
  if (c.needsToken) {
    if (!nextToken) {
      failures.push("/api/trials pageToken: no nextPageToken available from an earlier case");
      continue;
    }
    query.pageToken = nextToken;
  }
  const concretePath = c.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(c.params[k]));
  const url = `${BASE_URL}${concretePath}?${new URLSearchParams(query)}`;
  const label = `${c.path} ${JSON.stringify(query)}`;
  let res, body;
  try {
    res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "sdd-contract-test" } });
    body = await res.json();
  } catch (err) {
    failures.push(`${label}: request failed (${err.message})`);
    continue;
  }
  if (res.status === 429) {
    failures.push(`${label}: rate limited (429); rerun later`);
    continue;
  }
  if (res.status !== c.status) {
    failures.push(`${label}: expected HTTP ${c.status}, got ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    continue;
  }
  const op = spec.paths[c.path]?.get;
  if (!op) {
    failures.push(`${c.path}: not in spec`);
    continue;
  }
  const response = deref(op.responses[String(res.status)]);
  const schema = response?.content?.["application/json"]?.schema;
  if (!schema) {
    failures.push(`${label}: HTTP ${res.status} not documented`);
    continue;
  }
  const errors = [];
  validate(schema, body, "$", errors);
  failures.push(...errors.slice(0, 10).map((e) => `${label}: ${e}`));
  if (c.nonEmpty && !(Array.isArray(body[c.nonEmpty]) && body[c.nonEmpty].length > 0)) failures.push(`${label}: '${c.nonEmpty}' is empty`);
  if (c.status === 200 && !body.source?.retrieved) failures.push(`${label}: no provenance (source.retrieved)`);
  if (c.path === "/api/trials" && body.nextPageToken) nextToken = body.nextPageToken;
  if (c.status === 200) {
    const names = exercised.get(c.path) ?? new Set();
    Object.keys(query).forEach((k) => names.add(k));
    Object.keys(c.params ?? {}).forEach((k) => names.add(k));
    exercised.set(c.path, names);
  }
}

// Every documented parameter must have been accepted by the handler at least once.
for (const [path, item] of Object.entries(spec.paths)) {
  for (const p of item.get.parameters ?? []) {
    if (!exercised.get(path)?.has(p.name)) failures.push(`${path}: documented parameter '${p.name}' was never accepted in a 200 case`);
  }
}

if (failures.length) {
  console.error(`Contract test FAILED against ${BASE_URL} (spec ${spec.info.version}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Contract test passed against ${BASE_URL}: ${CASES.length} cases, spec ${spec.info.version}`);

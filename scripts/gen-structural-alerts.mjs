#!/usr/bin/env node
/**
 * Regenerates public/admet/structural-alerts.json — the PAINS and Brenk SMARTS
 * used by the Local ADMET Screener (/services/admet).
 *
 * The patterns are not written by hand. They are taken verbatim from the RDKit
 * FilterCatalog source data at a pinned release tag, which is the same data the
 * compiled RDKit PAINS/Brenk catalogs are built from. RDKit is BSD-3-Clause;
 * the notice travels with the generated file.
 *
 * Published sources for the filter sets themselves:
 *   PAINS  — Baell JB, Holloway GA. J Med Chem 2010;53(7):2719-40.
 *            doi:10.1021/jm901137j (PMID 20131845)
 *   Brenk  — Brenk R, et al. ChemMedChem 2008;3(3):435-44.
 *            doi:10.1002/cmdc.200700139 (PMID 18064617)
 *
 * Usage: node scripts/gen-structural-alerts.mjs [--tag Release_2026_09_1]
 * Needs network access. Run it by hand when bumping the RDKit version; the
 * generated JSON is committed so builds and CI never reach for the network.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_TAG = "Release_2026_09_1";
const tagArg = process.argv.indexOf("--tag");
const TAG = tagArg > -1 ? process.argv[tagArg + 1] : DEFAULT_TAG;
const BASE = `https://raw.githubusercontent.com/rdkit/rdkit/${TAG}/Code/GraphMol/FilterCatalog`;

// Entry counts of the matching compiled RDKit catalogs
// (FilterCatalog.GetNumEntries() for PAINS_A/PAINS_B/PAINS_C/BRENK). The parse
// must reproduce these exactly, or a pattern has been dropped or mis-joined.
const SETS = [
  { file: "pains_a.in", set: "PAINS", subset: "PAINS_A", expect: 16 },
  { file: "pains_b.in", set: "PAINS", subset: "PAINS_B", expect: 55 },
  { file: "pains_c.in", set: "PAINS", subset: "PAINS_C", expect: 409 },
  { file: "brenk.in", set: "Brenk", subset: "BRENK", expect: 105 },
];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Parses a `const FilterData_t NAME[] = { {...}, {...} };` C array.
 *
 * The files are clang-formatted, so an entry may wrap over several lines and a
 * long SMARTS is then split into adjacent C string literals that the compiler
 * concatenates ("[cR2]1[cR2](" "...)"). Line-by-line parsing silently drops
 * those, so walk the text instead: each brace-delimited entry holds the name,
 * the SMARTS in one or more adjacent literals, the minimum count, and a
 * trailing field. The count separates the name+SMARTS strings from the trailer.
 */
function parseFilterData(text, file) {
  const open = text.indexOf("[] = {");
  if (open === -1) throw new Error(`${file}: not a FilterData_t array`);
  const body = text.slice(open + "[] = {".length);

  // No entry contains a brace (SMARTS use brackets and parentheses), so each
  // brace-delimited run is exactly one entry.
  const out = [];
  for (const [, entry] of body.matchAll(/\{([^{}]*)\}/g)) {
    const strings = [...entry.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    // Look for the count only outside the literals — SMARTS are full of digits.
    const counts = [...entry.replace(/"[^"]*"/g, "").matchAll(/\d+/g)].map((m) => Number(m[0]));
    if (strings.length < 3 || counts.length !== 1) {
      throw new Error(`${file}: could not parse entry ${entry.slice(0, 120)}`);
    }
    // name, SMARTS in one or more adjacent literals, then the trailing field.
    const [name, ...rest] = strings;
    const smarts = rest.slice(0, -1).join("");
    if (!name || !smarts) throw new Error(`${file}: empty name or SMARTS in ${entry.slice(0, 120)}`);
    // Every PAINS/Brenk entry is a plain "reject if present" substructure
    // filter. A count threshold would need different semantics than a presence
    // test, so refuse rather than mislabel it.
    if (counts[0] !== 0) throw new Error(`${file}: ${name} has minCount ${counts[0]}, not a presence filter`);
    out.push({ name, smarts });
  }
  return out;
}

const alerts = [];
const perSet = {};

for (const { file, set, subset, expect } of SETS) {
  const parsed = parseFilterData(await fetchText(`${BASE}/${file}`), file);
  if (parsed.length !== expect) {
    console.error(`${file}: parsed ${parsed.length} patterns, expected ${expect} (compiled ${subset} catalog).`);
    process.exit(1);
  }
  // Which form of the molecule a pattern has to be matched against.
  //
  // Most PAINS patterns spell hydrogens out as [#1], so they only match a
  // molecule whose hydrogens are explicit (RDKit's own FilterCatalog gets this
  // by merging query hydrogens into the pattern instead). But adding hydrogens
  // changes the explicit degree of every heavy atom, which breaks patterns
  // written with the D primitive — Brenk's Aliphatic_long_chain
  // ([R0;D2][R0;D2][R0;D2][R0;D2]) is one. No pattern uses both, so each one
  // can simply say which form it needs; verified against RDKit Python over the
  // NCI first_5K set (0 differences in either filter set).
  for (const p of parsed) alerts.push({ ...p, set, subset, explicitH: /\[#1\]/.test(p.smarts) });
  perSet[subset] = parsed.length;
  console.log(`${file}: ${parsed.length} patterns`);
}

const seen = new Map();
for (const a of alerts) {
  const key = `${a.subset}:${a.name}`;
  if (seen.has(key)) {
    console.error(`Duplicate entry ${key}`);
    process.exit(1);
  }
  seen.set(key, a);
}

const payload = {
  provenance: {
    patternsFrom: `RDKit FilterCatalog source data, tag ${TAG} (Code/GraphMol/FilterCatalog/*.in)`,
    patternsUrl: `https://github.com/rdkit/rdkit/tree/${TAG}/Code/GraphMol/FilterCatalog`,
    license: "RDKit is BSD-3-Clause. Copyright (c) 2013-2026 Greg Landrum and the RDKit contributors.",
    generatedBy: "scripts/gen-structural-alerts.mjs",
    sets: {
      PAINS: {
        label: "PAINS (pan-assay interference compounds)",
        citation:
          "Baell JB, Holloway GA. New substructure filters for removal of pan assay interference compounds (PAINS) from screening libraries and for their exclusion in bioassays. J Med Chem. 2010;53(7):2719-40.",
        doi: "10.1021/jm901137j",
        pmid: "20131845",
      },
      Brenk: {
        label: "Brenk unwanted-functionality filters",
        citation:
          "Brenk R, Schipani A, James D, Krasowski A, Gilbert IH, Frearson J, Wyatt PG. Lessons learnt from assembling screening libraries for drug discovery for neglected diseases. ChemMedChem. 2008;3(3):435-44.",
        doi: "10.1002/cmdc.200700139",
        pmid: "18064617",
      },
    },
    counts: perSet,
  },
  alerts,
};

const out = join(process.cwd(), "public", "admet");
await mkdir(out, { recursive: true });
await writeFile(join(out, "structural-alerts.json"), JSON.stringify(payload) + "\n");
console.log(`Wrote public/admet/structural-alerts.json — ${alerts.length} patterns from RDKit ${TAG}.`);

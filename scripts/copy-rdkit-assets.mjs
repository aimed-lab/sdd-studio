#!/usr/bin/env node
/**
 * Copies the RDKit MinimalLib WebAssembly build out of node_modules into
 * public/rdkit/ so the browser can load it from a static URL.
 *
 * The .wasm file is ~7 MB, so it is not committed: this runs before dev and
 * before the build (see "predev"/"prebuild" in package.json) and the copies are
 * git-ignored. @rdkit/rdkit is pinned to an exact version, so the copied files
 * change only when that pin changes.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@rdkit", "rdkit", "dist");
const to = join(root, "public", "rdkit");
const files = ["RDKit_minimal.js", "RDKit_minimal.wasm"];

try {
  await stat(from);
} catch {
  console.error(`RDKit assets missing: ${from} not found. Run npm install first.`);
  process.exit(1);
}

await mkdir(to, { recursive: true });
for (const f of files) {
  await copyFile(join(from, f), join(to, f));
}
console.log(`Copied ${files.join(", ")} to public/rdkit/.`);

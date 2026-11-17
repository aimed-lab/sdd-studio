/**
 * Reads the screener's input: SMILES pasted one per line, or a CSV/TSV file
 * with a SMILES column.
 *
 * Everything runs in the browser, so the caps here exist to keep the page
 * responsive rather than to protect a server.
 */
import type { MoleculeInput } from "@/lib/admet/screen";

/** Screening one structure against all patterns costs roughly 10 ms. */
export const MAX_MOLECULES = 500;
/** Guards against a mis-dropped large file freezing the parse. */
export const MAX_INPUT_CHARS = 2_000_000;
/** Long enough for large natural products, short enough to reject prose. */
export const MAX_SMILES_LENGTH = 600;

export interface SkippedRow {
  line: number;
  text: string;
  reason: string;
}

export interface ParsedInput {
  molecules: MoleculeInput[];
  skipped: SkippedRow[];
  /** True when the input held more than MAX_MOLECULES usable rows. */
  truncated: boolean;
  /** How the input was read, for the note shown above the results. */
  format: "lines" | "table";
  /** Column used for the structure, when a header was recognised. */
  smilesColumn?: string;
  nameColumn?: string;
}

const SMILES_HEADERS = [
  "smiles",
  "canonical_smiles",
  "smiles_canonical",
  "canonicalsmiles",
  "structure",
  "smi",
];
const NAME_HEADERS = [
  "name",
  "compound_id",
  "compound",
  "id",
  "molecule_id",
  "mol_id",
  "chembl_id",
  "title",
  "identifier",
  "label",
];

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_");

/** Splits one delimited line, honouring double quotes. */
function splitRow(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function detectDelimiter(line: string): string {
  const counts = [
    [",", (line.match(/,/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
  ] as const;
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

/** A SMILES string holds no spaces, so a field with one is a name, not a structure. */
const looksLikeSmiles = (s: string) => s.length > 0 && s.length <= MAX_SMILES_LENGTH && !/\s/.test(s);

function rejectReason(smiles: string): string | null {
  if (!smiles) return "No structure in this row";
  if (/\s/.test(smiles)) return "A SMILES string cannot contain spaces";
  if (smiles.length > MAX_SMILES_LENGTH) return `Longer than ${MAX_SMILES_LENGTH} characters`;
  return null;
}

/**
 * Parses pasted text or an uploaded file.
 *
 * With a recognised header row the named SMILES column is used; otherwise each
 * line is read as a structure followed by an optional name. Rows that cannot be
 * read are returned in `skipped` so the page can show what it ignored — nothing
 * is dropped silently.
 */
export function parseInput(raw: string): ParsedInput {
  const text = raw.replace(/^﻿/, "").slice(0, MAX_INPUT_CHARS);
  const lines = text.split(/\r\n|\r|\n/);

  const molecules: MoleculeInput[] = [];
  const skipped: SkippedRow[] = [];
  let truncated = false;

  // Does the first non-blank line name a SMILES column?
  let headerIndex = -1;
  let header: string[] = [];
  let delimiter = ",";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    delimiter = detectDelimiter(line);
    const fields = splitRow(line, delimiter).map(normalise);
    if (fields.some((f) => SMILES_HEADERS.includes(f))) {
      headerIndex = i;
      header = fields;
    }
    break;
  }

  const add = (line: number, smiles: string, name: string, original: string) => {
    if (molecules.length >= MAX_MOLECULES) {
      truncated = true;
      return;
    }
    const reason = rejectReason(smiles);
    if (reason) {
      skipped.push({ line, text: original.slice(0, 120), reason });
      return;
    }
    molecules.push({ line, smiles, name });
  };

  if (headerIndex >= 0) {
    const smilesIdx = header.findIndex((f) => SMILES_HEADERS.includes(f));
    let nameIdx = header.findIndex((f) => NAME_HEADERS.includes(f));
    if (nameIdx === smilesIdx) nameIdx = -1;
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const fields = splitRow(line, delimiter);
      const smiles = (fields[smilesIdx] ?? "").trim();
      const name = nameIdx >= 0 ? (fields[nameIdx] ?? "").trim() : "";
      add(i + 1, smiles, name, line);
      if (truncated) break;
    }
    return {
      molecules,
      skipped,
      truncated,
      format: "table",
      smilesColumn: header[smilesIdx],
      nameColumn: nameIdx >= 0 ? header[nameIdx] : undefined,
    };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // "SMILES<tab|comma>name", or whitespace-separated as in a .smi file.
    let smiles = trimmed;
    let name = "";
    const delimited = /[\t,;]/.test(trimmed)
      ? splitRow(trimmed, detectDelimiter(trimmed))
      : trimmed.split(/\s+/);
    if (delimited.length > 1) {
      const [first, ...rest] = delimited;
      // A leading name with the structure second (e.g. "aspirin, CC(=O)O...").
      if (!looksLikeSmiles(first) && looksLikeSmiles(rest.join(" "))) {
        smiles = rest.join(" ").trim();
        name = first.trim();
      } else {
        smiles = first.trim();
        name = rest.join(" ").trim();
      }
    }
    add(i + 1, smiles, name, line);
    if (truncated) break;
  }

  return { molecules, skipped, truncated, format: "lines" };
}

/** Example structures offered on the page; each one is a well-known drug. */
export const EXAMPLE_INPUT = [
  "# SMILES followed by an optional name",
  "CC(=O)Oc1ccccc1C(=O)O\taspirin",
  "Cn1cnc2c1c(=O)n(C)c(=O)n2C\tcaffeine",
  "Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1\timatinib",
  "O=c1c(O)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12\tquercetin",
  "COc1cc(/C=C/C(=O)CC(=O)/C=C/c2ccc(O)c(OC)c2)ccc1O\tcurcumin",
].join("\n");

import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_CACHE_HEADERS, type Provenance, UpstreamError, UpstreamRejected, badRequest, chemblRelease, fetchUpstream,
  rejectUnknownParams,
} from "@/lib/upstream";

export const maxDuration = 20;

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };
const DOCS_URL =
  "https://chembl.gitbook.io/chembl-interface-documentation/frequently-asked-questions/drug-and-compound-questions";
const DAY = 24 * 60 * 60;

const ALLOWED_PARAMS = ["smiles", "mode", "threshold", "offset", "limit"] as const;
const MAX_SMILES = 200;
const MAX_TOTAL = 100;
const MAX_PAGE = 25;
// More than a single benzene ring (6 atoms), which the panel named as the canonical too-broad query.
const MIN_SUBSTRUCTURE_HEAVY_ATOMS = 7;
// ChEMBL caps substructure counts; a total at this value means "at least this many".
const CHEMBL_SUBSTRUCTURE_CAP = 30000;

const METHOD = {
  similarity:
    "Tanimoto similarity on 2048-bit, radius-2 RDKit Morgan fingerprints (FPSim2), as documented by ChEMBL",
  substructure: "ChEMBL substructure search on the query SMILES",
} as const;

type Mode = keyof typeof METHOD;

interface ChemblHit {
  molecule_chembl_id: string;
  pref_name: string | null;
  similarity?: string | number | null;
  max_phase: string | number | null;
  molecule_hierarchy: { parent_chembl_id: string | null } | null;
  molecule_structures: { canonical_smiles: string | null } | null;
}

/** Cheap structural sanity checks; the browser validates properly with RDKit.js before sending. */
function smilesProblem(smiles: string): string | null {
  if (smiles.length > MAX_SMILES) return `SMILES is too long (max ${MAX_SMILES} characters)`;
  if (!/^[A-Za-z0-9@+\-[\]()=#\\/%.:*]+$/.test(smiles)) return "SMILES contains characters that are not valid in SMILES";
  let depth = 0;
  for (const ch of smiles) {
    if (ch === "(") depth++;
    if (ch === ")" && --depth < 0) return "SMILES has an unmatched closing parenthesis";
  }
  if (depth !== 0) return "SMILES has an unclosed parenthesis";
  if ((smiles.match(/\[/g) ?? []).length !== (smiles.match(/\]/g) ?? []).length) return "SMILES has unbalanced brackets";
  const ringCounts = new Map<string, number>();
  const outsideBrackets = smiles.replace(/\[[^\]]*\]/g, "");
  (outsideBrackets.match(/%\d{2}|\d/g) ?? []).forEach((label) => ringCounts.set(label, (ringCounts.get(label) ?? 0) + 1));
  if (Array.from(ringCounts.values()).some((n) => n % 2 !== 0)) return "SMILES has an unclosed ring";
  return null;
}

/** Approximate heavy-atom count: bracket atoms plus organic-subset symbols outside brackets. */
function heavyAtoms(smiles: string): number {
  const bracketAtoms = (smiles.match(/\[[^\]]*\]/g) ?? []).filter((a) => !/^\[\d*H\d*[+-]?\d*\]$/.test(a)).length;
  const rest = smiles.replace(/\[[^\]]*\]/g, "");
  const organic = rest.match(/Cl|Br|[BCNOSPFI]|[bcnosp]/g) ?? [];
  return bracketAtoms + organic.length;
}

const num = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fail = (state: "invalid_query" | "too_broad" | "timeout" | "upstream_error", error: string, status: number) =>
  NextResponse.json({ results: [], state, error }, { status });

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const unknown = rejectUnknownParams(sp, ALLOWED_PARAMS);
  if (unknown) return unknown;

  const smiles = (sp.get("smiles") ?? "").trim();
  const mode = (sp.get("mode") ?? "similarity").trim().toLowerCase() as Mode;
  const threshold = sp.has("threshold") ? Number(sp.get("threshold")) : 80;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : 0;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : MAX_PAGE;

  if (!smiles) return badRequest("Query parameter 'smiles' is required");
  if (!(mode in METHOD)) return badRequest(`Unknown mode '${mode}'. Allowed: similarity, substructure`);
  if (!Number.isInteger(threshold) || threshold < 70 || threshold > 100) {
    return badRequest("threshold must be an integer from 70 to 100");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) return badRequest(`limit must be an integer from 1 to ${MAX_PAGE}`);
  if (!Number.isInteger(offset) || offset < 0 || offset + limit > MAX_TOTAL) {
    return badRequest(`offset must be an integer ≥ 0, and offset + limit may not exceed ${MAX_TOTAL}`);
  }

  const problem = smilesProblem(smiles);
  if (problem) return fail("invalid_query", problem, 400);

  if (mode === "substructure") {
    const atoms = heavyAtoms(smiles);
    if (atoms < MIN_SUBSTRUCTURE_HEAVY_ATOMS) {
      return fail(
        "too_broad",
        `This substructure has about ${atoms} heavy atoms. Queries need at least ${MIN_SUBSTRUCTURE_HEAVY_ATOMS}, because very small fragments (such as a single benzene ring) match a large part of ChEMBL and can't be searched in reasonable time. Add more of the scaffold, or use similarity search.`,
        400
      );
    }
  }

  const only = "molecule_chembl_id,pref_name,similarity,max_phase,molecule_hierarchy,molecule_structures";
  const encoded = encodeURIComponent(smiles);
  const url =
    mode === "similarity"
      ? `${CHEMBL_API}/similarity/${encoded}/${threshold}.json?limit=${limit}&offset=${offset}&only=${only}`
      : `${CHEMBL_API}/substructure/${encoded}.json?limit=${limit}&offset=${offset}&only=${only}`;
  const timeoutSeconds = mode === "similarity" ? 8 : 15;

  let data: { molecules?: ChemblHit[]; page_meta?: { total_count?: number } };
  let provenance: Provenance;
  try {
    ({ data, provenance } = await fetchUpstream<typeof data>(SOURCE, url, { ttlSeconds: DAY, timeoutMs: timeoutSeconds * 1000 }));
  } catch (err) {
    if (err instanceof UpstreamRejected) {
      return fail("invalid_query", `ChEMBL rejected this structure (HTTP ${err.status}). Check the SMILES.`, 400);
    }
    if (err instanceof UpstreamError && /did not respond/.test(err.message)) {
      return fail(
        "timeout",
        `Search incomplete: ChEMBL did not answer within ${timeoutSeconds} s. This is not "no matches". Try a more specific structure.`,
        504
      );
    }
    if (err instanceof UpstreamError) {
      return fail(
        "upstream_error",
        "ChEMBL returned an error for this search. It may not be able to process this structure, or it may be having problems.",
        502
      );
    }
    throw err;
  }

  const total = data.page_meta?.total_count ?? 0;
  const truncated = mode === "substructure" && total >= CHEMBL_SUBSTRUCTURE_CAP;
  const hits = (data.molecules ?? []).map((m, i) => {
    const parent = m.molecule_hierarchy?.parent_chembl_id ?? null;
    return {
      order: i,
      chemblId: m.molecule_chembl_id,
      parentChemblId: parent,
      isParent: !parent || parent === m.molecule_chembl_id,
      name: m.pref_name ?? m.molecule_chembl_id,
      similarity: mode === "similarity" ? num(m.similarity) : null,
      maxPhase: num(m.max_phase),
      smiles: m.molecule_structures?.canonical_smiles ?? null,
      chemblUrl: `https://www.ebi.ac.uk/chembl/compound_report_card/${m.molecule_chembl_id}/`,
    };
  });
  // Within a page: highest similarity first; among equal scores, parent molecules before salts and named before unnamed.
  hits.sort(
    (a, b) =>
      (b.similarity ?? 0) - (a.similarity ?? 0) ||
      Number(b.isParent) - Number(a.isParent) ||
      Number(b.name !== b.chemblId) - Number(a.name !== a.chemblId) ||
      a.order - b.order
  );

  const release = await chemblRelease();
  return NextResponse.json(
    {
      state: hits.length ? "ok" : "zero_hits",
      query: { smiles, mode, threshold: mode === "similarity" ? threshold : null },
      method: METHOD[mode],
      methodDocs: DOCS_URL,
      results: hits.map(({ order, ...h }) => h),
      total,
      totalIsLowerBound: truncated,
      offset,
      limit,
      maxRetrievable: Math.min(total, MAX_TOTAL),
      source: { ...provenance, ...(release ? { release } : {}) },
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}

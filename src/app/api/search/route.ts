import { NextRequest, NextResponse } from "next/server";
import {
  MAX_QUERY_LENGTH, PUBLIC_CACHE_HEADERS, type Provenance, UpstreamError, badRequest, chemblRelease, fetchUpstream,
  rejectUnknownParams, upstreamErrorResponse,
} from "@/lib/upstream";

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };

interface ChemblMolecule {
  molecule_chembl_id: string;
  pref_name: string | null;
  max_phase: string | number | null;
  molecule_type: string | null;
  molecule_hierarchy: { parent_chembl_id: string | null } | null;
  molecule_structures: { canonical_smiles: string | null; standard_inchi_key: string | null } | null;
  molecule_properties: {
    full_mwt: string | null;
    alogp: string | null;
    hba: number | null;
    hbd: number | null;
    psa: string | null;
    qed_weighted: string | null;
  } | null;
}

const ALLOWED_PARAMS = ["q", "ids", "offset", "limit"] as const;
const MAX_BATCH_IDS = 50;
const CHEMBL_ID = /^CHEMBL\d+$/;
const INCHIKEY = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/;
// Structure strings: no spaces, SMILES characters only, bond/branch/ring syntax or aromatic ring closures,
// and no word-like lowercase runs (so names such as "(R)-warfarin" still go to name search).
const looksLikeSmiles = (q: string) =>
  !/\s/.test(q) &&
  q.length >= 4 &&
  /^[A-Za-z0-9@+\-[\]()=#\\/%.]+$/.test(q) &&
  (/[=#[\]@\\/]/.test(q) || /[cnos]\d/.test(q) || /\(.*[A-Z]/.test(q)) &&
  !(q.match(/[a-z]{3,}/g) ?? []).some((run) => /[^cnosp]/.test(run));

const num = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function mapMolecule(m: ChemblMolecule) {
  const parent = m.molecule_hierarchy?.parent_chembl_id ?? null;
  return {
    chemblId: m.molecule_chembl_id,
    parentChemblId: parent,
    isSalt: !!parent && parent !== m.molecule_chembl_id,
    name: m.pref_name ?? m.molecule_chembl_id,
    smiles: m.molecule_structures?.canonical_smiles ?? null,
    inchiKey: m.molecule_structures?.standard_inchi_key ?? null,
    mw: num(m.molecule_properties?.full_mwt),
    logP: num(m.molecule_properties?.alogp),
    hba: num(m.molecule_properties?.hba),
    hbd: num(m.molecule_properties?.hbd),
    psa: num(m.molecule_properties?.psa),
    qed: num(m.molecule_properties?.qed_weighted),
    maxPhase: num(m.max_phase),
    moleculeType: m.molecule_type ?? "Unknown",
  };
}

async function fetchMolecules(url: string) {
  const [result, release] = await Promise.all([
    fetchUpstream<{ molecules?: ChemblMolecule[]; page_meta?: { total_count?: number } }>(SOURCE, url),
    chemblRelease(),
  ]);
  const provenance: Provenance = release ? { ...result.provenance, release } : result.provenance;
  return { data: result.data, provenance };
}

/** Batch lookup: ?ids=CHEMBL25,CHEMBL941 (≤ 50), rows in request order, unknown IDs listed. */
async function batchLookup(rawIds: string) {
  const ids = Array.from(new Set(rawIds.split(",").map((id) => id.trim().toUpperCase()).filter(Boolean)));
  if (ids.length === 0) return badRequest("ids must list at least one ChEMBL ID");
  if (ids.length > MAX_BATCH_IDS) return badRequest(`At most ${MAX_BATCH_IDS} ids per request`);
  const invalid = ids.filter((id) => !CHEMBL_ID.test(id));
  if (invalid.length) return badRequest(`Not ChEMBL molecule IDs: ${invalid.join(", ")}`);

  let fetched;
  try {
    fetched = await fetchMolecules(
      `${CHEMBL_API}/molecule.json?molecule_chembl_id__in=${ids.join(",")}&limit=${ids.length}`
    );
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
    throw err;
  }
  const byId = new Map((fetched.data.molecules ?? []).map((m) => [m.molecule_chembl_id, m]));
  const found = ids.filter((id) => byId.has(id));
  return NextResponse.json(
    {
      results: found.map((id) => mapMolecule(byId.get(id)!)),
      notFound: ids.filter((id) => !byId.has(id)),
      total: found.length,
      source: fetched.provenance,
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";

  const unknown = rejectUnknownParams(sp, ALLOWED_PARAMS);
  if (unknown) return unknown;

  if (sp.has("ids")) {
    if (sp.has("q") || sp.has("offset") || sp.has("limit")) return badRequest("ids cannot be combined with q, offset or limit");
    return batchLookup(sp.get("ids") ?? "");
  }

  if (!q) return badRequest("Query parameter 'q' (or 'ids') is required");
  if (INCHIKEY.test(q) || looksLikeSmiles(q)) {
    return badRequest(
      "This looks like a chemical structure (SMILES or InChIKey). Structure search isn't supported yet; search by compound name, synonym or ChEMBL ID."
    );
  }
  if (q.length > MAX_QUERY_LENGTH) return badRequest(`Query is too long (max ${MAX_QUERY_LENGTH} characters)`);

  const offset = sp.has("offset") ? Number(sp.get("offset")) : 0;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : 25;
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return badRequest("offset must be an integer from 0 to 10000");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return badRequest("limit must be an integer from 1 to 100");

  const url = CHEMBL_ID.test(q.toUpperCase())
    ? `${CHEMBL_API}/molecule.json?molecule_chembl_id=${encodeURIComponent(q.toUpperCase())}&limit=1`
    : `${CHEMBL_API}/molecule/search.json?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;

  let data: { molecules?: ChemblMolecule[]; page_meta?: { total_count?: number } };
  let provenance: Provenance;
  try {
    ({ data, provenance } = await fetchMolecules(url));
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
    throw err;
  }

  const exact = q.toLowerCase();
  const rank = (m: ChemblMolecule) => {
    const parent = m.molecule_hierarchy?.parent_chembl_id;
    const isParent = !parent || parent === m.molecule_chembl_id;
    return (m.pref_name?.toLowerCase() === exact ? 0 : 2) + (isParent ? 0 : 1);
  };
  // Stable sort: exact name match first, then parent molecules before salts, otherwise ChEMBL's order.
  const molecules = (data.molecules ?? []).map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map(({ m }) => m);
  const results = molecules.map(mapMolecule);

  return NextResponse.json(
    {
      results,
      total: data.page_meta?.total_count ?? results.length,
      offset,
      limit,
      source: provenance,
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}

import { NextRequest, NextResponse } from "next/server";
import {
  MAX_QUERY_LENGTH, type Provenance, UpstreamError, badRequest, fetchUpstream, rejectUnknownParams, upstreamErrorResponse,
} from "@/lib/upstream";

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };

interface ChemblMolecule {
  molecule_chembl_id: string;
  pref_name: string | null;
  max_phase: string | number | null;
  molecule_type: string | null;
  molecule_hierarchy: { parent_chembl_id: string | null } | null;
  molecule_structures: { canonical_smiles: string | null } | null;
  molecule_properties: {
    full_mwt: string | null;
    alogp: string | null;
    hba: number | null;
    hbd: number | null;
    psa: string | null;
    qed_weighted: string | null;
  } | null;
}

const ALLOWED_PARAMS = ["q", "offset", "limit"] as const;
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

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const unknown = rejectUnknownParams(request.nextUrl.searchParams, ALLOWED_PARAMS);
  if (unknown) return unknown;
  if (!q) return badRequest("Query parameter 'q' is required");
  if (INCHIKEY.test(q) || looksLikeSmiles(q)) {
    return badRequest(
      "This looks like a chemical structure (SMILES or InChIKey). Structure search isn't supported yet; search by compound name, synonym or ChEMBL ID."
    );
  }
  if (q.length > MAX_QUERY_LENGTH) return badRequest(`Query is too long (max ${MAX_QUERY_LENGTH} characters)`);

  const sp = request.nextUrl.searchParams;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : 0;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : 25;
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) return badRequest("offset must be an integer from 0 to 10000");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return badRequest("limit must be an integer from 1 to 100");

  const url = /^CHEMBL\d+$/i.test(q)
    ? `${CHEMBL_API}/molecule.json?molecule_chembl_id=${encodeURIComponent(q.toUpperCase())}&limit=1`
    : `${CHEMBL_API}/molecule/search.json?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;

  let data: { molecules?: ChemblMolecule[]; page_meta?: { total_count?: number } };
  let provenance: Provenance;
  try {
    ({ data, provenance } = await fetchUpstream<typeof data>(SOURCE, url));
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

  const results = molecules.map((m) => ({
    chemblId: m.molecule_chembl_id,
    parentChemblId: m.molecule_hierarchy?.parent_chembl_id ?? null,
    name: m.pref_name ?? m.molecule_chembl_id,
    smiles: m.molecule_structures?.canonical_smiles ?? null,
    mw: num(m.molecule_properties?.full_mwt),
    logP: num(m.molecule_properties?.alogp),
    hba: num(m.molecule_properties?.hba),
    hbd: num(m.molecule_properties?.hbd),
    psa: num(m.molecule_properties?.psa),
    qed: num(m.molecule_properties?.qed_weighted),
    maxPhase: num(m.max_phase),
    moleculeType: m.molecule_type ?? "Unknown",
  }));

  return NextResponse.json({
    results,
    total: data.page_meta?.total_count ?? results.length,
    offset,
    limit,
    source: provenance,
  });
}

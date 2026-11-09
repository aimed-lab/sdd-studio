import { NextRequest, NextResponse } from "next/server";
import { MAX_QUERY_LENGTH, type Provenance, UpstreamError, badRequest, fetchUpstream, sourceUnavailable } from "@/lib/upstream";

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };

interface ChemblMolecule {
  molecule_chembl_id: string;
  pref_name: string | null;
  max_phase: string | number | null;
  molecule_type: string | null;
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

const num = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q) return badRequest("Query parameter 'q' is required");
  if (q.length > MAX_QUERY_LENGTH) return badRequest(`Query is too long (max ${MAX_QUERY_LENGTH} characters)`);

  const url = /^CHEMBL\d+$/i.test(q)
    ? `${CHEMBL_API}/molecule.json?molecule_chembl_id=${encodeURIComponent(q.toUpperCase())}&limit=1`
    : `${CHEMBL_API}/molecule/search.json?q=${encodeURIComponent(q)}&limit=25`;

  let data: { molecules?: ChemblMolecule[]; page_meta?: { total_count?: number } };
  let provenance: Provenance;
  try {
    ({ data, provenance } = await fetchUpstream<typeof data>(SOURCE, url));
  } catch (err) {
    if (err instanceof UpstreamError) return sourceUnavailable(SOURCE.name);
    throw err;
  }

  const results = (data.molecules ?? []).map((m) => ({
    chemblId: m.molecule_chembl_id,
    name: m.pref_name ?? m.molecule_chembl_id,
    smiles: m.molecule_structures?.canonical_smiles ?? null,
    mw: num(m.molecule_properties?.full_mwt),
    logP: num(m.molecule_properties?.alogp),
    hba: num(m.molecule_properties?.hba),
    hbd: num(m.molecule_properties?.hbd),
    psa: num(m.molecule_properties?.psa),
    qed: num(m.molecule_properties?.qed_weighted),
    maxPhase: num(m.max_phase) ?? 0,
    moleculeType: m.molecule_type ?? "Unknown",
  }));

  return NextResponse.json({
    results,
    total: data.page_meta?.total_count ?? results.length,
    source: provenance,
  });
}

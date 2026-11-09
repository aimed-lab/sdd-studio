import { NextRequest, NextResponse } from "next/server";

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";

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

  if (!q) {
    return NextResponse.json({ results: [], error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const url = /^CHEMBL\d+$/i.test(q)
    ? `${CHEMBL_API}/molecule.json?molecule_chembl_id=${encodeURIComponent(q.toUpperCase())}&limit=1`
    : `${CHEMBL_API}/molecule/search.json?q=${encodeURIComponent(q)}&limit=25`;

  let data: { molecules?: ChemblMolecule[]; page_meta?: { total_count?: number } };
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`ChEMBL responded ${res.status}`);
    data = await res.json();
  } catch {
    return NextResponse.json(
      { results: [], error: "ChEMBL is unavailable right now. Please try again shortly." },
      { status: 502 }
    );
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
    source: { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/", retrieved: new Date().toISOString() },
  });
}

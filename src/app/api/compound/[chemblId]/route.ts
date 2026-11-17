import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_CACHE_HEADERS, type Provenance, UpstreamError, badRequest, chemblRelease, fetchUpstream, rejectUnknownParams,
  upstreamErrorResponse,
} from "@/lib/upstream";

export const maxDuration = 20;

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };
const ACTIVITY_LIMIT = 50;
const TIMEOUT_MS = 6000;

interface Mechanism {
  molecule_chembl_id: string;
  target_chembl_id: string | null;
  action_type: string | null;
  mechanism_of_action: string | null;
  mechanism_refs: { ref_type: string | null; ref_id: string | null; ref_url: string | null }[] | null;
}

interface Activity {
  activity_id: number;
  molecule_chembl_id: string;
  target_chembl_id: string | null;
  target_pref_name: string | null;
  target_organism: string | null;
  standard_type: string | null;
  standard_relation: string | null;
  standard_value: string | null;
  standard_units: string | null;
  pchembl_value: string | null;
  assay_chembl_id: string | null;
  assay_type: string | null;
  document_chembl_id: string | null;
}

type Page<K extends string, T> = { [key in K]?: T[] } & { page_meta?: { total_count?: number } };

const get = <T,>(url: string) => fetchUpstream<T>(SOURCE, url, { ttlSeconds: 24 * 60 * 60, timeoutMs: TIMEOUT_MS });

/**
 * Mechanism of action and bioactivity for a ChEMBL molecule, resolved through its parent
 * (mechanisms are often stored on the salt record, e.g. sorafenib tosylate CHEMBL1200485).
 * Each section succeeds or fails on its own.
 */
export async function GET(request: NextRequest, { params }: { params: { chemblId: string } }) {
  const unknown = rejectUnknownParams(request.nextUrl.searchParams, []);
  if (unknown) return unknown;
  const id = params.chemblId.toUpperCase();
  if (!/^CHEMBL\d+$/.test(id)) return badRequest("Expected a ChEMBL molecule ID such as CHEMBL1336");

  let parentId: string;
  let moleculeProvenance: Provenance;
  try {
    const { data, provenance } = await get<{
      molecules?: { molecule_chembl_id: string; molecule_hierarchy: { parent_chembl_id: string | null } | null }[];
    }>(`${CHEMBL_API}/molecule.json?molecule_chembl_id=${id}&limit=1`);
    const molecule = data.molecules?.[0];
    if (!molecule) return NextResponse.json({ error: `${id} was not found in ChEMBL` }, { status: 404 });
    parentId = molecule.molecule_hierarchy?.parent_chembl_id ?? id;
    moleculeProvenance = provenance;
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
    throw err;
  }

  const activityBase = `${CHEMBL_API}/activity.json?parent_molecule_chembl_id=${parentId}&pchembl_value__isnull=false`;
  const [mechanisms, activities, flagged, release] = await Promise.allSettled([
    get<Page<"mechanisms", Mechanism>>(`${CHEMBL_API}/mechanism.json?parent_molecule_chembl_id=${parentId}&limit=50`),
    get<Page<"activities", Activity>>(
      `${activityBase}&data_validity_comment__isnull=true&order_by=activity_id&limit=${ACTIVITY_LIMIT}`
    ),
    get<Page<"activities", Activity>>(`${activityBase}&data_validity_comment__isnull=false&limit=1`),
    chemblRelease(),
  ]);

  // Mechanism rows carry only target IDs, so resolve names in one batched call.
  const mechRows = mechanisms.status === "fulfilled" ? mechanisms.value.data.mechanisms ?? [] : [];
  const targetIds = Array.from(new Set(mechRows.map((m) => m.target_chembl_id).filter((t): t is string => !!t)));
  const targetNames = new Map<string, { name: string | null; organism: string | null }>();
  if (targetIds.length) {
    try {
      const { data } = await get<Page<"targets", { target_chembl_id: string; pref_name: string | null; organism: string | null }>>(
        `${CHEMBL_API}/target.json?target_chembl_id__in=${targetIds.join(",")}&limit=${targetIds.length}`
      );
      for (const t of data.targets ?? []) targetNames.set(t.target_chembl_id, { name: t.pref_name, organism: t.organism });
    } catch {
      // Names are optional; the target IDs still link to ChEMBL.
    }
  }

  const sectionError = (r: PromiseSettledResult<unknown>) =>
    r.status === "rejected"
      ? r.reason instanceof UpstreamError
        ? r.reason.message
        : "ChEMBL did not respond"
      : null;

  const activityTotal = activities.status === "fulfilled" ? activities.value.data.page_meta?.total_count ?? 0 : null;
  const activityRows = activities.status === "fulfilled" ? activities.value.data.activities ?? [] : [];

  return NextResponse.json(
    {
      chemblId: id,
      parentChemblId: parentId,
      mechanisms: {
        error: sectionError(mechanisms),
        rows: mechRows.map((m) => ({
          recordChemblId: m.molecule_chembl_id,
          mechanism: m.mechanism_of_action,
          actionType: m.action_type,
          targetChemblId: m.target_chembl_id,
          targetName: m.target_chembl_id ? targetNames.get(m.target_chembl_id)?.name ?? null : null,
          targetOrganism: m.target_chembl_id ? targetNames.get(m.target_chembl_id)?.organism ?? null : null,
          refs: (m.mechanism_refs ?? []).map((r) => ({ type: r.ref_type, id: r.ref_id, url: r.ref_url })),
        })),
      },
      activities: {
        error: sectionError(activities),
        total: activityTotal,
        shown: activityRows.length,
        flaggedExcluded:
          flagged.status === "fulfilled" ? flagged.value.data.page_meta?.total_count ?? 0 : null,
        selection:
          "Activities with a pChEMBL value and no ChEMBL data-validity flag, in ChEMBL record order (activity_id) — not ranked by potency and not a selectivity profile.",
        fullRecordUrl: `https://www.ebi.ac.uk/chembl/compound_report_card/${parentId}/`,
        rows: activityRows.map((a) => ({
          activityId: a.activity_id,
          targetChemblId: a.target_chembl_id,
          targetName: a.target_pref_name,
          targetOrganism: a.target_organism,
          type: a.standard_type,
          relation: a.standard_relation,
          value: a.standard_value,
          units: a.standard_units,
          pchembl: a.pchembl_value,
          assayChemblId: a.assay_chembl_id,
          assayType: a.assay_type,
          documentChemblId: a.document_chembl_id,
        })),
      },
      source: release.status === "fulfilled" && release.value ? { ...moleculeProvenance, release: release.value } : moleculeProvenance,
    },
    { headers: PUBLIC_CACHE_HEADERS }
  );
}

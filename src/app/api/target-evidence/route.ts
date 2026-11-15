import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_CACHE_HEADERS, UpstreamError, badRequest, fetchUpstream, rejectUnknownParams, upstreamErrorResponse,
} from "@/lib/upstream";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const OT_GRAPHQL = "https://api.platform.opentargets.org/api/v4/graphql";
const SOURCE = { name: "Open Targets Platform", url: "https://platform.opentargets.org/" };
const DAY = 24 * 60 * 60;
const TIMEOUT_MS = 6000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/** Gene symbol: letters, digits and hyphens (e.g. EGFR, HLA-A, C1orf112). Matched case-insensitively. */
const GENE_RE = /^[A-Za-z][A-Za-z0-9-]{0,19}$/;

const NOT_PREDICTIONS_NOTE =
  "Association scores and tractability buckets are Open Targets' own metrics, reported as published; they are not predictions by this site.";

// Fixed queries. Only typed variables are sent; client text never becomes query text.
const RESOLVE_QUERY = `query ResolveTarget($q: String!) {
  search(queryString: $q, entityNames: ["target"], page: { index: 0, size: 10 }) {
    hits { id entity object { ... on Target { approvedSymbol } } }
  }
}`;

const EVIDENCE_QUERY = `query TargetEvidence($ensemblId: String!, $size: Int!) {
  target(ensemblId: $ensemblId) {
    id
    approvedSymbol
    approvedName
    tractability { label modality value }
    associatedDiseases(page: { index: 0, size: $size }) {
      count
      rows { disease { id name } score datatypeScores { id score } }
    }
    drugAndClinicalCandidates { count }
  }
  meta { dataVersion { year month } }
}`;

const MODALITIES: Record<string, string> = {
  SM: "Small molecule",
  AB: "Antibody",
  PR: "PROTAC",
  OC: "Other modalities",
};

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

interface ResolveData {
  search: { hits: { id: string; entity: string; object: { approvedSymbol?: string } | null }[] } | null;
}

interface EvidenceData {
  target: {
    id: string;
    approvedSymbol: string;
    approvedName: string | null;
    tractability: { label: string; modality: string; value: boolean }[] | null;
    associatedDiseases: {
      count: number;
      rows: { disease: { id: string; name: string }; score: number; datatypeScores: { id: string; score: number }[] }[];
    };
    drugAndClinicalCandidates: { count: number } | null;
  } | null;
  meta: { dataVersion: { year: string; month: string } | null } | null;
}

async function graphql<T>(query: string, variables: Record<string, unknown>) {
  const { data, provenance } = await fetchUpstream<GraphQLResponse<T>>(SOURCE, OT_GRAPHQL, {
    ttlSeconds: DAY,
    timeoutMs: TIMEOUT_MS,
    jsonBody: { query, variables },
  });
  // The queries are fixed, so a GraphQL error means the upstream schema changed: an upstream fault, not a bad request.
  if (data.errors?.length || !data.data) throw new UpstreamError(`${SOURCE.name} returned a GraphQL error`);
  return { data: data.data, provenance };
}

/**
 * Open Targets evidence for one gene: top disease associations (overall and per-datatype scores),
 * tractability per modality, and the count of drug and clinical-candidate records.
 * Values are passed through as Open Targets reports them; nothing is re-scored here.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const unknown = rejectUnknownParams(params, ["gene", "limit"]);
  if (unknown) return unknown;

  const gene = (params.get("gene") ?? "").trim();
  if (!GENE_RE.test(gene)) return badRequest("Expected a gene symbol such as EGFR (letters, digits and hyphens, at most 20 characters)");

  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit) || +rawLimit < 1 || +rawLimit > MAX_LIMIT) {
      return badRequest(`limit must be an integer from 1 to ${MAX_LIMIT}`);
    }
    limit = +rawLimit;
  }

  try {
    const resolved = await graphql<ResolveData>(RESOLVE_QUERY, { q: gene });
    const hit = resolved.data.search?.hits.find(
      (h) => h.entity === "target" && h.object?.approvedSymbol?.toUpperCase() === gene.toUpperCase()
    );
    if (!hit) {
      return NextResponse.json(
        { error: `${gene} is not an approved gene symbol in Open Targets. Aliases are not resolved; use the HGNC symbol.` },
        { status: 404 }
      );
    }

    const { data, provenance } = await graphql<EvidenceData>(EVIDENCE_QUERY, { ensemblId: hit.id, size: limit });
    const t = data.target;
    if (!t) return NextResponse.json({ error: `${hit.id} was not found in Open Targets` }, { status: 404 });

    const dv = data.meta?.dataVersion;
    const tractability = Object.entries(MODALITIES).map(([code, label]) => ({
      modality: code,
      modalityLabel: label,
      evidence: (t.tractability ?? []).filter((e) => e.modality === code).map((e) => ({ label: e.label, value: e.value })),
    }));

    return NextResponse.json(
      {
        gene: t.approvedSymbol,
        ensemblId: t.id,
        approvedName: t.approvedName,
        openTargetsUrl: `https://platform.opentargets.org/target/${t.id}`,
        associations: {
          total: t.associatedDiseases.count,
          limit,
          rows: t.associatedDiseases.rows.map((r) => ({
            diseaseId: r.disease.id,
            diseaseName: r.disease.name,
            score: r.score,
            datatypeScores: r.datatypeScores.map((d) => ({ datatype: d.id, score: d.score })),
          })),
        },
        tractability,
        drugAndClinicalCandidates: t.drugAndClinicalCandidates?.count ?? null,
        note: NOT_PREDICTIONS_NOTE,
        source: { ...provenance, ...(dv ? { release: { version: `${dv.year}.${dv.month}`, date: null } } : {}) },
      },
      { headers: PUBLIC_CACHE_HEADERS }
    );
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
    throw err;
  }
}

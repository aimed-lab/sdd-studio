import { NextRequest, NextResponse } from "next/server";
import { MAX_QUERY_LENGTH, type Provenance, UpstreamError, badRequest, fetchUpstream, sourceUnavailable } from "@/lib/upstream";

const CTGOV_API = "https://clinicaltrials.gov/api/v2/studies";
const SOURCE = { name: "ClinicalTrials.gov API v2", url: "https://clinicaltrials.gov/" };

const TRIAL_PHASES = ["EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4", "NA"] as const;
const TRIAL_STATUSES = [
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "ENROLLING_BY_INVITATION",
  "COMPLETED",
  "TERMINATED",
  "WITHDRAWN",
  "SUSPENDED",
] as const;

const FIELDS = [
  "NCTId",
  "BriefTitle",
  "Phase",
  "OverallStatus",
  "LeadSponsorName",
  "Condition",
  "InterventionName",
  "StartDate",
  "EnrollmentCount",
].join(",");

interface CtgovStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    conditionsModule?: { conditions?: string[] };
    designModule?: { phases?: string[]; enrollmentInfo?: { count?: number } };
    armsInterventionsModule?: { interventions?: { name?: string }[] };
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const term = sp.get("term")?.trim() ?? "";
  const condition = sp.get("condition")?.trim() ?? "";
  const phase = sp.get("phase") ?? "";
  const status = sp.get("status") ?? "";
  const pageToken = sp.get("pageToken") ?? "";

  if (!term) return badRequest("Query parameter 'term' is required");
  if (term.length > MAX_QUERY_LENGTH || condition.length > MAX_QUERY_LENGTH)
    return badRequest(`Query is too long (max ${MAX_QUERY_LENGTH} characters)`);
  if (phase && !(TRIAL_PHASES as readonly string[]).includes(phase)) return badRequest(`Unknown phase '${phase}'`);
  if (status && !(TRIAL_STATUSES as readonly string[]).includes(status)) return badRequest(`Unknown status '${status}'`);
  if (pageToken && !/^[A-Za-z0-9_-]{1,200}$/.test(pageToken)) return badRequest("Invalid page token");

  const params = new URLSearchParams({ "query.term": term, pageSize: "25", countTotal: "true", fields: FIELDS });
  if (condition) params.set("query.cond", condition);
  if (status) params.set("filter.overallStatus", status);
  if (phase) params.set("filter.advanced", `AREA[Phase]${phase}`);
  if (pageToken) params.set("pageToken", pageToken);

  let data: { studies?: CtgovStudy[]; totalCount?: number; nextPageToken?: string };
  let provenance: Provenance;
  try {
    ({ data, provenance } = await fetchUpstream<typeof data>(SOURCE, `${CTGOV_API}?${params}`));
  } catch (err) {
    if (err instanceof UpstreamError) return sourceUnavailable(SOURCE.name);
    throw err;
  }

  const results = (data.studies ?? []).map((s) => {
    const p = s.protocolSection ?? {};
    return {
      nctId: p.identificationModule?.nctId ?? "",
      title: p.identificationModule?.briefTitle ?? "",
      phases: p.designModule?.phases ?? [],
      status: p.statusModule?.overallStatus ?? "",
      sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
      conditions: p.conditionsModule?.conditions ?? [],
      interventions: (p.armsInterventionsModule?.interventions ?? []).map((i) => i.name ?? "").filter(Boolean),
      startDate: p.statusModule?.startDateStruct?.date ?? "",
      enrollment: p.designModule?.enrollmentInfo?.count ?? null,
    };
  });

  return NextResponse.json({
    results,
    total: data.totalCount ?? results.length,
    nextPageToken: data.nextPageToken ?? null,
    source: provenance,
  });
}

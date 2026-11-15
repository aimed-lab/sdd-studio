import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import { findAmbiguousSymbol, mentionsToken } from "@/data/ambiguous-symbols";
import {
  MAX_QUERY_LENGTH, PUBLIC_CACHE_HEADERS, type Provenance, UpstreamError, badRequest, ctgovRelease, fetchUpstream,
  rejectUnknownParams, upstreamErrorResponse,
} from "@/lib/upstream";
import { type TargetDrugs, approvedDrugsForTarget, drugsQuery } from "@/lib/target-drugs";

export const maxDuration = 25;

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
const VIEWS = ["results", "excluded", "summary"] as const;
const MODES = ["default", "drug-aware"] as const;
const ALLOWED_PARAMS = [
  "term", "condition", "intervention", "location", "phase", "status", "pageToken",
  "disambiguate", "fieldsGeneOnly", "withExcludedCount", "view", "mode",
] as const;

const FIELDS = [
  "NCTId",
  "BriefTitle",
  "OfficialTitle",
  "Phase",
  "OverallStatus",
  "LeadSponsorName",
  "Condition",
  "Keyword",
  "InterventionName",
  "InterventionType",
  "StartDate",
  "LastUpdatePostDate",
  "EnrollmentCount",
].join(",");
const SUMMARY_FIELDS = ["NCTId", "Phase", "OverallStatus", "LeadSponsorName"].join(",");
const SUMMARY_MAX = 1000;
const NCT_ID = /^NCT\d{8}$/;
const SINGLE_TOKEN = /^[A-Za-z0-9-]{2,15}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

interface CtgovStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string; officialTitle?: string };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    conditionsModule?: { conditions?: string[]; keywords?: string[] };
    designModule?: { phases?: string[]; enrollmentInfo?: { count?: number } };
    armsInterventionsModule?: { interventions?: { name?: string; type?: string }[] };
  };
}

type CtgovResponse = { studies?: CtgovStudy[]; totalCount?: number; nextPageToken?: string };

const flag = (sp: URLSearchParams, key: string, fallback: boolean) => {
  const v = sp.get(key);
  if (v === null || v === "") return fallback;
  return v.toLowerCase() === "true";
};

let killSwitch: { value: boolean; at: number } | null = null;
/** Runtime kill switch (platform_settings.trials_excluded_count = "off"); defaults to on if unreadable. */
async function excludedCountEnabled(): Promise<boolean> {
  if (killSwitch && Date.now() - killSwitch.at < 60_000) return killSwitch.value;
  let value = true;
  try {
    value = (await getSetting("trials_excluded_count")) !== "off";
  } catch {
    value = true;
  }
  killSwitch = { value, at: Date.now() };
  return value;
}

function phaseBucket(phases: string[]): string {
  return phases.length ? phases.join("/") : "Not specified";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const unknown = rejectUnknownParams(sp, ALLOWED_PARAMS);
  if (unknown) return unknown;

  const term = sp.get("term")?.trim() ?? "";
  const condition = sp.get("condition")?.trim() ?? "";
  const intervention = sp.get("intervention")?.trim() ?? "";
  const location = sp.get("location")?.trim() ?? "";
  const phase = (sp.get("phase") ?? "").trim().toUpperCase();
  const status = (sp.get("status") ?? "").trim().toUpperCase();
  const pageToken = sp.get("pageToken") ?? "";
  const view = (sp.get("view") ?? "results").trim().toLowerCase();
  const mode = (sp.get("mode") ?? "default").trim().toLowerCase();
  const disambiguate = flag(sp, "disambiguate", true);
  const fieldsGeneOnly = flag(sp, "fieldsGeneOnly", false);
  const withExcludedCount = flag(sp, "withExcludedCount", false);

  const texts = { term, condition, intervention, location };
  if (!term && !condition && !intervention && !location)
    return badRequest("Provide at least one of 'term', 'condition', 'intervention' or 'location'");
  for (const [name, value] of Object.entries(texts)) {
    if (value.length > MAX_QUERY_LENGTH) return badRequest(`'${name}' is too long (max ${MAX_QUERY_LENGTH} characters)`);
    if (CONTROL_CHARS.test(value)) return badRequest(`'${name}' contains control characters`);
  }
  if (phase && !(TRIAL_PHASES as readonly string[]).includes(phase))
    return badRequest(`Unknown phase '${phase}'. Allowed: ${TRIAL_PHASES.join(", ")}`);
  if (status && !(TRIAL_STATUSES as readonly string[]).includes(status))
    return badRequest(`Unknown status '${status}'. Allowed: ${TRIAL_STATUSES.join(", ")}`);
  if (!(VIEWS as readonly string[]).includes(view)) return badRequest(`Unknown view '${view}'. Allowed: ${VIEWS.join(", ")}`);
  if (pageToken && !/^[A-Za-z0-9_-]{1,200}$/.test(pageToken)) return badRequest("Invalid page token");
  if (fieldsGeneOnly && !SINGLE_TOKEN.test(term))
    return badRequest("'fieldsGeneOnly' needs 'term' to be a single gene symbol (letters, digits, hyphen)");
  if (!(MODES as readonly string[]).includes(mode)) return badRequest(`Unknown mode '${mode}'. Allowed: ${MODES.join(", ")}`);
  const drugMode = mode === "drug-aware";
  if (drugMode && !SINGLE_TOKEN.test(term))
    return badRequest("'mode=drug-aware' needs 'term' to be a single gene symbol (letters, digits, hyphen)");
  if (drugMode && fieldsGeneOnly) return badRequest("'mode=drug-aware' cannot be combined with 'fieldsGeneOnly'");
  if (drugMode && view === "excluded") return badRequest("'view=excluded' is not available with 'mode=drug-aware'");

  // Disambiguation (#57): applied by default, never together with the field restriction.
  const ambiguous = term && !fieldsGeneOnly ? findAmbiguousSymbol(term) : null;
  const applied = !!ambiguous && disambiguate;
  if (view === "excluded" && !applied) return badRequest("'view=excluded' needs a term with an active disambiguation");

  let queryTerm = term;
  if (fieldsGeneOnly) {
    queryTerm = ["Condition", "Keyword", "InterventionName", "BriefTitle", "OfficialTitle"]
      .map((area) => `AREA[${area}]${term}`)
      .join(" OR ");
  } else if (applied && ambiguous) {
    queryTerm = view === "excluded" ? `(${term}) AND ${ambiguous.exclude}` : `(${term}) NOT ${ambiguous.exclude}`;
  }

  // Drug-aware mode (#57 option c): OR the gene query with approved drugs that act on it, per ChEMBL.
  // The default query is kept intact inside the OR, so this mode can only add trials, never lose them.
  let drugAware: (Omit<TargetDrugs, "symbol"> & { applied: boolean; note: string | null; queryTerm: string }) | null = null;
  if (drugMode) {
    let found: TargetDrugs | null = null;
    let note: string | null = null;
    try {
      found = await approvedDrugsForTarget(term);
      if (!found.targets.length) note = `ChEMBL has no human single-protein target named ${term}; searched the gene term only.`;
      else if (!found.drugs.length) note = `ChEMBL lists no approved drugs acting on ${term}; searched the gene term only.`;
    } catch {
      note = "ChEMBL could not be reached, so drug names were not added; searched the gene term only.";
    }
    const drugs = found?.drugs ?? [];
    if (drugs.length) queryTerm = `(${queryTerm}) OR (${drugsQuery(drugs)})`;
    drugAware = {
      applied: drugs.length > 0,
      note,
      queryTerm,
      targets: found?.targets ?? [],
      drugs,
      omitted: found?.omitted ?? [],
      selection: found?.selection ?? "",
      source: found?.source ?? { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/", queryUrl: "", retrieved: new Date().toISOString(), cacheTtlSeconds: 0 },
    };
  }

  const base = new URLSearchParams({ countTotal: "true" });
  if (queryTerm) base.set("query.term", queryTerm);
  if (condition) base.set("query.cond", condition);
  if (intervention) base.set("query.intr", intervention);
  if (location) base.set("query.locn", location);
  if (status) base.set("filter.overallStatus", status);
  if (phase) base.set("filter.advanced", `AREA[Phase]${phase}`);

  const query = { term, condition, intervention, location, phase, status, disambiguate, fieldsGeneOnly, mode };
  const disambiguation = ambiguous
    ? { symbol: ambiguous.symbol, exclude: ambiguous.exclude, reason: ambiguous.reason, applied, queryTerm }
    : null;

  // Landscape summary (#67): exact counts up to SUMMARY_MAX, otherwise labelled as a relevance-ordered sample.
  if (view === "summary") {
    const params = new URLSearchParams(base);
    params.set("pageSize", String(SUMMARY_MAX));
    params.set("fields", SUMMARY_FIELDS);
    let data: CtgovResponse;
    let provenance: Provenance;
    try {
      const [fetched, release] = await Promise.all([
        fetchUpstream<CtgovResponse>(SOURCE, `${CTGOV_API}?${params}`, { timeoutMs: 15000 }),
        ctgovRelease(),
      ]);
      data = fetched.data;
      provenance = release ? { ...fetched.provenance, release } : fetched.provenance;
    } catch (err) {
      if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
      throw err;
    }
    const studies = data.studies ?? [];
    const total = data.totalCount ?? studies.length;
    const count = (values: string[]) =>
      Object.entries(values.reduce<Record<string, number>>((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {}))
        .sort((a, b) => b[1] - a[1])
        .map(([label, n]) => ({ label, n }));
    const sponsors = count(studies.map((s) => s.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name || "Not specified"));
    const top = sponsors.slice(0, 10);
    const otherN = sponsors.slice(10).reduce((sum, s) => sum + s.n, 0);
    return NextResponse.json({
      query,
      disambiguation,
      drugAware,
      total,
      counted: studies.length,
      exact: studies.length >= total,
      note:
        studies.length >= total
          ? `Exact counts for all ${total} trials`
          : `First ${studies.length} of ${total} trials by relevance — not representative of the whole set`,
      byPhase: count(studies.map((s) => phaseBucket(s.protocolSection?.designModule?.phases ?? []))),
      byStatus: count(studies.map((s) => s.protocolSection?.statusModule?.overallStatus || "Not specified")),
      bySponsor: otherN ? [...top, { label: "Other sponsors", n: otherN }] : top,
      source: provenance,
    }, { headers: PUBLIC_CACHE_HEADERS });
  }

  const params = new URLSearchParams(base);
  params.set("pageSize", "25");
  params.set("fields", FIELDS);
  if (pageToken) params.set("pageToken", pageToken);

  let data: CtgovResponse;
  let provenance: Provenance;
  try {
    const [fetched, release] = await Promise.all([
      fetchUpstream<CtgovResponse>(SOURCE, `${CTGOV_API}?${params}`),
      ctgovRelease(),
    ]);
    data = fetched.data;
    provenance = release ? { ...fetched.provenance, release } : fetched.provenance;
  } catch (err) {
    if (err instanceof UpstreamError) return upstreamErrorResponse(err, SOURCE.name);
    throw err;
  }

  const annotate = SINGLE_TOKEN.test(term) && !fieldsGeneOnly;
  const rows = (data.studies ?? []).map((s) => {
    const p = s.protocolSection ?? {};
    const nctId = p.identificationModule?.nctId ?? "";
    const interventionDetails = (p.armsInterventionsModule?.interventions ?? [])
      .map((i) => ({ name: i.name ?? "", type: i.type ?? "" }))
      .filter((i) => i.name);
    const conditions = p.conditionsModule?.conditions ?? [];
    const keywords = p.conditionsModule?.keywords ?? [];
    const title = p.identificationModule?.briefTitle ?? "";
    const officialTitle = p.identificationModule?.officialTitle ?? "";
    const names = [term, ...(ambiguous?.synonyms ?? findAmbiguousSymbol(term)?.synonyms ?? [])];
    const texts = [title, officialTitle, ...conditions, ...keywords, ...interventionDetails.map((i) => i.name)];
    const direct = texts.some((text) => names.some((name) => mentionsToken(text, name)));
    // Trials without a direct gene mention are tagged with the added drug(s) named in their record.
    const viaDrug = drugAware?.applied && !direct
      ? drugAware.drugs.map((d) => d.name).filter((name) => texts.some((text) => mentionsToken(text, name)))
      : [];
    let symbolMatch: "direct" | "via_drug" | "eligibility_or_outcome_only" | null = null;
    if (annotate) symbolMatch = direct ? "direct" : viaDrug.length ? "via_drug" : "eligibility_or_outcome_only";
    return {
      nctId,
      url: NCT_ID.test(nctId) ? `https://clinicaltrials.gov/study/${nctId}` : null,
      title,
      phases: p.designModule?.phases ?? [],
      status: p.statusModule?.overallStatus ?? "",
      sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
      conditions,
      keywords,
      interventions: interventionDetails.map((i) => i.name),
      interventionDetails,
      startDate: p.statusModule?.startDateStruct?.date ?? "",
      lastUpdate: p.statusModule?.lastUpdatePostDateStruct?.date ?? "",
      enrollment: p.designModule?.enrollmentInfo?.count ?? null,
      symbolMatch,
      viaDrug: drugAware ? (viaDrug.length ? viaDrug : null) : undefined,
    };
  });
  // Indirect matches sort after direct ones, within this page only.
  const results = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => Number(a.r.symbolMatch === "eligibility_or_outcome_only") - Number(b.r.symbolMatch === "eligibility_or_outcome_only") || a.i - b.i)
    .map(({ r }) => r);

  let excludedCount: number | null = null;
  if (withExcludedCount && view === "results" && applied && ambiguous && (await excludedCountEnabled())) {
    const countParams = new URLSearchParams(base);
    countParams.set("query.term", `(${term}) AND ${ambiguous.exclude}`);
    countParams.set("pageSize", "1");
    countParams.set("fields", "NCTId");
    try {
      const { data: c } = await fetchUpstream<CtgovResponse>(SOURCE, `${CTGOV_API}?${countParams}`, { ttlSeconds: 86400 });
      excludedCount = c.totalCount ?? null;
    } catch {
      excludedCount = null;
    }
  }

  return NextResponse.json({
    query,
    view,
    disambiguation,
    drugAware,
    excludedCount,
    results,
    total: data.totalCount ?? results.length,
    nextPageToken: data.nextPageToken ?? null,
    source: provenance,
  }, { headers: PUBLIC_CACHE_HEADERS });
}

// Clinical Trial Feasibility Agent: ClinicalTrials.gov records for a condition (optional intervention and
// location); every count is computed here in code. Claude only writes a narrative around those numbers,
// and the server removes any sentence containing a number that is not in the computed facts.

import { type Provenance, UpstreamError, ctgovRelease, fetchUpstream } from "@/lib/upstream";
import { ClaudeCallError, callClaudeJson } from "./claude";
import type { AgentResult, AiAccess } from "./run";
import type { SourceRecord } from "./store";

const CTGOV_API = "https://clinicaltrials.gov/api/v2/studies";
const SOURCE = { name: "ClinicalTrials.gov API v2", url: "https://clinicaltrials.gov/" };
const PAGE = 1000;
/** Records analysed for enrollment, sponsor and start-year figures. Above this, those figures are a sample. */
const MAX_ALL = 3000;
const MAX_RECRUITING = 2000;

export interface TrialInputs {
  condition: string;
  intervention: string;
  location: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

export function parseTrialInputs(body: Record<string, unknown>): TrialInputs | string {
  const out: Record<string, string> = {};
  for (const [key, max, required] of [["condition", 100, true], ["intervention", 100, false], ["location", 100, false]] as const) {
    const v = body[key];
    if (v === undefined || v === null || v === "") {
      if (required) return `'${key}' is required`;
      out[key] = "";
      continue;
    }
    if (typeof v !== "string") return `'${key}' must be text`;
    const t = v.trim();
    if (required && t.length < 2) return `'${key}' is too short`;
    if (t.length > max) return `'${key}' is too long (max ${max} characters)`;
    if (CONTROL.test(t)) return `'${key}' contains control characters`;
    out[key] = t;
  }
  return out as unknown as TrialInputs;
}

interface Study {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string; class?: string } };
    designModule?: { phases?: string[]; enrollmentInfo?: { count?: number; type?: string } };
    contactsLocationsModule?: { locations?: { status?: string; country?: string }[] };
  };
}
type Page = { studies?: Study[]; totalCount?: number; nextPageToken?: string };

export const PHASES: [string, string][] = [
  ["EARLY_PHASE1", "Early Phase 1"],
  ["PHASE1", "Phase 1"],
  ["PHASE2", "Phase 2"],
  ["PHASE3", "Phase 3"],
  ["PHASE4", "Phase 4"],
  ["NA", "Not applicable"],
];
export const STATUSES: [string, string][] = [
  ["RECRUITING", "Recruiting"],
  ["NOT_YET_RECRUITING", "Not yet recruiting"],
  ["ENROLLING_BY_INVITATION", "Enrolling by invitation"],
  ["ACTIVE_NOT_RECRUITING", "Active, not recruiting"],
  ["COMPLETED", "Completed"],
  ["SUSPENDED", "Suspended"],
  ["TERMINATED", "Terminated"],
  ["WITHDRAWN", "Withdrawn"],
  ["UNKNOWN", "Unknown status"],
];
const SPONSOR_CLASSES: Record<string, string> = {
  INDUSTRY: "Industry",
  NIH: "NIH",
  FED: "Other U.S. federal agency",
  OTHER_GOV: "Other government",
  NETWORK: "Network or cooperative group",
  INDIV: "Individual",
  OTHER: "Other (academic, hospital, foundation)",
  UNKNOWN: "Unknown",
};
const ENROLLMENT_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "1 to 49", min: 1, max: 49 },
  { label: "50 to 99", min: 50, max: 99 },
  { label: "100 to 299", min: 100, max: 299 },
  { label: "300 to 999", min: 300, max: 999 },
  { label: "1000 or more", min: 1000, max: Infinity },
];

export interface CountRow {
  label: string;
  trials: number | null;
  pctOfTotal: number | null;
}

export interface TrialFacts {
  query: TrialInputs;
  totalTrials: number;
  analysedTrials: number;
  allAnalysed: boolean;
  byStatus: CountRow[];
  byPhase: CountRow[];
  countsExact: boolean;
  enrollment: { trialsWithCount: number; actual: number; estimated: number; median: number | null; buckets: { label: string; trials: number }[] };
  sponsorClass: { label: string; trials: number }[];
  startYears: { year: number; trials: number }[];
  recruiting: {
    trials: number;
    analysedTrials: number;
    allAnalysed: boolean;
    recruitingSites: number;
    trialsWithoutRecruitingSite: number;
    countries: { country: string; recruitingSites: number; trials: number }[];
    otherCountries: { countries: number; recruitingSites: number } | null;
    topTrials: { nctId: string; title: string; phases: string[]; recruitingSites: number; enrollment: number | null }[];
  };
}

const pct = (n: number | null, total: number) => (n === null || !total ? null : Math.round((1000 * n) / total) / 10);

async function fetchAll(base: URLSearchParams, fields: string, max: number, timeoutMs = 20000) {
  const studies: Study[] = [];
  let total = 0;
  let token: string | undefined;
  let first: Provenance | null = null;
  let pages = 0;
  do {
    const params = new URLSearchParams(base);
    params.set("pageSize", String(PAGE));
    params.set("fields", fields);
    params.set("countTotal", "true");
    if (token) params.set("pageToken", token);
    const { data, provenance } = await fetchUpstream<Page>(SOURCE, `${CTGOV_API}?${params}`, { ttlSeconds: 0, timeoutMs });
    if (!first) {
      first = provenance;
      total = data.totalCount ?? 0;
    }
    studies.push(...(data.studies ?? []));
    token = data.nextPageToken;
    pages++;
  } while (token && studies.length < max);
  return { studies: studies.slice(0, max), total, provenance: first!, pages };
}

async function countOnly(base: URLSearchParams, extra: Record<string, string>): Promise<number | null> {
  const params = new URLSearchParams(base);
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  params.set("pageSize", "1");
  params.set("fields", "NCTId");
  params.set("countTotal", "true");
  try {
    const { data } = await fetchUpstream<Page>(SOURCE, `${CTGOV_API}?${params}`, { ttlSeconds: 0, timeoutMs: 10000 });
    return data.totalCount ?? null;
  } catch {
    return null;
  }
}

async function inBatches<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) out.push(...(await Promise.all(tasks.slice(i, i + size).map((t) => t()))));
  return out;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export async function computeTrialFacts(q: TrialInputs): Promise<{ facts: TrialFacts; sources: SourceRecord[] }> {
  const base = new URLSearchParams();
  base.set("query.cond", q.condition);
  if (q.intervention) base.set("query.intr", q.intervention);
  if (q.location) base.set("query.locn", q.location);

  const recruitingBase = new URLSearchParams(base);
  recruitingBase.set("filter.overallStatus", "RECRUITING");

  const [all, recruiting, release] = await Promise.all([
    fetchAll(base, "NCTId,Phase,OverallStatus,EnrollmentCount,EnrollmentType,StartDate,LeadSponsorClass", MAX_ALL),
    fetchAll(recruitingBase, "NCTId,BriefTitle,Phase,EnrollmentCount,LocationCountry,LocationStatus", MAX_RECRUITING, 25000),
    ctgovRelease(),
  ]);
  const total = all.total;
  const allAnalysed = all.studies.length >= total;
  const ps = (s: Study) => s.protocolSection ?? {};

  // Status and phase counts: from every record when all were fetched, else exact count queries.
  let byStatus: CountRow[];
  let byPhase: CountRow[];
  let countsExact = true;
  if (allAnalysed) {
    const statusCount = new Map<string, number>();
    const phaseCount = new Map<string, number>();
    let noPhase = 0;
    for (const s of all.studies) {
      const st = ps(s).statusModule?.overallStatus ?? "UNKNOWN";
      statusCount.set(st, (statusCount.get(st) ?? 0) + 1);
      const phases = ps(s).designModule?.phases ?? [];
      if (!phases.length) noPhase++;
      for (const p of phases) phaseCount.set(p, (phaseCount.get(p) ?? 0) + 1);
    }
    const listed = STATUSES.map(([code, label]) => ({ label, trials: statusCount.get(code) ?? 0, pctOfTotal: pct(statusCount.get(code) ?? 0, total) }));
    const other = all.studies.length - listed.reduce((s, r) => s + (r.trials ?? 0), 0);
    byStatus = other > 0 ? [...listed, { label: "Other", trials: other, pctOfTotal: pct(other, total) }] : listed;
    byPhase = PHASES.map(([code, label]) => ({ label, trials: phaseCount.get(code) ?? 0, pctOfTotal: pct(phaseCount.get(code) ?? 0, total) }));
    if (noPhase) byPhase.push({ label: "Not specified", trials: noPhase, pctOfTotal: pct(noPhase, total) });
  } else {
    const statusCounts = await inBatches(STATUSES.map(([code]) => () => countOnly(base, { "filter.overallStatus": code })), 4);
    const phaseCounts = await inBatches(PHASES.map(([code]) => () => countOnly(base, { "filter.advanced": `AREA[Phase]${code}` })), 4);
    countsExact = statusCounts.every((c) => c !== null) && phaseCounts.every((c) => c !== null);
    byStatus = STATUSES.map(([, label], i) => ({ label, trials: statusCounts[i], pctOfTotal: pct(statusCounts[i], total) }));
    const known = statusCounts.reduce<number>((s, c) => s + (c ?? 0), 0);
    if (countsExact && total - known > 0) byStatus.push({ label: "Other", trials: total - known, pctOfTotal: pct(total - known, total) });
    byPhase = PHASES.map(([, label], i) => ({ label, trials: phaseCounts[i], pctOfTotal: pct(phaseCounts[i], total) }));
  }

  // Enrollment, sponsor class and start year over the analysed records.
  const counts: number[] = [];
  let actual = 0;
  let estimated = 0;
  const sponsor = new Map<string, number>();
  const years = new Map<number, number>();
  for (const s of all.studies) {
    const e = ps(s).designModule?.enrollmentInfo;
    if (typeof e?.count === "number" && e.count > 0) {
      counts.push(e.count);
      if (e.type === "ACTUAL") actual++;
      else if (e.type === "ESTIMATED") estimated++;
    }
    const cls = ps(s).sponsorCollaboratorsModule?.leadSponsor?.class ?? "UNKNOWN";
    const label = SPONSOR_CLASSES[cls] ?? cls;
    sponsor.set(label, (sponsor.get(label) ?? 0) + 1);
    const y = Number((ps(s).statusModule?.startDateStruct?.date ?? "").slice(0, 4));
    if (y) years.set(y, (years.get(y) ?? 0) + 1);
  }
  const thisYear = new Date().getUTCFullYear();
  const startYears = Array.from({ length: 10 }, (_, i) => thisYear - 9 + i).map((year) => ({ year, trials: years.get(year) ?? 0 }));

  // Recruiting sites: locations whose own status is RECRUITING, in trials whose overall status is RECRUITING.
  const siteCount = new Map<string, number>();
  const trialCount = new Map<string, number>();
  let recruitingSites = 0;
  let withoutSite = 0;
  const perTrial: TrialFacts["recruiting"]["topTrials"] = [];
  for (const s of recruiting.studies) {
    const locs = (ps(s).contactsLocationsModule?.locations ?? []).filter((l) => l.status === "RECRUITING");
    if (!locs.length) withoutSite++;
    recruitingSites += locs.length;
    const countries = new Set<string>();
    for (const l of locs) {
      const c = l.country || "Not specified";
      siteCount.set(c, (siteCount.get(c) ?? 0) + 1);
      countries.add(c);
    }
    countries.forEach((c) => trialCount.set(c, (trialCount.get(c) ?? 0) + 1));
    const id = ps(s).identificationModule?.nctId ?? "";
    if (/^NCT\d{8}$/.test(id))
      perTrial.push({
        nctId: id,
        title: ps(s).identificationModule?.briefTitle ?? "",
        phases: (ps(s).designModule?.phases ?? []).map((p) => PHASES.find(([c]) => c === p)?.[1] ?? p),
        recruitingSites: locs.length,
        enrollment: ps(s).designModule?.enrollmentInfo?.count ?? null,
      });
  }
  const countryRows = Array.from(siteCount.entries())
    .map(([country, sites]) => ({ country, recruitingSites: sites, trials: trialCount.get(country) ?? 0 }))
    .sort((a, b) => b.recruitingSites - a.recruitingSites || a.country.localeCompare(b.country));
  const top = countryRows.slice(0, 15);
  const rest = countryRows.slice(15);

  const facts: TrialFacts = {
    query: q,
    totalTrials: total,
    analysedTrials: all.studies.length,
    allAnalysed,
    byStatus,
    byPhase,
    countsExact,
    enrollment: {
      trialsWithCount: counts.length,
      actual,
      estimated,
      median: median(counts),
      buckets: ENROLLMENT_BUCKETS.map((b) => ({ label: b.label, trials: counts.filter((c) => c >= b.min && c <= b.max).length })),
    },
    sponsorClass: Array.from(sponsor.entries()).map(([label, trials]) => ({ label, trials })).sort((a, b) => b.trials - a.trials),
    startYears,
    recruiting: {
      trials: recruiting.total,
      analysedTrials: recruiting.studies.length,
      allAnalysed: recruiting.studies.length >= recruiting.total,
      recruitingSites,
      trialsWithoutRecruitingSite: withoutSite,
      countries: top,
      otherCountries: rest.length ? { countries: rest.length, recruitingSites: rest.reduce((s, r) => s + r.recruitingSites, 0) } : null,
      topTrials: perTrial.sort((a, b) => b.recruitingSites - a.recruitingSites).slice(0, 10),
    },
  };

  const releaseNote = release ? `${release.version}${release.date ? `, data of ${release.date}` : ""}` : undefined;
  const sources: SourceRecord[] = [
    {
      name: "ClinicalTrials.gov API v2 (all matching trials)",
      url: SOURCE.url,
      queryUrl: all.provenance.queryUrl,
      retrieved: all.provenance.retrieved,
      note: [`${all.studies.length} of ${total} records fetched in ${all.pages} page(s)`, releaseNote].filter(Boolean).join("; "),
    },
    {
      name: "ClinicalTrials.gov API v2 (recruiting trials, with site status)",
      url: SOURCE.url,
      queryUrl: recruiting.provenance.queryUrl,
      retrieved: recruiting.provenance.retrieved,
      note: `${recruiting.studies.length} of ${recruiting.total} records fetched in ${recruiting.pages} page(s)`,
    },
  ];
  if (!allAnalysed)
    sources.push({
      name: "ClinicalTrials.gov API v2 (count queries by status and phase)",
      url: SOURCE.url,
      queryUrl: `${CTGOV_API}?${base}&filter.overallStatus=RECRUITING&pageSize=1&fields=NCTId&countTotal=true`,
      retrieved: new Date().toISOString(),
      note: `One count query per status and per phase (example shown: Recruiting). ${
        countsExact ? "Exact totals." : "Some count queries failed; those cells are blank."
      }`,
    });
  return { facts, sources };
}

// ── Narrative ───────────────────────────────────────────────────────────────

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "recruitment", "landscape", "caveats"],
  properties: {
    overview: { type: "array", items: { type: "string" }, description: "2 to 3 sentences on the overall trial landscape." },
    recruitment: { type: "array", items: { type: "string" }, description: "2 to 4 sentences on where and how actively trials are recruiting." },
    landscape: { type: "array", items: { type: "string" }, description: "2 to 4 sentences on phases, sponsors, enrollment sizes and recent activity." },
    caveats: { type: "array", items: { type: "string" }, description: "1 to 3 sentences on the limits of these figures." },
  },
} as const;

const SYSTEM = `You write a short clinical-trial feasibility narrative for drug-discovery researchers.
You receive FACTS: statistics computed by our server from ClinicalTrials.gov records.

Rules:
- Use only numbers that appear in FACTS, written exactly as they appear there (same digits, same decimals). Write numbers as digits, never as words.
- Do not calculate new numbers: no sums, differences, ratios, rankings by number, or percentages that FACTS does not list.
- Do not add numbers or facts from memory (no prevalence, patient population, approval or market figures, no sponsor or drug names that are not in FACTS).
- You may describe without numbers ("most", "few", "concentrated in").
- If FACTS says a figure covers only part of the records (allAnalysed false, or recruiting.allAnalysed false), say so.
- Phase counts overlap: a Phase 1/Phase 2 trial counts under both phases.
- Keep each sentence self-contained and plain.`;

interface RawNarrative {
  overview?: unknown[];
  recruitment?: unknown[];
  landscape?: unknown[];
  caveats?: unknown[];
}

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|dozens?|half|twice|double|doubled|triple|tripled|quarter|third)\b/i;
const normNum = (s: string) => {
  const v = Number(s.replace(/,/g, ""));
  return Number.isFinite(v) ? String(v) : s;
};

export function allowedNumbers(...sources: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const src of sources) for (const m of Array.from(JSON.stringify(src).matchAll(NUMBER))) set.add(normNum(m[0]));
  return set;
}

/** Keep sentences whose every number is in the computed facts; return the rest with the reason. */
export function checkNumbers(raw: RawNarrative, allowed: Set<string>) {
  const removed: { section: string; sentence: string; reason: string }[] = [];
  const sections: Record<string, string[]> = {};
  for (const key of ["overview", "recruitment", "landscape", "caveats"] as const) {
    sections[key] = [];
    for (const item of raw[key] ?? []) {
      const sentence = String(item ?? "").trim();
      if (!sentence) continue;
      const bad = Array.from(sentence.matchAll(NUMBER)).map((m) => m[0]).filter((num) => !allowed.has(normNum(num)));
      const word = sentence.match(NUMBER_WORDS)?.[0];
      if (bad.length) removed.push({ section: key, sentence, reason: `Contains ${bad.join(", ")}, which is not in the computed figures.` });
      else if (word) removed.push({ section: key, sentence, reason: `Writes a quantity in words ("${word}") instead of using a computed figure.` });
      else sections[key].push(sentence);
    }
  }
  return { sections, removed };
}

export async function runTrials(inputs: TrialInputs, ai: AiAccess): Promise<AgentResult> {
  let computed;
  try {
    computed = await computeTrialFacts(inputs);
  } catch (err) {
    const message = err instanceof UpstreamError ? `${err.message}. No figures were computed.` : "ClinicalTrials.gov query failed.";
    return { status: "error", sources: [], output: null, error: message, claude: null };
  }
  const { facts, sources } = computed;
  if (!facts.totalTrials) {
    return {
      status: "no_data",
      sources,
      output: { facts, narrative: null },
      error: "No ClinicalTrials.gov records matched, so Claude was not called. Try a broader condition or remove filters.",
      claude: null,
    };
  }

  const user = `Condition: ${inputs.condition}${inputs.intervention ? `\nIntervention: ${inputs.intervention}` : ""}${
    inputs.location ? `\nLocation filter: ${inputs.location}` : ""
  }\n\nFACTS (computed from ClinicalTrials.gov):\n${JSON.stringify(facts, null, 1)}`;

  let outcome;
  try {
    outcome = await callClaudeJson<RawNarrative>({
      apiKey: ai.apiKey,
      keySource: ai.keySource,
      system: SYSTEM,
      user,
      schema: SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 12000,
    });
  } catch (err) {
    const message = err instanceof ClaudeCallError ? err.message : "The Claude call failed.";
    return { status: "error", sources, output: { facts, narrative: null }, error: `${message} The computed figures are shown below.`, claude: null };
  }
  if (outcome.status !== "ok" || !outcome.data) {
    return {
      status: outcome.status === "refused" ? "refused" : "error",
      sources,
      output: { facts, narrative: null, refusalCategory: outcome.refusalCategory, fellBack: outcome.fellBack },
      error:
        outcome.status === "refused"
          ? `Claude declined to write the narrative${outcome.refusalCategory ? ` (safety category: ${outcome.refusalCategory})` : ""}. The computed figures are shown below.`
          : `${outcome.error} The computed figures are shown below.`,
      claude: outcome,
    };
  }
  const checked = checkNumbers(outcome.data, allowedNumbers(facts, inputs));
  return {
    status: "ok",
    sources,
    output: { facts, narrative: checked.sections, numberCheck: { removed: checked.removed }, fellBack: outcome.fellBack },
    error: null,
    claude: outcome,
  };
}

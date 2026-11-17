import { NextResponse } from "next/server";

export const MAX_QUERY_LENGTH = 100;

const USER_AGENT = "SmartDrugDiscovery/1.0 (+https://studio.smartdrugdiscovery.org)";

export interface DataRelease {
  version: string;
  date: string | null;
}

export interface Provenance {
  name: string;
  url: string;
  queryUrl: string;
  retrieved: string;
  cacheTtlSeconds: number;
  release?: DataRelease;
}

export class UpstreamError extends Error {}

/** The upstream answered but refused the query (HTTP 4xx), as opposed to being down. */
export class UpstreamRejected extends UpstreamError {
  constructor(readonly sourceName: string, readonly status: number) {
    super(`${sourceName} rejected the query (HTTP ${status})`);
  }
}

export async function fetchUpstream<T>(
  source: { name: string; url: string },
  queryUrl: string,
  {
    ttlSeconds = 3600,
    timeoutMs = 8000,
    jsonBody,
  }: {
    ttlSeconds?: number;
    timeoutMs?: number;
    /** When set, the request is a POST with this JSON body (e.g. a fixed GraphQL query with typed variables). */
    jsonBody?: unknown;
  } = {}
): Promise<{ data: T; provenance: Provenance }> {
  let res: Response;
  try {
    res = await fetch(queryUrl, {
      ...(jsonBody === undefined ? {} : { method: "POST", body: JSON.stringify(jsonBody) }),
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(jsonBody === undefined ? {} : { "Content-Type": "application/json" }),
      },
      next: { revalidate: ttlSeconds },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new UpstreamError(`${source.name} did not respond`);
  }
  if (res.status >= 400 && res.status < 500) throw new UpstreamRejected(source.name, res.status);
  if (!res.ok) throw new UpstreamError(`${source.name} responded ${res.status}`);

  // The upstream Date header is stored with a cached response, so it reflects the real fetch time.
  const upstreamDate = res.headers.get("date");
  const retrieved = upstreamDate && !isNaN(Date.parse(upstreamDate)) ? new Date(upstreamDate) : new Date();

  return {
    data: (await res.json()) as T,
    provenance: {
      name: source.name,
      url: source.url,
      queryUrl,
      retrieved: retrieved.toISOString(),
      cacheTtlSeconds: ttlSeconds,
    },
  };
}

export const badRequest = (error: string) => NextResponse.json({ results: [], error }, { status: 400 });

export const sourceUnavailable = (name: string) =>
  NextResponse.json(
    { results: [], error: `Source unavailable: ${name} could not be reached. No cached or demo data is shown in its place.` },
    { status: 502 }
  );

export function upstreamErrorResponse(err: UpstreamError, name: string) {
  if (err instanceof UpstreamRejected) {
    return NextResponse.json(
      { results: [], error: `${err.message}. Check the query; this is not an outage.` },
      { status: 400 }
    );
  }
  return sourceUnavailable(name);
}

/** Unknown parameters are an error, so a typo such as `limt=50` never silently returns default results. */
export function rejectUnknownParams(params: URLSearchParams, allowed: readonly string[]): NextResponse | null {
  const unknown = Array.from(new Set(params.keys())).filter((k) => !allowed.includes(k));
  return unknown.length
    ? badRequest(`Unknown parameter${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}`)
    : null;
}

/** Shared-cache header for successful public GETs: the CDN serves repeats without invoking a function. */
export const PUBLIC_CACHE_HEADERS = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };

const DAY = 24 * 60 * 60;

/** ChEMBL release (e.g. ChEMBL_37). Returns null on failure so callers never fail because of it. */
export async function chemblRelease(): Promise<DataRelease | null> {
  try {
    const { data } = await fetchUpstream<{ chembl_db_version?: string; chembl_release_date?: string }>(
      { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" },
      "https://www.ebi.ac.uk/chembl/api/data/status.json",
      { ttlSeconds: DAY, timeoutMs: 4000 }
    );
    return data.chembl_db_version ? { version: data.chembl_db_version, date: data.chembl_release_date ?? null } : null;
  } catch {
    return null;
  }
}

/** ClinicalTrials.gov API version and data timestamp. Returns null on failure. */
export async function ctgovRelease(): Promise<DataRelease | null> {
  try {
    const { data } = await fetchUpstream<{ apiVersion?: string; dataTimestamp?: string }>(
      { name: "ClinicalTrials.gov API v2", url: "https://clinicaltrials.gov/" },
      "https://clinicaltrials.gov/api/v2/version",
      { ttlSeconds: DAY, timeoutMs: 4000 }
    );
    return data.apiVersion ? { version: `API ${data.apiVersion}`, date: data.dataTimestamp ?? null } : null;
  } catch {
    return null;
  }
}

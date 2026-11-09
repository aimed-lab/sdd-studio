import { NextResponse } from "next/server";

export const MAX_QUERY_LENGTH = 100;

const USER_AGENT = "SmartDrugDiscovery/1.0 (+https://target.smartdrugdiscovery.org)";

export interface Provenance {
  name: string;
  url: string;
  queryUrl: string;
  retrieved: string;
  cacheTtlSeconds: number;
}

export class UpstreamError extends Error {}

export async function fetchUpstream<T>(
  source: { name: string; url: string },
  queryUrl: string,
  { ttlSeconds = 3600, timeoutMs = 8000 }: { ttlSeconds?: number; timeoutMs?: number } = {}
): Promise<{ data: T; provenance: Provenance }> {
  let res: Response;
  try {
    res = await fetch(queryUrl, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: ttlSeconds },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new UpstreamError(`${source.name} did not respond`);
  }
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

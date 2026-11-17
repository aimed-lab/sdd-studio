// PubMed through NCBI E-utilities (esearch, then efetch).
// NCBI asks clients to send a tool name and to stay at or below 3 requests per second without an API key
// (10 with one): https://www.ncbi.nlm.nih.gov/books/NBK25497/. We send a generic tool name and no email,
// space requests at least 400 ms apart per server instance, and use NCBI_API_KEY when it is set.

import type { SourceRecord } from "./store";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "sdd-studio";
const USER_AGENT = "SmartDrugDiscovery/1.0 (+https://studio.smartdrugdiscovery.org)";
const MIN_GAP_MS = 400;

export class PubMedError extends Error {}

let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function eutils(path: string, params: URLSearchParams): Promise<{ body: string; url: string; retrieved: string }> {
  params.set("tool", TOOL);
  const apiKey = process.env.NCBI_API_KEY;
  // The public URL we store never carries the API key.
  const publicUrl = `${EUTILS}/${path}?${params}`;
  if (apiKey) params.set("api_key", apiKey);
  const url = `${EUTILS}/${path}?${params}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    } catch {
      throw new PubMedError("PubMed (NCBI E-utilities) did not respond.");
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1100));
      continue;
    }
    if (!res.ok) throw new PubMedError(`PubMed (NCBI E-utilities) responded ${res.status}.`);
    const date = res.headers.get("date");
    const retrieved = date && !isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString();
    return { body: await res.text(), url: publicUrl, retrieved };
  }
  throw new PubMedError("PubMed (NCBI E-utilities) is rate-limiting requests. Try again shortly.");
}

export interface PubMedRecord {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  year: string;
  authors: string;
  doi: string | null;
  publicationTypes: string[];
}

export interface PubMedSearch {
  query: string;
  queryTranslation: string | null;
  total: number;
  records: PubMedRecord[];
  sources: SourceRecord[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeXml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const first = (s: string, re: RegExp) => s.match(re)?.[1] ?? "";

export function parsePubmedXml(xml: string): PubMedRecord[] {
  const out: PubMedRecord[] = [];
  for (const m of Array.from(xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g))) {
    const a = m[1];
    const pmid = first(a, /<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmid) continue;
    const abstractXml = first(a, /<Abstract>([\s\S]*?)<\/Abstract>/);
    const parts = Array.from(abstractXml.matchAll(/<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g)).map((p) => {
      const label = first(p[1], /Label="([^"]*)"/);
      const text = decodeXml(p[2]);
      return label ? `${decodeXml(label)}: ${text}` : text;
    });
    const authorBlocks = Array.from(a.matchAll(/<Author\b[^>]*>([\s\S]*?)<\/Author>/g)).map((x) => x[1]);
    const firstAuthor = authorBlocks[0]
      ? decodeXml(first(authorBlocks[0], /<LastName>([\s\S]*?)<\/LastName>/) || first(authorBlocks[0], /<CollectiveName>([\s\S]*?)<\/CollectiveName>/)) +
        (first(authorBlocks[0], /<Initials>([\s\S]*?)<\/Initials>/) ? ` ${decodeXml(first(authorBlocks[0], /<Initials>([\s\S]*?)<\/Initials>/))}` : "")
      : "";
    const pubDate = first(a, /<PubDate>([\s\S]*?)<\/PubDate>/);
    const year = first(pubDate, /<Year>(\d{4})<\/Year>/) || first(pubDate, /(\d{4})/);
    const doi =
      first(a, /<ELocationID EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/) ||
      first(first(a, /<PubmedData>([\s\S]*?)<\/PubmedData>/), /<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
    out.push({
      pmid,
      title: decodeXml(first(a, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)),
      abstract: parts.join("\n"),
      journal: decodeXml(first(a, /<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/) || first(a, /<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/)),
      year,
      authors: firstAuthor ? (authorBlocks.length > 1 ? `${firstAuthor} et al.` : firstAuthor) : "",
      doi: doi ? decodeXml(doi) : null,
      publicationTypes: Array.from(a.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g)).map((x) => decodeXml(x[1])),
    });
  }
  return out;
}

export async function searchPubMed(query: string, max: number, sort: "relevance" | "date"): Promise<PubMedSearch> {
  const search = await eutils(
    "esearch.fcgi",
    new URLSearchParams({ db: "pubmed", term: query, retmax: String(max), retmode: "json", sort: sort === "date" ? "pub_date" : "relevance" })
  );
  let parsed: { esearchresult?: { count?: string; idlist?: string[]; querytranslation?: string; ERROR?: string } };
  try {
    parsed = JSON.parse(search.body);
  } catch {
    throw new PubMedError("PubMed returned an unreadable search response.");
  }
  const r = parsed.esearchresult;
  if (!r) throw new PubMedError("PubMed returned an unreadable search response.");
  const ids = (r.idlist ?? []).filter((id) => /^\d+$/.test(id));
  const sources: SourceRecord[] = [
    {
      name: "PubMed (NCBI E-utilities esearch)",
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}${sort === "date" ? "&sort=date" : ""}`,
      queryUrl: search.url,
      retrieved: search.retrieved,
      note: `${Number(r.count ?? 0)} matching records; top ${ids.length} by ${sort === "date" ? "publication date" : "relevance"} fetched`,
    },
  ];
  if (!ids.length) return { query, queryTranslation: r.querytranslation ?? null, total: Number(r.count ?? 0), records: [], sources };

  const fetched = await eutils("efetch.fcgi", new URLSearchParams({ db: "pubmed", id: ids.join(","), retmode: "xml" }));
  sources.push({ name: "PubMed (NCBI E-utilities efetch)", url: "https://pubmed.ncbi.nlm.nih.gov/", queryUrl: fetched.url, retrieved: fetched.retrieved });
  const byId = new Map(parsePubmedXml(fetched.body).map((rec) => [rec.pmid, rec]));
  // Keep esearch order (relevance or date).
  const records = ids.map((id) => byId.get(id)).filter((rec): rec is PubMedRecord => !!rec);
  return { query, queryTranslation: r.querytranslation ?? null, total: Number(r.count ?? 0), records, sources };
}

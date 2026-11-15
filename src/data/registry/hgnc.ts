// Server-side gene-symbol resolution against HGNC (#25): approved symbol first, then alias and previous symbols,
// so /targets/<alias> can redirect to the approved symbol. Uses the shared upstream helper (24 h cache).
import { type Provenance, UpstreamRejected, fetchUpstream } from "@/lib/upstream";

const HGNC = "https://rest.genenames.org";
const SOURCE = { name: "HGNC", url: "https://www.genenames.org/" };
const DAY = 24 * 60 * 60;

export interface HgncGene {
  symbol: string;
  name: string;
  hgncId: string;
  uniprotIds: string[];
  locusGroup: string | null;
  matchedBy: "symbol" | "alias_symbol" | "prev_symbol";
  source: Provenance;
}

interface HgncResponse {
  response?: {
    numFound?: number;
    docs?: { symbol?: string; name?: string; hgnc_id?: string; uniprot_ids?: string[]; locus_group?: string }[];
  };
}

/**
 * Returns the approved HGNC record for a symbol, alias or previous symbol, or null when HGNC has no single match.
 * The caller validates the symbol first; it is URL-encoded here as well. Throws UpstreamError if HGNC is unreachable.
 */
export async function resolveHgnc(symbol: string): Promise<HgncGene | null> {
  const s = encodeURIComponent(symbol.toUpperCase());
  for (const field of ["symbol", "alias_symbol", "prev_symbol"] as const) {
    let res;
    try {
      res = await fetchUpstream<HgncResponse>(SOURCE, `${HGNC}/fetch/${field}/${s}`, { ttlSeconds: DAY, timeoutMs: 4000 });
    } catch (err) {
      if (err instanceof UpstreamRejected) return null;
      throw err;
    }
    const docs = res.data.response?.docs ?? [];
    // An alias shared by several genes is ambiguous: no redirect.
    if (docs.length !== 1) {
      if (docs.length > 1) return null;
      continue;
    }
    const d = docs[0];
    if (!d.symbol || !d.hgnc_id) continue;
    return {
      symbol: d.symbol,
      name: d.name ?? "",
      hgncId: d.hgnc_id,
      uniprotIds: (d.uniprot_ids ?? []).filter((u) => /^[A-Z0-9]{6,10}$/.test(u)),
      locusGroup: d.locus_group ?? null,
      matchedBy: field,
      source: res.provenance,
    };
  }
  return null;
}

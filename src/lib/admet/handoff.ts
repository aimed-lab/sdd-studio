/**
 * Hands a set of structures from another page to the Local ADMET Screener.
 *
 * The structures go through sessionStorage rather than the URL: a page of a
 * campaign's compounds table is a hundred SMILES, far past what a query string
 * can carry, and a campaign's structures should not end up in browser history,
 * a bookmark or a referrer header. The payload is read once and removed.
 */
export const ADMET_PATH = "/services/admet";

const KEY = "sdd.admet.handoff";
/** Matches MAX_MOLECULES in src/lib/admet/input.ts. */
const MAX_ROWS = 500;

export interface AdmetHandoff {
  /** Where the structures came from, shown above the results. */
  source: string;
  rows: { smiles: string; name: string }[];
}

/** Stores structures for the screener to pick up. Returns false if it could not. */
export function putAdmetHandoff(handoff: AdmetHandoff): boolean {
  try {
    const rows = handoff.rows.filter((r) => r.smiles).slice(0, MAX_ROWS);
    if (rows.length === 0) return false;
    sessionStorage.setItem(KEY, JSON.stringify({ ...handoff, rows }));
    return true;
  } catch {
    // Private browsing or a full quota; the caller tells the user.
    return false;
  }
}

/** Reads and clears a pending hand-off, if there is one. */
export function takeAdmetHandoff(): AdmetHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as AdmetHandoff;
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) return null;
    return {
      source: typeof parsed.source === "string" ? parsed.source : "another page",
      rows: parsed.rows
        .filter((r) => r && typeof r.smiles === "string" && r.smiles)
        .slice(0, MAX_ROWS)
        .map((r) => ({ smiles: r.smiles, name: typeof r.name === "string" ? r.name : "" })),
    };
  } catch {
    return null;
  }
}

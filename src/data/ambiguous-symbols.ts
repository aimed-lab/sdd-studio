// Reviewed lexicon of gene symbols that collide with other terms in ClinicalTrials.gov text.
// Each entry excludes trials mentioning `exclude` by default; users can show or restore them.
// Decided by the RED panel on issue #57 (testing-system run 2026-11-14).

export interface AmbiguousSymbol {
  symbol: string;
  exclude: string;
  reason: string;
  evidence: string;
}

export const AMBIGUOUS_SYMBOLS: AmbiguousSymbol[] = [
  {
    symbol: "EGFR",
    exclude: "glomerular",
    reason: "eGFR (estimated glomerular filtration rate) is a kidney-function measure that appears in eligibility and outcome text.",
    evidence:
      "ClinicalTrials.gov counts on 2026-11-14 (EGFR term): NSCLC 1754 → 1749, kidney cancer 133 → 82, cancer 4314 → 4214. " +
      "Hidden NSCLC trials include genuine EGFR trial NCT03066206, so excluded trials stay one click away.",
  },
];

const tokenPattern = (symbol: string) => new RegExp(`(^|[^A-Za-z0-9])${symbol}([^A-Za-z0-9]|$)`, "i");

/** Case-insensitive, whole-token match (ClinicalTrials.gov search ignores case). */
export function findAmbiguousSymbol(term: string): AmbiguousSymbol | null {
  return AMBIGUOUS_SYMBOLS.find((s) => tokenPattern(s.symbol).test(term)) ?? null;
}

export function mentionsToken(text: string, token: string): boolean {
  return tokenPattern(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text);
}

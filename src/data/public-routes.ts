// The only pages readable without signing in (#70). Each shows live or curated data only;
// demo sections on these pages are hidden from anonymous visitors by the page itself.
// Their data APIs (/api/search, /api/trials, /api/compound) are rate-limited in src/middleware.ts.
export const PUBLIC_ROUTES = [
  { href: "/search", label: "Compound search", description: "Live ChEMBL search with structures and properties", kind: "live" },
  { href: "/clinical/trials", label: "Trial landscape", description: "Live ClinicalTrials.gov search with filters and export", kind: "live" },
  { href: "/targets", label: "EGFR resistance (curated)", description: "PubMed-cited resistance mechanisms for EGFR inhibitors", kind: "curated" },
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r.href);
}

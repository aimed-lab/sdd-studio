// Default trial-search condition per target (#57, item 3). Only entries backed by a curated, cited source;
// targets without one get no default, and a condition the user typed is never overridden.
export const targetDefaultConditions: Record<string, { condition: string; source: string }> = {
  EGFR: {
    condition: "non-small cell lung cancer",
    source: "Curated EGFR resistance set (src/data/curated/egfr-resistance.ts): every cited study is in EGFR-mutant NSCLC",
  },
};

export function trialsHrefFor(gene: string): string {
  const params = new URLSearchParams({ term: gene });
  const preset = targetDefaultConditions[gene.toUpperCase()];
  if (preset) params.set("condition", preset.condition);
  return `/clinical/trials?${params}`;
}

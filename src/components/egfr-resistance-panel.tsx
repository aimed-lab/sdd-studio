import { CuratedLabel } from "@/components/data-provenance";
import { EGFR_RESISTANCE_REVIEWED, egfrResistance } from "@/data/curated/egfr-resistance";

export function EgfrResistancePanel() {
  return (
    <section id="egfr-resistance" className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">EGFR: known mechanisms of acquired TKI resistance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reference set from primary literature. Not an exhaustive catalog.
          </p>
        </div>
        <CuratedLabel reviewed={EGFR_RESISTANCE_REVIEWED} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="border-b">
            <tr>
              {["Alteration", "Category", "Mechanism", "Affects", "Evidence (as reported)", "Source"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            {egfrResistance.map((r) => (
              <tr key={r.alteration}>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.alteration}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                <td className="px-3 py-2">{r.mechanism}</td>
                <td className="px-3 py-2">{r.affects}</td>
                <td className="px-3 py-2 italic">{r.evidence}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <a
                    href={`https://pubmed.ncbi.nlm.nih.gov/${r.citation.pmid}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {r.citation.short} {r.citation.year}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    PMID {r.citation.pmid} &middot;{" "}
                    <a href={`https://doi.org/${r.citation.doi}`} target="_blank" rel="noopener noreferrer" className="underline">
                      DOI
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Citations retrieved from PubMed. More variants and evidence levels:{" "}
        <a href="https://civicdb.org/genes/19/summary" target="_blank" rel="noopener noreferrer" className="underline">
          CIViC EGFR
        </a>
        .
      </p>
    </section>
  );
}

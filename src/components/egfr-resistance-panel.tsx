"use client";

import { useState } from "react";
import { CuratedLabel } from "@/components/data-provenance";
import { ExportCsvButton } from "@/components/export-csv-button";
import { EGFR_RESISTANCE_REVIEWED, egfrResistance } from "@/data/curated/egfr-resistance";

const csvRows = egfrResistance.map((r) => ({
  data_status: "curated, cited",
  alteration: r.alteration,
  category: r.category,
  setting: r.setting,
  mechanism: r.mechanism,
  affects: r.affects,
  evidence_as_reported: r.evidence,
  plain_language: r.plainLanguage,
  supporting_excerpt: r.excerpt,
  pmid: r.citation.pmid,
  doi: r.citation.doi,
  citation: `${r.citation.short} ${r.citation.year}`,
  curator: r.curator,
  verified: r.verified,
}));

export function EgfrResistancePanel() {
  const [plain, setPlain] = useState(false);

  return (
    <section id="egfr-resistance" className="rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">EGFR: known mechanisms of acquired TKI resistance</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reference set from primary literature. Not an exhaustive catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CuratedLabel reviewed={EGFR_RESISTANCE_REVIEWED} />
          <button
            type="button"
            onClick={() => setPlain((p) => !p)}
            aria-pressed={plain}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {plain ? "Show technical detail" : "Plain language"}
          </button>
          <ExportCsvButton
            rows={csvRows}
            filename="egfr-resistance-curated"
            source={{ name: "PubMed-cited curated set", retrieved: EGFR_RESISTANCE_REVIEWED }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="border-b">
            <tr>
              {(plain
                ? ["Alteration", "Setting", "What it means", "Source"]
                : ["Alteration", "Category", "Setting", "Mechanism", "Affects", "Evidence (as reported)", "Source"]
              ).map((h) => (
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
                {!plain && <td className="px-3 py-2 text-muted-foreground">{r.category}</td>}
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.setting}</td>
                {plain ? (
                  <td className="px-3 py-2">{r.plainLanguage}</td>
                ) : (
                  <>
                    <td className="px-3 py-2">{r.mechanism}</td>
                    <td className="px-3 py-2">{r.affects}</td>
                    <td className="px-3 py-2 italic">
                      {r.evidence}
                      <details className="mt-1 not-italic text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Supporting excerpt</summary>
                        <q>{r.excerpt}</q>
                        <div>
                          {r.curator}, verified {r.verified}
                        </div>
                      </details>
                    </td>
                  </>
                )}
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

      {plain && (
        <p className="text-xs text-muted-foreground">
          Plain-language summaries restate the cited findings only. They are not medical advice.
        </p>
      )}
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

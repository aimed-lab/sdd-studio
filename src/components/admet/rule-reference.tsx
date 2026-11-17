"use client";

import { BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RULE_DOCS, SOURCES } from "@/lib/admet/rules";
import type { AlertCatalog } from "@/lib/admet/screen";

/** What each rule says, what it does not say, and where it comes from. */
export function RuleReference({ catalog }: { catalog?: AlertCatalog }) {
  const counts = catalog?.provenance.counts;
  const patternTotal = catalog?.alerts.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          The rules, and what they mean
        </CardTitle>
        <CardDescription>
          Each check below is a published rule of thumb applied to descriptors computed from your structures. None of
          them is a measurement, and none is a verdict on a compound.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {RULE_DOCS.map((rule) => {
          const source = SOURCES[rule.source];
          return (
            <div key={rule.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{rule.title}</h3>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{rule.thresholds}</code>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{rule.what}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {source.citation}{" "}
                <a
                  href={`https://doi.org/${source.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  doi:{source.doi}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>{" "}
                &middot;{" "}
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                  PMID {source.pmid}
                </a>
              </p>
            </div>
          );
        })}

        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Where the substructure patterns come from</p>
          <p className="mt-1">
            {patternTotal ? `${patternTotal} SMARTS patterns` : "The SMARTS patterns"}
            {counts
              ? ` (PAINS A ${counts.PAINS_A}, B ${counts.PAINS_B}, C ${counts.PAINS_C}; Brenk ${counts.BRENK})`
              : ""}{" "}
            are taken verbatim from the RDKit FilterCatalog source data at a pinned release, which is the same data
            RDKit&apos;s own PAINS and Brenk catalogs are built from. They are not transcribed by hand.
          </p>
          {catalog && (
            <p className="mt-1">
              {catalog.provenance.patternsFrom}.{" "}
              <a
                href={catalog.provenance.patternsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Source files
              </a>
              . {catalog.provenance.license}
            </p>
          )}
        </div>

        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">What this page does not do</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              No absorption, distribution, metabolism, excretion or toxicity endpoint is estimated. hERG inhibition,
              cytochrome-P450 interaction and blood&ndash;brain-barrier penetration are not computed here.
            </li>
            <li>
              No machine-learning or statistical model is used anywhere on this page. Every number is a descriptor
              RDKit computes directly from the structure you supply.
            </li>
            <li>
              QED (quantitative estimate of drug-likeness) is not shown: the RDKit WebAssembly build does not expose
              it, and this page will not substitute a reimplementation for it.
            </li>
            <li>
              A rule crossing or a pattern match is a prompt to look closer, not a reason to discard a compound.
              Aspirin matches a Brenk pattern; many approved drugs cross a Lipinski threshold.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

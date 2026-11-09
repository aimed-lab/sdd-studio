import { Fragment } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

export function PathwayDiagram({ steps, gene }: { steps: string[]; gene: string }) {
  return (
    <figure className="space-y-1.5">
      <div
        role="img"
        aria-label={`Pathway schematic: ${steps.join(" to ")}`}
        className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center"
      >
        {steps.map((step, i) => (
          <Fragment key={`${step}-${i}`}>
            {i > 0 && (
              <span aria-hidden className="text-muted-foreground">
                <ArrowDown className="h-4 w-4 sm:hidden" />
                <ArrowRight className="hidden h-4 w-4 sm:block" />
              </span>
            )}
            <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {step}
            </span>
          </Fragment>
        ))}
      </div>
      <figcaption className="text-[11px] text-muted-foreground">
        Schematic of the steps named in this study; not a curated pathway model.{" "}
        <a
          href={`https://reactome.org/content/query?q=${encodeURIComponent(gene)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          Search Reactome for {gene}
        </a>
      </figcaption>
    </figure>
  );
}

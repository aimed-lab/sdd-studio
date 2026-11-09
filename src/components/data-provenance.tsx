import { AlertTriangle, BadgeCheck } from "lucide-react";

export const DEMO_DATA_LABEL = "illustrative demo data (not curated)";

export function DemoDataNotice({ variant = "demo" }: { variant?: "demo" | "planned" }) {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {variant === "planned" ? (
        <span>
          <strong>Planned capabilities.</strong> Models, agents, tools and results listed here are a catalog preview.
          None are executed on this platform unless a run record is shown; benchmark and usage figures are illustrative.
        </span>
      ) : (
        <span>
          <strong>Illustrative demo data.</strong> Entries, scores, IDs and evidence statements on this page are
          placeholders, not from a curated source. Do not cite or use them for decisions.
        </span>
      )}
    </div>
  );
}

export function SourceLine({ name, url, retrieved }: { name: string; url: string; retrieved?: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Source:{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
        {name}
      </a>
      {retrieved && <> (live query), retrieved {new Date(retrieved).toLocaleString()}</>}
    </p>
  );
}

export function CuratedLabel({ reviewed }: { reviewed: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
      <BadgeCheck className="h-3.5 w-3.5" />
      Curated, cited &middot; reviewed {reviewed}
    </span>
  );
}

import { AlertTriangle, BadgeCheck, Layers, Lightbulb, Radio } from "lucide-react";
import type { DataClass, PageClass } from "@/data/page-classes";

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

const CLASS_STYLE: Record<Exclude<DataClass, "app">, { label: string; long: string; icon: typeof Radio; className: string }> = {
  live: {
    label: "Live",
    long: "Live data, fetched from the source on request",
    icon: Radio,
    className: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  },
  curated: {
    label: "Curated",
    long: "Curated, cited reference data",
    icon: BadgeCheck,
    className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  demo: {
    label: "Demo",
    long: "Illustrative demo data, not curated",
    icon: AlertTriangle,
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  },
  mixed: {
    label: "Mixed",
    long: "This page mixes live or curated sections with demo sections",
    icon: Layers,
    className: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  },
  planned: {
    label: "Planned",
    long: "Planned capabilities, not executed on this platform",
    icon: Lightbulb,
    className: "border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  },
};

/** Text label plus icon, so the class never relies on colour alone. */
export function DataClassBadge({ kind, size = "md" }: { kind: DataClass; size?: "sm" | "md" }) {
  if (kind === "app") return null;
  const style = CLASS_STYLE[kind];
  const Icon = style.icon;
  return (
    <span
      title={style.long}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium ${style.className} ${
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} aria-hidden="true" />
      {style.label}
      <span className="sr-only">: {style.long}</span>
    </span>
  );
}

/** Page-level statement of what kind of data a live, curated or mixed page shows. Demo pages already carry DemoDataNotice. */
export function PageClassStrip({ pageClass }: { pageClass: PageClass | undefined }) {
  if (!pageClass) return null;
  const kind = pageClass.kind;
  if (kind !== "live" && kind !== "curated" && kind !== "mixed") return null;
  return (
    <div role="note" className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:px-8">
      <DataClassBadge kind={kind} />
      {kind === "mixed" ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {pageClass.sections?.map((sec) => (
            <span key={sec.label} className="inline-flex items-center gap-1">
              <DataClassBadge kind={sec.kind} size="sm" />
              {sec.label}
            </span>
          ))}
        </span>
      ) : (
        <span>{CLASS_STYLE[kind].long}.</span>
      )}
    </div>
  );
}

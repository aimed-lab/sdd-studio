"use client";

// Shared shapes and small pieces for the compute-job pages (docs/sparc-jobs-plan.md).

export interface Job {
  id: string;
  project: string;
  kind: string;
  title: string;
  status: string;
  params: Record<string, unknown>;
  estGpuHours: number;
  clusterPreference: string | null;
  cluster: string | null;
  externalId: string | null;
  resultIteration: number | null;
  error: string | null;
  dryRun: boolean;
  noPhi: boolean;
  createdAt: string;
  decidedAt: string | null;
  claimedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  requestedBy?: string;
  requestedRole?: string | null;
}

export interface JobEvent {
  at: string;
  status: string;
  actor: string;
  actorType: string;
  note: string | null;
}

export const KIND_LABEL: Record<string, string> = {
  docking: "Docking",
  "generative-design": "Generative design",
};

const STATUS_STYLE: Record<string, { label: string; className: string; help: string }> = {
  pending: {
    label: "Waiting for approval",
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    help: "An Owner or Admin has to approve this request before it can be queued.",
  },
  queued: {
    label: "Queued",
    className: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    help: "Approved. A SPARC runner will claim it on its next poll.",
  },
  claimed: {
    label: "Claimed by a runner",
    className: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    help: "A runner has the job and is preparing the submission.",
  },
  submitted: {
    label: "Submitted to the cluster",
    className: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    help: "Accepted by SPARCq and waiting in the cluster's queue.",
  },
  running: {
    label: "Running",
    className: "border-violet-400 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-900/50 dark:text-violet-100",
    help: "Executing on a compute node.",
  },
  succeeded: {
    label: "Finished",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    help: "Results were pushed to the project as an iteration.",
  },
  failed: {
    label: "Failed",
    className: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200",
    help: "The job did not finish. The message says why.",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    help: "Withdrawn before it ran.",
  },
  rejected: {
    label: "Rejected",
    className: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    help: "An Owner or Admin refused the request.",
  },
};

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const s = STATUS_STYLE[status] ?? {
    label: status,
    className: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
    help: status,
  };
  return (
    <span
      title={s.help}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium ${s.className} ${
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      {s.label}
    </span>
  );
}

export function TestDataBadge() {
  return (
    <span
      title="A dry run: the results are synthetic test data written by the runner, not a cluster result."
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      Dry run · test data
    </span>
  );
}

/** Results are computations, never measurements. Shown on every page that lists a finished job. */
export function InSilicoNote() {
  return (
    <p className="text-xs text-muted-foreground">
      Docking scores and proposed structures are in-silico results — computational estimates, not experimental
      measurements. A dry run&apos;s numbers are synthetic test data and mean nothing scientifically.
    </p>
  );
}

export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export const shortWhen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

/** A one-line summary of what a request asks for, from its validated params. */
export function describeParams(kind: string, params: Record<string, unknown>): string {
  const p = params as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    if (kind === "docking") {
      const receptor = p.receptor?.source === "pdb" ? `PDB ${p.receptor.pdbId}${p.receptor.chain ? ` chain ${p.receptor.chain}` : ""}` : `file ${p.receptor?.path}`;
      const ligands =
        p.ligands?.source === "smiles"
          ? `${p.ligands.smiles.length} pasted structure${p.ligands.smiles.length === 1 ? "" : "s"}`
          : `table ${p.ligands?.table}.${p.ligands?.column} (up to ${p.ligands?.limit})`;
      const site =
        p.site?.mode === "box"
          ? `box ${p.site.size.x}×${p.site.size.y}×${p.site.size.z} Å at (${p.site.center.x}, ${p.site.center.y}, ${p.site.center.z})`
          : `centred on ligand ${p.site?.ligand} + ${p.site?.padding} Å`;
      return `${receptor} · ${ligands} · ${site}`;
    }
    const seeds =
      p.seeds?.source === "smiles"
        ? `${p.seeds.smiles.length} seed structure${p.seeds.smiles.length === 1 ? "" : "s"}`
        : `seeds from table ${p.seeds?.table}.${p.seeds?.column}`;
    return `${seeds} · ${p.count} proposals · objectives: ${(p.objectives ?? []).join(", ")}${p.target ? ` · target ${p.target}` : ""}`;
  } catch {
    return "—";
  }
}

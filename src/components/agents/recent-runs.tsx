"use client";

import Link from "next/link";
import { AGENT_NAMES, type RunSummary, STATUS_LABELS, runTitle, usd } from "@/lib/agents/client";
import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  ok: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  no_data: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  refused: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export function RecentRuns({ runs, error }: { runs: RunSummary[] | null; error?: string | null }) {
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!runs) return <p className="text-sm text-muted-foreground">Loading your runs…</p>;
  if (!runs.length) return <p className="text-sm text-muted-foreground">You have no agent runs yet. Runs you start appear here with their cost.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Agent</th>
            <th className="px-3 py-2 font-medium">Input</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              <td className="whitespace-nowrap px-3 py-2">{AGENT_NAMES[r.agent] ?? r.agent}</td>
              <td className="max-w-[28rem] px-3 py-2">
                <Link href={`/services/runs/${r.id}`} className="line-clamp-2 text-primary underline-offset-2 hover:underline">
                  {runTitle(r) || "(no input)"}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusStyle[r.status])}>{STATUS_LABELS[r.status] ?? r.status}</span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {usd(r.cost_usd)}
                {r.key_source === "member" && <span className="ml-1 text-[10px] text-muted-foreground">(your key)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { Download } from "lucide-react";
import { DEMO_DATA_LABEL } from "@/components/data-provenance";
import { cn } from "@/lib/utils";

type Cell = string | number | boolean | null | undefined | string[];

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Prefix formula-leading characters so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends object>(
  rows: T[],
  columns?: (keyof T)[],
  extra?: Record<string, string>
): string {
  if (rows.length === 0) return "";
  const keys = columns ?? (Object.keys(rows[0]) as (keyof T)[]);
  const extraKeys = Object.keys(extra ?? {});
  const header = [...extraKeys, ...keys.map(String)].map((k) => escapeCell(k)).join(",");
  const body = rows.map((row) =>
    [...extraKeys.map((k) => escapeCell(extra![k])), ...keys.map((k) => escapeCell(row[k] as Cell))].join(",")
  );
  return [header, ...body].join("\n");
}

export function ExportCsvButton<T extends object>({
  rows,
  filename,
  columns,
  className,
  demo,
  source,
}: {
  rows: T[];
  filename: string;
  columns?: (keyof T)[];
  className?: string;
  demo?: boolean;
  source?: { name: string; retrieved?: string };
}) {
  const handleExport = () => {
    const extra: Record<string, string> = {};
    if (demo) extra.data_status = DEMO_DATA_LABEL;
    if (source) {
      extra.source = source.name;
      if (source.retrieved) extra.retrieved = source.retrieved;
    }
    const blob = new Blob([toCsv(rows, columns, extra)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium",
        "hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
}

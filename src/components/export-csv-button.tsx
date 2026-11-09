"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell = string | number | boolean | null | undefined | string[];

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Prefix formula-leading characters so spreadsheets don't execute them.
  const safe = /^[=+\-@]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends object>(rows: T[], columns?: (keyof T)[]): string {
  if (rows.length === 0) return "";
  const keys = columns ?? (Object.keys(rows[0]) as (keyof T)[]);
  const header = keys.map((k) => escapeCell(String(k))).join(",");
  const body = rows.map((row) => keys.map((k) => escapeCell(row[k] as Cell)).join(","));
  return [header, ...body].join("\n");
}

export function ExportCsvButton<T extends object>({
  rows,
  filename,
  columns,
  className,
}: {
  rows: T[];
  filename: string;
  columns?: (keyof T)[];
  className?: string;
}) {
  const handleExport = () => {
    const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
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

"use client";

import { type UsageInfo, usd } from "@/lib/agents/client";
import { cn } from "@/lib/utils";

function Bar({ used, limit, label, hint }: { used: number; limit: number; label: string; hint: string }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  const over = used >= limit;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums", over ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
          {usd(used)} of {usd(limit)}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(used * 100) / 100}
      >
        <div className={cn("h-full rounded-full", over ? "bg-red-500" : share > 0.8 ? "bg-amber-500" : "bg-primary")} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Lab-paid Claude usage against the monthly cap and this member's daily limit, from the usage records. */
export function UsageMeter({ usage, error }: { usage: UsageInfo | null; error?: string | null }) {
  if (error) return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (!usage) return <p className="text-xs text-muted-foreground">Loading usage…</p>;
  const { limits, spend } = usage;
  return (
    <div className="space-y-3">
      <Bar
        label="Lab budget this month"
        used={spend.labMonthUsd}
        limit={limits.monthlyCapUsd}
        hint={`All members together. Resets ${spend.nextMonth.slice(0, 10)} (UTC).`}
      />
      <Bar label="Your lab-paid use today" used={spend.memberLabTodayUsd} limit={limits.dailyLimitUsd} hint="Resets at 00:00 UTC." />
      {spend.memberOwnKeyMonthUsd > 0 && (
        <p className="text-[11px] text-muted-foreground">Paid with your own key this month: {usd(spend.memberOwnKeyMonthUsd)}.</p>
      )}
      {!usage.labAvailable && usage.blockedMessage && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {usage.blockedMessage} Runs can use your own Anthropic key from Settings → API Keys.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Model {usage.model} at ${usage.prices.input} per million input tokens and ${usage.prices.output} per million output tokens
        (Anthropic list price, checked {usage.prices.checked}). Each run&apos;s exact cost is in its run record.
      </p>
    </div>
  );
}

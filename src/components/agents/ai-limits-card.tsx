"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type UsageInfo, agentHeaders, usd } from "@/lib/agents/client";
import { UsageMeter } from "./usage-meter";

const inputClass =
  "w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Settings → API Keys: how agent runs are paid for (issue #71). The lab's key pays up to a monthly cap and
 * a per-member daily limit; past either, a run can use the member's own key. The Owner edits both limits.
 */
export function AiLimitsCard({ email }: { email: string | undefined }) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cap, setCap] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!email) return;
    fetch("/api/agents/usage", { headers: agentHeaders(email), cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setUsage(data as UsageInfo);
        setCap(String(data.limits.monthlyCapUsd));
        setLimit(String(data.limits.dailyLimitUsd));
      })
      .catch((e: Error) => setError(`AI usage is unavailable: ${e.message}`));
  }, [email]);

  useEffect(load, [load]);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch("/api/agents/usage", {
        method: "PUT",
        headers: agentHeaders(email, { "Content-Type": "application/json" }),
        body: JSON.stringify({ monthlyCapUsd: Number(cap), dailyLimitUsd: Number(limit) }),
      });
      const data = await res.json().catch(() => ({}));
      setSaved(res.ok ? "Saved." : data.error ?? `Could not save (HTTP ${res.status}).`);
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI agent usage</CardTitle>
        <CardDescription>
          The <a href="/services" className="text-primary underline underline-offset-2">Literature Mining and Clinical Trial Feasibility agents</a> run
          on the lab&apos;s Claude key up to a monthly lab budget and a daily limit per member. When either is used up, you can run with
          your own Anthropic key saved below: it is sent with that one request over HTTPS, used for that run only, and never stored on
          the server; Anthropic bills your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <UsageMeter usage={usage} error={error} />
        {usage && (
          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Limits</p>
            <div className="flex flex-wrap items-end gap-4">
              <label className="space-y-1 text-xs">
                <span className="block text-muted-foreground">Lab budget per month (US$)</span>
                <input className={inputClass} type="number" min={0} max={10000} step="1" value={cap} disabled={!usage.canEdit} onChange={(e) => setCap(e.target.value)} />
              </label>
              <label className="space-y-1 text-xs">
                <span className="block text-muted-foreground">Limit per member per day (US$)</span>
                <input className={inputClass} type="number" min={0} max={1000} step="0.5" value={limit} disabled={!usage.canEdit} onChange={(e) => setLimit(e.target.value)} />
              </label>
              {usage.canEdit && (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save limits"}
                </button>
              )}
              {saved && <span className="text-xs text-muted-foreground">{saved}</span>}
            </div>
            {!usage.canEdit && (
              <p className="text-xs text-muted-foreground">Only the Owner, signed in with single sign-on, can change these limits.</p>
            )}
          </div>
        )}
        {usage?.byMember && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Lab-paid use this month by member</p>
            {usage.byMember.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium" scope="col">Member</th>
                    <th className="py-1 text-right font-medium" scope="col">Claude calls</th>
                    <th className="py-1 text-right font-medium" scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.byMember.map((m) => (
                    <tr key={m.email} className="border-t">
                      <td className="py-1">{m.email}</td>
                      <td className="py-1 text-right tabular-nums">{m.calls}</td>
                      <td className="py-1 text-right tabular-nums">{usd(m.usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No lab-paid runs yet this month.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

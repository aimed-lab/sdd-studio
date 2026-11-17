"use client";

// Browser helpers for the agent API. With single sign-on on, the server identifies the member from the
// session cookie and ignores the email header; with the legacy sign-in it needs the signed-in email.

export const MEMBER_EMAIL_HEADER = "x-sdd-email";
export const MEMBER_KEY_HEADER = "x-anthropic-key";

export function agentHeaders(email: string | undefined, extra: Record<string, string> = {}): Record<string, string> {
  return { ...(email ? { [MEMBER_EMAIL_HEADER]: email } : {}), ...extra };
}

/** The member's own Anthropic key saved in this browser (Settings → API Keys), if any. */
export function savedAnthropicKey(): string | null {
  try {
    const raw = localStorage.getItem("sdd-api-keys");
    const key = raw ? (JSON.parse(raw) as Record<string, string>).anthropic?.trim() : "";
    return key && key.startsWith("sk-ant-") ? key : null;
  } catch {
    return null;
  }
}

export interface UsageInfo {
  limits: { monthlyCapUsd: number; dailyLimitUsd: number };
  spend: {
    labMonthUsd: number;
    memberLabTodayUsd: number;
    memberLabMonthUsd: number;
    memberOwnKeyMonthUsd: number;
    nextDay: string;
    nextMonth: string;
  };
  labKeyConfigured: boolean;
  labAvailable: boolean;
  blockedReason: string | null;
  blockedMessage: string | null;
  model: string;
  prices: { input: number; output: number; cacheRead: number; checked: string };
  canEdit: boolean;
  byMember: { email: string; usd: number; calls: number }[] | null;
}

export interface RunSummary {
  id: string;
  agent: "literature" | "trials";
  status: "ok" | "no_data" | "refused" | "error";
  inputs: Record<string, unknown>;
  cost_usd: number;
  key_source: "lab" | "member" | null;
  created_at: string;
}

export const AGENT_NAMES: Record<string, string> = {
  literature: "Literature Mining",
  trials: "Clinical Trial Feasibility",
};

export const STATUS_LABELS: Record<string, string> = {
  ok: "Completed",
  no_data: "No matching records",
  refused: "Declined by Claude",
  error: "Error",
};

export const usd = (v: number) => (v > 0 && v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);

export function runTitle(r: { agent: string; inputs: Record<string, unknown> }): string {
  const i = r.inputs ?? {};
  if (r.agent === "literature") return String(i.question ?? "");
  return [i.condition, i.intervention, i.location].filter(Boolean).join(" · ");
}

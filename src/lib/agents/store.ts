/**
 * Agent runs and AI usage (issue #71: lab-paid Claude usage up to a cap, then the member's own key).
 *
 * Tables (created on first use, additive only):
 *   ai_usage    one row per Claude API call: who, agent, model, tokens, cost, which key paid
 *   agent_runs  one row per agent run: inputs, data sources with retrieval time, output, cost
 *
 * Limits live in platform_settings and are edited by the Owner in Settings:
 *   ai_monthly_cap_usd  lab-paid spend per calendar month (UTC), all members together
 *   ai_daily_limit_usd  lab-paid spend per member per day (UTC)
 */
import { sql } from "@vercel/postgres";
import { getSetting, setSetting } from "@/lib/db";

export const DEFAULT_MONTHLY_CAP_USD = 200;
export const DEFAULT_DAILY_LIMIT_USD = 5;
const CAP_KEY = "ai_monthly_cap_usd";
const LIMIT_KEY = "ai_daily_limit_usd";

export type AgentId = "literature" | "trials";
export type KeySource = "lab" | "member";
export type RunStatus = "ok" | "no_data" | "refused" | "error";

export interface SourceRecord {
  name: string;
  url: string;
  queryUrl: string;
  retrieved: string;
  note?: string;
}

export interface AgentRun {
  id: string;
  user_email: string;
  agent: AgentId;
  status: RunStatus;
  inputs: Record<string, unknown>;
  sources: SourceRecord[];
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  key_source: KeySource | null;
  output: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

let migrated = false;

export async function ensureAgentSchema(): Promise<void> {
  if (migrated) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id                 BIGSERIAL PRIMARY KEY,
      user_email         TEXT NOT NULL,
      agent              TEXT NOT NULL,
      run_id             TEXT,
      model              TEXT NOT NULL,
      input_tokens       INTEGER NOT NULL DEFAULT 0,
      output_tokens      INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd           NUMERIC(12,6) NOT NULL DEFAULT 0,
      key_source         TEXT NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage (created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON ai_usage (user_email, created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id            TEXT PRIMARY KEY,
      user_email    TEXT NOT NULL,
      agent         TEXT NOT NULL,
      status        TEXT NOT NULL,
      inputs        JSONB NOT NULL,
      sources       JSONB NOT NULL DEFAULT '[]'::jsonb,
      model         TEXT,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd      NUMERIC(12,6) NOT NULL DEFAULT 0,
      key_source    TEXT,
      output        JSONB,
      error         TEXT,
      duration_ms   INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS agent_runs_user_idx ON agent_runs (user_email, created_at DESC)`;
  migrated = true;
}

// ── Limits ──────────────────────────────────────────────────────────────────

export interface AiLimits {
  monthlyCapUsd: number;
  dailyLimitUsd: number;
}

const parseUsd = (raw: string | null, fallback: number) => {
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export async function getAiLimits(): Promise<AiLimits> {
  const [cap, limit] = await Promise.all([getSetting(CAP_KEY), getSetting(LIMIT_KEY)]);
  return {
    monthlyCapUsd: parseUsd(cap, DEFAULT_MONTHLY_CAP_USD),
    dailyLimitUsd: parseUsd(limit, DEFAULT_DAILY_LIMIT_USD),
  };
}

export async function setAiLimits(limits: AiLimits): Promise<void> {
  await setSetting(CAP_KEY, String(limits.monthlyCapUsd));
  await setSetting(LIMIT_KEY, String(limits.dailyLimitUsd));
}

// ── Spend ───────────────────────────────────────────────────────────────────

export interface Spend {
  labMonthUsd: number;
  memberLabTodayUsd: number;
  memberLabMonthUsd: number;
  memberOwnKeyMonthUsd: number;
  monthStart: string;
  dayStart: string;
  nextDay: string;
  nextMonth: string;
}

function windows(now = new Date()) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextDay = new Date(dayStart.getTime() + 86_400_000);
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { dayStart, monthStart, nextDay, nextMonth };
}

export async function getSpend(email: string): Promise<Spend> {
  await ensureAgentSchema();
  const w = windows();
  const month = w.monthStart.toISOString();
  const day = w.dayStart.toISOString();
  const { rows } = await sql`
    SELECT
      COALESCE(SUM(cost_usd) FILTER (WHERE key_source = 'lab'), 0)                                               AS lab_month,
      COALESCE(SUM(cost_usd) FILTER (WHERE key_source = 'lab' AND user_email = ${email} AND created_at >= ${day}), 0) AS member_lab_today,
      COALESCE(SUM(cost_usd) FILTER (WHERE key_source = 'lab' AND user_email = ${email}), 0)                      AS member_lab_month,
      COALESCE(SUM(cost_usd) FILTER (WHERE key_source = 'member' AND user_email = ${email}), 0)                   AS member_own_month
    FROM ai_usage
    WHERE created_at >= ${month}
  `;
  const r = rows[0] ?? {};
  return {
    labMonthUsd: Number(r.lab_month ?? 0),
    memberLabTodayUsd: Number(r.member_lab_today ?? 0),
    memberLabMonthUsd: Number(r.member_lab_month ?? 0),
    memberOwnKeyMonthUsd: Number(r.member_own_month ?? 0),
    monthStart: month,
    dayStart: day,
    nextDay: w.nextDay.toISOString(),
    nextMonth: w.nextMonth.toISOString(),
  };
}

/** Lab-paid spend this month per member, largest first (for the Owner and Admins). */
export async function getLabSpendByMember(): Promise<{ email: string; usd: number; calls: number }[]> {
  await ensureAgentSchema();
  const month = windows().monthStart.toISOString();
  const { rows } = await sql`
    SELECT user_email, SUM(cost_usd) AS usd, COUNT(*) AS calls
    FROM ai_usage
    WHERE key_source = 'lab' AND created_at >= ${month}
    GROUP BY user_email
    ORDER BY usd DESC
    LIMIT 50
  `;
  return rows.map((r) => ({ email: String(r.user_email), usd: Number(r.usd), calls: Number(r.calls) }));
}

export type BudgetDecision =
  | { ok: true; keySource: "lab" }
  | { ok: false; reason: "monthly_cap" | "daily_limit" | "no_lab_key"; message: string };

/** Whether the lab key may pay for one more run by this member. */
export function labBudgetDecision(spend: Spend, limits: AiLimits, labKeyConfigured: boolean): BudgetDecision {
  if (!labKeyConfigured)
    return { ok: false, reason: "no_lab_key", message: "The lab's Claude key is not configured on this server." };
  if (spend.labMonthUsd >= limits.monthlyCapUsd)
    return {
      ok: false,
      reason: "monthly_cap",
      message: `The lab's AI budget for this month ($${limits.monthlyCapUsd.toFixed(2)}) is used up. It resets on ${spend.nextMonth.slice(0, 10)} (UTC).`,
    };
  if (spend.memberLabTodayUsd >= limits.dailyLimitUsd)
    return {
      ok: false,
      reason: "daily_limit",
      message: `You have used your daily lab-paid AI limit ($${limits.dailyLimitUsd.toFixed(2)}). It resets at 00:00 UTC.`,
    };
  return { ok: true, keySource: "lab" };
}

// ── Records ─────────────────────────────────────────────────────────────────

export interface UsageRow {
  email: string;
  agent: AgentId;
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  keySource: KeySource;
}

export async function recordUsage(u: UsageRow): Promise<void> {
  await ensureAgentSchema();
  await sql`
    INSERT INTO ai_usage (user_email, agent, run_id, model, input_tokens, output_tokens,
                          cache_read_tokens, cache_write_tokens, cost_usd, key_source)
    VALUES (${u.email}, ${u.agent}, ${u.runId}, ${u.model}, ${u.inputTokens}, ${u.outputTokens},
            ${u.cacheReadTokens}, ${u.cacheWriteTokens}, ${u.costUsd}, ${u.keySource})
  `;
}

export async function saveRun(run: Omit<AgentRun, "created_at">): Promise<void> {
  await ensureAgentSchema();
  await sql`
    INSERT INTO agent_runs (id, user_email, agent, status, inputs, sources, model, input_tokens, output_tokens,
                            cost_usd, key_source, output, error, duration_ms)
    VALUES (${run.id}, ${run.user_email}, ${run.agent}, ${run.status}, ${JSON.stringify(run.inputs)}::jsonb,
            ${JSON.stringify(run.sources)}::jsonb, ${run.model}, ${run.input_tokens}, ${run.output_tokens},
            ${run.cost_usd}, ${run.key_source}, ${run.output === null ? null : JSON.stringify(run.output)}::jsonb,
            ${run.error}, ${run.duration_ms})
  `;
}

const toRun = (r: Record<string, unknown>): AgentRun => ({
  ...(r as unknown as AgentRun),
  cost_usd: Number(r.cost_usd ?? 0),
  created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
});

export async function getRun(id: string): Promise<AgentRun | null> {
  await ensureAgentSchema();
  const { rows } = await sql`SELECT * FROM agent_runs WHERE id = ${id}`;
  return rows[0] ? toRun(rows[0]) : null;
}

export interface RunSummary {
  id: string;
  agent: AgentId;
  status: RunStatus;
  inputs: Record<string, unknown>;
  cost_usd: number;
  key_source: KeySource | null;
  created_at: string;
}

export async function listRuns(email: string, limit = 20): Promise<RunSummary[]> {
  await ensureAgentSchema();
  const { rows } = await sql`
    SELECT id, agent, status, inputs, cost_usd, key_source, created_at
    FROM agent_runs WHERE user_email = ${email}
    ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => toRun(r) as unknown as RunSummary);
}

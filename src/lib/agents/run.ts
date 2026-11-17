import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_KEY_HEADER, fail, noStore, resolveCaller } from "./caller";
import type { ClaudeOutcome } from "./claude";
import { AGENT_MODEL } from "./pricing";
import {
  type AgentId, type KeySource, type RunStatus, type SourceRecord,
  getAiLimits, getSpend, labBudgetDecision, recordUsage, saveRun,
} from "./store";

export interface AiAccess {
  apiKey: string;
  keySource: KeySource;
}

export interface AgentResult {
  status: RunStatus;
  sources: SourceRecord[];
  output: Record<string, unknown> | null;
  error: string | null;
  /** Set when Claude answered (including refusals); null when no Claude call was made or it failed. */
  claude: ClaudeOutcome<unknown> | null;
}

// A member's own key: Anthropic keys start with sk-ant-. Checked for shape only; Anthropic validates it.
const MEMBER_KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,300}$/;

// One run at a time per member on this server instance (a run takes up to a few minutes).
const inFlight = new Set<string>();

/**
 * The common path for every agent: identify the member, read the inputs, decide who pays
 * (the lab key within the monthly cap and the member's daily limit, else the member's own key sent
 * with this request, else a clear refusal), run the agent, then record usage and the run.
 */
export async function handleAgentRun<I extends object>(
  req: NextRequest,
  agent: AgentId,
  parse: (body: Record<string, unknown>) => I | string,
  execute: (inputs: I, ai: AiAccess) => Promise<AgentResult>
): Promise<NextResponse> {
  const who = await resolveCaller(req);
  if ("response" in who) return who.response;
  const { caller } = who;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(400, "Invalid JSON body");
  const inputs = parse(body as Record<string, unknown>);
  if (typeof inputs === "string") return fail(400, inputs);

  // The member's key is read from this request only. It is never written to the database or logs.
  const memberKey = (req.headers.get(MEMBER_KEY_HEADER) ?? "").trim();
  if (memberKey && !MEMBER_KEY_RE.test(memberKey)) return fail(400, "That does not look like an Anthropic API key (sk-ant-…).");

  let access: AiAccess;
  try {
    const [spend, limits] = await Promise.all([getSpend(caller.email), getAiLimits()]);
    const labKey = process.env.ANTHROPIC_API_KEY ?? "";
    const decision = labBudgetDecision(spend, limits, !!labKey);
    if (decision.ok) access = { apiKey: labKey, keySource: "lab" };
    else if (memberKey) access = { apiKey: memberKey, keySource: "member" };
    else return fail(402, decision.message, { code: "over_budget", reason: decision.reason });
  } catch (err) {
    console.error("[agents] usage lookup failed:", err);
    return fail(503, "Usage records are unavailable, so no run was started. Please try again.");
  }

  if (inFlight.has(caller.email)) return fail(429, "You already have an agent run in progress. Wait for it to finish.");
  inFlight.add(caller.email);
  const runId = randomUUID();
  const started = Date.now();
  try {
    let result: AgentResult;
    try {
      result = await execute(inputs, access);
    } catch (err) {
      console.error(`[agents] ${agent} run failed:`, err);
      result = { status: "error", sources: [], output: null, error: "The run failed unexpectedly.", claude: null };
    }

    const c = result.claude;
    if (c) {
      try {
        await recordUsage({
          email: caller.email,
          agent,
          runId,
          model: c.model,
          inputTokens: c.tokens.input,
          outputTokens: c.tokens.output,
          cacheReadTokens: c.tokens.cacheRead,
          cacheWriteTokens: c.tokens.cacheWrite,
          costUsd: c.costUsd,
          keySource: access.keySource,
        });
      } catch (err) {
        console.error("[agents] usage record failed:", err);
      }
    }

    await saveRun({
      id: runId,
      user_email: caller.email,
      agent,
      status: result.status,
      inputs: inputs as Record<string, unknown>,
      sources: result.sources,
      model: c ? c.model : null,
      input_tokens: c ? c.tokens.input + c.tokens.cacheRead + c.tokens.cacheWrite : 0,
      output_tokens: c ? c.tokens.output : 0,
      cost_usd: c ? c.costUsd : 0,
      key_source: c ? access.keySource : null,
      output: result.output ? { ...result.output, requestedModel: AGENT_MODEL } : null,
      error: result.error,
      duration_ms: Date.now() - started,
    });
    return NextResponse.json({ ok: true, runId, status: result.status, error: result.error }, { headers: noStore });
  } catch (err) {
    console.error("[agents] saving the run failed:", err);
    return fail(500, "The run finished but could not be saved.");
  } finally {
    inFlight.delete(caller.email);
  }
}

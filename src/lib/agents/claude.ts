import Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, costUsd, type TokenCounts } from "./pricing";
import type { KeySource } from "./store";

// One Claude call per agent run: adaptive thinking at medium effort, JSON output constrained to a schema,
// and Anthropic's server-side refusal fallback (a request declined by a safety classifier, for example
// on biology topics, is re-run on the fallback model Anthropic picks for that category).

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming & {
  /** Server-side refusal fallback (beta). Not yet in the installed SDK's types; sent as a body field. */
  fallbacks?: "default";
};

interface Iteration {
  type?: string;
  model?: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface ClaudeOutcome<T> {
  status: "ok" | "refused" | "error";
  data: T | null;
  error: string | null;
  /** Model that produced the final message (differs from AGENT_MODEL after a fallback). */
  model: string;
  fellBack: boolean;
  refusalCategory: string | null;
  tokens: TokenCounts;
  costUsd: number;
}

export class ClaudeCallError extends Error {}

const n = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? v : 0);

function userMessage(err: unknown, keySource: KeySource): string {
  const whose = keySource === "member" ? "Your Anthropic key" : "The lab's Claude key";
  if (err instanceof Anthropic.AuthenticationError)
    return `${whose} was rejected (401).${keySource === "member" ? " Check it in Settings → API Keys." : " Please tell the Owner."}`;
  if (err instanceof Anthropic.PermissionDeniedError) return `${whose} is not allowed to use ${AGENT_MODEL} (403).`;
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate-limited right now. Try again in a minute.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Claude did not answer in time. Try again.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API.";
  if (err instanceof Anthropic.APIError) return `The Claude API returned an error (${err.status ?? "unknown status"}).`;
  return "The Claude call failed.";
}

export async function callClaudeJson<T>(opts: {
  apiKey: string;
  keySource: KeySource;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<ClaudeOutcome<T>> {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 150_000, maxRetries: 1 });
  const base: Params = {
    model: AGENT_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: opts.schema } },
  };

  let msg: Anthropic.Beta.Messages.BetaMessage;
  try {
    try {
      msg = await client.beta.messages.create({ ...base, betas: [FALLBACK_BETA], fallbacks: "default" } as Params);
    } catch (err) {
      // An account or model without the fallback beta rejects the request outright (400): run it plainly.
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      console.warn("[agents] request with refusal fallback rejected; retrying without it:", err.message);
      msg = await client.beta.messages.create(base);
    }
  } catch (err) {
    throw new ClaudeCallError(userMessage(err, opts.keySource));
  }

  // Cost every attempt: usage.iterations lists each one (a declined attempt and the fallback that answered);
  // top-level usage covers only the final attempt.
  const iterations = ((msg.usage as unknown as { iterations?: Iteration[] | null }).iterations ?? []).filter(Boolean);
  const attempts: { model: string; t: TokenCounts }[] = iterations.length
    ? iterations.map((it) => ({
        model: it.model ?? (it.type === "fallback_message" ? msg.model : AGENT_MODEL),
        t: {
          input: n(it.input_tokens),
          output: n(it.output_tokens),
          cacheRead: n(it.cache_read_input_tokens),
          cacheWrite: n(it.cache_creation_input_tokens),
        },
      }))
    : [
        {
          model: msg.model,
          t: {
            input: n(msg.usage.input_tokens),
            output: n(msg.usage.output_tokens),
            cacheRead: n(msg.usage.cache_read_input_tokens),
            cacheWrite: n(msg.usage.cache_creation_input_tokens),
          },
        },
      ];
  const tokens = attempts.reduce<TokenCounts>(
    (s, a) => ({
      input: s.input + a.t.input,
      output: s.output + a.t.output,
      cacheRead: s.cacheRead + a.t.cacheRead,
      cacheWrite: s.cacheWrite + a.t.cacheWrite,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  );
  const cost = Math.round(attempts.reduce((s, a) => s + costUsd(a.model, a.t), 0) * 1_000_000) / 1_000_000;
  const fellBack = msg.model !== AGENT_MODEL || iterations.some((it) => it.type === "fallback_message");
  const common = { model: msg.model, fellBack, tokens, costUsd: cost };

  // Branch on stop_reason before reading content.
  const stop = msg.stop_reason as string | null;
  if (stop === "refusal") {
    const details = (msg as unknown as { stop_details?: { category?: string | null } | null }).stop_details;
    return { ...common, status: "refused", data: null, error: null, refusalCategory: details?.category ?? null };
  }
  if (stop === "max_tokens")
    return { ...common, status: "error", data: null, error: "Claude's answer hit the length limit and was cut off.", refusalCategory: null };

  const text = msg.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return { ...common, status: "ok", data: JSON.parse(text) as T, error: null, refusalCategory: null };
  } catch {
    return { ...common, status: "error", data: null, error: "Claude's answer was not valid JSON.", refusalCategory: null };
  }
}

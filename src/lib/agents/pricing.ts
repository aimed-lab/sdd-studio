// Claude list prices used to cost every agent call (US$ per million tokens).
// Source: Anthropic's published model pricing (platform.claude.com/docs/en/about-claude/pricing), checked 2026-11-17.
// Cache writes are 1.25x the input price (5-minute cache); cache reads are listed per model.
// Update this table when Anthropic changes prices; ai_usage keeps the cost computed at call time.

// Chosen by the Owner on 2026-11-17 (Claude Sonnet 5.5 rather than Opus, for cost).
export const AGENT_MODEL = "claude-sonnet-5-5";

interface Price {
  input: number;
  output: number;
  cacheRead: number;
}

export const PRICES_CHECKED = "2026-11-17";

export const MODEL_PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  // Server-side refusal fallback target for Claude Sonnet 5.5.
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  // Listed so a model change or an unexpected fallback is still costed at a known price.
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
};

// An unknown model (for example a new fallback target) is costed at the highest listed price,
// so usage is never under-counted against the cap.
const HIGHEST: Price = Object.values(MODEL_PRICES).reduce((a, b) => (b.output > a.output ? b : a));

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export function priceOf(model: string): { price: Price; known: boolean } {
  const price = MODEL_PRICES[model];
  return price ? { price, known: true } : { price: HIGHEST, known: false };
}

export function costUsd(model: string, t: TokenCounts): number {
  const { price } = priceOf(model);
  const usd =
    (t.input * price.input + t.output * price.output + t.cacheRead * price.cacheRead + t.cacheWrite * price.input * 1.25) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

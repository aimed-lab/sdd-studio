import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/session";

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the SmartDrugDiscovery platform assistant — an expert in both the platform itself and AI-assisted drug discovery (AIDD 2.0).

You help users:
1. Navigate the platform (Projects, Foundation Models, Tool Plugins, Add-on Services, Settings)
2. Understand roles and permissions (Owner, Admin, TechSupport, Developer, User)
3. Understand what data on the platform is real and what is illustrative
4. Answer drug discovery science questions when relevant
5. Log feedback, bugs, and ideas (direct the user to the Feedback tab)

Data status (be exact about this):
- LIVE data: compound search (/search) queries ChEMBL; the Trial Landscape tab (/clinical/trials) queries ClinicalTrials.gov API v2. Both show their source and retrieval time.
- CURATED data: the EGFR resistance-mechanism table on /targets, each row with a PubMed citation.
- Everything else (targets, compounds library, drugs, disease groups, cohorts, MoA studies, candidates, simulations, decisions, regulatory and business pages) is ILLUSTRATIVE DEMO DATA, marked with a banner. Never cite its numbers as facts.
- Foundation models, agents and tool plugins listed in the UI are a catalog of planned capabilities. No model, docking, ADMET or simulation is executed by the platform. Never say a prediction or analysis was run.
- You do not have live tool access. Do not present your own output as a platform prediction, and do not give numeric confidence scores for predictions.

Key platform facts:
- Version: see the About tab in Settings.
- Roles: Owner > Admin > TechSupport > Developer > User. Owner role is locked — transfer requires 24-hr cooling-off.
- Invitation system: two-gate model (invitation token + admin approval).
- Persistence: user accounts, invitations and settings are stored server-side (Vercel Postgres).
- AI Chat is powered by your own API key set in Settings → API Keys. Supported providers: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, Perplexity, Kimi (Moonshot), GLM (Zhipu AI).
- Projects have A.G.E. scores (Activity · Goal · Execution).
- Docs: /docs/ directory in the GitHub repo — roles, architecture, ownership transfer, API reference.
- Security & Compliance page: /security (Admin/Developer only).
- Support Dashboard: /support (TechSupport+ only).
- Access Control (RBAC module visibility): Settings → Access Control tab (Admin/Owner only).
- Members panel: Settings → Members tab (Admin/Owner only). Approval queue, user management, invitations.

Be concise, helpful, and accurate. When unsure, say so. For sensitive actions (deleting data, changing roles, financial info) always confirm before proceeding.`;

// ── Provider configurations ──────────────────────────────────────────────────

type Provider =
  | "anthropic" | "openai" | "groq"
  | "deepseek" | "kimi" | "glm"
  | "perplexity" | "google";

interface ProviderConfig {
  endpoint: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (model: string, messages: { role: string; content: string }[], system: string) => object;
  extractAnswer: (data: unknown) => string;
  models: string[];
}

/** Standard OpenAI-compatible response extractor */
const openaiExtract = (data: unknown): string => {
  const d = data as { choices: { message: { content: string } }[] };
  return d.choices?.[0]?.message?.content ?? "No response.";
};

/** Standard OpenAI-compatible headers */
const bearerHeaders = (key: string): Record<string, string> => ({
  "Authorization": `Bearer ${key}`,
  "content-type": "application/json",
});

/** Standard OpenAI-compatible body builder */
const openaiBody = (model: string, messages: { role: string; content: string }[], system: string) => ({
  model,
  max_tokens: 800,
  messages: [{ role: "system", content: system }, ...messages],
});

const PROVIDERS: Record<Provider, ProviderConfig> = {
  // ── Anthropic (custom API format) ────────────────────────────────────────
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    buildHeaders: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    }),
    buildBody: (model, messages, system) => ({
      model,
      max_tokens: 800,
      system,
      messages,
    }),
    extractAnswer: (data) => {
      const d = data as { content: { type: string; text: string }[] };
      return d.content.find((c) => c.type === "text")?.text ?? "No response.";
    },
    models: ["claude-sonnet-4-5", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  },

  // ── OpenAI ───────────────────────────────────────────────────────────────
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["gpt-4o", "gpt-4o-mini"],
  },

  // ── Google Gemini (OpenAI-compatible layer) ──────────────────────────────
  google: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["gemini-2.5-flash-preview-04-17", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["deepseek-chat", "deepseek-reasoner"],
  },

  // ── Groq ─────────────────────────────────────────────────────────────────
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },

  // ── Perplexity (search-augmented) ────────────────────────────────────────
  perplexity: {
    endpoint: "https://api.perplexity.ai/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["sonar-pro", "sonar"],
  },

  // ── Moonshot / Kimi ──────────────────────────────────────────────────────
  kimi: {
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k"],
  },

  // ── Zhipu / GLM ──────────────────────────────────────────────────────────
  glm: {
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    buildHeaders: bearerHeaders,
    buildBody: openaiBody,
    extractAnswer: openaiExtract,
    models: ["glm-4-plus", "glm-4-flash", "glm-4-long"],
  },
};

/** Friendly diagnostic messages for HTTP errors. */
const PROVIDER_DISPLAY: Record<Provider, string> = {
  anthropic: "Anthropic", openai: "OpenAI", groq: "Groq",
  deepseek: "DeepSeek", kimi: "Kimi (Moonshot)", glm: "GLM (Zhipu)",
  perplexity: "Perplexity", google: "Google Gemini",
};

function providerErrorMessage(provider: Provider, status: number, body: string): string {
  const providerName = PROVIDER_DISPLAY[provider] ?? provider;
  if (status === 401) {
    return `❌ **Invalid API key** — your ${providerName} API key was rejected. Go to **Settings → API Keys**, check the key, and save it.`;
  }
  if (status === 403) {
    return `❌ **Access denied** — your ${providerName} key doesn't have permission to use this model. Check your account plan.`;
  }
  if (status === 404) {
    return `❌ **Model not found** — the requested model isn't available on your ${providerName} account. Try a different model.`;
  }
  if (status === 429) {
    return "⏳ **Rate limit reached** — too many requests. Please wait a moment and try again.";
  }
  if (status === 529 || status === 503) {
    return `⏳ **${providerName} service temporarily unavailable** — please try again in a few seconds.`;
  }
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return `⚠️ ${providerName} error: ${parsed.error.message}`;
  } catch { /* ignore */ }
  return `⚠️ ${providerName} API returned HTTP ${status}. Please check your API key in Settings → API Keys.`;
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  try {
    const {
      question,
      pageContext,
      history = [],
      apiKey: clientKey,
      provider: requestedProvider = "anthropic",
    } = await req.json() as {
      question: string;
      pageContext?: string;
      role?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      apiKey?: string;
      provider?: Provider;
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    // User must supply their own key — no server-side fallback
    const apiKey = clientKey?.trim() || "";

    if (!apiKey) {
      return NextResponse.json(
        {
          answer: "⚙️ **Platform assistant requires an API key**\n\n" +
            "To activate the assistant:\n" +
            "1. Go to **Settings → API Keys**\n" +
            "2. Enter a key for at least one provider:\n" +
            "   Anthropic · OpenAI · Google Gemini · DeepSeek · Groq · Perplexity · Kimi · GLM\n" +
            "3. Click **Save API Keys**\n\n" +
            "The assistant will use whichever provider you configure. " +
            "Your key is stored locally in your browser and sent securely over HTTPS.",
        },
        { status: 200 }
      );
    }

    const provider = PROVIDERS[requestedProvider] ? requestedProvider : "anthropic";
    const config = PROVIDERS[provider];

    // Build messages: history + current question
    const messages = [
      ...history.slice(-6),
      {
        role: "user" as const,
        content: pageContext
          ? `[Current page: ${pageContext}]\n\n${question}`
          : question,
      },
    ];

    // Try models in the provider's fallback chain
    let lastStatus = 0;
    let lastBody   = "";

    for (const model of config.models) {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: config.buildHeaders(apiKey),
        body: JSON.stringify(config.buildBody(model, messages, SYSTEM_PROMPT)),
      });

      lastStatus = response.status;

      if (response.ok) {
        const data = await response.json();
        const answer = config.extractAnswer(data);
        return NextResponse.json({ answer, model, provider });
      }

      lastBody = await response.text();

      // Auth errors — no point trying other models
      if (response.status === 401 || response.status === 403) break;
      // 404 = model not available on this plan — try next
      if (response.status === 404) continue;
      // Other errors — break and report
      break;
    }

    console.error(`${provider} API error (${lastStatus}):`, lastBody);
    return NextResponse.json(
      { answer: providerErrorMessage(provider, lastStatus, lastBody) },
      { status: 200 }
    );
  } catch (err) {
    console.error("Assistant route error:", err);
    return NextResponse.json(
      { answer: "An unexpected error occurred. Please try again." },
      { status: 200 }
    );
  }
}

/** GET /api/assistant — connection health check */
export async function GET(req: NextRequest) {
  const clientKey = req.nextUrl.searchParams.get("key") ?? "";
  const provider  = (req.nextUrl.searchParams.get("provider") ?? "anthropic") as Provider;

  if (!clientKey.trim()) {
    return NextResponse.json({ ok: false, reason: "no_key" });
  }

  const config = PROVIDERS[provider];
  if (!config) {
    return NextResponse.json({ ok: false, reason: "unknown_provider" });
  }

  // Use the cheapest model for a health check
  const cheapModel = config.models[config.models.length - 1];
  const messages = [{ role: "user" as const, content: "hi" }];

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers: config.buildHeaders(clientKey.trim()),
    body: JSON.stringify(config.buildBody(cheapModel, messages, "Reply with one word.")),
  });

  if (res.ok) return NextResponse.json({ ok: true, provider });
  return NextResponse.json({ ok: false, status: res.status, provider });
}

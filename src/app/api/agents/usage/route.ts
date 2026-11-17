import { NextRequest, NextResponse } from "next/server";
import { canSeeAllRuns, fail, noStore, resolveCaller } from "@/lib/agents/caller";
import { AGENT_MODEL, MODEL_PRICES, PRICES_CHECKED } from "@/lib/agents/pricing";
import { getAiLimits, getLabSpendByMember, getSpend, labBudgetDecision, setAiLimits } from "@/lib/agents/store";
import { authorize } from "@/lib/session";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET — AI usage against the lab's monthly cap and the member's daily limit. */
export async function GET(req: NextRequest) {
  const who = await resolveCaller(req);
  if ("response" in who) return who.response;
  const { caller } = who;
  try {
    const [spend, limits] = await Promise.all([getSpend(caller.email), getAiLimits()]);
    const labKeyConfigured = !!process.env.ANTHROPIC_API_KEY;
    const decision = labBudgetDecision(spend, limits, labKeyConfigured);
    const isOwner = caller.verified && caller.role === "Owner";
    return NextResponse.json(
      {
        ok: true,
        limits,
        spend,
        labKeyConfigured,
        labAvailable: decision.ok,
        blockedReason: decision.ok ? null : decision.reason,
        blockedMessage: decision.ok ? null : decision.message,
        model: AGENT_MODEL,
        prices: { ...MODEL_PRICES[AGENT_MODEL], checked: PRICES_CHECKED },
        canEdit: isOwner,
        byMember: canSeeAllRuns(caller) ? await getLabSpendByMember() : null,
      },
      { headers: noStore }
    );
  } catch (err) {
    console.error("[agents] usage lookup failed:", err);
    return fail(503, "Usage records are unavailable right now.");
  }
}

/** PUT { monthlyCapUsd, dailyLimitUsd } — the signed-in Owner only (needs single sign-on). */
export async function PUT(req: NextRequest) {
  const auth = await authorize(req, "Owner");
  if (!auth.ok) return auth.response;
  // With single sign-on off the server cannot tell who is calling, so spending limits stay read-only.
  if (!auth.user) return fail(403, "Changing AI limits needs single sign-on as the Owner.");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail(400, "Invalid JSON body");
  }
  const cap = Number(body.monthlyCapUsd);
  const limit = Number(body.dailyLimitUsd);
  if (!Number.isFinite(cap) || cap < 0 || cap > 10000) return fail(400, "Monthly cap must be between $0 and $10,000.");
  if (!Number.isFinite(limit) || limit < 0 || limit > 1000) return fail(400, "Daily limit must be between $0 and $1,000.");
  const round = (v: number) => Math.round(v * 100) / 100;
  try {
    await setAiLimits({ monthlyCapUsd: round(cap), dailyLimitUsd: round(limit) });
    return NextResponse.json({ ok: true, limits: await getAiLimits() }, { headers: noStore });
  } catch (err) {
    console.error("[agents] saving limits failed:", err);
    return fail(500, "Could not save the limits.");
  }
}

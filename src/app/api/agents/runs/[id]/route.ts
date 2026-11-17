import { NextRequest, NextResponse } from "next/server";
import { canSeeAllRuns, fail, noStore, resolveCaller } from "@/lib/agents/caller";
import { getRun } from "@/lib/agents/store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** GET — one run record. Members see their own runs; a signed-in Owner or Admin sees any. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const who = await resolveCaller(req);
  if ("response" in who) return who.response;
  if (!ID_RE.test(params.id)) return fail(404, "Run not found.");
  try {
    const run = await getRun(params.id);
    if (!run || (run.user_email !== who.caller.email && !canSeeAllRuns(who.caller))) return fail(404, "Run not found.");
    return NextResponse.json({ ok: true, run, mine: run.user_email === who.caller.email }, { headers: noStore });
  } catch (err) {
    console.error("[agents] reading run failed:", err);
    return fail(503, "Run records are unavailable right now.");
  }
}

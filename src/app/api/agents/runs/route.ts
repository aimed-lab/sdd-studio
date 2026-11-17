import { NextRequest, NextResponse } from "next/server";
import { fail, noStore, resolveCaller } from "@/lib/agents/caller";
import { listRuns } from "@/lib/agents/store";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/** GET — the signed-in member's recent agent runs. */
export async function GET(req: NextRequest) {
  const who = await resolveCaller(req);
  if ("response" in who) return who.response;
  try {
    return NextResponse.json({ ok: true, runs: await listRuns(who.caller.email, 25) }, { headers: noStore });
  } catch (err) {
    console.error("[agents] listing runs failed:", err);
    return fail(503, "Run records are unavailable right now.");
  }
}

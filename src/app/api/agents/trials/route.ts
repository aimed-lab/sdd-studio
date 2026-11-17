import { NextRequest } from "next/server";
import { handleAgentRun } from "@/lib/agents/run";
import { parseTrialInputs, runTrials } from "@/lib/agents/trials";

// Reads and writes the database (usage, runs): never cached.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 300;

/** POST { condition, intervention?, location? } — members only. */
export async function POST(req: NextRequest) {
  return handleAgentRun(req, "trials", parseTrialInputs, runTrials);
}

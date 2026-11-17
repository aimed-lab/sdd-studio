import { NextRequest } from "next/server";
import { parseLiteratureInputs, runLiterature } from "@/lib/agents/literature";
import { handleAgentRun } from "@/lib/agents/run";

// Reads and writes the database (usage, runs): never cached.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 300;

/** POST { question, target?, compound?, pubmedQuery?, maxRecords?, sort? } — members only. */
export async function POST(req: NextRequest) {
  return handleAgentRun(req, "literature", parseLiteratureInputs, runLiterature);
}

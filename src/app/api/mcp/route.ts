import { NextRequest, NextResponse } from "next/server";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GET as searchGET } from "@/app/api/search/route";
import { GET as compoundGET } from "@/app/api/compound/[chemblId]/route";
import { GET as trialsGET } from "@/app/api/trials/route";
import { GET as structureGET } from "@/app/api/structure/route";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const SERVER_INFO = { name: "sdd-studio", version: "1.0.0" };

const PROVENANCE_NOTE =
  "Every result carries a `source` block (upstream, query URL, retrieval time, cache TTL, data release) and stable IDs. Read-only; demo data is never returned.";

const TOOLS = [
  {
    name: "search_compounds",
    description: `Search ChEMBL molecules by name, synonym or ChEMBL ID (q), or batch-look up up to 50 ChEMBL IDs (ids, comma-separated; mutually exclusive with q). Name search only: SMILES or InChIKey input is rejected (use structure_search). Up to 100 rows per call via offset/limit. ${PROVENANCE_NOTE}`,
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", maxLength: 100, description: "Compound name, synonym or ChEMBL ID" },
        ids: { type: "string", description: "Comma-separated ChEMBL IDs, at most 50" },
        offset: { type: "integer", minimum: 0, maximum: 10000 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_compound",
    description: `Mechanisms of action (resolved through the parent molecule, with target names and references) and up to 50 bioactivity rows with assay context for one ChEMBL molecule. Activity rows are a subset in ChEMBL record order, not a potency or selectivity ranking; the total count is returned. ${PROVENANCE_NOTE}`,
    inputSchema: {
      type: "object",
      properties: { chemblId: { type: "string", pattern: "^CHEMBL\\d+$", description: "e.g. CHEMBL1336" } },
      required: ["chemblId"],
      additionalProperties: false,
    },
  },
  {
    name: "search_trials",
    description: `Search ClinicalTrials.gov (25 per page; follow nextPageToken). Gene symbols that collide with other terms (e.g. EGFR vs eGFR) are disambiguated by default; set disambiguate=false to search unmodified, or withExcludedCount=true to learn how many trials the disambiguation hid. Opt-in mode=drug-aware (single gene-symbol term) also ORs in up to 10 approved drugs whose ChEMBL mechanism targets the gene; the drugs, the exact query sent and ChEMBL provenance are returned in drugAware, and rows found only by a drug carry viaDrug. Rows carry symbolMatch. Not medical advice: recruiting status is as of each trial's last update. ${PROVENANCE_NOTE}`,
    inputSchema: {
      type: "object",
      properties: {
        term: { type: "string", maxLength: 100 },
        condition: { type: "string", maxLength: 100 },
        intervention: { type: "string", maxLength: 100 },
        location: { type: "string", maxLength: 100, description: "Free-text location, e.g. 'Birmingham, Alabama'" },
        phase: { type: "string", enum: ["EARLY_PHASE1", "PHASE1", "PHASE2", "PHASE3", "PHASE4", "NA"] },
        status: {
          type: "string",
          enum: [
            "RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION",
            "COMPLETED", "TERMINATED", "WITHDRAWN", "SUSPENDED",
          ],
        },
        pageToken: { type: "string" },
        disambiguate: { type: "boolean" },
        fieldsGeneOnly: { type: "boolean" },
        withExcludedCount: { type: "boolean" },
        mode: { type: "string", enum: ["default", "drug-aware"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "structure_search",
    description: `ChEMBL structure search by SMILES (max 200 characters). mode=similarity (threshold 70–100) or substructure (queries under 7 heavy atoms are refused as too broad). At most 25 per page and 100 in total. Distinguishes zero hits, timed out and upstream error. Slow substructure queries can exceed this endpoint's 15 s budget; use GET /api/structure for those. ${PROVENANCE_NOTE}`,
    inputSchema: {
      type: "object",
      properties: {
        smiles: { type: "string", maxLength: 200 },
        mode: { type: "string", enum: ["similarity", "substructure"] },
        threshold: { type: "integer", minimum: 70, maximum: 100 },
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 25 },
      },
      required: ["smiles"],
      additionalProperties: false,
    },
  },
] as const;

type Args = Record<string, unknown>;

function toQuery(args: Args): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
}

// Tools call the REST route handlers themselves, so validation, caching and provenance stay in one code path.
async function runTool(name: string, args: Args, origin: string): Promise<Response> {
  const at = (path: string, params?: URLSearchParams) =>
    new NextRequest(new URL(`${path}${params && params.size ? `?${params}` : ""}`, origin));
  switch (name) {
    case "search_compounds":
      return searchGET(at("/api/search", toQuery(args)));
    case "get_compound": {
      const id = String(args.chemblId ?? "");
      return compoundGET(at(`/api/compound/${encodeURIComponent(id)}`), { params: { chemblId: id } });
    }
    case "search_trials":
      return trialsGET(at("/api/trials", toQuery(args)));
    case "structure_search":
      return structureGET(at("/api/structure", toQuery(args)));
    default:
      return NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 400 });
  }
}

function buildServer(origin: string): Server {
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...TOOLS] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const res = await runTool(request.params.name, (request.params.arguments ?? {}) as Args, origin);
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(body) }],
      structuredContent: body,
      isError: !res.ok,
    };
  });
  return server;
}

export async function POST(req: NextRequest) {
  // Stateless: a fresh server and transport per request, JSON responses only (no SSE sessions).
  const server = buildServer(req.nextUrl.origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close();
  }
}

const notAllowed = () =>
  NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this MCP endpoint is stateless and JSON-only; use POST." }, id: null },
    { status: 405, headers: { Allow: "POST" } }
  );

export const GET = notAllowed;
export const DELETE = notAllowed;

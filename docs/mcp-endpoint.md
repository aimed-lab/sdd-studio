# MCP endpoint

Studio has a read-only [Model Context Protocol](https://modelcontextprotocol.io) (MCP) endpoint, so an AI client such as Claude Code can query the same public data the Studio pages show: ChEMBL compounds, ClinicalTrials.gov trials and Open Targets evidence.

```
https://studio.smartdrugdiscovery.org/api/mcp
```

- **Open.** No sign-in and no key. It serves public data only and never returns demo data.
- **Read-only.** It changes nothing in Studio.
- **Transport.** Streamable HTTP, stateless, JSON responses only: no sessions and no server-sent events. Send `POST`; `GET` and `DELETE` return `405`.
- **Not in public registries.** The endpoint is not listed in any public MCP registry (the owner's decision, #73). Share the URL directly.

Setup steps on this page were last run on 2026-11-17 against production.

## Tools

Each tool calls the same handler as its REST route in the [data API](api-reference.md#read-only-json-api), so validation, caching and provenance are identical.

| Tool | What it returns | Same as | Limits |
|---|---|---|---|
| `search_compounds` | ChEMBL molecules by name, synonym or ChEMBL ID, or a batch of up to 50 IDs (`ids`) | `GET /api/search` | No SMILES (use `structure_search`); up to 100 rows per call |
| `get_compound` | Mechanisms of action (through the parent molecule) and bioactivity rows for one ChEMBL ID | `GET /api/compound/{chemblId}` | Up to 50 activity rows: a subset in ChEMBL record order, not a potency ranking |
| `search_trials` | ClinicalTrials.gov studies by term, condition, intervention, location, phase and status | `GET /api/trials` | 25 per page; gene-symbol disambiguation on by default (EGFR excludes "glomerular"); not medical advice |
| `structure_search` | ChEMBL similarity (threshold 70–100) or substructure search by SMILES | `GET /api/structure` | SMILES up to 200 characters; substructure queries need 7 or more heavy atoms; slow queries can exceed the 15 s budget |
| `get_target_evidence` | Open Targets disease associations, tractability and drug-candidate count for one gene | `GET /api/target-evidence` | Approved gene symbol only; up to 50 associations; scores are Open Targets' own, not predictions |

Every result carries a `source` block (upstream, query URL, retrieval time, cache lifetime, data release) and stable IDs (ChEMBL ID, NCT ID, Ensembl ID). Results come back both as JSON text and as `structuredContent`. A failed call returns `isError: true` with the REST error message.

## Set up

### Claude Code

```bash
claude mcp add --transport http sdd-studio https://studio.smartdrugdiscovery.org/api/mcp
```

This adds the server for you in the current folder. To share it with everyone who opens a repository, add `--scope project`; Claude Code then writes a `.mcp.json` file at the repository root:

```json
{
  "mcpServers": {
    "sdd-studio": {
      "type": "http",
      "url": "https://studio.smartdrugdiscovery.org/api/mcp"
    }
  }
}
```

Claude Code asks each person to approve a server from `.mcp.json` the first time. Check the connection with `claude mcp list`, or with `/mcp` inside a session. Tested: Claude Code 2.1 connects and lists the five tools above.

### Claude Desktop and claude.ai

Claude Desktop's configuration file starts local servers. For a server reached by URL, the MCP documentation's [guide to remote servers](https://modelcontextprotocol.io/docs/develop/connect-remote-servers) uses a custom connector instead: **Settings → Connectors → Add → Add custom connector**, then paste the endpoint URL. No sign-in step follows, because the endpoint has none. We have not yet tried this route ourselves; tell us if it fails.

### Any other client, or a quick test

Any client that supports Streamable HTTP can use the URL. To check it by hand:

```bash
curl -s https://studio.smartdrugdiscovery.org/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The `Accept` header must list both types, or the endpoint answers `406`. A tool call looks like this:

```bash
curl -s https://studio.smartdrugdiscovery.org/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_target_evidence","arguments":{"gene":"EGFR","limit":2}}}'
```

## Limits

| Limit | Value |
|---|---|
| Rate | 20 requests at once, then 1 every 3 seconds (20 per minute), per IP address and per server instance. Every `POST` counts, including `initialize` and `tools/list` |
| Over the limit | HTTP `429` with `Retry-After` in seconds (a plain JSON body, not a JSON-RPC message) |
| Time per call | 15 seconds |
| Input | Checked by the REST handler: free text over 100 characters and unknown arguments (a typo such as `limt`) come back as `isError: true` with the reason |

## Other MCP servers for drug discovery

These servers are **run by others, not by Studio**. Studio does not call them; it queries ChEMBL and Open Targets through their REST and GraphQL APIs. They are listed in the `.mcp.json` of Anthropic's [bio-research plugin](https://github.com/anthropics/knowledge-work-plugins/tree/main/bio-research) for Claude. Each one connected from Claude Code without a sign-in on 2026-11-17.

| Server | URL | Run by | Tools |
|---|---|---|---|
| ChEMBL | `https://hcls.mcp.claude.com/chembl/mcp` | Listed as deepsense.ai in the plugin README | `compound_search`, `drug_search`, `target_search`, `get_bioactivity`, `get_mechanism`, `get_admet` |
| Open Targets | `https://mcp.platform.opentargets.org/mcp` | Open Targets ([source](https://github.com/opentargets/platform-mcp), Apache-2.0, marked experimental) | `search_entities`, `query_open_targets_graphql`, `batch_query_open_targets_graphql`, `get_open_targets_graphql_schema`, `get_type_dependencies` |
| PubMed | `https://pubmed.mcp.claude.com/mcp` | Listed as the U.S. National Library of Medicine in the plugin README | `search_articles`, `get_article_metadata`, `get_full_text_article`, `find_related_articles`, `lookup_article_by_citation`, `convert_article_ids`, `get_copyright_status` |

Add one to Claude Code the same way:

```bash
claude mcp add --transport http chembl https://hcls.mcp.claude.com/chembl/mcp
claude mcp add --transport http open-targets https://mcp.platform.opentargets.org/mcp
claude mcp add --transport http pubmed https://pubmed.mcp.claude.com/mcp
```

Neither the plugin nor these servers' pages publish rate limits for the hosted services. Use them when you need something Studio's tools don't return, such as bioactivity by target (ChEMBL `get_bioactivity`), free-form Open Targets GraphQL queries, or literature search.

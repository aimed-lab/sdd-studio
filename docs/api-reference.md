# API Reference

This document specifies the internal Next.js API route handlers for SmartDrugDiscovery. All routes are located under `src/app/api/` and are served at `/api/...` relative to the application root.

Most routes here are **internal**: they serve the platform's own pages and the Admin Agent Console, and they can change between versions.

The exception is the three [read-only data routes](#read-only-json-api): `/api/search`, `/api/compound/{id}` and `/api/trials`. They are a **read-only JSON API, unauthenticated, and may change**. Treat them as a convenience for scripts and agents, not as a versioned, supported API.

---

## Authentication and Security

There is no session-token authentication on these routes in the current version (authentication is client-side only). Security is enforced through:

- **Vercel environment variable gating** — routes that require `GITHUB_TOKEN` or `ANTHROPIC_API_KEY` (admin analysis only) return `503` if those variables are not set.
- **`FEEDBACK_READ_KEY`** — the `GET /api/feedback` endpoint optionally checks a bearer key passed as a query parameter.
- **Deployment-level access control** — all routes are only reachable through the Vercel deployment, which can be restricted by Vercel Access policies.

Server-side secrets (GitHub token, Anthropic key) are never returned in any response body.

---

## Read-only JSON API

`GET /api/search`, `GET /api/compound/{chemblId}`, `GET /api/trials` and `GET /api/target-evidence` proxy public sources (ChEMBL, ClinicalTrials.gov and Open Targets). They need no sign-in, write nothing, and never return demo data. **Unauthenticated; may change.**

**Machine-readable contract:** [`/openapi.json`](https://studio.smartdrugdiscovery.org/openapi.json) (OpenAPI 3.1, file `public/openapi.json`) documents every parameter, response field, error shape and the provenance schema. `scripts/contract-test.mjs` checks the live API against it: on every PR that touches the API (against the PR's own build) and nightly against production (`.github/workflows/api-contract.yml`). A response field or parameter that isn't in the spec fails the test, so update the spec in the same PR as the handler.

### Common behaviour

| Behaviour | Detail |
|---|---|
| Unknown query parameters | `400` with the list of allowed parameters, so a typo such as `limt=50` never silently returns default results |
| Free-text length | `q`, `term` and `condition` are capped at 100 characters (`400` above that) |
| Rate limit | Per client IP, per server instance: `/api/search` and `/api/trials` allow a burst of 60 then 1 request/s; `/api/compound` a burst of 15 then 1 request every 4 s; `/api/target-evidence` a burst of 20 then 1 request every 3 s. Over the limit: `429` with `Retry-After` (seconds) |
| Caching | Successful responses carry `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`; upstream data is cached for up to 1 h (24 h for `/api/compound` and `/api/target-evidence`) |
| Upstream rejected the query | `400` — "<source> rejected the query (HTTP n). Check the query; this is not an outage." |
| Upstream down or timed out | `502` — "Source unavailable … No cached or demo data is shown in its place." |
| CORS | Not enabled; browser calls from other origins are blocked. Server-side and command-line clients are unaffected |

### Provenance object (`source`)

```json
{
  "name": "ChEMBL",
  "url": "https://www.ebi.ac.uk/chembl/",
  "queryUrl": "https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=imatinib&limit=25&offset=0",
  "retrieved": "2026-11-14T15:02:11.000Z",
  "cacheTtlSeconds": 3600,
  "release": { "version": "ChEMBL_37", "date": "2026-05-01" }
}
```

`retrieved` is when the upstream answered (from its `Date` header), not when you called — a cached answer keeps its original time. `release` is omitted if the upstream's release endpoint could not be reached.

### GET /api/search

ChEMBL molecule search by name, synonym or ChEMBL ID, or a batch lookup by ID.

| Parameter | Description |
|---|---|
| `q` | Name, synonym or ChEMBL ID. A SMILES string or InChIKey returns `400`: structure search is not supported |
| `offset` | `0`–`10000`, default `0` |
| `limit` | `1`–`100`, default `25` |
| `ids` | Batch lookup: comma-separated ChEMBL molecule IDs, at most 50, duplicates removed. Cannot be combined with `q`, `offset` or `limit`. Rows come back in request order; IDs ChEMBL doesn't know are listed in `notFound` |

```json
{
  "results": [
    {
      "chemblId": "CHEMBL1789941",
      "parentChemblId": "CHEMBL1789941",
      "isSalt": false,
      "name": "RUXOLITINIB",
      "smiles": "N#CC[C@H](C1CCCC1)n1cc(-c2ncnc3[nH]ccc23)cn1",
      "inchiKey": "HFNKQEVNSGCOJV-OAHLLOKOSA-N",
      "mw": 306.37, "logP": 3.47, "hba": 5, "hbd": 1, "psa": 83.18, "qed": 0.8,
      "maxPhase": 4,
      "moleculeType": "Small molecule"
    }
  ],
  "total": 7, "offset": 0, "limit": 25,
  "source": { "...": "provenance object" }
}
```

`maxPhase` is ChEMBL's `max_phase`: 4 approved, 1–3 clinical phase, 0.5 early phase 1, 0 preclinical, `null` unknown. Properties are ChEMBL-calculated values for the parent structure. Results put an exact name match first, then parent molecules before salts.

### GET /api/compound/{chemblId}

Mechanism of action and bioactivity for one molecule, resolved through its **parent** (ChEMBL often stores mechanisms on a salt record). Mechanisms and activities succeed or fail independently: a failed section has `error` set and the other is still returned.

```json
{
  "chemblId": "CHEMBL1200485",
  "parentChemblId": "CHEMBL1336",
  "mechanisms": {
    "error": null,
    "rows": [{ "recordChemblId": "CHEMBL1200485", "mechanism": "Serine/threonine-protein kinase RAF inhibitor",
               "actionType": "INHIBITOR", "targetChemblId": "CHEMBL1906",
               "targetName": "RAF proto-oncogene serine/threonine-protein kinase", "targetOrganism": "Homo sapiens",
               "refs": [{ "type": "FDA", "id": "label/2011/021923s012lbl.pdf", "url": "http://www.accessdata.fda.gov/…" }] }]
  },
  "activities": {
    "error": null, "total": 2035, "shown": 50, "flaggedExcluded": 0,
    "selection": "Activities with a pChEMBL value and no ChEMBL data-validity flag, in ChEMBL record order (activity_id) — not ranked by potency and not a selectivity profile.",
    "fullRecordUrl": "https://www.ebi.ac.uk/chembl/compound_report_card/CHEMBL1336/",
    "rows": [{ "activityId": 799367, "targetChemblId": "CHEMBL1906", "targetName": "RAF proto-oncogene serine/threonine-protein kinase",
               "targetOrganism": "Homo sapiens", "type": "IC50", "relation": "=", "value": "12.0", "units": "nM",
               "pchembl": "7.92", "assayChemblId": "CHEMBL766739", "assayType": "B", "documentChemblId": "CHEMBL1147437" }]
  },
  "source": { "...": "provenance object" }
}
```

`404` if the ID is not a ChEMBL molecule. Activity values come from different assays and are not directly comparable; `flaggedExcluded` counts pChEMBL activities ChEMBL flags as potentially invalid, which are left out.

### GET /api/trials

ClinicalTrials.gov API v2 search, 25 studies per page. Provide `term`, `condition`, or both.

| Parameter | Description |
|---|---|
| `term` | Free-text search (e.g. a gene or drug). Ambiguous gene symbols are disambiguated by default (`EGFR` excludes trials mentioning "glomerular", the eGFR kidney-function measure); the exact query sent is in `disambiguation.queryTerm` |
| `condition` | Condition search, e.g. `non-small cell lung cancer` |
| `intervention`, `location` | Intervention (`query.intr`) and free-text location (`query.locn`) searches |
| `disambiguate` | `false` turns the ambiguous-symbol exclusion off (default `true`) |
| `fieldsGeneOnly` | Opt-in: match a single gene symbol only in title, condition, keyword and intervention fields (lower recall) |
| `withExcludedCount` | `true` also returns `excludedCount`, the number of trials the disambiguation hid |
| `view` | `results` (default), `excluded` (the hidden trials) or `summary` (counts by phase, status, sponsor) |
| `phase` | One of `EARLY_PHASE1`, `PHASE1`, `PHASE2`, `PHASE3`, `PHASE4`, `NA` (case-insensitive). ClinicalTrials.gov counts combined phases, so `PHASE3` includes Phase 2/3 trials |
| `status` | One of `RECRUITING`, `NOT_YET_RECRUITING`, `ACTIVE_NOT_RECRUITING`, `ENROLLING_BY_INVITATION`, `COMPLETED`, `TERMINATED`, `WITHDRAWN`, `SUSPENDED` (case-insensitive) |
| `pageToken` | The `nextPageToken` from the previous page |

Provide at least one of `term`, `condition`, `intervention` or `location`. The full response schema, including `symbolMatch` per row and the `summary` view, is in `/openapi.json`. `source.release` carries the ClinicalTrials.gov API version and data timestamp when available.

### GET /api/target-evidence

Open Targets Platform evidence for one gene. The symbol is matched case-insensitively against Open Targets' approved symbols (HGNC) and resolved to its Ensembl ID through Open Targets search; aliases are not resolved. The site then runs one **fixed** GraphQL query with typed variables (Ensembl ID and row count); request text is never sent as query text.

| Parameter | Description |
|---|---|
| `gene` | Approved gene symbol, e.g. `EGFR`, `MAPT` (letters, digits and hyphens, ≤ 20 characters; anything else is `400`) |
| `limit` | Top disease associations to return, `1`–`50`, default `10` |

```json
{
  "gene": "MAPT",
  "ensemblId": "ENSG00000186868",
  "approvedName": "microtubule associated protein tau",
  "openTargetsUrl": "https://platform.opentargets.org/target/ENSG00000186868",
  "associations": {
    "total": 3002, "limit": 10,
    "rows": [{ "diseaseId": "MONDO_0017276", "diseaseName": "frontotemporal dementia", "score": 0.788,
               "datatypeScores": [{ "datatype": "genetic_association", "score": 0.951 }, { "datatype": "literature", "score": 0.984 }] }]
  },
  "tractability": [
    { "modality": "SM", "modalityLabel": "Small molecule",
      "evidence": [{ "label": "Approved Drug", "value": false }, { "label": "Structure with Ligand", "value": true }] },
    { "modality": "AB", "modalityLabel": "Antibody", "evidence": [{ "label": "Advanced Clinical", "value": true }] }
  ],
  "drugAndClinicalCandidates": 6,
  "note": "Association scores and tractability buckets are Open Targets' own metrics, reported as published; they are not predictions by this site.",
  "source": { "name": "Open Targets Platform", "queryUrl": "https://api.platform.opentargets.org/api/v4/graphql",
              "release": { "version": "26.09", "date": null }, "...": "provenance object" }
}
```

(Example values from release 26.09, shortened.) Scores and tractability labels are passed through exactly as Open Targets reports them; this site computes no scores of its own. Tractability modalities are `SM` small molecule, `AB` antibody, `PR` PROTAC and `OC` other modalities. `drugAndClinicalCandidates` is the count of Open Targets drug and clinical-candidate records for the target. `404` if the symbol is not an approved target symbol in Open Targets. `source.release` is the Open Targets data release (`YY.MM`). The `queryUrl` is the GraphQL endpoint; the request is a POST of the fixed query in `src/app/api/target-evidence/route.ts`.

### Agent and MCP access

- **This API:** point agent frameworks at `/openapi.json`; every tool call gets provenance and stable IDs (ChEMBL ID, NCT ID, Ensembl ID).
- **MCP endpoint (this site):** `POST https://studio.smartdrugdiscovery.org/api/mcp`, Streamable HTTP in stateless JSON-response mode (no sessions, no SSE; GET/DELETE return 405). It is read-only and unauthenticated, rate-limited per IP (20 burst, 20/min) and runs with a 15 s budget. Each tool calls the same handler as its REST route, so it applies the same validation, caching and provenance and never returns demo data:

  | Tool | Same as | Limits |
  |---|---|---|
  | `search_compounds` | `GET /api/search` | Name, synonym or ChEMBL ID, or `ids` batch (≤ 50); no SMILES; ≤ 100 rows per call |
  | `get_compound` | `GET /api/compound/{chemblId}` | Mechanisms via the parent molecule; ≤ 50 activity rows (a subset, not a potency ranking) |
  | `search_trials` | `GET /api/trials` | 25 per page; gene-symbol disambiguation on by default (`disambiguate`, `fieldsGeneOnly`, `withExcludedCount`); not medical advice |
  | `structure_search` | `GET /api/structure` | SMILES ≤ 200; similarity 70–100 or substructure ≥ 7 heavy atoms; slow substructure queries can exceed the 15 s budget |
  | `get_target_evidence` | `GET /api/target-evidence` | Approved gene symbol only; ≤ 50 associations; Open Targets' own scores, not predictions |

  Claude Code: `claude mcp add --transport http sdd-studio https://studio.smartdrugdiscovery.org/api/mcp`. The tool results carry `structuredContent` as well as the JSON text, and errors come back with `isError: true` and the REST error message. Per the #73 consensus, usage is reviewed 90 days after the endpoint is publicly listed: fewer than 50 tool calls from distinct non-panel clients means removal is recommended, and the PI decides. It is not registered in any external MCP registry yet; listing it there is the PI's call.
- **Upstream MCP servers for data this site doesn't cover:** Claude's **bio-research** plugin bundles a **ChEMBL** MCP server (tools such as `compound_search`, `target_search`, `get_bioactivity`, `get_mechanism`, `drug_search`, `get_admet`) and a **ClinicalTrials.gov** MCP server (`search_trials`, `get_trial_details`, `search_by_sponsor`, `search_by_eligibility`, `search_investigators`, `analyze_endpoints`), plus Open Targets, PubMed and bioRxiv servers. Use them directly for full target-centric bioactivity, eligibility matching and literature search.

---

## POST /api/assistant

Send a question to the platform AI assistant. The request must include a user-supplied API key (no server-side key is used). Supports 8 providers: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, Perplexity, Kimi (Moonshot), and GLM (Zhipu AI).

### Request body

```json
{
  "question": "How do I install a plugin?",
  "pageContext": "/plugins",
  "role": "Developer",
  "history": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer" }
  ],
  "apiKey": "sk-ant-...",
  "provider": "anthropic"
}
```

| Field | Required | Description |
|---|---|---|
| `question` | Yes | The user's question |
| `pageContext` | No | Current page path (prepended to the question for context) |
| `role` | No | User's platform role (informational, sent in system prompt) |
| `history` | No | Last N chat messages for conversational context (max 6 kept) |
| `apiKey` | Yes | User's API key for the chosen provider |
| `provider` | No | One of: `anthropic`, `openai`, `google`, `deepseek`, `groq`, `perplexity`, `kimi`, `glm`. Defaults to `anthropic`. |

### Response — 200 OK

```json
{
  "answer": "To install a plugin, navigate to Tool Plugins...",
  "model": "claude-sonnet-4-5",
  "provider": "anthropic"
}
```

If the API key is missing, the response is still 200 but `answer` contains setup instructions. If the provider API returns an error, `answer` contains a user-friendly diagnostic message.

### Model fallback chains

Each provider tries multiple models in order. If a model returns 404 (not available on the user's plan), the next model is tried.

| Provider | Models (in fallback order) |
|---|---|
| `anthropic` | `claude-sonnet-4-5` → `claude-3-5-sonnet-20241022` → `claude-3-haiku-20240307` |
| `openai` | `gpt-4o` → `gpt-4o-mini` |
| `google` | `gemini-2.5-flash-preview-04-17` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` |
| `deepseek` | `deepseek-chat` → `deepseek-reasoner` |
| `groq` | `llama-3.3-70b-versatile` → `llama-3.1-8b-instant` |
| `perplexity` | `sonar-pro` → `sonar` |
| `kimi` | `moonshot-v1-128k` → `moonshot-v1-32k` → `moonshot-v1-8k` |
| `glm` | `glm-4-plus` → `glm-4-flash` → `glm-4-long` |

---

## GET /api/assistant

Health check to verify a user's API key works with a given provider.

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `key` | Yes | The API key to verify |
| `provider` | No | Provider to test (default: `anthropic`) |

### Response — 200 OK

```json
{ "ok": true, "provider": "anthropic" }
```

or

```json
{ "ok": false, "status": 401, "provider": "anthropic" }
```

---

## POST /api/feedback

Submit a user feedback entry. Creates a GitHub Issue (if GitHub is configured) and appends the entry to `feedback-log.json` on the server filesystem.

### Request body

```json
{
  "type": "bug" | "enhancement" | "idea",
  "priority": "p0" | "p1" | "p2" | "p3",
  "title": "string (required)",
  "description": "string (optional)",
  "url": "string — current page URL",
  "pageTitle": "string — current page title",
  "user": {
    "name": "string",
    "email": "string"
  } | null,
  "timestamp": "ISO 8601 string",
  "attachments": [
    {
      "id": "string",
      "name": "filename.ext",
      "mimeType": "image/jpeg",
      "dataUrl": "data:image/jpeg;base64,...",
      "kind": "image" | "audio" | "file"
    }
  ]
}
```

`title` is the only required field. All other fields are optional and default gracefully.

### Response — 200 OK

```json
{
  "success": true,
  "id": "FB-1711234567890",
  "issueUrl": "https://github.com/owner/repo/issues/42" | null,
  "issueNumber": 42 | null
}
```

`issueUrl` and `issueNumber` are `null` when GitHub is not configured or the API call fails. Feedback is always saved to the local log regardless of GitHub status.

### Response — 400 Bad Request

```json
{ "error": "Title is required" }
```

### GitHub Issue format

When GitHub is configured, the created issue includes:

- **Title:** `[emoji] [PRIORITY] title` (e.g., `🐛 [P1] Login page throws 500 on empty password`)
- **Labels:** `type:{type}`, `priority:{priority}`, `feedback`
- **Body:** Structured Markdown table with submitter, page URL, date, description, and attachment list

Required environment variables: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.

---

## GET /api/feedback

List all feedback entries from `feedback-log.json`, sorted by priority then timestamp (newest first within each priority band).

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `key` | Conditional | Must match `FEEDBACK_READ_KEY` env var if that var is set |

### Response — 200 OK

Returns a JSON array of `FeedbackEntry` objects sorted by priority:

```json
[
  {
    "id": "FB-1711234567890",
    "type": "bug",
    "priority": "p0",
    "title": "Login page crashes on empty password",
    "description": "Steps to reproduce...",
    "url": "https://app.example.com/login",
    "pageTitle": "Login",
    "user": { "name": "Dr. Jane Smith", "email": "jsmith@uab.edu" },
    "timestamp": "2026-03-28T14:00:00.000Z",
    "attachments": [],
    "githubIssueUrl": "https://github.com/owner/repo/issues/5",
    "githubIssueNumber": 5
  }
]
```

### Response — 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

Returned when `FEEDBACK_READ_KEY` is set and the request does not include a matching `key` query parameter.

### Notes

- On Vercel's production filesystem (read-only), `feedback-log.json` cannot be written. In that case, feedback is only persisted to GitHub Issues. The GET endpoint returns an empty array if the file does not exist.
- Priority sort order: P0 > P1 > P2 > P3. Within a priority band, newest entries appear first.

---

## GET /api/admin/issues

Returns a merged list of open GitHub Issues (tagged `feedback`) and any local `feedback-log.json` entries that are not already represented in GitHub. Used by the Admin Agent Console to display the full issue queue.

### Request

No parameters required.

### Response — 200 OK

```json
{
  "items": [ /* array of FeedbackEntry objects, same shape as GET /api/feedback */ ],
  "githubConfigured": true,
  "anthropicConfigured": true,
  "repo": "owner/repo-name" | null
}
```

`githubConfigured` is `true` when all three GitHub env vars are present. `anthropicConfigured` is `true` when `ANTHROPIC_API_KEY` is set. These flags let the Admin Console UI show/hide the Analyze and Commit buttons appropriately.

### Deduplication logic

An item from `feedback-log.json` is omitted from the merged list if its `githubIssueNumber` matches an issue already fetched from the GitHub API. This prevents duplicates when both sources contain the same entry.

### GitHub API query

```
GET /repos/{owner}/{repo}/issues?labels=feedback&state=open&per_page=50&sort=created&direction=desc
```

---

## POST /api/admin/analyze

Sends a feedback item and one or more source files to Claude (claude-sonnet-4-6) for root-cause analysis and proposed code fix generation. This is the backend for the Admin Console's "Analyze" button.

**Maximum duration: 60 seconds** (set via `export const maxDuration = 60`).

Requires `ANTHROPIC_API_KEY` to be set, or returns `503`.

### Request body

```json
{
  "issue": {
    "id": "FB-1711234567890",
    "type": "bug",
    "priority": "p1",
    "title": "Login page crashes on empty password",
    "description": "Steps to reproduce...",
    "url": "https://app.example.com/login",
    "timestamp": "2026-03-28T14:00:00.000Z"
  },
  "filePaths": [
    "src/app/login/page.tsx",
    "src/lib/auth-context.tsx"
  ]
}
```

Files are fetched directly from the GitHub repository using the Contents API (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`). Files that cannot be fetched are silently skipped.

### Response — 200 OK

```json
{
  "analysis": "Root cause is X. The fix involves Y.",
  "effort": "small" | "medium" | "large",
  "changes": [
    {
      "file": "src/app/login/page.tsx",
      "description": "What this change does and why",
      "search": "exact verbatim multi-line text to replace",
      "replace": "new code to substitute in"
    }
  ],
  "reasoning": "One sentence on why these changes resolve the issue.",
  "commitMessage": "Fix: short imperative description",
  "needsFiles": ["src/path/to/another/file.tsx"]
}
```

`needsFiles` is present only when Claude determines it needs additional files not provided in the request. `changes` is an empty array in that case.

### Response — 503 Service Unavailable

```json
{ "error": "ANTHROPIC_API_KEY not configured" }
```

### Notes

- The `search` field in each change must be verbatim text from the source file. The `/api/admin/commit` route uses exact string matching against the live file content.
- Claude is instructed to keep changes minimal and focused on the reported issue.
- If no code change is needed, `changes` is `[]` and the explanation is in `analysis`.

---

## POST /api/admin/commit

Applies one or more AI-proposed code changes to files in the GitHub repository using the GitHub Contents API. Optionally closes the associated GitHub Issue if all changes succeed.

Requires `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` environment variables.

### Request body

```json
{
  "changes": [
    {
      "file": "src/app/login/page.tsx",
      "description": "Add null check for empty password",
      "search": "exact verbatim text from file to replace",
      "replace": "new replacement code"
    }
  ],
  "commitMessage": "Fix: add null check for empty password on login",
  "issueNumber": 42
}
```

`issueNumber` is optional. When provided and all changes succeed, the corresponding GitHub Issue is automatically closed with state reason `completed`.

The commit message is augmented with:
- `Closes #issueNumber` (when provided)
- `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

### Response — 200 OK

```json
{
  "results": [
    {
      "file": "src/app/login/page.tsx",
      "success": true,
      "commitUrl": "https://github.com/owner/repo/commit/abc123"
    }
  ],
  "allSuccess": true,
  "commitUrls": ["https://github.com/owner/repo/commit/abc123"]
}
```

When a change fails, the result for that file includes `success: false` and an `error` message:

```json
{
  "file": "src/app/login/page.tsx",
  "success": false,
  "error": "Search text not found verbatim in src/app/login/page.tsx. The file may have changed since analysis — re-analyze to refresh."
}
```

### Response — 503 Service Unavailable

```json
{ "error": "GitHub credentials not configured (GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO)" }
```

### Notes

- Changes are applied sequentially. A 500 ms delay is inserted between commits when multiple files are changed, to avoid race conditions on the same branch.
- The `search` field must match verbatim content in the live file. If the file has changed since the analyze call, the search will fail and the error message will prompt the user to re-analyze.
- Files are fetched fresh from GitHub immediately before each commit, so the `sha` used in the PUT request is always current.
- The GitHub Issue is only closed if **all** changes in the batch succeed.

---

## Related

- [Platform Architecture](platform-architecture.md) — environment variable reference and source file map
- [Getting Started](getting-started.md) — using the Feedback tab in the AI assistant widget

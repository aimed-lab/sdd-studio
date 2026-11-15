# RED round 3: final consensus text for confirmation

Round 2 results: Quality voted AGREE on #71 and #72 and AMEND on #70 and #73. Cost/Stability voted AGREE on #70 and #72 and AMEND on #71 and #73. Innovation voted AMEND on all four. All amendments are folded in below.

## #70 Public read-only access: CONSENSUS TEXT
Make /search, the /clinical/trials Trial Landscape tab and the curated /targets resistance table readable without sign-in, without waiting for SSO. Ship only with:
1. per-IP rate limiting on /api/search and /api/trials (Vercel WAF rule if available, else in-code token bucket), plus `Cache-Control: s-maxage` on public GETs
2. one public-route allowlist
3. a public shell showing only live and curated content, with:
   - provenance on every result
   - trial status shown with ClinicalTrials.gov's last-update date
   - a "not medical advice" notice on trials
   - no demo navigation
4. no LLM, no Postgres writes and no email-sending form on public pages
5. sidebar and landing links to the three live tools; the live trials tab is never labelled "Simulations"
6. shareable query URLs carrying query terms only

Option C (any Keycloak account) is the fallback if abuse appears.

## #71 AI assistant funding: CONSENSUS TEXT
Bring-your-own-key stays the default. The lab-funded tier ships only after #32 (no lab key on any route reachable without a server-verified session). Conditions:
- **Cost controls:**
  - hard global monthly cap, set by env var (default $25, set by the PI), failing closed to BYO
  - provider-side spend limit on a dedicated key
  - per-user daily quota kept server-side
- **Model choice:** the cheapest model that passes a small written accuracy and citation evaluation (T02, T04, T05, T08, T10, T29), run once per model change, not in CI.
- **Grounding is required:**
  - the assistant uses the one shared read-only tool registry from #73
  - at most 3 tool calls per question, counted toward quota and cap
  - every ID or number shown comes from a retrieved record
- **Ungrounded first release:** allowed only if labelled "general AI help, not site data", refusing PMIDs, NCT IDs and ChEMBL IDs, and followed by grounding within the same milestone.
- **Privacy:** no prompt retention beyond quota counters; a warning not to enter patient data.

## #72 Structure search: CONSENSUS TEXT
- **Similarity first:** ChEMBL similarity through the upstream helper, threshold 70–100, ≤ 25 per page and ≤ 100 total, 8 s timeout, 24 h cache.
- **Substructure:** added only with a minimum size of ≥ 6 heavy atoms, a 15 s timeout, and refusal of too-broad queries with an explanation.
- **Input validation:**
  - server-side length cap (200) and character checks
  - RDKit.js lazy-loaded in the browser only, for validation, canonical echo and drawing
- **Results:** each hit shows score, method, ChEMBL release, parent/salt and links.
- **States:** "incomplete/timed out", "upstream error" and "zero hits" are distinct.
- **Access:** exposed in the API, joins the shared tool registry (#73), and covered by the smoke test.
- **Sketcher:** deferred, with room left for drawing input later.

## #73 Agent and MCP access: CONSENSUS TEXT
- **Stage 0:**
  - unknown parameters return 400
  - an upstream 4xx is not reported as an outage
  - paging works
  - every response carries source, retrieval time, upstream link/version and stable IDs
  - demo data is never exposed through the API, spec or MCP

  These are in PR fix/green-2026-11-14, which must be **merged** first.
- **Stage 1:** a static OpenAPI 3.1 spec in /public, contract-tested in CI against the merged handlers, plus a docs page listing the upstream ChEMBL and CT.gov MCP servers.
- **Stage 2:** a thin stateless MCP route in a separate PR, right after the #70 rate limit, once the Stage 1 contract tests pass.
  - JSON-response mode only, no SSE sessions, no LLM inside, maxDuration ≤ 15 s
  - same handlers, cache and rate limit; the official MCP SDK is the only new dependency
  - tool descriptions state their limits
- **90-day review:**
  - The clock starts only once the endpoint is listed in a public MCP registry and on /plugins as working.
  - Usage is counted for MCP and OpenAPI traffic, tagged by client type.
  - If there are fewer than 50 tool calls from distinct non-panel clients, the review **recommends removal**. **The PI makes the final decision**, and the review date is recorded on the issue.
- **Stage 3** (authenticated tools) is deferred until private data exists.

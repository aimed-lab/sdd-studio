# RED round 2 — proposer's merged draft (from round-1 positions of Quality, Cost/Stability, Innovation)

## #70 Public read-only access
Make three things readable without signing in, now, without waiting for SSO:
- /search
- the /clinical/trials Trial Landscape tab
- the curated /targets resistance table

The APIs behind them are already public, so opening the pages adds discoverability, not attack surface. Ship only with:
1. per-IP rate limiting on /api/search and /api/trials (a Vercel WAF rule if the plan allows, else an in-code token bucket), plus `Cache-Control: s-maxage` on public GETs
2. a single public-route allowlist
3. a public shell that shows only live and curated content, with provenance on every result, a "not medical advice" notice on trials, and no demo navigation
4. no LLM, no Postgres writes and no email-sending form on public pages

Option C (any Keycloak account) is held back as a fallback if abuse appears.

**Disagreement to settle:** none substantive. Do you accept?

## #71 AI assistant funding
Bring-your-own-key stays the default now. A lab-funded tier comes only after #32 (server-verified SSO), with:
- a hard global monthly cap set by env var (PI sets the number; default $25), failing closed to BYO, plus a provider-side spend limit on a dedicated key
- a per-user daily quota stored server-side
- the cheapest model that passes a small written accuracy and citation evaluation (T02, T04, T05, T08, T10, T29)
- grounding: the assistant calls the same read-only tools as #73, and every ID or number it shows comes from a retrieved record
- no prompt retention beyond quota counters, and a no-patient-data warning

**Disagreement to settle:** Cost/Stability did not require grounding. Quality and Innovation do. Proposed compromise: grounding is required for the funded tier. A first funded release may be ungrounded only if it is labelled "general AI help, not site data" and refuses to output PMIDs, NCT IDs or ChEMBL IDs.

## #72 Structure search
- Use ChEMBL similarity first, through the upstream helper: threshold 70–100, ≤ 25 per page, ≤ 100 total, 8 s timeout, 24 h cache.
- Add substructure in the same or the next PR, but only with a minimum query size (≥ 6 heavy atoms), a 15 s timeout, and refusal of too-broad queries with an explanation.
- Server-side length cap (200) and character checks.
- RDKit.js lazy-loaded in the browser on the structure page only (validation, canonical echo, drawing). Never in a server function.
- Each hit shows score, method, ChEMBL release, parent/salt, and links.
- "Incomplete/timed out", "upstream error" and "zero hits" are distinct states.
- Exposed in the API, and covered by the smoke test.

**Disagreement to settle:** sketcher (Ketcher/JSME) now or later. Proposed: later.

## #73 Agent and MCP access
- **Stage 0:** unknown parameters return 400, an upstream 4xx is not reported as an outage, and paging works. These are already in green PR fix/green-2026-11-14.
- **Stage 1 (now):** a static OpenAPI 3.1 spec served from /public, contract-tested in CI, plus a docs page that lists the upstream ChEMBL and CT.gov MCP servers.
- **Stage 2:** a thin stateless MCP route (JSON-response mode, maxDuration ≤ 15 s, same handlers, read-only, same rate limit, tool descriptions state their limits). Built right after the #70 rate limit ships, with a 90-day usage review: remove it if it gets almost no use.
- **Stage 3** (authenticated tools) is deferred until private data exists.

**Disagreement to settle:** Innovation wanted Stage 2 now. Cost/Stability wanted it only on demand. Quality wanted it gated on contract correctness. The draft builds it after the rate limit, with a usage review.

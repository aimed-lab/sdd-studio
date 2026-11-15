# RED proposals — run 2026-11-14 (panel: proposer + quality, cost/stability, innovation reviewers)

Context:
- studio.smartdrugdiscovery.org is a small academic lab's Next.js 14 app on Vercel.
- Live data comes only through `/api/search` (ChEMBL) and `/api/trials` (ClinicalTrials.gov), both public, read-only and unauthenticated.
- Everything else is labelled demo data.
- Login is client-side today. Server-verified Keycloak SSO is built but switched off (draft PR #35, issue #32).
- Phase 0 role locks are live.
- Users and invitations live in Vercel Postgres.

Results from the 10-user study: site 1.72 against 2.25 for AI alone. Novices, clinicians and lay users lose most,
because of access friction and navigation.

## #70 Public read-only access to live tools
**Proposal:** after SSO lands, make three things readable without signing in:
- `/search`
- `/clinical/trials` (the Trial Landscape tab only)
- the curated sections of `/targets`

Demo sections and member features stay gated. Public pages get per-IP rate limiting first (#27 Stage 1).
Alternatives:
- (B) keep everything gated
- (C) require any SDD Keycloak account, with no invitation, for live tools

## #71 Funding the in-site AI assistant
**Proposal:** keep bring-your-own-key as the default. Add a lab-funded tier for SSO-signed-in users only:
- the cheapest current Claude model
- a daily per-user quota (e.g. 20 questions)
- prompt caching
- the key held server-side in Vercel
- answers labelled "LLM-generated, unverified"

Requires #32.
Alternatives:
- (B) status quo, BYO only
- (C) fully lab-funded for everyone, with a global budget cap

## #72 Structure search
**Proposal:** call ChEMBL's similarity and substructure REST endpoints through the shared upstream helper:
- validate and canonicalise the SMILES (length cap, character whitelist)
- similarity threshold 70–100
- results paged, with provenance
- strict timeouts, cached 1 h

Alternatives:
- (B) RDKit.js in the browser over a small local library
- (C) a dedicated search service (e.g. own RDKit/Postgres cartridge)

## #73 Agent and MCP access
**Proposal (staged):**
1. Publish an OpenAPI 3.1 spec for `/api/search` and `/api/trials` (cheap, and useful to any agent framework).
2. Add a thin remote MCP server as a Vercel route (Streamable HTTP) exposing two read-only tools that call the same handlers. It is unauthenticated, read-only and rate-limited.
3. After SSO, add authenticated tools if private data ever exists.

Alternatives:
- (B) document the upstream ChEMBL/CT.gov MCP servers and build nothing
- (C) a full MCP server with auth now

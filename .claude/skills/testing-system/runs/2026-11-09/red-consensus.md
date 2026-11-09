# RED consensus — run 2026-11-09

Reviewers: A = scientific-user lens, B = engineering/operations lens. Process: proposal → independent reviews →
each reviewer sees the other's view → final positions. All six issues converged; residual notes are sequencing only.

| Issue | Decision | Implemented this run | Deferred (roadmap) |
|---|---|---|---|
| #24 Data architecture | Hybrid: live APIs via proxies for public data, Vercel Postgres for internal program data. Remove Prisma/SQLite. Shared upstream helper with provenance (source, release, query URL, real fetch time, TTL). "Source unavailable", never silent fallback. Versioned SQL migrations. | Shared helper `src/lib/upstream.ts`; ChEMBL + CT.gov routed through it; provenance carries real fetch time and query URL | Prisma removal (dependency removal → needs owner sign-off), read-only API docs, migrations |
| #25 Canonical source (+#15, #22) | `src/data/{demo,curated}` + live routes; type-enforced `dataClass`; demo never in dossier (type guard + CI grep); `/targets/[gene]` dynamic, regex-validated, HGNC/UniProt-resolved, `Promise.allSettled` ~6 s per source | — | All (next sprint) |
| #26 MVP scope (+#18, #20) | Target workspace first. #18/#20 parked until internal data entry. Portfolio/decision/regulatory pages keep banner and drop realistic fabricated dates/NPV; optional single-setting preview flag (UX only) | — | Scrub fabricated milestone/financial figures; preview flag |
| #27 Integration (+#17, #23) | Stage 1: helper, input caps, rate limit, Open Targets fixed query, daily smoke test, owners, ChEMBL activity assay context. Stage 2 (with detail page): UniProt + PDB metadata. Link-outs by stable ID only; no iframes. #17 waits for OT tractability; #23 waits for intervention-level mapping | Helper, /api/search 100-char cap, User-Agent, daily smoke-test workflow | Rate limiting, Open Targets, activities, Stage 2 |
| #28 AI claims | Label now + neutral wording; no LLM-as-prediction until evaluated; banner/“planned” on /models, /design, /services, /plugins; fix assistant SYSTEM_PROMPT; label assistant output "LLM-generated, unverified"; CI check every page has banner or is allow-listed | Banners on 4 pages; assistant prompt facts + output label; method-execution phrases neutralised in demo arrays | CI banner check |
| #29 Role views | None now; later server-side role, authz in API routes, landing only on live/curated pages | n/a | Revisit after #26 |

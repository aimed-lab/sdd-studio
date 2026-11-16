# SDD Studio Projects: redesign plan

Approved by the owner on 2026-11-15. Each stage is delivered as one pull request with a Vercel preview, and each needs the owner's approval to merge.

## Goal
Give each project team a **Projects** workspace in SDD Studio:
- Team members and their AI agents write results to the project's Box folder, and each iteration loads into Studio with minimal manual steps.
- Developers share those artifacts with each other.
- When a team chooses to release them, customers can see the artifacts on public project pages.

The first projects are a PHGDH natural-product-analog campaign (the design reference) and the CollaboFest 2026 project teams.

## Principles
- **Box is the primary storage.** Every file's bytes live in the project's Box folder, under the institution's data governance. Studio keeps an index (checksums and Box IDs), parsed summary tables, release state and an audit trail. Studio never holds the only copy of a file.
- **Server-verified identity first.** No private project data is stored on the server until sign-in is server-verified (Keycloak SSO, #32).
- **Deny by default.** Every project read or write checks project membership on the server.
- **Agents draft, people release.** Agents and ingest tokens can create draft or internal artifacts only. A release needs the project lead's request and the Studio Owner's approval, with IP and publication checks recorded.
- **No PHI on the hosted service.** Projects with patient-level data use the on-premises build.
- **Label everything.** Predictions are labelled as in-silico predictions. Demo content stays labelled as demo. No unsourced facts.
- **Public repository.** No project data, tokens, or Box or Notion identifiers are committed.

## Architecture
```
SPARC job / developer agent ──(sdd CLI or agent SKILL, project token)──► Studio API v1 ──► Postgres (index, records, audit)
        │                                                                    │
        └──── file bytes: direct upload to a Box upload session ◄────────────┘  (Box app scoped to one "SDD Projects" folder)
Studio ──► Notion (per-project status summary)        Studio ──► public /p/<slug> (released artifacts only)
On-premises: same image + local Postgres + local file store; connectors and public release off
```

### Data model (Postgres, following the `src/lib/db.ts` pattern, without Prisma)
- **projects**: slug, title, lead, institutions, status, visibility (private, team or released), Box folder ID, Notion page ID.
- **project_members**: project role (owner, developer, reviewer or viewer).
- **iterations**: number, label, manifest checksum, source (CLI, agent or Box webhook), git SHA, status.
- **artifacts**: path, kind, SHA-256, size, storage reference, sensitivity (public, unpublished or confidential), release state (draft, internal, candidate, released, superseded or withdrawn), data class, and actor type (human, agent or token).
- **project_records**: parsed tables such as decision sheets and score tables, stored as JSON rows per iteration.
- **api_tokens**: project-scoped and hashed, with scopes, expiry and revocation.
- **release_requests**: who requested and who approved, plus the IP and publication checks.
- **audit_log**: append-only; file content is never logged.

## Ingestion API v1
Endpoints are under `/api/v1/projects/{slug}` and documented in `public/openapi.json`. CI contract-tests them.
1. `POST /iterations`: send a manifest (path, sha256, size, kind and sensitivity for each file). The call is idempotent per manifest. It returns the files Studio does not have yet, each with a short-lived Box upload URL.
2. The client uploads those files directly to Box. File bytes never pass through a Vercel function.
3. `POST /iterations/{n}/commit`: Studio verifies the checksums, parses declared summary tables, marks earlier versions as superseded and writes the audit entry.
4. `GET` endpoints for iterations, artifacts and records, with pagination.

**Auth**: a member's SSO session, or a project-scoped ingest token (`Authorization: Bearer …`). Tokens are hashed, expire after 90 days by default, can be revoked and are rate-limited. They can never release anything or change visibility.

### `sdd` CLI and agent SKILL
- **`tools/sdd-cli`**: a single-file Node 18 script.
  - `sdd init` writes `sdd.project.yaml`.
  - `sdd push --label "round 12"` hashes the files, uploads only new ones and commits.
  - It is meant to be one line at the end of a cluster job, CI step or cron entry. The token is read from `SDD_PROJECT_TOKEN`.
- **Box webhook (optional)**: files added to the Box folder by hand are indexed as drafts.
- **`skills/sdd-studio-push/SKILL.md`**: the workflow a developer's AI agent follows to write intermediate results to Studio:
  - lay out each iteration's folder;
  - write an `iteration.md`;
  - run `sdd push`;
  - log the push in the project's harness file;
  - never release;
  - never upload PHI or credentials.

## Agents, Box, Notion and public release
- **Studio MCP**: project tools are offered to authenticated callers only: list and get projects, list artifacts, query records, push a draft iteration, post a project note. Every call is audited.
- **Box**: one Box app, collaborated only on the "SDD Projects" folder. **Notion**: one integration, shared only with the project tracker; it receives status summaries, never raw data.
- **Public release**: released artifacts appear on public, cached `/p/<slug>` pages in Studio, linked from smartdrugdiscovery.org.

## Security, privacy and scalability
- **Security**:
  - SSO before any private data.
  - Server-side project authorisation on every route.
  - Hashed, scoped, expiring tokens.
  - Least-privilege Box and Notion apps.
  - Secrets only in deployment environment variables.
  - Short-lived upload and download links.
  - File-type allowlist and size limits.
  - Append-only audit log.
  - A written threat model and a security review before ingestion launches and again before public release.
  - Every token is verified, there are no open-review or bypass modes, and export bundles are built from an allowlist that never includes account data.
- **Privacy**:
  - Bytes stay in Box.
  - Sensitivity defaults to unpublished.
  - PHI is refused on the hosted service.
  - Member emails never appear on public pages.
  - Per-project export, deletion and retention policy.
  - Public pages show only released artifacts and the attribution the team approved.
- **Scalability**:
  - No file bytes through functions.
  - Checksum de-duplication, so re-pushing unchanged files costs nothing.
  - Postgres holds metadata and summary rows only, indexed per project and iteration.
  - Paginated reads; cached public pages.
  - Heavy analysis stays on cluster compute.
  - Per-token rate limits.
  - Adding a project is data entry, not code.

## Design
The Projects area follows the PHGDH campaign app's design:
- **Look**: a minimal light shell with an indigo accent and a left sidebar.
- **Campaign flow**: 1 Intake, 2 Command, 3 Tier Funnel, 4 Review & Gate, 5 Ready to Make, 6 Decision sheet, 7 Connectivity, 8 Secondary targets, 9 Autoresearch.
- **Validation views**:
  - autoresearch round history;
  - compound detail with chemical properties (logP, TPSA, QED, Lipinski, ADMET, toxicity);
  - applicability-domain and confidence signals;
  - dense sortable tables with CSV export;
  - a versioned Documents strip.

The theme is scoped to `/projects` and `/p`, so the live-data pages keep their current look.

## On-premises build
- A Next.js standalone Docker image with Postgres and a local file store. Connectors and public release are off, so nothing leaves the site.
- `sdd export <slug>` builds a single-project snapshot bundle that runs with `docker compose up`.

## Stages
0. **SSO on** (owner): configure the Keycloak client and the deployment environment for #35, then merge it.
1. **Plan, Projects shell and design**: this document, a draft agent SKILL, and the Projects pages rendered from a labelled demo fixture. Members only; no database writes.
2. **Schema and authorisation**: tables, project authorisation, membership administration, audit log.
   - **Brought forward (2026-11-15, owner's decision):** a developer **sandbox** (test data only) with the project tables, hashed push tokens, the audit log, the push API and `tools/sdd-cli/sdd.mjs`, before single sign-on. Real campaigns stay closed until SSO, then are adapted. See [projects-api.md](projects-api.md).
3. **Ingestion API v1**: tokens, the `sdd` CLI, the SKILL, OpenAPI and contract tests, and a pilot push from the cluster. Security review.
4. **Connectors**: Box (upload sessions, folder index, webhook) and Notion status sync.
5. **MCP**: project tools for authenticated agents.
6. **Release**: the release workflow and public `/p/<slug>` pages. Security review.
7. **On-premises**: the Docker image and `sdd export` bundles.

## Not decided here
- #26 (MVP scope of the demo modules). The demo Projects pages move to `/projects/demo`, still labelled.
- #24 (Prisma removal). The new tables use raw SQL in the existing `db.ts` style.
- #73 (agent and MCP access). This plan proposes authenticated-only project tools for the owner to review.

# Projects API (v1) and the `sdd` push tool

Stages 2–3 of [redesign-plan.md](redesign-plan.md), delivered first for a **developer sandbox** at the owner's request (2026-11-15), before single sign-on (#32).

## What is open today
- **Sandbox only.** The `sandbox` project accepts pushes and is readable by any signed-in member. It accepts files marked `test` only, keeps the latest 20 iterations, and holds at most 100,000 table rows in total.
- **Other projects** (kind `campaign`) return 401 until single sign-on is on. Real campaigns move in then.
- **No file bytes.** Studio stores each file's path, SHA-256, size, kind and sensitivity, plus up to 10 summary tables per push. The files themselves stay in the project's Box folder; Box upload sessions arrive in Stage 4.

## Push tokens
- **Creating:** a signed-in member creates a token under **Projects → Developer sandbox → Push tokens**. It is shown once. Store it in the `SDD_PROJECT_TOKEN` environment variable, never in the project folder or a repository.
- **Storage:** tokens look like `sdd_pt_…`. Studio stores only their SHA-256 hash.
- **Limits:** a token expires after 7–180 days in the UI (the API allows 1–365), can be revoked, and each person can hold at most 5 active tokens.
- **Interim weakness:** until single sign-on, the server cannot verify who is calling. Token management is tied to the email of an active member, and every create and revoke is written to `project_audit`. This is acceptable only because the sandbox holds test data.

## Endpoints
All endpoints live under `/api/v1/projects`. They are JSON, `Cache-Control: no-store`, and rate-limited per IP: GET at 60 per minute, writes at 10 per minute.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/projects` | none | List projects (title, kind, iteration count) |
| GET | `/api/v1/projects/{slug}` | none (sandbox) | Iterations, file index, tables |
| GET | `/api/v1/projects/{slug}/iterations` | none (sandbox) | Iterations, newest first |
| POST | `/api/v1/projects/{slug}/iterations` | `Bearer sdd_pt_…` | Push one iteration |
| GET | `/api/v1/projects/{slug}/records?table=&iteration=&limit=&offset=` | none (sandbox) | Rows of one table (latest iteration by default; up to 1,000 per page) |
| GET / POST / DELETE | `/api/v1/projects/{slug}/tokens` | active member email | List, create or revoke your push tokens |

### Push body
```json
{
  "label": "r012-polar-bioisostere",
  "source": "cli",
  "gitSha": "abc1234",
  "summary": "Polar bioisostere round",
  "files": [
    { "path": "Results/r012/tables/decision_sheet.csv", "sha256": "<64 hex>", "size": 84213, "kind": "decision-sheet", "sensitivity": "test" }
  ],
  "tables": [
    { "name": "decision_sheet", "file": "Results/r012/tables/decision_sheet.csv", "rows": [{ "compound_id": "T-1", "flag": "GO", "candidacy": 82.4 }] }
  ]
}
```

**Field rules:**
- `source`: `cli` or `agent`.
- `kind`: one of `decision-sheet`, `data`, `figure`, `structure`, `manuscript`, `report`, `app`, `harness`, `log`.
- `sensitivity`: one of `test`, `public`, `unpublished`, `confidential`. The sandbox accepts `test` only.
- `path`: relative, with no `..`, control characters or direction overrides.
- In the sandbox, every table must name its pushed `file`, so its sensitivity is known.
- Text cannot contain NUL or unpaired surrogates.

**Limits:**
- 4 MB per request, of which table rows at most 1 MB.
- 30 pushes per token per hour, and 300 pushes per project per day.
- 2,000 files per push.
- 10 tables per push.
- 5,000 rows per table.
- 100 columns per row.
- 2,000 characters per cell.

**Re-sending:** the same label, file contents and table rows return `{"duplicate": true}` and the existing iteration.

**Atomic:** a push commits completely or not at all, and iteration numbers never collide.

**Privacy:** who pushed (an email) is kept in the audit log, not returned by the API.

**Superseding:** a new version of a path marks earlier draft or internal versions `superseded`.

## The `sdd` tool
`tools/sdd-cli/sdd.mjs` is a single file that needs Node 18 or later and nothing else.

```bash
curl -O https://raw.githubusercontent.com/aimed-lab/sdd-studio/main/tools/sdd-cli/sdd.mjs
node sdd.mjs init --project sandbox          # writes sdd.project.json
export SDD_PROJECT_TOKEN=sdd_pt_…            # from Studio → Push tokens
node sdd.mjs push --label r001-test --dir Results/r001-test --dry-run
node sdd.mjs push --label r001-test --dir Results/r001-test --summary "first try"
node sdd.mjs status
```

The tool skips symbolic links and common secret files (keys, `.env`, `.ssh`, credentials). It sends the token over HTTPS only (or to localhost), and never searches above your home folder for a config.

`sdd.project.json` contains:
- `project`: the project slug.
- `studio`: the Studio base URL.
- `include` and `exclude`: globs (`**`, `*`, `?`).
- `sensitivity`: applied to every file.
- `tables`: maps globs to table names. CSV and TSV files matching a table glob are sent as rows.

At the end of a cluster job, one line is enough:

```bash
node sdd.mjs push --label "r$(printf %03d $ROUND)" --dir "Results/r$(printf %03d $ROUND)" --git "$(git rev-parse --short HEAD)"
```

Agents follow [skills/sdd-studio-push/SKILL.md](../skills/sdd-studio-push/SKILL.md).

## Tables
| Table | Holds |
|---|---|
| `projects` | Project slug, title, kind (`sandbox` or `campaign`) |
| `project_tokens` | Hashed push tokens, owner email, expiry, revocation, last use |
| `project_iterations` | One row per push; unique per project and manifest |
| `project_artifacts` | File index per iteration |
| `project_tables` | Each pushed table's column order and row count per iteration |
| `project_records` | Table rows as JSON |
| `project_audit` | Append-only log of pushes and token changes |

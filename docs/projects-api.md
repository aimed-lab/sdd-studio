# Projects API (v1) and the `sdd` push tool

Stages 2–3 of [redesign-plan.md](redesign-plan.md), delivered first for a **developer sandbox** at the owner's request (2026-11-15), before single sign-on (#32).

## What is open today
- **Sandbox only.** The `sandbox` project accepts pushes and is readable by any signed-in member. It accepts files marked `test` only, keeps the latest 20 iterations, and holds at most 100,000 table rows in total.
- **Campaigns** (kind `campaign`) hold the lab's own unpublished data. They are opened only with a **project key**: Studio checks it on the server for every request, so knowing a member's email address is not enough. The platform owner creates campaigns and issues keys with the admin key (below).
- **No file bytes.** Studio stores each file's path, SHA-256, size, kind and sensitivity, plus summary tables (up to 10 per push in the sandbox, 30 in a campaign). The files themselves stay in the project's Box folder; Box upload sessions arrive in Stage 4.

## Campaign keys
- **Admin key:** the platform owner sets `ADMIN_API_TOKEN` (a long random value) in the Vercel project. Admin requests send it as `X-Admin-Token`; without the variable the admin endpoints answer 404.
- **Read key:** opens the campaign in Studio (pasted once per browser, kept in that browser's storage) and its read API.
- **Push key:** writes iterations (and can read). Use it from a script, a cluster job or an agent with `--token-file`.
- **Lifetime:** keys expire after 1–365 days (default 90), can be revoked at any time, and up to 50 can be active per campaign. Only their SHA-256 hash is stored. Creating and revoking keys is written to `project_audit`.

```bash
export SDD_ADMIN_TOKEN=…   # the ADMIN_API_TOKEN value, typed into your own terminal
node sdd.mjs admin create-project --slug phgdh-npa --title "PHGDH-NPA: natural-product analogs"
node sdd.mjs admin key --project phgdh-npa --scope read --label "Jake, browser"
node sdd.mjs admin key --project phgdh-npa --scope push --label "import"
node sdd.mjs admin keys --project phgdh-npa
node sdd.mjs admin revoke --project phgdh-npa --id <key id>
```

`admin key` writes the new key to `~/.sdd/keys/<project>.<scope>.<id>.key` (readable only by you) and prints only its file name and prefix. Share a read key privately (for example in a password manager), never in email or chat.

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
| GET | `/api/v1/projects/{slug}` | none (sandbox); read key (campaign) | Iterations, file index, tables |
| GET | `/api/v1/projects/{slug}/iterations` | none (sandbox); read key (campaign) | Iterations, newest first |
| POST | `/api/v1/projects/{slug}/iterations` | push key | Push one iteration |
| POST | `/api/v1/projects/{slug}/iterations/{n}/rows` | the push key of iteration n | Append one chunk of a large table |
| GET | `/api/v1/projects/{slug}/records?table=&iteration=&limit=&offset=&q=&sort=&dir=` | none (sandbox); read key (campaign) | Rows of one table: latest iteration by default, up to 1,000 per page, text search `q`, sort by a column `sort` with `dir=asc|desc` |
| GET / POST / DELETE | `/api/v1/projects/{slug}/tokens` | active member email | Sandbox only: list, create or revoke your push tokens |
| POST | `/api/v1/admin/projects` | admin key | Create a campaign |
| GET / POST / DELETE | `/api/v1/admin/projects/{slug}/keys` | admin key | List, issue or revoke a campaign's keys |

A read key is sent as `X-SDD-Project-Key: sdd_pt_…` (or `Authorization: Bearer sdd_pt_…`).

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
- 10 tables per push in the sandbox, 30 in a campaign.
- 5,000 rows per table.
- 100 columns per row.
- 2,000 characters per cell.

**Re-sending:** the same label, file contents and table rows return `{"duplicate": true}` and the existing iteration.

**Atomic:** a push commits completely or not at all, and iteration numbers never collide.

**Privacy:** who pushed (an email) is kept in the audit log, not returned by the API.

**Superseding:** a new version of a path marks earlier draft or internal versions `superseded`.

**Large tables (campaigns):** a table may hold up to 50,000 rows and 300 columns in a campaign. A push declares it with `"expectedRows": <total>` and carries the first chunk; the rest is sent to `/iterations/{n}/rows` as `{ "table", "offset", "rows" }`, at most 1 MB of rows per request. Chunks are idempotent by offset, and re-running the same push resumes an unfinished table. `sdd.mjs push` does all of this automatically.

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

## Importing a PharmElixir campaign
`tools/pharmelixir-export/pharmelixir-export.mjs` turns one campaign from PharmElixir's generated data layer (`webapp/data.js`) into a folder `sdd.mjs push` can send. Tables:
- compounds, with scores, tiers, properties, ADMET flags and SMILES;
- rounds, tiers and funnel counts, secondary targets, scorecard, and summary.

Optionally, with the campaign's SQLite file (Node 22.5+), it adds the synthesis shortlist and confirmed flags. With a running PharmElixir server, it adds the decision sheet and the connectivity matrix as the app computes them.

```bash
node pharmelixir-export.mjs --data PharmElixir/webapp/data.js --campaign phgdh-npa --out phgdh-npa \
     --campaign-db PharmElixir/data/campaign_db/phgdh-npa.sqlite3 --pharmelixir http://127.0.0.1:8056
cd phgdh-npa && node sdd.mjs push --label r018-pharmelixir --token-file ~/.sdd/keys/phgdh-npa.push.<id>.key
```

Every computed value stays labelled as an in-silico result; `pred_*` values are docking-derived surrogates, not measured affinity.

## Tables
| Table | Holds |
|---|---|
| `projects` | Project slug, title, kind (`sandbox` or `campaign`) |
| `project_tokens` | Hashed push tokens and campaign keys: scope (`read` or `push`), owner, expiry, revocation, last use |
| `project_iterations` | One row per push; unique per project and manifest |
| `project_artifacts` | File index per iteration |
| `project_tables` | Each pushed table's column order and row count per iteration |
| `project_records` | Table rows as JSON |
| `project_audit` | Append-only log of pushes and token changes |

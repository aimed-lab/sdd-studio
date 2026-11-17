# Developer guide: push iterations to SDD Studio

SDD Studio has a **developer sandbox** where you, or your AI agent, can push each iteration of a project and see it in Studio. An iteration has three parts:
- the iteration itself (label, summary, git commit);
- the file index (path, checksum, size, kind);
- summary tables such as a decision sheet or a round summary.

Use the sandbox to try the workflow now. Real campaigns (the PHGDH-NPA campaign and the CollaboFest projects) move in once single sign-on is enabled.

> **Test data only.** Do not push real unpublished results, patient-level data or anything confidential to the sandbox; it rejects files not marked `test`. Studio receives file names, checksums and sizes, plus the rows of the summary tables you declare. File contents are not uploaded; they stay in your project's Box folder.

## 1. Join Studio
1. The platform owner sends you a personal invitation code by email. It works only with that email address and expires after 14 days.
2. Sign in at [studio.smartdrugdiscovery.org/login](https://studio.smartdrugdiscovery.org/login) with that email address and the code.
3. You join as a **Developer**. After the first sign-in you sign in with your email only.

Lost the code, or it expired? Ask the platform owner for a new invitation.

## 2. Create a push token
In Studio, go to **Projects → Developer sandbox → Push tokens** and choose **Create token**.

- Give it a label that says where it will run, for example "Cheaha job" or "laptop agent".
- The token (`sdd_pt_…`) is shown **once**. Copy it straight into an environment variable.
- Never put the token in a project folder, a notebook or a Git repository.
- You can hold up to 5 active tokens. Revoke a token on the same page as soon as you stop using it.

## 3. Get the push tool
`sdd.mjs` is a single file. It needs Node 18 or later and nothing else.

```bash
curl -O https://raw.githubusercontent.com/aimed-lab/sdd-studio/main/tools/sdd-cli/sdd.mjs
node sdd.mjs   # prints usage
```

## 4. Set up your project folder (once)
```bash
cd <your project folder>
node /path/to/sdd.mjs init --project sandbox
```

This writes `sdd.project.json`. Edit it to match your layout:

| Field | Default | Meaning |
|---|---|---|
| `project` | `sandbox` | Project to push to |
| `studio` | `https://studio.smartdrugdiscovery.org` | Studio address (must be https) |
| `include` | `Results/**`, `Plan/**`, `Reviews/**`, `*_HARNESS.md` | Files to index |
| `exclude` | `.DS_Store`, `.git`, `node_modules`, `.venv`, `__pycache__` | Files to skip |
| `sensitivity` | `test` | Applied to every file; the sandbox accepts only `test` |
| `tables` | `Results/*/tables/decision_sheet.*` → `decision_sheet`, `Results/*/tables/round_summary.*` → `rounds` | CSV or TSV files sent as table rows |

Secret files are always skipped, whatever the config says. These include `.env`, `.ssh/`, `.aws/`, `*.pem`, `*.key`, `id_rsa*`, `*credentials*.json` and `secrets/`. Symbolic links are skipped too.

### Recommended folder layout
```
Plan/
Results/
  r001-first-try/
    iteration.md          what changed, methods, inputs, limitations
    tables/
      decision_sheet.csv  one row per compound
      round_summary.csv   one row per round
    figures/
    structures/
    reports/
    logs/
Reviews/
```

## 5. Push an iteration
Set the token for the session:

```bash
# macOS / Linux
export SDD_PROJECT_TOKEN=sdd_pt_...
```

```powershell
# Windows PowerShell
$env:SDD_PROJECT_TOKEN = "sdd_pt_..."
```

Check what will be sent, then push:

```bash
node /path/to/sdd.mjs push --label r001-first-try --dir Results/r001-first-try --dry-run
node /path/to/sdd.mjs push --label r001-first-try --dir Results/r001-first-try --summary "first try"
```

The tool prints the iteration number, how many files were new or unchanged, and a Studio link. **Pushing the same label, files and table rows again changes nothing**, so retries are safe.

| Option | Meaning |
|---|---|
| `--label` | Iteration name (required): letters, digits, `.`, `_`, `-` or spaces |
| `--dir` | Push only this folder |
| `--summary` | One line shown in Studio |
| `--git` | Commit the results came from |
| `--agent` | Mark the iteration as written by an AI agent |
| `--dry-run` | List what would be sent; send nothing |

Check the project from the command line with `node /path/to/sdd.mjs status`.

### At the end of a cluster job
```bash
node sdd.mjs push --label "r$(printf %03d $ROUND)" --dir "Results/r$(printf %03d $ROUND)" --git "$(git rev-parse --short HEAD)"
```

Pass the token to the job as an environment variable, never in the job script.

## 6. If an AI agent writes your results
Have the agent follow the [agent workflow](../skills/sdd-studio-push/SKILL.md). It:
- lays out the iteration folder;
- writes `iteration.md`;
- labels predictions as in-silico;
- pushes with `--agent`;
- logs the push in the project's harness file.

Agents never release anything; release is a human step in Studio.

## 7. See it in Studio
Open **Projects → Developer sandbox**:

| Section | Shows |
|---|---|
| **Overview** | The latest iteration and counts |
| **Tables** | Each pushed table, sortable, with CSV export |
| **Iterations** | Every push |
| **Artifacts** | The file index, with sensitivity and release state |
| **Push tokens** | Your tokens |

## Limits
| Limit | Value |
|---|---|
| Request size | 4 MB, of which table rows at most 1 MB |
| Files per push | 2,000 |
| Tables per push | 10 |
| Rows per table | 5,000 (push a summary table if yours is bigger) |
| Pushes | 30 per token per hour; 300 per project per day |
| Kept in the sandbox | latest 20 iterations; 100,000 table rows in total |

## Troubleshooting
| Message | What to do |
|---|---|
| `set SDD_PROJECT_TOKEN` | Export the token in this terminal session |
| `Push token is unknown, revoked, expired or for another project` | Create a new token in Studio |
| `The sandbox accepts test data only` | Set `"sensitivity": "test"` in `sdd.project.json` |
| `no sdd.project.json here or in a parent folder` | Run `init` in the project folder |
| `refusing to send your token over http://` | `studio` must be an `https://` address |
| `… at most 5000 rows` or `… MB per push` | Push a summary table (top rows or aggregates) |
| HTTP 429 | You hit a rate limit; wait and retry |

More detail on every endpoint is in the [Projects API reference](projects-api.md).

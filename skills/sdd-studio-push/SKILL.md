---
name: sdd-studio-push
description: Write a project's intermediate or final results to SDD Studio (studio.smartdrugdiscovery.org) after each iteration. Use when you finish a meaningful computational run for an SDD project (a docking round, a scoring pass, an autoresearch round, a figure or manuscript revision) and the project folder contains an sdd.project.yaml, or when the user says "push to Studio", "log this iteration", "sync results to SDD". DRAFT — the Studio ingestion API this skill calls ships in Stage 3 of docs/redesign-plan.md; until then, do steps 1–3 and 5 only and report that the push is pending.
---

# Push an iteration to SDD Studio

Studio indexes each project's Box folder and loads declared summary tables into its database. Your job is to leave the folder in a clean, documented state and run one command. **You can draft; only people can release.**

## Before you start

1. Find `sdd.project.yaml` at the project root. If it is missing, stop and ask the user to run `sdd init` (or to tell you the project slug). Do not invent one.
2. Read the project's harness file if there is one (for example `<project>_HARNESS.md`): it holds standing facts, constraints and a corrections log that override your assumptions.
3. Check `SDD_PROJECT_TOKEN` is set in the environment (`test -n "$SDD_PROJECT_TOKEN"`). Never print it, write it to a file, or put it in a command line argument.

## Hard rules

- **No PHI or patient-level data**, no donor identifiers, no credentials, no keys, no `.env` files. If a file might contain any of these, stop and ask.
- **Only files inside the project folder.** Never push your home directory, caches, `node_modules`, virtual environments or raw cluster scratch.
- **Never release.** Do not pass `--release`, do not change visibility, do not ask the user for an approval code. Release happens in Studio by the project lead and the Studio Owner.
- **Label predictions.** Every computed score, docking pose, ADMET or property value you describe is an *in-silico prediction*. Say so in `iteration.md`.
- **No unsourced facts.** Literature claims carry a PMID or DOI; database values carry the database and release.
- **Sensitivity defaults to `unpublished`.** Only mark something `public` if the user says it is already published.

## Steps

1. **Lay out the iteration** under the project's results area, matching the team scaffold (`Plan/`, `Results/`, `Learn & Skill/`, `Reviews/`):
   ```
   Results/<iteration-label>/
     iteration.md          # required, see template below
     tables/               # summary tables Studio will parse (CSV/TSV/XLSX, < 20 MB each)
     figures/              # PNG/SVG/PDF
     structures/           # PDB/CIF/SDF/MOL2
     reports/              # PDF/DOCX/MD
     logs/                 # run logs (no secrets)
   ```
   Use a sortable label: `r012-polar-bioisostere`, `2026-11-15-docking-v3`.
2. **Write `iteration.md`** from the template below.
3. **Check sizes and types.** Files over 20 MB are uploaded but not parsed; if a table is bigger, also write a summary table (top-N rows, aggregated scores) for Studio to parse.
4. **Push:**
   ```bash
   sdd push --label "<iteration-label>"
   ```
   It hashes files, uploads only new ones straight to Box, and commits the iteration. Re-running it is safe; unchanged files are skipped. Capture the Studio URL it prints.
5. **Log it** by appending one line to the harness changelog (or `CHANGELOG.md` if there is no harness):
   `YYYY-MM-DD · <iteration-label> · <one-line summary> · <Studio URL or "push pending">`
6. **Report back** to the user with the checklist below.

## `iteration.md` template

```markdown
# <iteration-label>

- Project: <slug>
- Date: YYYY-MM-DD
- Run by: <human> with <agent/model>
- Code: <repo>@<git sha>   Cluster job: <job id or n/a>
- Status: draft (not released)

## What changed since the previous iteration
<2–5 bullets>

## Methods
<tools, versions, parameters; cite tools by DOI where possible>

## Inputs
| file | sha256 (first 12) | source |
|---|---|---|

## Key results (in-silico predictions)
<short bullets; point to tables/ and figures/>

## Limitations and open questions
<what this does not show; what needs wet-lab validation>

## Sensitivity
unpublished | confidential | public — <reason>
```

## Report-back checklist

- [ ] `sdd.project.yaml` found, slug: …
- [ ] Harness read (or none present)
- [ ] Iteration folder: `Results/<label>/` with `iteration.md`
- [ ] No PHI, credentials or out-of-folder files
- [ ] Predictions labelled as in-silico
- [ ] `sdd push` result: N new files, M skipped, Studio URL … (or "pending: API not live yet")
- [ ] Changelog line added
- [ ] Not released (release is a human step in Studio)

## Example: PHGDH natural-product-analog campaign

```
Results/r012-polar-bioisostere/
  iteration.md
  tables/decision_sheet.csv        # one row per compound: id, smiles, tier, go_flag, scores…
  tables/round_summary.csv         # round, n_generated, n_passing_gates, best_score
  figures/funnel.png
  structures/top10.sdf
  reports/round12_notes.md
```
`sdd push --label "r012-polar-bioisostere"` → Studio shows round 12 under Iterations, the decision sheet under Outputs, all as **draft**.

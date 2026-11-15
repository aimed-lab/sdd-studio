---
name: testing-system
description: Persona-driven QA loop for studio.smartdrugdiscovery.org (repo aimed-lab/sdd-studio). Ten simulated users, from undergraduate and patient advocate to medicinal chemist and VP, run 30 tasks (easy → hard). Each answer is scored against "AI alone" (a chat LLM with no tools). Findings become GitHub issues labelled green/yellow/red. Green is fixed directly. Yellow goes to an independent AI reviewer; approved becomes green and is fixed, rejected becomes red. Red goes to a ≥3-agent panel (quality, cost/stability, innovation) for up to 3 rounds; consensus becomes green and is implemented, otherwise the issue stays red with "human decision needed". Every fix ships as a PR with a Vercel preview. Use when asked to "run the testing system", simulate users or use cases, or audit the site's scientific usefulness against AI alone.
---

# Testing System (v2)

The loop: **baselines → simulate users → triage → green → yellow review → red panel → implement in waves → record lessons.**
Each run leaves an archive in `runs/<YYYY-MM-DD>/` so the next run can compare. Run 2026-11-14 is the reference run
for v2.

## 0. Setup (read first)

- **Know which site.** studio.smartdrugdiscovery.org is this repo (`aimed-lab/sdd-studio`, Vercel project
  `smartdrugdiscovery`). target.smartdrugdiscovery.org is a *different* app (DiseaseToTarget). Never point tests or
  monitors at `target.` (run 2026-11-14 found the smoke test doing exactly that).
- **Never build or run node from the OneDrive checkout.** It stalls on Files On-Demand. Use a `git worktree` under the
  session scratchpad for each branch. Rsync it into a separate build dir (`--exclude node_modules --exclude .next
  --exclude .git --exclude .vercel`), `npm ci` there, then `./node_modules/.bin/next build`. Don't symlink
  `node_modules` into a worktree: `npx` then resolves a global Next.js and the build fails.
- Serve a local build with a temporary `.claude/launch.json` entry (`next start <builddir> -p 30xx`), then restore the
  file with `git checkout -- .claude/launch.json`. Stop the server before rebuilding into the same `.next`.
- macOS has no `timeout` or `grep -P`, and zsh does not word-split `$var`. Pipe lists through `xargs`.
- OneDrive shows every file as modified (mode bits). Use `git -c core.fileMode=false status|add|checkout`.
- Local login is client-side. On **localhost only**, create a throwaway user in localStorage (`sdd-user-db`,
  `sdd-auth-user`). Never do this in the user's real Chrome on a deployed site: the safety check blocks it, correctly.
- **Vercel previews are protected** (Vercel Authentication). Open them in the user's signed-in Chrome
  (claude-in-chrome). The first navigation goes through an SSO redirect, so wait about 3 s before running `fetch()` checks
  in the page, or the JS tool reports "navigated to a different domain". Public API routes can be checked this way.
  Pages behind the app's own login cannot; rely on local page checks for those and say so.

## 1. Baselines (run in parallel, fresh agents)

1. **Site capability audit**: an expert walks all tasks on the live site. They read page source, curl the public
   APIs, verify every answer against ChEMBL / ClinicalTrials.gov / PubMed / Open Targets (MCP tools), and file issues
   S-01… with file:line evidence. They also check monitoring (smoke workflow runs).
2. **AI-alone baseline**: answer every task from memory first, then verify with the same tools and score 0–5.
   Count hallucinated identifiers. (2026-11-14: 3 of 16 PMIDs invented; every "recruiting" trial from memory had
   since closed.)

## 2. Users (10) and tasks (30)

Profiles, tasks and the 0–5 rubric are in `runs/2026-11-14/profiles-and-use-cases.md`. Reuse them unchanged so runs
compare, and add tasks only as new rows. The users span tech skill and bio skill: postdoc, computational biologist,
medicinal chemist, clinical pharmacologist, VP, undergraduate, oncologist, ML engineer (API only), patient advocate,
and structural biologist. Tasks run T01–T10 easy lookup, T11–T20 cross-reference, T21–T30 synthesis/prediction,
including patient–trial matching (T29) and agent/API access (T30).

## 3. Simulate

Run 5 agents, each with 2 users × 30 tasks. Each reads both baselines (the expert numbers are a ceiling) and records, per
user × task: time, completion (full/partial/none/not_attempted), site quality, AI-alone quality (as *that* user
would judge it; a lay user can't spot a fake PMID), delta, and an in-character note. Each agent also files new
issues (U<n>-xx), linking existing S-issues rather than duplicating them. Then compute the per-user and per-task
matrix with a script over the tables and write `results.md`.

## 4. Triage → GitHub issues

Labels: `green`, `yellow`, `red`, `human decision needed`, `testing-system`, `run-<date>`. Deduplicate first: the
same P1 found independently by several agents is strong evidence. Fold findings that belong to an existing RED into a
comment on that issue, not a new issue.
- **green**: one obvious fix with no design choice.
- **yellow**: a clear path that changes user-facing data or behaviour.
- **red**: several valid paths, or an architecture, policy or cost decision.

## 5. Green

Fix in a worktree branch and open one PR. Check the Vercel preview, then merge. Use `Closes #n` in the commit. After
merge, re-run any affected workflow (`gh workflow run`) and confirm it passes.

## 6. Yellow → one fresh reviewer

Write `yellow-plans.md` with the constraint **no new unsourced facts** and a list of open REDs not to pre-empt. A fresh
`general-purpose` reviewer returns JSON (APPROVE with required changes, or REJECT with an escalation note).
- **Approved**: relabel to green, comment the required changes, and implement them.
- **Rejected**: relabel to red, comment the reasons, and send it to the panel.

The reviewer must *measure* rather than reason. In 2026-11-14 it ran live counts and showed the eGFR plan would drop
34% of real EGFR-NSCLC trials. It also found that ChEMBL stores mechanisms on salt records.

## 7. Red → panel of ≥3 fresh agents, ≤3 rounds

The panel is three fresh agents with assigned, opposing stances: **Quality** (correctness, provenance, user value),
**Cost/Stability** (spend, Vercel limits, upstream fair-use, ops burden), and **Innovation** (agent-native access,
differentiation). The proposer (you) makes four participants.
- **Round 1**: independent JSON positions (backs/position/why/conditions/would_accept_if).
- **Round 2**: write a merged draft file, name the key tension, and `SendMessage` each panelist the others' summaries.
  Votes are AGREE/AMEND/OBJECT.
- **Round 3**: final text with the remaining conflict resolved as a bounded compromise. Votes are ACCEPT/REJECT, with
  REJECT allowed only for a missing non-negotiable.

Unanimous ACCEPT means relabel to green, post the consensus text, and implement it. Otherwise keep it red, add
`human decision needed`, and post each panelist's recommendation and the disagreement. Anything the consensus itself
gates (e.g. "after SSO") stays green-but-blocked, with a note.

## 8. Implement in waves

Group work by **file ownership**, so no file has two writers in a wave. Each wave track is a forked agent with its own
worktree, build dir and port, and opens a PR without merging. You verify each preview, merge, then start the next wave
from the new `main`. Any text needing human judgement (e.g. plain-language summaries) goes behind a flag in a separate
PR labelled `human decision needed`, and is never merged autonomously.

## 9. Record

Write `results.md` (matrix, per-user and per-task), keep every report, plan, verdict and round file in `runs/<date>/`,
and append lessons below.

---

## Lessons learned

### Run 2026-11-09 (v1)
0/20 use cases fully succeeded. 27 issues: 11 green, 10 yellow (4 approved, 6 escalated), 6 red, all reaching
consensus with 2 reviewers. Key lessons: demo data was factually wrong, not just stale; EGFR/eGFR gene-symbol
collision; verify PMIDs against the claim; the yellow reviewer's main value is blocking new unsourced content;
OneDrive and node don't mix; Next route files may export only handlers; `useSearchParams` needs Suspense;
provenance time comes from the upstream `Date` header.

### Run 2026-11-14 (v2)
- **Results:** 300 user × task attempts. Site 1.72 against 2.25 for AI alone (delta −0.54). Full / partial / none / not
  attempted: 61 / 119 / 100 / 20.
  - The site wins where it has live, sourced, exportable data: T07 CSV +3.3, T04 recruiting trials +2.8, T17
    provenance audit +1.3.
  - It loses where it has no data: regulatory −2.8, plain language −2.5, mechanism −2.3.
  - It loses most for novices, clinicians and lay users (around −1.0), mostly because of navigation and access.
- **Issues:** 9 green from the audit, 12 green from users, 13 yellow (12 approved, 1 escalated), 4 new red plus the
  escalated one. All 5 reds reached consensus in ≤3 rounds, and none needed a human decision. The consensus gated one
  item, the funded assistant, on SSO (#32).

1. **Shared baselines beat independent simulation.** One verified expert audit plus one verified AI-alone baseline,
   reused by all user agents, kept 300 ratings consistent and cheap.
2. **Five agents independently found the same P1**: the live tools had no navigation entry. Agreement across agents
   is the strongest prioritisation signal.
3. **Count and recall measurements decide disputes.** Field restriction cut EGFR-NSCLC by 34%, while "NOT glomerular"
   cut it by 0.3%. The quality panelist then found one real trial hidden by "NOT glomerular" (NCT03066206), which led
   to the "Show them" design.
4. **Panel convergence pattern:** round 1 surfaces each lens's non-negotiables, round 2 merges them and isolates one
   tension, and round 3 resolves it with a bounded compromise (cache, kill switch, opt-in API flag, PI decides). Give
   every panelist the others' exact conditions.
5. **Panelists catch platform facts.** Vercel env vars need a redeploy, so a kill switch must be a runtime DB setting.
6. **My own green fix had an unsourced claim** ("Ghose–Crippen ALogP"; ChEMBL documents Wildman–Crippen), and a
   later verifying agent caught it. Even green tooltip text needs a source check.
7. **Merge wave PRs one at a time and re-check `mergeable`.** File ownership kept 3 parallel PRs conflict-free.
8. Gate human-judgement text behind a flag and ship it as a separate PR labelled `human decision needed` (#78).
9. **Verify agent access like an agent.** On the preview, run a JSON-RPC `initialize` → `tools/list` → `tools/call`
   against `/api/mcp` with `fetch` in the signed-in Chrome tab. Also verify a preview through its *anonymous* app
   view: the user's Chrome has never signed in to the app on a fresh preview domain, so public-access work can be
   checked honestly without faking a session.
10. A verification pass on one PR keeps finding small follow-ups (the eGFR annotation missed the spelled-out gene name,
    #81). Spell-check synonyms against HGNC: "HER1" is not an HGNC alias.

11. **Never write "does not close #N" in a PR body.** GitHub reads "close #N" inside it as a closing keyword and
    closes the issue on merge (#27 closed by #87). Write "Part of #N" instead.
12. **Check compiled middleware matchers.** Next 14 compiled `"/targets/:gene"` to a regex that never matched a
    gene path, so the page rate limit silently did nothing. Use `:path+`/`:path*`. Read
    `.next/server/middleware-manifest.json` and confirm a 429 locally and on the preview before merging.
13. **Server-rendered public pages that call upstreams need a rate limit too**, not just `/api/*` (#91: HGNC +
    ChEMBL calls per new gene symbol).
14. **Parallel PRs that share registry files** (`mcp/route.ts`, `openapi.json`, contract test): after merging one,
    tell the agents still running to merge `origin/main` and re-run the contract test before pushing. #89 then merged with no conflicts.
15. **Cap ordering is a scientific choice.** Drug-aware mode takes 10 approved drugs, oldest first. For EGFR this
    pulls in colorectal antibodies and leaves out newer NSCLC drugs. State the ordering rule and the omitted names in the
    output, and re-check whether the ranking suits the task.
16. Fork agents leave temporary `.claude/launch.json` entries behind. Restore the file with
    `git -c core.fileMode=false checkout -- .claude/launch.json` after each wave.

### Waves 4–5 (2026-11-14, after the run)
Merged: #87 Open Targets evidence + `get_target_evidence` MCP tool; #88 demo pages scrubbed + page-label CI
(closes #28); #89 opt-in drug-aware trials (#57c; EGFR+NSCLC 1749 → 2195, no recall loss); #90 labels;
#91 target registry + `/targets/[gene]` pages with a per-IP page limit; #92 planned pages scrubbed.

### Open roadmap after waves 4–5
#32 SSO (unblocks the #71 funded assistant); #73 90-day MCP usage review (the PI decides on registry listing);
#27 Stage 2 UniProt/PDB on `/targets/[gene]`; #25 rest of Stage 1 (`src/data/demo/*` move, dossier guard);
#26 openFDA regulatory; #24 Prisma removal (owner sign-off); #29 role views; drug-aware ranking (lesson 15);
not-found pages return HTTP 200 because AuthGate is client-side.
**Next run should re-test T04, T05, T10, T13, T14, T19, T21, T22, T25 and T29 first.** T21 and T22 are newly answerable
via Open Targets. It should also re-score U6, U7 and U9 on the public pages, including `/targets/[gene]`.

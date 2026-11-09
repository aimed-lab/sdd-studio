---
name: testing-system
description: Persona-driven QA loop for the SmartDrugDiscovery platform. Five simulated users (bench biologist → drug-development VP) run 20 use cases, findings become GitHub issues triaged GREEN/YELLOW/RED, then GREEN is auto-fixed, YELLOW goes through an independent AI review (reject → escalate to RED), and RED is decided by two independent AI reviewers reaching consensus. Use when asked to "run the testing system", do persona/use-case testing, or audit the site's scientific usefulness.
---

# Testing System

A repeatable loop: **simulate users → triage → resolve green → review yellow → consensus on red → record lessons.**
Each run leaves an archive in `runs/<YYYY-MM-DD>/` so the next run can compare.

## 0. Setup (read before anything else)

- **Never build or run node from the OneDrive checkout.** `next dev`, `tsc` and `npm install` stall there, because
  Files On-Demand throttles reads under `node_modules`. Instead, rsync the repo to the session scratchpad
  (`--exclude node_modules --exclude .next --exclude .git --exclude .vercel`), `npm ci` there (~4 min), then build
  and serve from the copy. In `.claude/launch.json`, use a `next start <dir> -p 3001` config pointing at that copy,
  and remove it after the run. Stop the preview server before rebuilding: building into a `.next` that is
  being served hangs.
- macOS has no `timeout`. Use the Bash tool's own timeout.
- The OneDrive checkout shows every file as modified (mode-bit noise). Use `git -c core.fileMode=false status|add`.
- Work on a branch (`testing-system/<date>`) and open a PR. Don't push to `main`: Vercel deploys `main` to production.
- Local login: the app is gated by client-side localStorage auth. For localhost testing, create a throwaway user in
  `sdd-user-db` / `sdd-auth-user` (role Developer, status active). `/api/users` returns 503 locally (no Postgres);
  that's expected noise.

## 1. Personas (keep stable across runs so results are comparable)

| # | Persona | Wants |
|---|---|---|
| 1 | Dr. Sarah Kim, cancer-biology postdoc | Provenance for every fact, PubMed links, UniProt IDs |
| 2 | Dr. Marcus Chen, computational biologist | API/bulk access, activity data, reproducibility, network analysis |
| 3 | Dr. Priya Patel, medicinal chemist | Structures, IC50/selectivity, druggability, residue-level / covalent analysis |
| 4 | Dr. James Wright, clinical pharmacologist | Real trial landscape, cohorts, regulatory status |
| 5 | Dr. Elena Morales, drug-development VP | Modality comparison, portfolio, GO/NO-GO, combination strategy |

## 2. Use cases (20), in three tiers

- **Tier 1, lookup and provenance:** UC-01 EGFR metadata · UC-02 Melanoma targets with evidence · UC-03 Vemurafenib properties ·
  UC-04 BRAF V600E subtype · UC-05 cohorts · UC-06 MoA evidence chain · UC-07 JAK2 compounds and activities
- **Tier 2, cross-referencing:** UC-08 modality comparison · UC-09 BRAF target→disease→drug→trial · UC-10 EGFR trial
  landscape · UC-11 regulatory status · UC-12 Alzheimer's repositioning · UC-13 druggability
- **Tier 3, predictive and strategic:** UC-14 network target discovery (NSCLC) · UC-15 DTI prediction with evidence ·
  UC-16 EGFR resistance · UC-17 BRAF+MEK+PD-L1 combination · UC-18 EGFR C797S × covalent × residue ·
  UC-19 validation dossier · UC-20 development plan with GO/NO-GO

Assignment: P1 → 01, 02, 09, 19 · P2 → 07, 12, 14, 15 · P3 → 03, 06, 13, 16, 18 · P4 → 04, 05, 10, 11 · P5 → 08, 11, 17, 20, plus a cross-cutting pass over all 20.

## 3. Run the simulation

Launch 3 parallel agents (P1+P2, P3+P4, P5 + cross-cut). For each UC, each agent records outcome
(success/partial/failure), time, problems (P1/P2/P3 severity with `file:line` evidence) and a first-person reflection.
Each agent writes `runs/<date>/test-report-*.md`. Agents must read the page source **and** hit live endpoints:
code-reading alone missed that the mock data was factually wrong (see lessons).

## 4. Triage into GitHub issues

Labels: `green` (one obvious fix, no design choice), `yellow` (clear path but changes user-facing data or behaviour),
`red` (several valid paths or architectural), plus `testing-system`. Deduplicate across personas first.
`create_issues.example.sh` shows the batch-creation pattern (one `gh issue create` per finding, body with UC,
persona, severity, problem, proposed fix, evidence).

## 5. Resolve GREEN

- Implement directly. Split by file ownership between yourself and one forked agent, and never let two writers touch
  the same file.
- Write shared components first (export, viewer, provenance) so both writers import the same API.
- Build on the local copy, then verify every changed page in the browser before committing.
- Close the issues with `Closes #n` in the commit message.

## 6. Resolve YELLOW: independent review

- Write all plans to `runs/<date>/yellow-plans.md`. State the constraint up front: **no new unsourced facts; anything
  illustrative must be labelled**.
- Spawn a **fresh** `general-purpose` reviewer, not a fork, so it doesn't inherit your reasoning. It returns JSON with
  APPROVE/REJECT, required changes, and an `escalate_to` RED issue for each plan.
- Implement every required change on approved plans.
- For each rejected plan, relabel `yellow → red`, comment the reviewer's reasons, and fold it into the named RED issue.

## 7. Resolve RED: two-reviewer consensus

- Write `runs/<date>/red-proposals.md` with one recommended option per RED issue, including the folded-in YELLOW items.
- Spawn two **fresh** reviewers in parallel with deliberately different lenses: (A) scientific user and integrity,
  (B) engineering, operations, Vercel limits and security. Each returns AGREE/AMEND/DISAGREE, an alternative, the
  biggest risk, and an acceptance condition.
- Discussion round: `SendMessage` each reviewer the other's summary, name the key tension explicitly, and ask for a
  final position plus a merged `consensus_text`.
- Record the outcome in `runs/<date>/red-consensus.md` and comment the decision on each issue.
- Implement the low-risk, fully specified parts now. Leave the rest as a roadmap on the issue. Leave dependency
  removals and production-affecting changes for owner sign-off.

## 8. Ship and record

Commit per tier, push the branch, and open a PR that summarises GREEN/YELLOW/RED outcomes. Then append to **Lessons learned** below.

---

## Lessons learned

### Run 2026-11-09 (v1)
Results: 0/20 use cases fully succeeded (≈11 partial, 9 failed); 27 issues filed (11 green, 10 yellow, 6 red).
Outcome: 11 green fixed; yellow review approved 4 and rejected 6, all 6 escalated; all 6 RED issues reached consensus.

**Domain**
1. **Hardcoded demo data was not just stale but wrong.** The mock search listed Vemurafenib as CHEMBL1089 with an
   incorrect SMILES; ChEMBL has it as CHEMBL1229517. Always cross-check demo entities against a live source during
   testing.
2. **Gene-symbol collisions.** On ClinicalTrials.gov, `EGFR` also matches kidney trials measuring eGFR (glomerular
   filtration rate). Always pair gene searches with a condition (`query.cond=cancer`), and warn users in the UI.
3. **Verify citations against the claim, not just existence.** One of five PMIDs recalled from memory pointed to an
   unrelated paper (SCLC proteomics instead of HER2 amplification). Fetch every PMID's abstract before using it.
   Quote only numbers the paper states.
4. Gene co-mention ≠ combination therapy. Two gene names in a trial search do not make a combination trial.

**Process**
5. **The YELLOW reviewer's main value was blocking "more fiction".** Every rejection was a plan that would have
   added realistic-looking unsourced content (generic modality claims, fictional regulatory milestones, a dossier of
   demo rows). Keep the "no new unsourced facts" constraint in every plan brief.
6. Rejections cluster on the open RED questions (canonical data, scope, integrations). Next time, resolve the
   architectural REDs **before** writing YELLOW plans that depend on them, or have the triage step tag
   dependencies up front.
7. Opposing reviewer lenses (science vs engineering) produced complementary amendments with one real tension
   (UniProt/PDB now vs maintenance burden). Naming that tension in the discussion message resolved it in one round
   with a staged plan.
8. The science reviewer caught a false premise in my proposal: it claimed all simulated pages were bannered, but
   /models, /design, /services and /plugins weren't. Reviewers should be told to verify claims in the proposal
   against the code.

**Engineering**
9. OneDrive + node is unusable; see Setup. This cost ~15 minutes of stalled processes before diagnosis.
10. Next 14 route files may only export HTTP handlers and route config. Shared constants must live elsewhere.
11. `useSearchParams` in a client page needs a `<Suspense>` boundary or the static build fails.
12. TypeScript interfaces don't satisfy `Record<string, unknown>`. Generic table utilities should take `T extends object`.
13. smiles-drawer's `SvgDrawer.draw` resolves only `String` objects, not string primitives, as element IDs. Pass the
    element via a ref.
14. Provenance `retrieved` must come from the upstream `Date` header. `new Date()` lies when Next serves a cached body.

### Open roadmap carried to next run
#25 target workspace (`/targets/[gene]`, data classes, demo modules) · #27 Stage 1 rest (rate limit, Open Targets,
ChEMBL activities with assay context) then Stage 2 (UniProt, PDB) · #24 Prisma removal (needs owner sign-off) ·
#26 scrub fabricated milestones and financials · #28 CI check that every page is bannered or allow-listed.
**Next run should re-test UC-01, 03, 07, 10 and 16 first.** Those are the use cases this run moved from failure to partial or success.

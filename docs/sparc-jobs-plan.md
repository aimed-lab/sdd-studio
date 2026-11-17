# Running docking and generative-design jobs on SPARC compute

How Studio asks the SPARC Center's GPU clusters for a computation and gets the results back into a
campaign. Written 2026-11-17. Status: the design below is the agreed shape; the section
"What is built" says which parts exist today and which are still planned.

## 1. The problem

Studio runs on Vercel. A docking run or a generative-design run needs GPUs, a scheduler and hours of
wall-clock time — none of which a request handler has. The clusters are reached through SPARCq, which
needs an API key and is itself behind a tunnel whose address changes.

Two hard constraints shape everything else:

1. **Studio must never hold cluster credentials.** No SPARCq key, no SSH key, no cluster hostname or
   path in Vercel's environment and nothing of the kind in this repository (it is public).
2. **A Vercel function cannot wait for a cluster.** Even with a 300 s limit, a docking run is longer
   by orders of magnitude, and nothing may depend on a function staying alive.

## 2. The model: Studio holds the queue, the lab pulls from it

```
  ┌─────────────────────────┐        ┌──────────────────────────┐        ┌───────────────┐
  │ Studio (Vercel)         │        │ sparc-runner             │        │ SPARCq        │
  │                         │        │ (a lab machine)          │        │ + clusters    │
  │ POST /api/v1/jobs       │        │                          │        │               │
  │   a request, queued  ───┼──┐     │                          │        │               │
  │                         │  │     │                          │        │               │
  │ POST /api/v1/jobs/claim │◄─┼─────┤ 1. poll with runner token│        │               │
  │   hands out job specs   │  │     │ 2. compose the script    │        │               │
  │                         │  │     │ 3. validate ─────────────┼───────►│ /jobs/validate│
  │ POST …/{id}/status      │◄─┼─────┤ 4. submit ───────────────┼───────►│ /jobs         │
  │   running, external id  │  │     │ 5. poll ◄────────────────┼────────┤ /jobs/{id}    │
  │                         │  │     │ 6. collect logs, outputs │        │               │
  │ POST /api/v1/projects/… │◄─┼─────┤ 7. sdd.mjs push          │        │               │
  │   results as iteration  │  │     │                          │        │               │
  │ POST …/{id}/complete    │◄─┴─────┤ 8. link job → iteration  │        │               │
  └─────────────────────────┘        └──────────────────────────┘        └───────────────┘
```

Studio is a queue and a record. It never initiates a connection to the cluster side, never learns the
SPARCq address and never holds a SPARCq key. The runner makes every outbound call: it polls Studio
over HTTPS with its own token, talks to SPARCq with the SPARCq key that already lives on that machine
(`~/.sparcq/config.json` or `SPARCQ_URL` / `SPARCQ_API_KEY`), and pushes results with a project push
key. A firewalled lab machine needs no inbound port.

Why not the alternatives:

- **Studio calls SPARCq directly.** Needs a SPARCq key in Vercel's environment, needs the tunnel
  address to be stable, and makes Studio a path from the internet into the clusters. Rejected.
- **The cluster calls a Studio webhook.** Needs Studio to accept writes triggered from outside and
  gives no place to hold a job that is waiting for approval. The pull model gets the same result with
  one credential fewer.
- **A Vercel cron that submits.** Same credential problem as the first option.

## 3. Job records

One table of job requests, one of state changes. Both live in the same Postgres database as projects,
so a job can reference its campaign and the iteration its results landed in.

`sparc_jobs`

| column | meaning |
| --- | --- |
| `id` | `job_…`, used in URLs |
| `project_slug` | the campaign (or `sandbox`) the request belongs to |
| `kind` | `docking` or `generative-design` |
| `title` | a short label the requester types |
| `status` | see the lifecycle below |
| `requested_by`, `requested_role` | the signed-in account and its role at request time |
| `params` | the validated request: receptor, ligand source, box, objectives, limits |
| `est_gpu_hours` | the requester's estimate; counts against the budget |
| `cluster_preference` | a cluster name, or null for "let the runner choose" |
| `no_phi` | the requester's assertion that no human-subject data is involved |
| `dry_run` | true when the job is to be completed with synthetic test data |
| `runner_id`, `cluster`, `external_id` | which runner claimed it, where it ran, the SPARCq job id |
| `result_iteration` | the campaign iteration the results were pushed as |
| `error` | the failure message, when it failed |
| `created_at`, `decided_at`, `claimed_at`, `started_at`, `finished_at` | timestamps |

`sparc_job_events` is append-only: one row per state change with the actor, the status and a note. It
is the audit trail for "who asked for this, who approved it, what did it cost".

Runner tokens are their own table, `sparc_runners`, and are stored exactly like project keys: only
`sha256(token)` is kept, with a visible prefix, a label, a creator, an expiry, a revocation time, a
last-seen time, and the list of project slugs the token may claim jobs for.

### Lifecycle

```
pending ──approve──► queued ──claim──► claimed ──► submitted ──► running ──► succeeded
   │                    │                 │            │            │
   └──reject──► rejected└──cancel──► cancelled         └────────────┴──► failed
```

- `pending` — waiting for an Owner or Admin. Where a request from a Developer starts.
- `queued` — approved, waiting for a runner. Where an Owner's or Admin's own request starts.
- `claimed` → `submitted` → `running` — the runner has it; `submitted` means SPARCq accepted it.
- `succeeded` — results are in a campaign iteration, named in `result_iteration`.
- `failed` — SPARCq rejected it, the job died, or the runner could not push the results.
- `cancelled` — withdrawn before it ran. `rejected` — refused at approval.

A claimed job that gets no update for 6 hours is shown as stale on the job page; its runner may have
died. An Owner or Admin can send it back to `queued` so another runner picks it up.

## 4. Who may ask for what

| action | role |
| --- | --- |
| see the job list and job pages for a project | Developer and up |
| request a job (`pending`) | Developer and up |
| request a job that starts `queued` | Owner, Admin |
| approve or reject a pending job | Owner, Admin |
| cancel a job before it runs | the requester, Owner, Admin |
| mint a runner token for the sandbox | Owner, Admin (in Studio) |
| mint a runner token for a campaign | the platform owner, with the admin key |
| claim jobs, report status, complete | a runner token, for its own projects only |

Every one of these is checked on the server, on each request, against the signed-in account in the
database (`authorize(req, minRole)`), not against anything the browser sends. Middleware does not
gate `/api/*`, so each job route checks for itself.

Approval exists because a GPU hour costs money or allocation, and because a request names a receptor
and a ligand set that a reviewer should see before a cluster runs it. It is deliberately a human
step, not a rule engine.

## 5. Quotas and the GPU budget

Studio cannot see the clusters' accounting, so it enforces its own conservative ceilings and treats
them as the budget. The numbers are in one place in the code (`JOB_LIMITS`) so they can be changed
without touching logic:

- at most **5** jobs per person per day, and **20** per project per day;
- at most **10** jobs at once per project in `pending`, `queued`, `claimed`, `submitted` or `running`;
- at most **48 GPU-hours** of estimates per project in any rolling 30 days, and **12** per job;
- the sandbox takes dry runs only, and a dry run does not count against the GPU budget.

Beyond that, SPARCq's own per-user cap (4 concurrent jobs) and the clusters' own limits apply, and
the runner respects them: it claims at most a few jobs per poll and never submits past its cap.

The GPU budget is an estimate, not a measurement. When Jake decides what the real allowance is, the
honest next step is to read elapsed GPU time back from SPARCq's accounting at completion and spend
the budget against that instead of the estimate.

## 6. Data classification

- **No PHI, and no human-subject data of any kind.** The request form requires the requester to
  assert this, the assertion is stored on the job, and the plan is that nothing else is accepted.
  A receptor structure, a SMILES list and a scoring box are all the request needs.
- Job parameters are stored in Studio's database and are visible to Developers and up. They are not
  public: every Studio page needs sign-in.
- Results arrive as a normal campaign iteration, so they inherit the sensitivity rules that already
  exist: a campaign iteration is `unpublished` by default and reaches only key holders and the
  signed-in Owner and Admins; the sandbox accepts `test` data only.
- **In-silico results are predictions.** Docking scores and generated structures are computational
  predictions, never measurements, and the pages that show them say so.
- Dry-run results are **test data**, clearly labelled as such, and go to the sandbox only.

## 7. Audit and failure handling

Every state change is a row in `sparc_job_events`, and project-level actions (a runner token minted
or revoked, an iteration pushed) are already written to `project_audit`. Between them, a job can be
reconstructed end to end: who asked, who approved, which runner took it, which SPARCq job it became,
and which iteration holds the results.

Failures, and what happens:

| failure | what the runner or Studio does |
| --- | --- |
| SPARCq pre-flight rejects the script | job → `failed` with SPARCq's message and hint; nothing is submitted, no cluster time is used |
| SPARCq is unreachable | the runner leaves the job `claimed` and retries on its next poll; after 6 hours the job shows as stale |
| the cluster job fails | job → `failed` with the last lines of stderr/stdout |
| the results push fails | job → `failed`; the files stay on the runner's disk and the push can be repeated by hand (a push with the same label and contents is a no-op) |
| the runner dies | the job stays `claimed` and shows as stale; an Owner or Admin requeues it |
| Studio is unreachable | the runner retries; a status update that cannot be delivered is retried on the next poll |

The runner never retries a script that pre-flight rejected: SPARCq's validation is deterministic, so
a retry would fail identically.

## 8. What is built

Shipped in this change:

- the job tables, the queue API (`/api/v1/jobs…`) with runner-token authentication, quotas and audit;
- **Request a run** forms for docking and for generative design, at `/jobs/new`, reachable from
  `/design`;
- the job list at `/jobs` and a job page at `/jobs/{id}` showing parameters, events and the resulting
  iteration;
- `tools/sparc-runner/runner.mjs`: polls Studio, composes a job script, validates it against SPARCq,
  submits, polls, collects logs, and pushes results as an iteration with `tools/sdd-cli/sdd.mjs`.
- `--dry-run`, which completes a job with clearly labelled synthetic test data and refuses to run
  against anything but the sandbox. This is what the preview deployment was verified with.

Still planned, and labelled as planned in Studio:

- receptor preparation (protonation, charges, a prepared receptor file) — today the request carries a
  PDB ID or a campaign file and the runner's script is expected to prepare it on the cluster;
- a real docking engine and a real generative model, which are open questions below; the runner's
  real path submits the script template it is given and does not pretend to know the science;
- reading GPU time back from SPARCq accounting and spending the budget against it;
- a ligand set pulled straight from a campaign table by Studio rather than named in the request;
- anything to do with /design's DMBT board and chat, which stay a preview.

## 9. Open questions for Jake

1. **Clusters and queues.** Which cluster should docking default to, and which should generative
   design default to? Should Studio offer the choice at all, or always let the runner decide from
   what SPARCq reports as idle?
2. **Who runs the runner.** A person's own machine, or a lab service account on a machine that is
   always on? Whose SPARCq key does it use, and who is accountable for what it submits? (The runner
   is attributed in SPARCq to whoever's key it uses.)
3. **GPU budget.** What is the real monthly allowance for Studio-initiated work, per campaign and in
   total, and who is told when it runs out? The 48 GPU-hours per 30 days above is a placeholder.
4. **Docking engine and receptor preparation.** Which engine, which scoring function, and who
   prepares the receptor — a step in the job script, or a prepared file a human uploads to the
   campaign first? Default binding-site box: centred on a co-crystal ligand, or typed by hand?
5. **Generative model.** Which generator, with which objectives, and what is the acceptance filter
   before a generated molecule is shown in a campaign at all?
6. **Approval.** Is one approval by an Owner or Admin enough for every run, or should a run above a
   certain estimated GPU cost need a second pair of eyes?
7. **Where result files live.** SPARCq archives logs and outputs to Box. Should the runner copy them
   into the campaign's Box folder as well, so a campaign holds its own results, or should the job page
   link to SPARCq's archive?

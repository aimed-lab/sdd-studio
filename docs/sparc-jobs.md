# Compute jobs on SPARC clusters

How to ask Studio for a docking or generative-design run, and how to run the runner that takes those
requests to the SPARC Center's GPU clusters. The design and the open questions are in
[docs/sparc-jobs-plan.md](https://github.com/aimed-lab/sdd-studio/blob/main/docs/sparc-jobs-plan.md).

Studio never holds a cluster credential. It holds a queue; a runner on the SPARC side pulls from it.

## Requesting a run

**Studio → Compute jobs → Request a run** (or the two buttons on *Design with AI*).

- **Docking** asks for a receptor (a PDB entry ID, or a structure file already in the project), a
  ligand set (SMILES you paste, or a column of one of the project's tables), and a binding site
  (a box you give in ångström, or the co-crystal ligand to centre the box on), plus exhaustiveness
  and poses per ligand.
- **Generative design** asks for a seed set, the objectives to optimise, how many proposals you
  want, and the target when potency is one of the objectives.
- Both ask for an estimate in GPU-hours, optionally a cluster, and your assertion that the run
  involves **no protected health information and no human-subject data**. The assertion is stored
  with the request.

Who may do what:

| | role |
| --- | --- |
| see your own jobs, request a run | Developer and up |
| request a run for a campaign | Owner, Admin |
| approve, reject or requeue | Owner, Admin |
| cancel before it runs | the requester, Owner, Admin |

On a deployment without Studio sign-on (preview deployments and local development) the server cannot
read a session. There, a request names an active member's email instead, the server checks that
account's status and role in the database, and **only the sandbox is available** — a campaign run is
refused. Production has sign-on, so it always uses the signed-in account.

A request from an Owner or Admin starts **queued**. Anyone else's starts **pending** and an Owner or
Admin approves it. A request for the **developer sandbox** is always completed as a labelled **dry
run**: the runner writes synthetic test data and no cluster time is used, which is how to try the
whole path end to end.

### Limits

Per person: 5 requests a day. Per project: 20 requests a day, 10 jobs waiting or running at once,
48 GPU-hours of estimates per rolling 30 days, and 12 GPU-hours per job. Dry runs do not count
against the GPU budget. SPARCq's own cap of 4 concurrent jobs per user still applies on top.

## Following a job

The job page shows the parameters as stored, the history (who asked, who approved, which runner took
it, which cluster, the job id on the compute side), and — when it finishes — the project iteration
the results were pushed as. Docking scores and proposed structures there are **in-silico results**:
computational estimates, not experimental measurements. A dry run's numbers are synthetic test data.

If a runner stops reporting for several hours the job is shown as stale, and an Owner or Admin can
put it back in the queue for another runner.

## Running the runner

`tools/sparc-runner/runner.mjs` is a small Node program (Node 18 or later, no dependencies) that runs
on a machine with SPARCq access. It polls Studio, composes a job script, validates it against SPARCq
before submitting, waits for the cluster, collects the logs, and pushes the results to the project
with `tools/sdd-cli/sdd.mjs`.

It needs three credentials, none of which are in this repository:

| what | where it comes from | what it is for |
| --- | --- | --- |
| runner token (`sdd_rt_…`) | `SDD_RUNNER_TOKEN`, or `--token-file` | claiming jobs and reporting on them |
| project push key (`sdd_pt_…`) | `SDD_PROJECT_TOKEN`, or `--project-token-file` | pushing results as an iteration |
| SPARCq address and key | `SPARCQ_URL` + `SPARCQ_API_KEY`, or `~/.sparcq/config.json` | submitting to the clusters |

An Owner or Admin mints a **sandbox** runner token in Studio (Compute jobs → Sandbox runner tokens);
a token that may claim a campaign's jobs is issued by the platform owner with the admin key:

```bash
curl -s -X POST "$STUDIO/api/v1/admin/jobs/runners" -H "X-Admin-Token: $SDD_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"projects":["phgdh-npa"],"label":"lab workstation","days":90}'
```

Only the hash of a token is stored, so each one is shown once. Revoke it the moment a machine is
done with it.

Then, on that machine:

```bash
node tools/sparc-runner/runner.mjs selftest
```

```bash
node tools/sparc-runner/runner.mjs poll --work-dir ~/sdd-jobs
```

`selftest` checks that Studio accepts the runner token, that SPARCq answers, and that the script the
runner would compose passes SPARCq's pre-flight — using SPARCq's dry-run validation endpoint, so no
cluster job is created. `once` does a single poll; `poll` keeps going. `--dry-run` makes a runner
refuse real work and complete sandbox jobs with labelled test data. `script --job <file>` prints the
script a job would run, for review.

### The driver: where the science lives

The script Studio's runner composes is a harness. It writes the request to the job's output folder
and calls a **driver** — the lab's own executable on the cluster that runs the docking engine or the
generator:

```
$SPARCQ_OUT/sdd-drivers/docking.sh request.json
$SPARCQ_OUT/sdd-drivers/generative-design.sh request.json
```

Set another path with `--driver` or `$SDD_JOB_DRIVER`. A driver reads `request.json` (the job's
validated parameters) and writes its results into the job folder, by convention as
`Results/<job id>/tables/docking_scores.csv` or `…/design_proposals.csv`, which is the table the
runner pushes to the project. Which engine, which model and how the receptor is prepared are open
questions for the lab, not decisions in this repository — see the plan's §9.

### When something goes wrong

- A script SPARCq's pre-flight rejects never reaches a cluster: the job fails with SPARCq's message
  and hint, and the runner does not retry it (the pre-flight is deterministic).
- A cluster failure fails the job with the last lines of stderr or stdout.
- If a results push fails, the files stay in the runner's work folder; running the same push again is
  safe, because a push with the same label and contents is a no-op.
- If the runner or the machine dies, the job stays claimed and shows as stale, and an Owner or Admin
  requeues it.

## The API, in short

Every route checks the caller on the server: a person by their Studio session, a runner by its token.

| method | path | caller |
| --- | --- | --- |
| `POST` | `/api/v1/jobs` | Developer and up — request a run |
| `GET` | `/api/v1/jobs` | the requester's jobs; all of them for an Owner or Admin |
| `GET` | `/api/v1/jobs/{id}` | the requester, Owner, Admin — the job and its history |
| `POST` | `/api/v1/jobs/{id}/decision` | approve, reject, cancel or requeue |
| `POST` | `/api/v1/jobs/claim` | a runner token — take queued jobs for its projects |
| `POST` | `/api/v1/jobs/{id}/status` | a runner token — submitted, running |
| `POST` | `/api/v1/jobs/{id}/complete` | a runner token — the iteration, or the failure |
| `GET POST DELETE` | `/api/v1/jobs/runners` | Owner, Admin — sandbox runner tokens |
| `GET POST DELETE` | `/api/v1/admin/jobs/runners` | the admin key — runner tokens for any project |

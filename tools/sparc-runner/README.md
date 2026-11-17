# sparc-runner

Brings SDD Studio's compute-job queue to the SPARC Center's GPU clusters.

Studio (on Vercel) holds a queue of docking and generative-design requests and never holds a cluster
credential. This runner is the only thing that touches both sides: it polls Studio with a runner
token, submits through SPARCq with the SPARCq key already on the machine, and pushes results back to
the project with `../sdd-cli/sdd.mjs`.

Node 18 or later; no dependencies.

```bash
node runner.mjs selftest                      # check Studio, SPARCq, and the composed script
node runner.mjs once                          # one poll
node runner.mjs poll --work-dir ~/sdd-jobs    # keep polling (every 30 s)
node runner.mjs script --job job.json         # print the script a job would run
```

Credentials, by environment variable or file (never in this repository):

| | |
| --- | --- |
| `SDD_RUNNER_TOKEN` / `--token-file` | runner token (`sdd_rt_…`) from Studio |
| `SDD_PROJECT_TOKEN` / `--project-token-file` | project push key (`sdd_pt_…`) |
| `SPARCQ_URL` + `SPARCQ_API_KEY`, or `~/.sparcq/config.json` | SPARCq |

`--dry-run` makes the runner refuse real work and complete sandbox jobs with clearly labelled
synthetic test data. The science itself lives in a driver script the lab owns on the cluster
(`$SPARCQ_OUT/sdd-drivers/<kind>.sh`, or `--driver`); this runner composes the harness around it.

The full runbook is [docs/sparc-jobs.md](../../docs/sparc-jobs.md); the design and the open questions
are in [docs/sparc-jobs-plan.md](../../docs/sparc-jobs-plan.md).

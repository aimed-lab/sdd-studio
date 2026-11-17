#!/usr/bin/env node
// sparc-runner — brings SDD Studio's compute-job queue to the SPARC Center's clusters.
//
//   node runner.mjs once        [options]   one poll, then exit
//   node runner.mjs poll        [options]   poll for ever (every --poll seconds, default 30)
//   node runner.mjs selftest    [options]   check SPARCq and dry-run-validate a script; no job is created
//   node runner.mjs script      --job <file> [--cluster <name>]   print the script a job would run
//
// Options
//   --studio <url>            Studio origin (default https://studio.smartdrugdiscovery.org)
//   --token-file <file>       file holding the runner token (sdd_rt_…); else $SDD_RUNNER_TOKEN
//   --project-token-file <f>  file holding the project push key (sdd_pt_…); else $SDD_PROJECT_TOKEN
//   --work-dir <dir>          where job folders are written (default ./sparc-runner-work)
//   --max <1-4>               jobs to claim per poll (default 1)
//   --cluster <name>          cluster to use when a job does not ask for one
//   --driver <command>        the command on the cluster that does the science (see below)
//   --dry-run                 complete jobs with clearly labelled synthetic test data, sandbox only
//   --no-push                 do not push results to Studio (leave them on disk)
//
// Credentials, none of which live in the Studio repository:
//   runner token   $SDD_RUNNER_TOKEN or --token-file           (claim jobs, report status)
//   project key    $SDD_PROJECT_TOKEN or --project-token-file  (push results as an iteration)
//   SPARCq         $SPARCQ_URL + $SPARCQ_API_KEY, or ~/.sparcq/config.json
//
// What the generated script does: it writes the request to the job's output folder and calls a
// driver command — the lab's own script on the cluster that runs the docking engine or the
// generator. Studio composes the harness; the science stays with the lab. Set the driver with
// --driver or $SDD_JOB_DRIVER; the default is "$SPARCQ_OUT/sdd-drivers/<kind>.sh".
//
// Node 18 or later; no dependencies.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_STUDIO = "https://studio.smartdrugdiscovery.org";
const HERE = dirname(fileURLToPath(import.meta.url));
const SDD_CLI = resolve(HERE, "..", "sdd-cli", "sdd.mjs");
const TERMINAL = new Set(["completed", "failed", "rejected", "invalid", "withdrawn"]);

// ── helpers ───────────────────────────────────────────────────────────────────

const die = (msg) => {
  console.error(`sparc-runner: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`${new Date().toISOString().slice(11, 19)}  ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0] ?? "poll";

function tokenFrom(flag, envName, prefix) {
  if (typeof args[flag] === "string") {
    const t = readFileSync(args[flag], "utf8").trim();
    if (!t.startsWith(prefix)) die(`${args[flag]} does not contain a ${prefix}… token.`);
    return t;
  }
  const t = (process.env[envName] ?? "").trim();
  return t || null;
}

function studioOrigin() {
  const raw = typeof args.studio === "string" ? args.studio : DEFAULT_STUDIO;
  let url;
  try {
    url = new URL(raw);
  } catch {
    die(`--studio is not a URL: ${raw}`);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) die(`refusing to send a token over ${url.protocol}//; --studio must be https.`);
  if (url.origin !== DEFAULT_STUDIO && !local) console.warn(`sparc-runner: note: talking to ${url.origin}, not ${DEFAULT_STUDIO}.`);
  return url.origin;
}

/** SPARCq's address and key: the environment first, then the CLI config. Never printed. */
function sparcqConfig() {
  const envUrl = (process.env.SPARCQ_URL ?? "").trim();
  const envKey = (process.env.SPARCQ_API_KEY ?? "").trim();
  if (envUrl && envKey) return { url: envUrl.replace(/\/+$/, ""), key: envKey };
  const file = join(homedir(), ".sparcq", "config.json");
  if (existsSync(file)) {
    try {
      const cfg = JSON.parse(readFileSync(file, "utf8"));
      if (cfg.server && cfg.api_key) return { url: String(cfg.server).replace(/\/+$/, ""), key: String(cfg.api_key) };
    } catch {
      die(`${file} is not readable JSON.`);
    }
  }
  return null;
}

async function studio(origin, token, method, path, body) {
  const res = await fetch(`${origin}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function sparcq(cfg, method, path, body) {
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-API-Key": cfg.key },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ── the job script ────────────────────────────────────────────────────────────

/**
 * The script a job runs on the cluster. SLURM clusters need #SBATCH directives; the container and
 * cloud backends take plain bash. Outputs are written with relative paths or to $SPARCQ_OUT, which
 * is what SPARCq archives.
 */
export function composeScript(job, cluster) {
  const slurm = cluster?.type === "slurm";
  const hours = Math.max(1, Math.ceil(Number(job.estGpuHours ?? 1)));
  const walltime = `${String(Math.min(hours, 12)).padStart(2, "0")}:00:00`;
  const name = `sdd_${job.kind.replace(/[^a-z]/g, "")}_${job.id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40);
  const driver =
    typeof args.driver === "string" ? args.driver : (process.env.SDD_JOB_DRIVER ?? `"$SPARCQ_OUT/sdd-drivers/${job.kind}.sh"`);

  const header = slurm
    ? [
        "#!/bin/bash",
        `#SBATCH --job-name=${name}`,
        ...(cluster.partition ? [`#SBATCH --partition=${cluster.partition}`] : []),
        "#SBATCH --gres=gpu:1",
        `#SBATCH --time=${walltime}`,
        "#SBATCH --nodes=1",
        "#SBATCH --ntasks=1",
        "#SBATCH --cpus-per-task=4",
        "#SBATCH --mem=16G",
        `#SBATCH --output=${name}_%j.out`,
        "# No --account line: SPARCq submits under its own account.",
      ]
    : ["#!/bin/bash"];

  // The request travels with the job as JSON, so the driver needs no arguments beyond its path.
  const request = JSON.stringify({ id: job.id, kind: job.kind, title: job.title, project: job.project, params: job.params });

  return [
    ...header,
    "set -euo pipefail",
    "",
    'OUT="${SPARCQ_OUT:-$(pwd)}"',
    `JOB_DIR="$OUT/${job.id}"`,
    'mkdir -p "$JOB_DIR"',
    'cd "$JOB_DIR"',
    'echo "SDD compute job ' + job.id + ' (' + job.kind + ') on $(hostname) at $(date -u +%FT%TZ)"',
    "command -v nvidia-smi >/dev/null && nvidia-smi -L || echo 'no nvidia-smi on this node'",
    "",
    "cat > request.json <<'SDD_REQUEST'",
    request,
    "SDD_REQUEST",
    "",
    `DRIVER=${driver}`,
    'if [ ! -x "$DRIVER" ]; then',
    '  echo "No driver at $DRIVER. The lab owns the engine; install a driver script there or pass --driver." >&2',
    "  exit 78",  // EX_CONFIG: a configuration problem, not a failed computation
    "fi",
    '"$DRIVER" request.json',
    "",
    'echo "driver finished with status 0; outputs in $JOB_DIR"',
    "",
  ].join("\n");
}

// ── dry run: labelled synthetic results, sandbox only ─────────────────────────

const csv = (rows) => {
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};

/** A number that is stable for a given input but means nothing. Never passed off as a result. */
const fakeNumber = (seed, lo, hi) => {
  const n = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16) / 0xffffffff;
  return Math.round((lo + n * (hi - lo)) * 100) / 100;
};

const structuresOf = (set) =>
  set?.source === "smiles" && Array.isArray(set.smiles) ? set.smiles.slice(0, 50) : [];

function dryRunResults(job, dir) {
  mkdirSync(join(dir, "Results", job.id, "tables"), { recursive: true });
  const note = "SYNTHETIC TEST DATA — dry run, no cluster was used";
  let table, file;

  if (job.kind === "docking") {
    const ligands = structuresOf(job.params?.ligands);
    const rows = (ligands.length ? ligands : ["(no pasted structures; the request named a project table)"]).map((smiles, i) => ({
      compound_id: `TEST-${job.id.slice(4, 10)}-${String(i + 1).padStart(3, "0")}`,
      smiles: ligands.length ? smiles : "",
      data_class: "synthetic-test-data",
      placeholder_score: ligands.length ? fakeNumber(job.id + smiles, -11, -4) : "",
      note,
    }));
    table = "docking_scores";
    file = `Results/${job.id}/tables/docking_scores.csv`;
    writeFileSync(join(dir, file), csv(rows));
  } else {
    const seeds = structuresOf(job.params?.seeds);
    const rows = (seeds.length ? seeds : ["(no pasted structures; the request named a project table)"]).map((smiles, i) => ({
      proposal_id: `TEST-${job.id.slice(4, 10)}-${String(i + 1).padStart(3, "0")}`,
      smiles: seeds.length ? smiles : "",
      data_class: "synthetic-test-data",
      origin: "copy of the seed structure; a dry run proposes nothing",
      note,
    }));
    table = "design_proposals";
    file = `Results/${job.id}/tables/design_proposals.csv`;
    writeFileSync(join(dir, file), csv(rows));
  }

  writeFileSync(
    join(dir, "Results", job.id, "README.md"),
    [
      `# Dry run for compute job ${job.id}`,
      "",
      `Kind: ${job.kind}. Title: ${job.title}.`,
      "",
      "**This folder holds synthetic test data.** It was written by tools/sparc-runner/runner.mjs in",
      "--dry-run mode to exercise the path from a Studio job request to a project iteration. No cluster",
      "was contacted, no engine ran, and every number here is a placeholder. Do not cite, compare or",
      "use any of it.",
      "",
      `Request, as stored in Studio: ${JSON.stringify(job.params)}`,
      "",
    ].join("\n"),
  );
  return { table, file };
}

// ── pushing results ───────────────────────────────────────────────────────────

const run = (cmd, cmdArgs, opts) =>
  new Promise((done) => {
    const child = spawn(cmd, cmdArgs, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => done({ code: -1, out, err: String(e) }));
    child.on("close", (code) => done({ code, out, err }));
  });

/**
 * Pushes a job's folder to Studio as a project iteration with tools/sdd-cli/sdd.mjs, and returns the
 * iteration number. The project key is the runner's; file bytes are not uploaded — Studio takes the
 * index and the summary table.
 */
async function pushResults(job, dir, table, origin, projectToken) {
  writeFileSync(
    join(dir, "sdd.project.json"),
    JSON.stringify(
      {
        project: job.project,
        studio: origin,
        include: ["Results/**"],
        exclude: ["**/.DS_Store"],
        sensitivity: job.dryRun ? "test" : "unpublished",
        tables: { [`Results/*/tables/${table}.*`]: table },
      },
      null,
      2,
    ) + "\n",
  );
  const label = `${job.kind}-${job.id}${job.dryRun ? "-dryrun" : ""}`.slice(0, 80);
  const summary = job.dryRun
    ? `Dry run for ${job.id}: synthetic test data, no cluster used.`
    : `Results of compute job ${job.id} on ${job.cluster ?? "a SPARC cluster"}.`;
  const res = await run(
    process.execPath,
    [SDD_CLI, "push", "--label", label, "--summary", summary, "--agent", "--studio", origin],
    { cwd: dir, env: { ...process.env, SDD_PROJECT_TOKEN: projectToken } },
  );
  if (res.code !== 0) throw new Error(`sdd push failed: ${(res.err || res.out).trim().slice(0, 500)}`);
  const m = res.out.match(/iteration (\d+)/i);
  if (!m) throw new Error(`sdd push did not report an iteration: ${res.out.trim().slice(0, 300)}`);
  return Number(m[1]);
}

// ── one job ───────────────────────────────────────────────────────────────────

async function pickCluster(cfg, job) {
  const { status, data } = await sparcq(cfg, "GET", "/clusters");
  if (status !== 200 || typeof data !== "object") throw new Error(`SPARCq /clusters returned HTTP ${status}.`);
  const wanted = job.clusterPreference ?? (typeof args.cluster === "string" ? args.cluster : null);
  if (wanted) {
    if (!data[wanted]) throw new Error(`SPARCq does not list a cluster called "${wanted}".`);
    if (data[wanted].error) throw new Error(`Cluster "${wanted}" is unreachable: ${data[wanted].error}`);
    return { name: wanted, ...data[wanted] };
  }
  // No preference: the reachable cluster with the most idle nodes.
  const usable = Object.entries(data)
    .filter(([, c]) => c && !c.error)
    .sort((a, b) => Number(b[1].idle_nodes ?? 0) - Number(a[1].idle_nodes ?? 0));
  if (!usable.length) throw new Error("SPARCq lists no reachable cluster right now.");
  return { name: usable[0][0], ...usable[0][1] };
}

async function handleJob(job, ctx) {
  const dir = join(ctx.workDir, job.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "job.json"), JSON.stringify(job, null, 2) + "\n");
  log(`job ${job.id} (${job.kind}, ${job.project}): ${job.title}`);

  const fail = async (message) => {
    log(`  failed: ${message}`);
    await studio(ctx.origin, ctx.token, "POST", `/api/v1/jobs/${job.id}/complete`, { ok: false, error: message.slice(0, 2000) });
  };

  try {
    let table, cluster = null;

    if (job.dryRun) {
      // The queue only marks sandbox jobs as dry runs, and the runner checks again before writing anything.
      if (job.project !== "sandbox") throw new Error("A dry run is only allowed for the sandbox project.");
      await studio(ctx.origin, ctx.token, "POST", `/api/v1/jobs/${job.id}/status`, {
        status: "running",
        note: "Dry run: writing labelled test data, no cluster is contacted.",
      });
      ({ table } = dryRunResults(job, dir));
      log("  dry run: wrote synthetic test data");
    } else {
      if (ctx.dryRunOnly) throw new Error("This runner was started with --dry-run, so it will not submit real work.");
      if (!ctx.sparcq) throw new Error("No SPARCq configuration on this machine (set SPARCQ_URL and SPARCQ_API_KEY, or ~/.sparcq/config.json).");

      cluster = await pickCluster(ctx.sparcq, job);
      const script = composeScript(job, cluster);
      writeFileSync(join(dir, "job.sh"), script);
      const submission = {
        cluster: cluster.name,
        script_content: script,
        estimated_hours: Number(job.estGpuHours ?? 1),
        gpu_count: 1,
        priority: 50,
        description: `SDD ${job.kind} ${job.id}`,
      };

      // Pre-flight first: a rejected script never reaches the queue, so no cluster time is spent.
      const check = await sparcq(ctx.sparcq, "POST", "/jobs/validate", submission);
      if (check.status !== 200 || check.data?.is_valid !== true) {
        throw new Error(
          `SPARCq refused the script before submitting it: ${check.data?.validation_message ?? `HTTP ${check.status}`}${check.data?.hint ? `\nHint: ${check.data.hint}` : ""}`,
        );
      }

      const sent = await sparcq(ctx.sparcq, "POST", "/jobs", submission);
      const sparcqId = sent.data?.id;
      if (!sparcqId) throw new Error(`SPARCq did not accept the job (HTTP ${sent.status}): ${sent.data?.validation_message ?? "no id returned"}`);
      log(`  submitted to ${cluster.name} as SPARCq job ${sparcqId} (${sent.data.status})`);
      await studio(ctx.origin, ctx.token, "POST", `/api/v1/jobs/${job.id}/status`, {
        status: "submitted",
        cluster: cluster.name,
        externalId: String(sparcqId),
        note: `SPARCq status ${sent.data.status}.`,
      });

      // Wait for it. SPARCq's own dispatcher runs once a minute, so 30 s is as fast as is useful.
      let last = sent.data.status;
      for (;;) {
        await sleep(ctx.pollSeconds * 1000);
        const now = await sparcq(ctx.sparcq, "GET", `/jobs/${sparcqId}`);
        const status = now.data?.status ?? last;
        if (status !== last) {
          log(`  SPARCq job ${sparcqId}: ${status}`);
          if (status === "running") {
            await studio(ctx.origin, ctx.token, "POST", `/api/v1/jobs/${job.id}/status`, { status: "running", note: "Running on a compute node." });
          }
          last = status;
        }
        if (TERMINAL.has(status)) break;
      }

      const logs = await sparcq(ctx.sparcq, "GET", `/jobs/${sparcqId}/logs`);
      mkdirSync(join(dir, "Results", job.id, "logs"), { recursive: true });
      for (const stream of ["stdout", "stderr", "accounting"]) {
        if (typeof logs.data?.[stream] === "string" && logs.data[stream]) {
          writeFileSync(join(dir, "Results", job.id, "logs", `${stream}.txt`), logs.data[stream]);
        }
      }
      if (last !== "completed") {
        const tail = String(logs.data?.stderr || logs.data?.stdout || "").trim().split("\n").slice(-20).join("\n");
        throw new Error(`SPARCq job ${sparcqId} ended as ${last}.${tail ? `\nLast lines:\n${tail}` : ""}`);
      }
      // The driver's own result table, by convention; its absence is a failure the lab should see.
      table = job.kind === "docking" ? "docking_scores" : "design_proposals";
      if (!existsSync(join(dir, "Results", job.id, "tables", `${table}.csv`))) {
        log(`  note: no Results/${job.id}/tables/${table}.csv on this machine; pushing the logs and the file index only.`);
      }
    }

    if (ctx.noPush) {
      log(`  --no-push: results left in ${dir}`);
      await fail("The runner was started with --no-push, so no iteration was created for this job.");
      return;
    }
    if (!ctx.projectToken) throw new Error("No project push key on this machine (set SDD_PROJECT_TOKEN or pass --project-token-file).");

    const iteration = await pushResults({ ...job, cluster: cluster?.name }, dir, table, ctx.origin, ctx.projectToken);
    log(`  pushed results as iteration ${iteration}`);
    const done = await studio(ctx.origin, ctx.token, "POST", `/api/v1/jobs/${job.id}/complete`, {
      ok: true,
      iteration,
      ...(cluster ? { cluster: cluster.name } : {}),
      note: job.dryRun ? "Dry run: synthetic test data pushed to the sandbox." : "Results pushed as a project iteration.",
    });
    if (!done.data?.ok) log(`  warning: Studio did not record completion (HTTP ${done.status}): ${done.data?.error ?? ""}`);
  } catch (err) {
    await fail(err instanceof Error ? err.message : String(err));
  }
}

// ── commands ──────────────────────────────────────────────────────────────────

function context() {
  const token = tokenFrom("token-file", "SDD_RUNNER_TOKEN", "sdd_rt_");
  if (!token) die("no runner token: set SDD_RUNNER_TOKEN or pass --token-file (Studio → Compute jobs → Sandbox runner tokens).");
  const max = args.max == null ? 1 : Number(args.max);
  if (!Number.isInteger(max) || max < 1 || max > 4) die("--max must be 1–4.");
  const pollSeconds = args.poll == null ? 30 : Number(args.poll);
  if (!Number.isFinite(pollSeconds) || pollSeconds < 15) die("--poll must be at least 15 seconds.");
  return {
    origin: studioOrigin(),
    token,
    projectToken: tokenFrom("project-token-file", "SDD_PROJECT_TOKEN", "sdd_pt_"),
    workDir: resolve(typeof args["work-dir"] === "string" ? args["work-dir"] : "sparc-runner-work"),
    max,
    pollSeconds,
    dryRunOnly: args["dry-run"] === true,
    noPush: args["no-push"] === true,
    sparcq: sparcqConfig(),
  };
}

async function once(ctx) {
  const { status, data } = await studio(ctx.origin, ctx.token, "POST", "/api/v1/jobs/claim", { max: ctx.max });
  if (status === 401) die("Studio refused the runner token (unknown, revoked or expired).");
  if (!data?.ok) {
    log(`Studio could not be polled (HTTP ${status}): ${data?.error ?? "no answer"}`);
    return 0;
  }
  const jobs = data.jobs ?? [];
  if (!jobs.length) return 0;
  for (const job of jobs) await handleJob(job, ctx);
  return jobs.length;
}

async function selftest(ctx) {
  console.log(`Studio:  ${ctx.origin}`);
  console.log(`Runner token: ${ctx.token ? "present" : "missing"} · project push key: ${ctx.projectToken ? "present" : "missing"}`);
  const claimable = await studio(ctx.origin, ctx.token, "POST", "/api/v1/jobs/claim", { max: 1 });
  // Claiming is the only way to ask Studio "do you accept this token?"; a claimed job is handled below.
  console.log(`Studio queue: HTTP ${claimable.status}${claimable.data?.ok ? ` · ${(claimable.data.jobs ?? []).length} job(s) claimed` : ` · ${claimable.data?.error ?? "refused"}`}`);

  if (!ctx.sparcq) {
    console.log("SPARCq: no configuration on this machine, so the real path cannot be checked here.");
  } else {
    const me = await sparcq(ctx.sparcq, "GET", "/me");
    console.log(`SPARCq /me: HTTP ${me.status}${me.data?.username ? ` · user ${me.data.username}` : ""}`);
    const sample = {
      id: "job_selftest00",
      kind: typeof args.kind === "string" ? args.kind : "docking",
      title: "sparc-runner selftest",
      project: "sandbox",
      estGpuHours: 1,
      params: { note: "selftest: the script is validated, never submitted" },
    };
    const cluster = await pickCluster(ctx.sparcq, { clusterPreference: typeof args.cluster === "string" ? args.cluster : null });
    console.log(`SPARCq cluster chosen: ${cluster.name} (${cluster.type}${cluster.partition ? `, ${cluster.partition}` : ""})`);
    const script = composeScript(sample, cluster);
    const check = await sparcq(ctx.sparcq, "POST", "/jobs/validate", {
      cluster: cluster.name,
      script_content: script,
      estimated_hours: 0.1,
      gpu_count: 1,
      description: "sparc-runner selftest (validation only)",
    });
    console.log(`SPARCq /jobs/validate: HTTP ${check.status} · is_valid=${check.data?.is_valid}`);
    if (check.data?.validation_message) console.log(`  ${String(check.data.validation_message).split("\n")[0]}`);
    if (check.data?.hint) console.log(`  hint: ${check.data.hint}`);
    console.log("No job was created: /jobs/validate is a dry-run pre-flight.");
  }
  // A job claimed by the check above must not be left hanging.
  for (const job of claimable.data?.jobs ?? []) await handleJob(job, ctx);
}

if (command === "script") {
  if (typeof args.job !== "string") die("usage: node runner.mjs script --job <file with a job JSON> [--cluster <name>]");
  const job = JSON.parse(readFileSync(args.job, "utf8"));
  const cfg = sparcqConfig();
  let cluster = { name: typeof args.cluster === "string" ? args.cluster : "unknown", type: "bash", partition: null };
  if (cfg && typeof args.cluster === "string") {
    const { data } = await sparcq(cfg, "GET", "/clusters");
    if (data?.[args.cluster]) cluster = { name: args.cluster, ...data[args.cluster] };
  }
  process.stdout.write(composeScript(job, cluster));
} else if (command === "selftest") {
  await selftest(context());
} else if (command === "once") {
  const ctx = context();
  const n = await once(ctx);
  log(n ? `handled ${n} job(s).` : "nothing to do.");
} else if (command === "poll") {
  const ctx = context();
  log(`polling ${ctx.origin} every ${ctx.pollSeconds}s (work dir ${ctx.workDir})${ctx.dryRunOnly ? " — dry runs only" : ""}`);
  for (;;) {
    try {
      const n = await once(ctx);
      if (!n) await sleep(ctx.pollSeconds * 1000);
    } catch (err) {
      log(`poll failed: ${err instanceof Error ? err.message : String(err)}`);
      await sleep(ctx.pollSeconds * 1000);
    }
  }
} else {
  console.log("Usage: node runner.mjs once | poll | selftest | script --job <file>   (see the top of runner.mjs)");
  process.exit(command ? 1 : 0);
}

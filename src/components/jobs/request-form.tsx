"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KIND_LABEL } from "@/components/jobs/job-ui";

/*
 * "Request a run": the form that writes a job request. It sends what the person typed to
 * POST /api/v1/jobs, which validates every field again on the server and decides whether the job
 * starts queued or has to be approved.
 */

type Kind = "docking" | "generative-design";

const OBJECTIVES: { key: string; label: string; help: string }[] = [
  { key: "potency", label: "Potency against a target", help: "Needs a target to score against." },
  { key: "selectivity", label: "Selectivity", help: "Prefer proposals that avoid close relatives of the target." },
  { key: "qed", label: "Drug-likeness (QED)", help: "A standard composite of simple physicochemical properties." },
  { key: "synthetic-accessibility", label: "Synthetic accessibility", help: "Prefer proposals that look makeable." },
  { key: "molecular-weight-window", label: "Molecular-weight window", help: "Keep the weight inside a sensible range." },
  { key: "logp-window", label: "logP window", help: "Keep lipophilicity inside a sensible range." },
  { key: "novelty", label: "Novelty against the seeds", help: "Prefer proposals unlike the seed set." },
];

const field = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm";
const label = "block text-xs font-medium text-muted-foreground mb-1";
const section = "rounded-lg border bg-card p-4 space-y-3";

interface ProjectOption {
  slug: string;
  title: string;
  kind: string;
}

export function RequestRunForm({ initialKind }: { initialKind?: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind === "generative-design" ? "generative-design" : "docking");
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [project, setProject] = useState("sandbox");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const [cluster, setCluster] = useState("");
  const [noPhi, setNoPhi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Docking
  const [receptorSource, setReceptorSource] = useState<"pdb" | "campaign-file">("pdb");
  const [pdbId, setPdbId] = useState("");
  const [chain, setChain] = useState("");
  const [receptorPath, setReceptorPath] = useState("");
  const [ligandSource, setLigandSource] = useState<"smiles" | "campaign-table">("smiles");
  const [ligandSmiles, setLigandSmiles] = useState("");
  const [ligandTable, setLigandTable] = useState("");
  const [ligandColumn, setLigandColumn] = useState("smiles");
  const [ligandLimit, setLigandLimit] = useState("500");
  const [siteMode, setSiteMode] = useState<"box" | "reference-ligand">("box");
  const [center, setCenter] = useState({ x: "", y: "", z: "" });
  const [size, setSize] = useState({ x: "20", y: "20", z: "20" });
  const [refLigand, setRefLigand] = useState("");
  const [padding, setPadding] = useState("8");
  const [exhaustiveness, setExhaustiveness] = useState("8");
  const [poses, setPoses] = useState("5");
  const [engine, setEngine] = useState("");

  // Generative design
  const [seedSource, setSeedSource] = useState<"smiles" | "campaign-table">("smiles");
  const [seedSmiles, setSeedSmiles] = useState("");
  const [seedTable, setSeedTable] = useState("");
  const [seedColumn, setSeedColumn] = useState("smiles");
  const [objectives, setObjectives] = useState<string[]>(["qed", "synthetic-accessibility"]);
  const [count, setCount] = useState("100");
  const [target, setTarget] = useState("");
  const [keepScaffold, setKeepScaffold] = useState(false);
  const [generator, setGenerator] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/v1/projects", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { projects?: ProjectOption[] }) => {
        if (live) setProjects(d.projects ?? []);
      })
      .catch(() => live && setProjects([]));
    return () => {
      live = false;
    };
  }, []);

  const chosen = projects?.find((p) => p.slug === project);
  const isSandbox = !chosen || chosen.kind === "sandbox";

  const toggleObjective = (key: string) =>
    setObjectives((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const params = (): Record<string, unknown> => {
    if (kind === "docking") {
      return {
        receptor:
          receptorSource === "pdb"
            ? { source: "pdb", pdbId: pdbId.trim(), chain: chain.trim() || null }
            : { source: "campaign-file", path: receptorPath.trim() },
        ligands:
          ligandSource === "smiles"
            ? { source: "smiles", smiles: ligandSmiles }
            : { source: "campaign-table", table: ligandTable.trim(), column: ligandColumn.trim(), limit: Number(ligandLimit) },
        site:
          siteMode === "box"
            ? {
                mode: "box",
                center: { x: Number(center.x), y: Number(center.y), z: Number(center.z) },
                size: { x: Number(size.x), y: Number(size.y), z: Number(size.z) },
              }
            : { mode: "reference-ligand", ligand: refLigand.trim(), padding: Number(padding) },
        exhaustiveness: Number(exhaustiveness),
        posesPerLigand: Number(poses),
        engine: engine.trim() || null,
      };
    }
    return {
      seeds:
        seedSource === "smiles"
          ? { source: "smiles", smiles: seedSmiles }
          : { source: "campaign-table", table: seedTable.trim(), column: seedColumn.trim(), limit: 1000 },
      objectives,
      count: Number(count),
      target: target.trim() || null,
      keepScaffold,
      generator: generator.trim() || null,
      notes: notes.trim() || null,
    };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          kind,
          title: title.trim(),
          estGpuHours: Number(hours),
          cluster: cluster.trim() || null,
          noPhi,
          params: params(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; job?: { id: string } };
      if (!res.ok || !data.ok || !data.job) {
        setError(data.error ?? `The request was refused (HTTP ${res.status}).`);
        setBusy(false);
        return;
      }
      router.push(`/jobs/${data.job.id}`);
    } catch {
      setError("Network error — the request was not sent.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["docking", "generative-design"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              kind === k ? "border-primary bg-primary/10" : "hover:bg-accent"
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className={section}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="job-project">Project</label>
            <select id="job-project" className={field} value={project} onChange={(e) => setProject(e.target.value)}>
              {(projects ?? [{ slug: "sandbox", title: "Developer sandbox", kind: "sandbox" }]).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.title} ({p.slug}){p.kind === "sandbox" ? " — dry runs only" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="job-title">Title</label>
            <input
              id="job-title"
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "docking" ? "PHGDH allosteric site, round 3" : "Scaffold hops from round 2 hits"}
              maxLength={80}
              required
            />
          </div>
        </div>
        {isSandbox && (
          <p className="text-xs text-amber-800 dark:text-amber-300">
            The sandbox takes test data only, so a sandbox request is completed as a <strong>dry run</strong>: the runner
            writes clearly labelled synthetic results and no cluster time is used.
          </p>
        )}
      </div>

      {kind === "docking" ? (
        <>
          <div className={section}>
            <h2 className="text-sm font-semibold">Receptor</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {([["pdb", "A PDB entry"], ["campaign-file", "A structure file in the project"]] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="receptor-source" checked={receptorSource === v} onChange={() => setReceptorSource(v)} />
                  {l}
                </label>
              ))}
            </div>
            {receptorSource === "pdb" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="pdb-id">PDB entry ID</label>
                  <input id="pdb-id" className={field} value={pdbId} onChange={(e) => setPdbId(e.target.value)} placeholder="2PA3" maxLength={4} required />
                </div>
                <div>
                  <label className={label} htmlFor="pdb-chain">Chain (optional)</label>
                  <input id="pdb-chain" className={field} value={chain} onChange={(e) => setChain(e.target.value)} placeholder="A" maxLength={4} />
                </div>
              </div>
            ) : (
              <div>
                <label className={label} htmlFor="receptor-path">File path in the project</label>
                <input
                  id="receptor-path"
                  className={field}
                  value={receptorPath}
                  onChange={(e) => setReceptorPath(e.target.value)}
                  placeholder="Results/r012/structures/receptor_prepared.pdb"
                  required
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Receptor preparation (protonation, charges, removing waters) is the runner&apos;s job script&apos;s
              responsibility and is still being settled — see the plan&apos;s open questions.
            </p>
          </div>

          <div className={section}>
            <h2 className="text-sm font-semibold">Ligand set</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {([["smiles", "Paste SMILES"], ["campaign-table", "A column of a project table"]] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="ligand-source" checked={ligandSource === v} onChange={() => setLigandSource(v)} />
                  {l}
                </label>
              ))}
            </div>
            {ligandSource === "smiles" ? (
              <div>
                <label className={label} htmlFor="ligand-smiles">SMILES, one per line (at most 500)</label>
                <textarea
                  id="ligand-smiles"
                  className={`${field} font-mono text-xs`}
                  rows={5}
                  value={ligandSmiles}
                  onChange={(e) => setLigandSmiles(e.target.value)}
                  placeholder={"CC(=O)Oc1ccccc1C(=O)O\nCn1cnc2c1c(=O)[nH]c(=O)n2C"}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="ligand-table">Table</label>
                  <input id="ligand-table" className={field} value={ligandTable} onChange={(e) => setLigandTable(e.target.value)} placeholder="decision_sheet" required />
                </div>
                <div>
                  <label className={label} htmlFor="ligand-column">Column</label>
                  <input id="ligand-column" className={field} value={ligandColumn} onChange={(e) => setLigandColumn(e.target.value)} required />
                </div>
                <div>
                  <label className={label} htmlFor="ligand-limit">At most</label>
                  <input id="ligand-limit" className={field} type="number" min={1} max={5000} value={ligandLimit} onChange={(e) => setLigandLimit(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className={section}>
            <h2 className="text-sm font-semibold">Binding site</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {([["box", "A box I give"], ["reference-ligand", "Centred on a co-crystal ligand"]] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="site-mode" checked={siteMode === v} onChange={() => setSiteMode(v)} />
                  {l}
                </label>
              ))}
            </div>
            {siteMode === "box" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <fieldset className="grid grid-cols-3 gap-2">
                  <legend className={label}>Centre (Å)</legend>
                  {(["x", "y", "z"] as const).map((axis) => (
                    <input
                      key={axis}
                      className={field}
                      type="number"
                      step="any"
                      aria-label={`Centre ${axis}`}
                      placeholder={axis}
                      value={center[axis]}
                      onChange={(e) => setCenter({ ...center, [axis]: e.target.value })}
                      required
                    />
                  ))}
                </fieldset>
                <fieldset className="grid grid-cols-3 gap-2">
                  <legend className={label}>Box size (Å)</legend>
                  {(["x", "y", "z"] as const).map((axis) => (
                    <input
                      key={axis}
                      className={field}
                      type="number"
                      step="any"
                      min={1}
                      max={100}
                      aria-label={`Size ${axis}`}
                      value={size[axis]}
                      onChange={(e) => setSize({ ...size, [axis]: e.target.value })}
                      required
                    />
                  ))}
                </fieldset>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="ref-ligand">Ligand (residue or component ID)</label>
                  <input id="ref-ligand" className={field} value={refLigand} onChange={(e) => setRefLigand(e.target.value)} placeholder="NAD" maxLength={40} required />
                </div>
                <div>
                  <label className={label} htmlFor="padding">Padding (Å)</label>
                  <input id="padding" className={field} type="number" min={0} max={30} value={padding} onChange={(e) => setPadding(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className={section}>
            <h2 className="text-sm font-semibold">Search settings</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="exhaustiveness">Exhaustiveness</label>
                <input id="exhaustiveness" className={field} type="number" min={1} max={64} value={exhaustiveness} onChange={(e) => setExhaustiveness(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="poses">Poses per ligand</label>
                <input id="poses" className={field} type="number" min={1} max={50} value={poses} onChange={(e) => setPoses(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="engine">Engine (optional)</label>
                <input id="engine" className={field} value={engine} onChange={(e) => setEngine(e.target.value)} placeholder="leave blank: the runner decides" maxLength={60} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={section}>
            <h2 className="text-sm font-semibold">Seed set</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {([["smiles", "Paste SMILES"], ["campaign-table", "A column of a project table"]] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="seed-source" checked={seedSource === v} onChange={() => setSeedSource(v)} />
                  {l}
                </label>
              ))}
            </div>
            {seedSource === "smiles" ? (
              <div>
                <label className={label} htmlFor="seed-smiles">SMILES, one per line (at most 500)</label>
                <textarea
                  id="seed-smiles"
                  className={`${field} font-mono text-xs`}
                  rows={4}
                  value={seedSmiles}
                  onChange={(e) => setSeedSmiles(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="seed-table">Table</label>
                  <input id="seed-table" className={field} value={seedTable} onChange={(e) => setSeedTable(e.target.value)} placeholder="decision_sheet" required />
                </div>
                <div>
                  <label className={label} htmlFor="seed-column">Column</label>
                  <input id="seed-column" className={field} value={seedColumn} onChange={(e) => setSeedColumn(e.target.value)} required />
                </div>
              </div>
            )}
          </div>

          <div className={section}>
            <h2 className="text-sm font-semibold">Objectives</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {OBJECTIVES.map((o) => (
                <label key={o.key} className="flex items-start gap-2 text-sm" title={o.help}>
                  <input type="checkbox" className="mt-1" checked={objectives.includes(o.key)} onChange={() => toggleObjective(o.key)} />
                  <span>
                    {o.label}
                    <span className="block text-xs text-muted-foreground">{o.help}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="target">Target (needed for potency)</label>
                <input id="target" className={field} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="PHGDH" maxLength={60} />
              </div>
              <div>
                <label className={label} htmlFor="count">Proposals wanted</label>
                <input id="count" className={field} type="number" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="generator">Generator (optional)</label>
                <input id="generator" className={field} value={generator} onChange={(e) => setGenerator(e.target.value)} placeholder="leave blank: the runner decides" maxLength={60} />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepScaffold} onChange={(e) => setKeepScaffold(e.target.checked)} />
              Keep the seeds&apos; scaffold
            </label>
            <div>
              <label className={label} htmlFor="notes">Notes for whoever runs it (optional)</label>
              <textarea id="notes" className={field} rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div className={section}>
        <h2 className="text-sm font-semibold">Cost and data</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="hours">Estimated GPU-hours</label>
            <input id="hours" className={field} type="number" step="0.1" min={0.1} max={12} value={hours} onChange={(e) => setHours(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Counts against the project&apos;s 30-day budget. Dry runs do not.</p>
          </div>
          <div>
            <label className={label} htmlFor="cluster">Preferred cluster (optional)</label>
            <input id="cluster" className={field} value={cluster} onChange={(e) => setCluster(e.target.value)} placeholder="leave blank: the runner chooses" maxLength={30} />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={noPhi} onChange={(e) => setNoPhi(e.target.checked)} required />
          <span>
            This run involves <strong>no protected health information and no human-subject data</strong> — only
            structures, sequences and parameters. Your answer is stored with the request.
          </span>
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Request this run"}
        </button>
        <Link href="/jobs" className="text-sm text-muted-foreground hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

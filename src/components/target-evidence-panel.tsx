"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataClassBadge } from "@/components/data-provenance";

interface Evidence {
  gene: string;
  ensemblId: string;
  openTargetsUrl: string;
  associations: {
    total: number;
    limit: number;
    rows: { diseaseId: string; diseaseName: string; score: number; datatypeScores: { datatype: string; score: number }[] }[];
  };
  tractability: { modality: string; modalityLabel: string; evidence: { label: string; value: boolean }[] }[];
  drugAndClinicalCandidates: number | null;
  note: string;
  source: { name: string; retrieved: string; release?: { version: string } };
}

type State = { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "ok"; data: Evidence };

const extLink = "text-primary hover:underline";
const fmt = (n: number) => n.toFixed(2);
const datatypeLabel = (id: string) => id.replace(/_/g, " ");

/** Open Targets evidence for one gene, fetched from /api/target-evidence when first expanded. */
export function TargetEvidencePanel({ gene, initiallyOpen = false }: { gene: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  const load = async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/target-evidence?gene=${encodeURIComponent(gene)}`);
      const body = await res.json();
      if (!res.ok) setState({ status: "error", message: body.error ?? `HTTP ${res.status}` });
      else setState({ status: "ok", data: body as Evidence });
    } catch {
      setState({ status: "error", message: "Could not reach this site's API." });
    }
  };

  // Detail pages open the panel on load; cards keep it collapsed until asked.
  useEffect(() => {
    if (!initiallyOpen) return;
    setOpen(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiallyOpen, gene]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next || state.status === "ok" || state.status === "loading") return;
    load();
  };

  const panelId = `ot-evidence-${gene}`;
  return (
    <div className="mt-4 border-t pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 text-left text-sm font-medium"
      >
        {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        Evidence (Open Targets)
        <DataClassBadge kind="live" size="sm" />
      </button>
      {open && (
        <div id={panelId} className="mt-3 space-y-3 text-xs">
          {state.status === "loading" && <p className="text-muted-foreground">Loading from Open Targets…</p>}
          {state.status === "error" && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {state.message}
            </p>
          )}
          {state.status === "ok" && <EvidenceBody data={state.data} />}
        </div>
      )}
    </div>
  );
}

function EvidenceBody({ data }: { data: Evidence }) {
  const { associations, tractability } = data;
  return (
    <>
      <div>
        <p className="font-medium">
          Top {associations.rows.length} of {associations.total.toLocaleString()} associated diseases
        </p>
        <table className="mt-1 w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-normal">Disease</th>
              <th className="py-1 pr-2 font-normal text-right">Overall</th>
              <th className="py-1 font-normal">By datatype</th>
            </tr>
          </thead>
          <tbody>
            {associations.rows.map((r) => (
              <tr key={r.diseaseId} className="border-t align-top">
                <td className="py-1 pr-2">
                  <a
                    href={`https://platform.opentargets.org/evidence/${data.ensemblId}/${r.diseaseId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={extLink}
                  >
                    {r.diseaseName}
                  </a>
                </td>
                <td className="py-1 pr-2 text-right font-mono">{fmt(r.score)}</td>
                <td className="py-1 text-muted-foreground">
                  {r.datatypeScores.map((d) => `${datatypeLabel(d.datatype)} ${fmt(d.score)}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="font-medium">Tractability by modality</p>
        <ul className="mt-1 space-y-1">
          {tractability.map((m) => {
            const met = m.evidence.filter((e) => e.value).map((e) => e.label);
            return (
              <li key={m.modality}>
                <span className="font-medium">{m.modalityLabel}:</span>{" "}
                {met.length ? met.join(", ") : <span className="text-muted-foreground">no bucket met</span>}
              </li>
            );
          })}
        </ul>
      </div>

      {data.drugAndClinicalCandidates !== null && (
        <p>
          Drug and clinical-candidate records in Open Targets: <span className="font-medium">{data.drugAndClinicalCandidates}</span>
        </p>
      )}

      <p className="text-muted-foreground">{data.note}</p>
      <p className="text-muted-foreground">
        Source:{" "}
        <a href={data.openTargetsUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Open Targets Platform, {data.gene} ({data.ensemblId})
        </a>
        {data.source.release && <>, release {data.source.release.version}</>}, retrieved{" "}
        {new Date(data.source.retrieved).toLocaleString()}
      </p>
    </>
  );
}

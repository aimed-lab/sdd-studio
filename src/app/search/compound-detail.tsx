"use client";

import { useEffect, useState } from "react";
import { SourceLine } from "@/components/data-provenance";

interface MechanismRow {
  recordChemblId: string;
  mechanism: string | null;
  actionType: string | null;
  targetChemblId: string | null;
  targetName: string | null;
  targetOrganism: string | null;
  refs: { type: string | null; id: string | null; url: string | null }[];
}

interface ActivityRow {
  activityId: number;
  targetChemblId: string | null;
  targetName: string | null;
  targetOrganism: string | null;
  type: string | null;
  relation: string | null;
  value: string | null;
  units: string | null;
  pchembl: string | null;
  assayChemblId: string | null;
  assayType: string | null;
  documentChemblId: string | null;
}

interface CompoundData {
  chemblId: string;
  parentChemblId: string;
  mechanisms: { error: string | null; rows: MechanismRow[] };
  activities: {
    error: string | null;
    total: number | null;
    shown: number;
    flaggedExcluded: number | null;
    selection: string;
    fullRecordUrl: string;
    rows: ActivityRow[];
  };
  source: { name: string; url: string; retrieved: string; release?: { version: string; date: string | null } };
}

const ASSAY_TYPES: Record<string, string> = {
  B: "Binding",
  F: "Functional",
  A: "ADMET",
  T: "Toxicity",
  P: "Physicochemical",
  U: "Unclassified",
};

const chemblLink = (kind: string, id: string | null) =>
  id ? (
    <a
      href={`https://www.ebi.ac.uk/chembl/${kind}_report_card/${id}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-primary hover:underline"
    >
      {id}
    </a>
  ) : (
    "—"
  );

export function CompoundDetail({ chemblId }: { chemblId: string }) {
  const [data, setData] = useState<CompoundData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/compound/${encodeURIComponent(chemblId)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load ChEMBL data");
        setData(body);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load ChEMBL data");
      });
    return () => controller.abort();
  }, [chemblId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading mechanism and activity from ChEMBL…</p>;

  const { mechanisms, activities } = data;

  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="font-semibold">Mechanism of action</h3>
        {data.parentChemblId !== data.chemblId && (
          <p className="text-xs text-muted-foreground">Shown for the parent molecule {data.parentChemblId}.</p>
        )}
        {mechanisms.error ? (
          <p className="text-destructive">Mechanism data unavailable: {mechanisms.error}</p>
        ) : mechanisms.rows.length === 0 ? (
          <p className="text-muted-foreground">ChEMBL records no mechanism of action for this molecule.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {mechanisms.rows.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.mechanism ?? m.actionType ?? "Mechanism"}</span>
                {" — target "}
                {m.targetName ?? "unnamed target"} ({chemblLink("target", m.targetChemblId)})
                {m.targetOrganism ? `, ${m.targetOrganism}` : ""}
                {m.refs.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {" · Source: "}
                    {m.refs.map((r, j) =>
                      r.url ? (
                        <a key={j} href={r.url} target="_blank" rel="noopener noreferrer" className="mr-2 underline">
                          {r.type ?? "reference"}
                        </a>
                      ) : (
                        <span key={j} className="mr-2">
                          {r.type} {r.id}
                        </span>
                      )
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-semibold">Bioactivity</h3>
        {activities.error ? (
          <p className="text-destructive">Activity data unavailable: {activities.error}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Showing {activities.shown} of {activities.total ?? "?"} activities. {activities.selection}
              {activities.flaggedExcluded !== null && activities.flaggedExcluded > 0
                ? ` ${activities.flaggedExcluded} flagged by ChEMBL as potentially invalid were excluded.`
                : activities.flaggedExcluded === 0
                  ? " None were excluded for validity flags."
                  : ""}{" "}
              Values come from different assays and are not directly comparable.{" "}
              <a href={activities.fullRecordUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Full record on ChEMBL
              </a>
            </p>
            {activities.rows.length > 0 && (
              <div className="mt-2 max-h-80 overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {["Target", "Organism", "Type", "Value", "pChEMBL", "Assay", "Assay type", "Document"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activities.rows.map((a) => (
                      <tr key={a.activityId}>
                        <td className="px-2 py-1">{a.targetName ?? chemblLink("target", a.targetChemblId)}</td>
                        <td className="px-2 py-1 italic">{a.targetOrganism ?? "—"}</td>
                        <td className="px-2 py-1">{a.type ?? "—"}</td>
                        <td className="px-2 py-1 tabular-nums">
                          {a.relation && a.relation !== "=" ? `${a.relation} ` : ""}
                          {a.value ?? "—"} {a.units ?? ""}
                        </td>
                        <td className="px-2 py-1 tabular-nums">{a.pchembl ?? "—"}</td>
                        <td className="px-2 py-1">{chemblLink("assay", a.assayChemblId)}</td>
                        <td className="px-2 py-1">{a.assayType ? ASSAY_TYPES[a.assayType] ?? a.assayType : "—"}</td>
                        <td className="px-2 py-1">{chemblLink("document", a.documentChemblId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        <SourceLine name={data.source.name} url={data.source.url} retrieved={data.source.retrieved} />
        {data.source.release && <span>Data release {data.source.release.version}</span>}
      </div>
    </div>
  );
}

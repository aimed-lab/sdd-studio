import Link from "next/link";
import { DataClassBadge } from "@/components/data-provenance";
import type { TargetDrugs } from "@/lib/target-drugs";

const extLink = "text-primary hover:underline";

/** Approved drugs whose ChEMBL mechanism of action names this target (live, cached 24 h). */
export function TargetDrugsSection({ result }: { result: { ok: true; value: TargetDrugs } | { ok: false; message: string } }) {
  return (
    <section aria-labelledby="drugs-heading" className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="drugs-heading" className="text-base font-semibold">
          Approved drugs (ChEMBL mechanism of action)
        </h2>
        <DataClassBadge kind="live" size="sm" />
      </div>
      {!result.ok ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {result.message} No cached or demo data is shown in its place.
        </p>
      ) : result.value.drugs.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          ChEMBL lists no approved drug (max phase 4) whose mechanism of action names this target.
        </p>
      ) : (
        <>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-normal">Drug</th>
                <th className="py-1 pr-2 font-normal">ChEMBL ID</th>
                <th className="py-1 pr-2 font-normal">Type</th>
                <th className="py-1 font-normal text-right">First approval</th>
              </tr>
            </thead>
            <tbody>
              {result.value.drugs.map((d) => (
                <tr key={d.chemblId} className="border-t">
                  <td className="py-1 pr-2 capitalize">
                    <Link href={`/search?q=${encodeURIComponent(d.name)}`} className={extLink}>
                      {d.name}
                    </Link>
                  </td>
                  <td className="py-1 pr-2 font-mono text-xs">
                    <a
                      href={`https://www.ebi.ac.uk/chembl/explore/compound/${d.chemblId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={extLink}
                    >
                      {d.chemblId}
                    </a>
                  </td>
                  <td className="py-1 pr-2">{d.moleculeType ?? "—"}</td>
                  <td className="py-1 text-right">{d.firstApproval ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.value.omitted.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Also approved, beyond the first {result.value.drugs.length}:{" "}
              <span className="capitalize">{result.value.omitted.join(", ")}</span>.
            </p>
          )}
        </>
      )}
      {result.ok && (
        <p className="mt-2 text-xs text-muted-foreground">
          {result.value.selection} ChEMBL target{result.value.targets.length === 1 ? "" : "s"}:{" "}
          {result.value.targets.map((t) => `${t.chemblId} (${t.name})`).join(", ") || "none found"}. Source:{" "}
          <a href={result.value.source.queryUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {result.value.source.name}
            {result.value.source.release ? ` ${result.value.source.release.version}` : ""}
          </a>
          , retrieved {new Date(result.value.source.retrieved).toISOString().slice(0, 16).replace("T", " ")} UTC. Approval
          status is ChEMBL max phase 4; it does not state an indication.
        </p>
      )}
    </section>
  );
}

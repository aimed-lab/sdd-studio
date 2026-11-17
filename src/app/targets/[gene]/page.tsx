// Target detail page (#25 Stage 1). Identity comes from the curated registry (or, for genes outside it, from HGNC
// live); evidence, drugs and trials are live; demo program fields appear only to members, in a labelled section.
// Each section renders and fails on its own.
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { DataClassBadge } from "@/components/data-provenance";
import { EgfrResistancePanel } from "@/components/egfr-resistance-panel";
import { TargetDrugsSection } from "@/components/target-drugs-section";
import { TargetEvidencePanel } from "@/components/target-evidence-panel";
import { TargetProgramSection } from "@/components/target-program-section";
import { pdbLigandLinks, rcsbSearchUrl } from "@/data/curated/pdb-ligands";
import { referenceCompounds } from "@/data/curated/chembl-reference-compounds";
import { targetDefaultConditions, trialsHrefFor } from "@/data/curated/target-default-conditions";
import { type HgncGene, resolveHgnc } from "@/data/registry/hgnc";
import { GENE_SYMBOL, type RegistryTarget, findRegistryTarget, targetHref } from "@/data/registry/targets";
import { type TargetDrugs, approvedDrugsForTarget } from "@/lib/target-drugs";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const SECTION_TIMEOUT_MS = 6000;
const extLink = "text-primary hover:underline";

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

type Identity =
  | { kind: "registry"; target: RegistryTarget }
  | { kind: "hgnc"; gene: HgncGene }
  | { kind: "unresolved"; symbol: string; message: string };

const resolve = cache(async (raw: string): Promise<Identity> => {
  if (!GENE_SYMBOL.test(raw)) notFound();
  const upper = raw.toUpperCase();
  const target = findRegistryTarget(upper);
  if (target) {
    if (raw !== upper) permanentRedirect(targetHref(upper));
    return { kind: "registry", target };
  }
  let hgnc: HgncGene | null;
  try {
    hgnc = await withTimeout(resolveHgnc(upper), SECTION_TIMEOUT_MS);
  } catch {
    // HGNC down: the symbol may still be valid, so show the live sections without an identity block.
    return { kind: "unresolved", symbol: upper, message: "HGNC could not be reached, so this symbol was not checked." };
  }
  if (!hgnc) notFound();
  if (hgnc.symbol !== raw) permanentRedirect(targetHref(hgnc.symbol));
  return { kind: "hgnc", gene: hgnc };
});

const symbolOf = (id: Identity) =>
  id.kind === "registry" ? id.target.gene.value : id.kind === "hgnc" ? id.gene.symbol : id.symbol;

// Resolution runs here first: metadata is awaited before the response starts, so an invalid or unknown symbol gets
// a real 404 and an alias a real 308, rather than a streamed not-found page with status 200.
export async function generateMetadata({ params }: { params: { gene: string } }): Promise<Metadata> {
  const identity = await resolve(decodeURIComponent(params.gene));
  return { title: `${symbolOf(identity)} · Targets · SmartDrugDiscovery` };
}

export default async function TargetDetailPage({ params }: { params: { gene: string } }) {
  const identity = await resolve(decodeURIComponent(params.gene));
  const symbol = symbolOf(identity);

  // Approved drugs are fetched server-side for every resolved gene; failures render in their own section.
  const [drugs] = await Promise.allSettled([withTimeout(approvedDrugsForTarget(symbol), SECTION_TIMEOUT_MS)]);
  const drugResult: { ok: true; value: TargetDrugs } | { ok: false; message: string } =
    drugs.status === "fulfilled"
      ? { ok: true, value: drugs.value }
      : { ok: false, message: "ChEMBL could not be reached or did not answer in time." };

  const preset = targetDefaultConditions[symbol];
  const trialsHref = trialsHrefFor(symbol);
  const drugAwareHref = `${trialsHref}&mode=drug-aware`;
  const uniprotId =
    identity.kind === "registry" ? identity.target.uniprotId.value : identity.kind === "hgnc" ? identity.gene.uniprotIds[0] : undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/targets" className={extLink}>
          Targets
        </Link>{" "}
        / {symbol}
      </nav>

      <header>
        <h1 className="text-3xl font-bold">{symbol}</h1>
        <p className="mt-1 text-muted-foreground">
          {identity.kind === "registry" ? identity.target.name.value : identity.kind === "hgnc" ? identity.gene.name : ""}
        </p>
      </header>

      <IdentitySection identity={identity} />

      <section aria-labelledby="evidence-heading" className="rounded-lg border p-4">
        <h2 id="evidence-heading" className="sr-only">
          Open Targets evidence
        </h2>
        <TargetEvidencePanel gene={symbol} initiallyOpen />
      </section>

      <TargetDrugsSection result={drugResult} />

      <section aria-labelledby="trials-heading" className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="trials-heading" className="text-base font-semibold">
            Clinical trials (ClinicalTrials.gov)
          </h2>
          <DataClassBadge kind="live" size="sm" />
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <Link href={trialsHref} className={extLink}>
              Search {symbol} trials{preset ? ` in ${preset.condition}` : ""}
            </Link>
            {preset && <span className="text-xs text-muted-foreground"> (condition from the curated source: {preset.source})</span>}
          </li>
          <li>
            <Link href={drugAwareHref} className={extLink}>
              Same search, drug-aware: also trials naming approved {symbol} drugs
            </Link>
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Trial searches run live when you open them; the exact query sent is shown with the results.
        </p>
      </section>

      {identity.kind === "registry" && identity.target.curatedSets.value.includes("egfr-resistance") && <EgfrResistancePanel />}

      {uniprotId && (
        <section aria-labelledby="links-heading" className="rounded-lg border p-4 text-sm">
          <h2 id="links-heading" className="text-base font-semibold">
            Other sources
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <a href={rcsbSearchUrl(uniprotId)} target="_blank" rel="noopener noreferrer" className={extLink}>
                All PDB entries for {uniprotId}
              </a>
            </li>
            {pdbLigandLinks
              .filter((l) => l.uniprotId === uniprotId)
              .map((l) => (
                <li key={l.ligandId}>
                  <a
                    href={rcsbSearchUrl(l.uniprotId, l.ligandId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={extLink}
                    title={`${l.entriesAtVerification} entries when verified on ${l.verified}`}
                  >
                    PDB entries: {l.gene} with {l.drug.toLowerCase()} ({l.ligandId})
                  </a>{" "}
                  <DataClassBadge kind="curated" size="sm" />
                </li>
              ))}
          </ul>
        </section>
      )}

      {identity.kind === "registry" && <TargetProgramSection target={identity.target} />}
    </div>
  );
}

function IdentitySection({ identity }: { identity: Identity }) {
  if (identity.kind === "unresolved") {
    return (
      <section role="alert" className="rounded-lg border p-4 text-sm text-red-700 dark:text-red-400">
        {identity.message}
      </section>
    );
  }
  if (identity.kind === "hgnc") {
    const g = identity.gene;
    return (
      <section aria-labelledby="identity-heading" className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="identity-heading" className="text-base font-semibold">
            Identity
          </h2>
          <DataClassBadge kind="live" size="sm" />
          <span className="text-xs text-muted-foreground">Not in this site&apos;s curated target registry</span>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <Row label="HGNC">
            <a href={`https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${g.hgncId}`} target="_blank" rel="noopener noreferrer" className={extLink}>
              {g.hgncId}
            </a>
          </Row>
          <Row label="Locus group">{g.locusGroup ?? "—"}</Row>
          <Row label="UniProt">
            {g.uniprotIds.length
              ? g.uniprotIds.map((u) => (
                  <a key={u} href={`https://www.uniprot.org/uniprotkb/${u}/entry`} target="_blank" rel="noopener noreferrer" className={`${extLink} mr-2 font-mono`}>
                    {u}
                  </a>
                ))
              : "—"}
          </Row>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Source:{" "}
          <a href={g.source.queryUrl} target="_blank" rel="noopener noreferrer" className="underline">
            HGNC
          </a>{" "}
          (matched by {g.matchedBy.replace("_", " ")}), retrieved {new Date(g.source.retrieved).toISOString().slice(0, 16).replace("T", " ")} UTC.
        </p>
      </section>
    );
  }
  const t = identity.target;
  const refCount = referenceCompounds.filter((c) => c.mechanismTargets.some((m) => m.toUpperCase() === t.gene.value)).length;
  return (
    <section aria-labelledby="identity-heading" className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="identity-heading" className="text-base font-semibold">
          Identity
        </h2>
        <DataClassBadge kind="curated" size="sm" />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <Row label="UniProt">
          <a href={`https://www.uniprot.org/uniprotkb/${t.uniprotId.value}/entry`} target="_blank" rel="noopener noreferrer" className={`${extLink} font-mono`}>
            {t.uniprotId.value}
          </a>
        </Row>
        <Row label="HGNC">
          <a href={`https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/${t.hgncId.value}`} target="_blank" rel="noopener noreferrer" className={extLink}>
            {t.hgncId.value}
          </a>
        </Row>
        <Row label="ChEMBL target">
          <a href={`https://www.ebi.ac.uk/chembl/explore/target/${t.chemblTargetId.value}`} target="_blank" rel="noopener noreferrer" className={`${extLink} font-mono`}>
            {t.chemblTargetId.value}
          </a>
        </Row>
        <Row label="Organism">
          <span className="italic">{t.organism.value}</span>
        </Row>
        <Row label="Class (UniProt keyword)">{t.targetClass.value}</Row>
        <Row label="Reference compounds">
          {refCount > 0 ? (
            <Link href={`/compounds?target=${encodeURIComponent(t.gene.value)}`} className={extLink}>
              {refCount} in the curated ChEMBL set
            </Link>
          ) : (
            "none listed"
          )}
        </Row>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Sources: {t.uniprotId.source}; {t.chemblTargetId.source}.
      </p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

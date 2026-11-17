import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cpu, ShieldCheck } from "lucide-react";
import { AdmetScreener } from "@/components/admet/admet-screener";

export const metadata: Metadata = {
  title: "Local ADMET screener — SmartDrugDiscovery",
  description:
    "Rule-based property screening computed from structures in your browser: molecular weight, cLogP, hydrogen-bond counts, rotatable bonds, TPSA, Lipinski and Veber checks, and PAINS and Brenk substructure alerts.",
};

export default function AdmetScreenerPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <Link
          href="/services"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Add-on Service
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Local ADMET screener</h1>
        <p className="mt-1 text-muted-foreground">
          Rule-based property screening, computed from the structures you supply. Molecular weight, Crippen cLogP,
          hydrogen-bond donors and acceptors, rotatable bonds and topological polar surface area, with Lipinski and
          Veber checks and PAINS and Brenk substructure alerts.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div role="note" className="flex items-start gap-2 rounded-md border p-3 text-xs text-muted-foreground">
          <Cpu className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="text-foreground">Computed descriptors, not measurements.</strong> Every value comes
            from RDKit&apos;s descriptor code, running here as WebAssembly, applied to the structure you paste. They
            are calculated properties of a drawn structure: an experimental logP or solubility will differ. The rule
            checks are published thresholds, cited on this page, not an assessment of a compound.
          </span>
        </div>
        <div role="note" className="flex items-start gap-2 rounded-md border p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="text-foreground">Your structures stay in the browser.</strong> There is no upload and
            no server-side computation: the screening runs in this tab, so unpublished structures are not sent
            anywhere. Closing the tab discards them.
          </span>
        </div>
      </div>

      <AdmetScreener />
    </div>
  );
}

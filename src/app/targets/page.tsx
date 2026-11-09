"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Target {
  id: string;
  name: string;
  gene: string;
  uniprotId: string;
  organism: string;
  diseaseArea: string;
  diseaseKey: string;
  compoundCount: number;
  targetClass: string;
}

const targets: Target[] = [
  {
    id: "TGT-001",
    name: "Epidermal Growth Factor Receptor",
    gene: "EGFR",
    uniprotId: "P00533",
    organism: "Homo sapiens",
    diseaseArea: "Non-Small Cell Lung Cancer",
    diseaseKey: "NSCLC",
    compoundCount: 42,
    targetClass: "Kinase",
  },
  {
    id: "TGT-002",
    name: "B-Raf Proto-Oncogene",
    gene: "BRAF",
    uniprotId: "P15056",
    organism: "Homo sapiens",
    diseaseArea: "Melanoma",
    diseaseKey: "Melanoma",
    compoundCount: 35,
    targetClass: "Kinase",
  },
  {
    id: "TGT-003",
    name: "Anaplastic Lymphoma Kinase",
    gene: "ALK",
    uniprotId: "Q9UM73",
    organism: "Homo sapiens",
    diseaseArea: "Non-Small Cell Lung Cancer",
    diseaseKey: "NSCLC",
    compoundCount: 18,
    targetClass: "Kinase",
  },
  {
    id: "TGT-004",
    name: "Cyclooxygenase-2",
    gene: "PTGS2",
    uniprotId: "P35354",
    organism: "Homo sapiens",
    diseaseArea: "Inflammation / Pain",
    diseaseKey: "Inflammation",
    compoundCount: 28,
    targetClass: "Enzyme",
  },
  {
    id: "TGT-005",
    name: "Beta-Secretase 1",
    gene: "BACE1",
    uniprotId: "P56817",
    organism: "Homo sapiens",
    diseaseArea: "Alzheimer's Disease",
    diseaseKey: "Alzheimer's",
    compoundCount: 15,
    targetClass: "Protease",
  },
  {
    id: "TGT-006",
    name: "Janus Kinase 2",
    gene: "JAK2",
    uniprotId: "O60674",
    organism: "Homo sapiens",
    diseaseArea: "Myeloproliferative Disorders",
    diseaseKey: "MPN",
    compoundCount: 22,
    targetClass: "Kinase",
  },
];

const classColors: Record<string, string> = {
  Kinase: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Enzyme: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Protease: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const extLink = "text-primary hover:underline";

export default function TargetsPage() {
  return (
    <Suspense>
      <TargetsContent />
    </Suspense>
  );
}

function TargetsContent() {
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const shown = q
    ? targets.filter((t) => t.gene.toLowerCase() === q || t.name.toLowerCase().includes(q))
    : targets;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Targets</h1>
        <p className="text-muted-foreground mt-1">
          Biological targets under investigation
        </p>
      </div>

      {q && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Filtered by &ldquo;{q.toUpperCase()}&rdquo; &mdash; {shown.length} match{shown.length === 1 ? "" : "es"}
          </span>
          <Link href="/targets" className={extLink}>
            Show all targets
          </Link>
        </div>
      )}

      {shown.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No program target matches &ldquo;{q.toUpperCase()}&rdquo;.{" "}
            <a
              href={`https://platform.opentargets.org/search?q=${encodeURIComponent(q)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={extLink}
            >
              Search Open Targets
            </a>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shown.map((target) => (
          <Card key={target.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{target.gene}</CardTitle>
                  <CardDescription className="mt-1">{target.name}</CardDescription>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    classColors[target.targetClass] ?? "bg-gray-100 text-gray-800"
                  )}
                >
                  {target.targetClass}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">UniProt</dt>
                  <dd className="font-mono">
                    <a
                      href={`https://www.uniprot.org/uniprotkb/${target.uniprotId}/entry`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={extLink}
                    >
                      {target.uniprotId}
                    </a>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Organism</dt>
                  <dd className="font-medium italic">{target.organism}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Disease Area</dt>
                  <dd className="font-medium text-right">
                    <Link
                      href={`/disease-biology/target-board?disease=${encodeURIComponent(target.diseaseKey)}`}
                      className={extLink}
                    >
                      {target.diseaseArea}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Compounds</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/compounds?target=${encodeURIComponent(target.gene)}`}
                      className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold hover:bg-primary/20"
                    >
                      {target.compoundCount}
                    </Link>
                  </dd>
                </div>
              </dl>
              <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{target.id}</span>
                <span className="flex gap-3">
                  <a
                    href={`https://platform.opentargets.org/search?q=${target.gene}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={extLink}
                  >
                    Open Targets
                  </a>
                  <a
                    href={`https://www.rcsb.org/search?request=${encodeURIComponent(
                      JSON.stringify({
                        query: {
                          type: "terminal",
                          service: "text",
                          parameters: {
                            attribute: "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
                            operator: "exact_match",
                            value: target.uniprotId,
                          },
                        },
                        return_type: "entry",
                      })
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={extLink}
                  >
                    PDB structures
                  </a>
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

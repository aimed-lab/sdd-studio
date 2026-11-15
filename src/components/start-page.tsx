import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataClassBadge } from "@/components/data-provenance";
import type { DataClass } from "@/data/page-classes";

interface Tool {
  href: string;
  title: string;
  kind: DataClass;
  description: string;
}

const tools: Tool[] = [
  {
    href: "/search",
    title: "Compound search",
    kind: "live",
    description: "Search ChEMBL by compound name, synonym or ChEMBL ID. Results come straight from ChEMBL with retrieval time.",
  },
  {
    href: "/clinical/trials",
    title: "Trial landscape",
    kind: "live",
    description: "Search registered trials on ClinicalTrials.gov by target, drug or condition, with phase and status filters.",
  },
  {
    href: "/compounds",
    title: "Reference compounds",
    kind: "curated",
    description: "Approved drugs used as reference points, with structures, properties and mechanism targets from ChEMBL.",
  },
  {
    href: "/targets?q=EGFR#egfr-resistance",
    title: "EGFR resistance mechanisms",
    kind: "curated",
    description: "Known mechanisms of acquired resistance to EGFR inhibitors, each cited to PubMed.",
  },
];

export function StartPage() {
  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Start here</h1>
        <p className="text-muted-foreground mt-1">
          These tools show live or curated, cited data. Each result shows where it came from.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{t.title}</CardTitle>
                  <DataClassBadge kind={t.kind} />
                </div>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2 text-sm text-muted-foreground">
          <p className="flex flex-wrap items-center gap-2">
            <DataClassBadge kind="demo" size="sm" />
            The Projects, Biology, Pharmacology, Clinical and Regulation sections show illustrative demo data. They show how
            the platform will work, not real results.{" "}
            <Link href="/projects" className="text-primary hover:underline">
              Open Projects
            </Link>
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <DataClassBadge kind="planned" size="sm" />
            Foundation models, add-on services and tool plugins are a catalog of planned capabilities.
          </p>
          <p>Every page in the sidebar is marked Live, Curated, Mixed, Demo or Planned.</p>
        </CardContent>
      </Card>
    </div>
  );
}

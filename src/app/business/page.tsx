"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DemoDataNotice } from "@/components/data-provenance";

interface Competitor {
  company: string;
  drug: string;
  target: string;
  indication: string;
  stage: string;
  mechanism: string;
  status: "active" | "discontinued" | "approved";
  lastUpdate: string;
}

interface Patent {
  id: string;
  title: string;
  assignee: string;
  filingDate: string;
  expiryDate: string;
  status: "active" | "pending" | "expired";
  relevantTo: string;
  claims: number;
}

interface MarketData {
  indication: string;
  marketSize: string;
  cagr: string;
  topDrug: string;
  topDrugRevenue: string;
  unmetNeed: string;
  ourProgram: string;
}

const competitors: Competitor[] = [
  { company: "Company A", drug: "Competitor asset 1", target: "BRAF V600E", indication: "Melanoma", stage: "Phase 2", mechanism: "Next-gen BRAF inhibitor", status: "active", lastUpdate: "Q? 20??" },
  { company: "Company B", drug: "Competitor asset 2", target: "BRAF/MEK", indication: "Melanoma", stage: "Phase 3", mechanism: "BRAF+MEK combo", status: "active", lastUpdate: "Q? 20??" },
  { company: "Company C", drug: "Competitor asset 3", target: "EGFR", indication: "NSCLC (brain mets)", stage: "Phase 2", mechanism: "BBB-penetrant EGFR TKI", status: "active", lastUpdate: "Q? 20??" },
  { company: "Company D", drug: "Competitor asset 4", target: "Tau", indication: "Alzheimer's", stage: "Phase 1", mechanism: "Tau aggregation inhibitor", status: "active", lastUpdate: "Q? 20??" },
  { company: "Company E", drug: "Competitor asset 5", target: "Amyloid-\u03B2", indication: "Alzheimer's", stage: "Approved", mechanism: "Anti-amyloid antibody", status: "approved", lastUpdate: "Q? 20??" },
  { company: "Company F", drug: "Competitor asset 6", target: "JAK1/2", indication: "Myelofibrosis", stage: "Approved", mechanism: "JAK1/2 inhibitor", status: "approved", lastUpdate: "Q? 20??" },
  { company: "Company G", drug: "Competitor asset 7", target: "JAK2", indication: "MPN", stage: "Phase 1", mechanism: "Selective JAK2", status: "active", lastUpdate: "Q? 20??" },
  { company: "Company H", drug: "Competitor asset 8", target: "EGFR C797S", indication: "NSCLC", stage: "Phase 1", mechanism: "4th-gen EGFR TKI", status: "discontinued", lastUpdate: "Q? 20??" },
];

const patents: Patent[] = [
  { id: "Patent 1", title: "Substituted pyrrolo[2,3-b]pyridines as BRAF inhibitors", assignee: "PharmaTech Research", filingDate: "—", expiryDate: "—", status: "active", relevantTo: "BRAF Inhibitor Program", claims: 24 },
  { id: "Patent 2", title: "7-Azaindole derivatives for kinase inhibition", assignee: "PharmaTech Research", filingDate: "—", expiryDate: "—", status: "pending", relevantTo: "BRAF Inhibitor Program", claims: 18 },
  { id: "Patent 3", title: "Novel tau phosphorylation inhibitors", assignee: "PharmaTech Research", filingDate: "—", expiryDate: "—", status: "pending", relevantTo: "Alzheimer's Tau Program", claims: 12 },
  { id: "Patent 4", title: "BRAF V600E selective inhibitor compositions", assignee: "Competitor 4", filingDate: "—", expiryDate: "—", status: "active", relevantTo: "Competitive", claims: 32 },
  { id: "Patent 5", title: "JAK2 selective inhibitors and methods", assignee: "Competitor 5", filingDate: "—", expiryDate: "—", status: "active", relevantTo: "JAK2 Inhibitor Optimization", claims: 28 },
  { id: "Patent 6", title: "EGFR T790M mutation targeting compounds", assignee: "Competitor 6", filingDate: "—", expiryDate: "—", status: "active", relevantTo: "EGFR-T790M Resistance Program", claims: 36 },
];

const marketData: MarketData[] = [
  { indication: "Metastatic Melanoma", marketSize: "—", cagr: "—", topDrug: "—", topDrugRevenue: "—", unmetNeed: "Resistance to targeted therapy", ourProgram: "BRAF Inhibitor Program" },
  { indication: "Alzheimer's Disease", marketSize: "—", cagr: "—", topDrug: "—", topDrugRevenue: "—", unmetNeed: "Disease modification in early stages", ourProgram: "Alzheimer's Tau Program" },
  { indication: "Myeloproliferative Neoplasms", marketSize: "—", cagr: "—", topDrug: "—", topDrugRevenue: "—", unmetNeed: "Disease-modifying therapy", ourProgram: "JAK2 Inhibitor Optimization" },
  { indication: "NSCLC (EGFR-mutant)", marketSize: "—", cagr: "—", topDrug: "—", topDrugRevenue: "—", unmetNeed: "Resistance to 3rd-gen TKIs", ourProgram: "EGFR-T790M Resistance Program" },
  { indication: "Rheumatoid Arthritis", marketSize: "—", cagr: "—", topDrug: "—", topDrugRevenue: "—", unmetNeed: "Oral targeted therapy", ourProgram: "\u2014" },
];

const indicationFilters = ["All", "Melanoma", "Alzheimer's", "MPN", "NSCLC"];

function statusBadge(status: "active" | "discontinued" | "approved" | "pending" | "expired") {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    discontinued: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize", styles[status])}>
      {status}
    </span>
  );
}

export default function BusinessPage() {
  const [indicationFilter, setIndicationFilter] = useState("All");

  const filteredCompetitors = competitors.filter((c) => {
    if (indicationFilter === "All") return true;
    if (indicationFilter === "NSCLC") return c.indication.includes("NSCLC");
    if (indicationFilter === "Alzheimer's") return c.indication.includes("Alzheimer");
    if (indicationFilter === "MPN") return c.indication === "MPN" || c.indication === "Myelofibrosis";
    return c.indication.includes(indicationFilter);
  });

  const ourPatents = patents.filter((p) => p.assignee === "PharmaTech Research");
  const competitivePatents = patents.filter((p) => p.assignee !== "PharmaTech Research");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business</h1>
        <p className="text-muted-foreground">
          PharmNexus &mdash; competitive intelligence, patents, and market analysis
        </p>
      </div>

      <DemoDataNotice />

      <Tabs defaultValue="competitive" className="space-y-4">
        <TabsList>
          <TabsTrigger value="competitive">Competitive Landscape</TabsTrigger>
          <TabsTrigger value="patents">Patents</TabsTrigger>
          <TabsTrigger value="market">Market Analysis</TabsTrigger>
        </TabsList>

        {/* Tab 1: Competitive Landscape */}
        <TabsContent value="competitive" className="space-y-4">
          <div className="flex gap-2">
            {indicationFilters.map((f) => (
              <button
                key={f}
                onClick={() => setIndicationFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  indicationFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Company</th>
                      <th className="px-4 py-3 text-left font-medium">Drug</th>
                      <th className="px-4 py-3 text-left font-medium">Target</th>
                      <th className="px-4 py-3 text-left font-medium">Indication</th>
                      <th className="px-4 py-3 text-left font-medium">Stage</th>
                      <th className="px-4 py-3 text-left font-medium">Mechanism</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Last Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetitors.map((c, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{c.company}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.drug}</td>
                        <td className="px-4 py-3">{c.target}</td>
                        <td className="px-4 py-3">{c.indication}</td>
                        <td className="px-4 py-3">{c.stage}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.mechanism}</td>
                        <td className="px-4 py-3">{statusBadge(c.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.lastUpdate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Patents */}
        <TabsContent value="patents" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-3">Our Patents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ourPatents.map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-mono">{p.id}</CardTitle>
                      {statusBadge(p.status)}
                    </div>
                    <CardDescription>{p.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assignee</span>
                      <span className="font-medium">{p.assignee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filed</span>
                      <span>{p.filingDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires</span>
                      <span>{p.expiryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Program</span>
                      <span>{p.relevantTo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Claims</span>
                      <span className="font-medium">{p.claims}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Competitive Patents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {competitivePatents.map((p) => (
                <Card key={p.id} className="border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-mono">{p.id}</CardTitle>
                      {statusBadge(p.status)}
                    </div>
                    <CardDescription>{p.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assignee</span>
                      <span className="font-medium">{p.assignee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Filed</span>
                      <span>{p.filingDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires</span>
                      <span>{p.expiryDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Relevant To</span>
                      <span>{p.relevantTo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Claims</span>
                      <span className="font-medium">{p.claims}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Market Analysis */}
        <TabsContent value="market" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketData.map((m) => (
              <Card key={m.indication}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.indication}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-3xl font-bold">{m.marketSize}</p>
                    <p className="text-sm text-muted-foreground">
                      Market size &middot; CAGR {m.cagr}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top Drug</span>
                      <span className="font-medium">{m.topDrug}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revenue</span>
                      <span>{m.topDrugRevenue}</span>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Unmet Need</p>
                    <p>{m.unmetNeed}</p>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Our Program</span>
                    <span className="font-medium">{m.ourProgram}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

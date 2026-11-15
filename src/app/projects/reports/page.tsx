"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DemoDataNotice } from "@/components/data-provenance";

const reports = [
  {
    id: "RPT-001",
    title: "Q? 20?? Portfolio Performance Review",
    type: "Quarterly",
    project: "All Projects",
    author: "Scientist 10",
    date: "Q? 20??",
    status: "Published",
    summary: "4 active programs reviewed: BRAF on track for candidate nomination, Alzheimer's Tau entering lead optimization, JAK2 paused pending ADMET data, EGFR program completed.",
    tags: ["Portfolio", "Performance", "Q? 20??"],
  },
  {
    id: "RPT-002",
    title: "BRAF Inhibitor Program — Lead Candidate Report",
    type: "Scientific",
    project: "BRAF Inhibitor Program",
    author: "Scientist 1",
    date: "Q? 20??",
    status: "Published",
    summary: "Illustrative summary: a lead candidate is selected and IND-enabling studies are planned for Q? 20??. No real assay values.",
    tags: ["BRAF", "Lead candidate", "Oncology"],
  },
  {
    id: "RPT-003",
    title: "Oncology Team Q? 20?? Goal Plan",
    type: "Quarterly Plan",
    project: "Oncology Team",
    author: "Scientist 1",
    date: "Q? 20??",
    status: "Draft",
    summary: "Illustrative objectives: IND pre-meeting, ADMET completion, manuscript submissions, hiring.",
    tags: ["Goals", "Q? 20??", "Oncology"],
  },
  {
    id: "RPT-004",
    title: "AI Agent Utilization & Accuracy Report — Q? 20??",
    type: "Technical",
    project: "Platform",
    author: "AI Systems",
    date: "Q? 20??",
    status: "Published",
    summary: "Illustrative report layout for agent usage and cost. No agents were run and no figures are reported.",
    tags: ["AI Agents", "Utilization", "Performance"],
  },
  {
    id: "RPT-005",
    title: "Alzheimer's Tau Program — Mid-Year Progress",
    type: "Scientific",
    project: "Alzheimer's Tau Program",
    author: "Scientist 4",
    date: "Q? 20??",
    status: "Under Review",
    summary: "Illustrative progress summary: hit-to-lead complete; lead optimization begins Q? 20??.",
    tags: ["Tau", "Neurology", "Mid-year"],
  },
  {
    id: "RPT-006",
    title: "Platform Annual Goals 20??",
    type: "Annual Plan",
    project: "All Projects",
    author: "Scientist 10",
    date: "Q? 20??",
    status: "Published",
    summary: "Illustrative annual targets: IND filings, a Phase I start, publications and platform rollout.",
    tags: ["Annual", "Strategic", "Platform"],
  },
];

const statusConfig = {
  Published:    { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  Draft:        { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "Under Review": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

const typeConfig: Record<string, string> = {
  "Quarterly":      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Quarterly Plan": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Scientific":     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Technical":      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "Annual Plan":    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

export default function ReportsPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance reviews, quarterly plans, and scientific reports</p>
        </div>
        <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
          + New Report
        </button>
      </div>

      <DemoDataNotice />

      <div className="space-y-4">
        {reports.map((r) => {
          const sc = statusConfig[r.status as keyof typeof statusConfig];
          return (
            <Card key={r.id} className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", typeConfig[r.type] ?? "bg-gray-100 text-gray-700")}>{r.type}</span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium", sc.color)}>{r.status}</span>
                    </div>
                    <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {r.project} · {r.author} · {r.date}
                    </CardDescription>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{r.id}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{r.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

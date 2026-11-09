"use client";

import { Fragment, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoDataNotice } from "@/components/data-provenance";
import { TrialLandscape } from "@/components/trial-landscape";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ExportCsvButton } from "@/components/export-csv-button";

interface Trial {
  id: string;
  title: string;
  design: string;
  arms: string;
  sampleSize: number;
  primaryEndpoint: string;
  simulatedOutcome: string;
  power: number;
  powerNote?: string;
  duration: string;
  status: "Design complete" | "In simulation" | "Design draft" | "Complete";
}

const trials: Trial[] = [
  {
    id: "BRAF-301",
    title: "Phase II BRAF Inhibitor in Melanoma",
    design: "Randomized, open-label, 2-arm",
    arms: "SDD-0012 vs Vemurafenib",
    sampleSize: 240,
    primaryEndpoint: "PFS",
    simulatedOutcome: "Median PFS 14.2 vs 9.8 months (HR 0.69)",
    power: 85,
    duration: "24 months",
    status: "Design complete",
  },
  {
    id: "TAU-201",
    title: "Phase I/II Tau Inhibitor in Early AD",
    design: "Dose-escalation + expansion",
    arms: "3 dose levels + placebo",
    sampleSize: 120,
    primaryEndpoint: "Safety + Tau PET change",
    simulatedOutcome: "22% Tau PET reduction at high dose",
    power: 72,
    duration: "18 months",
    status: "In simulation",
  },
  {
    id: "JAK-301",
    title: "Phase II Selective JAK2 in MPN",
    design: "Randomized vs Ruxolitinib",
    arms: "SDD-0127 vs Jakafi",
    sampleSize: 200,
    primaryEndpoint: "SVR35 at Week 24",
    simulatedOutcome: "SVR35 55% vs 48%",
    power: 68,
    duration: "12 months",
    status: "Design draft",
  },
  {
    id: "SYNTH-101",
    title: "Virtual Trial (DT-GPT)",
    design: "Fully synthetic",
    arms: "SDD-0012 in 10,000 digital twins",
    sampleSize: 10000,
    primaryEndpoint: "Overall survival",
    simulatedOutcome: "OS benefit 4.2 months",
    power: 99,
    powerNote: "synthetic",
    duration: "Instant",
    status: "Complete",
  },
];

const statusColors: Record<string, string> = {
  "Design complete": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  "In simulation": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  "Design draft": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Complete: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const powerColor = (value: number) => {
  if (value >= 80) return "bg-green-500";
  if (value >= 70) return "bg-yellow-500";
  return "bg-red-500";
};

function linkCompoundIds(text: string) {
  return text.split(/(SDD-\d{4})/).map((part, i) =>
    /^SDD-\d{4}$/.test(part) ? (
      <Link key={i} href="/drug" onClick={(e) => e.stopPropagation()} className="font-mono text-primary hover:underline">
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export default function TrialsPage() {
  return (
    <Suspense>
      <TrialsContent />
    </Suspense>
  );
}

function TrialsContent() {
  const initialTerm = useSearchParams().get("term") ?? "EGFR";

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trials</h1>
        <p className="text-muted-foreground mt-1">
          Registered trial landscape from ClinicalTrials.gov, plus illustrative internal trial designs
        </p>
      </div>

      <Tabs defaultValue="landscape">
        <TabsList>
          <TabsTrigger value="landscape">Trial Landscape (ClinicalTrials.gov)</TabsTrigger>
          <TabsTrigger value="internal">Illustrative internal programs (demo)</TabsTrigger>
        </TabsList>
        <TabsContent value="landscape" className="mt-4">
          <TrialLandscape initialTerm={initialTerm} />
        </TabsContent>
        <TabsContent value="internal" className="mt-4 space-y-4">
          <DemoDataNotice />
          <IllustrativePrograms />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IllustrativePrograms() {
  const [selectedTrial, setSelectedTrial] = useState<string | null>(null);

  return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-xl font-semibold">Internal trial designs</h2>
          <ExportCsvButton rows={trials} filename="illustrative-trial-designs" demo />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trials.map((trial) => (
            <Card
              key={trial.id}
              className={cn(
                "hover:shadow-md transition-shadow cursor-pointer",
                selectedTrial === trial.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedTrial(selectedTrial === trial.id ? null : trial.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">
                    <span className="font-mono text-sm text-muted-foreground mr-2">{trial.id}:</span>
                    {trial.title}
                  </CardTitle>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                      statusColors[trial.status]
                    )}
                  >
                    {trial.status}
                  </span>
                </div>
                <CardDescription className="mt-1">{trial.design}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Arms & Sample Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">Arms</span>
                    <p className="text-sm font-medium mt-0.5">{linkCompoundIds(trial.arms)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">Sample Size</span>
                    <p className="text-sm mt-0.5">
                      <span className="text-2xl font-bold">N={trial.sampleSize.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* Primary Endpoint */}
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Primary Endpoint</span>
                  <p className="text-sm font-medium mt-0.5">{trial.primaryEndpoint}</p>
                </div>

                {/* Simulated Outcome */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                  <span className="text-xs text-primary font-medium">Simulated Outcome</span>
                  <p className="text-sm font-semibold mt-0.5">{trial.simulatedOutcome}</p>
                </div>

                {/* Power & Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Power</span>
                      <span className="font-medium">
                        {trial.power}%{trial.powerNote ? ` (${trial.powerNote})` : ""}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn("h-2 rounded-full transition-all", powerColor(trial.power))}
                        style={{ width: `${trial.power}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground font-medium">Duration</span>
                    <p className="text-sm font-medium mt-0.5">{trial.duration}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
  );
}

import Link from "next/link";
import { JobList } from "@/components/jobs/job-list";

export const metadata = { title: "Compute jobs · SmartDrugDiscovery" };

/**
 * Docking and generative-design runs on SPARC Center clusters (docs/sparc-jobs-plan.md).
 * Studio holds the queue; a runner on the SPARC side claims approved jobs and pushes results back.
 */
export default function JobsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Compute jobs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Docking and generative-design runs on SPARC Center GPU clusters. Studio keeps the queue and the record of
          each run; a runner on the cluster side does the submitting. See{" "}
          <Link href="/docs/sparc-jobs" className="text-primary hover:underline">
            how compute jobs work
          </Link>
          .
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <JobList />
      </div>
    </div>
  );
}

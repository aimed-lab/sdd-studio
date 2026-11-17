import Link from "next/link";
import { JobDetail } from "@/components/jobs/job-detail";

export const metadata = { title: "Compute job · SmartDrugDiscovery" };

export default function JobPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <Link href="/jobs" className="text-xs text-muted-foreground hover:underline">
          ← Compute jobs
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <JobDetail id={params.id} />
        </div>
      </div>
    </div>
  );
}

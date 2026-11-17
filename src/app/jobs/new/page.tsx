import Link from "next/link";
import { RequestRunForm } from "@/components/jobs/request-form";

export const metadata = { title: "Request a run · SmartDrugDiscovery" };

/** The request form. Every field is validated again on the server (src/lib/jobs-api.ts). */
export default function NewJobPage({ searchParams }: { searchParams: { kind?: string } }) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Request a run</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe the run; a SPARC runner picks it up once it is approved. A request for the developer sandbox is
          completed as a labelled dry run, with no cluster time used.{" "}
          <Link href="/jobs" className="text-primary hover:underline">
            All compute jobs
          </Link>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl">
          <RequestRunForm initialKind={searchParams.kind} />
        </div>
      </div>
    </div>
  );
}

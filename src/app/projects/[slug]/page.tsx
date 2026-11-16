import "@/styles/vault.css";
import { DemoDataNotice } from "@/components/data-provenance";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { LiveProjectWorkspace, LIVE_VIEWS, type LiveView } from "@/components/projects/live-projects";
import { parseProjectView } from "@/components/projects/views";
import { DEMO_PROJECTS, demoProject } from "@/data/projects-demo";

export function generateStaticParams() {
  return DEMO_PROJECTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const p = demoProject(params.slug);
  return { title: p ? `${p.title} · Projects · SmartDrugDiscovery` : "Projects · SmartDrugDiscovery" };
}

export default function ProjectPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { view?: string; table?: string };
}) {
  const demo = demoProject(params.slug);
  if (!demo) {
    // Projects stored in Studio's database (today: the developer sandbox, test data only).
    const view = ((LIVE_VIEWS as readonly string[]).includes(searchParams.view ?? "") ? searchParams.view : "overview") as LiveView;
    const table = /^[a-z][a-z0-9_]{0,39}$/.test(searchParams.table ?? "") ? searchParams.table! : null;
    return (
      <div className="vault">
        <div className="px-4 pt-3 md:px-5">
          <DemoDataNotice />
        </div>
        <LiveProjectWorkspace slug={params.slug} view={view} table={table} />
      </div>
    );
  }
  return (
    <div className="vault">
      <div className="px-4 pt-3 md:px-5">
        <DemoDataNotice />
      </div>
      <ProjectWorkspace project={demo} view={parseProjectView(searchParams.view)} />
    </div>
  );
}

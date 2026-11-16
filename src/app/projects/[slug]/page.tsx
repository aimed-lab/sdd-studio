import { notFound } from "next/navigation";
import "@/styles/vault.css";
import { DemoDataNotice } from "@/components/data-provenance";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
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
  searchParams: { view?: string };
}) {
  const project = demoProject(params.slug);
  if (!project) notFound();
  const view = parseProjectView(searchParams.view);
  return (
    <div className="vault">
      <div className="px-4 pt-3 md:px-5">
        <DemoDataNotice />
      </div>
      <ProjectWorkspace project={project} view={view} />
    </div>
  );
}

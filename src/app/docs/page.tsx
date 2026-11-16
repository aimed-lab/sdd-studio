import Link from "next/link";
import { DocsShell } from "@/components/docs-shell";
import { DOC_PAGES, DOC_SECTIONS } from "@/data/docs";

export const metadata = { title: "Documentation · SmartDrugDiscovery" };

export default function DocsIndex() {
  return (
    <DocsShell current={null}>
      <h1 className="text-3xl font-bold">Documentation</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        How to join SDD Studio, push project iterations from a folder or an AI agent, and use the APIs. These pages are
        rendered from the <code className="rounded bg-muted px-1 text-sm">docs/</code> folder of the public repository.
      </p>
      <div className="mt-6 space-y-6">
        {DOC_SECTIONS.map((section) => (
          <section key={section}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{section}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {DOC_PAGES.filter((p) => p.section === section).map((p) => (
                <Link
                  key={p.slug}
                  href={`/docs/${p.slug}`}
                  className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="font-semibold">{p.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DocsShell>
  );
}

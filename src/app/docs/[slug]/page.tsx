import { notFound } from "next/navigation";
import "@/styles/docs.css";
import { DocsShell } from "@/components/docs-shell";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { DOC_PAGES, docPage } from "@/data/docs";
import { githubUrl, renderDoc } from "@/lib/docs-render";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const p = docPage(params.slug);
  return { title: p ? `${p.title} · Documentation · SmartDrugDiscovery` : "Documentation · SmartDrugDiscovery", description: p?.description };
}

export default function DocPageView({ params }: { params: { slug: string } }) {
  const page = docPage(params.slug);
  if (!page) notFound();
  const { html, toc } = renderDoc(page);
  return (
    <DocsShell current={page.slug} toc={toc}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{page.section}</div>
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <p className="mt-1 text-muted-foreground">{page.description}</p>
      {/* Markdown from this repository, rendered at build time. */}
      <article className="doc-prose mt-4" dangerouslySetInnerHTML={{ __html: html }} />
      <ScrollToHash />
      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Source: <a className="underline" href={githubUrl(page)} target="_blank" rel="noreferrer">{page.file}</a> on GitHub. Corrections welcome as a pull request.
      </p>
    </DocsShell>
  );
}

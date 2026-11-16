// Server only: reads files from the repository at build time.
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { Marked } from "marked";
import { DOC_PAGES, GITHUB_BLOB, type DocPage } from "@/data/docs";

export interface RenderedDoc {
  html: string;
  toc: { id: string; text: string }[];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const slugify = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);

/** Turns a link written for GitHub into one that works inside Studio. */
function rewriteHref(href: string, page: DocPage): { href: string; external: boolean } {
  if (/^(https?:|mailto:)/i.test(href)) return { href, external: /^https?:/i.test(href) && !href.startsWith("https://studio.smartdrugdiscovery.org") };
  if (href.startsWith("#") || href.startsWith("/")) return { href, external: false };
  const [path, anchor] = href.split("#");
  const target = posix.normalize(posix.join(posix.dirname(page.file), path));
  const doc = DOC_PAGES.find((d) => d.file === target);
  if (doc) return { href: `/docs/${doc.slug}${anchor ? `#${anchor}` : ""}`, external: false };
  return { href: `${GITHUB_BLOB}${target}${anchor ? `#${anchor}` : ""}`, external: true };
}

function source(page: DocPage): string {
  let text = readFileSync(join(process.cwd(), page.file), "utf8");
  text = text.replace(/^---\n[\s\S]*?\n---\n/, ""); // skill front matter
  if (page.from) {
    const i = text.indexOf(page.from);
    if (i >= 0) text = text.slice(i);
  }
  if (page.until) {
    const j = text.indexOf(page.until);
    if (j >= 0) text = text.slice(0, j);
  }
  return text;
}

/** Renders one documentation page. Runs at build time; the markdown comes from this repository. */
export function renderDoc(page: DocPage): RenderedDoc {
  const toc: RenderedDoc["toc"] = [];
  const used = new Set<string>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading(text: string, level: number) {
        let id = slugify(text) || "section";
        while (used.has(id)) id += "-";
        used.add(id);
        if (level === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
        // The page title comes from the registry, so the file's own H1 is dropped.
        if (level === 1) return "";
        return `<h${level} id="${id}"><a class="doc-anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${level}>\n`;
      },
      link(href: string, title: string | null | undefined, text: string) {
        const { href: to, external } = rewriteHref(href, page);
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        const ext = external ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${escapeHtml(to)}"${t}${ext}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(source(page)) as string;
  return { html, toc };
}

/** The markdown file on GitHub, for "Edit this page". */
export const githubUrl = (page: DocPage) => `${GITHUB_BLOB}${page.file}`;

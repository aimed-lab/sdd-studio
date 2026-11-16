import Link from "next/link";
import { BookOpen } from "lucide-react";
import { DOC_PAGES, DOC_SECTIONS } from "@/data/docs";
import { cn } from "@/lib/utils";

/** Layout for /docs: section list on the left, page in the middle, contents on the right. */
export function DocsShell({
  current,
  toc,
  children,
}: {
  current: string | null;
  toc?: { id: string; text: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-8">
      <nav aria-label="Documentation" className="shrink-0 md:w-56">
        <Link href="/docs" className={cn("mb-3 flex items-center gap-2 font-semibold", current === null && "text-primary")}>
          <BookOpen className="h-4 w-4" /> Documentation
        </Link>
        <div className="flex gap-4 overflow-x-auto md:block md:space-y-4">
          {DOC_SECTIONS.map((section) => (
            <div key={section} className="shrink-0">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section}</div>
              <ul className="space-y-0.5">
                {DOC_PAGES.filter((p) => p.section === section).map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/docs/${p.slug}`}
                      aria-current={current === p.slug ? "page" : undefined}
                      className={cn(
                        "block whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors",
                        current === p.slug ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>

      {toc && toc.length > 1 && (
        <aside aria-label="On this page" className="hidden w-52 shrink-0 xl:block">
          <div className="sticky top-6">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</div>
            <ul className="space-y-1 text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="text-muted-foreground hover:text-foreground">{t.text}</a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}

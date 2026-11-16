"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageClassStrip } from "@/components/data-provenance";
import { PUBLIC_DOCS, PUBLIC_ROUTES } from "@/data/public-routes";
import { PublicModeProvider } from "@/lib/public-mode";
import { cn } from "@/lib/utils";

/** Read-only shell for anonymous visitors: live and curated tools only, no demo navigation, no assistant. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Anonymous visitors see only the live or curated part of each page, so the page class is that part's.
  const route = PUBLIC_ROUTES.find((r) => r.href === pathname);
  return (
    <PublicModeProvider value={true}>
      <div className="flex min-h-screen flex-col">
        <header className="border-b bg-card">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-8">
            <Link href="/search" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                SD
              </span>
              <span className="font-bold">SmartDrugDiscovery</span>
            </Link>
            <nav aria-label="Public tools" className="flex flex-wrap gap-1">
              {PUBLIC_ROUTES.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  title={r.description}
                  aria-current={pathname === r.href ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    pathname === r.href
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {r.label}
                </Link>
              ))}
            </nav>
            <Link
              href={PUBLIC_DOCS.href}
              aria-current={pathname.startsWith(PUBLIC_DOCS.href) ? "page" : undefined}
              className={cn(
                "ml-auto rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname.startsWith(PUBLIC_DOCS.href)
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {PUBLIC_DOCS.label}
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
          <p className="border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground md:px-8">
            Public read-only view: live data from ChEMBL, ClinicalTrials.gov and Open Targets, and a PubMed-cited curated set. Every
            result shows its source and retrieval time. Members can sign in for the full workspace.
          </p>
        </header>
        <main className="flex-1">
          <PageClassStrip pageClass={route ? { kind: route.kind } : undefined} />
          {children}
        </main>
      </div>
    </PublicModeProvider>
  );
}

/** Shown above the sign-in form so visitors can reach the public tools without an account. */
export function PublicToolsBanner() {
  return (
    <div className="border-b bg-card px-4 py-3 text-sm">
      <span className="text-muted-foreground">Browse live data without signing in: </span>
      {PUBLIC_ROUTES.map((r, i) => (
        <span key={r.href}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <Link href={r.href} className="font-medium text-primary hover:underline">
            {r.label}
          </Link>
        </span>
      ))}
      <span className="text-muted-foreground"> · </span>
      <Link href={PUBLIC_DOCS.href} className="font-medium text-primary hover:underline">
        How to join and use Studio
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { glossary, type GlossaryKey } from "@/data/glossary";

/** A term with a definition popover that opens on hover, keyboard focus or tap, and links to its source. */
export function GlossaryTerm({ k, children, iconOnly = false }: { k: GlossaryKey; children?: React.ReactNode; iconOnly?: boolean }) {
  const entry = glossary[k];
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center gap-1" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {!iconOnly && (children ?? entry.term)}
      <button
        type="button"
        aria-label={`What is ${entry.term}?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold normal-case leading-none text-muted-foreground hover:text-foreground"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border bg-popover p-3 text-left text-xs font-normal normal-case tracking-normal text-popover-foreground shadow-md"
        >
          <span className="block">{entry.definition}</span>
          <a
            href={entry.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-primary underline"
          >
            Source: {entry.source.label}
          </a>
        </span>
      )}
    </span>
  );
}

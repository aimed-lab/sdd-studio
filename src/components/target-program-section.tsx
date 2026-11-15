"use client";

import Link from "next/link";
import { DataClassBadge, DEMO_DATA_LABEL } from "@/components/data-provenance";
import type { RegistryTarget } from "@/data/registry/targets";
import { usePublicMode } from "@/lib/public-mode";

/** Demo program fields for a registry target. Members only; never shown in the public view. */
export function TargetProgramSection({ target }: { target: RegistryTarget }) {
  const isPublic = usePublicMode();
  if (isPublic) return null;
  const board = target.boardId.value;
  return (
    <section aria-labelledby="program-heading" className="rounded-lg border border-amber-300 p-4 dark:border-amber-800">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="program-heading" className="text-base font-semibold">
          Program (internal)
        </h2>
        <DataClassBadge kind="demo" size="sm" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">These fields are {DEMO_DATA_LABEL}. Do not cite them.</p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Program disease area</dt>
          <dd>
            <Link
              href={`/disease-biology/target-board?disease=${encodeURIComponent(target.programDiseaseKey.value)}`}
              className="text-primary hover:underline"
            >
              {target.programDiseaseArea.value}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target board row</dt>
          <dd>{board ?? <span className="text-muted-foreground">not on the board</span>}</dd>
        </div>
      </dl>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export function MoleculeViewer({
  smiles,
  width = 160,
  height = 110,
}: {
  smiles: string;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    import("smiles-drawer")
      .then((mod) => {
        const svg = svgRef.current;
        if (cancelled || !svg) return;
        const SmilesDrawer = mod.default ?? mod;
        const drawer = new SmilesDrawer.SvgDrawer({ width, height });
        SmilesDrawer.parse(
          smiles,
          (tree: unknown) => {
            if (cancelled) return;
            svg.replaceChildren();
            drawer.draw(tree, svg, "light");
          },
          () => !cancelled && setFailed(true)
        );
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [smiles, width, height]);

  if (failed) {
    return <span className="text-xs text-muted-foreground">Structure unavailable</span>;
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`2D structure: ${smiles}`}
      className="rounded bg-white"
    />
  );
}

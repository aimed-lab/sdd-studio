"use client";

import { useEffect, useRef, useState } from "react";

export function MoleculeViewer({
  smiles,
  name,
  width = 160,
  height = 110,
  actions = false,
}: {
  smiles: string;
  name?: string;
  width?: number;
  height?: number;
  actions?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copySmiles = async () => {
    try {
      await navigator.clipboard.writeText(smiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the SMILES:", smiles);
    }
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(name ?? "structure").replace(/[^A-Za-z0-9_-]+/g, "_")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const drawing = (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={name ? `2D structure of ${name}` : "2D chemical structure"}
      className="rounded bg-white"
    />
  );

  if (!actions) return drawing;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      {drawing}
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={copySmiles} className="text-primary hover:underline">
          {copied ? "Copied" : "Copy SMILES"}
        </button>
        <button type="button" onClick={downloadSvg} className="text-primary hover:underline">
          SVG
        </button>
      </div>
    </div>
  );
}

/**
 * Loads the RDKit MinimalLib WebAssembly build in the browser, once per page.
 *
 * One loader for the whole app on purpose. The build publishes itself as the
 * global `window.initRDKitModule`, so two loaders would fight over it: whichever
 * script landed first would be paired with the other one's locateFile, mixing
 * one version's JavaScript glue with another version's .wasm.
 *
 * The files are served from /rdkit/, copied out of the pinned @rdkit/rdkit
 * package at build time by scripts/copy-rdkit-assets.mjs, so the version is the
 * one in package.json and no third-party CDN is involved at runtime.
 */
import type { MainModule } from "@rdkit/rdkit";

const SCRIPT_URL = "/rdkit/RDKit_minimal.js";
const WASM_URL = "/rdkit/RDKit_minimal.wasm";

declare global {
  interface Window {
    initRDKitModule?: (options?: { locateFile?: () => string }) => Promise<MainModule>;
  }
}

let modulePromise: Promise<MainModule> | null = null;

export function loadRDKit(): Promise<MainModule> {
  if (modulePromise) return modulePromise;
  modulePromise = new Promise<MainModule>((resolve, reject) => {
    const start = () => {
      const init = window.initRDKitModule;
      if (!init) {
        reject(new Error("RDKit loaded but initRDKitModule was not defined."));
        return;
      }
      init({ locateFile: () => WASM_URL }).then(resolve, (err: unknown) =>
        reject(err instanceof Error ? err : new Error("RDKit could not start."))
      );
    };

    if (window.initRDKitModule) {
      start();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", start, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load RDKit.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", start, { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load RDKit.")), { once: true });
    document.head.appendChild(script);
  });
  // A failed load must not be cached, so the next attempt can retry.
  modulePromise.catch(() => {
    modulePromise = null;
  });
  return modulePromise;
}

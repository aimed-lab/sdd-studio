/** Flattens screening results for CSV export. */
import type { ScreenedRow } from "@/lib/admet/screen";

const round = (n: number | undefined, places: number) =>
  n === undefined || Number.isNaN(n) ? "" : String(Math.round(n * 10 ** places) / 10 ** places);

export interface AdmetExportRow {
  input_line: number;
  name: string;
  input_smiles: string;
  canonical_smiles: string;
  mw: string;
  exact_mw: string;
  clogp: string;
  hbd_lipinski: string;
  hba_lipinski: string;
  hbd_rdkit: string;
  hba_rdkit: string;
  rotatable_bonds: string;
  tpsa: string;
  heavy_atoms: string;
  aromatic_rings: string;
  fraction_csp3: string;
  lipinski_violations: string;
  lipinski_detail: string;
  veber_violations: string;
  veber_detail: string;
  pains_alert_count: string;
  pains_alerts: string;
  brenk_alert_count: string;
  brenk_alerts: string;
  error: string;
}

export const EXPORT_COLUMNS: (keyof AdmetExportRow)[] = [
  "input_line",
  "name",
  "input_smiles",
  "canonical_smiles",
  "mw",
  "exact_mw",
  "clogp",
  "hbd_lipinski",
  "hba_lipinski",
  "hbd_rdkit",
  "hba_rdkit",
  "rotatable_bonds",
  "tpsa",
  "heavy_atoms",
  "aromatic_rings",
  "fraction_csp3",
  "lipinski_violations",
  "lipinski_detail",
  "veber_violations",
  "veber_detail",
  "pains_alert_count",
  "pains_alerts",
  "brenk_alert_count",
  "brenk_alerts",
  "error",
];

export function toExportRows(rows: ScreenedRow[]): AdmetExportRow[] {
  return rows.map((r) => {
    const d = r.descriptors;
    return {
      input_line: r.line,
      name: r.name,
      input_smiles: r.smiles,
      canonical_smiles: r.canonicalSmiles ?? "",
      mw: round(d?.mw, 3),
      exact_mw: round(d?.exactMw, 5),
      clogp: round(d?.clogp, 3),
      hbd_lipinski: round(d?.hbdLipinski, 0),
      hba_lipinski: round(d?.hbaLipinski, 0),
      hbd_rdkit: round(d?.hbd, 0),
      hba_rdkit: round(d?.hba, 0),
      rotatable_bonds: round(d?.rotatableBonds, 0),
      tpsa: round(d?.tpsa, 2),
      heavy_atoms: round(d?.heavyAtoms, 0),
      aromatic_rings: round(d?.aromaticRings, 0),
      fraction_csp3: round(d?.fractionCsp3, 4),
      lipinski_violations: r.lipinski ? String(r.lipinski.violations.length) : "",
      lipinski_detail: r.lipinski?.violations.map((v) => v.text).join("; ") ?? "",
      veber_violations: r.veber ? String(r.veber.violations.length) : "",
      veber_detail: r.veber?.violations.map((v) => v.text).join("; ") ?? "",
      pains_alert_count: r.alerts ? String(r.alerts.PAINS.length) : "",
      pains_alerts: r.alerts?.PAINS.join("; ") ?? "",
      brenk_alert_count: r.alerts ? String(r.alerts.Brenk.length) : "",
      brenk_alerts: r.alerts?.Brenk.join("; ") ?? "",
      error: r.error ?? "",
    };
  });
}

/**
 * Describes how the exported numbers were produced, written into the CSV.
 *
 * The shared export button repeats this on every row, so it stays short; the
 * full citations with DOIs are on /services/admet.
 */
export const exportSourceNote = (rdkitVersion: string) =>
  `Computed descriptors (not measurements), RDKit ${rdkitVersion} in-browser; rules Lipinski 2001, Veber 2002; alerts PAINS Baell 2010, Brenk 2008; see /services/admet`;

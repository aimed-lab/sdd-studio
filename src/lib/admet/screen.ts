/**
 * Descriptor and rule screening for /services/admet, run entirely in the
 * browser by the RDKit MinimalLib WebAssembly build.
 *
 * Structures never leave the page: there is no upload and no server compute.
 * Everything here is a descriptor RDKit computes from the structure, or a
 * threshold/substructure check against a published filter set. No experimental
 * property is involved and no statistical model is fitted or consulted.
 */
import type { MainModule, Mol } from "@rdkit/rdkit";
import { loadRDKit } from "@/lib/rdkit";
import { type Descriptors, type RuleResult, lipinski, veber } from "@/lib/admet/rules";

const ALERTS_URL = "/admet/structural-alerts.json";

export type AlertSet = "PAINS" | "Brenk";

export interface AlertPattern {
  name: string;
  smarts: string;
  set: AlertSet;
  subset: string;
  /**
   * Whether the pattern spells hydrogens out as [#1] and so has to be matched
   * against a molecule with explicit hydrogens. See the note in
   * scripts/gen-structural-alerts.mjs.
   */
  explicitH: boolean;
}

export interface AlertCatalog {
  provenance: {
    patternsFrom: string;
    patternsUrl: string;
    license: string;
    sets: Record<string, { label: string; citation: string; doi: string; pmid: string }>;
    counts: Record<string, number>;
  };
  alerts: AlertPattern[];
}

export interface ScreenedRow {
  /** Position in the input, 1-based, so a row can be traced back to its line. */
  line: number;
  name: string;
  smiles: string;
  canonicalSmiles?: string;
  descriptors?: Descriptors;
  lipinski?: RuleResult;
  veber?: RuleResult;
  alerts?: { PAINS: string[]; Brenk: string[] };
  /** Set when the structure could not be read; the other fields stay empty. */
  error?: string;
}

export interface MoleculeInput {
  line: number;
  name: string;
  smiles: string;
}

async function loadCatalog(): Promise<AlertCatalog> {
  const res = await fetch(ALERTS_URL);
  if (!res.ok) throw new Error(`Could not load the alert patterns (HTTP ${res.status}).`);
  const data = (await res.json()) as AlertCatalog;
  if (!Array.isArray(data.alerts) || data.alerts.length === 0 || !data.provenance) {
    throw new Error("The alert pattern file is not in the expected shape.");
  }
  return data;
}

interface CompiledPattern {
  name: string;
  set: AlertSet;
  explicitH: boolean;
  query: Mol;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/**
 * Holds the loaded RDKit module and the compiled substructure queries, so the
 * 585 patterns are parsed once rather than per molecule.
 */
export class Screener {
  private constructor(
    private readonly rdkit: MainModule,
    private readonly patterns: CompiledPattern[],
    readonly catalog: AlertCatalog,
    /** Patterns in the file that RDKit could not compile; expected to be empty. */
    readonly unusablePatterns: string[],
    readonly rdkitVersion: string
  ) {}

  static async create(): Promise<Screener> {
    const [rdkit, catalog] = await Promise.all([loadRDKit(), loadCatalog()]);
    const patterns: CompiledPattern[] = [];
    const unusable: string[] = [];
    for (const a of catalog.alerts) {
      const query = rdkit.get_qmol(a.smarts);
      if (!query || !query.is_valid()) {
        unusable.push(a.name);
        query?.delete();
        continue;
      }
      patterns.push({ name: a.name, set: a.set, explicitH: a.explicitH, query });
    }
    return new Screener(rdkit, patterns, catalog, unusable, rdkit.version());
  }

  get patternCount() {
    return this.patterns.length;
  }

  /** Computes descriptors, rule checks and alert matches for one structure. */
  screen(input: MoleculeInput): ScreenedRow {
    const base: ScreenedRow = { line: input.line, name: input.name, smiles: input.smiles };
    let mol: Mol | null = null;
    let molWithHs: Mol | null = null;
    try {
      mol = this.rdkit.get_mol(input.smiles);
      if (!mol || !mol.is_valid()) {
        return { ...base, error: "Not a valid SMILES string" };
      }

      const raw = JSON.parse(mol.get_descriptors()) as Record<string, unknown>;
      const descriptors: Descriptors = {
        mw: num(raw.amw),
        exactMw: num(raw.exactmw),
        clogp: num(raw.CrippenClogP),
        hbdLipinski: num(raw.lipinskiHBD),
        hbaLipinski: num(raw.lipinskiHBA),
        hbd: num(raw.NumHBD),
        hba: num(raw.NumHBA),
        rotatableBonds: num(raw.NumRotatableBonds),
        tpsa: num(raw.tpsa),
        heavyAtoms: num(raw.NumHeavyAtoms),
        aromaticRings: num(raw.NumAromaticRings),
        fractionCsp3: num(raw.FractionCSP3),
      };
      if (Number.isNaN(descriptors.mw) || Number.isNaN(descriptors.clogp)) {
        return { ...base, error: "RDKit could not compute descriptors for this structure" };
      }

      // Patterns written with explicit hydrogens need them present on the
      // molecule; the rest must see the implicit-hydrogen form, because adding
      // hydrogens changes each heavy atom's explicit degree.
      molWithHs = mol.copy();
      if (molWithHs) molWithHs.add_hs_in_place();

      const alerts = { PAINS: [] as string[], Brenk: [] as string[] };
      for (const p of this.patterns) {
        const target = p.explicitH ? molWithHs : mol;
        if (!target) continue;
        const match = target.get_substruct_match(p.query);
        if (match && match !== "{}" && match !== "") alerts[p.set].push(p.name);
      }
      alerts.PAINS.sort();
      alerts.Brenk.sort();

      return {
        ...base,
        canonicalSmiles: mol.get_smiles(),
        descriptors,
        lipinski: lipinski(descriptors),
        veber: veber(descriptors),
        alerts,
      };
    } catch {
      return { ...base, error: "This structure could not be processed" };
    } finally {
      mol?.delete();
      molWithHs?.delete();
    }
  }

  /** Frees the compiled queries held in WebAssembly memory. */
  dispose() {
    for (const p of this.patterns) p.query.delete();
    this.patterns.length = 0;
  }
}

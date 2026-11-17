/**
 * Property rules applied by the Local ADMET Screener (/services/admet).
 *
 * Each rule is a published rule of thumb with its source. The screener reports
 * which thresholds a structure crosses; it does not score or rank molecules,
 * and it does not estimate any experimental property.
 */

export interface RuleSource {
  /** Short form shown next to the rule. */
  label: string;
  citation: string;
  doi: string;
  pmid: string;
  url: string;
}

export const SOURCES = {
  lipinski: {
    label: "Lipinski et al. 2001",
    citation:
      "Lipinski CA, Lombardo F, Dominy BW, Feeney PJ. Experimental and computational approaches to estimate solubility and permeability in drug discovery and development settings. Adv Drug Deliv Rev. 2001;46(1-3):3-26.",
    doi: "10.1016/S0169-409X(00)00129-0",
    pmid: "11259830",
    url: "https://pubmed.ncbi.nlm.nih.gov/11259830/",
  },
  veber: {
    label: "Veber et al. 2002",
    citation:
      "Veber DF, Johnson SR, Cheng HY, Smith BR, Ward KW, Kopple KD. Molecular properties that influence the oral bioavailability of drug candidates. J Med Chem. 2002;45(12):2615-23.",
    doi: "10.1021/jm020017n",
    pmid: "12036371",
    url: "https://pubmed.ncbi.nlm.nih.gov/12036371/",
  },
  pains: {
    label: "Baell & Holloway 2010",
    citation:
      "Baell JB, Holloway GA. New substructure filters for removal of pan assay interference compounds (PAINS) from screening libraries and for their exclusion in bioassays. J Med Chem. 2010;53(7):2719-40.",
    doi: "10.1021/jm901137j",
    pmid: "20131845",
    url: "https://pubmed.ncbi.nlm.nih.gov/20131845/",
  },
  brenk: {
    label: "Brenk et al. 2008",
    citation:
      "Brenk R, Schipani A, James D, Krasowski A, Gilbert IH, Frearson J, Wyatt PG. Lessons learnt from assembling screening libraries for drug discovery for neglected diseases. ChemMedChem. 2008;3(3):435-44.",
    doi: "10.1002/cmdc.200700139",
    pmid: "18064617",
    url: "https://pubmed.ncbi.nlm.nih.gov/18064617/",
  },
} satisfies Record<string, RuleSource>;

export type SourceKey = keyof typeof SOURCES;

/** Descriptors RDKit computes for one structure, as the screener uses them. */
export interface Descriptors {
  /** Average molecular weight (RDKit `amw`), in g/mol. */
  mw: number;
  /** Monoisotopic mass (RDKit `exactmw`), in g/mol. */
  exactMw: number;
  /** Crippen cLogP (RDKit `CrippenClogP`). */
  clogp: number;
  /** Hydrogen-bond donors, Lipinski's count: OH and NH hydrogens. */
  hbdLipinski: number;
  /** Hydrogen-bond acceptors, Lipinski's count: all N and O atoms. */
  hbaLipinski: number;
  /** Donors by RDKit's refined definition. */
  hbd: number;
  /** Acceptors by RDKit's refined definition. */
  hba: number;
  rotatableBonds: number;
  /** Topological polar surface area, in A^2. */
  tpsa: number;
  heavyAtoms: number;
  aromaticRings: number;
  fractionCsp3: number;
}

export interface RuleViolation {
  /** e.g. "MW 612.7 > 500" */
  text: string;
  property: string;
}

export interface RuleResult {
  pass: boolean;
  violations: RuleViolation[];
}

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * Lipinski's "rule of 5": poor absorption or permeation is more likely above
 * MW 500, cLogP 5, 5 H-bond donors or 10 H-bond acceptors (Lipinski 2001).
 *
 * Donors and acceptors use Lipinski's own counts (OH/NH hydrogens, and N+O
 * atoms), not RDKit's refined definitions, so the thresholds mean what the
 * paper meant by them. The screener reports each threshold crossed and makes no
 * claim about how many crossings matter.
 */
export function lipinski(d: Descriptors): RuleResult {
  const violations: RuleViolation[] = [];
  if (d.mw > 500) violations.push({ property: "MW", text: `MW ${round(d.mw, 1)} > 500` });
  if (d.clogp > 5) violations.push({ property: "cLogP", text: `cLogP ${round(d.clogp, 2)} > 5` });
  if (d.hbdLipinski > 5) violations.push({ property: "HBD", text: `HBD ${d.hbdLipinski} > 5` });
  if (d.hbaLipinski > 10) violations.push({ property: "HBA", text: `HBA ${d.hbaLipinski} > 10` });
  return { pass: violations.length === 0, violations };
}

/**
 * Veber's oral-bioavailability criteria: 10 or fewer rotatable bonds and TPSA
 * of 140 A^2 or less (Veber 2002). The paper gives a hydrogen-bond count of 12
 * or fewer as an alternative to the TPSA cut-off; this reports the TPSA form and
 * shows the H-bond total alongside it.
 */
export function veber(d: Descriptors): RuleResult {
  const violations: RuleViolation[] = [];
  if (d.rotatableBonds > 10)
    violations.push({ property: "Rotatable bonds", text: `${d.rotatableBonds} rotatable bonds > 10` });
  if (d.tpsa > 140) violations.push({ property: "TPSA", text: `TPSA ${round(d.tpsa, 1)} > 140` });
  return { pass: violations.length === 0, violations };
}

/** Veber's alternative criterion: donors + acceptors, by Lipinski's counts. */
export const hBondTotal = (d: Descriptors) => d.hbdLipinski + d.hbaLipinski;

export interface RuleDoc {
  id: "lipinski" | "veber" | "pains" | "brenk";
  title: string;
  thresholds: string;
  what: string;
  source: SourceKey;
}

/** Plain-language description of every rule the screener applies. */
export const RULE_DOCS: RuleDoc[] = [
  {
    id: "lipinski",
    title: "Lipinski rule of 5",
    thresholds: "MW ≤ 500 · cLogP ≤ 5 · HBD ≤ 5 · HBA ≤ 10",
    what:
      "A rule of thumb for oral absorption: the paper reports that poor absorption or permeation is more likely once a compound passes any of these four limits. Donors are OH and NH hydrogens; acceptors are all nitrogen and oxygen atoms. It describes a tendency across many compounds, not a verdict on one.",
    source: "lipinski",
  },
  {
    id: "veber",
    title: "Veber criteria",
    thresholds: "Rotatable bonds ≤ 10 · TPSA ≤ 140 Å²",
    what:
      "From oral bioavailability measured in rats for over 1,100 compounds: those with 10 or fewer rotatable bonds and a polar surface area of 140 Å² or less (or 12 or fewer donors plus acceptors) had a high probability of good oral bioavailability. The paper also found that the molecular-weight cut-off of 500 did not by itself separate poorly available compounds in that data set.",
    source: "veber",
  },
  {
    id: "pains",
    title: "PAINS substructure filters",
    thresholds: "480 substructure patterns",
    what:
      "Pan-assay interference compounds: substructures that turned up repeatedly as hits across many unrelated screens. A match is a flag for closer scrutiny of a screening hit, not evidence that a compound is inactive or unusable.",
    source: "pains",
  },
  {
    id: "brenk",
    title: "Brenk unwanted functionality",
    thresholds: "105 substructure patterns",
    what:
      "Substructures excluded when assembling screening libraries for neglected-disease projects, on grounds of likely toxicity, reactivity or unfavourable pharmacokinetics. Common groups such as esters and catechols appear in approved drugs, so a match is context for a chemist, not a rejection.",
    source: "brenk",
  },
];

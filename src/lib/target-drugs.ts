// Approved drugs whose ChEMBL mechanism of action targets a gene (#57 option c: drug-aware trial search).
// The list is derived from ChEMBL at request time and cached for 24 h; there is no hand-maintained drug list.

import { type DataRelease, type Provenance, chemblRelease, fetchUpstream } from "@/lib/upstream";
import { notPrimaryFor } from "@/data/curated/not-primary-target";

const CHEMBL_API = "https://www.ebi.ac.uk/chembl/api/data";
const SOURCE = { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/" };
const DAY = 24 * 60 * 60;
const TIMEOUT_MS = 5000;

/** At most this many drug names are ORed into a trial query. */
export const MAX_TARGET_DRUGS = 10;
const MAX_TARGETS = 3;
const MAX_PARENTS = 100;
// Names go into a ClinicalTrials.gov query, so only plain names are used.
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]{1,40}$/;
// ChEMBL sometimes names the parent by its solvate form (e.g. "DACOMITINIB ANHYDROUS").
const SOLVATE_SUFFIX = /\s+(ANHYDROUS|MONOHYDRATE|DIHYDRATE|HYDRATE)$/i;

export interface TargetDrug {
  name: string;
  chemblId: string;
  firstApproval: number | null;
  moleculeType: string | null;
}

export interface TargetDrugs {
  symbol: string;
  targets: { chemblId: string; name: string }[];
  drugs: TargetDrug[];
  /** Approved drugs found but left out by the MAX_TARGET_DRUGS cap. */
  omitted: string[];
  /** Approved drugs left out because their FDA label indication is defined by another gene (curated, cited). */
  excluded: { name: string; chemblId: string; primaryTarget: string; reason: string; sourceUrl: string }[];
  selection: string;
  source: Provenance & { release?: DataRelease };
}

interface TargetResponse { targets?: { target_chembl_id?: string; pref_name?: string }[] }
interface MechanismResponse {
  mechanisms?: { molecule_chembl_id?: string; parent_molecule_chembl_id?: string; max_phase?: number | string | null }[];
}
interface MoleculeResponse {
  molecules?: {
    molecule_chembl_id?: string;
    pref_name?: string | null;
    max_phase?: number | string | null;
    first_approval?: number | null;
    molecule_type?: string | null;
  }[];
}

const cache = new Map<string, { at: number; value: TargetDrugs }>();

const isApproved = (phase: number | string | null | undefined) => Number(phase) === 4;

/**
 * Looks up a gene symbol in ChEMBL (human single-protein targets), collects mechanism-of-action
 * records with max_phase 4, and returns the parent molecules' preferred names. Ordered by first
 * approval year (newest first, so current standard-of-care drugs are kept; unknown years last), capped at
 * MAX_TARGET_DRUGS. Drugs on the curated not-primary-target list for this gene are moved to `excluded`.
 * Throws UpstreamError when ChEMBL cannot be reached; callers fall back to the default search.
 */
export async function approvedDrugsForTarget(symbol: string): Promise<TargetDrugs> {
  const key = symbol.toUpperCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY * 1000) return hit.value;

  const targetParams = new URLSearchParams({
    target_components__target_component_synonyms__component_synonym__iexact: key,
    organism: "Homo sapiens",
    target_type: "SINGLE PROTEIN",
    only: "target_chembl_id,pref_name",
    limit: String(MAX_TARGETS),
  });
  const { data: t } = await fetchUpstream<TargetResponse>(SOURCE, `${CHEMBL_API}/target.json?${targetParams}`, {
    ttlSeconds: DAY,
    timeoutMs: TIMEOUT_MS,
  });
  const targets = (t.targets ?? [])
    .filter((x) => x.target_chembl_id && /^CHEMBL\d+$/.test(x.target_chembl_id))
    .map((x) => ({ chemblId: x.target_chembl_id as string, name: x.pref_name ?? "" }));

  let drugs: TargetDrug[] = [];
  const excluded: TargetDrugs["excluded"] = [];
  let source: TargetDrugs["source"] | null = null;
  if (targets.length) {
    const mechParams = new URLSearchParams({
      target_chembl_id__in: targets.map((x) => x.chemblId).join(","),
      only: "molecule_chembl_id,parent_molecule_chembl_id,max_phase",
      limit: "1000",
    });
    const mech = await fetchUpstream<MechanismResponse>(SOURCE, `${CHEMBL_API}/mechanism.json?${mechParams}`, {
      ttlSeconds: DAY,
      timeoutMs: TIMEOUT_MS,
    });
    source = mech.provenance;
    const parents = Array.from(
      new Set(
        (mech.data.mechanisms ?? [])
          .filter((m) => isApproved(m.max_phase))
          .map((m) => m.parent_molecule_chembl_id || m.molecule_chembl_id)
          .filter((id): id is string => !!id && /^CHEMBL\d+$/.test(id))
      )
    ).slice(0, MAX_PARENTS);

    if (parents.length) {
      const molParams = new URLSearchParams({
        molecule_chembl_id__in: parents.join(","),
        only: "molecule_chembl_id,pref_name,max_phase,first_approval,molecule_type",
        limit: String(MAX_PARENTS),
      });
      const { data: m } = await fetchUpstream<MoleculeResponse>(SOURCE, `${CHEMBL_API}/molecule.json?${molParams}`, {
        ttlSeconds: DAY,
        timeoutMs: TIMEOUT_MS,
      });
      const seen = new Set<string>();
      drugs = (m.molecules ?? [])
        .filter((x) => isApproved(x.max_phase) && x.pref_name && x.molecule_chembl_id)
        .map((x) => ({
          name: (x.pref_name as string).replace(SOLVATE_SUFFIX, "").trim().toLowerCase(),
          chemblId: x.molecule_chembl_id as string,
          firstApproval: x.first_approval ?? null,
          moleculeType: x.molecule_type ?? null,
        }))
        .filter((x) => SAFE_NAME.test(x.name) && !seen.has(x.name) && seen.add(x.name))
        .sort((a, b) => (b.firstApproval ?? -1) - (a.firstApproval ?? -1) || a.name.localeCompare(b.name));
      const notPrimary = new Map(notPrimaryFor(key).map((x) => [x.drugChemblId, x]));
      drugs = drugs.filter((d) => {
        const hit = notPrimary.get(d.chemblId);
        if (hit) excluded.push({ name: d.name, chemblId: d.chemblId, primaryTarget: hit.primaryTarget, reason: hit.reason, sourceUrl: hit.sourceUrl });
        return !hit;
      });
    }
  }

  const release = await chemblRelease();
  const value: TargetDrugs = {
    symbol: key,
    targets,
    drugs: drugs.slice(0, MAX_TARGET_DRUGS),
    omitted: drugs.slice(MAX_TARGET_DRUGS).map((d) => d.name),
    excluded,
    selection:
      `ChEMBL mechanism-of-action records for human single-protein target(s) named ${key}, max_phase 4 (approved), ` +
      `parent molecules, ordered by first approval year (newest first), at most ${MAX_TARGET_DRUGS}. ` +
      `Drugs whose FDA label indication is defined by another gene are left out (curated list).`,
    source: source
      ? { ...source, ...(release ? { release } : {}) }
      : {
          name: SOURCE.name,
          url: SOURCE.url,
          queryUrl: `${CHEMBL_API}/target.json?${targetParams}`,
          retrieved: new Date().toISOString(),
          cacheTtlSeconds: DAY,
          ...(release ? { release } : {}),
        },
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** ClinicalTrials.gov query fragment: `a OR b OR "multi word"`. */
export function drugsQuery(drugs: TargetDrug[]): string {
  return drugs.map((d) => (d.name.includes(" ") ? `"${d.name}"` : d.name)).join(" OR ");
}

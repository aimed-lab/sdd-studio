# Run 2026-11-14 — user profiles and use cases

Target: **studio.smartdrugdiscovery.org** (repo `aimed-lab/sdd-studio`, `main` at ae78956).
Comparator: **AI alone** = a general chat LLM with no tools, no browsing and no access to the site.

Scoring per user × task:
- **time** (minutes this user would spend), **completion** (full / partial / none / not attempted)
- **site quality** and **AI-alone quality**, each 0–5:
  0 nothing usable · 1 misleading/wrong · 2 thin, unsourced · 3 correct but incomplete or unsourced ·
  4 correct, sourced, mostly complete · 5 correct, sourced, current, complete, exportable
- **delta** = site − AI alone (positive means the site added value)

## User profiles (10)

| # | User | Background | Tech skill | Bio skill | Uses the site? | What they need |
|---|---|---|---|---|---|---|
| U1 | Dr. Sarah Kim | Cancer-biology postdoc | Medium | High | Yes, weekly | Provenance for every fact, PubMed, UniProt |
| U2 | Dr. Marcus Chen | Computational biologist | High | High | Yes, via API if possible | Bulk/API access, activity data, reproducibility |
| U3 | Dr. Priya Patel | Medicinal chemist, biotech | Medium | High (chem) | Yes | Structures, IC50, selectivity, residue-level design |
| U4 | Dr. James Wright | Clinical pharmacologist | Medium | High (clinical) | Yes | Real trial landscape, regulatory status |
| U5 | Dr. Elena Morales | Drug-development VP | Low | Medium | Occasionally | Portfolio decisions, GO/NO-GO, combinations |
| U6 | Tomás Rivera | Undergraduate research assistant | Low | Low | First time | Simple lookups, plain explanations, guidance |
| U7 | Dr. Aisha Bello | Oncologist / physician-scientist | Low | High (clinical) | Rarely, between clinics | Patient-relevant trials near Birmingham, fast |
| U8 | Kenji Watanabe | ML engineer at an AI-biotech | Very high | Low | Only through an API/MCP | Programmatic, structured, bulk data with provenance |
| U9 | Linda Okafor | Patient advocate / science journalist | Low | Low | No — uses AI chat; tries the site once | Plain language, trustworthy sources, no jargon |
| U10 | Dr. Rafael Duarte | Structural biologist | High | High (structure) | Yes | PDB entries, binding sites, residues, covalent chemistry |

## Use cases (30)

### Easy (lookup)
| ID | Task | Re-test of 11-09 |
|---|---|---|
| T01 | EGFR: UniProt accession and full protein name | UC-01 |
| T02 | Vemurafenib: ChEMBL ID, SMILES, molecular weight, approval status | UC-03 |
| T03 | Show the 2D structure of imatinib | |
| T04 | Recruiting Phase 3 trials for EGFR-mutant lung cancer: count and three NCT IDs | UC-10 |
| T05 | Approved drugs that target BRAF V600E | |
| T06 | How many program targets does the site list for melanoma, and which? | UC-02 |
| T07 | Export an EGFR trial search to CSV with source and retrieval date | |
| T08 | Plain-language explanation of EGFR C797S resistance (lay user) | |
| T09 | Primary source for "MET amplification causes gefitinib resistance" | UC-16 |
| T10 | Ruxolitinib: target(s) and mechanism of action | |

### Medium (cross-reference)
| ID | Task | Re-test of 11-09 |
|---|---|---|
| T11 | Compare MW, logP, HBA/HBD, QED of erlotinib, gefitinib, osimertinib | |
| T12 | Known resistance mechanisms to EGFR TKIs, with citations | UC-16 |
| T13 | JAK2 inhibitors with IC50 values and assay context | UC-07 |
| T14 | Trials that truly combine a BRAF and a MEK inhibitor in melanoma | UC-17 |
| T15 | Trace BRAF → melanoma → approved drugs → active trials | UC-09 |
| T16 | KRAS G12C NSCLC trials by sponsor and phase | |
| T17 | Is the "92% confidence" MoA figure sourced? (trust audit) | UC-06 |
| T18 | Programmatically retrieve 50 compounds matching "kinase inhibitor" | |
| T19 | PDB structures of EGFR bound to osimertinib (covalent Cys797) | |
| T20 | FDA approval history and current label status of osimertinib | UC-11 |

### Hard (synthesis / prediction)
| ID | Task | Re-test of 11-09 |
|---|---|---|
| T21 | Tractability of MAPT (tau) by modality | UC-13 |
| T22 | Prioritise NSCLC targets with genetic + literature evidence | UC-14 |
| T23 | Alzheimer's repositioning candidates with mechanistic rationale | UC-12 |
| T24 | Exportable JAK2 target-validation dossier | UC-19 |
| T25 | Selectivity of EGFR inhibitors across mutant/wild-type EGFR and HER2 | |
| T26 | Strategies against C797S (non-covalent, allosteric, 4th-gen) with evidence | UC-18 |
| T27 | BRAF+MEK+PD-1 triplet rationale with trial evidence and toxicity | UC-17 |
| T28 | GO/NO-GO recommendation for an internal program from real evidence | UC-20 |
| T29 | Match a patient (EGFR L858R, progressed on osimertinib, Birmingham AL) to recruiting trials | |
| T30 | Answer a question through an agent/MCP or API integration | UC-15 |

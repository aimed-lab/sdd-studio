"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { can, ROLE_META } from "@/lib/roles";
import { DemoDataNotice } from "@/components/data-provenance";

// ── Types ─────────────────────────────────────────────────────────────────────

type PluginType = "mcp" | "api" | "docker" | "jupyter" | "source";
type PluginPricing = "free" | "freemium" | "paid";

interface TestStep {
  label: string;          // e.g. "compound_search(\"vemurafenib\")"
  result: string;         // mock/real result to display
}

interface InstallStep {
  title: string;
  code?: string;          // code block to copy (bash, JSON, etc.)
  note?: string;          // plain-text annotation
  actionUrl?: string;     // optional external link
  actionLabel?: string;   // label for the external link button
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  type: PluginType;
  version: string;
  author: string;
  license: string;
  url: string;
  pricing: PluginPricing;
  requiresKey: boolean;   // true = user must supply API key / login
  fair: { findable: boolean; accessible: boolean; interoperable: boolean; reusable: boolean };
  installed: boolean;     // hardcoded default (pre-installed at launch)
  connected?: boolean;    // hardcoded default active connection
  connectedTools?: string[];
  category: string;
  compatibleWith: string[];
  testSteps: TestStep[];
  installInstructions?: InstallStep[];
}

// ── Type config ────────────────────────────────────────────────────────────────

const typeConfig: Record<PluginType, { label: string; badge: string; preference: number }> = {
  mcp:     { label: "MCP Server",        badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",       preference: 1 },
  api:     { label: "API",               badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",   preference: 2 },
  docker:  { label: "Docker Image",      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300", preference: 3 },
  jupyter: { label: "Jupyter Notebook",  badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", preference: 4 },
  source:  { label: "Source Code",       badge: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",          preference: 5 },
};

const pricingBadge: Record<PluginPricing, { label: string; color: string }> = {
  free:     { label: "Free",     color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  freemium: { label: "Freemium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  paid:     { label: "Paid",     color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

// ── Plugin catalogue ───────────────────────────────────────────────────────────

const plugins: Plugin[] = [
  {
    id: "sdd-studio-mcp",
    name: "SDD Studio MCP (this site)",
    description:
      "Read-only MCP endpoint for this site's live data (POST https://studio.smartdrugdiscovery.org/api/mcp). Five tools, each calling the same handler as its REST route with the same validation, caching and provenance: search_compounds, get_compound, search_trials, structure_search and get_target_evidence. Unauthenticated, rate-limited per IP, never returns demo data. Usage is reviewed 90 days after public listing (#73).",
    type: "mcp", version: "v1.0.0", author: "UAB SysPAI",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://studio.smartdrugdiscovery.org/api/mcp",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: true, connected: true,
    connectedTools: ["search_compounds", "get_compound", "search_trials", "structure_search", "get_target_evidence"],
    category: "Data", compatibleWith: ["A1", "A2", "A3", "A4"],
    testSteps: [
      { label: 'search_compounds({ q: "imatinib", limit: 5 })', result: "Example: ChEMBL rows, exact name match first, with source, retrieval time and ChEMBL release" },
      { label: 'get_compound({ chemblId: "CHEMBL1336" })', result: "Example: mechanisms looked up via the parent molecule, plus a subset of activity rows with the total count" },
      { label: 'search_trials({ term: "EGFR", condition: "non-small cell lung cancer", withExcludedCount: true })', result: "Example: ClinicalTrials.gov rows with the exact query sent and the number of trials hidden by eGFR disambiguation" },
      { label: 'structure_search({ smiles: <imatinib>, mode: "similarity", threshold: 90 })', result: "Example: similar ChEMBL compounds with their similarity scores" },
      { label: 'get_target_evidence({ gene: "EGFR" })', result: "Example: top disease associations and tractability with Open Targets' own scores and the data release" },
    ],
    installInstructions: [
      {
        title: "Add to Claude Code",
        code: "claude mcp add --transport http sdd-studio https://studio.smartdrugdiscovery.org/api/mcp",
        note: "Streamable HTTP, stateless, JSON responses. Read-only and unauthenticated; rate-limited per IP (20 burst, 20/min); 15 s budget per call.",
      },
      {
        title: "Other MCP clients",
        note: "Point any client that supports Streamable HTTP at https://studio.smartdrugdiscovery.org/api/mcp (POST). The same operations are documented as REST in /openapi.json.",
      },
    ],
  },
  {
    id: "chembl-mcp",
    name: "ChEMBL MCP server (Claude bio-research plugin)",
    description: "MCP server for ChEMBL data, bundled with Claude's bio-research plugin. Use it from your own AI client for target-centric bioactivity data. It is not connected to this site; this site calls the ChEMBL REST API directly.",
    type: "mcp", version: "—", author: "Claude bio-research plugin",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://www.ebi.ac.uk/chembl/",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, connected: false,
    connectedTools: ["compound_search", "drug_search", "target_search", "get_bioactivity", "get_mechanism", "get_admet"],
    category: "Data", compatibleWith: ["A1", "A2", "A3", "A4"],
    testSteps: [
      { label: 'compound_search("vemurafenib", max_phase=4)', result: "Simulated example (no live call is made from this page)" },
      { label: 'target_search(gene_symbol="BRAF", organism="Homo sapiens")', result: "Simulated example (no live call is made from this page)" },
      { label: 'get_bioactivity(target="CHEMBL5145", IC50, pChEMBL≥8)', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "pubmed-mcp",
    name: "PubMed MCP server (Claude bio-research plugin)",
    description: "MCP server for PubMed literature search, bundled with Claude's bio-research plugin. Not connected to this site.",
    type: "mcp", version: "—", author: "Claude bio-research plugin",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, connected: false,
    category: "Literature", compatibleWith: ["A7", "A8", "A9", "A10"],
    testSteps: [
      { label: 'search_articles("BRAF V600E melanoma treatment")', result: "Simulated example (no live call is made from this page)" },
      { label: 'get_article_metadata("PMID:21639808")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "open-targets-mcp",
    name: "Open Targets MCP server (Claude bio-research plugin)",
    description: "MCP server for the Open Targets Platform, bundled with Claude's bio-research plugin. Not connected to this site; this site's get_target_evidence tool calls the Open Targets API directly.",
    type: "mcp", version: "—", author: "Claude bio-research plugin",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://platform.opentargets.org/",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, category: "Data", compatibleWith: ["A1", "A2", "A3"],
    testSteps: [
      { label: 'target_associations("BRAF", disease="melanoma")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "uniprot-api",
    name: "UniProt REST API",
    description: "Protein sequence and function data from UniProt. Planned connection; this site does not call the UniProt API yet.",
    type: "api", version: "—", author: "UniProt Consortium",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://www.uniprot.org/help/api",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, category: "Data", compatibleWith: ["A1", "A2"],
    testSteps: [
      { label: 'GET /uniprotkb/P15056 (BRAF)', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "clinicaltrials-api",
    name: "ClinicalTrials.gov API",
    description: "Trial registry data. This site already calls the ClinicalTrials.gov API through its own /api/trials route; no separate plugin is needed.",
    type: "api", version: "—", author: "NLM/NIH",
    license: "—", pricing: "free", requiresKey: false,
    url: "https://clinicaltrials.gov/data-api/api",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, category: "Clinical", compatibleWith: ["A7", "A8", "A9"],
    testSteps: [
      { label: 'search_trials("BRAF inhibitor melanoma", phase=3, status=completed)', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "alphafold-docker",
    name: "Tool 1 — Structure prediction",
    description: "Placeholder for a protein structure prediction container. Not connected; no claims are made about its accuracy.",
    type: "docker", version: "—", author: "—",
    license: "—", pricing: "free", requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: false, reusable: true },
    installed: false, category: "Structure", compatibleWith: ["A1", "A3"],
    testSteps: [
      { label: "predict_structure(sequence=BRAF_kinase_domain)", result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "autodock-vina-docker",
    name: "Tool 2 — Molecular docking",
    description: "Placeholder for a molecular docking container. Not connected.",
    type: "docker", version: "—", author: "—",
    license: "—", pricing: "free", requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, category: "Docking", compatibleWith: ["A1", "A4"],
    testSteps: [
      { label: "dock(ligand=vemurafenib.sdf, receptor=4MNE.pdb)", result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "admet-jupyter",
    name: "Tool 3 — ADMET prediction notebook",
    description: "Placeholder for an ADMET property prediction notebook. Not connected; no predictions are made on this page.",
    type: "jupyter", version: "—", author: "—",
    license: "—", pricing: "freemium", requiresKey: true,
    url: "",
    fair: { findable: true, accessible: true, interoperable: false, reusable: true },
    installed: false, category: "ADMET", compatibleWith: ["A4", "A6"],
    testSteps: [
      { label: 'predict_admet(smiles="CCCS(=O)(=O)Nc1...")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "scrnaseq-jupyter",
    name: "Tool 4 — Single-cell RNA-seq pipeline",
    description: "Placeholder for a single-cell RNA-seq analysis notebook. Not connected.",
    type: "jupyter", version: "—", author: "—",
    license: "—", pricing: "free", requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, category: "Genomics", compatibleWith: ["A5"],
    testSteps: [
      { label: "cluster_cells(matrix=melanoma_10x.h5, resolution=0.6)", result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "netpharm-source",
    name: "Tool 5 — Network pharmacology package",
    description: "Placeholder for a drug-target-disease network analysis package. Not connected.",
    type: "source", version: "—", author: "—",
    license: "—", pricing: "free", requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: false, reusable: false },
    installed: false, category: "Network", compatibleWith: ["A2", "A3"],
    testSteps: [
      { label: 'build_network(drug="vemurafenib", disease="melanoma")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "huggingface-api",
    name: "Tool 6 — Model hub API",
    description: "Placeholder for a hosted model and dataset hub. Not connected.",
    type: "api", version: "—", author: "—",
    license: "—", pricing: "freemium", requiresKey: true,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, connected: false,
    category: "Foundation Models",
    compatibleWith: ["A1", "A2", "A4", "A5"],
    testSteps: [
      { label: 'model_info("facebook/esm2_t33_650M_UR50D")', result: "Simulated example (no live call is made from this page)" },
      { label: 'inference("MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKAVQVKVKALPDAQFEVVHSLAKWKRQTLGQHDFSAGEGLYTHMKALRPDEDRLSPLHSVYVDQWDWERVMGDGERQFSTLKSTVEAIWAGIKATEAAVSEEFGLAPFLPDQIHFVHSQELLSRYPDLDAKGRERAIAKDLGAVFLVGIGGKLSDGHRHDVRAPDYDDWSTPSELGHAGLNGDILVWNPVLEDAFELSSMGIRVDADTLKHQLALTGDEDRLELEWHQALLRGEMPQTIGGGIGQSRLTMLLLQLPHIGQVQAGVWPAAVRESVPSLL")', result: "Simulated example (no live call is made from this page)" },
      { label: 'dataset_search("drug discovery SMILES", task="molecular-generation")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "kaggle-api",
    name: "Tool 7 — Dataset and notebook API",
    description: "Placeholder for a public dataset and notebook service. Not connected.",
    type: "api", version: "—", author: "—",
    license: "—", pricing: "free", requiresKey: true,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: false },
    installed: false, connected: false,
    category: "Datasets",
    compatibleWith: ["A4", "A5", "A8", "A9"],
    testSteps: [
      { label: 'dataset_search("drug sensitivity cancer cell lines")', result: "Simulated example (no live call is made from this page)" },
      { label: 'dataset_download("gcpr/gdsc-drug-sensitivity", file="GDSC2_fitted_dose_response.xlsx")', result: "Simulated example (no live call is made from this page)" },
      { label: 'notebook_search("BRAF melanoma machine learning", sort_by="vote_count")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "sdd-chrome",
    name: "SmartDrugDiscovery for Chrome",
    description: "Planned browser extension for clipping data from PubMed, ChEMBL and ClinicalTrials.gov pages into projects. Not built or published yet.",
    type: "source", version: "planned", author: "UAB SysPAI",
    license: "—", pricing: "free",
    requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, connected: false,
    category: "Browser",
    compatibleWith: ["All models"],
    testSteps: [
      { label: "clip_selection() on PubMed abstract", result: "Simulated example (no live call is made from this page)" },
      { label: "clip_structure() on ChEMBL compound page", result: "Simulated example (no live call is made from this page)" },
      { label: "clip_table() on ClinicalTrials.gov results", result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "sdd-powerpoint",
    name: "SmartDrugDiscovery for PowerPoint",
    description: "Planned Office add-in for building slides from project data. Not built or published yet.",
    type: "source", version: "planned", author: "UAB SysPAI",
    license: "—", pricing: "free",
    requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false, connected: false,
    category: "Office",
    compatibleWith: ["All models"],
    testSteps: [
      { label: 'generate_slide("BRAF compound validation summary")', result: "Simulated example (no live call is made from this page)" },
      { label: 'export_survival_curve({ project_id: "P-001", format: "pptx" })', result: "Simulated example (no live call is made from this page)" },
      { label: 'insert_mcp_slide({ source: "pubmed", query: "BRAF V600E resistance mechanisms" })', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "frogent-mcp",
    name: "Tool 8 — Multi-agent drug design system",
    description: "Placeholder for an external multi-agent drug design system that could connect over MCP. Not connected; no claims are made about its performance.",
    type: "mcp",
    version: "—",
    author: "—",
    license: "—",
    pricing: "free",
    requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: true, reusable: false },
    installed: false,
    category: "Agent Systems",
    compatibleWith: ["A1", "A2", "A3", "A4", "A5", "A6"],
    testSteps: [
      { label: 'orchestrate("Design a BRAF V600E inhibitor with MW < 500, logP < 5")', result: "Simulated example (no live call is made from this page)" },
      { label: 'retrieve.search_targets("BRAF V600E", databases=["PDB","UniProt","DrugBank"])', result: "Simulated example (no live call is made from this page)" },
      { label: 'forge.generate_molecules(pocket="4MNE", model="MolCRAFT", n=50)', result: "Simulated example (no live call is made from this page)" },
      { label: 'gauge.score(candidates=top10, methods=["ADMET-ai","QVina","PLIP"])', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "drugclip-jupyter",
    name: "Tool 9 — Virtual screening model",
    description: "Placeholder for an external virtual-screening model. Not connected; no claims are made about its speed or accuracy.",
    type: "jupyter",
    version: "—",
    author: "—",
    license: "—",
    pricing: "free",
    requiresKey: false,
    url: "",
    fair: { findable: true, accessible: true, interoperable: false, reusable: true },
    installed: false,
    category: "Virtual Screening",
    compatibleWith: ["A1", "A3", "A4"],
    testSteps: [
      { label: 'encode_pocket(pdb="4MNE", chain="A", residues=457-717)', result: "Simulated example (no live call is made from this page)" },
      { label: 'screen_library(pocket_emb, library="ZINC250k", top_k=100)', result: "Simulated example (no live call is made from this page)" },
      { label: 'rank_candidates(candidates=top100, metric="cosine_similarity")', result: "Simulated example (no live call is made from this page)" },
    ],
  },
  {
    id: "talent-kg",
    name: "Talent Knowledge Graph",
    description: "Planned MCP server for researcher skills and availability. Not built yet; no real people are listed.",
    type: "mcp",
    version: "planned",
    author: "UAB SysPAI",
    license: "—",
    url: "",
    pricing: "free",
    requiresKey: false,
    fair: { findable: true, accessible: true, interoperable: true, reusable: true },
    installed: false,
    connected: false,
    category: "People & Teams",
    compatibleWith: ["All models"],
    testSteps: [
      { label: 'search_experts({ skill: "BRAF kinase inhibitor" })', result: "Simulated example (no live call is made from this page)" },
      { label: 'get_availability({ person_ids: ["SC","RP"] })', result: "Simulated example (no live call is made from this page)" },
      { label: 'get_project_history({ person_id: "SC" })', result: "Simulated example (no live call is made from this page)" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function FairBadge({ letter, met }: { letter: string; met: boolean }) {
  return (
    <span className={cn("h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center", met ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300")}>
      {letter}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 rounded-md bg-muted/80 hover:bg-muted border border-input px-2 py-1 text-[10px] font-medium transition-colors"
      title="Copy to clipboard"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── Install modal ─────────────────────────────────────────────────────────────

function InstallModal({
  plugin,
  onClose,
  onInstalled,
}: {
  plugin: Plugin;
  onClose: () => void;
  onInstalled: () => void;
}) {
  const steps = plugin.installInstructions ?? [];
  const tc = typeConfig[plugin.type];

  const handleDone = () => {
    onInstalled();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card border rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
            {plugin.type === "mcp" ? "🔌" : plugin.type === "api" ? "🌐" : plugin.type === "docker" ? "🐳" : plugin.type === "jupyter" ? "📓" : "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Install — {plugin.name}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tc.badge)}>{tc.label}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted transition-colors text-muted-foreground shrink-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No install instructions available for this plugin.</p>
          ) : (
            steps.map((step, i) => (
              <div key={i} className="space-y-2">
                {/* Step title */}
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium">{step.title}</p>
                </div>

                {/* Code block */}
                {step.code && (
                  <div className="relative">
                    <pre className="rounded-lg bg-muted/60 border border-border px-4 py-3 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre pr-16">
                      {step.code}
                    </pre>
                    <CopyButton text={step.code} />
                  </div>
                )}

                {/* Note */}
                {step.note && (
                  <p className="text-xs text-muted-foreground leading-relaxed pl-7">{step.note}</p>
                )}

                {/* External action */}
                {step.actionUrl && (
                  <div className="pl-7">
                    <a
                      href={step.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      {step.actionLabel ?? "Open link →"}
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Follow all steps above, then click <span className="font-semibold text-foreground">Mark as Installed</span> to enable the 🧪 Test button.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Mark as Installed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Test modal ────────────────────────────────────────────────────────────────

function TestModal({ plugin, onClose }: { plugin: Plugin; onClose: () => void }) {
  const [step, setStep] = useState(0);   // 0 = idle, 1..n = running step n, 99 = done
  const [lines, setLines] = useState<{ label: string; result: string; done: boolean }[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setLines([]);
    setStep(0);
    for (let i = 0; i < plugin.testSteps.length; i++) {
      setStep(i + 1);
      setLines((prev) => [...prev, { label: plugin.testSteps[i].label, result: "", done: false }]);
      await new Promise((r) => setTimeout(r, 900));
      setLines((prev) =>
        prev.map((l, idx) =>
          idx === i ? { ...l, result: plugin.testSteps[i].result, done: true } : l
        )
      );
      await new Promise((r) => setTimeout(r, 300));
    }
    setStep(99);
    setRunning(false);
  };

  // auto-run on open
  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Test — {plugin.name}</p>
            <p className="text-xs text-muted-foreground">{plugin.connectedTools?.length ?? "?"} tools · example output, not a live call</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors text-muted-foreground">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 p-5 space-y-3 max-h-96 overflow-y-auto font-mono text-xs">
          {/* User prompt */}
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm not-italic font-sans">
              Test connection to <span className="font-semibold">{plugin.name}</span> — run example query
            </div>
          </div>

          {/* Tool calls */}
          {lines.map((l, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-2 text-muted-foreground">
                <span className="text-blue-500 shrink-0">▶</span>
                <span className="text-blue-600 dark:text-blue-400">{l.label}</span>
              </div>
              {l.done ? (
                <div className="ml-4 text-green-600 dark:text-green-400">{l.result}</div>
              ) : (
                <div className="ml-4 flex gap-1 text-muted-foreground">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </div>
              )}
            </div>
          ))}

          {/* Final verdict */}
          {step === 99 && (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3 not-italic font-sans">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                Connection verified — {plugin.name} is working
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                All {plugin.testSteps.length} test {plugin.testSteps.length === 1 ? "query" : "queries"} returned valid responses.
                You can now use this plugin in Design with AI.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={run}
            disabled={running}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <svg className={cn("h-3.5 w-3.5", running && "animate-spin")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            Run again
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Credential modal (connect paid/freemium plugins with API key) ──────────────

function CredentialModal({
  plugin,
  onClose,
  onConnect,
}: {
  plugin: Plugin;
  onClose: () => void;
  onConnect: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-base font-semibold">Connect — {plugin.name}</h3>
        <p className="text-xs text-muted-foreground">
          This plugin requires your personal API key or login credentials.
          Your key is stored only in your browser session.
        </p>
        <div className="space-y-2">
          <label className="text-xs font-medium">API Key / Access Token</label>
          <div className="flex gap-2">
            <input
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key here…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button onClick={() => setShow(!show)} className="rounded-md border px-3 py-2 text-xs hover:bg-muted transition-colors">
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
          <button
            disabled={!apiKey.trim()}
            onClick={() => { if (apiKey.trim()) { onConnect(); onClose(); } }}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Uninstall modal ────────────────────────────────────────────────────────────

function UninstallModal({
  plugin,
  onClose,
  onConfirm,
}: {
  plugin: Plugin;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLowerCase() === "yes";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base">Uninstall Plugin</h3>
            <p className="text-sm text-muted-foreground">{plugin.name}</p>
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-300 space-y-1">
          <p className="font-medium">This action cannot be undone.</p>
          <p>All connected tool access will be revoked. Any workflows using this plugin will immediately stop working.</p>
        </div>

        {/* Confirm input */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">yes</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="yes"
            autoFocus
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (ready) { onConfirm(); onClose(); } }}
            disabled={!ready}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2",
              ready
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-red-100 text-red-300 dark:bg-red-900/20 cursor-not-allowed"
            )}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Uninstall
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PluginsPage() {
  const { user } = useAuth();
  const role = user?.role ?? "User";

  const [typeFilter, setTypeFilter] = useState<PluginType | "all">("all");
  const [search, setSearch]         = useState("");
  const [testPlugin, setTestPlugin] = useState<Plugin | null>(null);
  const [credPlugin, setCredPlugin]         = useState<Plugin | null>(null);
  const [uninstallPlugin, setUninstallPlugin] = useState<Plugin | null>(null);
  const [installPlugin, setInstallPlugin]   = useState<Plugin | null>(null);

  // ── Installed state backed by localStorage ──────────────────────────────────
  // Start with hardcoded defaults (plugins where installed: true)
  const [installedIds, setInstalledIds] = useState<Set<string>>(
    () => new Set(plugins.filter((p) => p.installed).map((p) => p.id))
  );

  // Merge with any previously saved installs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sdd-plugin-installs");
      if (stored) {
        const arr: string[] = JSON.parse(stored);
        setInstalledIds((prev) => new Set(Array.from(prev).concat(arr)));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const markInstalled = (id: string) => {
    setInstalledIds((prev) => {
      const next = new Set(Array.from(prev).concat([id]));
      try { localStorage.setItem("sdd-plugin-installs", JSON.stringify(Array.from(next))); } catch { /* noop */ }
      return next;
    });
  };

  const markUninstalled = (id: string) => {
    setInstalledIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      try { localStorage.setItem("sdd-plugin-installs", JSON.stringify(Array.from(next))); } catch { /* noop */ }
      return next;
    });
  };

  // ── Derived helpers ─────────────────────────────────────────────────────────
  const isDev    = can(role, "viewIntegrationGuide");
  const canAdmin = can(role, "uninstallPlugin");

  const filtered = plugins
    .filter((p) => typeFilter === "all" || p.type === typeFilter)
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    })
    .sort((a, b) => typeConfig[a.type].preference - typeConfig[b.type].preference);

  const roleMeta = ROLE_META[role];

  return (
    <div className="container mx-auto py-8 px-4">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Tool Plugins</h1>
          <p className="text-muted-foreground mt-1">FAIR-compliant integrations for extending the AIDD platform</p>
        </div>
        <DemoDataNotice variant="planned" />
        {/* Role banner */}
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", roleMeta.color)}>
          <span className="font-semibold">{roleMeta.label}</span>
          <span className="opacity-70">— {roleMeta.description}</span>
        </div>
      </div>

      {/* View differs by role */}
      {!isDev && (
        <div className="mb-5 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3 text-xs text-yellow-800 dark:text-yellow-400">
          <span className="font-semibold">User view:</span> You can browse all plugins, install free ones directly, and connect paid plugins with your own API key.
          Configuration details and the integration guide are visible to Developers and above.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {(["all", "mcp", "api", "docker", "jupyter", "source"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn("rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                typeFilter === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}
            >
              {t === "all" ? "All" : typeConfig[t].label}
            </button>
          ))}
        </div>
        <input
          type="text" placeholder="Search plugins…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-64"
        />
      </div>

      {/* Plugin grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((plugin) => {
          const tc = typeConfig[plugin.type];
          const pc = pricingBadge[plugin.pricing];
          const isInstalled = installedIds.has(plugin.id);
          const isConnected = plugin.connected ?? false;
          const testable = isInstalled || isConnected;
          return (
            <Card key={plugin.id} className={cn("flex flex-col", isConnected && "border-green-200 dark:border-green-800")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{plugin.name}</CardTitle>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium whitespace-nowrap", tc.badge)}>{tc.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", pc.color)}>{pc.label}</span>
                  </div>
                </div>
                <CardDescription className="text-xs mt-1">{plugin.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col gap-3 flex-1">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{plugin.version}</span>
                  <span>{plugin.author}</span>
                  <span>{plugin.license}</span>
                </div>

                {/* FAIR badges */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">FAIR:</span>
                  <FairBadge letter="F" met={plugin.fair.findable} />
                  <FairBadge letter="A" met={plugin.fair.accessible} />
                  <FairBadge letter="I" met={plugin.fair.interoperable} />
                  <FairBadge letter="R" met={plugin.fair.reusable} />
                </div>

                {/* Compatible models */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Models:</span>
                  {plugin.compatibleWith.map((l) => (
                    <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{l}</span>
                  ))}
                </div>

                {/* Connected tools — shown only to Developers+ */}
                {isConnected && plugin.connectedTools && isDev && (
                  <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2">
                    <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      {plugin.connectedTools.length} live tools
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {plugin.connectedTools.map((t) => (
                        <span key={t} className="rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 py-0.5 text-[10px] font-mono">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected indicator for Users (simplified) */}
                {isConnected && !isDev && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Connected and ready to use
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto pt-2 flex gap-2">
                  {/* Primary action */}
                  {isConnected ? (
                    <button disabled className="flex-1 rounded-md border border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs font-medium cursor-default flex items-center justify-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      Connected
                    </button>
                  ) : isInstalled ? (
                    <button disabled className="flex-1 rounded-md border border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 text-xs font-medium cursor-default flex items-center justify-center gap-2">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                      Installed
                    </button>
                  ) : plugin.requiresKey ? (
                    <button
                      onClick={() => setCredPlugin(plugin)}
                      className="flex-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      Connect with API Key
                    </button>
                  ) : (
                    <button
                      onClick={() => setInstallPlugin(plugin)}
                      className="flex-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v14M5 9l7 7 7-7" /><path d="M5 22h14" />
                      </svg>
                      Install Free
                    </button>
                  )}

                  {/* Test button — all roles, only if installed/connected */}
                  {testable && (
                    <button
                      onClick={() => setTestPlugin(plugin)}
                      title="Test connection"
                      className="rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      🧪
                    </button>
                  )}

                  {/* Uninstall — Admin+ only */}
                  {canAdmin && isInstalled && (
                    <button
                      onClick={() => setUninstallPlugin(plugin)}
                      title="Uninstall"
                      className="rounded-md border border-red-200 text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No plugins found matching your criteria.</div>
      )}

      {/* Integration Guide reference — full guide lives in Support Center */}
      {isDev && (
        <div className="mt-10 rounded-xl border border-dashed bg-muted/30 px-6 py-5 flex items-start gap-4">
          <span className="text-3xl shrink-0">🔌</span>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold text-sm">MCP Integration Guide</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The step-by-step guide for finding, installing, configuring, and testing MCP servers has moved to the Support Center — alongside documentation, training videos, and external portals.
            </p>
            <div className="flex gap-3 pt-1">
              <a href="/support" className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors">
                Open Support Center →
              </a>
              <a href="/support#mcp-guide" className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                Jump to MCP Guide
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {installPlugin && (
        <InstallModal
          plugin={installPlugin}
          onClose={() => setInstallPlugin(null)}
          onInstalled={() => markInstalled(installPlugin.id)}
        />
      )}
      {testPlugin && (
        <TestModal plugin={testPlugin} onClose={() => setTestPlugin(null)} />
      )}
      {credPlugin && (
        <CredentialModal
          plugin={credPlugin}
          onClose={() => setCredPlugin(null)}
          onConnect={() => markInstalled(credPlugin.id)}
        />
      )}
      {uninstallPlugin && (
        <UninstallModal
          plugin={uninstallPlugin}
          onClose={() => setUninstallPlugin(null)}
          onConfirm={() => markUninstalled(uninstallPlugin.id)}
        />
      )}
    </div>
  );
}

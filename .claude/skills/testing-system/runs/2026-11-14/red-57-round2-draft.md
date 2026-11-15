# RED #57, round 2 draft (merged from Quality, Cost/Stability, Innovation round 1)

1. **Default disambiguation (lexicon).**
   - One reviewed file, `src/data/ambiguous-symbols.ts`, with a cited reason per entry. It starts with `EGFR → NOT glomerular`.
   - Matching is case-insensitive and whole-token.
   - `/api/trials` applies it by default (`disambiguate=false` turns it off).
   - The exact query sent appears in provenance (`queryUrl` plus a `disambiguation` field), in the UI, in shareable URLs and in the CSV.
2. **Hidden trials stay reachable.**
   - The UI shows a notice: "Excluded trials mentioning 'glomerular' (eGFR, a kidney-function measure). [Show them] [Turn off]".
   - **Show them** fetches the complement query (`EGFR AND glomerular` with the same filters) on click only, so there is no extra request per search. Results appear in an expandable section, "Possible kidney-function matches (N): may include real EGFR trials (e.g. NCT03066206)".
   - **Turn off** re-runs the search without the exclusion.
3. **Default disease.**
   - The page's built-in example query becomes EGFR + "non-small cell lung cancer".
   - Links from a /targets card pre-fill that target's curated disease.
   - A condition the user typed is never overridden.
4. **Row annotation (no extra request).** If the symbol appears in none of a study's title, conditions, keywords or interventions (add the `Keyword` field), mark the row "EGFR appears only in eligibility/outcome text — may refer to eGFR" and sort it after direct matches.
5. **Opt-in field restriction (d).** A single boolean parameter on the existing route: "Gene in title/condition/intervention/keyword only". The result total is shown so the reduction is visible. It is never the default.
6. **(c) target-aware expansion.** Tracked on #61. Opt-in, drug names from ChEMBL mechanism data, a precomputed cached list capped at about 10 names. Ships only if EGFR+NSCLC recall loss is under 5%.
7. **Verification.**
   - The PR reports before/after counts for EGFR with NSCLC, kidney cancer and "cancer", for the default and each toggle, plus a spot-check of 5 hidden trials.
   - The smoke test asserts that the default loses under 1% of EGFR+NSCLC trials compared with no disambiguation.
   - The same logic serves the API, the UI and the future MCP tool.

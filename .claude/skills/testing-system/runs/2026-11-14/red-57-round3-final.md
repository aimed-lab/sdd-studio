# RED #57, round 3 final text

This is the round-2 draft (red-57-round2-draft.md) with all round-2 amendments folded in. The count conflict is resolved as follows.

- **Excluded count (Quality + Innovation want it shown; Cost/Stability objects to an extra request on every search):**
  - **Request:** a separate count-only call, `countTotal=true&pageSize=1` with minimal fields, for the complement query.
  - **Cache:** 24 h, keyed by the final query string, so a repeated query costs nothing.
  - **Timing:** issued by the UI only after the main results have rendered, inside the same per-IP rate limit and timeout.
  - **Before it returns:** the notice reads "counting…".
  - **On failure or timeout:** the notice reads "an unknown number of trials hidden — [Show them]".
  - **Kill switch:** the env var `TRIALS_EXCLUDED_COUNT=off` disables the count entirely, so the notice always says "unknown number". The lab can turn it off without a deploy if upstream load or fair use becomes a concern.
  - **API:** returns `excludedCount` only when the caller asks (`withExcludedCount=true`). Otherwise it returns `null`, so plain API and agent calls make no extra request.
- **Row annotation:** returned in the API as `symbolMatch: "direct" | "eligibility_or_outcome_only"`. Annotated rows are re-sorted only within the page already returned.
- **Smoke test:** compares the `disambiguate=true` and `disambiguate=false` counts in the same run as a ratio (NSCLC loss < 1%). No absolute totals. It runs on the existing daily schedule.
- **Agent access:** the `disambiguate`, `fieldsGeneOnly` and `withExcludedCount` parameters are documented in the OpenAPI spec and as MCP tool parameters.
- **Unchanged:** everything else in the round-2 draft:
  - the lexicon default with a visible notice, Show them and Turn off
  - the NSCLC example default and target-card prefill
  - the opt-in fields toggle
  - (c) on #61
  - the PR before/after counts and spot-check


**Round-3 correction from Cost/Stability, accepted:** env vars on Vercel need a redeploy, so the excluded-count kill switch is a runtime setting (`platform_settings` row `trials_excluded_count`, read at request time), not `TRIALS_EXCLUDED_COUNT`.

**Votes:** round 1 combination ×3 · round 2 AMEND ×3 · round 3 ACCEPT ×3.

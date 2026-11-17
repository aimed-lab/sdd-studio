# AI agents and usage limits

Two agents on **Add-on Service** (`/services`) run for real: the **Literature Mining Agent** and the **Clinical Trial Feasibility Agent**. Every other agent, expert and tool on that page is a catalog preview and is labelled as planned.

Both agents are for signed-in members. Each run queries a public source at that moment, asks Claude to write from what was retrieved, checks Claude's answer on the server, and keeps a run record you can reopen.

## Literature Mining Agent

**You give:** a question or topic, and optionally a target and a compound. Under *PubMed search options* you can write your own PubMed query, choose how many records to read (10 to 40) and the order (PubMed best match, or most recent first).

**What happens:**

1. The server searches PubMed with NCBI E-utilities (`esearch`, then `efetch`). With no query of your own, it searches the target and compound in titles and abstracts (`"EGFR"[tiab] AND "osimertinib"[tiab]`); with neither, the question itself is the query.
2. Claude receives **only the fetched abstracts** and the question. It must answer from them and list, for every statement, the PMIDs it rests on.
3. The server checks every citation against the set of abstracts Claude was given. A citation to a PMID outside the set is removed; a statement left with no citation from the set, or that names an outside PMID in its text, is removed and listed under *Removed by the citation check* with the reason.

Records without an abstract are listed but not given to Claude. If no record matches, Claude is not called and the run costs nothing.

**The result** has a short answer, a table of findings with the kind of evidence (review, clinical trial, animal, cell, and so on), what the abstracts do not answer, and the numbered PubMed records with links, authors, journal, year and DOI. Read the cited abstracts before relying on a statement.

## Clinical Trial Feasibility Agent

**You give:** a condition, and optionally an intervention and a location.

**What happens:**

1. The server queries the ClinicalTrials.gov API v2, the same client Studio's Trial Landscape uses, and computes in code:
   - trials by overall status and by phase (a Phase 1/Phase 2 trial counts under both phases);
   - for recruiting trials, the sites marked recruiting, by country;
   - enrollment sizes (actual or estimated, as registered), lead sponsor type and start year.
2. Up to 3,000 matching records are analysed. Above that, status and phase totals stay exact (one count query each), and the enrollment, sponsor and start-year figures are labelled as coming from the first 3,000 records in ClinicalTrials.gov's relevance order.
3. Claude receives only these computed figures and writes a short narrative (overview, recruitment, landscape, caveats). It is told to use only those numbers. The server then removes any sentence that contains a number not in the figures, or a quantity written in words, and lists it under *Removed by the number check*.

The tables of computed figures are always shown, also when Claude declines or fails.

## Run records

Every run is saved, including runs that found nothing or failed. A run record shows the inputs, each data source with the exact query URL and retrieval time, the model, input and output tokens, the cost and who paid, and the result. *Your recent runs* on `/services` lists your last 25 runs; each opens at `/services/runs/<id>`. Members see their own runs; the Owner and Admins, signed in with single sign-on, can open any run.

## Who pays: lab budget, then your own key

This is the policy chosen for issue #71: the lab pays for Claude up to a cap, then members use their own key.

- **Lab budget per month:** all members' lab-paid runs together, per calendar month in UTC. Default **$200**.
- **Limit per member per day:** each member's lab-paid runs per day in UTC. Default **$5**.

Both limits are in `platform_settings` (`ai_monthly_cap_usd`, `ai_daily_limit_usd`). The Owner, signed in with single sign-on, changes them in **Settings → API Keys → AI agent usage**; the same card shows everyone the current use, and the Owner and Admins see lab-paid use by member.

A run starts on the lab key only if both the month and your day are still under their limits. A run that starts under a limit can finish slightly over it, by at most that run's cost.

**Past a limit,** the run form says which limit is used up. If you have saved an Anthropic key in **Settings → API Keys**, you can choose *Run with my own key*:

- The key stays in your browser. It is sent with that one request, over HTTPS, in a request header.
- The server uses it for that run's Claude call only. It is never written to the database or to logs, and nothing keeps it after the request ends.
- Anthropic bills your account. The run record and your usage show it as paid by your own key, and it does not count against the lab budget.

We chose this over storing keys on the server (even encrypted) because Studio does not need the key between runs, and a key that is never stored cannot leak from the database or a backup.

## Cost

Each Claude call is costed when it is made from the tokens Anthropic reports, at Anthropic's list prices ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)), and stored with the run:

| Model | Input | Output | Cache read |
|---|---|---|---|
| Claude Sonnet 5.5 (`claude-sonnet-5-5`, used by both agents) | $2 per million tokens | $10 per million tokens | $0.10 per million tokens |
| Claude Sonnet 5 (refusal fallback) | $2 per million tokens | $10 per million tokens | $0.20 per million tokens |

Prices were checked on 2026-11-17 and live in `src/lib/agents/pricing.ts`. A call to a model not in that table is costed at the highest listed price, so usage is never under-counted.

Claude's thinking counts as output tokens. Each run's actual cost is in its run record.

**Model.** Both agents use Claude Sonnet 5.5, chosen by the Owner on 2026-11-17 for cost (half the price of Claude Opus 5.5 per token). The model is set in one place, `AGENT_MODEL` in `src/lib/agents/pricing.ts`.

**Refusals.** Claude Sonnet 5.5 has safety classifiers that can decline a request. The agents ask Anthropic to re-run a declined request on the fallback model Anthropic picks for that category; for Claude Sonnet 5.5 that covers the cyber and frontier-AI categories (re-run on Claude Sonnet 5), not biology. The run record names the model that answered. If the request is still declined, the run is saved as *Declined by Claude*, its cost is recorded, and the retrieved records or computed figures are still shown.

## Data sources and limits

- **PubMed** through [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/). Requests send a generic tool name (`sdd-studio`) and no email address, and are spaced at least 400 ms apart on each server instance, under NCBI's limit of 3 requests per second without an API key. Set `NCBI_API_KEY` in Vercel to raise NCBI's limit to 10 per second.
- **ClinicalTrials.gov** through the [API v2](https://clinicaltrials.gov/data-api/api). The run record notes the API version and data timestamp ClinicalTrials.gov reports.
- One run at a time per member on each server instance.

## For developers

| Endpoint | Who | Purpose |
|---|---|---|
| `POST /api/agents/literature` | members | `{ question, target?, compound?, pubmedQuery?, maxRecords?, sort? }` → `{ runId, status }` |
| `POST /api/agents/trials` | members | `{ condition, intervention?, location? }` → `{ runId, status }` |
| `GET /api/agents/runs` | members | your last 25 runs |
| `GET /api/agents/runs/<id>` | members | one run (yours; any run for a signed-in Owner or Admin) |
| `GET /api/agents/usage` | members | limits, spend, whether the lab key can pay |
| `PUT /api/agents/usage` | Owner (single sign-on) | `{ monthlyCapUsd, dailyLimitUsd }` |

Over a limit with no key, the run endpoints answer `402` with `code: "over_budget"`. A member's key goes in the `x-anthropic-key` header. With single sign-on off (preview deployments use the legacy sign-in), the server takes the member's email from the `x-sdd-email` header and requires an active member account, as the sandbox token routes do; it cannot verify that the person is who they claim, so limits stay read-only and only the member's own runs are shown.

Tables, created on first use:

- `ai_usage`: one row per Claude call: `user_email`, `agent`, `run_id`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, `key_source` (`lab` or `member`), `created_at`.
- `agent_runs`: one row per run: `id`, `user_email`, `agent`, `status` (`ok`, `no_data`, `refused`, `error`), `inputs`, `sources` (name, query URL, retrieval time), `model`, tokens, `cost_usd`, `key_source`, `output`, `error`, `duration_ms`, `created_at`.

Code: `src/lib/agents/` (`run.ts` is the common path; `literature.ts`, `trials.ts`, `pubmed.ts`, `claude.ts`, `store.ts`, `pricing.ts`).

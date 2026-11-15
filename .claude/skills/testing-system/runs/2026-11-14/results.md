# Results — run 2026-11-14

300 user × task attempts (10 users × 30 tasks) on studio.smartdrugdiscovery.org (`main` @ ae78956),
compared with a chat AI used alone (no tools). Quality is 0–5 per the rubric in `profiles-and-use-cases.md`.
Sources: `site-capability.md` (expert audit, verified), `ai-alone-baseline.md` (verified), `users-*.md` (per-user tables).

## Per user

| User | Profile | Full / partial / none / n.a. | Site mean | AI-alone mean | Delta | Minutes |
|---|---|---|---|---|---|---|
| U1 | Cancer-biology postdoc | 8 / 13 / 9 / 0 | 2.10 | 2.13 | −0.03 | 188 |
| U2 | Computational biologist | 9 / 13 / 8 / 0 | 2.23 | 2.23 | 0.00 | 161 |
| U3 | Medicinal chemist | 8 / 14 / 8 / 0 | 2.20 | 2.47 | −0.27 | 191 |
| U4 | Clinical pharmacologist | 8 / 12 / 10 / 0 | 2.00 | 2.40 | −0.40 | 171 |
| U5 | Drug-development VP | 5 / 14 / 10 / 1 | 1.80 | 2.40 | −0.60 | 217 |
| U6 | Undergraduate, first visit | 3 / 13 / 14 / 0 | 1.30 | 2.27 | −0.97 | 310 |
| U7 | Oncologist | 4 / 10 / 7 / 9 | 1.23 | 2.37 | −1.13 | 96 |
| U8 | ML engineer (API only) | 6 / 9 / 14 / 1 | 1.33 | 1.87 | −0.53 | 130 |
| U9 | Patient advocate / journalist | 2 / 7 / 12 / 9 | 0.80 | 1.90 | −1.10 | 166 |
| U10 | Structural biologist | 8 / 14 / 8 / 0 | 2.17 | 2.50 | −0.33 | 194 |
| **All** | | **61 / 119 / 100 / 20** | **1.72** | **2.25** | **−0.54** | **1,824** |

Expert ceiling (site-capability audit): 8 full / 14 partial / 8 none, site mean 2.2. AI-alone verified baseline: 2.47.

## Per task (mean of 10 users)

| Task | Site mean | AI-alone mean | Delta | Full / partial / none / n.a. |
|---|---|---|---|---|
| T01 | 2.6 | 3.6 | -1.0 | 6 / 2 / 2 / 0 |
| T02 | 3.1 | 3.6 | -0.5 | 6 / 2 / 2 / 0 |
| T03 | 2.8 | 2.2 | +0.6 | 8 / 0 / 2 / 0 |
| T04 | 3.8 | 1.0 | +2.8 | 9 / 1 / 0 / 0 |
| T05 | 1.6 | 3.7 | -2.1 | 0 / 7 / 3 / 0 |
| T06 | 0.9 | 0.0 | +0.9 | 0 / 9 / 1 / 0 |
| T07 | 3.5 | 0.2 | +3.3 | 10 / 0 / 0 / 0 |
| T08 | 1.5 | 4.0 | -2.5 | 0 / 8 / 2 / 0 |
| T09 | 3.1 | 3.4 | -0.3 | 8 / 0 / 2 / 0 |
| T10 | 1.4 | 3.7 | -2.3 | 0 / 8 / 2 / 0 |
| T11 | 2.8 | 2.6 | +0.2 | 6 / 2 / 0 / 2 |
| T12 | 2.7 | 2.5 | +0.2 | 0 / 8 / 2 / 0 |
| T13 | 0.0 | 1.8 | -1.8 | 0 / 0 / 8 / 2 |
| T14 | 2.0 | 2.7 | -0.7 | 0 / 10 / 0 / 0 |
| T15 | 1.8 | 2.0 | -0.2 | 0 / 9 / 1 / 0 |
| T16 | 2.9 | 1.7 | +1.2 | 2 / 8 / 0 / 0 |
| T17 | 2.3 | 1.0 | +1.3 | 6 / 2 / 1 / 1 |
| T18 | 0.5 | 1.6 | -1.1 | 0 / 5 / 2 / 3 |
| T19 | 1.2 | 2.7 | -1.5 | 0 / 5 / 3 / 2 |
| T20 | 0.6 | 3.4 | -2.8 | 0 / 0 / 10 / 0 |
| T21 | 0.8 | 2.8 | -2.0 | 0 / 0 / 9 / 1 |
| T22 | 0.8 | 2.7 | -1.9 | 0 / 0 / 9 / 1 |
| T23 | 0.8 | 2.7 | -1.9 | 0 / 0 / 9 / 1 |
| T24 | 0.7 | 1.8 | -1.1 | 0 / 0 / 8 / 2 |
| T25 | 0.0 | 1.8 | -1.8 | 0 / 0 / 9 / 1 |
| T26 | 1.8 | 2.0 | -0.2 | 0 / 9 / 1 / 0 |
| T27 | 1.9 | 3.6 | -1.7 | 0 / 10 / 0 / 0 |
| T28 | 0.7 | 1.8 | -1.1 | 0 / 0 / 8 / 2 |
| T29 | 1.9 | 1.0 | +0.9 | 0 / 10 / 0 / 0 |
| T30 | 1.0 | 0.0 | +1.0 | 0 / 4 / 4 / 2 |
## Reading

- **Where the site beats AI alone:**
  - Live, exportable, sourced data: T07 CSV export (+3.3), T04 recruiting Phase 3 trials (+2.8), T16 sponsor/phase (+1.2) and T29 patient match (+0.9).
  - Honest provenance: T17 (+1.3) and T03 structures (+0.6).
  - AI alone answered every "recruiting" question with trials that have since closed, and invented 3 of 16 PMIDs.
- **Where AI alone wins:**
  - Facts the site doesn't hold: T20 regulatory (−2.8), T10 mechanism (−2.3) and T05 drugs per target (−2.1).
  - Explanation: T08 plain language (−2.5).
  - Everything in the hard tier (T21–T25, T27, T28), where the site only has demo data.
- **Users differ most by how easily they reach the live tools.**
  - The three live tools have no sidebar link. All five simulation agents found this independently.
  - Live trials are labelled "Trial Simulations", and the first page after login is the demo /projects.
  - Experts who type URLs score about −0.2. Novices, clinicians and the lay user score about −1.0 or worse.
- **Compared with run 2026-11-09:** 0/20 use cases succeeded then. Now the re-tested lookups (T01–T04, T07, T09, T11) are full for most users, and T04/T07 are the site's biggest wins.

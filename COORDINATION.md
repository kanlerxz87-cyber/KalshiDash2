# COORDINATION — shared task board

Branch for this session: `arena/64d89c6c-kalshidash2` (base `6081bb7` on `main`).
Protocol note: this session is assigned exactly one branch, so all tasks are
committed to that branch. Scopes below are kept non-overlapping so any parallel
session can take a task without touching the files of another task.

Status values: `unclaimed` · `in progress` · `done` · `needs review`
(`needs review` = published on the Flagged for Review page; does not block anything.)

| ID | Task | Status | Owner (session) | Files touched |
|----|------|--------|-----------------|---------------|
| T1 | Repo review + irregularity log | in progress | arena/64d89c6c | `reports/repo-review.md` |
| T2 | Executive summary | in progress | arena/64d89c6c | `reports/executive-summary.md` |
| T3 | Market data collector + snapshot | in progress | arena/64d89c6c | `scripts/collect.mjs`, `site/data/*.json` |
| T4 | Landing page + live dashboard + category pages (gas, elections, culture, crypto, golf) | in progress | arena/64d89c6c | `site/index.html`, `site/category.html`, `site/dashboard.html`, `site/assets/*` |
| T5 | Portfolio, trade analysis & strategy pages | in progress | arena/64d89c6c | `site/portfolio.html`, `site/analysis.html`, `reports/strategy.md` |
| T6 | Suggestions (decision board) + questions / information gaps | in progress | arena/64d89c6c | `site/suggestions.html`, `site/questions.html`, `reports/questions.md` |
| T7 | Flagged for Review page | in progress | arena/64d89c6c | `site/flagged.html` |
| T8 | GitHub Pages deploy workflow | in progress | arena/64d89c6c | `.github/workflows/pages.yml` |
| T9 | Integration: combined re-verification, build/link check, PR, merge, deploy check | unclaimed | — | `COORDINATION.md` (log) |

## Log

- **2026-11-20 · arena/64d89c6c** — Claimed T1–T8. Repo state at claim: only `README.md`
  (13 bytes). No code, no tests, no CI, no LICENSE. GitHub Pages was already enabled
  on `main` with the *legacy* build (source `main` `/`); plan is to switch to the
  *workflow* build so a scheduled job can refresh data.
- **2026-11-20 · arena/64d89c6c** — Site built (`site/`), collector (`scripts/collect.mjs`), checker
  (`scripts/check-site.mjs`), workflow (`.github/workflows/pages.yml`), reports (`reports/`).
  Branch history was squashed once (force-push to this branch only) to drop a bot data commit and probe output (see F4).
- Sandbox note: outbound access from the build sandbox is allow-listed. The Kalshi
  API host was **not** reachable from bash (TLS failure), but was readable through the
  documentation/fetch tool. Bulk data collection will therefore run inside GitHub Actions
  runners, and every value will be traceable to an official API URL.

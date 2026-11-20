# COORDINATION.md — Shared Task Board

Repo: `kanlerxz87-cyber/KalshiDash2`
Session ID convention: `<session-id>` (each session writes its own id).

**This file is the single source of truth for who is doing what.** Read it before
starting any work. Claim a task by writing your session ID + file scope into the
table, then `git commit` + `git push` the claim immediately. Never start a task
another session has claimed.

## Status legend

| Status | Meaning |
| --- | --- |
| `unclaimed` | Nobody is working on it. |
| `in progress` | Claimed and actively being worked. |
| `done` | Completed, committed, pushed, verification recorded. |
| `needs review` | Published on the site's "Flagged for Review" page. Does **not** block anything. |

## Task board

| ID | Task | Scope (files touched) | Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| T0 | Repo scaffolding, README, this board | `README.md`, `COORDINATION.md` | in progress | `210dfcb8` | Branch `arena/210dfcb8-kalshidash2` |
| T1 | API surface verification (REST + WS endpoints, exact params, response fields) | `docs/API_REFERENCE.md` | unclaimed | — | Source: `https://docs.kalshi.com/api-reference/*` |
| T2 | Live demo data collection + topic taxonomy (gas/elections/culture/crypto/golf) | `data/**`, `scripts/**` | unclaimed | — | Source: `https://demo-api.kalshi.co/trade-api/v2/*` |
| T3 | Executive summary, open-questions register, suggestions register | `docs/EXECUTIVE_SUMMARY.md`, `docs/OPEN_QUESTIONS.md`, `docs/SUGGESTIONS.md` | unclaimed | — | Each row needs an official source link or be flagged unverified |
| T4 | Site shell: landing page, navigation, shared styles, shared JS modules | `site/index.html`, `site/assets/**` | unclaimed | — | Shared outputs: nav + index are integration-owned |
| T5 | Live dashboard: price chart (x=time, y=price), time-unit/length selector, liquidity depth | `site/dashboard.html`, `site/assets/js/**` | unclaimed | — | |
| T6 | Portfolio + trade ledger + strategy analytics pages | `site/portfolio.html`, `site/assets/js/**` | unclaimed | — | |
| T7 | GitHub Pages workflow + deploy | `.github/workflows/**` | unclaimed | — | |
| T8 | Final integration: merge branches, re-verify, publish | all | unclaimed | — | Runs last |

### File-scope notes (conflict avoidance)

- `site/assets/js/**` is touched by T4, T5 and T6. **Only one session may own JS at a
  time.** If T5 and T6 are run in parallel, T5 owns `site/assets/js/chart*.js`,
  `site/assets/js/market*.js` and T6 owns `site/assets/js/portfolio*.js`,
  `site/assets/js/analytics*.js`. Do not edit a file owned by another session; log
  the request in the Log section below instead.
- `site/index.html` and the nav block are **shared outputs**. They are edited only
  by the final integration session (T8).
- `data/**` is owned by T2 only.
- `docs/**` files are split per file; do not edit another session's doc file.

## Rules

1. Claim → commit → push the claim before starting work.
2. `git pull --rebase` before every push.
3. Small, frequent commits.
4. Never mark anything "verified" without checking it against an official source
   and linking that source.
5. If a value cannot be confirmed from an official source, leave it blank and flag
   it as unverified. Never infer or fill in values.
6. On conflict: stop, resolve without discarding the other session's work, log it.
7. If a claim is more than 60 minutes old with no commits, another session may take
   over and must note the handoff in the Log.

## Log

| Date (UTC) | Session | Entry |
| --- | --- | --- |
| 2026-11-20 | `210dfcb8` | Session started. Repo contained only `README.md` (commit `6081bb7`). No Kalshi credentials present in the sandbox; demo REST/WS hosts are not reachable from the sandbox shell (only `fetch_page` egress works). Created this board and claimed T0. |

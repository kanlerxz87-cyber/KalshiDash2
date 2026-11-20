# COORDINATION.md — Shared Task Board

This is the shared task board for **all** agent sessions working on this repo.
Read it before starting work. Claim a task by writing your session ID + file scope
below, then **commit and push that claim immediately**.

Status meanings: `unclaimed` · `in progress` · `done` · `needs review`
(`needs review` = published on the Flagged for Review page; it does not block anything.)

Rules
- One session owns a task at a time. Never start a task another session has claimed.
- Keep scopes non-overlapping: a session edits only the files in its claimed scope.
- Each session works on its own branch named `session-<id>/<task>` (Arena sessions use
  `arena/<id>-kalshidash2`) and never pushes to another session's branch.
- If you need a change in a file owned by another session, log the request here instead.
- `git pull --rebase` before every push. Small, frequent commits.
- On a merge conflict: stop, resolve without discarding the other session's work, log it.
- A claim older than 60 minutes with no commits may be taken over; note the handoff.
- Shared outputs (table data, site index/navigation, Pages deploy) change only in a
  final integration session after the other tasks are done.
- Never mark anything verified without checking it against an official source and
  linking that source.

## Task board

| # | Task | Status | Owner session | Files touched | Sources / verification |
|---|------|--------|---------------|---------------|------------------------|
| 1 | Executive summary + repo review | **done (superseded by #9)** | 4b7b4e2f | EXECUTIVE_SUMMARY.md, README.md | docs.kalshi.com (2026-11-20) |
| 2 | Live dashboard (topics, graph, liquidity) | **done (superseded by #11)** | 4b7b4e2f | docs/dashboard.html, docs/assets/* | docs.kalshi.com API reference |
| 3 | Portfolio + trading (demo account) | **done (superseded by #12)** | 4b7b4e2f | docs/portfolio.html, docs/assets/app.js | docs.kalshi.com |
| 4 | Resolved-event tracking (yes/no) | **done (superseded by #13)** | 4b7b4e2f | docs/resolved.html | docs.kalshi.com |
| 5 | Trade analysis + strategy categorization | **done (superseded by #14)** | 4b7b4e2f | docs/analysis.html | derived from live fills only |
| 6 | Suggestions + open questions | **done (superseded by #15)** | 4b7b4e2f | docs/suggestions.html, docs/questions.html | — |
| 7 | Verification + Flagged for Review pages | **done (superseded by #16)** | 4b7b4e2f | docs/verification.html, docs/flagged.html | — |
| 8 | Pages deploy + PR to main | done | 4b7b4e2f | .github/workflows/pages.yml | PR #1, PR #2 merged; Pages built |
| 9 | **Repo review line by line + irregularity log** | in progress | **de240b66** | REPO_REVIEW.md, docs/review.html | official Kalshi OpenAPI/SDK |
| 10 | **Live data collector + provenance pipeline** | in progress | **de240b66** | scripts/*, .github/workflows/collect.yml | demo REST API live |
| 11 | **Dashboard rebuild (topics, chart windows, depth)** | in progress | **de240b66** | docs/dashboard.html, docs/assets/* | docs.kalshi.com |
| 12 | **Portfolio + trading rebuild (V2 order API)** | in progress | **de240b66** | docs/portfolio.html | Create Order V2 docs |
| 13 | **Resolved-event tracker rebuild (event-level)** | in progress | **de240b66** | docs/resolved.html | Get Events / Get Market docs |
| 14 | **Analysis + strategy engine rebuild** | in progress | **de240b66** | docs/analysis.html | derived from collected data only |
| 15 | **Suggestions + decision-gate questions rebuild** | in progress | **de240b66** | docs/suggestions.html, docs/questions.html | — |
| 16 | **Verification + Flagged rebuild (machine-checked)** | in progress | **de240b66** | docs/verification.html, docs/flagged.html, VERIFICATION.md | scripts/verify_site.py |
| 17 | **Final integration: PR to main + Pages deploy** | in progress | **de240b66** | .github/workflows/pages.yml, docs/index.html | this session |

## Claim record

- **2026-11-20 — session `de240b66`** claims tasks 9–17 above.
  Branch: `arena/de240b66-kalshidash2` (from `6081bb7`, fast-forwarded to `34bd4a8`).
  Scope: `REPO_REVIEW.md`, `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`,
  `VERIFICATION.md`, `README.md`, `COORDINATION.md`, `scripts/**`, `.github/workflows/**`,
  `docs/**`. No other session has claimed these files. Prior session `4b7b4e2f` has
  finished and merged its work (PR #1, PR #2); its files are taken over here because the
  earlier implementation was found to describe several API shapes incorrectly
  (see `REPO_REVIEW.md` findings R1–R12).

## Handoff / conflict log

- 2026-11-20: Session `4b7b4e2f` created this board (it did not exist). No conflicts.
- 2026-11-20: Session `de240b66` found the board, read it, and appended its claim.
  No conflict: session `4b7b4e2f` had already merged and was no longer holding claims.
- 2026-11-20: No merge conflicts encountered by `de240b66` (fast-forward merge of `main`).

## Final integration record

- Session `4b7b4e2f`: PR #1 merged, PR #2 merged. Pages `build_type: legacy`,
  source `main:/` — the deployed site served `README.md`, not the `docs/` site.
  Recorded as F7; **fixed in this session** by switching Pages to the GitHub Actions
  build type (see below).
- Session `de240b66`: PR #3 (see below) — integration of tasks 9–17.

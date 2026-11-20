# COORDINATION — KalshiDash2

Shared task board. Every session must read this before starting work, claim its tasks
by writing its session ID and file scope, commit + push the claim immediately, and
never start a task another live session has claimed.

- **Repo:** `kanlerxz87-cyber/KalshiDash2`
- **Default branch:** `main`
- **Site:** https://kanlerxz87-cyber.github.io/KalshiDash2/ (GitHub Pages, legacy build from `main` `/`)
- **Claim TTL:** a claim with no commit for 60 minutes may be taken over (log the handoff below).

## Session registry

| Session ID | Branch | Started (UTC) | Status |
| --- | --- | --- | --- |
| `arena-b7dfc4d9` | `arena/b7dfc4d9-kalshidash2` | 2026-11-20T11:05Z | active |

## Task board

| # | Task | Status | Owner | File scope |
| --- | --- | --- | --- | --- |
| T1 | Repo audit + coordination board | in progress | `arena-b7dfc4d9` | `COORDINATION.md` |
| T2 | Official source verification (API docs, endpoints, field shapes) | in progress | `arena-b7dfc4d9` | `docs/sources.md`, `docs/api-verification.md` |
| T3 | Live data capture pipeline (demo API snapshots w/ provenance) | unclaimed | — | `data/`, `.github/workflows/` |
| T4 | Static dashboard site (landing + category subpages) | unclaimed | — | `index.html`, `categories/`, `assets/` |
| T5 | Price chart (sec/min/hour windows) + orderbook depth | unclaimed | — | `assets/js/`, `market.html` |
| T6 | Portfolio + trade execution layer (demo account) | unclaimed | — | `portfolio.html`, `assets/js/trade.js`, `docs/trading.md` |
| T7 | Trade strategy analysis engine | unclaimed | — | `strategies.html`, `assets/js/strategy.js` |
| T8 | Suggestions + open-questions register | unclaimed | — | `suggestions.html`, `docs/open-questions.md` |
| T9 | Flagged-for-review register | unclaimed | — | `flagged.html`, `data/flagged.json` |
| T10 | Line-by-line verification pass + link checker | unclaimed | — | `tools/`, `reports/` |
| T11 | Final integration, PR to `main`, Pages deploy | unclaimed | — | `main`, `.github/workflows/` |

## Log

- `2026-11-20T11:05Z` `arena-b7dfc4d9` — Board created. Repo at base commit `6081bb7`
  contained only `README.md`. GitHub Pages is already enabled (`build_type: legacy`,
  source `main` `/`), URL `https://kanlerxz87-cyber.github.io/KalshiDash2/`.

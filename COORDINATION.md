# COORDINATION.md — Shared Task Board

Repo: `kanlerxz87-cyber/KalshiDash2`
This file is the single source of truth for who is doing what. Read it before
starting work. Claim a task by writing your session ID + file scope into the
table, then commit and push the claim immediately. Never start a task another
session has claimed.

**Session IDs seen on this board:** `4b7b4e2f` (first session — built the initial
site), `210dfcb8` (current session — review + hardening + live data), `64d89c6c`,
`b7dfc4d9` (other parallel sessions — probe/verify workflows).

## Status legend

| Status | Meaning |
| --- | --- |
| `unclaimed` | Nobody is working on it. |
| `in progress` | Claimed and actively being worked. |
| `done` | Completed, committed, pushed, verification recorded. |
| `needs review` | Published on the site's "Flagged for Review" page. Does **not** block anything. |

## Task board

| # | Task | Status | Owner session | Files touched | Sources / verification | Irregularities |
|---|------|--------|---------------|---------------|------------------------|----------------|
| 1 | Executive summary + repo review | done | `4b7b4e2f` | `EXECUTIVE_SUMMARY.md`, `README.md` | docs.kalshi.com (fetched 2026-11-20) | Sandbox shell cannot reach kalshi.co (outbound allowlist); browser-side fetch used instead |
| 2 | Live dashboard (topics, graph, liquidity) | done | `4b7b4e2f` | `docs/dashboard.html`, `docs/assets/*` | docs.kalshi.com API reference (markets, orderbook, candlesticks) | CORS from browser was unverified at the time — now verified by session `210dfcb8` (see log) |
| 3 | Portfolio + trading (demo account) | done | `4b7b4e2f` | `docs/portfolio.html`, `docs/assets/app.js` | docs.kalshi.com quick-start create-order + auth guide | Trading needs user API keys; no keys in repo — flagged |
| 4 | Resolved-event tracking (yes/no) | done | `4b7b4e2f` | `docs/resolved.html` | docs.kalshi.com market fields (`status`, `result`) | — |
| 5 | Trade analysis + strategy categorization | done | `4b7b4e2f` | `docs/analysis.html` | Derived only from live API fills when keys present; empty state otherwise | No fabricated trades |
| 6 | Suggestions + open questions sections | done | `4b7b4e2f` | `docs/suggestions.html`, `docs/questions.html`, `SUGGESTIONS.md`, `QUESTIONS.md` | — | — |
| 7 | Verification table + Flagged for Review page | done | `4b7b4e2f` | `docs/verification.html`, `docs/flagged.html`, `VERIFICATION.md` | Every row links an official source or is blank + "unverified" | See flagged page |
| 8 | GitHub Pages deploy + PR to main | done | `4b7b4e2f` | `.github/workflows/pages.yml`, `docs/*` | — | — |
| 9 | Merge boards / integrate prior session's work into `main` | done | `210dfcb8` | `COORDINATION.md` | — | Merge conflict on `COORDINATION.md` (add/add) resolved by keeping **both** boards; no other session's work discarded |
| 10 | API surface probe (CORS, category/tag vocabulary, endpoint shapes) | done | `210dfcb8` | `.github/workflows/probe.yml`, `data/probe/**` | Live calls to `https://external-api.demo.kalshi.co/trade-api/v2/*` | — |
| 11 | Review prior session's code line by line; flag irregularities | in progress | `210dfcb8` | `docs/**` | docs.kalshi.com API reference | — |
| 12 | Live data snapshot + topic taxonomy (gas/elections/culture/crypto/golf) | in progress | `210dfcb8` | `scripts/**`, `data/**` | Kalshi demo REST API | — |
| 13 | Harden dashboard: real chart (x=time, y=price, s/min/h selector), liquidity depth, resolution tracker | unclaimed | — | `docs/dashboard.html`, `docs/assets/**` | — | — |
| 14 | Harden portfolio/analysis: trade ledger, categorisation, strategy builder | unclaimed | — | `docs/portfolio.html`, `docs/analysis.html`, `docs/assets/**` | — | — |
| 15 | Final integration: re-verify every row, build check, publish to Pages | unclaimed | — | all | — | — |

### File-scope notes (conflict avoidance)

- `docs/assets/**` is shared JS/CSS. Only one session may own it at a time. Session
  `210dfcb8` currently owns `docs/assets/**` (tasks 11–13).
- `docs/index.html` + the nav block are shared outputs — edited only by the final
  integration session (task 15).
- `data/**` and `scripts/**` are owned by task 12 (`210dfcb8`).
- `docs/**` doc pages are split per file; do not edit another session's page.
- If a task requires changing a file owned by another session, log the request in
  the Log section below instead of editing it.

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
| 2026-11-20 | `4b7b4e2f` | Session started. Repo contained only `README.md` (commit `6081bb7`). Created this board, built the site, merged PR #1 and PR #2. |
| 2026-11-20 | `210dfcb8` | Session started. Repo had only `README.md`; created a second board (add/add conflict with `4b7b4e2f`'s board). Probe workflow added and run successfully against the live demo API. |
| 2026-11-20 | `210dfcb8` | **Merge conflict resolved** in `COORDINATION.md` (both sides were "add/add"). Resolution keeps session `4b7b4e2f`'s task table *and* session `210dfcb8`'s task table, renumbered into one board. Nothing from either session was discarded. |
| 2026-11-20 | `210dfcb8` | **Irregularity found — F8:** `origin/main` moved to `34bd4a8` (PR #1 + PR #2 from session `4b7b4e2f`) *after* this session branched from `6081bb7`. Sessions were working from different bases. Merged `origin/main` into the working branch to reconcile. |
| 2026-11-20 | `210dfcb8` | **Irregularity verified — F9:** the Pages API reports `build_type: legacy`, `source: {branch: main, path: /}`. F7 (raised by `4b7b4e2f`) asked a human to change the Pages source to "GitHub Actions". **Not required**: the live URL `https://kanlerxz87-cyber.github.io/KalshiDash2/` was fetched and serves `docs/index.html` correctly, because GitHub's legacy Jekyll build publishes the `docs/` folder at the site root. F7 to be downgraded to "verified working". |

## Final integration record — session `4b7b4e2f`

- PR #1 created from `arena/4b7b4e2f-kalshidash2` to `main` and **merged**:
  https://github.com/kanlerxz87-cyber/KalshiDash2/pull/1
- PR #2 created and **merged**:
  https://github.com/kanlerxz87-cyber/KalshiDash2/pull/2
- GitHub Pages deploy workflow run `44724644567`: **success**. Pages status:
  `built`, https://kanlerxz87-cyber.github.io/KalshiDash2/

### Review handoff — session `4a7a9a08` (2026-11-20)

This Arena branch initially loaded commit `6081bb7`; after the repository was fetched, `main` had already integrated sessions `4b7b4e2f` and `210dfcb8` (PRs #1–#3). To avoid duplicating or overwriting the claimed site work, this session discarded its parallel prototype, fast-forwarded to `c1b1891`, and is recording review requests only. The task-11 owner (`210dfcb8`) owns `docs/**`; no files in that scope were edited here. `gh api repos/kanlerxz87-cyber/KalshiDash2/pages` returned `status: built`, public URL `https://kanlerxz87-cyber.github.io/KalshiDash2/`, `build_type: legacy`, `source: main:/`; the task-11 log records a live-page check that the `docs/` content is served. Latest observed Pages workflow run after PR #3 (`44725317857`) completed successfully.

Requests for the active line-by-line review (please correct or explicitly flag on the site; findings checked against the linked official Kalshi docs):

1. **Dollar ranking label does not match its inputs.** `docs/assets/app.js::rankByDollars` sorts `open_interest_fp` and `volume_fp` and the page calls these “highest-dollar” markets. The official market schema defines `volume_24h_fp` as volume in contracts and `open_interest_fp` as a number of contracts, not dollars. Please relabel the ranking as contract-count volume/open interest, or use only a verified official dollar-valued field and describe exactly what it measures; do not call the current sort a dollar ranking. Sources: [Get Market](https://docs.kalshi.com/api-reference/market/get-market), [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Market Ticker WebSocket](https://docs.kalshi.com/websockets/market-ticker).
2. **Candlestick response parser appears inconsistent with its endpoint.** The dashboard requests `/markets/candlesticks?market_tickers=...` (the batch endpoint) but reads `j.candlesticks`; the documented batch response is grouped under `markets[]`, each containing its own `candlesticks[]`. The candle fields are nested (e.g. `price.close_dollars`, `yes_bid.close_dollars`, `yes_ask.close_dollars`), not the `yes_close_dollars` field read by the dashboard. Please validate the seconds/minutes/hours chart against the correct response shape and retain blank values for absent prices. Sources: [Batch Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks), [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks).
3. **Market list pagination can silently omit entries.** `fetchTopicMarkets` requests one page (`limit=200`) for each series and does not follow the returned cursor; `fetchSeries` stops when 1,000 entries have been accumulated without surfacing whether a cursor remains. Please paginate until exhaustion or show a clear partial-coverage flag. Source: [Kalshi Understanding Pagination](https://docs.kalshi.com/getting_started/pagination) and [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list).
4. **Flagged-table source links are incomplete.** F4 points to “Live `/series` data” without a clickable official URL, and F5/F6 show `—` rather than a source link. Please add official references for series discovery, candlestick history, and fills/settlements (or clearly mark the evidence unavailable while still linking the relevant endpoint documentation). Sources: [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list), [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks), [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills), [Get Settlements](https://docs.kalshi.com/api-reference/portfolio/get-settlements).
5. **Generated bytecode in the repository.** PR #3 added `scripts/__pycache__/collect.cpython-311.pyc`. This compiled artifact should generally be removed from source control and excluded via ignore rules; request to task-12 owner (`210dfcb8`), who owns `scripts/**`.

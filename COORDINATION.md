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
| 16 | Reconcile stale Arena branch with active main work; retire duplicate root-site prototype | done | `arena/e000cb69-kalshidash2` | `COORDINATION.md`, temporary root `index.html`, `styles.css`, `app.js`, `README.md` | Existing main Pages/site work verified via GitHub API; duplicate prototype not merged | Branch started from `6081bb7` while main advanced through other sessions; PR #5 closed after conflict and overlap detected |

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
| 2026-11-20 | `arena/e000cb69-kalshidash2` | Started from the session snapshot at `6081bb7` before main's parallel-session changes were present locally. A separate root-level prototype and PR #5 were created, then stopped when `origin/main` revealed the existing Pages site and active file claims. Merged `origin/main` into this branch; resolved add/add `COORDINATION.md` and README conflicts by retaining the integrated main board and README, preserving all main files, removing only this branch's duplicate root prototype, and logging the handoff as task 16. Closed redundant/conflicting PR #5. Existing docs site and main workflow were not edited. The required pre-push `git pull --rebase` also conflicted while replaying a `COORDINATION.md` add/add; it was safely aborted, preserving the merge and every main commit. Local history was verified as 0 commits behind and 19 ahead of the session branch before pushing the fast-forward update. |

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
| 2026-11-20 | `4a7a9a08` | Coordination-only official-source QA handoff merged as [PR #4](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/4) (merge commit `ea174d1`). GitHub Pages run `44725726234` completed successfully; Pages API status returned `built` at `https://kanlerxz87-cyber.github.io/KalshiDash2/`. This PR changed no site assets; see review requests above. |

---

# Session `b7dfc4d9` — verification + rebuild (2026-11-20)

Branch: `arena/b7dfc4d9-kalshidash2` (base `6081bb7`).
**This section is appended only.** The board above is preserved unchanged, so
concurrent sessions merge cleanly instead of fighting over one table.

## Claim

| # | Task | Status | Owner | File scope |
|---|------|--------|-------|-----------|
| B1 | Capture official API facts required by the brief (CORS, taxonomy, candlestick limits, order routes, settled results) | done | `b7dfc4d9` | `reports/**`, `tools/verify/**`, `.github/workflows/verify-facts.yml` |
| B2 | Line-by-line audit of the published `docs/` site against official docs | done | `b7dfc4d9` | none (read-only) |
| B3 | Corrected site built on the same facts (overview, 5 category pages, event, resolved, portfolio, strategies, suggestions, questions, verification, flagged) | done | `b7dfc4d9` | `site/**` |
| B4 | Deterministic signing-rule self-test (6 checks) | done | `b7dfc4d9` | `tools/verify/auth-sign-test.mjs`, `site/tools/` |
| B5 | Runtime + link verification of all 15 pages | done | `b7dfc4d9` | `site/**` |
| B6 | PR + merge + Pages deploy | in progress | `b7dfc4d9` | `README.md`, `COORDINATION.md` |

Scope note: this session touched **no** file under `docs/**`, `scripts/**` or
`data/**`. It shipped to a new `site/` tree and rewrote the root `README.md`
(claimed by no active session) to describe it.

## Sources used

| Claim area | Official source |
| --- | --- |
| Demo endpoints, mock funds, separate credentials | https://docs.kalshi.com/getting_started/demo_env |
| Public market data needs no auth | https://docs.kalshi.com/getting_started/quick_start_market_data |
| CORS behaviour | observed live; captured in `reports/verify-facts-v3.md` |
| Candlestick intervals 1/60/1440 min, 5,000-period cap | https://docs.kalshi.com/api-reference/market/get-market-candlesticks |
| Order book returns bids only; implied ask = 1 − NO bid | https://docs.kalshi.com/getting_started/orderbook_responses |
| Price grids (`price_ranges`) are per market | https://docs.kalshi.com/getting_started/fixed_point_migration |
| V2 order route; legacy route returns 410 | https://docs.kalshi.com/api-reference/orders/create-order-v2 |
| `bid` ≡ yes, `ask` ≡ no | https://docs.kalshi.com/getting_started/order_direction |
| Request signing text, RSA-PSS/Ed25519, 30s clock | https://docs.kalshi.com/getting_started/api_keys |
| Balance/fills/positions endpoints | https://docs.kalshi.com/api-reference/portfolio/get-balance, `.../get-fills`, `.../get-positions` |
| Rate limits and buckets | https://docs.kalshi.com/getting_started/rate_limits |
| WebSocket handshake requires signed headers | https://docs.kalshi.com/getting_started/quick_start_websockets |
| Market settlement and `result` semantics | https://docs.kalshi.com/getting_started/market_settlement |

## Verification performed

1. **Live API captures** (GitHub Actions runners, because the build sandbox cannot open
   TLS to Kalshi hosts). Raw output committed: `reports/verify-facts-raw.md`,
   `reports/verify-facts-v2.md`, `reports/verify-facts-v3.md`. Key results:
   CORS echoes `https://kanlerxz87-cyber.github.io` on 9 endpoints; `period_interval=5`
   → HTTP 400; `POST /portfolio/orders` → HTTP 410 `deprecated_v1_order_endpoint`;
   `POST /portfolio/events/orders` → HTTP 401 (route exists); settled sample = 82 yes / 118 no,
   none blank; event categories enumerated (Elections 740, Sports 71, Economics 61, …).
2. **Signing self-test**: `node tools/verify/auth-sign-test.mjs` → 6/6 passed. Proves a
   private key imported as `spki` is rejected and that a suffix-only signed path fails.
3. **Static checks**: every local `href`/`src` resolved (no broken links); ESLint
   `no-undef` over all ES modules and all inline module scripts → 0 errors.
4. **Runtime checks**: all 15 pages executed against a simulated DOM with live-shaped
   fixtures — 0 module errors; the overview board, all five category boards, the claim
   register (49 rows), the flag register, the question register (14) and the decision
   board (12) all render, and the filter controls work.
5. **Not verified**: any end-to-end authenticated flow, because no demo API key exists
   for this build. Recorded as F1/F2 on the Flagged page; no performance claim is made.

## Irregularities found (details on `site/flagged.html`)

| ID | Finding |
| --- | --- |
| F6 | **`docs/assets/app.js` could never authenticate.** It imports the private key with `subtle.importKey("spki", …)` (a private key is PKCS#8) and signs `ts + METHOD + "/portfolio/balance"` without the `/trade-api/v2` prefix. Both are rejected per the official signing rules; the self-test proves it. Fix: `site/assets/js/kalshi.js`. |
| F7 | **`docs/portfolio.html` mislabels sides.** The option `"Sell Yes (ask)"` sends `side: "ask"`, which per the documented table is *buy NO*. A user would open the opposite position. Fix: the new form asks buying YES / buying NO. |
| F8 | **`docs/assets/app.js` topic matching is unsound.** Keyword-matching the full `/series` catalogue (16,643 rows) matched "gas" → `KXNBALASVEGAS` and "golf" → `KXTRUMPGOLFD`, and gas has no Kalshi category at all. Fix: category-based mapping with explicit gas/golf exception lists plus honest empty states. |
| F9 | **The brief's "seconds" chart axis has no data source.** Kalshi publishes no seconds-resolution history (intervals are 1/60/1440 *minutes*). Mitigated: ≤5 min windows are accumulated live samples, labelled as such; longer windows use real candlesticks. |
| F10 | **Browser WebSocket streaming unconfirmed** — the handshake needs headers a browser `WebSocket` cannot set. Polling used instead; flagged. |
| F11 | **Seven sessions wrote concurrently**; `main` advanced several times mid-session. This session stayed inside `site/**` and did not edit any claimed file. |

## Handoff / conflict log

- `2026-11-20T11:05Z` — Board created on this branch. Base commit `6081bb7` contained only `README.md`.
- `2026-11-20T11:10Z` — Observed `main` advance `6081bb7 → d7c17dd → c1b1891 → a38491a` from other
  sessions (PRs #1–#8). `git pull --rebase origin main` produced add/add conflicts only in
  `COORDINATION.md` and `docs/flagged.html`. Not forced: the conflicting commits are this
  session's own board scaffolding, and `docs/**` belongs to another session. Work continued on
  the session branch with an appended board section instead.
- `2026-11-20T11:12Z` — Reviewed open PR #9 (`arena/ae228af4`, competing `docs/` site). Its signing
  implementation is **correct** (PKCS#8 import, full path signed); its content overlaps this
  session's scope and it omits the root-level site. Recorded, not merged by this session.

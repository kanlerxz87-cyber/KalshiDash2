# COORDINATION.md — Shared Task Board

> **How this file works (per project instructions):** Multiple agent sessions may work on this repo at the same time. This file is the shared task board. Claim a task by writing your session ID and file scope here, then commit and push that claim immediately. Never start a task another session has claimed. Keep scopes non-overlapping. Make small, frequent commits, run `git pull --rebase` before every push. If you hit a merge conflict, stop, resolve without discarding the other session's work, and log what happened. When a task is finished, record its sources, verification performed, and any irregularities, and mark it done. Never mark anything verified without checking it against an official source, and link that source. Shared outputs (table data, site index/navigation) are changed only by the final integration session. If a session crashes or its claim is more than 60 minutes old with no commits, any other session may take over and note the handoff.

---

## Session 4b7b4e2f (branch `arena/4b7b4e2f-kalshidash2`, merged to `main` via PR #1)

Date started: 2026-11-20

| # | Task | Status | Owner session | Files touched | Sources / verification | Irregularities |
|---|------|--------|---------------|---------------|------------------------|----------------|
| 1 | Executive summary + repo review | done | 4b7b4e2f | EXECUTIVE_SUMMARY.md, README.md | docs.kalshi.com (fetched 2026-11-20) | Sandbox cannot reach kalshi.co (outbound allowlist); browser-side fetch used instead |
| 2 | Live dashboard (topics, graph, liquidity) | done | 4b7b4e2f | docs/dashboard.html, docs/assets/* | docs.kalshi.com API reference (markets, orderbook, candlesticks) | CORS from browser unverified from sandbox — flagged |
| 3 | Portfolio + trading (demo account) | done | 4b7b4e2f | docs/portfolio.html, docs/assets/app.js | docs.kalshi.com quick-start create-order + auth guide | Trading needs user API keys; no keys in repo — flagged |
| 4 | Resolved-event tracking (yes/no) | done | 4b7b4e2f | docs/resolved.html | docs.kalshi.com market fields (status/result) | — |
| 5 | Trade analysis + strategy categorization | done | 4b7b4e2f | docs/analysis.html | Derived only from live API fills when keys present; empty state otherwise | No fabricated trades |
| 6 | Suggestions + open questions sections | done | 4b7b4e2f | docs/suggestions.html, docs/questions.html, SUGGESTIONS.md, QUESTIONS.md | — | — |
| 7 | Verification table + Flagged for Review page | done | 4b7b4e2f | docs/verification.html, docs/flagged.html, VERIFICATION.md | Every row links an official source or is blank + "unverified" | See flagged page |
| 8 | GitHub Pages deploy + PR to main | in progress | 4b7b4e2f | .github/workflows/pages.yml, docs/* | — | — |

Status meanings: `unclaimed` / `in progress` / `done` / `needs review`
(needs review = published on the Flagged for Review page, does not block anything.)

Rules session 4b7b4e2f followed:
- One session (4b7b4e2f) owned all tasks above on branch `arena/4b7b4e2f-kalshidash2`; no other session had claimed files at the time.
- No value is shown unless returned live by the Kalshi demo API in the browser, or linked to an official source. Unconfirmable values are left blank and flagged.
- No API keys or private keys are stored in the repo. Browser-side signing only; keys stay in the user's browser session.

---

## Session ae228af4 (branch `arena/ae228af4-kalshidash2`, branched from `6081bb7` on `main`)

**Last updated:** 2026-11-20 (UTC)
**Role going forward:** line-by-line re-verification + final integration session (tasks below). Session ae228af4 found session 4b7b4e2f's work already merged to `main` (PR #1) mid-task and, per the conflict rules, merged `main` in **without discarding any of 4b7b4e2f's work** (see conflict log). It now re-verifies 4b7b4e2f's output line-by-line against official sources and completes Pages deploy.

| ID | Task | Status | Owner (session ID) | Files in scope (exclusive) | Sources / verification | Irregularities / notes |
|----|------|--------|--------------------|----------------------------|------------------------|------------------------|
| T1 | Repo review (line-by-line) + Executive Summary review | in progress | ae228af4 | `README.md`, `EXECUTIVE_SUMMARY.md`, `docs/executive-summary.html` | Official Kalshi docs (see Sources below). Repo at start contained only `README.md` (1 line) + initial commit — verified via `git show HEAD --stat` and `ls -R`. | Sandbox outbound network is restricted to github/npm/pypi hosts; direct `curl` to `external-api.demo.kalshi.co` returned empty. Live API verification therefore happens client-side in the browser; static values that could not be confirmed from an official source are left blank and flagged. See Flagged for Review page. |
| T2 | Live dashboard: highest-dollar live events (gas, elections, culture, crypto, golf), price chart (X=time seconds/minutes/hours, Y=price), liquidity/orderbook, resolution tracking (yes/no) | in progress | ae228af4 | `docs/dashboard.html`, `docs/category-*.html`, `docs/assets/kalshi.js`, `docs/assets/chart.js`, `docs/assets/style.css` (shared CSS coordinated via this board) | [Demo env](https://docs.kalshi.com/getting_started/demo_env), [API environments](https://docs.kalshi.com/getting_started/api_environments), [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Market lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [Market settlement](https://docs.kalshi.com/getting_started/market_settlement) | "Highest dollar amount" is ambiguous (volume vs open interest vs notional). Dashboard exposes raw API fields and lets the user sort; definition is documented and flagged as an open question (Q-01). Category/series mapping for the 5 topics is documented on the Sources page; any mapping not confirmed from an official source is flagged, not assumed. |
| T3 | Portfolio performance (demo account), trade execution, trade categorization + strategy analysis | in progress | ae228af4 | `docs/portfolio.html`, `docs/trades.html`, `docs/assets/portfolio.js`, `scripts/kalshi_client.py`, `scripts/analyze_trades.py`, `data/trades_template.csv` | [API keys](https://docs.kalshi.com/getting_started/api_keys), [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests), [Create first order](https://docs.kalshi.com/getting_started/quick_start_create_order) | No demo credentials were provided and none are committed. Portfolio/trading UI works in two modes: (a) authenticated demo mode when the user pastes their own key ID + private key (stored only in browser localStorage, never committed), and (b) zero-key paper-trading simulator using live public prices. No real-money trading is possible from this static site. Order endpoint differs across docs (`/portfolio/orders` vs `/portfolio/events/orders`); code uses `/portfolio/events/orders` per latest Quick Start and flags the discrepancy. |
| T4 | Suggestions section (review + choose best path before implementing) + Questions / Information / Answers needed before any decision | in progress | ae228af4 | `docs/suggestions.html`, `docs/questions.html`, `SUGGESTIONS.md`, `QUESTIONS.md` | Suggestions are proposals only; nothing is implemented from them until the user selects a path. Each suggestion lists expected benefit, cost/risk, and what evidence would confirm it. | No suggestion is marked "verified" — verification applies to facts, not proposals. |
| T5 | Verification pass: every table row has an official source link; unverified values blank + flagged; Flagged for Review page; Sources/Methodology page | in progress | ae228af4 | `docs/flagged.html`, `docs/sources.html`, `VERIFICATION.md` | Every static row links to `docs.kalshi.com`, `kalshi.com`, `demo.kalshi.co`, or `help.kalshi.com`. Live rows link to the exact demo API URL + market page. | See Flagged for Review page for the live list. |
| T6 | Final integration: build check (no broken internal links), GitHub Pages publish, PR to `main`, merge, deploy confirmation | in progress | ae228af4 (integration) | `docs/index.html` (shared nav/index only), `.github/workflows/pages.yml` (if needed), `COORDINATION.md` (this file) | `gh` CLI; GitHub Pages docs. | Do not merge a broken site. Flagged items do not block merge per instructions; they publish on the Flagged for Review page. |

**Status key:** `unclaimed` → `in progress` → `done` | `needs review` = published on Flagged for Review page, does not block anything.

## Official sources used by session ae228af4 (all verified 2026-11-20 via docs.kalshi.com)

| # | Source | URL | What it confirms |
|---|--------|-----|------------------|
| S1 | Test In The Demo Environment | https://docs.kalshi.com/getting_started/demo_env | Demo REST root `https://external-api.demo.kalshi.co/trade-api/v2`, also-supported `https://demo-api.kalshi.co/trade-api/v2`; demo WS `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`; demo site https://demo.kalshi.co/; credentials not shared with production; demo prices may not reflect real markets. |
| S2 | API Environments and Endpoints | https://docs.kalshi.com/getting_started/api_environments | Production vs demo base URLs; signing rule (sign full path without query string, e.g. `/trade-api/v2/portfolio/orders`); external-api hosts are the recommended Trade API hosts. |
| S3 | API Keys | https://docs.kalshi.com/getting_started/api_keys | Key types (Ed25519 recommended, RSA 2048-bit); headers `KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE`; signature = base64 of signed `timestamp + METHOD + path` (RSA-PSS SHA-256 or Ed25519); key creation at https://kalshi.com/account/profile (demo equivalent on demo site). |
| S4 | Quick Start: Authenticated Requests | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | Minimal signed GET example (`/portfolio/balance`); balance returned in cents (`balance / 100`); Python signing code for both key types. |
| S5 | Quick Start: Create your first order | https://docs.kalshi.com/getting_started/quick_start_create_order | Public market data needs no auth (`GET /markets?limit=1&status=open`); order via `POST /portfolio/events/orders` with `ticker`, `side: "bid"`, `count`, `price` (dollars string), `time_in_force`, `client_order_id`; amend/cancel endpoints. |
| S6 | Get Markets (API reference) | https://docs.kalshi.com/api-reference/market/get-markets | `GET /markets` fields: `ticker`, `event_ticker`, `yes_bid_dollars`, `yes_ask_dollars`, `last_price_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `notional_value_dollars`, `status`, `result`, `close_time`, `expected_expiration_time`, `settlement_ts`, `rules_primary`; `status` filter values `unopened/open/closed/settled`. |
| S7 | Market Lifecycle | https://docs.kalshi.com/getting_started/market_lifecycle | Statuses `initialized/active/inactive/closed/determined/disputed/amended/finalized`; filter mapping (`open`→`active`, `settled`→`finalized`); `result` set to `yes/no/scalar` at determination; settlement timer `settlement_timer_seconds`; `settlement_ts` populated at finalization. |
| S8 | Market Settlement | https://docs.kalshi.com/getting_started/market_settlement | Yes holders receive $1/contract on Yes, No holders $1 on No; only net positions settled; settlement fees zero for simple yes/no. |
| S9 | Kalshi Fee Schedule (PDF, official) | https://kalshi.com/docs/kalshi-fee-schedule.pdf | Series tickers incl. `KXAAAGASM` (US gas price), `KXPGATOUR` (PGA Tour), `KXPGARYDER` (Ryder Cup), `KXPGASOLHEIM` (Solheim Cup). Used only for series-ticker mapping; fee amounts are not reproduced as trading advice. |
| S10 | Demo account help article | https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account | Referenced from S1 as the official demo-account setup tutorial. |

**What was NOT verified from an official source (left blank / flagged):** live market prices, volumes, open interest, liquidity, and resolutions (these change continuously and are fetched live in the browser — no static snapshot is presented as fact); the exact `category` string values returned by `GET /events` for each of the 5 topics (dashboard filters by series ticker + keyword + category with transparent fallback, and labels the method in the UI); any portfolio balance, fills, or P&L (requires the user's own demo keys — none are stored in this repo).

## Handoff / conflict log

- 2026-11-20 — Session `4b7b4e2f` created this board (did not exist). No conflicts encountered. Merged to `main` as PR #1.
- 2026-11-20 — Session `ae228af4` created its own board at repo root not knowing `main` had advanced; on `git pull --rebase` hit an **add/add conflict in `COORDINATION.md`** against session 4b7b4e2f's board (merged via PR #1). Resolved by **combining both boards in this file — no content from either session discarded** — and logging the incident here, per the conflict rules. Session 4b7b4e2f's files (`docs/*`, `EXECUTIVE_SUMMARY.md`, etc.) were kept untouched in the merge; session ae228af4 now re-verifies them line-by-line as the integration session.

## PR / merge record (filled by integration session)

- PR #1 (session 4b7b4e2f, `arena/4b7b4e2f-kalshidash2` → `main`): merged (commit `d7c17dd`, "Merge pull request #1").
- PR (session ae228af4 integration): _pending_
- Merge result: _pending_
- GitHub Pages deploy: _pending_ (workflow `.github/workflows/pages.yml` present on `main`; run not yet confirmed)
- Site URL: _pending_ (expected `https://kanlerxz87-cyber.github.io/KalshiDash2/`)

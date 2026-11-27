# Verification & Runtime Hygiene Report — Session `3e859f7c` (2026-11-27)

- **Branch:** `arena/3e859f7c-kalshidash2`
- **Rebased base on `main`:** `54c3ca1` (after PRs `#151`, `#152`, `#156` merged — zero merge conflicts)
- **Live site:** <https://kanlerxz87-cyber.github.io/KalshiDash2/>
- **Live demo API host verified:** `https://external-api.demo.kalshi.co/trade-api/v2`
- **Official docs index:** <https://docs.kalshi.com/llms.txt>

---

## 1. Scope & Coordination Discipline

All edits in this session were restricted to unclaimed files with **zero overlap** against active parallel PRs (`#141`, `#147`, `#151`, `#152`, `#153`, `#154`, `#156`, `#157`):

- **Modified code & pages:** `assets/js/market.js`, `assets/js/category.js`, `assets/js/sources.js`, `portfolio.html`, `event.html`, `resolved.html`, `questions.html`, `suggestions.html`
- **Regression tests added:** `tests/result-semantics.test.mjs`, `tests/portfolio-page.test.mjs`, `tests/dom/category-dom.mjs`
- **Documentation & coordination:** `reports/verify-3e859f7c.md` (this file), `COORDINATION.md`

No live market prices, volumes, balances, or fill records are transcribed into static pages or registers. No authenticated call was executed and no demo order was placed (`F1` / `F2` remain open).

---

## 2. Official Documentation & Live Demo API Verification (2026-11-27)

Fifteen official `docs.kalshi.com` `.md` specification pages that were previously recorded in `assets/js/sources.js` as `verified: "index"` (URL matched in `llms.txt` only) were fetched and read verbatim on 2026-11-27 and elevated to `verified: "fetched"` (`29/49` fetched, `20/49` index, `0` unverified):

| Register entry | Official URL (fetched `.md` 2026-11-27) | Key contract verified against codebase |
|---|---|---|
| API Environments and Endpoints | <https://docs.kalshi.com/getting_started/api_environments> | Recommended demo REST (`external-api.demo.kalshi.co/trade-api/v2`) and WS (`external-api-ws.demo.kalshi.co/trade-api/ws/v2`); path signing independent of host |
| API Keys | <https://docs.kalshi.com/getting_started/api_keys> | Ed25519 + RSA-PSS/SHA-256 (salt = digest length), 30s clock tolerance, PKCS#8 PEM header ambiguity, `timestamp + METHOD + path` without query string |
| Order direction (`outcome_side` / `book_side`) | <https://docs.kalshi.com/getting_started/order_direction> | `bid ≡ yes`, `ask ≡ no`; `taker_outcome_side` / `taker_book_side` on public trades; matching at same price `p` |
| Orderbook Responses | <https://docs.kalshi.com/getting_started/orderbook_responses> | `orderbook_fp.yes_dollars` / `no_dollars` return ascending bids only; reciprocal `YES ask = 1 − NO bid`; unknown/empty tickers answer 200 with empty arrays |
| Create Order (V2) | <https://docs.kalshi.com/api-reference/orders/create-order-v2> | `POST /portfolio/events/orders` required fields (`ticker`, `side`, `count`, `price`, `time_in_force`, `self_trade_prevention_type`); YES-leg quoting (`Selling YES is economically equivalent to buying NO at 1 - price`); legacy `/portfolio/orders` returns `410 deprecated_v1_order_endpoint`; 201 = accepted (check `remaining_count`) |
| Cancel Order (V2) | <https://docs.kalshi.com/api-reference/orders/cancel-order-v2> | `DELETE /portfolio/events/orders/{order_id}` requires `market_ticker` for auto-routing; wrong-shard cancel answers 404 while leaving order resting |
| Get Orders | <https://docs.kalshi.com/api-reference/orders/get-orders> | `limit` 1–1000 (default 100); `status` in `resting`/`canceled`/`executed`; pre-cutoff orders move to `GET /historical/orders` |
| Get Balance | <https://docs.kalshi.com/api-reference/portfolio/get-balance> | `balance` (cents), `balance_dollars` (fixed-point string), `portfolio_value` (cents), `updated_ts`, optional `balance_breakdown`; dedicated bucket (1/s Basic/Advanced, 5/s higher) |
| Get Positions | <https://docs.kalshi.com/api-reference/portfolio/get-positions> | `limit` 1–1000 (default 100); `settlement_status` defaults to `unsettled` (`settled`, `all`); archived settled positions on `GET /historical/positions` |
| Get Settlements | <https://docs.kalshi.com/api-reference/portfolio/get-settlements> | Live-tier only; `market_result` enum `yes` / `no` / `scalar` / `""`; `revenue` in cents; `fee_cost` in dollars |
| Rate Limits and Tiers | <https://docs.kalshi.com/getting_started/rate_limits> | Separate Read, per-shard Write, Balance, and Transfer buckets; `429` carries `X-RateLimit-*` without `Retry-After`; unauthenticated limits unpublished (`F3`) |
| Historical Data | <https://docs.kalshi.com/getting_started/historical_data> | Live vs historical tier partitioning for markets, candlesticks, trades, orders, positions; events & series stay on original endpoints |
| Get Historical Cutoff Timestamps | <https://docs.kalshi.com/api-reference/historical/get-historical-cutoff-timestamps> | Publishes `market_settled_ts`, `trades_created_ts`, `orders_updated_ts`, `market_positions_last_updated_ts` |
| Exchange Sharding | <https://docs.kalshi.com/getting_started/exchange_sharding> | Shard assignments (0 default, 1 Exotics/Combos, 2 Crypto/Commodities, 3 Sports tags), `market_ticker` auto-routing requirement, wrong-shard 404 |
| Get Exchange Status | <https://docs.kalshi.com/api-reference/exchange/get-exchange-status> | Top-level flags describe shard 0 only; `exchange_index_statuses` lists per-shard status; read flags only from HTTP 200; single non-0 `false` can indicate timeout and should be re-read (`F18`) |

Additional official docs re-read verbatim during this audit: `getting_started/demo_env`, `api-reference/events/get-event.md`, `api-reference/portfolio/get-fills.md`.

### Live Demo API Structural Spot-Checks (2026-11-27, unauthenticated)

- `GET /exchange/status` → HTTP 200; returned top-level shard-0 booleans plus 4 `exchange_index_statuses` entries (shards 0–3, with shard 3 carrying an empty description string).
- `GET /historical/cutoff` → HTTP 200; returned all four documented cutoff timestamp fields (`market_settled_ts`, `trades_created_ts`, `orders_updated_ts`, `market_positions_last_updated_ts`).
- `GET /series/KXDPWORLDTOURR2LEAD` → HTTP 200; returned `category: "Sports"`, `categories: ["Sports"]`, `tags: ["Golf"]`, confirming the tag-based Golf matching fixed in PR #143.
- `GET /events?status=open&series_ticker=KXAAAGASW&with_nested_markets=true` and `GET /events/KXAAAGASW-26NOV30?with_nested_markets=true` → HTTP 200; confirmed `event.markets` nesting, `status: "active"`, `price_ranges`, `volume_fp`, `open_interest_fp`, and `last_price_dollars` shapes.

---

## 3. Defects Found and Fixed in This Session

1. **`assets/js/market.js` — `isSettledMarket()` omitted `"scalar"`:**
   `Get Market` and `Get Settlements` document `result` as `yes | no | scalar | ""`, and `marketResultState` / `applyMarketToWatchEntry` already handled `"scalar"`. `isSettledMarket()` checked only `"yes"` and `"no"`, so a scalar-settled market without a terminal `status` or past `close_time` would not qualify for the historical candlestick fallback. Fixed and pinned in `tests/result-semantics.test.mjs`.
2. **`assets/js/market.js` — `analyseFills()` silently priced unsided fills at `yes_price_dollars`:**
   Previously `const price = side === "no" ? noPrice : yesPrice;` assigned `yesPrice` when `outcome_side` and `side` were both absent (`null`), inflating premium totals instead of leaving `price`/`cost` `null` and incrementing `totals.missingPrice`. Fixed to require an explicit `"yes"` or `"no"` side (case-insensitive) and pinned in `tests/result-semantics.test.mjs`.
3. **`assets/js/market.js` — `fetchCandles()` `source` URLs skipped `encodeURIComponent`:**
   Added `encodeURIComponent` to `series` and `market.ticker` in returned `source` URLs to match the request URL builders.
4. **`assets/js/category.js` — `renderJumps()` settlement-source escaping, hardcoded host, and jump basis prose:**
   - `ctx.sources` links interpolated `s.url` without `esc(s.url)` and emitted empty/unsafe `<a href="">` when a settlement source carried only `name` or a non-`http(s)` URL. Fixed to allow only `^https?://` links with `esc(s.url)` and render plain `<span>` otherwise (and applied the same `http(s)` guard in `sourcesLine()`). Pinned in `tests/dom/category-dom.mjs`.
   - Replaced hardcoded `https://external-api.demo.kalshi.co/trade-api/v2/markets/...` with `${DEMO.rest}/markets/...` and linked `SOURCES.getEvent` for single-event settlement sources.
   - Updated the jump table footnote so it accurately describes `detectJumps()` (compares each candle close against its `price.previous_dollars` when present, else the prior priced candle close).
5. **`portfolio.html` — `Forget key` left fills/order state on screen and unguarded against late `fills()` responses:**
   - Clicking `#clear-key` now clears `#fills-body`, `#fills-status`, `#order-result`, `#order-status`, `window.__fills`, and restores `#key-detail`.
   - `loadFills()` now checks `accountRequest` after `await api.fills()` so an in-flight fills request cannot repopulate `#fills-body` or write `localStorage` after forgetting the key. Pinned in `tests/portfolio-page.test.mjs`.
   - `#o-price` snap handler now replaces its previous snap warning instead of appending duplicate notices on every edit, and escapes `g.value` / `g.step`.
6. **`event.html` & `resolved.html` — `null` `expiration_value` and `GetEventResponse` markets fallback:**
   - Updated `expiration_value` check from `=== "" || === undefined` to `== null || === ""` on both pages so JSON `null` renders `n/a` instead of an empty cell.
   - Added `ev.markets || j.markets || []` fallback in `event.html` matching the `Get Event` schema and consolidated the duplicate `config.js` import.
7. **`questions.html` & `suggestions.html` — stale prose reconciled:**
   - `questions.html`: updated `Q2` (Golf `series.tags` matching from PR #143), `Q13` (live `verify-live-site` / `live-site-render` workflows against GitHub Pages), and `Q15` (candle jump basis matching `detectJumps()`).
   - `suggestions.html`: updated `S8` to describe the active `COORDINATION.md` exclusive-scope + rebased PR workflow rather than the retired single integration branch wording.
8. **`assets/js/sources.js` — source register elevation:**
   - Elevated 15 verbatim-read official `.md` docs from `verified: "index"` to `verified: "fetched"` (`29/49` fetched, `0` unverified).

---

## 4. Cross-Scope Findings Logged for Follow-Up (Not Edited Here)

Verified directly against `origin/main` after PRs `#151` and `#152` merged; kept out of this PR to respect file ownership boundaries:

1. **`index.html`:** Line 395 computes the `Resolved` KPI over `state.events` (all scanned exchange topics) while the other three KPI cards (`Events in scope`, `Volume × price proxy`, `Open now`) aggregate `allRanked` (five tracked topics only); `#mover-note` similarly cites `state.events.length` while `movers` iterates over `allRanked`.
2. **`flagged.html`:** An unclosed `<div class="card">` nests the following `<div class="card">` (currently around line 1819); `#DR2` (fixed in PR #139 `090d84f`) and `#F19` (fixed in PR #143 `a4c24b8`) still carry `open` tags; `#F7` is fixed in the published root `portfolio.html` (the old label remains only in retired `docs/portfolio.html:21`).
3. **`assets/js/claims.js`:** Two mismatched `flag` cross-references: `"Prior site's order menu mislabelled sides"` points to `flag: "F6"` (should be `"F7"`), and `"A candlestick bucket with no trades still carries its quote legs"` points to `flag: "K2"` (should be `"DR1"`).
4. **`summary.html`:** `<h2>8 · Requirement traceability — measured, not asserted</h2>` precedes `<h2>7 · Method</h2>`, and Decision #2's `Blocked by` cell cites `Q1 / F7` instead of `Q1 / A11`.

---

## 5. Verification Results

Executed locally on the rebased tree (`main` @ `54c3ca1` + `3e859f7c`):

| Suite | Result |
|---|---|
| `node --test tests/*.test.mjs` | **281/281** passed |
| `cd tests/dom && npm test` | **55/55** (`alerts-dom` 26/26, `summary-dom` 5/5 [`105/116` verified claims; `38` open / `107` total flags], `category-dom` 24/24) |
| `node tools/verify/page-runtime-check.mjs` | **18/18** pages clean (`36` pages, `0` broken local links) |
| `node evidence/auth-sign-test.mjs` | **6/6** passed |
| `python3 -m unittest discover -s tools` | **55/55** passed |
| `python3 -m unittest discover -s tests` | **28** run (**24** passed, **4** skipped without optional `cryptography`/live WS) |
| `python3 tools/check_site_links.py .` | **36** HTML pages OK |

*PR CI run IDs, merge SHA, and live GitHub Pages deployment verification will be recorded in `COORDINATION.md` after merge.*

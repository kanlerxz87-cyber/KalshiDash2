# Line-by-line runtime, simulator, and documentation audit — session `df162a93`

Date: 2026-11-27 (UTC) · Branch: `arena/df162a93-kalshidash2`

## Official sources fetched and checked on 2026-11-27

| Source | URL | Verified detail applied |
| --- | --- | --- |
| API Keys | https://docs.kalshi.com/getting_started/api_keys | Python RSA-PSS `private_key.sign(message, padding.PSS(...), hashes.SHA256())` takes `message` first; `KALSHI-ACCESS-TIMESTAMP` must be within 30 s of Kalshi's clock or returns `401 header_timestamp_expired`. |
| Quick Start: Authenticated Requests | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | Confirms identical RSA-PSS / Ed25519 signing order, query-string stripping, and millisecond timestamp header. |
| Quick Start: WebSockets | https://docs.kalshi.com/getting_started/quick_start_websockets | Demo WS URLs `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` and `wss://demo-api.kalshi.co/trade-api/ws/v2`; handshake pre-sign string `timestamp + "GET" + "/trade-api/ws/v2"`. |
| Create Order (V2) | https://docs.kalshi.com/api-reference/orders/create-order-v2 | `side` enum `bid`/`ask`: "`bid` means buy YES, `ask` means sell YES. (Selling YES is economically equivalent to buying NO at `1 - price`, but this endpoint quotes everything from the YES side.)" |
| Order Direction | https://docs.kalshi.com/getting_started/order_direction | States `bid ≡ yes`, `ask ≡ no` and "An order at price `p` with `outcome_side=no` is matched by an order at the same price `p` with `outcome_side=yes`" (consistent with `Create Order (V2)` YES-leg request quoting, resolved in `F20`). |
| Orderbook Responses | https://docs.kalshi.com/getting_started/orderbook_responses | Binary reciprocal relationship: NO price is `$1.00 - YES price`. |
| Market Settlement | https://docs.kalshi.com/getting_started/market_settlement | Winning YES or NO contract pays $1.00; settlement fees are zero for binary yes/no determinations. |
| Get Historical Markets | https://docs.kalshi.com/api-reference/historical/get-historical-markets | Description states "Filters are mutually exclusive"; `limit` defaults to 100 (max 1000). Live demo endpoint confirmed HTTP 200 on 2026-11-27. |
| Get Fills | https://docs.kalshi.com/api-reference/portfolio/get-fills | Query parameters and authenticated fill schema (`no_price_dollars`, `yes_price_dollars`, `outcome_side`, `book_side`, `fee_cost`). |
| Live Demo Exchange Status | https://external-api.demo.kalshi.co/trade-api/v2/exchange/status | Confirmed HTTP 200 (`exchange_active: true`, `trading_active: true`, shards 0–3) on 2026-11-27. |

## Defects fixed (exclusive unclaimed scope)

1. **`scripts/kalshi_ws.py` + `tests/test_kalshi_ws.py` (4 runtime bugs)**
   - Fixed `RSAPrivateKey.sign(...)` argument order in `sign_ws_request()` (`message` is now first, matching official docs and `scripts/kalshi_client.py`; previously raised `TypeError` for every RSA key in both `kalshi_ws.py` and `relay.py`).
   - Moved `ws_auth_headers()` inside the `while True:` reconnect loop so every reconnect generates a fresh millisecond timestamp within Kalshi's 30-second window.
   - Fixed `--max-messages` to count received `ticker` frames and exit cleanly once reached (removed dead `_COUNTER` global and impossible `<= 0` check).
   - Replaced blocking `time.sleep(delay)` inside `async def run()` with `await asyncio.sleep(delay)`.
   - Added unit tests covering RSA-PSS argument order (both dependency-free mock and real `cryptography` key when installed), fresh auth headers on reconnect, async sleep, and `--max-messages`.

2. **`assets/js/simulator.js` + `simulator.html` + `tests/simulator-core.test.mjs` (5 simulator / paper-trader bugs)**
   - Extracted `paperEntryFromSwing(swing)` and wired it into `simulator.html`'s live paper trader: enforces `swing.pick` (the tradeability screen promised on the page) and sets NO-side `entry_price` to `1 - swing.to` (fixing the active F17 complement bug where NO paper trades recorded the YES price and mis-scored settlement P&L).
   - Removed duplicate `limit=100` in `loadSettledUniverse()` (`getAll("/historical/markets", ...)`).
   - Resolved series-level categories via `fetchSeriesCategories` in `loadSettledUniverse()` instead of relying exclusively on deprecated `event.category`.
   - Aligned `simulator.html`'s "Best strategy" KPI card with the scoreboard's net after-fee evaluation (`pnlNet`).
   - Added unit tests covering `paperEntryFromSwing`, NO-side `Paper.settle()` P&L, duplicate-`limit` prevention, and series-level classification.

3. **`index.html` + `resolved.html`**
   - `index.html`: added `fetchSeriesCategories` + `classifyEventWithBasis` and disclosed series-vs-event classification coverage in `#board-note`.
   - `resolved.html`: restored `_order` sorting across standard and multivariate combo rows before `.slice(0, 150)`, capped combo/leg `/events/` lookups, and surfaced `markets.__capped` and `markets.__duplicateRows` in `#recent-status`.

4. **`questions.html`, `verification.html`, `assets/js/sources.js`, `scripts/analyze_trades.py` + `tests/test_analyze_trades.py`, `evidence/README.md`, `.github/workflows/verify-live.yml`**
   - `questions.html` (`Q7`): replaced stale "`ask` = buy NO reproduced live" claim with the verified `F20` YES-leg quoting rule (`create-order-v2` + `order_direction`) while preserving `F1` (`partly answered`, no live authenticated order sent); updated stale `Q14`, `Q16`, and `Q17`.
   - `verification.html`: added missing `<option value="model">` category filter (matching `assets/js/claims.js`), removed duplicated `evidence/evidence-cors-taxonomy.md` row, and listed `evidence/live-2026-11-22-8f3c331c.md`.
   - `assets/js/sources.js`: fulfilled session `8f3c331c`'s logged request on `Get Historical Markets` ("Filters are mutually exclusive") while preserving session `54220d3d`'s merged PR #135 `verified: "fetched"` fee-schedule row untouched.
   - `scripts/analyze_trades.py` + `tests/test_analyze_trades.py`: removed bare `"gas"` substring false positives (`KXVEGAS`/`KXNATGAS`, Flagged G1/F8) and preferred `no_price_dollars` for NO fills when supplied.
   - `evidence/README.md`: corrected stale `site/tools` path references to `evidence/`.
   - `.github/workflows/verify-live.yml`: added `sources.html` to `PAGES` and content assertions so all 18 root/category pages are checked on deploy.

## Overlap avoidance & conflict reconciliation

Files owned by merged PRs #132/#135 (`858d4941`, `54220d3d`) and open PR #134 (`d3e0e9f5`) — including `summary.html`, `flagged.html`, `assets/js/claims.js`, `.github/workflows/{collect,probe,site-check}.yml`, `data/probe/*`, `tests/ci-coverage.test.mjs`, `tests/probe-citation-drift.test.mjs`, and `tools/test_collect.py` — were left untouched (an earlier local `summary.html` edit was withdrawn upon seeing PR #134 open, and the `assets/js/sources.js` fee-schedule row kept `54220d3d`'s merged `verified: "fetched"` text intact). A cross-scope note for `summary.html` Section 2 (F20 YES-leg wording) is logged in `COORDINATION.md`.

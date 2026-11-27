# Verification — KalshiDash2

**Checked 2026-11-27** against official sources (re-verified alongside `reports/verify-54220d3d.md` and
`reports/verify-2f98889c.md`). Every row names the official page that states it; live market values (prices,
sizes, balances, results) are **never transcribed** into this file and are fetched at runtime by the page
or by `scripts/kalshi_client.py`.

This is the Markdown companion for the **published root site** served by GitHub Pages (`main:/`).
The full client-side claims register lives in [`assets/js/claims.js`](assets/js/claims.js) (**109** claims
shown on [`verification.html`](verification.html)), the documentation audit register lives in
[`assets/js/sources.js`](assets/js/sources.js) (**49** sources, **49 verified / 0 unverified** on
[`sources.html`](sources.html)), and the irregularity register (**F1–F20** plus historical cross-references)
lives on [`flagged.html`](flagged.html). `docs/flagged.html` remains historical only.

## Table

| # | Claim | Value | Official source | Status |
|---|-------|-------|-----------------|--------|
| 1 | Recommended demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 2 | Also-supported demo host | `https://demo-api.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 3 | Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 4 | Public market data needs no auth | `GET /markets`, `/events`, `/orderbook`, `/candlesticks`, `/series` answer unauthenticated | https://docs.kalshi.com/getting_started/quick_start_market_data | verified |
| 5 | Order endpoint + body | `POST /portfolio/events/orders` (V2 event-market shape: `book_side` / `outcome_side` or documented request fields; `yes_price_dollars` quotes from the YES leg even for NO bets, flag `F20`) | https://docs.kalshi.com/api-reference/orders/create-order-v2 | verified |
| 6 | Legacy order writes | `/portfolio/orders` writes return `410 deprecated_v1_order_endpoint`; V2 route is canonical | https://docs.kalshi.com/api-reference/orders/create-order-v2 | verified |
| 7 | Auth headers | `KALSHI-ACCESS-KEY` / `-SIGNATURE` / `-TIMESTAMP` | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 8 | Signature construction | `timestamp(ms) + METHOD + full path from root, query stripped`; RSA-PSS SHA-256 (salt = digest length) or Ed25519 direct; base64 | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 9 | Balance units | balance is returned in cents by the documented quick-start arithmetic | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 10 | Fixed-point units | `*_dollars` = dollar strings (≤4 dp for prices); `*_fp` = contract counts (2 dp, 0.01 granularity) | https://docs.kalshi.com/getting_started/fixed_point_migration | verified |
| 11 | Per-market price grid | `price_ranges[]` `{start,end,step}` is the source of truth for valid prices; `price_level_structure` is a label only | https://docs.kalshi.com/getting_started/fixed_point_migration | verified |
| 12 | Get Markets filters | `limit`, `cursor`, `event_ticker`, `series_ticker`, `status`, timestamp filters; one `status` at a time | https://docs.kalshi.com/api-reference/market/get-markets | verified |
| 13 | Market display fields | `yes_sub_title` canonical (`title`/`subtitle` deprecated); `result` ∈ yes/no/scalar/empty; `notional_value_dollars` = one contract's settlement value | https://docs.kalshi.com/api-reference/market/get-market | verified |
| 14 | A REST market object has **no** dollar-volume field | `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `notional_value_dollars` are returned; no `dollar_volume` on REST market objects | https://docs.kalshi.com/api-reference/market/get-markets | verified |
| 15 | The **ticker** stream carries dollar fields | `dollar_volume` ("Signed whole-dollar cumulative traded notional") and `dollar_open_interest` appear in WebSocket `ticker` payloads | https://docs.kalshi.com/websockets/market-ticker | verified (documented schema; `A11` mitigated by `Get Trades` on category pages) |
| 16 | Series list + fields | `GET /series` filters `category`, `tags`, `include_product_metadata`, `include_volume`, `min_updated_ts`; no documented `limit`/`cursor` | https://docs.kalshi.com/api-reference/market/get-series-list | verified |
| 17 | `category`, `categories[]`, and `tags[]` | A series carries `category`, discovery `categories[]`, and optional `tags[]` (observed live: `KXDPWORLDTOURR2LEAD` has `category: "Sports"`, `tags: ["Golf"]`, no "golf" in title/ticker — flag `F19`) | https://docs.kalshi.com/api-reference/market/get-series + https://docs.kalshi.com/api-reference/market/get-series-list | verified (`assets/js/market.js` stores `series.tags` and matches `tagPatterns: [/^Golf$/i]`) |
| 18 | The event object's `category` is deprecated | Get Events marks `category` `deprecated: true` ("use series-level category instead") | https://docs.kalshi.com/api-reference/events/get-events | verified (`assets/js/market.js` uses series category/tags first and keeps event category as labelled fallback) |
| 19 | `GET /events` excludes multivariate events | stated in the reference; combos come from `GET /events/multivariate` | https://docs.kalshi.com/api-reference/events/get-events | verified |
| 20 | Single-market candlesticks | `GET /series/{series_ticker}/markets/{ticker}/candlesticks`; `period_interval` ∈ {1, 60, 1440} minutes | https://docs.kalshi.com/api-reference/market/get-market-candlesticks | verified |
| 21 | Batch candlesticks (used by charts) | `GET /markets/candlesticks?market_tickers=…`; candles under `markets[].candlesticks[]`, close = `price.close_dollars` | https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks | verified |
| 22 | Orderbook shape | `GET /markets/{ticker}/orderbook` → `orderbook_fp.yes_dollars` / `.no_dollars` as `[price, size]` lists, **bids only** | https://docs.kalshi.com/api-reference/market/get-market-orderbook | verified |
| 23 | Yes bid ≡ no ask at 1−X | binary-book explanation; the book returns bids for both sides and no asks | https://docs.kalshi.com/getting_started/orderbook_responses | verified |
| 24 | Lifecycle + settlement | status transitions; YES pays $1 to YES holders and NO $1 to NO holders at settlement | https://docs.kalshi.com/getting_started/market_lifecycle + https://docs.kalshi.com/getting_started/market_settlement | verified |
| 25 | Fill fields | `outcome_side` / `book_side` canonical (legacy `side`/`action` deprecated); `fee_cost` is a fixed-point **dollar** string; `count_fp`, `yes_price_dollars` | https://docs.kalshi.com/api-reference/portfolio/get-fills | verified |
| 26 | Positions & settlements | `GET /portfolio/positions`, `GET /portfolio/settlements` | https://docs.kalshi.com/api-reference/portfolio/get-positions + https://docs.kalshi.com/api-reference/portfolio/get-settlements | verified |
| 27 | Fees | Fee-schedule PDF (effective 2026-07-07) + Fee Rounding doc; rounding formula reproduced row-by-row in `tests/simulator-core.test.mjs` | https://docs.kalshi.com/getting_started/fee_rounding + https://kalshi.com/docs/kalshi-fee-schedule.pdf | verified (PDF fetched & retired from `unverified` in `sources.js` via `PR #135`; centicent footnote contradiction noted as `Z2`) |
| 28 | Rate limits | authenticated calls are token-metered per Read/Write bucket; `429` carries `X-RateLimit-*` headers and no `Retry-After` | https://docs.kalshi.com/getting_started/rate_limits | verified |
| 29 | Unauthenticated budget | unauthenticated requests "are subject to separate limits" with **no published number** | https://docs.kalshi.com/getting_started/rate_limits | verified as *unpublished* (`F3` — site backs off on `429` and caps scans) |
| 30 | Browser CORS from the Pages origin | `access-control-allow-origin: https://kanlerxz87-cyber.github.io` returned on tested public endpoints and preflight | https://docs.kalshi.com/getting_started/demo_env (`evidence/evidence-cors-taxonomy.md`) | verified |
| 31 | Topic category vocabulary | Elections → `Elections`; Culture → `Culture` / `Entertainment` / `Social`; Crypto → `Crypto`; Golf → `Sports` narrowed by series `tags: ["Golf"]` (`tagPatterns`) plus golf series/title patterns; Gas → no category covers retail gasoline (matched on `KXAAAGAS*`/`KXGAS` series + title) | https://docs.kalshi.com/api-reference/market/get-series + https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories | verified (`tests/taxonomy.test.mjs`) |
| 32 | `KXGAS` and `GAS` are distinct series records | `GET /series/KXGAS` and `GET /series/GAS` return distinct tickers sharing EIA title/terms; neither is claimed as an alias (`SB4`) | https://docs.kalshi.com/api-reference/market/get-series | verified as *two records* |
| 33 | Market `status` vs query filter values | `GET /markets?status=open` returns markets with object `status: "active"`; `marketResultState()` handles `open`, `closed`, `determined`, `finalized` | https://docs.kalshi.com/getting_started/market_lifecycle | verified |
| 34 | Demo = mock funds, separate credentials | stated by Kalshi | https://docs.kalshi.com/getting_started/demo_env | verified |
| 35 | Official traded-dollar volume | Σ(`count_fp` × price of taker's recorded `taker_outcome_side`) over `GET /markets/trades`, withholding partial totals when pages fail | https://docs.kalshi.com/api-reference/market/get-trades | verified (`tests/dollar-volume.test.mjs`) |
| 36 | Series list response size is point-in-time only | Committed captures record 16,643 rows (2026-11-20), 16,653 rows (2026-11-21), and **16,698 rows** (`data/probe/api_surface_2026-11-24.json`), while scheduled `data/probe/api_surface.json` rotates independently | https://docs.kalshi.com/api-reference/market/get-series-list | partially verified (`F5`, `C1` — point-in-time response sizes, not asserted as total exchange catalogue) |
| 37 | Historical (archived) demo tier | `GET /historical/cutoff`, `/historical/markets`, `/historical/markets/{ticker}/candlesticks` respond unauthenticated; archived candles omit `_dollars`/`_fp` suffixes | https://docs.kalshi.com/api-reference/historical/get-historical-markets + https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks | verified (`tests/historical-tier.test.mjs`) |
| — | Exact price / volume / balance / resolution **values** | *(blank)* | — | **not transcribed by design** — fetched live, never committed |
| — | "High-ROI" watch and volume × price ranking | *(derived conventions, not exchange facts)* | — | **not facts** — labelled as a screen and as a proxy (`A1`, `A11`) |

## How a row gets verified

1. The official page is fetched and read directly (recorded in `assets/js/sources.js` and `reports/`).
2. Runtime behaviour is exercised against live demo endpoints (`reports/`) or deterministic DOM/unit suites (`tests/`).
3. Anything unconfirmed stays blank or flagged on [`flagged.html`](flagged.html) with the step that would close it.

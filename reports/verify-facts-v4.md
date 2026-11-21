# Line-by-line re-verification v4 — session `9d7b4124` (2026-11-21)

Fresh check of every official URL the published site uses, against the official
index and the live documentation pages. Method: `fetch_page` on
`docs.kalshi.com` (the agent sandbox cannot open TLS to Kalshi hosts —
`curl` returns `000`, the same limit every prior session recorded; live API
behavior is therefore re-checked on GitHub runners via `verify-alerts` /
`live-engine-check`, see `COORDINATION.md` Z4).

## 1. Every `SOURCES` URL in `assets/js/config.js` exists in the official index

All 28 URLs were found in [llms.txt](https://docs.kalshi.com/llms.txt)
(chunks 0–2 of 10; the remaining chunks cover perps/FIX/communications
sections the site does not use):

| # | Site URL | In llms.txt |
|---|----------|-------------|
| 1 | `getting_started/demo_env` | yes |
| 2 | `getting_started/api_environments` | yes |
| 3 | `getting_started/api_keys` | yes |
| 4 | `getting_started/quick_start_authenticated_requests` | yes |
| 5 | `getting_started/quick_start_create_order` | yes |
| 6 | `api-reference/orders/create-order-v2` | yes |
| 7 | `getting_started/order_direction` | yes |
| 8 | `getting_started/orderbook_responses` | yes |
| 9 | `api-reference/market/get-market-candlesticks` | yes |
| 10 | `api-reference/market/get-markets` | yes |
| 11 | `api-reference/events/get-events` | yes |
| 12 | `api-reference/market/get-series-list` | yes |
| 13 | `api-reference/market/get-series` | yes |
| 14 | `api-reference/exchange/get-exchange-status` | yes |
| 15 | `api-reference/market/get-market` | yes |
| 16 | `api-reference/portfolio/get-balance` | yes |
| 17 | `api-reference/portfolio/get-fills` | yes |
| 18 | `api-reference/portfolio/get-positions` | yes |
| 19 | `api-reference/orders/get-orders` | yes (the X2-corrected path) |
| 20 | `getting_started/rate_limits` | yes |
| 21 | `getting_started/quick_start_websockets` | yes |
| 22 | `getting_started/fixed_point_migration` | yes |
| 23 | `getting_started/market_settlement` | yes |
| 24 | `getting_started/market_lifecycle` | yes |
| 25 | `getting_started/historical_data` | yes |
| 26 | `getting_started/exchange_sharding` | yes |
| 27 | `getting_started/fee_rounding` | yes |
| 28 | `getting_started/terms` | yes |

**Result: 28/28 present. No URL has moved; no `config.js` change needed.**

## 2. Demo endpoints (brief URLs)

[Demo environment](https://docs.kalshi.com/getting_started/demo_env) states the
recommended demo REST root is `https://external-api.demo.kalshi.co/trade-api/v2`
with `https://demo-api.kalshi.co/trade-api/v2` also supported, and WebSocket
`wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` with
`wss://demo-api.kalshi.co/trade-api/ws/v2` also supported. Matches
`DEMO`/`ALTERNATES` in `assets/js/config.js` exactly.

## 3. Schema spot-checks (fields the site reads)

- [Get Market](https://docs.kalshi.com/api-reference/market/get-market):
  `last_price_dollars`, `previous_price_dollars`, `yes_bid_dollars`,
  `yes_ask_dollars`, `no_bid_dollars`, `no_ask_dollars`, `yes_bid_size_fp`,
  `yes_ask_size_fp`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`,
  `result` (example `"yes"`), `settlement_value_dollars`,
  `notional_value_dollars`, `price_ranges` (the per-market price grid the
  order form snaps to). All present — the alert engine, screen, and simulator
  read only documented fields.
- [Get Events](https://docs.kalshi.com/api-reference/events/get-events):
  `settlement_sources[]` (`name`, `url`), `category`, `cursor`, nested
  `markets[]` with the same price fields. Confirms the jump-context links and
  cursor pagination the site uses.
- [Batch Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks):
  response grouped as `markets[].candlesticks[]`, close at
  `price.close_dollars`, `price.previous_dollars` present. Confirms the chart
  parser and the `detectJumps` input shape.
- [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2):
  `POST /portfolio/events/orders` with `ticker`, `client_order_id`, `side`
  (`bid`/`ask`), `count`, `price`, `time_in_force`,
  `self_trade_prevention_type`; legacy `/portfolio/orders` writes return
  `410 Gone`. Confirms the portfolio order path.

## 4. Every other `docs.kalshi.com` URL in the repository

`grep -rhoE` over `*.html/*.js/*.md/*.py/*.mjs` (excluding `node_modules`)
yields 44 unique URLs. 37 are in the index (table above plus
`get-event`, `get-multivariate-events`, `batch-get-market-candlesticks`,
`get-market-orderbook`, `cancel-order-v2`, `get-settlements`, `order_errors`,
`pagination`, `quick_start_market_data`). The remaining 7 are **not** linked
from any published page:

| URL | Where it appears | Disposition |
|-----|------------------|-------------|
| `api-reference/portfolio/get-orders` | `COORDINATION.md` only (X2 fix record) | Historical record of the fixed 404; site uses `orders/get-orders`. No change. |
| `websockets/market-ticker` | `COORDINATION.md` only (quoted 2026-11-20 review request) | Historical quote; current docs path is `quick_start_websockets`. No change. |
| `api-reference/orders/create-ord` | `evidence/`, `reports/` raw captures | Truncated excerpt, already flagged as **X4**. Raw captures are not edited. |
| `api-reference/orders/` (bare) | `reports/verify-facts-v3.md:130` raw capture | Same truncation class as X4 (captured 410 body cut mid-URL); auditor recorded HTTP 200 for the bare prefix. Noted here; no new flag — X4 covers the class. |
| `docs.kalshi.com/a`, `docs.kalshi.com/x` | `tools/test_audit_external_links.py` fixtures | Test strings, not links. No change. |

## 5. Irregularities found in this pass

1. **Y9 confirmed still open before this session:** `assets/js/jumps.js` is
   tracked, its header claims category-chart use, and `grep -r "jumps.js"`
   returns no importer. Closed by deletion in Z2 (see `COORDINATION.md`).
2. **Y10 confirmed still open before this session:** `docs/index.html` still
   presents the defective legacy generation as a landing page. Mitigated by
   redirect in Z3.
3. No new irregularities. No value on any published page was found to
   contradict the official documentation checked above.

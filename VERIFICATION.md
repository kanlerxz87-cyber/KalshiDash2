# Verification — KalshiDash2

Checked 2026-11-20 against official sources (each source page fetched and read; full list on the site's Sources page, `docs/sources.html`). Live market values are never transcribed — they are fetched live in the browser (or at runtime via `scripts/kalshi_client.py`).

| Claim | Value | Official source | Status |
|-------|-------|-----------------|--------|
| Recommended demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| Also-supported demo host | `https://demo-api.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| Public market data needs no auth | `GET /markets` called unauthenticated in official quick-start | https://docs.kalshi.com/getting_started/quick_start_create_order | verified |
| Order endpoint + body | `POST /portfolio/events/orders` with `ticker, side, count, price, time_in_force, self_trade_prevention_type, client_order_id` | https://docs.kalshi.com/getting_started/quick_start_create_order | verified |
| Legacy order writes | `/portfolio/orders` writes return `410 Gone`; V2 event-market shape canonical | https://docs.kalshi.com/api-reference/orders/create-order-v2 | verified |
| Auth headers | `KALSHI-ACCESS-KEY/-SIGNATURE/-TIMESTAMP` | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| Signature construction | message = `timestamp(ms) + METHOD + full-path-from-root-without-query`; RSA-PSS SHA-256 salt=32 or Ed25519 direct; base64 | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| Balance units | cents (quick-start divides by 100) | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| Get Markets filters | `limit, cursor, event_ticker, series_ticker, status(unopened/open/closed/settled), min/max ts` | https://docs.kalshi.com/api-reference/market/get-markets | verified |
| Market display fields | `yes_sub_title` canonical (`title` deprecated); `result` ∈ yes/no/scalar/empty; `settlement_ts` only when settled; `notional_value_dollars` = one-contract settlement value | https://docs.kalshi.com/api-reference/market/get-market | verified |
| Series list + fields | `GET /series` (params `category/tags/include_*`; no documented limit/cursor); fields incl. `categories[]`, `tags[]` | https://docs.kalshi.com/api-reference/market/get-series-list | verified |
| Single-market candlesticks | `GET /series/{s}/markets/{t}/candlesticks`, `period_interval` ∈ {1, 60, 1440} min | https://docs.kalshi.com/api-reference/market/get-market-candlesticks | verified |
| Batch candlesticks (used by charts) | `GET /markets/candlesticks?market_tickers=…`; candles under `markets[].candlesticks[]`, close = `price.close_dollars` | https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks | verified |
| Orderbook shape | `GET /markets/{ticker}/orderbook` → `orderbook_fp.yes_dollars/no_dollars` = `[price, size]` lists, bids only | https://docs.kalshi.com/api-reference/market/get-market-orderbook | verified |
| Yes bid ≡ no ask at 1−X | binary-book explanation | https://docs.kalshi.com/getting_started/orderbook_responses | verified |
| `*_fp` units | contract counts, 2-decimal strings, 0.01 granularity; `*_dollars` = dollar strings | https://docs.kalshi.com/getting_started/fixed_point_migration | verified |
| Lifecycle + settlement | status transitions; Yes pays $1 to Yes holders, No $1 to No holders; net positions | https://docs.kalshi.com/getting_started/market_lifecycle + /market_settlement | verified |
| Fill fields | `outcome_side/book_side` canonical (legacy `side/action` deprecated); `fee_cost` = fixed-point dollars; `count_fp`, `yes_price_dollars` | https://docs.kalshi.com/api-reference/portfolio/get-fills | verified |
| Positions & settlements | `GET /portfolio/positions`, `GET /portfolio/settlements` | https://docs.kalshi.com/api-reference/portfolio/get-positions + /get-settlements | verified |
| Demo = mock funds, separate credentials | stated by Kalshi | https://docs.kalshi.com/getting_started/demo_env | verified |
| Series reference labels (gas/golf) | `KXAAAGASM`, `KXPGATOUR`, `KXPGARYDER`, `KXPGASOLHEIM` | https://kalshi.com/docs/kalshi-fee-schedule.pdf | verified |
| Browser CORS from GitHub Pages | *(blank)* | — | **unverified** (F1 — sandbox cannot reach kalshi.co; test on the live site) |
| Exact `/series` category strings per topic | *(blank — discovered live, keyword heuristic)* | — | **unverified** (F4) |
| Any specific price / volume / balance / resolution | *(blank — live only, never transcribed)* | — | **unverified** |
| Est. dollar volume, price-band taxonomy, strategy library | *(derived / proposals — see `docs/sources.html` conventions table)* | — | **not facts** (analytic conventions, excluded from verification) |

Irregularities and open items: `docs/flagged.html` (F1–F7 plus doc discrepancies D1–D3). Sandbox outbound access cannot reach kalshi.co, so live API behavior was verified by line-by-line code review against the official OpenAPI specs, not by execution; the browser (or `scripts/kalshi_client.py`) performs the live calls.

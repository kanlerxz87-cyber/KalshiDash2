# Final verification — session 117dc8d6 (2026-11-21)

Branch `arena/117dc8d6-kalshidash2` from `main@cc9112b` (PR #88). No open PRs at claim time; Pages `built` from `main:/`.

## Official sources re-read (fetch tool, 2026-11-21)

| Claim on site | Official source | Result |
|---|---|---|
| Demo REST `https://external-api.demo.kalshi.co/trade-api/v2`, WS `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`, alternatives `demo-api.kalshi.co` | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | ✅ matches |
| Market fields `last_price_dollars`, `previous_price_dollars`, `volume_fp`, `open_interest_fp`, `result` yes/no, `settlement_value_dollars`, `notional_value_dollars` | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ matches |
| Batch candles `markets[].candlesticks[]`, `price.close_dollars`, `period_interval` minutes ≥1, max 100 tickers | [Batch Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks) | ✅ matches; no seconds history — site samples live, correctly labelled |
| Ticker WS `type:ticker`, `price_dollars`, `yes_bid/ask_dollars`, `volume_fp`, `open_interest_fp`, `dollar_volume`, `dollar_open_interest` | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) | ✅ matches relay mapping |
| Orderbook `orderbook_fp.yes_dollars/no_dollars` `[price,count]`, bids only, reciprocal YES/NO | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) | ✅ matches depth view |
| Settlement: YES/NO holders receive $1 | [Market Settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ matches |
| Create Order V2 `POST /portfolio/events/orders`, `side` bid/ask, fixed-point `price`/`count` | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | ✅ matches guarded placement |

Live site fetched: https://kanlerxz87-cyber.github.io/KalshiDash2/ — reachable, shows "Connected to the Kalshi demo API", trading active.

## Brief requirements audit

- Highest-dollar live events, 5 topics only (gas/elections/culture/crypto/golf), topics separate, events grouped: ✅ `index.html` + `categories/*.html`, volume×price proxy labelled (not dollars traded, Flag A11).
- Live alerting ≥$0.10 either direction, two scrolling chats (All + High-ROI watch): ✅ `alerts.html`, `THRESHOLD=0.10` inclusive, dual detection (poll-to-poll + `previous_price_dollars`), every message labelled.
- Track until resolved yes/no: ✅ `resolved.html` + event detail show API `result`; no inference.
- Automated simulated trades, portfolio performance via demo account, categorization, strategies: ✅ `simulator.html` (candlestick backtest, settlement-scored, seeded random control, CSV), `portfolio.html` (browser-only demo key), `strategies.html` (fills by topic/side/role).
- Execute trades: ✅ guarded V2 placement, price snapped to market grid; no key in repo.
- Live interactive graph X=time (10s→7d), Y=price; liquidity contracts at price: ✅ `category.js` windows + jump markers ≥$0.10 + orderbook depth.
- Suggestions for liveness: ✅ `suggestions.html` S1–S16 decision board.
- GitHub Pages landing + subpages, tables with source links, blank+flagged if unverified: ✅ 35 pages, 0 broken local links.
- No manual input: ✅ all data fetched live in browser; no transcribed values.

## Local suite (this session)

- Node unit `tests/*.test.mjs`: **78/78 pass**
- Python tools: **42/42 pass**
- Static links: **35 pages, 0 broken**
- Page runtime: **17/17 clean**
- Signing self-test: **6/6**
- `git diff --check`: clean
- `tests/live-alerts-check.mjs` fails locally with TLS `ECONNRESET` to `external-api.demo.kalshi.co` — expected sandbox limit (no kalshi.co route); it runs on GitHub runners (`verify-alerts` workflow). Not a code defect.

## Changes in this session

1. `suggestions.html` S8: `open` → `built`. Evidence was stale ("seven branches exist"); now PR #88 merged, Pages built, no open PRs. "Four that matter most" callout updated to match.
2. `SUGGESTIONS.md`: pointer corrected from legacy `docs/suggestions.html` to published `suggestions.html`.

## Irregularities / known flags (non-blocking, per brief)

- **F10** ("WebSocket documented but not wired in", `open`) is partially superseded by the opt-in relay (W1 documents the residual gap: browser cannot set `KALSHI-ACCESS-*` headers; Pages site runs REST poll). Left as-is because `flagged.html` counts are DOM-asserted in `summary-dom` tests; changing the status without re-deriving counts would break the suite. Logged here for the integration owner.
- **A11** (volume×price proxy is not dollars traded), **W2/W3** (ticker has no `previous_price_dollars`; coalescing), **F15/A5** (paper P&L omits fees/slippage/queue), **R9** (`KXGAS`→`GAS` alias unconfirmed) remain as published on `flagged.html`. None block merge.
- No new hallucinations found; no values inferred. Sandbox cannot open TLS to `*.kalshi.co` — official docs read via fetch tool, live behaviour via CI workflows (run IDs recorded in `COORDINATION.md`).

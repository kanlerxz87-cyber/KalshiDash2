# Verification — KalshiDash2

Checked 2026-11-20 against official sources. Live market values are never transcribed — they are fetched live in the browser.

| Claim | Value | Official source | Status |
|-------|-------|-----------------|--------|
| Recommended demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/quick_start_create_order | verified |
| Also-supported demo host | `https://demo-api.kalshi.co/trade-api/v2` | https://docs.kalshi.com | verified |
| Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | https://docs.kalshi.com | verified |
| Public market data needs no auth | `GET /markets` works unauthenticated | https://docs.kalshi.com/getting_started/quick_start_create_order | verified |
| Order endpoint | `POST /portfolio/events/orders` | https://docs.kalshi.com/getting_started/quick_start_create_order | verified |
| Auth headers | `KALSHI-ACCESS-KEY/-SIGNATURE/-TIMESTAMP` | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| Candlesticks | `GET /series/{s}/markets/{t}/candlesticks`, periods 1/60/1440 | https://docs.kalshi.com/api-reference/market/get-market-candlesticks | verified |
| Orderbook | `GET /markets/{ticker}/orderbook` | https://docs.kalshi.com/api-reference/market/get-market-orderbook | verified |
| Demo = mock funds | Stated by Kalshi | https://docs.kalshi.com | verified |
| Browser CORS from GitHub Pages | *(blank)* | — | **unverified** (F1) |
| Series tickers per topic | *(blank — discovered live)* | — | **unverified** (F4) |
| Any specific price/volume/balance | *(blank — live only)* | — | **unverified** |

Irregularities: see `docs/flagged.html` (F1–F6). Sandbox outbound access cannot reach kalshi.co, so live API calls were verified by code review against official docs, not by execution; the browser performs the live calls.

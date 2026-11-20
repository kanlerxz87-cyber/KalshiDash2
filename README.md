# Kalshi Demo Market Monitor

A no-build, static GitHub Pages dashboard for evidence-first monitoring of public Kalshi demo market data. The interface focuses on gas prices, elections, culture, crypto, and golf; includes market status/result review, current order-book depth, a short-lived observed-price chart, portfolio/trade-analysis readiness, decision questions, suggestions, and a **Flagged for review** page.

## Important scope and safety limits

- The page requests public market data from Kalshi's documented demo REST API at `https://external-api.demo.kalshi.co/trade-api/v2`, with the alternate documented demo hostname `https://demo-api.kalshi.co/trade-api/v2` as fallback. Data is populated only after successful browser requests; failures leave data blank and are shown in the UI.
- Topic badges are title/subtitle/ticker keyword matches, not asserted official categories. Check each market's own rules before drawing conclusions.
- The dashboard lists individual market records; it does not claim an event-level aggregation. Its market list orders by the returned `volume_24h_fp` (contract quantity), **not dollars**. Kalshi's ticker WebSocket documentation includes `dollar_volume`, but requires an authenticated WebSocket connection. This implementation does not have a server-side signer or an authenticated stream, so it does not display or infer dollar-volume rankings.
- Price charts collect browser-observed REST samples for the selected market every 15 seconds. Samples are in-memory only and reset on reload; these are not historical exchange candles or guaranteed real-time updates. The official candlestick API documents 1-minute, 60-minute, and 1440-minute intervals. The short seconds window is based on local observations.
- Resolved results are shown only when the returned market record's `result` is exactly `yes` or `no`; no outcome is inferred from price, date, or title.
- **No portfolio/account connection or order execution is implemented.** Kalshi private requests are signed using a private key. A static browser site is not a safe place for that key. Connecting demo positions, fills, P&L, or order placement requires a secure server-side signing service, account authorization, explicit demo-only protections, and agreed risk/approval controls. No credentials, simulated trades, or fabricated balances are included.
- Each populated market row links to its corresponding official API record. Decision tables and limitations include links to official documentation. Schema examples in documentation are examples, not current live data.

## Run locally

Serve the repository root using any static HTTP server, for example:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Then visit `http://localhost:8000`. Live API access depends on the browser's network and the demo API's cross-origin policy. The site reports request failures rather than substituting values.

## GitHub Pages

GitHub Pages was already enabled for this repository and configured to publish the `main` branch root (`build_type: legacy`); GitHub's Pages API reported the existing site as `built` at `https://kanlerxz87-cyber.github.io/KalshiDash2/` before these changes. This static site adds a root `index.html`, local CSS/JS, and `.nojekyll`, so a merge to `main` is the publishing change. Verify the post-merge Pages build at the repository's Actions/Pages status. The public site must not contain account credentials.

## Official source references

- [Kalshi API documentation index](https://docs.kalshi.com/llms.txt)
- [API environments and endpoints](https://docs.kalshi.com/getting_started/api_environments)
- [Demo environment quick start](https://docs.kalshi.com/getting_started/demo_env)
- [Get markets](https://docs.kalshi.com/api-reference/market/get-markets)
- [Get market order book](https://docs.kalshi.com/api-reference/market/get-market-orderbook) — documented bid levels and contract sizes
- [Get market candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) — 1, 60, or 1440 minute period intervals
- [Market ticker WebSocket](https://docs.kalshi.com/websockets/market-ticker) — includes `dollar_volume` in the documented ticker message; WebSocket requires API-key authentication
- [API keys and request signing](https://docs.kalshi.com/getting_started/api_keys)
- [Get positions](https://docs.kalshi.com/api-reference/portfolio/get-positions)
- [Get fills](https://docs.kalshi.com/api-reference/portfolio/get-fills)
- [Create-order quick start](https://docs.kalshi.com/getting_started/quick_start_create_order)
- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Repository review

The starting repository contained only a minimal README and no application, market data, credentials, requirements, or existing task board. `COORDINATION.md` records the task scope, sources inspected, verification performed, and remaining issues. See the site's **Decision checklist** and **Flagged for review** pages before using its output to make trading or implementation decisions.

# Executive Summary — KalshiDash2

**As of:** 2026-11-20 (UTC)

**Purpose:** a no-build, read-only-by-default dashboard for the Kalshi **demo** exchange. It organizes currently discovered events in five requested topics—gas prices, elections, culture, crypto, and golf—tracks exchange-reported yes/no resolution, displays price/liquidity, and provides a separate browser-only paper-trading experiment.

## Published site

- **Live Pages:** <https://kanlerxz87-cyber.github.io/KalshiDash2/>
- **Live alerts and paper strategies:** <https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html>
- **Flagged for review:** <https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html>
- GitHub Pages is configured to publish `main:/` (repository root). The older `docs/` site generation remains in the repository and is reachable separately; it is not the canonical landing page.

## Official demo APIs

The dashboard's configured read base is Kalshi's recommended demo REST endpoint `https://external-api.demo.kalshi.co/trade-api/v2`; its WebSocket setting is `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`. The documented alternatives are `https://demo-api.kalshi.co/trade-api/v2` and `wss://demo-api.kalshi.co/trade-api/ws/v2`. Public market reads do not require credentials. Portfolio and trading requests require a separate demo API key and private key; credentials are entered in the Portfolio page and kept in that browser tab. No user credentials are included in the repository.

Official references: [Demo environment](https://docs.kalshi.com/getting_started/demo_env), [API environments](https://docs.kalshi.com/getting_started/api_environments), [Get Events](https://docs.kalshi.com/api-reference/events/get-events), [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Get Event](https://docs.kalshi.com/api-reference/events/get-event), [Market lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [Market settlement](https://docs.kalshi.com/getting_started/market_settlement).

## What is implemented

- **Overview and topic pages:** live event discovery for gas, elections, culture, crypto, and golf; ranking controls; a derived money-traded metric (`volume_fp × last_price_dollars`) alongside contract volume and open interest; event detail and official per-row source links.
- **Charts and liquidity:** time-versus-price charts with short live samples and longer official candlesticks; order-book depth shows contracts at each resting price level. Kalshi's candlestick API does not provide seconds-resolution history: short windows are samples accumulated while the tab is open. See [candlestick docs](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) and [orderbook response docs](https://docs.kalshi.com/getting_started/orderbook_responses).
- **Resolution:** tracked and recently settled markets show the API's `result` field (`yes` or `no`); the dashboard does not infer outcomes from price.
- **Live alerts:** [Live alerts](https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html) compares `last_price_dollars` between polls and against the exchange's own `previous_price_dollars`, and generates an alert for an absolute change of at least $0.10 in either direction. Every message states which comparison produced it, and a table view of the same events links the official API response behind each price. It has an **All alerts** feed and a **High-ROI watch** filtered by explicit spread, price-band, quote-availability, and open-interest rules. The label is not a claim of predicted or measured ROI.
- **Strategy tester:** strategy rules are replayed over official one-minute candlesticks and every simulated trade is scored against the market's own `settlement_value_dollars`. YES and NO entry prices are calculated using the complement relationship (NO cost = 1 − YES quote); a pre-existing NO-side P&L error is corrected and flagged as F17, so prior NO-side results should be regenerated. Results now include a seeded random-control baseline, breakdowns by topic and direction, and a CSV export with official-source URLs. The baseline is reproducible for a given ticker/history, but is not a prediction or a statistical significance test. The assumptions (fees modelled from the official schedule; no spread, no slippage) are printed above the results, and the simulated result remains optimistic by an amount the site cannot quantify (F15). A live paper-trading book on the same page is driven by the same alert engine as the Live alerts page.
- **Paper strategies:** four automatic browser-local paper strategies (Follow/Fade on All alerts and High-ROI watch). They assume entry at the displayed ask, mark open positions at the best bid, and settle only on the official yes/no result. They do not place exchange orders. Simulated fills omit fees, slippage, and queue position; outcomes are not evidence of a profitable live strategy.
- **Portfolio and order placement:** balance, positions, fills, and guarded V2 demo order placement are available when the user supplies a demo key pair. No key was supplied for this build, so no real account performance or end-to-end fill is claimed. See [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2), [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills), and [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions).
- **Decision and audit pages:** Strategies, Suggestions, Questions, Verification, Sources, and Flagged for Review. Dynamic market-data rows on the published root pages link to an official endpoint response; private-account rows link to the official endpoint documentation.

## Coverage and limitations (not assumptions)

- Alerts poll only while the browser page is open. The current universe is deliberately partial: at most 12 pages of 200 open events are scanned, then the top 30 open markets per topic by the configured money-traded ranking are watched. Markets outside that set can move without an alert. See Flagged items A2 and A6.
- A price alert observes the last traded price between polls. Quote-only movements and moves that occur and reverse inside one poll are not detected (A3). Event `settlement_sources` are context links, **not verified causes** of price jumps (A4).
- The High-ROI watch is a rule set, not a validated model (A1). Paper P&L is optimistic because fees, slippage, and queue position are not modeled (A5).
- The gas-price page may be empty when no matching open demo events are found; the 2026-11-20 scan recorded zero in its 1,000-event sample (F4). This is not evidence that the production exchange has no gas markets.
- Browser streaming has not been verified; polling is used (F10). Public unauthenticated numeric rate limits are not published in the cited docs (F3).
- A moderate security advisory affects the **test-only** `esbuild@0.24.2` dependency; it is recorded as A10 with the [official GitHub advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99). It is not a runtime dependency of the static Pages site.

## Verification and delivery

The root-site static link-check workflow and alert test suite passed on the merged work. Local checks include 18 alert-core tests, 5 simulator-core tests, 16 alerts-page DOM checks, an executive-summary DOM regression that verifies requirement/claim/flag totals against their source registers and checks evidence labels on every summary row, the repository link checker, JavaScript syntax checks, and `git diff --check`. The simulator tests cover YES/NO P&L, random-control repeatability, topic/direction rollups, and CSV source/escaping behavior. The live read-only demo API probe and its observations are recorded in [`reports/alerts-live-check.md`](reports/alerts-live-check.md); those point-in-time observations are not treated as permanent market facts.

- Feature and source-link changes: [PR #20](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/20), merged at `69196e0`.
- Deployment record: [PR #21](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/21).
- GitHub Pages deployment succeeded: [run 44745300283](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44745300283); Pages API reported `built` from `main:/`.
- **Review register:** all unresolved or deliberately limited items are listed on the [Flagged for Review page](https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html), with official sources where available. Blank or unavailable values are not inferred.

Demo only: funds are simulated, and demo prices may differ from production. KalshiDash2 is not affiliated with or endorsed by Kalshi.

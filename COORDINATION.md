# Coordination board

This repository had no prior `COORDINATION.md`, task claims, application code, or market-data files when this session began. Work is on the assigned active Arena branch `arena/e000cb69-kalshidash2`; branch/worktree names remain governed by the session instructions.

| Task                                                                                | Status | Owner/session                | File scope                                                                                                       |
| ----------------------------------------------------------------------------------- | ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Build an evidence-first Kalshi demo dashboard, documentation, and GitHub Pages site | done   | `arena/e000cb69-kalshidash2` | `index.html`, `styles.css`, `app.js`, `README.md`, `COORDINATION.md`, `.nojekyll`, `.github/workflows/pages.yml` |

## Verification and sources

- Reviewed the original repository: it contained only a 13-byte `README.md`; there was no app, data, account configuration, or existing task board.
- Inspected official Kalshi documentation (all facts below refer to schemas/guides, not example payload values):
  - Demo environment and recommended/alternate API URLs: https://docs.kalshi.com/getting_started/demo_env
  - REST/WebSocket environments: https://docs.kalshi.com/getting_started/api_environments
  - Market list, status filters, fields, 1,000-record page limit and cursor: https://docs.kalshi.com/api-reference/market/get-markets
  - Orderbook returns YES and NO bid ladders with fixed-point contract sizes: https://docs.kalshi.com/api-reference/market/get-market-orderbook
  - Historical candlestick intervals are 1, 60, and 1,440 minutes: https://docs.kalshi.com/api-reference/market/get-market-candlesticks
  - Ticker message schema includes `dollar_volume`; its WebSocket API connection requires API-key authentication: https://docs.kalshi.com/websockets/market-ticker
  - Private-key signing and API-key handling: https://docs.kalshi.com/getting_started/api_keys
  - Authenticated positions and fills schemas: https://docs.kalshi.com/api-reference/portfolio/get-positions and https://docs.kalshi.com/api-reference/portfolio/get-fills
  - Order lifecycle / authorization prerequisites: https://docs.kalshi.com/getting_started/quick_start_create_order
  - Market settlement background: https://docs.kalshi.com/getting_started/market_settlement
  - GitHub Pages custom workflow requirements: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Verification performed: `node --check app.js` passed; Python's HTML parser accepted `index.html`; a repository check confirmed all 12 navigation routes, local assets, and all 26 static table rows have official HTTPS source links; a local HTTP smoke test returned HTTP 200 for `/`, `index.html`, `styles.css`, and `app.js`.
- Live API data was not verified from the sandbox. Outbound network restrictions prevented a direct runtime request to Kalshi demo endpoints. The UI therefore reports current API failures and never substitutes example values. Browser-side CORS availability also remains unverified.

## Flagged irregularities / decisions not made

1. “Highest dollar amount” is ambiguous. REST list values displayed are contract volume and open interest, not dollars. The official ticker WebSocket schema includes `dollar_volume`, but its time window/desired ranking semantics and event-level aggregation need confirmation; a key-authenticated WebSocket integration is not present. The site does not label contract volume as USD.
2. The site displays individual market records, not a complete event-grouped dashboard. Topic assignment is only a transparent title/subtitle/ticker keyword match and may miss/incorrectly include markets.
3. No demo-account credentials or account authorization were supplied. Portfolio metrics, fills, performance, and trade execution remain blank/unimplemented. Private keys must stay server-side; demo-only authorization, order limits, approval policy, and a kill switch remain design decisions.
4. The selected-market chart samples public REST state every 15 seconds in browser memory; it is not a historical/guaranteed exchange stream. Official candlesticks document 1-, 60-, and 1,440-minute intervals. Reloading clears observations.
5. Pages deployment still depends on repository Pages settings and successful workflow checks; those settings cannot be established by the local static-site smoke test.

## Log

- 2026-11-20: Claimed and pushed the task-board entry before starting the site work. No other task claims existed.
- 2026-11-20: Completed the static dashboard and evidence/decision pages, validated the official source references listed above, and recorded remaining gaps. No account-specific or live market values were invented. GitHub PR/deployment outcome: pending.

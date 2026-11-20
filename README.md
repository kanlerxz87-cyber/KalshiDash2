# KalshiDash2

A static dashboard of Kalshi markets for **gas prices, elections, culture, crypto, and golf**, with every value sourced and irregularities flagged.

Live site (GitHub Pages, served from `main` root): https://kanlerxz87-cyber.github.io/KalshiDash2/

## Pages

- `index.html` — executive summary and section tiles
- `live.html` — live dashboard (reads the public Kalshi API in your browser): market table, price chart, order-book liquidity
- `pages/` — topic pages (gas, elections, culture, crypto, golf), resolved markets, analysis, portfolio (blocked), questions and gaps, suggestions for review, **Flagged for Review**, sources

## Data

- `data/snapshot.json` — the only data source for the static pages. Each row has a `source_url` pointing at the official Kalshi API response or EIA table it came from. Values that could not be confirmed are left blank and flagged.

## Build and check

```sh
node scripts/build.js   # regenerates the HTML pages from data/snapshot.json (no dependencies)
node scripts/check.js   # checks source links, flag references, internal links, and JS syntax
```

Official references: Kalshi API docs at https://docs.kalshi.com (llms index: https://docs.kalshi.com/llms.txt), EIA at https://www.eia.gov.

## Coordination

Shared task board: `COORDINATION.md`.

## Not informational advice

Nothing here is investment advice. No trades have been placed.

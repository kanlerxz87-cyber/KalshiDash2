# EXECUTIVE SUMMARY — KalshiDash2

Built and verified 2026-11-20. Targets the **Kalshi demo** exchange only.

## What this is

A static dashboard published from `docs/` on GitHub Pages that:

1. Ranks live Kalshi demo **events** by dollar amount across five topics — gas
   prices, elections, culture, crypto, golf.
2. Follows each one until the exchange resolves it, and records the resolution
   as **yes** or **no**, copied from the API `result` field.
3. Reads a demo account's balance, positions and fills, submits demo orders, and
   analyses the results by category and strategy.
4. Shows a price chart with a time x-axis (seconds through days) and contract
   price on y, plus order-book depth answering "how many contracts are available
   at this price".
5. Proposes improvements with a decision gate each, and lists the questions that
   must be answered before a decision can be made.

## The one design decision everything else follows from

**The site does not depend on your browser being able to call Kalshi.**

Kalshi publishes no CORS policy, and every official example is server-side. So a
GitHub Actions workflow runs `scripts/collect_kalshi.py` every 15 minutes against
`https://external-api.demo.kalshi.co/trade-api/v2`, commits the JSON it received
to `docs/data/`, and the page reads that same-origin snapshot.

Consequences:
- Data appears even if the API blocks browsers.
- Every number is reproducible: `docs/data/meta.json` logs every request URL with
  its HTTP status and timestamp.
- If a request fails, the file records the error and stays empty. It never falls
  back to a remembered value.

## Requirements → where each one is met

| Requirement | Where | Notes |
|---|---|---|
| Executive summary | `docs/index.html`, this file | |
| Highest dollar-amount live events | `docs/dashboard.html` | Ranking is open interest × notional, both API fields. The definition is printed on the page because Kalshi does not define the metric. |
| Five topics only | `docs/dashboard.html` topic table | Uses the exchange's own `category`/`tags`, not keyword matching. |
| Track until resolved, yes/no | `docs/resolved.html` | `GET /markets?status=settled`; only `result == yes|no` counted. |
| Portfolio performance | `docs/portfolio.html` | Balance, positions, realized P&L per position, fees paid. |
| Analyse results, categorise trades, build strategies | `docs/analysis.html` | Deterministic strategy buckets, win rate on resolved rows only, net P&L on filled contracts. |
| Execute trades, track performance | `docs/portfolio.html` → journal → `docs/analysis.html` | `POST /portfolio/events/orders` (V2). Every accepted order is journaled and analysed. |
| Live interactive, price graph, time windows | `docs/dashboard.html` chart | 60 s / 5 m / 15 m / 1 h / 6 h / 24 h / 7 d. |
| Liquidity: contracts at a given price | `docs/dashboard.html` order book | Bids only, per documented semantics, with the implied-ask conversion. |
| Suggestions section with decision gates | `docs/suggestions.html` | 10 proposals, approval recorded per browser. |
| Questions and missing information | `docs/questions.html` | 10 rows: verified / assumed / unknown / how to settle it. |
| Live site with clean landing page and subpages | GitHub Pages | |
| Simple table format with sources | All pages | |
| Every value sourced or blank + flagged | `docs/verification.html`, `docs/flagged.html` | |

## Data contract

| File | Source request | What it holds |
|---|---|---|
| `docs/data/meta.json` | every request | generation time, base URL, full request log with status |
| `docs/data/exchange.json` | `GET /exchange/status` | exchange and trading flags, shard list |
| `docs/data/series.json` | `GET /series?include_volume=true` | full series taxonomy with volumes |
| `docs/data/topic-<t>.json` | `GET /series?category=&tags=` then `GET /markets?series_ticker=&status=open` | open markets per topic, ranked |
| `docs/data/resolutions.json` | `GET /markets?status=settled` | settled markets with `result`, `settlement_ts`, `expiration_value` |
| `docs/data/events.json` | `GET /events?status=open&with_nested_markets=true` | event-level aggregation |
| `docs/data/depth.json` | `GET /markets/{ticker}/orderbook?depth=50` | bid levels per topic leader |
| `docs/data/candles.json` | `GET /series/{s}/markets/{t}/candlesticks?period_interval=1` | 6 h of 1-minute candles |

## Key risks and unknowns

1. **Browser CORS is undocumented** (F1). Removed as a dependency for reads;
   still required for order submission, which is why trading is opt-in.
2. **No key can exist in this repo** (F2). Account panels are blank until you add
   a key in your own browser. That is deliberate, not a defect.
3. **Ed25519 keys cannot sign in a browser** (F3). Kalshi now defaults new keys
   to Ed25519; this site needs RSA. Decision recorded as S4.
4. **No gasoline market category exists** (F8). "Gas prices" is served by crude
   oil (`Oil & Gas`).
5. **Chart windows beyond 6 h are shorter than their labels** (F12). The page says
   so rather than extrapolating.
6. **P&L is gross of fees** on the analysis page (F13), because the journal does
   not store per-order fees.
7. **A settled market carries no topic field.** The topic is looked up by ticker
   and shown as "unmapped" when absent — never guessed.

## Recommendation

Read the site in this order: Verification → Flagged → Questions → Suggestions.
The first two tell you what is trustworthy; the last two tell you what to decide.
Do not add trading automation until Q7 (per-shard balances) and S4 (key format)
are answered.

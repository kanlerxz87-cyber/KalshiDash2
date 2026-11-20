# REPO_REVIEW.md — line-by-line review of KalshiDash2

Reviewed 2026-11-20 by session `de240b66` against the state of `main` at commit
`34bd4a8` (the merge of PR #2). Every finding below was checked against a primary
source. Where a source contradicts itself, both sides are linked.

Method

1. Read every tracked file and listed each factual claim it makes about Kalshi:
   endpoints, paths, field names, enum values, authentication rules and semantics.
2. Opened the corresponding page at <https://docs.kalshi.com/llms.txt> (the
   published documentation index) and compared field by field.
3. Cross-checked ambiguous shapes against the official `kalshi-typescript` SDK
   (published by Kalshi, generated from its OpenAPI specification) and against
   live demo API responses, which are saved with their request URLs under
   [`docs/data/`](docs/data).
4. Wrote `scripts/verify_site.py`, which fails the deploy on a broken internal
   link, missing shared asset, navigation drift, or a mangled identifier. It runs
   before Pages publishes.

Limits of this review, stated up front

- The sandbox this review ran in cannot open a network connection to
  `*.kalshi.co`. Documentation was read through a page fetcher, and live API
  shapes were captured through that same fetcher. The reproducible checks are the
  GitHub Actions runs, whose logs record each request.
- The review covers what is in the repository. Kalshi can change its API at any
  time; the collector surfaces a changed field as an error rather than as a
  quietly wrong number.

---

## Findings

| # | File | Location | Claim in the code | Verdict after checking the source | Source | Status |
|---|------|----------|-------------------|-----------------------------------|--------|--------|
| R1 | `docs/assets/app.js` | `DEMO_BASE` | `https://external-api.demo.kalshi.co/trade-api/v2` | **Correct.** The documented recommended demo REST root. | [API environments](https://docs.kalshi.com/getting_started/api_environments) | ok |
| R2 | `docs/assets/app.js` | `TOPICS`, `seriesMatchesTopic()` | Topics were found by scanning series text for keywords such as `gas`, `pop`, `coin` | **Wrong approach.** The exchange publishes an explicit taxonomy (`category`, `categories`, `tags`) plus a tag index, so classification does not need guessing. Keyword matching misfires: `gas` also matches "Vegas", `pop` matches "population". | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list), [tags by category](https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories) | fixed → collector filters with `category` + `tags` |
| R3 | `docs/dashboard.html` | `loadChart()` | Candles from `/markets/candlesticks?market_tickers=…`, read as `candlesticks[].candlesticks[]` | **Wrong path and wrong response shape.** The single-market endpoint is `/series/{series_ticker}/markets/{ticker}/candlesticks` returning `candlesticks[]` with `price.close_dollars` per candle. A batch endpoint `/markets/candlesticks` also exists but takes `market_tickers` and returns `markets[]`. The old code mixed the two. | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks), [Batch Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks) | fixed |
| R4 | `docs/assets/app.js` | `marketRow()` | Prices passed through a count formatter; `last_price` printed with no unit | **Wrong and ambiguous.** A price of 0.45 and a count of 0.45 rendered identically. | [Fixed-point representation](https://docs.kalshi.com/getting_started/fixed_point_migration) | fixed → cents/dollars formatter for `*_dollars` |
| R5 | `docs/portfolio.html` | fill rows | Direction read from `side` | **Deprecated field.** Canonical fields are `outcome_side` and `book_side`; `side`/`action` remain only until removal. | [Order direction](https://docs.kalshi.com/getting_started/order_direction) | fixed |
| R6 | `docs/portfolio.html` | `placeOrder()` | Body `{ticker, side, count, price, time_in_force, self_trade_prevention_type, client_order_id}` with `side` from a bid/ask selector | **Mostly correct, and this corrects an earlier over-claim.** The V2 schema does require `side` (`bid`/`ask`), `count` (fixed-point string), `price` (fixed-point dollar string), `time_in_force` and `self_trade_prevention_type`. The real defect was the label: it said "Buy Yes (bid) / Sell Yes (ask)" while the field is `BookSide`. | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | fixed → relabelled, pre-flight validation added |
| R7 | `docs/portfolio.html` | balance panel | `balance_dollars ?? balance ?? balance_fp` all through the dollar formatter | **Would overstate by 100×.** `balance` is an integer in cents; `balance_dollars` is the fixed-point dollar string. | [Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) | fixed → prefers `balance_dollars`, divides the integer form by 100, labels which was used |
| R8 | `docs/portfolio.html` | positions table | `market_positions || positions || []` and the row fields | **Correct field set.** Verified `position_fp`, `market_exposure_dollars`, `realized_pnl_dollars`, `fees_paid_dollars`, `last_updated_ts`. | [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) | ok |
| R9 | `docs/resolved.html` | `refresh()` | Settlement tracking driven by a hand-typed watch list polled every 30 s from the browser | **Fragile by design.** Requires browser CORS and only tracks while that tab is open. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | fixed → settled rows come from the collector via `status=settled` |
| R10 | `docs/dashboard.html` | topic list | The five topics are Kalshi categories | **Only four are.** There is no gasoline or pump-price bucket; `Oil & Gas` is crude. Golf is a tag under `Sports`, not a category. | [tags by category](https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories) | open, documented as F8 on the Flagged page |
| R11 | `.github/workflows/pages.yml` | whole file | Uploads `docs/` as a Pages artifact | **Correct workflow, wrong repository setting.** Pages was `build_type: legacy` from `main:/`, so the artifact was never published and the URL served `README.md`. | [Configuring a Pages source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) | fixed → Pages build type set to the workflow |
| R12 | `COORDINATION.md` | task board | Tasks 1–7 `done` | **Overstated.** No endpoint had been executed (the sandbox cannot reach `*.kalshi.co`), which is why R3, R4, R5 and R7 survived. | `COORDINATION.md` | fixed → board now separates executed from read-only checks |
| R13 | `docs/assets/app.js` | `signRequest()` | RSA-PSS, SHA-256, salt length 32, over `timestamp + METHOD + path` | **Correct**, including omitting the query string. | [API keys](https://docs.kalshi.com/getting_started/api_keys) | ok |
| R14 | `docs/assets/app.js` | `pemToArrayBuffer()` | Private key imported as `spki` | **Wrong import format.** A private key imports as `pkcs8`; `spki` is for public keys. Every signed request would throw. | [SubtleCrypto.importKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey) | fixed |
| R15 | `docs/index.html` | landing page | Presented the site as working | **No provenance and no limitations.** Linked to pages that could not have worked (R3, R14) with no statement of where numbers come from. | — | fixed → rewritten |
| R16 | `README.md` | whole file | `# KalshiDash2` | **No usable description.** No data source, no verification rule, no way to run the collector. | — | fixed |
| R17 | `docs/assets/app.js` | `TOPICS.culture` | `keywords` included `pop` | **Demonstrates R2.** Matches "population" in any series title. | [tags by category](https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories) | fixed → keyword matching removed |
| R18 | `docs/index.html` | executive summary table | Cited `https://docs.kalshi.com` as the source for hosts and the order endpoint | **A domain is not a citation.** No reader could reach the page that supports the claim. | [API environments](https://docs.kalshi.com/getting_started/api_environments) | fixed → exact page per claim |
| R19 | `docs/verification.html` | table rows | Marked "verified" against `https://docs.kalshi.com` (the site root) | **Unfalsifiable.** A "verified" badge must point at the page that contains the claim. | — | fixed → every row links an exact page |
| R20 | `docs/assets/app.js` | `drawChart()` | y axis formatted as `$v.toFixed(2)` | **Slightly wrong.** Contract prices are 0–1 dollars and the UI elsewhere shows cents; mixing `$0.42` and `42¢` in one view invites misreading by 100×. | — | fixed → one price formatter |
| R21 | `docs/portfolio.html` | `authApi()` | Error surfaced as `HTTP 400: {…}` | **Correct behaviour**, but the code did not distinguish the documented error codes (`invalid_price`, `market_inactive`, `insufficient_balance`, `order_already_exists`). | [Order errors](https://docs.kalshi.com/getting_started/order_errors) | fixed → error `code` is extracted and shown |
| R22 | `docs/analysis.html` | analysis | Only fills loaded from `localStorage` were analysed | **Correctly honest but incomplete.** Orders placed in the Kalshi web UI never appeared, which reads as "no data" rather than "not imported". | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | fixed → explicit import from `/portfolio/fills`, with the source labelled per row |

---

## Cross-check: documentation that contradicts the schema

These are defects in Kalshi's own documentation, not in this repository. They are
listed because following the quick-start literally produces an invalid request.

| Doc page | What it says | What the schema says | Consequence |
|----------|--------------|----------------------|-------------|
| [Quick Start: Create your first order](https://docs.kalshi.com/getting_started/quick_start_create_order) | Example body `{"ticker":…, "side":"bid", "count":"1", "price":"0.0100", …}` | `CreateOrderV2Request` requires `ticker`, `side`, `count`, `price`, `time_in_force`, `self_trade_prevention_type` — all six. [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | The example omits two required fields. Submitted as written it fails validation. |
| [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) | "WebSocket connections require authentication during the connection handshake", then lists `ticker`/`trade`/`market_lifecycle_v2` as public channels | Both statements can hold, but the phrasing invites anonymous connections | This site does not open a WebSocket and does not assume either behaviour (F14). |
| [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | `category` filter is "exact and case-sensitive" and matches any entry in `categories` | A returned series' primary `category` may differ from the filter | The site prints the filter it used rather than asserting a primary category. |

## Repository irregularities

| Item | Detail | Handling |
|------|--------|----------|
| No `LICENSE` | The repository has none, so the reuse terms of the published site are undefined. | Not added in this session; recorded as an open item for the owner. |
| No tests before this session | Nothing exercised the pages, which is how R14 (a guaranteed runtime failure) shipped. | `scripts/verify_site.py` now gates the deploy. |
| No `.gitignore` | Build noise could be committed. | Added, covering Python caches and local test scaffolding. |
| Pages source mismatch | The workflow built `docs/` but Pages served `main:/`. | Fixed (R11). |
| Two agents, one board | `COORDINATION.md` recorded a single owner across two branches. | Board rewritten to separate claims; this session's claim was pushed before any edit. |

## Files reviewed

`README.md`, `COORDINATION.md`, `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`,
`SUGGESTIONS.md`, `VERIFICATION.md`, `.github/workflows/pages.yml`,
`docs/index.html`, `docs/dashboard.html`, `docs/portfolio.html`,
`docs/resolved.html`, `docs/analysis.html`, `docs/suggestions.html`,
`docs/questions.html`, `docs/verification.html`, `docs/flagged.html`,
`docs/assets/app.js`, `docs/assets/style.css`.

Files added by this review: `REPO_REVIEW.md`, `scripts/collect_kalshi.py`,
`scripts/verify_site.py`, `.github/workflows/collect.yml`, `docs/review.html`,
`docs/data/*.json`, `.gitignore`.

## How to re-check any row

```bash
# 1. fetch the live documentation index and confirm a page exists
curl -s https://docs.kalshi.com/llms.txt | grep -i candlestick

# 2. confirm a field name against the official SDK type definitions
npm i kalshi-typescript && grep -n "end_period_ts" \
  node_modules/kalshi-typescript/dist/models/market-candlestick.d.ts

# 3. confirm what the demo API actually returned, with the request URL
python3 -m json.tool docs/data/meta.json | less

# 4. re-run the structural checks that gate the deploy
python3 scripts/verify_site.py
```

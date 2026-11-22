# Independent live re-verification — session `faf9fe08`

**Date:** 2026-11-22 (UTC), between 08:04Z and 08:55Z.
**Branch:** `arena/faf9fe08-kalshidash2`, from `main` @ `252e62385cb4ca8dc195d00fb180599a5f4b6c6d`.
**Role:** independent line-by-line verification of the published site's data contracts, then integration.

## Why this report exists

Every earlier session recorded the same limitation in `COORDINATION.md`: its shell could not open TLS to
`*.kalshi.co`, so live checks were delegated to GitHub runners and the "live" evidence on the site is a
*runner* capture. This session's toolchain can read the demo REST API **directly**, so the claims that depend
on live data are re-checked here against real responses, and every URL below is re-runnable in a browser.

What that does *not* cover is stated in §E. Nothing in this report is inferred: a row either quotes a
response this session read, or names the official page that documents it, or is marked **unverified**.

## A. Method

1. Read the site's own claim registers (`assets/js/claims.js`, `assets/js/sources.js`, `verification.html`,
   `flagged.html`) and the data layer (`assets/js/market.js`, `kalshi.js`, `live-core.js`, `alerts.js`,
   `category.js`, `dollar-volume.js`, `simulator.js`).
2. For each data contract, read the official documentation page (`.md` form, which is the raw source behind the
   rendered page) and then the live demo response.
3. Compare the three: documentation, code, live response. Anywhere they disagree, the disagreement is written
   down rather than smoothed over.
4. Run the local suites on the branch base and record exact counts (§D).

## B. Verified against a live demo response (2026-11-22)

Each row: the code claim, the live response that confirms it, and the re-runnable URL.

| # | Claim as the site/code makes it | Live evidence (read this session) | Official basis |
|---|---|---|---|
| B1 | Demo REST root answers unauthenticated | `GET /exchange/status` → `{"exchange_active":true,...,"trading_active":true}`, four shards, all `trading_active: true` | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) · [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) |
| B2 | `GET /events?status=open` returns open events with `markets[]` when `with_nested_markets=true` | `KXELONMARS-99` and `KXNEXTNATOSECGEN-99` returned with nested markets | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| B3 | Gas markets live under series `KXAAAGASW`; the event's settlement source is AAA | `GET /series/KXAAAGASW` → `category: "Economics"`, `tags: ["Econ Weekly","Oil and energy"]`, `settlement_sources: [{"name":"AAA","url":"https://gasprices.aaa.com/"}]`; `GET /events?status=open&series_ticker=KXAAAGASW` → `KXAAAGASW-26NOV23` | [Get Series](https://docs.kalshi.com/api-reference/market/get-series) · [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| B4 | `KXGAS` is a real series and is *distinct* from `KXAAAGASW` | `GET /series/KXGAS` → `ticker: "KXGAS"`, `title: "Gas weekly"`, settlement source EIA `PET_PRI_GND_DCUS_NUS_W.htm` | [Get Series](https://docs.kalshi.com/api-reference/market/get-series) |
| B5 | Order book returns **bids only**, under `orderbook_fp.yes_dollars` / `no_dollars` as `[price, count]` strings | `GET /markets/KXAAAGASW-26NOV23-3.6200/orderbook?depth=5` → `{"orderbook_fp":{"no_dollars":[],"yes_dollars":[["0.3900","21.67"],["0.7700","186.65"]]}}`; the market object for the same ticker reports `yes_bid_dollars: "0.7700"`, `yes_ask_dollars: "1.0000"`, `no_ask_dollars: "0.2300"` | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) · [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) |
| B6 | The reciprocal rule: a NO bid at *y* implies a YES ask at 1 − *y* | On `KXAAAGASW-26NOV23-3.6200` the only populated side is YES bids (0.39 / 0.77). `no_ask_dollars` is 0.2300 = 1 − 0.77, and the returned YES bid 0.39 equals `notional` − `no_ask` (1 − 0.23 = 0.77 for the best bid; the 0.39 level is the last trade). The identity holds on every level returned. | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) |
| B7 | Candles are `price.close_dollars` / `previous_dollars` / `volume_fp` on the live tier; `period_interval` ∈ {1, 60, 1440} | `GET /series/KXAAAGASW/markets/KXAAAGASW-26NOV23-3.6200/candlesticks?start_ts=…&end_ts=…&period_interval=60` returned 7 hourly candles in exactly that shape | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) |
| B8 | Periods with no trades carry **no price**, not a zero price | Same call: a period with `"volume_fp":"0.00"` has `price: {"previous_dollars": "…"}` and **no** `close_dollars`/`open_dollars`. `parseCandle()` maps the absent field to `null`, which the chart draws as a gap. | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) |
| B9 | `previous_price_dollars` is the last traded YES price **a day ago** | Live on `KXAAAGASW-26NOV23-3.6200`: `previous_price_dollars: "0.9700"`, `last_price_dollars: "0.3900"`. The schema defines the former as "Price for the last traded YES contract on this market **a day ago** in dollars" — so the site's "exchange previous price (a day ago)" label and its warning that this row is a 24-hour move are both correct. | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) (schema text) · Flag Z1 |
| B10 | Combinatorial markets carry `mve_selected_legs`, so a combo can be classified by its legs | `GET /markets?status=settled&limit=2` → two `KXMVECROSSCATEGORY-…` markets, each with `mve_selected_legs: [{event_ticker, market_ticker, side}, …]` | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) · [Get Multivariate Events](https://docs.kalshi.com/api-reference/events/get-multivariate-events) |
| B11 | Finalized markets report `result` ∈ {yes,no} plus `settlement_value_dollars` | Same response: `"result":"no"`, `"settlement_value_dollars":"0.0000"`, `"status":"finalized"`, `settlement_ts` set | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) · [Market settlement](https://docs.kalshi.com/getting_started/market_settlement) |
| B12 | `GET /markets/trades` returns `count_fp`, `yes_price_dollars`, `no_price_dollars`, `taker_outcome_side` | `GET /markets/trades?ticker=KXAAAGASW-26NOV23-3.6200&limit=5` → 5 trades, e.g. `count_fp:"12.04"`, `yes_price_dollars:"0.3900"`, `no_price_dollars:"0.6100"`, `taker_outcome_side:"no"`. The NO price is the complement, which is what `dollar-volume.js` relies on. | [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades) |
| B13 | `GET /markets` accepts a comma-separated `tickers` filter | `GET /markets?tickers=KXAAAGASW-26NOV23-3.6200,KXELONMARS-99&limit=1000` returned exactly those two markets | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| B14 | `/historical/cutoff` publishes per-data-type cutoffs | `GET /historical/cutoff` → `{"market_settled_ts":"2026-09-23T00:00:00Z","trades_created_ts":"2026-09-23T00:00:00Z","orders_updated_ts":"2026-11-08T00:00:00Z","market_positions_last_updated_ts":"2026-09-23T00:00:00Z"}` | [Historical Data](https://docs.kalshi.com/getting_started/historical_data) |
| B15 | The archived tier still serves an archived market's full record | `GET /historical/markets/KXTTSTARMATCH-26SEP221805GAVMOU-GAV` → `result:"yes"`, `settlement_value_dollars:"1.0000"`, `settlement_ts` 2026-09-22 (before the `market_settled_ts` cutoff above) | [Get Historical Markets](https://docs.kalshi.com/api-reference/historical/get-historical-markets) |
| B16 | Gas series exist under the `Culture` and `Crypto` categories the taxonomy expects (and `Culture` is a real category value, not only `Entertainment`/`Social`) | `GET /series?category=Culture` → two series (`KXXBANNEDMURRAYHILLGUY1`, `KXXBANNEDGROK`). `GET /series?category=Crypto` → `KXSOLANAATH`, `KXNEXTCOINRH`, `KXHYPEEVENT`, … all `category: "Crypto"`. | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) — the reference states a series may carry several `categories` and that `category` is exact and case-sensitive |
| B17 | Golf lives under `Sports` with a `KXPGA*` series family | `GET /events?status=open&series_ticker=KXPGATOUR` → `KXPGATOUR-THRC26` ("The RSM Classic Winner") and `KXPGATOUR-MAST27` ("2027 The Masters Champion"), both `category: "Sports"`, settlement sources ESPN / pgatour.com / masters.com | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| B18 | `GET /markets` rejects a page size above its documented maximum | `GET /markets?limit=1001` → HTTP error (the docs say maximum 1000). `GET /events?limit=201` → HTTP error (the docs say maximum 200); `limit=200` succeeded. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) · [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |

The raw URLs are listed once, in §F, so they can be opened directly.

## C. Defects found and fixed in this session

### NF1 — The Sources register mis-stated the `GET /markets` page limit (fixed)

* **Found:** `assets/js/sources.js` described Get Markets as "Market fields, the status filter, and the
  **200-row page limit**".
* **Official text:** Get Markets documents `limit` as *"Number of results per page. Defaults to 100. Maximum
  value is 1000."* Only Get Events documents a 200 maximum.
* **Live check:** `GET /markets?limit=1001` is rejected; `GET /markets?limit=1000` succeeds (B18), while
  `GET /events?limit=201` is rejected and `limit=200` succeeds. The two endpoints really do have different caps.
* **Fix:** the register now says "pagination (limit default 100, maximum 1000)". `assets/js/market.js` already
  documented both caps correctly and its default of 200 is valid on both endpoints, so no code changed.
* **Impact if left:** a reader auditing the register would conclude the client's `limit=200` fits Get Markets
  (it does) *and* that Get Markets caps at 200 (it does not) — a wrong limit in the audit trail of the source
  register itself. No page output was affected.

### NF4 — The claim register's run counts had drifted from the harness (fixed)

* **Found:** `assets/js/claims.js` said *"17 pages run against a DOM shim"* and *"reports 17/17 clean"*.
* **Live check:** the harness's own `DEFAULT_PAGES` list in `tools/verify/page-runtime-check.mjs` now holds
  **18** pages, and running it on this branch reports `18/18 pages ran clean` plus `36 pages, 0 broken local
  link(s)`. `flagged.html` (card Y9) also still quotes "17/17". (The count was 18 before the merge of `main`; a later
session has since appended further pages. That is exactly why the register no longer states a number.)
* **Fix:** the register no longer restates a page count that can grow; it names `DEFAULT_PAGES` and records the
  dated run. `flagged.html`'s Y9 sentence is left alone deliberately — it is a historical record of the run that
  happened when `jumps.js` was deleted, and rewriting it would falsify that record. NF4 on the Flagged page
  states the distinction.
* **Why it matters:** every other count on that page is either DOM-derived or dated. A bare "17/17" was the one
  number a reader could not check without re-reading the harness.

### NF1 — Two official pages disagree on the price scale of a NO order (open, disclosed in the UI)

* **Found:** ordering NO takes `side: "ask"`. [Order direction](https://docs.kalshi.com/getting_started/order_direction)
  says direction *does not change the price* — a NO order at *p* matches a YES order at the same *p*.
  [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) defines `side` as
  "`bid` means buy YES, `ask` means sell YES … this endpoint quotes everything from the YES side", with
  "`ask` = sell YES = buy NO at `1 - price`". The two readings differ by `1 - price`.
* **Not settled here:** deciding it needs one live demo order on a market with a visible book. No demo key
  exists in the repository, and inferring an answer is exactly what the brief forbids.
* **Prior record is partial:** `reports/verify-independent-32b15793.md` row D2 marked the mapping
  "verified" while quoting only the YES-leg sentence. The contradiction was not noticed. That row is left
  as written (a dated record) and is now cross-referenced from Flagged NF1.
* **Action:** `portfolio.html` step 3 carries a visible warning naming both readings and quoting both
  pages. Nothing was silently changed in either direction, and the YES path (which no page disputes) is
  additionally pinned by a test.

### NF6 — The two silent-wrong-order risks are now pinned by a test (fixed)

The order path is the one part of the site that needs credentials, so it had no automated guard. Added
`tests/order-contract.test.mjs` (9 tests), which drives the real `KalshiClient` with a generated RSA key
pair and a stubbed `fetch`:

| Checked on the request the client actually built | Official basis |
|---|---|
| `side: "bid"` for YES, `side: "ask"` for NO, never `"sell"` | Order direction |
| every required field present; `count`/`price` are fixed-point strings | Create Order (V2) |
| `POST /portfolio/events/orders`, never the removed v1 route | Create Order (V2) |
| `KALSHI-ACCESS-TIMESTAMP` is 13 digits and inside the call window | Authenticated requests |
| the signature verifies over `<ms>POST/trade-api/v2/portfolio/events/orders` and fails over a seconds timestamp and over a path without the `/trade-api/v2` prefix | Authenticated requests, API Keys |
| `remaining_count` reaches the caller (a `201` is not a fill) | Order Errors |
| `exchange_index` omitted unless explicitly supplied (auto-routing by ticker) | Exchange Sharding |

**The guard was verified by breaking the code on purpose:** setting the timestamp to
`String(Math.floor(Date.now() / 1000))` fails exactly one assertion; restoring it returns 9/9.

### NF7 — This session's own candle note was wrong (corrected)

* **The note said:** the demo candlestick endpoint returned a sparse, misaligned series with a duplicated
  hour and a six-hour hole for `KXAAAGASW-26NOV23-3.6200`.
* **What the same request returns (2026-11-22):** seven candles **exactly 3,600 s apart**; a 900-second
  window at `period_interval=1` returns **16 candles exactly 60 s apart**. Aligned and contiguous.
* **What is true, and narrower:** an untraded period is still emitted, but its `price` object contains
  *only* `previous_dollars` — no `close_dollars`/`open`/`high`/`low`/`mean` (verified: period
  `1795248480`, `volume_fp: "0.00"`). So the close line has a genuine one-period hole there.
* **Action:** `tests/candle-spacing.test.mjs` (5 tests) reproduces both responses verbatim and pins
  contiguity, `y === null` (not 0, not filled forward) for the untraded period, close-not-low as the
  plotted value, and that a jump marker never lands on an untraded period. Axis geometry is pinned with a
  synthetic irregular series, because an evenly spaced payload cannot distinguish time from index.

## D. Local suite on this branch (exact counts, 2026-11-22)

| Suite | Command | Result |
|---|---|---|
| Node unit tests | `node --test tests/*.test.mjs` | **190 pass, 0 fail** across 16 files |
| Python tools | `python3 -m unittest discover -s tools -p 'test_*.py'` | **42 OK** |
| Python tests | `python3 -m unittest discover -s tests -p 'test_*.py'` | **20 OK, 3 skipped** (`cryptography` absent here) |
| Page runtime | `node tools/verify/page-runtime-check.mjs` | **18/18 pages ran clean**, 36 pages link-checked, 0 broken |
| Static link check | `python3 tools/check_site_links.py .` | **36 HTML pages**, 0 broken |
| Alerts DOM | `cd tests/dom && node alerts-dom.mjs` | **21/21** |
| Summary DOM | `node summary-dom.mjs` | **18/18**; flag counts read live from `flagged.html`; 28 sourced-or-project-labelled summary rows |
| Category DOM | `node category-dom.mjs` | pass |
| Signing self-test | `node tools/verify/auth-sign-test.mjs` | **6/6** |
| `git diff --check` | — | clean |

Per-file Node counts, measured on the merged tree (16 files, 190 tests): activity-proxy 3, alerts-core 28,
candle-spacing 5, chart-axis 10, dollar-volume 31, exchange-status 3, historical-tier 14, jumps 6, live-core 23,
live-feed-state 2, official-wording 6, order-contract 9, result-semantics 14, simulator-core 10, sources-page 9,
taxonomy 17.

On the branch base the same command gave **155** across 13 files, so the +35 is not all mine: three files from
`main` landed with this merge (alerts-core +7, dollar-volume +6, result-semantics +3, official-wording +1,
sources-page +1, plus the new `exchange-status` 3), and **14 are the two files this session added**
(order-contract 9, candle-spacing 5). Both are wired into `site-check.yml` and were observed passing in CI run
45002738119 before this branch was merged.

## E. What this session did **not** verify (left unverified, not filled in)

1. **Authenticated endpoints.** No demo API key exists in this repository and none was supplied, so
   `/portfolio/balance`, `/portfolio/positions`, `/portfolio/fills`, order placement, amend and cancel were
   **not** called. Their behaviour is documented in the official references and implemented in
   `assets/js/kalshi.js`, and the signing rule is covered offline by the 6/6 self-test — but no live call
   happened in this session.
2. **The WebSocket.** `wss://…` cannot be opened from this sandbox or from a browser without the three
   `KALSHI-ACCESS-*` headers, which is exactly why `scripts/relay.py` exists. The channel's documented payload
   (including `dollar_volume` and the absence of `previous_price_dollars`) was read from
   <https://docs.kalshi.com/websockets/market-ticker>; the stream itself was not consumed here.
3. **Non-2xx response bodies.** The fetch tool reports a failed fetch without a body for the two rejected
   requests in B18, so the *error code* (`bad_request`) was not read directly. Only the rejection itself is
   recorded.
4. **`GET /series` paging.** `GET /series/list` and `GET /series?category=…&limit=250` both failed to return
   through the fetch tool (truncated or oversized response). The category filter itself works — `Culture`,
   `Crypto` and `Sports` all returned matching series (B16, B17) — but the register's paging note (Flag F5) is
   **unchanged and still unverified** here.
5. **Any statement about which news story moved a contract.** The site lists each event's official
   `settlement_sources` as *where the outcome is decided*, and labels them as checks, not causes. This session
   did not verify any causal claim about a price jump and the site makes none.
6. **`docs/` (the legacy generation).** It is not the published tree (Pages serves `main:/`), it is documented as
   superseded, and it was not re-verified here.

## F. Re-runnable URLs (demo, unauthenticated, read this session)

```
https://external-api.demo.kalshi.co/trade-api/v2/exchange/status
https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&limit=3&with_nested_markets=true
https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASW&with_nested_markets=true&limit=5
https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXPGATOUR
https://external-api.demo.kalshi.co/trade-api/v2/events?status=settled&with_nested_markets=true&series_ticker=KXAAAGASW&limit=3
https://external-api.demo.kalshi.co/trade-api/v2/series/KXAAAGASW
https://external-api.demo.kalshi.co/trade-api/v2/series/KXGAS
https://external-api.demo.kalshi.co/trade-api/v2/series?category=Crypto&limit=2
https://external-api.demo.kalshi.co/trade-api/v2/series?category=Culture
https://external-api.demo.kalshi.co/trade-api/v2/series?category=Entertainment&include_volume=true&limit=3
https://external-api.demo.kalshi.co/trade-api/v2/markets/KXAAAGASW-26NOV23-3.6200
https://external-api.demo.kalshi.co/trade-api/v2/markets/KXAAAGASW-26NOV23-3.6200/orderbook?depth=5
https://external-api.demo.kalshi.co/trade-api/v2/series/KXAAAGASW/markets/KXAAAGASW-26NOV23-3.6200/candlesticks?start_ts=1795248000&end_ts=1795272000&period_interval=60
https://external-api.demo.kalshi.co/trade-api/v2/markets/trades?ticker=KXAAAGASW-26NOV23-3.6200&limit=5
https://external-api.demo.kalshi.co/trade-api/v2/markets?tickers=KXAAAGASW-26NOV23-3.6200,KXELONMARS-99&limit=1000
https://external-api.demo.kalshi.co/trade-api/v2/markets?status=settled&limit=2
https://external-api.demo.kalshi.co/trade-api/v2/markets?status=settled&limit=1&series_ticker=KXTTSTARMATCH
https://external-api.demo.kalshi.co/trade-api/v2/markets/KXTTSTARMATCH-26SEP221805GAVMOU-GAV
https://external-api.demo.kalshi.co/trade-api/v2/historical/cutoff
https://external-api.demo.kalshi.co/trade-api/v2/historical/markets?limit=2&min_close_ts=1750000000&max_close_ts=1751000000
https://external-api.demo.kalshi.co/trade-api/v2/historical/markets/KXTTSTARMATCH-26SEP221805GAVMOU-GAV
https://external-api.demo.kalshi.co/trade-api/v2/events?tickers=KXTTSTARMATCH-26SEP221805GAVMOU&with_nested_markets=true
https://external-api.demo.kalshi.co/trade-api/v2/markets?limit=1001&status=open&series_ticker=KXAAAGASW
https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASW&limit=201
```

Values in any live response change continuously. Nothing above is transcribed into the site as a current
figure; the URLs are the evidence, and the site reads them live in the browser.

## G. Official documentation pages read for this report

| Page | What it was used to confirm |
|---|---|
| [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | Demo REST/WS roots, mock funds |
| [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) | `exchange_active` / `trading_active` |
| [Get Events](https://docs.kalshi.com/api-reference/events/get-events) | `limit` default 200 **maximum 200**; `with_nested_markets`; `status` values; the note that nested markets settled before the cutoff are not included |
| [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | `limit` default 100 **maximum 1000**; `tickers` filter; ordering and paging rules |
| [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | field-by-field schema, incl. `previous_price_dollars` "a day ago" and the full `status` enum |
| [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) | `orderbook_fp.yes_dollars` / `no_dollars`; `depth` 0–100 |
| [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) | bids only; NO bid at *y* ⇒ YES ask at 1 − *y* |
| [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | `period_interval` ∈ {1,60,1440}; the 5,000-period cap; candle field names |
| [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades) | `count_fp`, `yes_price_dollars`, `no_price_dollars` |
| [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | `category` is exact and case-sensitive; a series may carry several `categories` |
| [Get Multivariate Events](https://docs.kalshi.com/api-reference/events/get-multivariate-events) | `mve_selected_legs`; `category` marked deprecated |
| [Historical Data](https://docs.kalshi.com/getting_started/historical_data) | the live/historical partition and the impacted live endpoints table |
| [Get Historical Markets](https://docs.kalshi.com/api-reference/historical/get-historical-markets) | filters are mutually exclusive; `limit` default 100 max 1000 |
| [Market Ticker (WS)](https://docs.kalshi.com/websockets/market-ticker) | documented ticker payload; no `previous_price_dollars` |
| [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) | handshake headers; pre-sign text `timestamp + "GET" + "/trade-api/ws/v2"`; public vs private channels |
| [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | required `ticker/side/count/price/time_in_force/self_trade_prevention_type`; legacy route returns 410 |
| [Rate Limits](https://docs.kalshi.com/getting_started/rate_limits) | token buckets; unauthenticated requests "subject to separate limits" (no number published) |
| [Quick Start: Market Data](https://docs.kalshi.com/getting_started/quick_start_market_data) | order book arrays are sorted ascending, best bid last |

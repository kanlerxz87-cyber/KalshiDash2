# Independent line-by-line verification — session `32b15793`

**Date:** 2026-11-21 (UTC)
**Branch:** `arena/32b15793-kalshidash2` (based on `main` @ `bbdc3a0`, merged forward to `b254e21`)
**Scope:** independent re-check of the *published* site's factual claims and of the repo state. Read-only on
site code; defects are logged here as findings and requests, never silently rewritten.

## Method and its limits (read this first)

* **Official sources only.** Every fact below is checked against `docs.kalshi.com`, the official Kalshi fee
  schedule PDF (`kalshi.com/docs/kalshi-fee-schedule.pdf`), or a live response from the official demo API
  (`external-api.demo.kalshi.co`). Links are given per row.
* **How the live API was reached.** This sandbox cannot open a TLS connection to any `*.kalshi.co` host
  (`curl` exit 35 / HTTP status `000`; Python `urllib` reports `TLS/SSL connection has been closed`). That is
  the same harness limitation every prior session recorded. Live values in this report were therefore read by
  fetching the **documented endpoint URLs directly** (`https://external-api.demo.kalshi.co/trade-api/v2/...`),
  which does return the raw JSON. Every such value is marked **live** with the URL used.
* **No inference.** Where a value could not be confirmed from an official source it is left blank and marked
  **unverified** rather than filled in. Two items are marked unverified below for exactly that reason.
* **What was *not* re-checked.** Browser rendering (CORS, layout) and authenticated order placement
  (needs the owner's demo API key, which by policy is never committed). Both remain on the Flagged page.

## A. Environment, endpoints and transport

| # | Claim as published | Official source checked | Result |
|---|---|---|---|
| A1 | Demo REST root is `https://external-api.demo.kalshi.co/trade-api/v2` | [Test In The Demo Environment](https://docs.kalshi.com/getting_started/demo_env) — "Demo's recommended Trade API root is `https://external-api.demo.kalshi.co/trade-api/v2`" | **verified** |
| A2 | `https://demo-api.kalshi.co/trade-api/v2` is also supported | same page, table column "Also supported" | **verified** |
| A3 | Demo WebSocket is `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) "Connection URL" — "For the demo environment, use: `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`" | **verified** |
| A4 | `wss://demo-api.kalshi.co/trade-api/ws/v2` also remains supported | same section — "The existing shared WebSocket hosts ... remain supported" | **verified** |
| A5 | Demo funds are mock and demo prices may not match production | [demo_env](https://docs.kalshi.com/getting_started/demo_env) — "mock funds"; "The price and behavior of markets in the demo environment may not be reflective of those in real markets." | **verified** |
| A6 | A WebSocket connection requires authentication at the handshake (even for public channels) | [quick_start_websockets](https://docs.kalshi.com/getting_started/quick_start_websockets) — "WebSocket connections require authentication during the connection handshake ... even channels that carry public market data still use the authenticated WebSocket session" | **verified** |
| A7 | WebSocket pre-sign text is `timestamp + "GET" + "/trade-api/ws/v2"` | same page, "Signing the WebSocket Request" | **verified** |
| A8 | A browser cannot set the `KALSHI-ACCESS-*` headers on a WebSocket | Follows from A6 plus the Web platform `WebSocket` constructor, which takes only URL + subprotocols. Not stated by Kalshi. | **verified** (documented constraint; the browser limitation is a platform fact, not a Kalshi claim) |
| A9 | Public market data needs no key | [quick_start_market_data](https://docs.kalshi.com/getting_started/quick_start_market_data); confirmed **live**: `GET /exchange/status` returned `{"exchange_active":true,...,"trading_active":true}` with no credentials — <https://external-api.demo.kalshi.co/trade-api/v2/exchange/status> | **verified** |
| A10 | Tick payload carries `price_dollars` and **no** `previous_price_dollars` | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) — fields shown are `market_ticker, price_dollars, yes_bid_dollars, yes_ask_dollars, volume_fp, open_interest_fp, dollar_volume, dollar_open_interest, yes_bid_size_fp, yes_ask_size_fp, last_trade_size_fp, ts, ts_ms, time` | **verified** |

## B. Market data, charts and liquidity

| # | Claim as published | Official source checked | Result |
|---|---|---|---|
| B1 | Candlestick `period_interval` accepts **only** 1, 60 or 1440 minutes; there is no seconds-resolution candle API | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) — "Valid values are 1 (1 minute), 60 (1 hour), or 1440 (1 day)"; enum `1 / 60 / 1440` | **verified** |
| B2 | Candlestick route is `GET /series/{series_ticker}/markets/{ticker}/candlesticks` | same page — path shown verbatim in the request URL | **verified** |
| B3 | Candles require both `start_ts` and `end_ts` (no "now" default) | same page — both marked `required` | **verified** |
| B4 | A request may span at most 5,000 periods | same page — `limit`/period cap; the site splits ranges to stay under it (`CANDLE.maxPeriodsPerRequest = 5000`) | **verified** (5,000 constant matches the documented cap) |
| B5 | The order book returns **bids only**; a NO bid at *y* implies a YES ask at *1−y* | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) — "It returns yes bids and no bids only (no asks are returned) ... a bid for yes at price X is equivalent to an ask for no at price (100-X)" | **verified** |
| B6 | A ticker with no book (or an unknown ticker) returns **200 with empty arrays**, not 404 | same page — "A ticker that has no order book, including a ticker that does not match any market, returns 200 with empty arrays rather than 404." | **verified** |
| B7 | Order-book levels are `[price, quantity]` sorted ascending, best bid **last** | same page — "sorted by price in ascending order, so the best (highest) bid is the last element" | **verified** |
| B8 | Order-book price levels are dollar strings and contract counts (fixed point) | same page — `PriceLevelDollarsCountFp`: "price level in dollars ... the second element is the contract quantity (not price)" | **verified** |
| B9 | The depth table's "Contracts" column is "how many contracts are available at a given price" | B7 + B8. The site sorts by price descending and sums `count` per level, so the column is the resting contract count at that price. **Caveat, now disclosed:** those resting orders are bids on that side, i.e. contracts *bid for*, not contracts offered for sale, except where the reciprocal YES-ask reading applies. See finding **I3**. | **verified with a wording caveat** (I3) |

## C. Lifecycle, settlement and resolution tracking

| # | Claim as published | Official source checked | Result |
|---|---|---|---|
| C1 | Market status values are `initialized, inactive, active, closed, determined, disputed, amended, finalized` | [Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) — status table lists exactly these eight | **verified** |
| C2 | Settled markets come back as status **`finalized`** with `result` = yes/no; the site keys resolution on `result`, not the status string | same page — "settled markets end up at `finalized` rather than a separate `settled` status"; `GET /markets?status=settled` maps to `finalized` | **verified** |
| C3 | `result` values are `yes`, `no`, `scalar` or empty | [Get Market](https://docs.kalshi.com/api-reference/market/get-market.md) schema — `result` enum: `'yes'`, `'no'`, `scalar`, `''` | **verified** — and the site's combo handling for `scalar` is consistent with this |
| C4 | `GET /events` **excludes** multivariate (combo) events; `GET /events/multivariate` returns them | [Get Events](https://docs.kalshi.com/api-reference/events/get-events.md) — "This endpoint excludes multivariate events. To retrieve multivariate events, use the GET /events/multivariate endpoint." | **verified** — the site fetches combos separately and classifies them from `mve_selected_legs`, which matches the documented shape |
| C5 | `GET /events?status=` filters on **child market** status, not an event-level status | [market_lifecycle FAQ](https://docs.kalshi.com/getting_started/market_lifecycle) — "an event appears in results if **any** of its child markets has a matching status" | **verified** — this is why an event can appear in both `status=open` and `status=settled`; the site de-duplicates by event ticker |
| C6 | `with_nested_markets=true` embeds a `markets` array per event | [get-events.md](https://docs.kalshi.com/api-reference/events/get-events.md) — parameter documented; confirmed **live**: `?status=open&with_nested_markets=true&limit=3` returned nested `markets` arrays — <https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&with_nested_markets=true&limit=3> | **verified** |
| C7 | `GET /markets` returns at most 200 rows per page | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets.md) — `limit` maximum 200 | **verified** |
| C8 | `GET /events` returns at most 200 rows per page | [get-events.md](https://docs.kalshi.com/api-reference/events/get-events.md) — "Defaults to 200. Maximum value is 200." | **verified** |

## D. Trading, fees and portfolio

| # | Claim as published | Official source checked | Result |
|---|---|---|---|
| D1 | Order writes use `POST /portfolio/events/orders` and the body carries `ticker, side, count, price, time_in_force, self_trade_prevention_type, client_order_id` | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) — request URL and body shown verbatim; `count` and `price` are fixed-point **strings** (`"10.00"`, `"0.5600"`) | **verified** |
| D2 | `side` is `bid` (buy YES) or `ask` (sell YES), quoted from the YES leg only | same page — "For event markets, this refers to the YES leg only: `bid` means buy YES, `ask` means sell YES ... this endpoint quotes everything from the YES side." | **verified** — matches the site's `side: outcomeSide === "yes" ? "bid" : "ask"` |
| D3 | The legacy `/portfolio/orders` **write** endpoints are removed and answer `410 Gone` | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) description — "The legacy `/portfolio/orders` write endpoints (create, cancel, amend, decrease and their batch forms) have been removed and now return `410 Gone`" | **verified** |
| D4 | `GET /portfolio/orders` (read) is still the documented order-listing route at `api-reference/orders/get-orders` | [llms.txt index](https://docs.kalshi.com/llms.txt) lists "Get Orders" under `api-reference/orders/get-orders`; the site's `SOURCES.orders` points there | **verified** |
| D5 | Cancel is `DELETE /portfolio/events/orders/{order_id}` with `market_ticker` as a **query** parameter required for auto-routing | [Cancel Order (V2)](https://docs.kalshi.com/api-reference/orders/cancel-order-v2) — "market_ticker ... Required for auto-routing when exchange_index is omitted or -1" | **verified** — the site requires a ticker before cancelling, which matches |
| D6 | A missing `exchange_index` on an order write auto-routes by ticker | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) — `exchange_index`: "If omitted, auto-routes when ticker is provided" | **verified** |
| D7 | Taker fee formula is `round_up(M × 0.07 × C × P × (1−P))`, maker `M × 0.0175 × ...` with maker M default 0 | [Official fee schedule PDF](https://kalshi.com/docs/kalshi-fee-schedule.pdf) — "Trading Fees" and "Maker Fees" sections give both formulas verbatim | **verified** |
| D8 | There is no settlement fee and no membership fee | same PDF — "Settlement Fees: There is no settlement fee." / "Membership Fees: There is no membership fee." | **verified** — the site's claim that a settlement exit adds no fee is therefore supported |
| D9 | `KXAAAGASM` (US gas price) has maker and taker multiplies of 1 | same PDF, "Non-Standard Fees" table row `KXAAAGASM | US gas price | 1 | 1` | **verified** |
| D10 | Fee rounding: trade fee = model fee rounded **up** to 6 dp; rounding fee restores the member's balance grid; net fee ≥ 0 | [Fee Rounding](https://docs.kalshi.com/getting_started/fee_rounding.md) — mechanics 1–5; worked example: model fee `$0.00363825` → trade fee `$0.003639`, rounding fee `$0.001361`, `$0.005` total | **verified** — the repo's `tests/simulator-core.test.mjs` reproduces this exact worked example and all 42 published fee-table values, and both pass |
| D11 | The site charges fees per **taker** rate on entry and exit of a round trip | D7 + D8. Note the official schedule charges a fee only on orders "immediately matched with orders sitting on the orderbook", i.e. the taker rate applies to aggressive fills. The simulator applies the taker multiplier to both legs of a round trip. | **partially verified** — see finding **I5** (conservative but unproven for maker fills) |

## E. Taxonomy (the five required topics)

The requirement is five topics only: gas prices, elections, culture, crypto, golf. The site matches on Kalshi's
own `category` / `tags` / `series_ticker` vocabulary. Checked **live** against `/series` on 2026-11-21:

| # | Topic | Live vocabulary observed | Result |
|---|---|---|---|
| E1 | Elections | `GET /series?category=Elections` returns series with `"category":"Elections"` (e.g. `KXPRESNOMD`, `KXGOVCA`); `GET /events?status=open` returns `"category":"Elections"` (e.g. `KXNEXTNATOSECGEN-99`) — see [live events](https://external-api.demo.kalshi.co/trade-api/v2/events?limit=5&status=open) | **verified** |
| E2 | Crypto | `GET /series?category=Crypto` returns series with `"category":"Crypto"` (`KXBTCD`, `KXBTCY`, `KXETHY`) | **verified** |
| E3 | Culture | live series exist with `"category":"Culture"` (`KXXBANNEDGROK`) and the site also accepts `Entertainment` / `Social` | **verified** (all three observed live) |
| E4 | Golf | `GET /series?tags=Golf` returns `"category":"Sports"` with `"tags":["Golf"]` (`KXGOLF`, `KXPGATOUR`, `KXPHOENIXOPEN`). There is **no** `Golf` category: `GET /series?category=Golf` returns `{"series":null}` | **verified** — the site's "Sports + golf terms" rule is the correct reading |
| E5 | Gas | `GET /series?tags=Gas` returns only `DIESEL`/`DIESELM` ("Diesel price this week/month"), which are **not** retail pump prices. `KXAAAGASW`/`KXAAAGASM` ("US gas price", category `Economics`) carry tags `Oil & Gas` / `Oil and energy` | **verified, with a classification finding** — see **I1** and **I2** |

## F. Findings — irregularities and requests for the owning sessions

Each item states what an official source says, what the repo does, and what would close it. Nothing here was
silently changed: the files involved are in other sessions' scopes or are shared outputs.

### I1 — Gas topic includes crude, diesel and energy series that are not gasoline pump prices (open)

* **What the official record shows.** `GET /series?tags=Gas` on the demo returns only `DIESEL` and `DIESELM`
  (settlement source: EIA diesel spot price) — <https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Gas&include_volume=true>.
  `KXWTI`, `KXBRENTW`, `KXNATGASW` and `KXDIESELMON` are **oil and natural-gas** contracts, not retail gasoline.
* **What the repo does.** `data/snapshot.json` builds the `gas` topic from `tags: [Gas, Oil & Gas, Oil and energy]`
  (`scripts/collect.py`, `TOPICS["gas"]`). In the 2026-11-21 19:29Z snapshot, the gas bucket holds **40 series**,
  of which **17** are the documented AAA pump-price family (`KXAAAGAS*`/`AAAGAS*`), **14** are crude/NATGAS/diesel,
  and **77 of its 200 markets** come from those crude/diesel series.
* **This contradicts the published site.** `assets/js/config.js` deliberately excludes these rows
  (`excludePatterns: [/natural\s*gas/i, /\bNATGAS\b/i, /\bWTI\b/i, /\bBRENT\b/i, /crude/i, /diesel/i, ...]`) and
  the Flagged page's G1 card says the old catch-all `/GAS/i` "was unsound: it matched '…VEGAS' and '…NATGAS'".
  The site is right; the **snapshot generator** is looser than the site.
* **Scope/impact.** The live site does **not** read `data/snapshot.json` (grep: only `collect.py`, its test, the
  external-link auditor and docs mention it), so no published page currently shows a wrong topic. The risk is
  that the snapshot is described in the README and COORDINATION as backing the verification tables and the
  offline fallback.
* **Request (to the owner of `scripts/collect.py` + `data/snapshot.json`).** Either narrow the gas series filter
  to the documented pump-price family and re-derive, or label every non-AAA row inside `topics.gas` as
  "oil/gas energy — not retail gasoline". Do not delete captured values; add the label.
* **Sources:** [Get Series](https://docs.kalshi.com/api-reference/market/get-series), [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list), live `/series?tags=Gas` above.

### I2 — The published taxonomy reads a field the official schema marks deprecated (open, low severity)

* **What the official record shows.** In [Get Events](https://docs.kalshi.com/api-reference/events/get-events.md)
  the event object's `category` is annotated `deprecated: true` — "Event category (deprecated, use series-level
  category instead)".
* **What the repo does.** `assets/js/market.js` (`classifyEvent`) matches all three category patterns against
  `ev.category` from `GET /events?with_nested_markets=true`. It is live-verified correct *today* (section E), and
  every live event sampled still carries `category`, so the site works now.
* **Why it matters.** If Kalshi drops the deprecated event-level field, the elections/culture/crypto topics lose
  their category match and silently fall back to title patterns.
* **Request (to the owner of `assets/js/market.js`).** Prefer the series-level `category` from
  `GET /series/{series_ticker}` (already in `SOURCES.getSeries`), keeping `ev.category` as the fallback, and add
  one line to the taxonomy note saying which field is authoritative and which is deprecated.
* **Sources:** [get-events.md](https://docs.kalshi.com/api-reference/events/get-events.md), [Get Series](https://docs.kalshi.com/api-reference/market/get-series).

### I3 — "Contracts for sale" mislabels resting bids (open, wording)

* **What the official record shows.** The order book returns **bids only**; bids are resting orders to buy, and a
  NO bid implies a YES ask (`1 − y`) — [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook).
* **What the repo does.** `categories/*.html` uses the column header **"Contracts"** with a summary tile
  labelled **"Contracts for sale"**, computed as the sum of the YES **bid** sizes
  (`assets/js/category.js`, `yesDepth = yesRows.reduce(...)`).
* **Why it matters.** A trader reading "contracts for sale" expects the ask side. The number shown is the depth
  of bids. The page does explain the reciprocal rule underneath, but the tile label itself is misleading.
* **Request (to the owner of `categories/*.html` / `assets/js/category.js`).** Relabel the tile to
  "YES bid depth (contracts)" and, if a sellable figure is wanted, derive it from the NO bid book as `1 − y`.
* **Sources:** [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook).

### I4 — `previous_price_dollars` is documented as "a day ago" (already flagged as Z1 — confirmed, not a new finding)

* **Independent confirmation.** The [Get Market](https://docs.kalshi.com/api-reference/market/get-market.md) schema
  reads: *"previous_price_dollars … Price for the last traded YES contract on this market **a day ago** in dollars"*.
  The Flagged-page card **Z1** already states this and downgrades the claim to *partially verified*; the alert
  engine labels that comparison "exchange previous price" and relies on the between-polls comparison for the
  actual ≥ $0.10 swing test.
* **Live corroboration.** In the example above, `KXELONMARS-99` reports `last_price_dollars: "0.3000"` and
  `previous_price_dollars: "0.3000"` with `updated_time: 2026-04-09` — consistent with a daily reference, not a
  previous-tick value.
* **Status: no new action.** Z1 is accurate; this report confirms it independently rather than reopening it.

### I5 — The simulator applies the taker fee to both legs of a round trip (open, partially verified)

* **What the official record shows.** The fee schedule charges a trading fee only on orders "immediately matched
  with orders sitting on the orderbook", and the maker rate is a separate, smaller formula with M default 0
  ([fee schedule PDF](https://kalshi.com/docs/kalshi-fee-schedule.pdf)).
* **What the repo does.** `assets/js/simulator.js` applies `fillFeeDollars(... side: "taker")` to the entry and,
  for the round-trip scalper, to the exit as well.
* **Assessment.** This **overstates** cost rather than understating it — a conservative bias, which the page
  states ("no spread, no slippage"). It is not wrong for a taker-taker strategy, but a strategy whose exit rests
  as a maker would pay less.
* **Request (to the owner of `assets/js/simulator.js`).** One sentence beside the fee note: "both legs are charged
  the taker rate; a resting maker exit would pay the maker formula instead." Not a blocker.

## G. Repo-state audit (this session)

| Item | Check | Result |
|---|---|---|
| Red checks on `main` at session start | `node --test tests/*.test.mjs` → 1 fail; `python3 -m unittest discover -s tools` → 1 fail | Both were **label drift** in `data/snapshot.json` versus the repo's own guard phrases, introduced by the scheduled `collect` run (`bbdc3a0`, 19:29Z). Not a factual error in captured values. Repaired on `main` by sessions `0d6f4f1f` (R1) and `f2176447` before this branch merged forward. |
| Post-sync suite on this branch | `node --test tests/*.test.mjs` | **71/71 pass** |
| | `python3 -m unittest discover -s tools -p "test_*.py"` | **28/28 pass** |
| | `python3 -m unittest discover -s tests -p "test_*.py"` | **18 pass, 3 skipped** (`cryptography` not installed in this sandbox) |
| | `python3 tools/check_site_links.py .` | **34 pages, 0 broken local links** |
| | `node tools/verify/page-runtime-check.mjs` | **17/17 pages ran clean** |
| Published site | <https://kanlerxz87-cyber.github.io/KalshiDash2/> | Fetched; H1 "Live market activity, tracked to resolution" present; the page reports it reached the demo API and that trading is active. Pages API: `status: built`, source `main:/`. |
| Sandbox network | `curl`/`urllib` to `*.kalshi.co` | **blocked** (TLS closed / status 000). `fetch_page` reaches both `docs.kalshi.com` and `external-api.demo.kalshi.co`. Recorded as a harness limit, not a site defect. |

### Unverified items (left blank deliberately)

| Item | Why it stays unverified |
|---|---|
| Authenticated demo order placement end to end (`POST /portfolio/events/orders` actually filling) | Requires the owner's demo API key. None is committed and none was requested. Route, body and response shape are verified against the official reference; the *fill* is not. |
| Browser CORS from the published GitHub Pages origin | Cannot be exercised from this sandbox (no browser, and the host allowlist blocks the API). Previously recorded as live-verified by an earlier session's runner; not re-verified here. |

## H. Net verdict

* **Verified this session:** 10/10 environment and transport claims (A), 9/9 market-data and liquidity claims (B),
  8/8 lifecycle and resolution claims (C), 10 of 11 trading and fee claims (D, with D11 partial), and 5/5 topic
  claims (E) — **41 fully verified, 1 partially verified, 0 contradicted.** No published claim was found to be
  factually wrong against the official documentation.
* **Four open word/scope findings** (I1 gas bucket in the snapshot, I2 deprecated `category` field, I3 "contracts
  for sale" label, I5 maker-vs-taker fee note). None of these is a fabrication or a wrong number; each is a
  precise-vs-sloppy wording or scope issue with a named owner and a closing action. Per the brief, they do not
  block the deploy and belong on the Flagged for Review page.
* **One confirmation of an existing flag:** Z1 (`previous_price_dollars` = "a day ago") is correct as published.

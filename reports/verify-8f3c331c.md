# Live verification round — session `8f3c331c` (2026-11-22)

Every earlier session in this repository recorded the same blocker in its own words: the build sandbox
cannot open TLS to `*.kalshi.co`. `curl https://external-api.demo.kalshi.co/...` still fails here with
`SSL_ERROR_SYSCALL`, so this round was executed through the agent's HTTP reader (the platform fetcher),
which **can** reach the demo exchange. Each section names the exact URL so a reviewer can re-run it and
compare; nothing below is transcribed into the site as a static fact — the pages still fetch live.

Method, stated once so no capture is over-read:

- **Read-only.** No authenticated endpoint was called, no order was placed, no key was used.
- **Point-in-time.** The demo exchange is live; every figure below is what one response contained at
  the moment named in it. Nothing here is a total, a rate, or a prediction.
- **Timestamps.** Only timestamps the response itself carries are quoted. The round ran between
  2026-11-22T08:05Z and 08:25Z; the newest `created_time` inside §5's response is
  `2026-11-22T08:08:04.347183Z`, which is the one clock this file can prove.

---

## 1 · The archived (historical) tier answers on demo — the gap every prior session left open

Session `190f6069` implemented dual-tier candle reading and wrote, in its final record: *"Still open for a
session with network access: confirm the archived tier against the demo exchange and attach `evidence/`
captures … Until then the claim stays `partially verified`."* That is what this section does.

`GET /trade-api/v2/historical/cutoff` → HTTP 200

```json
{"market_positions_last_updated_ts":"2026-09-23T00:00:00Z","market_settled_ts":"2026-09-23T00:00:00Z",
 "orders_updated_ts":"2026-11-08T00:00:00Z","trades_created_ts":"2026-09-23T00:00:00Z"}
```

`GET /trade-api/v2/historical/markets?limit=2` → HTTP 200, 2 markets + a **non-empty** `cursor`
(`CgwI_PjL1QYQ0Lbh_AISI0tYVFRTVEFSTUFUQ0gtMjZTRVAyMjE4MDVHQVZNT1UtR0FW`), so the archived tier pages like
the live one. Both rows:

| Field | Row 1 | Row 2 |
|---|---|---|
| `ticker` | `KXTTSTARMATCH-26SEP221805GAVMOU-MOU` | `KXTTSTARMATCH-26SEP221805GAVMOU-GAV` |
| `status` | `finalized` | `finalized` |
| `result` | `no` | `yes` |
| `settlement_value_dollars` | `0.0000` | `1.0000` |
| `settlement_ts` | `2026-09-22T22:53:12.603182Z` | `2026-09-22T22:53:12.603182Z` |
| `volume_fp` | `0.00` | `0.00` |

Both settled **before** `market_settled_ts` (§1, the cutoff) — exactly the partition the site's
`isSettledMarket()` + tier-fallback routing assumes. `result` is `yes`/`no`, and `settlement_value_dollars`
is `1.0000` for the winner and `0.0000` for the loser, which is what
[Market settlement](https://docs.kalshi.com/getting_started/market_settlement) documents and what
`resolved.html` displays.

## 2 · Both candle tiers, side by side — the dual-shape parsing is right

Archived tier (the shape the site reads as plain names):

`GET /trade-api/v2/historical/markets/KXTTSTARMATCH-26SEP221805GAVMOU-GAV/candlesticks?start_ts=1790035200&end_ts=1790121600&period_interval=60`
→ HTTP 200

```json
{"candlesticks":[{"end_period_ts":1790118000,"open_interest":"0.00",
  "price":{"close":null,"high":null,"low":null,"mean":null,"open":null,"previous":null},
  "volume":"0.00",
  "yes_ask":{"close":"1.0000","high":"1.0000","low":"1.0000","open":"1.0000"},
  "yes_bid":{"close":"0.0000","high":"0.0100","low":"0.0000","open":"0.0100"}}],
 "ticker":"KXTTSTARMATCH-26SEP221805GAVMOU-GAV"}
```

Live tier, same window size, an open market read the way `fetchCandles` asks for it:

`GET /trade-api/v2/series/KXNCAAWBGAME/markets/KXNCAAWBGAME-26NOV22PENNME-ME/candlesticks?start_ts=1795248000&end_ts=1795334400&period_interval=60`
→ HTTP 200

```json
{"candlesticks":[{"end_period_ts":1795280400,"open_interest_fp":"1.00",
  "price":{"close_dollars":"0.2600","high_dollars":"0.2600","low_dollars":"0.2600","mean_dollars":"0.2600","open_dollars":"0.2600"},
  "volume_fp":"1.00",
  "yes_ask":{"close_dollars":"1.0000","high_dollars":"1.0000","low_dollars":"1.0000","open_dollars":"1.0000"},
  "yes_bid":{"close_dollars":"0.0000","high_dollars":"0.2600","low_dollars":"0.0000","open_dollars":"0.2600"}}],
 "ticker":"KXNCAAWBGAME-26NOV22PENNME-ME"}
```

Confirmed by these two responses:

1. The archived tier names the numbers `price.close` / `volume` / `open_interest`; the live tier names them
   `price.close_dollars` / `volume_fp` / `open_interest_fp`. `parseCandle()` in `assets/js/market.js` reads
   exactly this pair of shapes. No coercion, no invention.
2. **`period_interval` is a number of minutes on both tiers.** The archived call with `period_interval=60`
   answered; the same call written as `cycle=1h&count=10` (the live endpoint's enum form) returned no JSON
   body at all. The category pages' 7-day window asks for `period_interval=60`, and
   `tests/dom/category-dom.mjs` asserts it — that assertion matches reality.
3. **A candle whose period had no trades carries `null` prices, not `0`.** Row 1 above is a settled market
   with `volume_fp: 0.00`: every `price.*` is `null` while the quotes are still filled in. The site's rule
   ("a missing field stays null, which the UI renders as a gap rather than a price") is therefore *not*
   a defensive fiction — the exchange sends exactly that.
4. **Sparse is normal: 24 requested periods, 1 returned.** Both windows above are 24 hours of hourly
   buckets and each came back with a single candle — the one bucket overlapping the market's own lifetime
   (`open_time` 2026-09-22T22:37Z → `close_time` 22:47Z for row 1; one trade at 2026-11-21T18:20Z for row 2).
   A chart that assumed one point per period would have to invent 23 prices. The canvas chart plots by real
   `end_period_ts` on a time-scaled X axis (`X = (t − x0) / (x1 − x0)` in `assets/js/ui.js`), so the empty
   hours stay empty and the jump markers compare across the gap. Verified, not assumed.

## 3 · The order book, as the site requests it

`GET /trade-api/v2/markets/KXNCAAWBGAME-26NOV22PENNME-ME/orderbook?depth=20` → HTTP 200

```json
{"orderbook_fp":{"no_dollars":[],"yes_dollars":[]}}
```

- The response key is `orderbook_fp`, and its levels are `yes_dollars` / `no_dollars` — the shape
  `deriveQuote()` reads, and the claim at `assets/js/claims.js` ("Order book returns fixed-point dollar
  levels under `orderbook_fp`") holds.
- An illiquid demo market legitimately has **no resting orders at all**. `renderBook()` then prints
  "No resting YES bids." / "No resting NO bids." and a `live · 0 levels` pill. A page that read
  "liquidity" as a number would have shown `0 contracts available`, which is true here but would be a lie
  for the far more common case of a request that failed. The site's `n/a`-rather-than-`$0.00` rule survives
  this check.
- A path the site does **not** use — `GET /orderbook/{ticker}?depth=5` — returned no JSON body, which is
  consistent with the documented route being `/markets/{ticker}/orderbook`. Recorded so nobody "fixes" the
  URL toward the plausible-looking shorter path.

## 4 · Trades: the fields behind the traded-dollar measurement

`GET /trade-api/v2/markets/trades?limit=3` → HTTP 200, non-empty `cursor`
(`EhIKEAcq…`), and each row carried:

`count_fp`, `created_time`, `is_block_trade`, `no_price_dollars`, `taker_book_side`, `taker_outcome_side`,
`taker_side`, `ticker`, `trade_id`, `yes_price_dollars`

| # | `ticker` | `count_fp` | `yes_price_dollars` | `no_price_dollars` | Σ | `taker_outcome_side` / `taker_book_side` |
|---|---|---|---|---|---|---|
| 1 | `KXNFLTOTAL-26NOV22NOCHI-48` | 1.39 | 0.5400 | 0.4600 | 1.0000 | yes / bid |
| 2 | `KXNVDACEO-29JAN-MMUR` | 1.06 | 0.0500 | 0.9500 | 1.0000 | yes / bid |
| 3 | `KXPRESNOMD-28-WM` | 0.08 | 0.0250 | 0.9750 | 1.0000 | yes / bid |

- **YES and NO prices sum to exactly $1.0000 on every row.** That is the complement on which
  `assets/js/dollar-volume.js` values a NO-side trade as `count_fp × no_price_dollars`. It is documented in
  [Order book responses](https://docs.kalshi.com/getting_started/orderbook_responses); these three rows are
  an independent live check that the API keeps that invariant in the trade records too.
- `taker_outcome_side` and `taker_side` agree on all three rows, as the deprecation note implies, so
  preferring the former (as `tradeDollars()` does) loses nothing when both are present.
- `trade_id` is present and distinct — which is what makes the deduplication in §6 possible.

## 5 · The paging behaviour that changed this session's code

From [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), read 2026-11-22, "Paging and
ordering" — quoted because both sentences describe failure modes a client cannot detect from a status code:

> "A `cursor` that cannot be decoded is ignored and the first page is returned, with no error."

> "A market whose close time changes while you page through a listing sorted by close time can be skipped or
> returned twice. Deduplicate by `ticker`."

And, for the batch read the alert engine uses:

> "When `event_ticker` or `tickers` is the only filter (no `status`, `series_ticker`, timestamp filter,
> `mve_filter` or `cursor`), every matching market is returned in one response, in no guaranteed order.
> `limit` is not applied and the returned `cursor` is empty."

> "Responses are cached for a short time, so prices, sizes and `status` can lag the exchange by several
> seconds, and filtered listings can lag longer than a read of a single market."

Consequences, all implemented in this session (see §6):

- The 25-ticker batch on `alerts.html` relies on the guarantee above: with `tickers` as the only filter the
  response is complete and unpaginated, so `missing: 0` means "the exchange had nothing else", not "we
  stopped at a page". This narrows **Flagged A7**: 25 remains the site's own choice (still no documented
  maximum), but truncation of that call is ruled out by the official text.
- A repeated page is *silent*, so any cursor-paged read in this project can double-count. That is now
  guarded.
- The caching sentence is the exchange's own statement of **Flagged A3** ("alerts are poll-based, moves
  inside one poll are combined"), with a number: seconds. Quoted on the alerts page.

## 6 · What this session changed because of the above

| Change | File | Verified by |
|---|---|---|
| `createPageGuard()`: rows deduplicated by their documented key (`trade_id` → `event_ticker` → `ticker`), a cursor handed back twice ends the walk | `assets/js/paging.js` (new) | `tests/paging-guard.test.mjs` (9 tests, offline) |
| `getAll()` runs every cursor-paged read through the guard and reports `__duplicateRows` / `__repeatedCursor`; a restart marks the scan capped, i.e. incomplete | `assets/js/market.js` | `tests/paging-guard.test.mjs`, `tests/historical-tier.test.mjs`, page-runtime 18/18 |
| The traded-dollar total folds each page's rows through the guard and, on a restart, prints n/a with a named reason (`stopped = "repeat"`) instead of a doubled figure | `assets/js/dollar-volume.js` | `tests/dollar-volume.test.mjs` (+2 new cases) |
| The collector's `paginate()` applies the same rule, counts the rows it folded away, and records a restarted listing | `scripts/collect.py` | `tools/test_collect.py` (+5 new cases) |
| Topic board, alerts status line and the Overview disclose the repeat count and the basis of each match | `assets/js/category.js`, `assets/js/alerts.js`, `index.html` | `tools/verify/page-runtime-check.mjs` 18/18, `tests/dom` 18/18 |

## 7 · The collector comment that was not reproducible (session `0acc711d`'s request)

`scripts/collect.py` said, of its pinned-series merge: *"(observed: GET /series/KXGAS returns the 'Gas
weekly' series whose ticker is GAS)"*. Read live today:

- `GET /trade-api/v2/series/KXGAS` → `{"series": {"ticker":"KXGAS","title":"Gas weekly","category":"Economics",
  "categories":["Economics"],"fee_type":"quadratic","fee_multiplier":1,"frequency":"weekly",
  "last_updated_ts":"2026-11-22T07:48:49.868258Z", …}}`
- `GET /trade-api/v2/series/GAS` → the *same title*, `"ticker":"GAS"`, `last_updated_ts`
  `2026-11-02T23:01:12.873951Z`.

So `KXGAS` does **not** resolve to a record whose ticker is `GAS`: they are two separate series records
that happen to share the title "Gas weekly". The comment was reworded to say that, with the date, and the
merge itself was kept — a pinned lookup can still meet a row discovery already returned, which is what the
`setdefault`-avoiding merge protects against. Session `0acc711d`'s independent read (report
`reports/verify-0acc711d.md` §C6–C9) reached the same conclusion from the runner; this is the same fact from
a second network vantage point.

## 8 · Gas coverage on the demo exchange today

- `GET /trade-api/v2/events?status=open&series_ticker=KXGAS&limit=2&with_nested_markets=true` →
  `{"cursor":"","events":[],"milestones":[]}`. No open events on `KXGAS` right now — the finding behind
  **Flagged F4** ("the demo environment has no open gas-price markets") is *half* right, and the site's
  mitigation is what makes it harmless:
- `GET /trade-api/v2/events?status=open&series_ticker=KXAAAGASW&limit=1` → one event,
  `KXAAAGASW-26NOV23`, "US gas prices this week", `category: "Economics"`,
  `settlement_sources: [{ "name": "AAA", "url": "https://gasprices.aaa.com/" }]`.
  The topic's open gas markets live on the AAA series, and the collector's `KXAAAGAS*` family rule plus the
  site's `seriesPatterns: [/^KXA{3}GAS/i, /^KXGAS$/i]` both reach it. The `AB1` fix (adding `KXGAS`) and the
  gas-only exclusions are confirmed against live data, not just against fixtures.
- Crypto, for contrast: `GET /trade-api/v2/events?status=open&series_ticker=KXBTC&limit=1` →
  `KXBTC-26NOV2204`, "BTC price range tomorrow at 4am EST?", `category: "Crypto"`,
  `settlement_sources: [{ "name": "CF Benchmarks", … }]`, `exchange_index: 2`.
- Exchange health at the moment of the round, from
  `GET /trade-api/v2/exchange/status` → HTTP 200, `exchange_active: true`, `trading_active: true`, four shard
  entries (0 "Default", 1 "Demo shard 1", 2 "Demo shard 2", 3 with an empty `description`), all active. This
  is the body **AC1**'s fix (PR #113) reads flags from, and it is the only status in which flags mean
  anything.

## 9 · `previous_price_dollars`, again from the schema — and what the site now says

`GET /trade-api/v2/markets?limit=2&status=open` (first call of the round) returned two multivariate markets
created at `2026-11-22T07:56:59Z` in which `previous_price_dollars` is `"0.0000"` while
`last_price_dollars` is `"0.4500"` — a market only minutes old has no "a day ago" price to report, so the
field is *zero*, not *absent*: the same value a genuine 0¢ trade would carry.

That is the trap **Flagged Z1** is about. The sentence the flag quotes, from the response schema of
[Get Market](https://docs.kalshi.com/api-reference/market/get-market) (read on 2026-11-20 and re-checked since):

> `previous_price_dollars`: "Price for the last traded YES contract on this market **a day ago** in dollars"

not "before the last change". The archived-markets schema carries the same field in its 200 example, which is
why the site's archived-tier rows are labelled with the same baseline rather than a new one.
The alert engine's two comparisons stay separate and stay labelled, and the
exchange-vs-exchange comparison is now described with the day-old baseline in the copy — including on the
Overview, whose mover note reads `Δ = last_price_dollars − previous_price_dollars`. For a market minutes
old, a $0.10 "swing" against a zero baseline is a listing artefact, not a move — which is exactly why the
site also requires the between-polls comparison and prints which one fired.

Also visible in those two rows, and relevant to **Flagged F7** and the ranking columns:
`notional_value_dollars: "1.0000"` on a market whose volume is `100.00` contracts — the single-contract
settlement value, not turnover. It is still excluded from the ranking, as `F7` records.

## 10 · Not verified by this round (and therefore not claimed anywhere)

1. **Any authenticated call.** No demo API key exists in this repository and none was supplied, so
   `GET /portfolio/balance`, positions, fills, order placement and the WebSocket handshake remain verified
   only against documentation, plus the runner-side captures already published under `evidence/` and
   `reports/`. **F1** and **F2** stay open.
2. **A live WebSocket frame.** The socket needs signed handshake headers a browser cannot set, and
   `reports/live-ws-check.md` records the unauthenticated handshake being refused with HTTP 401.
   The relay path remains the only live-feed route, still opt-in (**W1**, **W4**).
3. **`GET /series` paging.** Still unexercised: the endpoint documents no `limit`/`cursor`, so the
   16,643 / 16,653 row counts remain two point-in-time captures of one response, not a catalogue size
   (**F5** unchanged).
4. **The fee-schedule PDF.** Not re-read this round; **Z2**'s contradiction between the PDF's "centicent"
   footnote and its own worked table stands as published, resolved the way the card describes.
   One adjacent observation, from §9's market rows: `price_level_structure: "center_deci_edge_centi_cent"`
   with `price_ranges` stepping `0.0010` in the middle band and `0.0001` at the edges — sub-cent ticks
   exist on the edge bands, which is consistent with a fee rule that rounds to a sub-cent unit there.
   Recorded as context, not as a resolution.
5. **Why the demo carries two "Gas weekly" series** (`KXGAS` and `GAS`). Unanswered; a question for Kalshi,
   not something to infer. `KXGAS` was last updated today, `GAS` on 2026-11-02.

## 11 · One documented rule that does *not* bite this site, checked anyway

The [Get Historical Markets](https://docs.kalshi.com/api-reference/historical/get-historical-markets) page
carries a second-line warning that is easy to trip over: **"Endpoint for getting markets that have been
archived to the historical database. Filters are mutually exclusive."** Combined filters on that route are
therefore not a narrowing AND, the way the live `GET /markets` filters behave.

Checked against every call this repository makes to the archived tier:

| Caller | What it sends | Affected? |
|---|---|---|
| `fetchCandles()` in `assets/js/market.js` | `/historical/markets/{ticker}/candlesticks?start_ts&end_ts&period_interval` — one market by ticker, no listing filters | no |
| the Strategy Tester's archived universe in `assets/js/simulator.js` | `/historical/markets?limit=…` — a page size, not a filter | no |
| `GET /historical/markets?limit=2` in this round (E2) | likewise `limit` only | no |

So the archived-tier feature this report just verified rests on neither route combining two mutually exclusive
filters. Recorded here because "we checked and it does not apply" is a different statement from "nobody looked".

## Sources used in this report

| What it establishes | Link |
|---|---|
| Archived-tier rule ("markets that settled before the cutoff are only available via `GET /historical/markets`") and "The archive publishes **cutoff timestamps** through `GET /historical/cutoff`" — the sentences this site relies on, quoted by session `190f6069`'s read of this page | https://docs.kalshi.com/getting_started/historical_data |
| Archived markets schema and paging, and "Filters are mutually exclusive" | https://docs.kalshi.com/api-reference/historical/get-historical-markets |
| The `previous_price_dollars` sentence quoted in §9 ("a day ago"), and the field list the alert engine reads | https://docs.kalshi.com/api-reference/market/get-market |
| Archived candlesticks: `period_interval` in minutes, plain field names | https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks |
| Live candlesticks: `_dollars` / `_fp` field names | https://docs.kalshi.com/api-reference/market/get-market-candlesticks |
| Paging and ordering, deduplicate-by-`ticker`, the caching caveat, the `tickers`-only guarantee | https://docs.kalshi.com/api-reference/market/get-markets |
| Order book shape and the YES/NO complement | https://docs.kalshi.com/getting_started/orderbook_responses |
| Trades fields | https://docs.kalshi.com/api-reference/market/get-trades |
| Series record fields (`category`, `categories`, `contract_url`, `settlement_sources`) | https://docs.kalshi.com/api-reference/market/get-series |
| Settlement values | https://docs.kalshi.com/getting_started/market_settlement |
| Exchange status flags only from a 200 | https://docs.kalshi.com/api-reference/exchange/get-exchange-status |

Raw captures quoted above, with their request URLs, are in
[`evidence/live-2026-11-22-8f3c331c.md`](../evidence/live-2026-11-22-8f3c331c.md).

# Independent math verification — session `7930e2cd` (2026-11-21)

**Scope:** line-by-line verification of the alert-threshold and simulated-trade P&L math
in `assets/js/alerts-core.js`, `assets/js/simulator.js`, `assets/js/market.js`
(`fetchCandles`, `detectJumps`, `swingOf`, `eventContext`) and `assets/js/kalshi.js`
(`deriveQuote`) against official Kalshi documentation fetched 2026-11-21 via `fetch_page`.
This session read the site code but did not edit it (site files are owned by other
sessions / shared outputs per `COORDINATION.md`). Any defect found would be logged as a
request in `COORDINATION.md`, not fixed here.

**Method note:** the build sandbox cannot open TLS to `*.kalshi.co` (outbound allowlist —
`curl` returns empty), so official docs were fetched with the `fetch_page` tool, which
reaches `docs.kalshi.com` and `kalshi.com`. Live demo-API behaviour was not re-probed
from this sandbox; where a claim depends on a live response, this report says so and
points at the existing captured evidence in `reports/` instead of asserting it.

## Official sources fetched

| # | Official page | What it confirms (quoted / paraphrased) |
|---|---|---|
| 1 | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | Market object carries `last_price_dollars`, `previous_price_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `no_bid_dollars`, `no_ask_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `result` (`"yes"` in the example), `settlement_value_dollars`, `notional_value_dollars`, `price_ranges`, `mve_selected_legs`. No `series_ticker` field on the market object. |
| 2 | [Market settlement](https://docs.kalshi.com/getting_started/market_settlement) | "Yes outcome: Yes contract holders receive $1 per contract. No outcome: No contract holders receive $1 per contract." Settlement fees are zero for simple yes/no determinations. |
| 3 | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | Route `GET /series/{series_ticker}/markets/{ticker}/candlesticks`; `period_interval` enum is exactly `1`, `60`, `1440` (minutes); "One request can span at most 5,000 periods" (400 `bad_request` beyond); candle `price` object carries `close_dollars` and `previous_dollars`; `volume_fp`, `open_interest_fp` per candle. |
| 4 | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | Recommended demo REST root `https://external-api.demo.kalshi.co/trade-api/v2`, also supported `https://demo-api.kalshi.co/trade-api/v2`; WebSocket `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`, also supported `wss://demo-api.kalshi.co/trade-api/ws/v2`; mock funds; credentials not shared with production. |
| 5 | [Orderbook responses](https://docs.kalshi.com/getting_started/orderbook_responses) | Orderbook returns bids only (`orderbook_fp.yes_dollars` / `no_dollars`, `[price_dollars, count_fp]` pairs). Reciprocal rule: "A YES BID at price X is equivalent to a NO ASK at price ($1.00 − X)". Spread: "Best YES ask: $1.00 − (Highest price in the `no_dollars` array); Spread = Best YES ask − Best YES bid". Unknown ticker returns 200 with empty arrays, not 404. |
| 6 | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) | Event object carries `settlement_sources: [{name, url}]`, `category`, `mutually_exclusive`, `series_ticker`, and nested `markets` with the full market schema. |
| 7 | [Fee schedule (PDF)](https://kalshi.com/docs/kalshi-fee-schedule.pdf) | Taker fee `round up(M × 0.07 × C × P × (1−P))`; maker fee `round up(M × 0.0175 × C × P × (1−P))`; "There is no settlement fee." Effective July 7, 2026. |
| 8 | [Rate limits](https://docs.kalshi.com/getting_started/rate_limits) | "Unauthenticated public requests are subject to separate limits. Authenticate requests where supported and back off on `429`." No numeric public budget is published. |

## Line-by-line findings

### `assets/js/alerts-core.js`

| Line / function | Site math | Official basis | Verdict |
|---|---|---|---|
| `THRESHOLD = 0.10` | Swing = change of at least $0.10 per contract | Brief requirement ("greater than or equal to $0.10 in either direction"); no Kalshi "swing" field exists (confirmed: Get Market schema has no such field) | Correct; threshold is a site parameter, labelled as such |
| `detectMoves` | `delta = round4(price − before.price)`; alert iff `|delta| >= threshold − EPS && delta !== 0`; first sighting sets baseline, cannot alert | `last_price_dollars` is the documented trade-price field (Get Market) | Correct. `>=` (not `>`) matches "greater than or equal to". Rounding to 4 dp matches the API's 4-decimal dollar strings |
| `detectReferenceSwings` | `delta = round4(last_price_dollars − previous_price_dollars)`, same threshold | Both fields are in the Get Market schema (fetched above) | Correct. De-duplication on `(ticker, from, to)` is handled by `mergeAlerts` |
| `mergeAlerts` | Drops a swing already present with same ticker + from/to; first list wins | — (client logic) | Correct |
| `watchCheck` | Pass iff two-sided quote present, spread ≤ $0.05, price after move in [$0.10, $0.90], open interest ≥ 1 | Spread definition matches orderbook docs (ask − bid); fields are documented | Correct as a transparent rule set. Page labels it a screen, not a model — honest |
| `entryFor` | Follow buys the side the move went toward, fade the opposite; entry = that side's ask; requires `0 < entry < 1` | Buying YES costs the YES ask; buying NO costs the NO ask (standard; reciprocal pricing documented) | Correct |
| `updateTrade` | Resolved only when API `result` is `yes`/`no`; `payout = side === result ? 1 : 0`; `pnl = payout − entry`; open trades marked at best bid for their side | Settlement: "$1 per contract" to holders of the winning side (Market settlement). Mark at bid = sellable price before fees | Correct. Fees omitted from mark/P&L — disclosed on-page and flagged (A5) |
| `summarize` | `winRate = wins / resolved`; `roi = realized / cost` where cost = Σ entry | — (arithmetic) | Correct |
| `screenMarket` | Scores documented fields only; a missing field scores 0 and is never treated as a value | All inputs (`open_interest_fp`, `yes_bid_dollars`, `yes_ask_dollars`, `yes_bid_size_fp`, `yes_ask_size_fp`, `volume_24h_fp`, `close_time`, `last_price_dollars`) are in the Get Market schema | Correct. Explicitly not a probability model |
| `moneyTraded` | `volume_fp × last_price_dollars`, labelled as the site's definition | Get Market schema: `notional_value_dollars` is `"0.5600"` in the example — the same as the price, i.e. per-contract payout, **not** traded dollar volume. No API field gives traded dollars | Correct, and the label is honest: the site computes it and says so |

### `assets/js/simulator.js`

| Line / function | Site math | Official basis | Verdict |
|---|---|---|---|
| `loadSettledUniverse` | Keeps only markets with `result` in {yes, no} **and** non-null `settlement_value_dollars` | Get Market schema (`result`, `settlement_value_dollars`) | Correct — unscorable markets are excluded, not scored as 0 |
| `loadHistory` | Final 1,440 one-minute periods before `settlement_ts` | Candlestick cap: 5,000 periods/request (fetched above); 1,440 < 5,000 so one request suffices | Correct |
| `replayStrategy` (YES) | `entryPrice = close`; `payout = settlement_value_dollars`; `pnl = payout − entryPrice` | Settlement: YES holders receive $1 on a yes outcome; `settlement_value_dollars` is the market's own settlement value (Get Market) | Correct |
| `replayStrategy` (NO) | `entryPrice = 1 − close`; `payout = 1 − settlement_value_dollars`; `pnl = payout − entryPrice` | Reciprocal YES/NO pricing: "A YES BID at price X is equivalent to a NO ASK at price ($1.00 − X)" (Orderbook responses). NO payout is the complement of the YES settlement value | Correct. This is the fix from PR #34; re-verified here against the fetched docs |
| `replayStrategy` round-trip | Target = entry ± $0.10 on the YES price; exit at first candle reaching it; otherwise hold to settlement | — (strategy rule) | Correct as stated |
| `replayRandomControl` | Ticker-seeded PRNG picks one candle + side; same entry/payout math as rules | — (baseline, labelled as such) | Correct. Deterministic: same inputs → same trade |
| `aggregate` / `aggregateBreakdowns` | `winRate = wins / (wins + losses)`; `roi = pnl / capital` | — (arithmetic) | Correct arithmetic. **Observation (not a defect):** flat trades (`pnl === 0`) are counted separately and excluded from the win-rate denominator, while the scoreboard text describes hit rate as "the share of scored trades that made money". A flat trade is neither a win nor a loss, so excluding it is defensible, but the wording and the formula differ by exactly the flat count. Logged as a request in `COORDINATION.md` for the integration session to align (either include flats in the denominator or reword). No site file was edited by this session |
| `Paper.settle` | `payout = side === "yes" ? settlement_value_dollars : 1 − settlement_value_dollars`; `pnl = payout − entry_price` | Same settlement + reciprocal basis as above | Correct |
| Fee handling | No fees, spread, or slippage in any simulated fill | Fee schedule: taker fee `round up(M × 0.07 × C × P × (1−P))` is non-zero at every price in the table (e.g. $0.02/contract at $0.50) | Correctly disclosed as optimistic; already flagged as A5. Re-confirmed against the live PDF on 2026-11-21 |

### `assets/js/market.js` + `assets/js/kalshi.js`

| Function | Site behaviour | Official basis | Verdict |
|---|---|---|---|
| `fetchCandles` | Route `/series/{series}/markets/{ticker}/candlesticks?start_ts&end_ts&period_interval`; splits ranges at the 5,000-period cap; reads `price.close_dollars`, `price.previous_dollars`, `volume_fp`, `open_interest_fp` | Candlestick docs (fetched above): route, enum, cap, and field names all match | Correct |
| `detectJumps` | `delta = round4(close − prev)`; jump iff `|delta| >= threshold`; prefers the candle's own `previous_dollars`, falls back to the prior close | `price.previous_dollars` is in the documented candle schema | Correct |
| `swingOf` | `delta = round4(last_price_dollars − previous_price_dollars)` | Both fields documented (Get Market) | Correct |
| `eventContext` | Reads `settlement_sources[].name/url`, `rules_primary`, `series_ticker` | Get Events schema (fetched above) | Correct. Sources are presented as "where this market is decided", never as proven causes of a jump |
| `deriveQuote` | `bestYesAsk = 1 − bestNoBid`; `bestNoAsk = 1 − bestYesBid`; `yesSpread = 1 − bestNoBid − bestYesBid` | Orderbook docs: "Best YES ask: $1.00 − (Highest price in the `no_dollars` array)"; "Spread = Best YES ask − Best YES bid" | Correct, formula-for-formula |
| `resolveSeries` | Falls back to `GET /events/{event_ticker}` for `series_ticker` | Get Market schema has no `series_ticker`; Get Events schema does | Correct |
| `getAll` pagination | `limit=200`, cursor loop, `__capped` flag when pages run out | Get Events example uses `limit=200`; cursor field documented | Correct. Partial scans are labelled, not presented as complete |

### `assets/js/config.js` (read-only)

| Constant | Value | Official basis | Verdict |
|---|---|---|---|
| `DEMO.rest` | `https://external-api.demo.kalshi.co/trade-api/v2` | Demo env page: "Demo's recommended Trade API root is `https://external-api.demo.kalshi.co/trade-api/v2`" | Correct |
| `DEMO.ws` | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | Demo env table: WebSocket API recommended endpoint | Correct |
| `ALTERNATES` | `https://demo-api.kalshi.co/trade-api/v2`, `wss://demo-api.kalshi.co/trade-api/ws/v2` | Demo env table: "Also supported" column | Correct |
| `CANDLE.intervals` | `[1, 60, 1440]` | Candlestick docs: "Valid values are 1 (1 minute), 60 (1 hour), or 1440 (1 day)" | Correct |
| `CANDLE.maxPeriodsPerRequest` | `5000` | Candlestick docs: "One request can span at most 5,000 periods" | Correct |
| `ALERT.defaultThreshold` | `0.10` | Brief requirement | Correct |

## Observations (not defects — logged as requests, no files edited)

1. **Win-rate denominator vs. wording** (`simulator.js` `aggregate` / `aggregateBreakdowns`
   vs. `simulator.html` scoreboard text): flats are excluded from the denominator but the
   text says "share of scored trades". Align one with the other. Request logged in
   `COORDINATION.md`.
2. **Historical candlestick cutoff**: the candlestick docs note that markets settled before
   the historical cutoff are only available via `GET /historical/markets/{ticker}/candlesticks`.
   The simulator requests `/series/.../candlesticks` for settled markets; for very old
   settlements that call may return no history. `loadHistory` surfaces the error rather
   than fabricating data, and the universe is the most recent settled markets, so this is
   an edge case, not a defect. Noted for awareness only.
3. **Fees**: re-confirmed non-zero from the live fee-schedule PDF. The simulator's no-fee
   assumption remains optimistic by exactly the taker/maker fee (flag A5). No change needed
   beyond the existing disclosure.

## What was NOT re-verified here

- Live demo-API responses (CORS, payload shapes, topic vocabulary): this sandbox cannot
  reach `*.kalshi.co`. Existing captured evidence stands: `reports/verify-facts-v3.md`,
  `data/probe/api_surface.json`, `data/snapshot.json` (2026-11-20), and the GitHub-runner
  reports (`reports/alerts-live-check.md`, `reports/live-engine-check.md`).
- `SOURCES` URL-by-URL re-verification: owned by session `9d7b4124` (Z1). This report
  verified the *math and schema* those URLs document, which is a different angle.
- The `docs/` legacy generation: owned by session `9d7b4124` (Z3). Not read here.

## Result

Every formula checked against official documentation is correct as written. No
hallucinated values, no inferred fields, no silent zeros found in the checked code.
One wording/formula alignment request (win-rate denominator) is logged for the
integration session. Nothing in this report blocks the merge.

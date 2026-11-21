# Archived data tier — verification and change record

**Session:** `190f6069` · **Branch:** `arena/190f6069-kalshidash2` · **Date:** 2026-11-21 (UTC)
**Scope:** the live/historical partition of the Kalshi demo Trade API and how the published site
reads candlesticks and backtest universes through it.

Nothing in this report is inferred from memory. Every statement below is tied to a page that was
fetched on 2026-11-21, or to code in this repository that can be run offline.

---

## 1. Official sources fetched

| # | Source | What it establishes (quoted) |
|---|---|---|
| 1 | <https://docs.kalshi.com/getting_started/historical_data> | "To keep the live API fast and responsive, Kalshi partitions exchange data into **live** and **historical** tiers." · "The archive publishes **cutoff timestamps** through `GET /historical/cutoff`." · "Markets and their candlesticks that settled before this timestamp are only available via `GET /historical/markets`" (`market_settled_ts`). · "Old **Events** and **Series** will always still be available through their original endpoints." · Impacted live endpoints include `GET /markets`, `GET /markets/{ticker}` (settled markets and their candlesticks older than the cutoff "will not appear") and `GET /events` with `with_nested_markets=true`. |
| 2 | <https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks> | `GET /historical/markets/{ticker}/candlesticks`; path parameter `ticker` only (no series); required query `start_ts`, `end_ts`, `period_interval` ∈ {1, 60, 1440}. Response candle fields are **`price.open/close/low/high/mean/previous`**, `yes_bid.{open,low,high,close}`, `yes_ask.{…}`, `volume`, `open_interest` — no `_dollars` / `_fp` suffixes, and no `min`/`max` on `price`. |
| 3 | <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | The live counterpart `GET /series/{series_ticker}/markets/{ticker}/candlesticks`, same three required query parameters, but the response uses **`price.close_dollars` / `price.previous_dollars` / `volume_fp` / `open_interest_fp`**. Its own description adds: "Candlesticks for markets that settled before the historical cutoff are only available via `GET /historical/markets/{ticker}/candlesticks`." |
| 4 | <https://docs.kalshi.com/api-reference/historical/get-historical-markets> | `GET /historical/markets` returns ordinary market objects (same field names as the live tier: `result`, `settlement_value_dollars`, `settlement_ts`, `volume_fp`, `open_interest_fp`), cursor-paginated, with mutually exclusive filters. |
| 5 | <https://docs.kalshi.com/getting_started/demo_env> | Demo REST root `https://external-api.demo.kalshi.co/trade-api/v2`, alternate `https://demo-api.kalshi.co/trade-api/v2`; WebSocket `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`. The historical endpoints list the same four environment roots (see the selector block on source 2/4). |
| 6 | <https://docs.kalshi.com/sitemap.xml> (chunks 1–3) | Every `docs.kalshi.com` URL cited by `assets/js/claims.js` and `assets/js/config.js` exists as a published page (checked path by path, including `api-reference/orders/{create-order-v2,cancel-order-v2,get-orders}`, `api-reference/portfolio/{get-fills,get-positions,get-balance,get-settlements}`, `websockets/market-ticker`, `websockets/websocket-connection`, and every `getting_started/*` page used). **No broken official-source link was found.** |

## 2. Defect found

Before this session the site read candles from the live tier only. `assets/js/market.js`
`fetchCandles` always called `/series/{series}/markets/{ticker}/candlesticks` and mapped only
`*_dollars` / `*_fp` field names. Consequences, both silent:

1. **Charts.** For a settled market archived past the cutoff the live call legitimately returns no
   candles, so the page showed "No trades in this window" — which reads as an exchange fact
   ("nothing traded") when the truth was "this market's candles live in the other tier".
2. **Strategy tester.** `loadSettledUniverse` read only `GET /markets?status=settled`. Archived
   settled markets do not appear there, so the backtest universe quietly excluded exactly the
   longer, fully-resolved history the tester exists to measure.

Neither defect produced an error message, which is why the flag register never caught them.

## 3. Change made

| File | Change |
|---|---|
| `assets/js/config.js` | Added `SOURCES.historicalMarkets` and `SOURCES.historicalCandles` with the partition note and both official URLs. |
| `assets/js/market.js` | New `parseCandle()` accepts the live shape (`*_dollars`, `*_fp`) and the archived shape (`close`, `previous`, `volume`), and keeps a missing field `null` rather than filling it. New `isSettledMarket()` decides tier eligibility from the exchange's own fields (`result`, terminal `status`, or a `close_time` in the past). `fetchCandles()` now returns `via: "live" \| "historical"`, the exact `source` URL that answered, and `historicalError` when the archived tier refused. The archived tier is called **only** when the live tier returns zero candles for a settled market, and `allowHistorical: false` opts out. A market whose series cannot be resolved (the archived route needs only the ticker) is still retried on the archived tier. |
| `assets/js/simulator.js` | `loadSettledUniverse()` merges `GET /markets?status=settled` with `GET /historical/markets` (bounded: `HISTORICAL_UNIVERSE = { limit: 100, maxPages: 2 }`), de-duplicates by ticker with the live record winning, tags each row `_tier`, and exposes `__tiers`, `__archived`, `__archivedError`. `loadHistory()` passes the answering tier through. `mergeTiers()` is exported for testing. |
| `simulator.html` | Universe note states both tier counts and any archived-tier refusal; every simulated trade carries `candleSource` / `candleVia`; scoreboard and breakdown rows link the tier that actually answered (live or archived) and its docs page; the run note reports how many markets were served from the archived tier. |
| `assets/js/category.js` | Chart caption names the tier ("archived tier" when applicable), links the exact request and the matching docs page, and surfaces `historicalError` instead of hiding it. Failure line links both tiers' docs. |
| `assets/js/claims.js` | One new claim, "Settled markets move to an archived data tier", status **partially verified**, source `getting_started/historical_data`. Register total 89 → 90. |
| `tests/historical-tier.test.mjs` | 14 offline tests (see §4). |
| `.github/workflows/site-check.yml` | The new suite runs in CI. |

## 4. What is verified, and what is not

**Verified offline (runnable here):** both candle shapes parse to identical point objects; a field
absent from the response stays `null` while an explicit API `0.00` is preserved; tier eligibility
follows the exchange's own fields; `mergeTiers` de-duplicates with the live record winning;
`fetchCandles` routes an open market to the live tier only, routes a settled market to the archived
tier only when the live tier is empty, reports an archived-tier refusal instead of swallowing it,
honours `allowHistorical: false`, and still fires the brief's inclusive $0.30 → $0.45 ≥ $0.10 jump
detection on archived-tier candles.

**Not verified here:** that the demo exchange actually returns archived candles for a given ticker,
and that `GET /historical/markets` is readable with an unauthenticated demo key scope. The build
sandbox has no TLS route to `*.kalshi.co` hosts (see `reports/` for the earlier
proof), so this session could not call either endpoint. The claim is therefore published as
**partially verified**, and the pages say "archived tier not read" with the API's own message
whenever the call fails at runtime.

**Next verification step for a session with network access:** run
`GET {demo}/historical/markets?limit=1`, take the returned ticker, then
`GET {demo}/historical/markets/{ticker}/candlesticks?start_ts=…&end_ts=…&period_interval=60`, and
attach both responses under `evidence/`. If the archived tier turns out to need authentication, the
fallback stays as-is (it degrades to the previous behaviour) but the note on `simulator.html` must
say so.

## 5. Repo-wide source-link audit (same session)

Prompted by this defect, every `docs.kalshi.com` URL the published pages cite was checked against
the documentation sitemap rather than assumed: 27 distinct paths across `claims.js` and `config.js`,
all present. Two further observations for reviewers, not defects:

- The docs now publish an **event-level** candlestick endpoint
  (`GET /events/{event_ticker}/candlesticks`) and a **live-data** family
  (`api-reference/live-data/*`: event live data, game stats, weather index). Both post-date the
  site's design and are unused; they are candidates for the "explain the jump" panel, not gaps
  against the brief.
- `websockets/market-ticker` documents `dollar_volume` and `dollar_open_interest` as integer fields
  on the ticker message. They exist only on the authenticated WebSocket ticker, not on any REST
  market object, so the volume × last-price ranking proxy (Flagged A11) cannot be replaced with an
  exchange-reported dollar figure without a key. A11 stays correct as written.

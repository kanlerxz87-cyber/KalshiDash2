# Independent line-by-line verification — session `0acc711d` (2026-11-21)

Branch `arena/0acc711d-kalshidash2`, base `main` @ `cc9112b` (PR #88). All fetches below were made between
**2026-11-21T22:50Z and 23:20Z** through the session's page-fetch tool (the sandbox shell cannot open TLS to any
`*.kalshi.co` / `docs.kalshi.com` host — `curl` returns HTTP `000`, the same limit every prior session recorded).
Every row links the exact URL that was read so it can be re-run by hand. Nothing in this report is inferred:
where a value could not be read it is marked **not verified**.

Legend: **verified** = read on the official page / live response and matches the site · **corrected** = the site
or register said something the source contradicts, and this session changed it · **not verified** = could not be
read with the tools available; left as is and flagged.

---

## A. Endpoints in the brief (official documentation)

| # | Claim on the site | Official source (fetched 2026-11-21) | Result |
|---|---|---|---|
| A1 | Demo REST root `https://external-api.demo.kalshi.co/trade-api/v2` (recommended) | [Test In The Demo Environment](https://docs.kalshi.com/getting_started/demo_env) — table row "REST Trade API", column "Recommended demo endpoint" | **verified** |
| A2 | Also-supported REST root `https://demo-api.kalshi.co/trade-api/v2` | same page, column "Also supported" | **verified** |
| A3 | Demo WebSocket `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (recommended) and `wss://demo-api.kalshi.co/trade-api/ws/v2` (also supported) | same page, row "WebSocket API" | **verified** — all four URLs in the user's brief match the official table verbatim |
| A4 | Demo uses mock funds; credentials are not shared with production; demo prices "may not be reflective of those in real markets" | same page, first paragraph and warning box | **verified** — the site's `demo` badge and the "mock only" row on the Overview are supported |
| A5 | Demo site `https://demo.kalshi.co/`; account tutorial at help.kalshi.com article 13823775 | same page | **verified** |

## B. WebSocket `ticker` channel (official AsyncAPI source)

Source: [Market Ticker — markdown source](https://docs.kalshi.com/websockets/market-ticker.md) and the rendered
page [Market Ticker](https://docs.kalshi.com/websockets/market-ticker), both fetched 2026-11-21.

| # | Claim | What the official source says (verbatim) | Result |
|---|---|---|---|
| B1 | `alerts.html`, `assets/js/live-feed.js`, `scripts/relay.py`, `assets/js/claims.js` (W3): the ticker channel flushes about once per second | "Changes are combined and sent on a flush scheduled every second: each flush sends one message per changed market, carrying its current values, so intermediate values are not sent. This is a schedule, not a guaranteed minimum gap; two updates for one market can arrive less than a second apart. For every trade or book change, use the `trade` or `orderbook_delta` channel" | **verified** — the sentence a prior session could not find is in the channel's *Requirements* list. Q10's "don't know … whether the ticker channel can deliver every intermediate price change" is therefore answered by the source: it does **not** (corrected on `questions.html`) |
| B2 | Authentication: an API key is required at the handshake; no extra channel-level auth | "No additional channel-level authentication beyond the authenticated WebSocket connection"; security scheme `apiKey` — "The API key should be provided during the WebSocket handshake" | **verified** (W1, Q10 wording stands) |
| B3 | Payload has no `previous_price_dollars` (W2) | Required `msg` properties: `market_id, market_ticker, price_dollars, yes_bid_dollars, yes_ask_dollars, volume_fp, open_interest_fp, dollar_volume, dollar_open_interest, yes_bid_size_fp, yes_ask_size_fp, last_trade_size_fp, ts, ts_ms, time` (+ optional `sending_ts_ms`) | **verified** — no `previous_price_dollars` |
| B4 | `dollar_volume` / `dollar_open_interest` meaning | `dollar_volume`: "Signed whole-dollar cumulative traded notional" (integer); `dollar_open_interest`: "Signed whole-dollar open-interest notional" (integer) | **new finding** → Flagged **K1**. This is an exchange-reported traded-dollar figure per market. It exists only on the WebSocket path; the REST market object has no equivalent, which is why the site's REST ranking is a proxy (A11). The register (E1) and `QUESTIONS.md` Q9 / `questions.html` Q1 said "no dollars field" without this qualification — **corrected** |
| B5 | `ts` and `time` are deprecated in favour of `ts_ms` | `ts`: "Deprecated … Use ts_ms instead"; `time`: "Deprecated … Use ts_ms instead" | **verified**; `assets/js/live-core.js` maps the frame by `ts_ms` first (read, not changed) |
| B6 | Un-filtered subscriptions cannot be narrowed afterwards | "A subscription created without a market filter cannot be changed: `update_subscription` and a repeated `subscribe` return error code 13" | **verified**; recorded for the relay owner (no site text depends on it) |

## C. Live demo REST API (public, unauthenticated) — responses read this session

| # | Request (click to re-run) | Observed (2026-11-21 ~23:0x–23:1xZ) | What it verifies |
|---|---|---|---|
| C1 | [`GET /events?status=open&limit=200&series_ticker=KXAAAGASW`](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&limit=200&series_ticker=KXAAAGASW) | one event: `KXAAAGASW-26NOV23` "US gas prices this week", `category: Economics`, `settlement_sources: [{name: "AAA", url: "https://gasprices.aaa.com/"}]`, `strike_date 2026-11-23T04:59:00Z` | **F4 is stale**: the demo exchange does have an open gas-price event today. F4 → superseded (see Flagged) |
| C2 | [`GET /events/KXAAAGASW-26NOV23?with_nested_markets=true`](https://external-api.demo.kalshi.co/trade-api/v2/events/KXAAAGASW-26NOV23?with_nested_markets=true) | nested markets `status: "active"`, `result: ""`; every field the site reads is present: `last_price_dollars`, `previous_price_dollars`, `previous_yes_bid_dollars`, `previous_yes_ask_dollars`, `yes_bid_size_fp`, `yes_ask_size_fp`, `no_bid_dollars`, `no_ask_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `notional_value_dollars: "1.0000"`, `price_ranges: [{start 0.0000, end 1.0000, step 0.0100}]`, `settlement_timer_seconds: 300`, `rules_primary`, `updated_time`. No `no_bid_size_fp` / `no_ask_size_fp` | Field usage in `market.js`, `alerts-core.js`, `category.js` **verified** against a live object. Market `…-3.6400` shows `previous_price_dollars 0.0300` → `last_price_dollars 0.8400`, a genuine ≥ $0.10 move the Overview's "Biggest swings" table would list (labelled as a day-old baseline, Z1) |
| C3 | [`GET /markets/KXAAAGASW-26NOV23-3.6200/orderbook?depth=5`](https://external-api.demo.kalshi.co/trade-api/v2/markets/KXAAAGASW-26NOV23-3.6200/orderbook?depth=5) | `{"orderbook_fp":{"no_dollars":[],"yes_dollars":[["0.3900","33.71"],["0.9600","173.61"]]}}` | Documented `orderbook_fp` shape (bids only, `[price, size]` pairs) **verified**; the best YES bid `0.9600 × 173.61` equals the market object's `yes_bid_dollars` / `yes_bid_size_fp` from C2 — the liquidity table and the market quote agree |
| C4 | [`GET /series/KXAAAGASW/markets/KXAAAGASW-26NOV23-3.6200/candlesticks?start_ts=1795216250&end_ts=1795302650&period_interval=60`](https://external-api.demo.kalshi.co/trade-api/v2/series/KXAAAGASW/markets/KXAAAGASW-26NOV23-3.6200/candlesticks?start_ts=1795216250&end_ts=1795302650&period_interval=60) | `candlesticks[]` with `end_period_ts`, `price.{open,high,low,close,mean,previous}_dollars`, `yes_bid.*`, `yes_ask.*`, `volume_fp`, `open_interest_fp`. **Candles with `volume_fp: "0.00"` carry only `price.previous_dollars` — no `close_dollars`** | `fetchCandles()` shape **verified**. The zero-volume case is handled: `num(undefined)` → `null` and null-`y` points are treated as gaps, so no close price is fabricated for a candle with no trades |
| C5 | same route with `period_interval=5` | the fetch tool returned a generic failure (it does not expose non-2xx bodies) | **not verified by this session**; the HTTP `400` for `period_interval=5` is the GitHub-runner capture in `reports/verify-facts-v3.md`. Allowed intervals 1 / 60 / 1440 are the documented ones (prior sessions) |
| C6 | [`GET /series/KXGAS`](https://external-api.demo.kalshi.co/trade-api/v2/series/KXGAS) | `ticker: "KXGAS"`, `title: "Gas weekly"`, `category: Economics`, `tags: null`, `last_updated_ts: 2026-11-21T21:52:45Z`, `contract_terms_url …/contract_terms/GAS.pdf`, `contract_url` on the **staging** bucket, settlement source EIA weekly retail gasoline | see SB4 update below |
| C7 | [`GET /series/GAS`](https://external-api.demo.kalshi.co/trade-api/v2/series/GAS) | `ticker: "GAS"`, `title: "Gas weekly"`, same category / terms PDF / settlement source, `last_updated_ts: 2026-11-02T23:01:12Z`, `contract_url` on `assets.kalshi.com` | **Two distinct series records** share one product definition. The SB4 inference that `KXGAS` *resolves to* `GAS` is not what the API returns now (and `data/snapshot.json`'s `GAS` row matches C7 field-for-field, not C6). Not stated as an alias anywhere on the site — correct |
| C8 | [`GET /events?series_ticker=KXGAS&limit=200`](https://external-api.demo.kalshi.co/trade-api/v2/events?series_ticker=KXGAS&limit=200) | `events: []` | `KXGAS` currently has **no events of any status**; the Gas page's open markets come from the `KXAAAGAS*` AAA series |
| C9 | [`GET /events?series_ticker=GAS&limit=200`](https://external-api.demo.kalshi.co/trade-api/v2/events?series_ticker=GAS&limit=200) | 2023 weekly events only (`GAS-23SEP18`, `GAS-23SEP11`, … , EIA settlement source) | `GAS` is the legacy-prefix history; nothing open |

## D. Register / documentation drift found — and what happened to it

While this branch was open (23:08Z–23:24Z), eight parallel sessions merged PRs #89–#103 into `main`. Several reached the same
conclusions independently. The table records, per item, who closed it and what this session contributed; nothing of theirs was
discarded in the merge (the board conflict was union-resolved with `tools/resolve_board_conflict.py`, `flagged.html` kept their
card text with this session's live re-reads appended, and `VERIFICATION.md` / `index.html` were taken from `main`).

| Item | Was | Now | Closed by | This session's contribution |
|---|---|---|---|---|
| Flagged **F4** | "The demo environment has no open gas-price markets" — `open` | mitigated: a point-in-time observation about 2026-11-20 | session `c33971c1`, PR #91 | addendum: nested-market `status: "active"`, the five open gas events from `29749918`, re-runnable live links (C1, C2) |
| Flagged **F10** | "WebSocket streaming is documented but not wired in" — `open` | mitigated: relay + SSE + REST fallback, residuals W1/W4 | session `c33971c1`, PR #91 | verified the same files (`scripts/relay.py`, `assets/js/live-feed.js`) and the official ticker page (B1–B3); their text kept |
| Flagged **E1** / `QUESTIONS.md` Q9 / `questions.html` Q1 | "API gives contracts, not dollars" — `open` | fixed: REST contract counts + `notional_value_dollars`; WebSocket ticker's integer `dollar_volume` / `dollar_open_interest` quoted from the official source; path limitation stated | **this session** | B4 |
| `questions.html` Q10 | "don't know … whether the ticker channel can deliver every intermediate price change" | answered from the official page: it does not; `trade` / `orderbook_delta` are the per-change channels | **this session** | B1 |
| Flagged **E3** / `VERIFICATION.md` | 2026-11-20 header, `docs/` pointers, CORS "unverified" | fixed: file rewritten (36 rows, re-dated, root register pointer, CORS verified, new rows 14/15/32 on dollar fields and `KXGAS` ≠ `GAS`) | session `c33971c1`, PR #91 | this session's own edit of the file was superseded and dropped in favour of `main`'s rewrite; every row of the rewrite was re-read against sections A–C of this report and none contradicts them |
| Flagged **SB4** | "cannot reach the API to ask again" — `unverified` | mitigated: two distinct series records; alias inference withdrawn | session `c33971c1`, PR #91 | addendum: `KXGAS` has no events of any status, `GAS` has 2023 events only, `last_updated_ts` values, `contract_url` hosts (C6–C9); the `scripts/collect.py` comment is logged for the collector owner |
| Flagged **A11** | proxy ranking, `open` | mitigated: on-demand official traded-dollar measurement from `GET /markets/trades` on every category page | session `135bc17e`, PR #98 | K1 records the third, exchange-aggregated figure (`dollar_volume`) that lives only on the WebSocket path |
| `index.html` dead `rows` array | rebuilt on every refresh, never read, already drifted from the live template | removed | session `02091230`, PR #94 (commit `40e81d6`) — identical removal made here independently | Flagged **K2** records it (it had no card) |
| `flagged.html` markup | a stray `</div>` after F10 closed the "Unverified" section early, so F13–F16 rendered outside their card; still present on `main` @ `bb9c0a9` | removed; `div` nesting balanced on all 36 pages | **this session** | Flagged **K3**; `html.parser` tag-balance pass before/after |
| Flagged **K1** (new, open) | — | the Market Ticker payload's `dollar_volume` / `dollar_open_interest` are the exchange's own whole-dollar aggregates; WebSocket-only; not read by the relay mapper; owner decision whether to surface or cross-check | **this session** | B4 |

## E. Not verified in this session (left as is)

* Any authenticated call (balance, positions, fills, orders, the WebSocket handshake itself): no demo key exists in this
  environment, by design. Status unchanged (F1, F2, W1, W4).
* HTTP status codes of rejected requests (C5): the fetch tool hides non-2xx bodies; runner captures remain the evidence.
* The unit of `dollar_volume` beyond the official phrase "whole-dollar": the sample payload shows `dollar_volume: 16948`
  against `volume_fp: "33896.00"` and `price_dollars: "0.4800"`; the relation to the last price is not defined on the page and
  is **not** asserted anywhere on the site.
* The reason `data/snapshot.json` (20:46Z) carries a `GAS` row but no `KXGAS` row after a `GET /series/KXGAS` call: C6's
  `last_updated_ts` (21:52:45Z, after the snapshot) is *consistent with* the record having changed in between, but that is
  an inference and is recorded only as such.

## F. Checks run on the merged tree (this branch + `main` @ `bb9c0a9`, after PRs #89–#104)

`node --test tests/*.test.mjs tests/dom/*.test.mjs` **169/169** · `python3 -m unittest discover -s tools` **OK** ·
`python3 -m unittest discover -s tests` **OK (3 skipped)** · `tools/check_site_links.py .` **36 pages / 0 broken** ·
`tools/verify/page-runtime-check.mjs` **18/18** · `evidence/auth-sign-test.mjs` **6/6** · `tests/dom` **21/21** alerts + **18/18** category, summary DOM
(claim counts 86/98 verified · 9 partial · 3 unverified; flag counts 36 open · 45 mitigated · 81, all DOM-derived) ·
HTML tag-balance pass (`div/main/ul/p/h2/h3`) over all 36 pages: clean. The PR record with the Pages result is in
`COORDINATION.md` (session `0acc711d`, final record).

# Line-by-line verification — session `0ecc28c2`

**Date:** 2026-11-21 (UTC) · **Branch:** `arena/0ecc28c2-kalshidash2` · **Base:** `cc9112b` (merge of PR #88)
**Role:** independent re-verification and final integration.

**Method.** Every claim below was checked by fetching the cited
`docs.kalshi.com` page and comparing its wording with the code or page in this
repository. No value was inferred. Where a claim could not be confirmed, it is
listed under **Findings** and was **not** rewritten into the site.

**Container limitation (stated, not hidden).** This sandbox cannot open TLS to
`*.kalshi.co`, `docs.kalshi.com` or the Pages host — `curl` returns HTTP `000`
(`SSL_ERROR_SYSCALL`). Official documentation was therefore read through a
page-fetch tool, and the *published* site was read the same way. Live API
behaviour is verified by the GitHub-hosted workflows cited in
`COORDINATION.md` (run IDs on `main`), not from this container.

---

## 1. Local suite results on this branch

| Suite | Result |
|---|---|
| `node --test tests/*.test.mjs` | **78 / 78 pass**, 0 fail |
| `python3 -m unittest discover -s tools` | **42 / 42 pass** |
| `python3 -m unittest discover -s tests` | 20 tests, **OK** (3 skipped: `cryptography` not installed here; CI installs it) |
| `node tools/verify/page-runtime-check.mjs` | **17 / 17 pages ran clean** |
| `node evidence/auth-sign-test.mjs` | **6 / 6 checks passed** |
| `python3 tools/check_site_links.py .` | **35 pages, 0 broken local links** |
| `tests/dom/alerts-dom.mjs` (after `npm ci`) | **19 / 19 checks passed** |
| `tests/dom/summary-dom.mjs` | passed: 20 requirement areas · 78/89 verified, 8 partial, 3 unverified · 41 open, 31 mitigated, 72 total flags · 28 sourced rows |
| `tests/dom/live-site-assertions.test.mjs`, `live-site-no-match.test.mjs` | covered in the 78 Node tests above |

Flag-register arithmetic was re-derived independently from `flagged.html`
rather than trusted: **72 cards** — 40 `open`, 16 `fixed`, 15 `mitigated`,
1 `unverified`. That matches `summary-dom.mjs`'s 41 open / 31 mitigated
(41 = 40 `open` + 1 `unverified`; 31 = 16 `fixed` + 15 `mitigated`).

---

## 2. Claims verified this session against the official source

Each row: the site's statement → the official page that was fetched → verdict.

| # | Site statement (where) | Official source fetched | Verdict |
|---|---|---|---|
| 1 | Demo REST root `https://external-api.demo.kalshi.co/trade-api/v2` is the **recommended** demo root (`config.js` `DEMO.rest`, claims register) | [API Environments](https://docs.kalshi.com/getting_started/api_environments), [Demo env](https://docs.kalshi.com/getting_started/demo_env) | **Confirmed** — both tables list it as "Recommended base URL" |
| 2 | `https://demo-api.kalshi.co/trade-api/v2` is "also supported" (`config.js` `ALTERNATES`) | same two pages | **Confirmed** — "Also supported" column |
| 3 | Demo WebSocket `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (`config.js` `DEMO.ws`) | [API Environments](https://docs.kalshi.com/getting_started/api_environments), [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) | **Confirmed**, verbatim |
| 4 | Shared demo WS host remains supported | [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) — "The existing shared WebSocket hosts … `wss://demo-api.kalshi.co/trade-api/ws/v2` for demo, remain supported" | **Confirmed** |
| 5 | WS pre-sign text is `timestamp + "GET" + "/trade-api/ws/v2"` (`config.js` comment, `evidence/auth-sign-test.mjs`, alerts page) | [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets) — "Create the message to sign: `timestamp + "GET" + "/trade-api/ws/v2"`" | **Confirmed**, verbatim |
| 6 | WS handshake requires the three `KALSHI-ACCESS-*` headers, even for public channels | same page — "WebSocket connections require authentication during the connection handshake" | **Confirmed** |
| 7 | Public market-data channels vs private channels list (`claims.js`) | same page — public: `ticker`, `trade`, `market_lifecycle_v2`, `multivariate_market_lifecycle`; private: `orderbook_delta`, `fill`, `market_positions`, `communications`, `order_group_updates`; plus "`user_orders` is also a private channel" | **Confirmed exactly**, including `user_orders` |
| 8 | Subscriptions and `sid` do not survive a reconnect | same page — "Subscriptions and `sid` values do not carry over, so subscribe again after reconnecting" | **Confirmed** |
| 9 | `ticker` flush is "about once per second", coalesced, intermediate values not sent | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) — "sent on a flush scheduled every second … intermediate values are not sent" | **Confirmed**; site also correctly notes the schedule is not a guaranteed minimum gap |
| 10 | `ticker` payload has no `previous_price_dollars` (`claims.js`, Flagged W2) | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) field list: `market_id, market_ticker, price_dollars, yes_bid_dollars, yes_ask_dollars, volume_fp, open_interest_fp, dollar_volume, dollar_open_interest, yes_bid_size_fp, yes_ask_size_fp, last_trade_size_fp, ts, ts_ms, time` (+ optional `sending_ts_ms`) | **Confirmed** — no `previous_price_dollars` in the schema |
| 11 | `previous_price_dollars` is "the last traded YES contract **a day ago**" (alerts page, Flagged Z1) | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) — "Price for the last traded YES contract on this market a day ago in dollars" | **Confirmed**, verbatim |
| 12 | `last_price_dollars` = last traded YES price; `volume_fp` = market volume **in contracts**; `open_interest_fp` = contracts bought disregarding netting; `notional_value_dollars` = value of one contract at settlement | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | **Confirmed** — supports the site's refusal to call volume × price "dollars traded" (A11) |
| 13 | REST market data is cached briefly and can lag a few seconds | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Quick Start: Market Data](https://docs.kalshi.com/getting_started/quick_start_market_data) — "Responses are cached for a short time, so prices, sizes and `status` can lag the exchange by several seconds" | **Confirmed** |
| 14 | Order book returns **bids only**; a NO bid at *y* implies a YES ask at *1 − y*; arrays ascending, best bid last; empty book returns 200 | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook), [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) | **Confirmed**; `deriveQuote()` in `assets/js/kalshi.js` implements exactly `bestYesAsk = 1 − bestNoBid` and the category page's "resting bids to **buy** YES, not offers to sell" wording matches the docs |
| 15 | Order-book `depth` parameter, 0–100, best N levels per side | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) | **Confirmed** — site uses `depth=20`, inside the documented range |
| 16 | Candlestick `period_interval` ∈ {1, 60, 1440} minutes only (`config.js` `CANDLE.intervals`) | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) — `enum: 1, 60, 1440` | **Confirmed** |
| 17 | One candlestick request may span at most **5,000 periods** (`CANDLE.maxPeriodsPerRequest`) | same page | **Confirmed**; `fetchCandles()` splits ranges by `5000 × interval × 60` s, which is the documented rule |
| 18 | Candlestick route is `/series/{series_ticker}/markets/{ticker}/candlesticks` (`market.js`) | same page | **Confirmed** |
| 19 | Candle `price` object fields `open/high/low/close/mean/previous_dollars`, and `yes_bid`/`yes_ask` distributions (`market.js` mapping) | same page, `PriceDistribution` / `BidAskDistribution` | **Confirmed**; site treats nulls as "no trade", matching "May be null if there was no trade during the period" |
| 20 | Order creation is `POST /portfolio/events/orders` (V2); legacy `/portfolio/orders` writes return `410 deprecated_v1_order_endpoint`; `201` means accepted, check `remaining_count` | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | **Confirmed**, verbatim, including the `410` code name |
| 21 | Required order fields `ticker, side, count, price, time_in_force, self_trade_prevention_type` (`claims.js`) | same page — `required:` list | **Confirmed exactly** |
| 22 | `side` is `bid`/`ask` where **bid ≡ yes, ask ≡ no**, not buy/sell | [Order Direction](https://docs.kalshi.com/getting_started/order_direction) — "`bid ≡ yes`, `ask ≡ no`, always" + the legacy-mapping table | **Confirmed** |
| 23 | Auth headers `KALSHI-ACCESS-KEY/TIMESTAMP/SIGNATURE`; sign `timestamp + METHOD + path` with the query string stripped; path must include `/trade-api/v2` | [API Keys](https://docs.kalshi.com/getting_started/api_keys) | **Confirmed**, including the explicit "strip the `?` and everything after it" warning |
| 24 | Timestamp tolerance **±30 seconds**, else `401 header_timestamp_expired` | same page | **Confirmed**, verbatim |
| 25 | RSA-PSS/SHA-256, MGF1-SHA256, salt = digest length; **Ed25519 also supported** and is the recommended type | same page — key-type table | **Confirmed**; note the page now recommends Ed25519 while the site's register lists RSA first — no contradiction, but see Finding F2 |
| 26 | "PEM header does not identify the algorithm" (claims row "Private key PEM is PKCS#8") | same page — "The PEM header does not identify the key type" | **Confirmed as to the substance**; the claim *title* says "is PKCS#8", which the page states only for the Kalshi-generated Ed25519 key. See Finding F1 |
| 27 | Rate limits are token-bucket; most requests cost 10 tokens; balance endpoint 1/s on Basic/Advanced, 5/s above; 429 carries no `Retry-After`; unauthenticated limits are separate and not published as numbers | [Rate Limits](https://docs.kalshi.com/getting_started/rate_limits) | **Confirmed**, all four clauses, verbatim |
| 28 | Market lifecycle statuses `initialized, inactive, active, closed, determined, disputed, amended, finalized`; filter mapping `unopened→initialized`, `open→active`, `paused→inactive`, `closed→past close_time`, `settled→finalized`; `settlement_ts` populated at finalization | [Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) | **Confirmed**; the site's A9 card quotes this page and the Get Markets page separately and correctly says they disagree |
| 29 | Get Markets `status` filter is documented as four values (`unopened, open, closed, settled`) in the page description, while its parameter `enum` lists five (adding `paused`) | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | **Confirmed** — the OpenAPI dump for that page carries `enum: unopened, open, paused, closed, settled` while the description says four. A9 describes this accurately and does **not** assert which is authoritative |
| 30 | Settlement: Yes holders receive $1/contract on Yes, No holders $1 on No; only net positions settle; settlement fees zero for simple yes/no | [Market Settlement](https://docs.kalshi.com/getting_started/market_settlement) | **Confirmed**, verbatim |
| 31 | Fee rounding: trade fee rounded up to $0.000001, then a rounding fee restores the member's precision grid ($0.0001 direct, $0.01 non-direct), with a per-order accumulator and rebate | [Fee Rounding](https://docs.kalshi.com/getting_started/fee_rounding) | **Confirmed**, verbatim — this is exactly the mechanism Flagged Z2 says the simulator implements |
| 32 | Price grids are per-market `price_ranges` with `start/end/step`; off-grid prices are rejected; `price_level_structure` is a label only | [Fixed-Point Representation](https://docs.kalshi.com/getting_started/fixed_point_migration) | **Confirmed**, verbatim; `snapToGrid()` in `kalshi.js` reads `price_ranges`, as the page instructs |
| 33 | `GET /events` accepts `status` values `unopened/open/closed/settled` only | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) | **Confirmed** |
| 34 | Event record carries `settlement_sources` (name + url) and the event-level `category` | [Get Event](https://docs.kalshi.com/api-reference/events/get-event) | **Confirmed** — and the event `category` is marked `deprecated: true`. Already published as Flagged **AB3**; re-confirmed this session |
| 35 | `GET /series` returns `category`, `categories[]`, `tags[]`, `settlement_sources`, `contract_url`, `contract_terms_url` | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | **Confirmed** |
| 36 | Categories are fields on the **series**, not levels above it; the glossary's worked example is the monthly US gas price series under Economics + Commodities | [Kalshi Glossary](https://docs.kalshi.com/getting_started/terms) | **Confirmed** — and directly relevant to Finding F3 |
| 37 | `GET /search/tags_by_categories` returns a category→tags map built from series with open markets | [Get Tags for Series Categories](https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories) | **Confirmed** — a cheaper authoritative alternative to per-series lookups (see Suggestion S1) |
| 38 | Exchange status returns `exchange_active` and `trading_active`; flags are meaningful only on a 200 | [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) | **Confirmed**; the page's caveat that a 500/503/504 body can also carry `false` flags is **not** repeated on the site — see Finding F4 |
| 39 | `GET /markets?tickers=` takes a comma-separated list; `limit` max is 1000 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) — `TickersQuery`, `MarketLimitQuery` (`maximum: 1000`) | **Confirmed**. The page documents **no** maximum list length, so the site's 25-per-call batch is a self-imposed convention and is labelled as such (A7) |
| 40 | `GET /portfolio/fills` returns `fills` + `cursor`, max limit 1000, `min_ts`/`max_ts` in seconds | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | **Confirmed** |
| 41 | `GET /portfolio/orders` (Get Orders) is the read route, while the **write** routes moved to `/portfolio/events/orders` | [Get Orders](https://docs.kalshi.com/api-reference/orders/get-orders) — `path: /portfolio/orders` with `get:` only | **Confirmed** — resolves the "order endpoint differs" irregularity recorded by an earlier session; both are correct for their own verb |

**Also re-read and used as context:** [llms.txt](https://docs.kalshi.com/llms.txt)
documentation index (10 chunks), which confirms every page cited above exists,
and shows `/api-reference/orders/get-orders` — not
`/api-reference/portfolio/get-orders` — as the Get Orders path.

---

## 3. Findings

Classification: **Fixes** were applied in this branch because they correct a
published statement against its own cited source and touch no shared data.
**Flags** are published for review and change no value.

### F1 — (fixed) A claims row overstated what the API-keys page says about PEM

* **Where:** `assets/js/claims.js`, row *"Private key PEM is PKCS#8"*.
* **What it said:** "Private key PEM is PKCS#8" with detail "PEM header does not
  identify the algorithm", status `verified`.
* **What the source says:** [API Keys](https://docs.kalshi.com/getting_started/api_keys)
  documents PKCS#8 for the **Kalshi-generated Ed25519** key, PKCS#1 for the
  **Kalshi-generated RSA** key, and then says the header "does not identify the
  key type: PKCS#8 RSA keys … also begin with `-----BEGIN PRIVATE KEY-----`".
  A blanket "the PEM is PKCS#8" is therefore wrong for the RSA key Kalshi emits.
* **Fix:** re-titled to *"The PEM header does not identify the key type"* and the
  detail now states the PKCS#8-vs-PKCS#1 distinction and says the type must be
  read from the parsed key. Same source, same `verified` status.
* **Why it matters:** the signing self-test detects the key type from the parsed
  key, so the code was already right; only the published claim was loose.

### F2 — (fixed) Two topic claims cited a page that does not say what they claim

* **Where:** `assets/js/claims.js`, rows *"Elections is a category"*,
  *"Crypto is a category"* and *"Golf lives inside Sports"*.
* **What it said:** `source: …/getting_started/terms` (*Kalshi Glossary*).
* **What the page says:** the Glossary explains what a category *is* and gives
  gas as its worked example. It does not enumerate `Elections`, `Crypto` or
  `Sports`, and says nothing about golf.
* **Fix:** sources corrected to the two pages that do carry the evidence —
  [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list)
  (the `category` field definition, and the page the captured category
  vocabulary was read from) and
  [Get Tags for Series Categories](https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories)
  (the official category→tag map). The Glossary stays cited only on the rows it
  actually supports. Statuses unchanged: the underlying observation (a live
  `Elections` / `Crypto` / `Sports` category value) is unchanged and is backed by
  `data/probe/api_surface.json`.
* **Not changed:** *"No gas-price category"*, which cites Get Series List and is
  correct there.

### F3 — (flag, published) The taxonomy reads a deprecated field — already AB3, re-confirmed

Re-read this session: [Get Events](https://docs.kalshi.com/api-reference/events/get-events)
marks the event object's `category` as `deprecated: true`, "Event category
(deprecated, use series-level category instead)", and
[Kalshi Glossary](https://docs.kalshi.com/getting_started/terms) confirms
categories are **series** fields. `classifyEvent()` in `assets/js/market.js`
reads `ev.category`. This is already published as **AB3** and needs no new card;
the fix is a design change owned by whoever holds `market.js` (see Suggestion S1
for a low-cost path). No code changed here.

### F4 — (flag, published) Exchange-status card does not repeat a documented caveat

[Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status)
warns that a `500/503/504` body can carry `exchange_active: false` and
`trading_active: false` **and that this does not mean the exchange is paused**.
The landing page reads those two flags for its "trading is active" strip. If a
5xx body were parsed as a status object, the strip could read "paused" during a
gateway timeout. Published as Flagged **AC1** for review with the exact quote.
No behaviour was changed — the page's reader is in `assets/js/ui.js`, outside
this session's scope.

### F5 — (noted, no action) `config.js: SOURCES.orders` points at the correct route

An earlier session logged that the site links `…/api-reference/orders/get-orders`
while another page linked `…/api-reference/portfolio/get-orders`. This session
confirmed against [llms.txt](https://docs.kalshi.com/llms.txt) and
[Get Orders](https://docs.kalshi.com/api-reference/orders/get-orders) that
**`/api-reference/orders/get-orders`** is the correct path and the
`portfolio/…` form does **not** exist (direct fetch returns an error page).
The one remaining `portfolio/get-orders` string in the repository is inside
`COORDINATION.md` and `reports/verify-facts-v4.md` — historical narrative, not a
live link. No published page links the wrong path.

### F6 — (noted) Historical audit artifacts cite a truncated URL — already X4

`reports/external-links-audit.md` records HTTP 404 for
`https://docs.kalshi.com/api-reference/orders/create-ord` (truncated in a raw
capture). Already published as Flagged **X4**, which is accurate and links the
current, correct Create Order V2 page. Nothing to change.

### F7 — (noted) The published site is live and serving current content

Read from the deployed origin this session: the landing page renders the
"Live events by topic" board and reports the exchange as active; the alerts page
renders both feeds, states the `|change| ≥ $0.10` threshold, and states the "a
day ago" basis for the exchange-reference comparison; `verification.html`
renders 78 verified / 8 partial / 3 unverified of 89 claims. Pages API reports
`status: built`, `build_type: legacy`, source `main:/`, `https_enforced: true`.

---

## 4. Suggested next steps (posted, not implemented here)

**S1 — close AB3 cheaply.** `GET /search/tags_by_categories` returns a
category→tag map in **one** unauth'd call and is built from series that
currently have open markets. Reading the primary category from
`GET /series?category=…` once per page load, and keeping `ev.category` as the
labelled fallback, would move the taxonomy onto the non-deprecated basis without
the per-series lookup cost AB3 cites. Owner: `assets/js/market.js`,
`assets/js/alerts.js`.

**S2 — guard the exchange-status strip.** Read the flags only from an HTTP 200
body, per the caveat quoted in F4.

**S3 — make source citations testable.** The F2 class of defect (a row citing a
page that does not contain the claim) is invisible to every existing check,
because checks assert *that a link exists*, not *that the linked page says it*.
A small `tests/source-attribution.test.mjs` holding, per topic row, a required
substring that must appear on the cited page would catch it — but it needs
network access, so it belongs in a GitHub-hosted workflow next to
`verify-live.yml`.

---

## 5. What this session did **not** touch

`index.html`, `assets/js/market.js`, `assets/js/alerts.js`, `assets/js/ui.js`,
`data/snapshot.json`, `scripts/collect.py`, and every page owned by a session
that was still running when this claim landed (`117dc8d6` had a
final-verification job in flight). Findings that would require editing those are
logged above and published, never silently rewritten.

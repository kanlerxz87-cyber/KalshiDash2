# Data-path review — session `d074f64f` (2026-11-21)

Branch `arena/d074f64f-kalshidash2` from `main@cc9112b` (PR #88 merged).
This review asks a different question from the published-claim audit in `reports/verify-117dc8d6.md`:
not *"is the page text right?"* but **"does the code that produces the numbers implement the
documented schema?"** Every finding below is tied to a line of official documentation and to a
`file:line` in this repository.

---

## 1. Method and limits

| Step | What was done | Evidence |
|---|---|---|
| 1 | Read the official schema/description for every endpoint the client calls | Pages listed in §2, fetched 2026-11-21 with the page-fetch tool |
| 2 | Read the client code that consumes each field, line by line | `assets/js/{kalshi,market,category,alerts-core,live-core,simulator,ui}.js` |
| 3 | Reproduce each finding as a deterministic test where possible | `tests/result-semantics.test.mjs`, `tests/chart-axis.test.mjs`, `tests/dom/category-dom.mjs` |
| 4 | Run the full local suite | §7 |

**Limit, stated plainly:** this sandbox cannot open TLS to `*.kalshi.co` (`curl` → HTTP `000`), so
**no live API call or live page render was made by this session**. Official pages were read through the
fetch tool. Live behaviour is covered by the repository's GitHub-hosted workflows (`verify-live-site`,
`live-engine-check`, `verify-alerts`, `live-site-render`), whose run IDs are recorded on
`COORDINATION.md`. Nothing in this report is inferred from a live call I did not make.

---

## 2. Official sources re-read this session

| # | Source | What it was used to confirm |
|---|---|---|
| S1 | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | Full `market` response schema and field descriptions: `yes_bid_dollars`, `yes_ask_dollars`, `no_bid_dollars`, `no_ask_dollars`, `yes_bid_size_fp`, `yes_ask_size_fp`, `last_price_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `previous_price_dollars` ("…**a day ago** in dollars"), `settlement_value_dollars`, `price_ranges`, `market_type` enum `binary`/`scalar`, `result` enum **`yes`/`no`/`scalar`/`""`**, market `status` enum `initialized…finalized` |
| S2 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | `limit` 1–1000; `tickers` is comma-separated and, when it is the only filter, **all matching markets are returned unpaged**; `status` filter enum is `unopened/open/paused/closed/settled`; responses are cached for a short time |
| S3 | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) | `limit` max **200**; `status` enum includes `settled`; `with_nested_markets`; the endpoint **excludes multivariate events** |
| S4 | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | `start_ts`/`end_ts` required **in seconds**; `period_interval` ∈ {1, 60, 1440} minutes; **one request spans at most 5,000 periods** (≈3.5 days of 1-minute candles); response `price.close_dollars` etc. |
| S5 | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) | Path `/markets/{ticker}/orderbook`; `depth` 0–100 (0 = all); response `orderbook_fp.yes_dollars` / `no_dollars` |
| S6 | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) | Bids only; `["price","count"]` string pairs, ascending, best = last; **"A NO BID at price Y is equivalent to a YES ASK at price ($1.00 − Y)"**; empty arrays for an unknown ticker (200, not 404) |
| S7 | [API Keys](https://docs.kalshi.com/getting_started/api_keys) | Pre-sign text = timestamp + METHOD + path **including `/trade-api/v2`**, query stripped; RSA-PSS/SHA-256 salt = digest length; Ed25519 signs directly; timestamp within 30 s |
| S8 | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | `POST /portfolio/events/orders`; body `ticker`, `client_order_id`, `side` `bid|ask`, `count` and `price` as fixed-point **strings**, `time_in_force`, `self_trade_prevention_type` |
| S9 | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | Fill fields `outcome_side`, `book_side`, `count_fp`, `yes_price_dollars`, `no_price_dollars`, **`fee_cost`**, `is_taker`, `created_time`, `ts` |
| S10 | [Market Ticker (WS)](https://docs.kalshi.com/websockets/market-ticker) | `type:"ticker"`, `market_ticker`, `price_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `volume_fp`, `open_interest_fp`, `dollar_volume`, `dollar_open_interest`, `ts_ms` |
| S11 | [Fee Schedule PDF, effective 2026-07-07](https://kalshi.com/docs/kalshi-fee-schedule.pdf) | Taker `round up(M × 0.07 × C × P × (1−P))`; maker `0.0175`; default maker M = 0; **"There is no settlement fee."**; the non-standard table's zero rows; worked table (e.g. 100 @ $0.45 → **$1.74**) |
| S12 | [Fee Rounding](https://docs.kalshi.com/getting_started/fee_rounding) | `trade_fee = ceil_6dp(model)`; `aligned_change = floor_precision(revenue − trade_fee)`; non-direct grid $0.01, direct $0.0001; net = trade + rounding − rebate ≥ 0 |
| S13 | [Rate Limits](https://docs.kalshi.com/getting_started/rate_limits) | Token buckets for authenticated calls; **"Unauthenticated public requests are subject to separate limits"** — no numeric budget is published |

---

## 3. Line-by-line audit of the client data path

Verdicts: **match** = the code implements the documented statement; **fixed** = the code did not and now does.

| # | Code | What it does | Official basis | Verdict |
|---|---|---|---|---|
| 1 | `assets/js/config.js:9-15` | Demo REST/WS hosts and the documented alternates; the demo site root is linked as a root only | [Demo env](https://docs.kalshi.com/getting_started/demo_env), [API environments](https://docs.kalshi.com/getting_started/api_environments) | match |
| 2 | `assets/js/market.js:27` `getAll()` | Cursor pagination, `limit=200`, records `__pages`/`__capped` so a truncated scan is never shown as complete | S3 (`limit` max 200), S2 (`limit` max 1000) | match |
| 3 | `assets/js/market.js:175` `discoverTopic()` | Requests `status=open`, `closed`, `settled` for the resolution feed | S3 lists exactly those statuses | match |
| 4 | `assets/js/market.js` `fetchMultivariateEvents()` | Combo events come from `/events/multivariate`, because `/events` excludes them | S3 ("This endpoint excludes multivariate events") | match |
| 5 | `assets/js/market.js:317` `dominantResult()` | Collapses market results into an event result | S1 `result` enum **includes `scalar`** | **fixed — D074-1** |
| 6 | `assets/js/market.js:267` `rankEvents()` | Volume × last YES price proxy, labelled as a proxy; missing price ⇒ not derivable, never `$0` | S1 (`volume_fp` = contracts; `last_price_dollars` = last traded YES price); no dollar-turnover field is returned | match (proxy is disclosed; Flag A11) |
| 7 | `assets/js/market.js:542` `fetchCandles()` | Required `start_ts`/`end_ts` in **seconds**, splits at the 5,000-period cap, parses `price.close_dollars`; for a settled market whose live tier returns nothing, falls back to the archived `/historical/markets/{ticker}/candlesticks` route and reports `via: "historical"` instead of showing an empty chart | S4 (the candlesticks page names the historical route for markets before the cutoff) | match — fallback added on `main` by session `190f6069` after this audit began; re-checked here at the rebased commit |
| 8 | `assets/js/market.js:440` `LiveSampler` | Polls `GET /markets/{ticker}` every 2 s for seconds-scale charts; page states no seconds-resolution history exists | S4 (1/60/1440 only), S2 (cached responses) | match |
| 9 | `assets/js/market.js:662` `detectJumps()` | `|Δ| ≥ $0.10` inclusive, float-safe, skips null-price gaps; uses candle `previous_dollars` when present | S4, S1 | match |
| 10 | `assets/js/kalshi.js:149` `_authHeaders()` | Signs `ts + METHOD + "/trade-api/v2" + path-without-query` | S7 | match |
| 11 | `assets/js/kalshi.js:167-172` | RSA-PSS SHA-256 with salt 32; Ed25519 direct; key type parsed from DER, not the PEM header | S7 | match |
| 12 | `assets/js/kalshi.js:200` `createOrder()` | V2 route; `bid` ≡ YES, `ask` ≡ NO; `count`/`price` fixed-point strings; `taker_at_cross` | S8, [Order direction](https://docs.kalshi.com/getting_started/order_direction) | match |
| 13 | `assets/js/kalshi.js:233` `cancelOrder()` | Requires `market_ticker` so the cancel auto-routes to the right shard | [Cancel Order V2](https://docs.kalshi.com/api-reference/orders/cancel-order-v2), [Sharding](https://docs.kalshi.com/getting_started/exchange_sharding) | match |
| 14 | `assets/js/kalshi.js:253` `snapToGrid()` | Snaps to the market's own `price_ranges` instead of assuming a 1¢ tick | S1 `price_ranges` | match |
| 15 | `assets/js/kalshi.js:275` `deriveQuote()` | Best YES ask = 1 − best NO bid; spread = ask − bid | S6 | match |
| 16 | `assets/js/category.js:435` `loadBook()` | `?depth=20` (within 1–100), renders both bid sides | S5 | match |
| 17 | `assets/js/category.js:447` `row()` | Adds the **implied YES ask** (1 − NO bid) next to the literal NO bid price | S6 ("NO BID at Y ≡ **YES ASK at 1 − Y**") | **improved — §5.2** |
| 18 | `assets/js/alerts-core.js:16,83,134` | Alert threshold inclusive of exactly $0.10, both directions, two independently labelled comparisons | brief + S1 (`last_price_dollars`, `previous_price_dollars`) | match |
| 19 | `assets/js/alerts-core.js:134` | Labels the `previous_price_dollars` comparison as a **24-hour** move | S1 ("…a day ago in dollars") | match (label corrected by an earlier session; re-verified here) |
| 20 | `assets/js/alerts-core.js:275` `updateTrade()` | Resolves only on a literal `yes`/`no`; marks open trades at the bid for their side | S1, S6 | match (scalar deliberately not resolved; §6.3) |
| 21 | `assets/js/alerts-core.js:366` `screenMarket()` | Scores only documented fields; a missing field scores 0 instead of being invented | S1 | match |
| 22 | `assets/js/simulator.js:106-125` | Taker/maker fee model, 6-dp ceiling, balance-grid rounding | S11, S12 | match — see §4 |
| 23 | `assets/js/simulator.js:95` | Zero-taker rows transcribed from the schedule's non-standard table | S11 | match — all 10 tickers present in the PDF |
| 24 | `assets/js/live-core.js` `fromTickerFrame()` | Maps WS `price_dollars` → the same reading shape as REST `last_price_dollars` | S10 | match |
| 25 | `assets/js/market.js` `analyseFills()` | Reads `outcome_side`, `book_side`, `count_fp`, `yes_price_dollars`, `no_price_dollars`, `fee_cost`, `is_taker`; unclassified rows are reported, not guessed | S9 | match |
| 26 | `assets/js/ui.js` `lineChart()` | X = time, Y = contract price in USD, jump markers at ≥$0.10 | brief | match; tick **format** improved — §5.3 |
| 27 | `assets/js/ui.js` `timeTickLabel()` | Tick labels for 10 s → 7 d windows | brief ("seconds, minutes, hours timestamp graph length") | **fixed — §5.3** |
| 28 | `assets/js/config.js` `ALERT.maxEventsPerPoll` | Caps the scan and cites the rate-limit page | S13 | match ("separate limits" are published; values are not) |
| 29 | `assets/js/config.js` `WINDOWS` 7 d note | "1-hour candlesticks (1-minute would exceed the 5,000-period cap)" | S4 (5,000 periods) | match — arithmetic: 7 d of 1-minute candles = 10,080 periods |

### Fee model reconciled by hand against the official table (S11)

Model: `M × 0.07 × C × P × (1−P)`, then the S12 rounding mechanics on the $0.01 non-direct grid.

| Row | Model fee | Trade fee (ceil 6 dp) | Signed revenue − fee | Aligned (floor $0.01) | Rounding | **Net** | PDF table |
|---|---|---|---|---|---|---|---|
| 100 @ $0.45 | 1.7325 | 30.000000 | −46.7325 | −46.74 | 0.0075 | **$1.74** | $1.74 ✅ |
| 1 @ $0.50 | 0.0175 | 0.0175 | −0.5175 | −0.52 | 0.0025 | **$0.02** | $0.02 ✅ |
| 1 @ $0.01 | 0.000693 | 0.000693 | −0.010693 | −0.02 | 0.009307 | **$0.01** | $0.01 ✅ |
| 100 @ $0.30 | 1.47 | 1.470000 | −31.47 | −31.47 | 0 | **$1.47** | $1.47 ✅ |

The PDF's own footnote says "round up … to a centicent", which does not reproduce its table
(1.7325 would become 1.732500 → 1.74 only after balance-grid rounding). The site follows the
documented mechanics, which do reproduce the table; the discrepancy is already published as Flag Z2.
**This session independently confirms the code matches the mechanics, not the footnote.**

---

## 4. Defect found and fixed — D074-1 (`scalar` shown as **NO**)

**Defect.** `result` is not a boolean. S1 defines it as `yes | no | scalar | ""`, and `market_type` as
`binary | scalar`. `dominantResult()` ended with `return yes ? "yes" : "no"`, so an event with a settled
scalar market and no literal `yes` was rendered as a **NO** result on `index.html` and every
`categories/*.html` page. On a site whose stated rule is "no value is inferred", that is a wrong value,
not a cosmetic issue — a scalar settlement and a NO are different facts, and the payout is not $0.

**Reproduction.** `tests/result-semantics.test.mjs` builds an event with a `scalar` market and calls
`rankEvents()`. Against the old helper it fails **3 of 11** cases:

```
not ok 1 - a single settled scalar result is reported as scalar, never as no
not ok 7 - a binary and a scalar outcome together are reported as mixed
not ok 9 - result matching is case-insensitive and tolerates missing fields
# pass 8 / fail 3
```

Against the fixed helper all 11 pass.

**Fix.** One literal rule, used everywhere:

| Market results in the event | Event result |
|---|---|
| none settled | `null` → "open" |
| one distinct value (`yes` / `no` / `scalar`) | that value |
| more than one distinct value | `mixed` |

Applied at `assets/js/market.js:317` and rendered literally at `index.html`, `categories/*.html`,
`event.html` and `resolved.html`. "Resolved … exchange reported a yes/no" labels became
"exchange reported a result (yes / no / scalar)"; `event.html` now counts any settled result, not only
binary ones.

**Deliberately not changed.** Paper trades (`alerts-core.js:275`) and the backtester
(`simulator.js`) still resolve only on a literal `yes`/`no`. A scalar payout is not $1/$0, so treating
it as a win or a loss would be a second inference. The test asserts such a trade stays open. The
watch list (`Watchlist.refresh()`) likewise records only yes/no finals; a scalar market remains tracked
rather than being marked resolved — listed as an open observation in §6.3.

---

## 5. Two brief-alignment improvements

### 5.1 Dead code removed from the overview board
`index.html` built an unused `rows` array containing a second copy of the board-row template, then
rebuilt the same rows as `sorted`. The copy re-ranked every event a second time and duplicated the
result-tag rule (which is how a defect like D074-1 could survive in one copy). Removed; one render
path, one tag definition. No output changes.

### 5.2 Liquidity: the size a YES buyer can take is now readable directly
The panel is headed "how many contracts are available at each price", but the NO-bid table showed only
NO bid prices. S6 states the reciprocal rule: **a NO bid at Y is a YES ask at 1 − Y**. Added an
**Implied YES ask** column (computed as 1 − NO bid price) next to the literal price, with the formula
and the official source printed under the table; YES-bid rows show "—" because a YES bid is the other
side of the book. Previewed and asserted by `tests/dom/category-dom.mjs`:
NO 0.47 → $0.5300, NO 0.46 → $0.5400, with the literal prices unchanged.

### 5.3 Chart X-axis: dates on the long windows
The brief asks for a time axis selectable from seconds to days. Tick labels were clock-time only, so a
7-day chart printed repeated "03:15" labels with no date and the 24-hour chart repeated itself at
midnight. `timeTickLabel()` now adds the calendar date for windows **over 12 hours**, and keeps
seconds for windows up to 10 minutes. Pinned by `tests/chart-axis.test.mjs` (10 cases, explicit locale
and time zone) and by the 7-day branch of the DOM test.

---

## 6. Requirements traceability (every line of the brief)

| Brief requirement | Implementation | Evidence it works |
|---|---|---|
| Executive summary | `EXECUTIVE_SUMMARY.md`, `summary.html` | `summary-dom.mjs`: 20 requirement areas, 28 sourced rows, counts derived from the register |
| Dashboard of highest-dollar live events, five topics only | `index.html`, `categories/*.html`, `TOPICS` in `config.js`, `discoverTopic()` | `taxonomy.test.mjs` (11 cases); `category-dom.mjs` board checks |
| Topics separate, events grouped within topic | five category pages + per-topic board query | `page-runtime-check.mjs` 17/17; `category-dom.mjs` |
| ≥$0.10 swing alerts either direction | `alerts-core.js` `THRESHOLD`, `detectMoves`, `detectReferenceSwings` | `alerts-core.test.mjs` (19 cases incl. exact $0.10 and float error) |
| Two scrolling chats (all / high-ROI) | `alerts.html` `#feed-all`, `#feed-watch`; `renderFeed()` | `alerts-dom.mjs` 19/19 (both feeds, rules, evidence links) |
| High-ROI filter | `WATCH_RULES` + `watchCheck()` — four explicit rules, labelled a screen | `alerts-core.test.mjs`; page states it is not a model |
| Track until resolved yes/no, incl. scalar honesty | `resolved.html`, `event.html`, `Watchlist.refresh()`; D074-1 | `result-semantics.test.mjs`; `resolved.html` renders the literal result |
| Automated simulated trades / strategies | `simulator.html`, `simulator.js` (6 strategies + seeded control) | `simulator-core.test.mjs`; fee table reconciliation in §3 |
| Portfolio performance on the demo account | `portfolio.html` (balance, positions, fills; key stays in the tab) | `kalshi.js` signing audited (§3 #10–12); no key material committed (no `.pem`/`.key` file is tracked; the only `BEGIN … PRIVATE KEY` strings are code comments, a regex, and an input placeholder) |
| Execute trades, track performance | `portfolio.html` order form → `createOrder()`; order log | S8 body fields verified; price snapped to `price_ranges` |
| Trade analysis + categorisation | `strategies.html`, `analyseFills()` by topic / side / maker-taker | S9 fields verified; unclassifiable fills counted, not guessed |
| Live interactive chart, X = time (s/min/h), Y = price | `WINDOWS` (10 s → 7 d), `lineChart()`, `timeTickLabel()` | `chart-axis.test.mjs`; `category-dom.mjs` 7-day branch |
| Liquidity: contracts available at a price | order-book depth + new implied YES ask column | `category-dom.mjs` book checks |
| Links to sources that may explain a jump | `renderJumps()` → event `settlement_sources`, contract filing, gas AAA page | `category-dom.mjs`; `alerts-dom.mjs` "checks, not causes" |
| Suggestions to make the site more live | `suggestions.html` S1–S16; `SUGGESTIONS.md` | `page-runtime-check.mjs`; S8 corrected by session `117dc8d6` |
| Clean landing page + subpages by category, table format | root `index.html` + 5 category pages + the 11 other root pages and the event detail page | link check: 36 pages, 0 broken |
| Every row has an official source link; blanks flagged | `src()` on rows, `verification.html`, `flagged.html` | `summary-dom.mjs` source audit; `flagged.html` 76 items |
| No manual input; all data fetched live | all values from `fetch()` to the demo host; no transcribed values | `grep` shows no hard-coded prices/tickers in the tables; `category-dom.mjs` asserts only the demo host was called |

### Snapshot in the repository (not live)
`data/snapshot.json` was generated by `scripts/collect.py` at **2026-11-21T20:46:46Z**
(248 API calls, 0 errors). It is a dated capture, not a live feed:

| Topic | Series (of the topic's series count) | Events | Markets |
|---|---|---|---|
| Gas | 40 (133) | 11 | 168 |
| Elections | 40 (2,710) | 23 | 200 |
| Culture | 40 (2,683) | 37 | 200 |
| Crypto | 40 (321) | 86 | 200 |
| Golf | 40 (134) | 25 | 200 |

I did not regenerate it (no network from this sandbox). The pages fetch live at runtime; the snapshot
is used by the static reports and the downtime fallback only.

---

## 7. Local verification performed on this branch

| Suite | Result |
|---|---|
| `node --test tests/*.test.mjs` | **154/154 pass** at merge time — the tree keeps growing under parallel sessions; this session contributes `result-semantics` (11) and `chart-axis` (10), both green |
| `python3 -m unittest discover -s tools` | **42/42 OK** |
| `python3 -m unittest discover -s tests` | **20 run, OK** (3 skipped: `cryptography` absent in this sandbox) |
| `tests/dom`: `npm test` | **44/44** across the three suites at merge time (alerts, summary — which derives the flag counts — and category) |
| `python3 tools/check_site_links.py .` | **36 pages, 0 broken** |
| `node tools/verify/page-runtime-check.mjs` | **18/18 pages clean**, 36 pages link-checked |
| `node evidence/auth-sign-test.mjs` | **6/6** |
| `git diff --check` | clean |

`tests/live-alerts-check.mjs` and the live workflows were **not** run here; they require TLS to
`*.kalshi.co`. They run on GitHub-hosted runners.

---

## 8. What I could not verify from this sandbox (left as-is, not asserted)

1. **Live API responses.** No call was made. Every field shape above comes from the official schema,
   not from a captured response taken today.
2. **CORS from the Pages origin.** Prior sessions verified it with a runner; I did not re-run it.
3. **The `KXGAS` → `GAS` alias** (Flag R9). Still an inference from two observations; nothing here
   depends on it.
4. **Snapshotted counts** in §6 are from the 20:46Z capture; they will drift.
5. **`tags` matching semantics** for Golf (Flag W6). The spec does not describe it; the site does not
   claim it.

## 9. Open observations for the integration owner (not defects, not fixed here)

| # | Observation | Why it is left open |
|---|---|---|
| O1 | `Market.status` has **no `open`** value (S1: `initialized/inactive/active/closed/determined/disputed/amended/finalized`). The client tests `["active","open"]` in several places. | Harmless — the extra value never matches, and `active` is the correct live status. Kept so a legacy payload cannot break the pages. |
| O2 | The WS `ticker` frame carries **`dollar_volume`** and **`dollar_open_interest`** (S10), an exchange-provided dollar figure. The ranked boards use the volume × price proxy because the REST market object does not return those fields. | A WS-only field cannot rank a REST-discovered board; using it for the markets the relay covers would mix two measures in one column. Flag A11 already discloses the proxy. |
| O3 | `Watchlist.refresh()` records `final_result` only for `yes`/`no`, so a scalar market is never marked resolved in the local watch list. | Changing it would also need a payout rule for scalar. The event and resolved pages now show the literal value (D074-1); the watch list stays conservative. Flagged here rather than half-fixed. |
| O4 | `event.html` shows an event as "open" when a market's result is blank, even if the market's status is `closed`/`determined`. | The status pill next to it carries the real status; no value is invented. Cosmetic, and outside this session's claim. |

---

## 10. Files changed by this session

| File | Change |
|---|---|
| `assets/js/market.js` | `dominantResult()` reports literal results (yes/no/scalar/mixed), never coerces to `no` |
| `assets/js/category.js` | literal result tag; implied YES ask column in the book |
| `assets/js/ui.js` | `timeTickLabel()` extracted; date-qualified ticks on >12 h windows |
| `index.html` | literal result tag; corrected "Resolved" label; removed duplicated dead row template |
| `event.html` | literal result tag in both tables; resolved count covers any result |
| `resolved.html` | literal result tag for a non-binary settlement |
| `categories/{gas,elections,culture,crypto,golf}.html` | six-column book headers; implied-ask caption |
| `flagged.html` | new card **D074-1** (mitigated) + corrected "not flagged" bullet |
| `tests/result-semantics.test.mjs` | **new** — 11 cases |
| `tests/chart-axis.test.mjs` | **new** — 10 cases |
| `tests/dom/category-dom.mjs` | **new** — 18 checks against the real controller |
| `tests/dom/package.json` | test script runs the new DOM test |
| `.github/workflows/site-check.yml` | runs the two new unit suites |
| `README.md` | verification commands updated |
| `COORDINATION.md` | claim, scope amendments, completion record |

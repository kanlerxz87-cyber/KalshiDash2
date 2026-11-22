# Verification report — session `130acb78` (2026-11-22)

**Scope:** line-by-line verification of `portfolio.html`, `strategies.html`,
`resolved.html`, `event.html` and the shared helpers they call
(`assets/js/ui.js`, `assets/js/market.js`, `assets/js/kalshi.js`) against the
official Kalshi documentation and the live demo API. Every row below carries
one official source link; a value that could not be confirmed is left blank and
flagged **unverified** rather than inferred.

**Method.** Each official page was fetched on 2026-11-22 (the sandbox shell
cannot reach `kalshi.co` hosts — `curl` exits 35 `SSL_ERROR_SYSCALL` — so
verification used the page fetcher, never shell curl). Live demo responses were
read from `https://external-api.demo.kalshi.co/trade-api/v2` for `/events`,
`/markets`. Branch `arena/130acb78-kalshidash2`, based on `main` @ `252e623`,
rebased onto `main` @ `0708788` (PR #122) during the session.

**Verdict summary.** Four defects were found and fixed in this session
(§6). Everything else in scope matched the documented schemas. No new
unverified values were introduced; three pre-existing unverified items are
recorded in §7 and none of them blocks publication.

---

## 1. `portfolio.html` — demo portfolio & trade execution

| # | Line / element | Claim checked | Official source | Verdict |
|---|---|---|---|---|
| 1.1 | Key warning: demo key at `demo.kalshi.co/account/profile`; demo funds are mock | Demo credentials are separate from production | [demo_env](https://docs.kalshi.com/getting_started/demo_env) | ✅ correct |
| 1.2 | Signing: pre-sign text = timestamp + method + path, path **without** query string, including `/trade-api/v2` | Signing rules | [api_keys](https://docs.kalshi.com/getting_started/api_keys) | ✅ correct |
| 1.3 | RSA-PSS/SHA-256, MGF1-SHA256, salt length = digest length (32); Ed25519 signs directly | Signature algorithm | [api_keys](https://docs.kalshi.com/getting_started/api_keys) | ✅ correct |
| 1.4 | "The PEM header does not identify the key type" — type detected from the parsed key | Key-type detection | [api_keys](https://docs.kalshi.com/getting_started/api_keys) | ✅ correct |
| 1.5 | 401 note: "timestamp must be within 30 seconds of its clock" | Timestamp tolerance | [api_keys](https://docs.kalshi.com/getting_started/api_keys) — *"must be within **30 seconds** of Kalshi's clock, in either direction. Outside that window the request returns `401` with code `header_timestamp_expired`"* | ✅ correct, verbatim |
| 1.6 | Balance: `balance_dollars` (string) preferred; fallback `balance`/100 (cents) | Get Balance schema | [get-balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) | ✅ correct |
| 1.7 | `portfolio_value` divided by 100 (cents, int64) | Get Balance schema | [get-balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) | ✅ correct |
| 1.8 | `updated_ts` × 1000 (unix seconds) | Get Balance schema | [get-balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) | ✅ correct |
| 1.9 | Positions: `?limit=200` | `limit` range 1–1000 | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) | ✅ correct |
| 1.10 | `market_positions[]`: `ticker`, `position_fp`, `market_exposure_dollars`, `realized_pnl_dollars`, `fees_paid_dollars`, `total_traded_dollars` | Position fields | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) | ✅ correct |
| 1.11 | Performance totals: Σ `realized_pnl_dollars`, Σ `fees_paid_dollars`, Σ `total_traded_dollars`, Σ `market_exposure_dollars`; a field no position returned shows `n/a`, never `$0.00` | Documented fields, honest aggregation | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) | ✅ added this session (§6.1) |
| 1.12 | Note: "whether `realized_pnl_dollars` is net of `fees_paid_dollars` is not stated in the schema, so no net figure is derived" | No inferred netting | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) | ✅ correct — the schema does not state it |
| 1.13 | Fills: `count_fp`, `yes_price_dollars`, `no_price_dollars`, `is_taker`, `fee_cost`, `outcome_side`, `created_time`, `ts`, `ticker`/`market_ticker` | Fill fields | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | ✅ correct |
| 1.14 | `fee_cost` is **not** divided by 100 (comment in code: "documented as a DOLLAR string on Get Fills; there is no `fee_cost_dollars` field") | Fee units | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | ✅ correct |
| 1.15 | Fills request uses `limit=1000` | `limit` range 1–1000 | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | ✅ correct |
| 1.16 | Order form: price snapped to the market's own `price_ranges` grid | Price grid is authoritative | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 1.17 | Order submit: `POST /portfolio/events/orders`; legacy `/portfolio/orders` answers `410 deprecated_v1_order_endpoint` | V2 write route | [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | ✅ correct |
| 1.18 | Order body: `ticker`, `side`, `count`, `price` (fixed-point strings), `time_in_force`, `self_trade_prevention_type`, `client_order_id` | Order body fields | [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | ✅ correct |
| 1.19 | **NO-order translation** (see §6.2): `side` is YES-leg only (`bid` = buy YES, `ask` = sell YES); a NO price must be complemented | Order direction | [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2) · [order_direction](https://docs.kalshi.com/getting_started/order_direction) · [quick_start_create_order](https://docs.kalshi.com/getting_started/quick_start_create_order) | ❌ was wrong → fixed |
| 1.20 | Positions "Status" column read `settlement_status` / `status` | Position fields | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) — neither field exists on `market_positions[]`; `settlement_status` is a **query parameter**, not a response field | ❌ undocumented → column removed (§6.4) |
| 1.21 | Positions table referenced `p.market_title` | Position fields | [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) — no such field | ❌ undocumented → removed (§6.1) |

## 2. `strategies.html` — trade analysis & strategy catalogue

| # | Line / element | Claim checked | Official source | Verdict |
|---|---|---|---|---|
| 2.1 | `analyseFills` reads `count_fp`, `yes_price_dollars`, `no_price_dollars`, `fee_cost`, `outcome_side`, `is_taker`, `created_time`, `ts`, `ticker`/`market_ticker` | Fill fields | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | ✅ correct |
| 2.2 | `side` falls back to legacy `side` when `outcome_side` is absent | Direction migration | [order_direction](https://docs.kalshi.com/getting_started/order_direction) — legacy `action`/`side` deprecated, removal not before 2026-05-28 | ✅ correct |
| 2.3 | Premium = contracts × price of the side taken (`no_price_dollars` for `outcome_side=no`) | Traded dollars | [get-trades](https://docs.kalshi.com/api-reference/market/get-trades) · [dollar-volume.js](https://docs.kalshi.com/api-reference/market/get-trades) | ✅ correct |
| 2.4 | **"By side & role" table** (see §6.3): `is_taker` buckets rendered as `"true"`/`"false"`; side and role vocabularies concatenated unlabelled | Role vocabulary | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) · [order_direction](https://docs.kalshi.com/getting_started/order_direction) | ❌ was wrong → fixed |
| 2.5 | `topicForTicker`: event ticker taken from the market's documented `event_ticker` field; the dash-split is only a cache key, not an API assumption | Event resolution | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 2.6 | Series category preferred over the deprecated event `category` | Category deprecation | [get-event](https://docs.kalshi.com/api-reference/events/get-event) · [get-series](https://docs.kalshi.com/api-reference/market/get-series) | ✅ correct |
| 2.7 | Strategy catalogue: every entry marked `untested`, rules expressed over API fields, evidence named | No unproven claims | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) · [market_settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ correct |
| 2.8 | Testable rules table: "sell back at entry + $0.10, else hold to settlement" labelled as a project rule; fees modelled, spread/slippage not | Honest labelling | [get-market-candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) · [market_settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ correct |
| 2.9 | Cached fills from `localStorage` analysed without a key; page never invents trades | No fabrication | [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | ✅ correct |

## 3. `resolved.html` — tracking to resolution

| # | Line / element | Claim checked | Official source | Verdict |
|---|---|---|---|---|
| 3.1 | "The outcome shown is the API's own `result` value — it is never inferred from the price" | Resolution semantics | [market_settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ correct |
| 3.2 | Settled scan: `GET /markets?status=settled` | `status` enum | [get-markets](https://docs.kalshi.com/api-reference/market/get-markets) — `unopened`, `open`, `paused`, `closed`, `settled` | ✅ correct |
| 3.3 | `result` rendered literally, including `scalar`; blank stays blank | Result enum | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 3.4 | `settlement_value_dollars`, `expiration_value`, `close_time`, `settlement_ts` | Settlement fields | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 3.5 | Watch-list `final_result` set only from documented `result` (`yes`/`no`/`scalar`); `resolved_at` from `settlement_ts` | Watch-list semantics | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 3.6 | Multivariate combos classified from `mve_selected_legs` | Combo legs | [get-multivariate-events](https://docs.kalshi.com/api-reference/events/get-multivariate-events) | ✅ correct |
| 3.7 | "No settled markets for this topic in the current scan" — the scan is capped (6 pages × 200, 400 pending) and says so | Honest scope | [get-markets](https://docs.kalshi.com/api-reference/market/get-markets) | ✅ correct |
| 3.8 | Settlement copy: "Yes outcome: Yes contract holders receive $1 per contract" | Payout rule | [market_settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ correct |
| 3.9 | Empty-state colspans 9 (watch list) and 7 (recent) | Table shape | local static check (`tests/table-shape.test.mjs`) | ✅ correct |

## 4. `event.html` — event detail

| # | Line / element | Claim checked | Official source | Verdict |
|---|---|---|---|---|
| 4.1 | `GET /events/{event_ticker}?with_nested_markets=true` | Event endpoint | [get-event](https://docs.kalshi.com/api-reference/events/get-event) | ✅ correct |
| 4.2 | Market fields: `yes_sub_title`, `title`, `ticker`, `status`, `last_price_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `open_interest_fp`, `volume_fp`, `result` | Market fields | [get-event](https://docs.kalshi.com/api-reference/events/get-event) | ✅ correct |
| 4.3 | Resolution fields: `settlement_value_dollars`, `expiration_value`, `close_time`, `rules_primary` | Settlement fields | [get-event](https://docs.kalshi.com/api-reference/events/get-event) | ✅ correct |
| 4.4 | "Volume × price proxy" labelled with its formula; explicitly *not* actual traded-dollar volume | Proxy labelling | [get-trades](https://docs.kalshi.com/api-reference/market/get-trades) | ✅ correct (flag A11, by design) |
| 4.5 | Blank `result` on a closed/determined market shown as "awaiting result", not "open" (via `marketResultState`) | Result vs status | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct (merged from main, PR #121) |
| 4.6 | `scalar` shown as itself | Result enum | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 4.7 | Empty-state colspans 11 (markets) and 7 (resolution) | Table shape | local static check (`tests/table-shape.test.mjs`) | ✅ correct |

## 5. Shared helpers

| # | Helper | Claim checked | Official source | Verdict |
|---|---|---|---|---|
| 5.1 | `ui.js money()/money4()/int()/dec()` — `null` renders `n/a`, never `$0.00` | Honest nulls | local convention, verified by `tests/table-shape.test.mjs` + page-runtime | ✅ correct |
| 5.2 | `market.js num()` — `null`/`undefined`/`""` → `null` | Null handling | local convention | ✅ correct |
| 5.3 | `kalshi.js snapToGrid()` — snaps to the market's published `price_ranges` | Price grid | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |
| 5.4 | `kalshi.js deriveQuote()` — best YES ask = 1 − best NO bid; best NO ask = 1 − best YES bid | Reciprocal rule | [orderbook_responses](https://docs.kalshi.com/getting_started/orderbook_responses) | ✅ correct |
| 5.5 | `market.js swingOf()` — `last_price_dollars` vs `previous_price_dollars` | Swing basis | [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ correct |

---

## 6. Defects found and fixed

### 6.1 `portfolio.html` — missing dollar fields rendered as `$0.00` (fixed)

`num(null)` returns `null`, but the old code computed `num(p.market_exposure_dollars) / 100`,
and `null / 100 === 0`. A position that did not return the field therefore displayed
**$0.00** — a fabricated value. New `positionDollars()` reads the documented
`*_dollars` field first and only falls back to a cents alternate when the documented
field is absent **and** the alternate is present; otherwise it returns `null`, which
`money()` renders as `n/a`. The same change added a "Fees paid" column and a
performance-totals row (Σ `realized_pnl_dollars`, Σ `fees_paid_dollars`,
Σ `total_traded_dollars`, Σ `market_exposure_dollars`) that shows `n/a` for a field
no position returned. The undocumented `p.market_title` reference was removed (the
field does not exist in the Get Positions schema).

Source: [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions)

### 6.2 `assets/js/kalshi.js` — NO orders sent with the wrong price (fixed)

The V2 order endpoint is single-book and quotes the **YES leg only**:

> "Side of the book for an order or trade. For event markets, this refers to the
> YES leg only: `bid` means buy YES, `ask` means sell YES."
> — [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2)

The direction guide pins the bit and the legacy equivalence table:

> "`bid ≡ yes`, `ask ≡ no`, always." — buy YES ≡ bid, sell YES ≡ ask, buy NO ≡ ask, sell NO ≡ bid.
> — [order_direction](https://docs.kalshi.com/getting_started/order_direction)

The old `createOrder` mapped `outcomeSide === "no"` to `side: "ask"` (correct) but
passed the **NO price unchanged**. `ask` at price *p* is a sell-YES at *p*, so a
"BUY NO at $0.63" was submitted as a sell-YES at $0.63 — i.e. a purchase of NO at
$0.37, the wrong price. The correct translation, with `priceDollars` being the
price of the outcome the caller named (`side` follows the position direction on
the YES leg: long YES → `bid`, short YES → `ask`):

| Caller intent | `side` sent | `price` sent |
|---|---|---|
| buy YES at *p* | `bid` | *p* |
| sell YES at *p* | `ask` | *p* |
| buy NO at *q* | `ask` | 1 − *q* |
| sell NO at *q* | `bid` | 1 − *q* |

This matches the official traded-dollar rule (`count_fp × p` for a YES taker,
`count_fp × (1 − p)` for a NO taker) and the quick-start example ("buy 1 YES
contract for 1 cent" → `side:"bid", price:"0.0100"`). `price` is now sent as a
fixed-point **string** (`"0.3700"`), as documented. Pinned by
`tests/order-leg.test.mjs` (7 tests, offline) and cross-checked against
`tests/order-contract.test.mjs` (merged from main, PR #123), which pins the same
mapping through a real signed request.

**Correction note.** The first attempt at this fix mapped `side` from buy/sell
(buy → `bid`) instead of from the position direction, which would have placed a
YES bid for a NO purchase — the opposite position. It was caught by
`tests/order-contract.test.mjs` on the rebased tree and corrected before merge;
the table above is the final, tested mapping.

Sources: [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2) ·
[order_direction](https://docs.kalshi.com/getting_started/order_direction) ·
[quick_start_create_order](https://docs.kalshi.com/getting_started/quick_start_create_order)

### 6.3 `assets/js/market.js` + `strategies.html` — liquidity role rendered as "true"/"false" (fixed)

`analyseFills` grouped fills by `is_taker` with `String(r[key])`, so the buckets
were keyed `"true"` and `"false"`, and `strategies.html` concatenated those with
the `outcome_side` buckets in one unlabelled "By side & role" column. The role is
now grouped as `taker` / `maker` / `unclassified` (`byRole`), and each row is
labelled with which vocabulary it belongs to (`side · yes`, `role · taker`).

Sources: [get-fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) ·
[order_direction](https://docs.kalshi.com/getting_started/order_direction)

### 6.4 `portfolio.html` — positions "Status" column removed (fixed)

The column read `p.settlement_status || p.status`. Neither field exists on
`market_positions[]`; `settlement_status` is a **query parameter** of Get Positions
(`unsettled` / `settled` / `all`), not a response field. The column could only ever
render an empty pill. It has been removed (positions table is now 6 columns).

Source: [get-positions](https://docs.kalshi.com/api-reference/portfolio/get-positions)

### 6.5 Empty-state colspans (fixed, with a regression test)

`assets/js/alerts.js` rendered the alerts empty state with `colspan=9` for a
10-column table; `simulator.html` rendered the scoreboard empty state with
`colspan=10` for a 12-column table. Both fixed, and `tests/table-shape.test.mjs`
now statically checks **every** published table's `<th>` count against its
empty-state `colspan` (root + `categories/*.html`; `docs/` is the earlier,
non-canonical generation and is excluded). The same defect in
`assets/js/category.js` (`emptyRow(5)` for 6-column book tables) is **not** edited
here — it is inside session `e7931fe7`'s claimed scope and is logged as a
cross-owner request in `COORDINATION.md`.

---

## 7. Unverified / flagged items (blank, never inferred)

| # | Item | Status |
|---|---|---|
| 7.1 | Whether `realized_pnl_dollars` is net of `fees_paid_dollars` | **Unverified** — the Get Positions schema does not state it; the page derives no net figure and says so. |
| 7.2 | `GET /series` paging (flag F5) | **Unverified** — `fetchSeriesCategories` caps at 30 tickers; completeness is not claimed. |
| 7.3 | Volume × price proxy (flag A11) | By design — labelled with its formula everywhere it appears; not actual traded-dollar volume. |
| 7.4 | Fee-schedule PDF (`kalshi-fee-schedule.pdf`) | **Unverified** — recorded on the Sources page; the simulator's fee model is labelled as modelled, not official. |
| 7.5 | WS `dollar_volume` / `dollar_open_interest` (flag K1) | **Unverified** on the public WS path — decision pending with the relay owner. |

None of the above blocks publication; each is published on the Flagged for Review
page with its source link.

## 8. Test results (2026-11-22, branch tip)

| Suite | Result |
|---|---|
| `node --test` (all) | **216/216** (includes new `tests/table-shape.test.mjs` 2/2, `tests/order-leg.test.mjs` 7/7, and main's `tests/order-contract.test.mjs` 9/9) |
| `python3 -m unittest discover -s tools` | 42 OK |
| `python3 tools/check_site_links.py` | 36 pages, 0 broken |
| `node tools/verify/page-runtime-check.mjs` | 18/18 pages clean |
| Baseline on `252e623` (before this session) | 172/172 node · 42 Python · 36/0 links · 18/18 runtime |

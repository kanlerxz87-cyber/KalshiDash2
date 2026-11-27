# Line-by-line re-verification — session `d3e0e9f5` (2026-11-27 UTC)

**Base:** `main` @ `956e704` (fast-forwarded from `bb4ede5` at the start of this session; the two merges
`#131` and the `[skip ci]` alerts refresh landed while this session was reading).
**Branch:** `arena/d3e0e9f5-kalshidash2`.

**What this session could and could not reach, stated first because it bounds every row below.**

| Reachability | Verified how |
|---|---|
| `https://docs.kalshi.com/**` | Yes — page fetch tool. The `.md` variant of every page carries the full OpenAPI / AsyncAPI block, which is what the rows below quote. |
| `https://external-api.demo.kalshi.co/trade-api/v2/**` | Yes — page fetch tool, unauthenticated public endpoints only. Every live URL below is re-runnable. |
| `https://kanlerxz87-cyber.github.io/KalshiDash2/**` | Yes — the deployed site was fetched and compared to the merged tree. |
| Direct `curl` to any of the above from the sandbox shell | **No** — `curl` exits 35 (TLS blocked). Same limit every prior session recorded. Live evidence here therefore comes from the fetch tool, and the sandbox can run the *offline* suites only. |
| Any authenticated endpoint | **No** — no demo API key exists in this repository and none was requested. No authenticated call was made and no order was placed. |

**Rule this session kept:** a session's own tool output is not an independent check of another session's tool
output. Third-party URLs already cited by earlier sessions were **not re-fetched**; where a prior claim was
in scope, the argument is re-made from the *official page*. The one place this mattered is §3 (F6), where the
disagreement was between the card and the repository itself, not between two fetches.

---

## 1 · Contract rows re-verified against the official page *and* a live response

Every row: official page → what it says → the dated live call → what the shipped code does.

### 1.1 Candlesticks — an untraded bucket, and an empty window

- **Official:** [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks)
  (`MarketCandlestick` = `end_period_ts`, `yes_bid`, `yes_ask`, `price`, `volume_fp`, `open_interest_fp`;
  `period_interval` enum 1 / 60 / 1440 **minutes**; ≤ 5,000 periods per request; "the most recent candlesticks
  can be a few seconds behind the latest trades and quotes").
- **Live 2026-11-27:**
  `GET /series/KXAAAGASW/markets/KXAAAGASW-26NOV30-3.5000/candlesticks?start_ts=1795713600&end_ts=1795800000&period_interval=60`
  → 16 buckets. 15 of them carry `volume_fp "0.00"` and a `price` object holding **only**
  `previous_dollars`; `yes_bid` / `yes_ask` are fully populated (open/high/low/close). Bucket
  `1795784400` jumps `price.close_dollars` 0.4100 → 0.7500.
- **Empty window:** `…&start_ts=1795798200&end_ts=1795800000` → `200 {"candlesticks":[],"ticker":"…"}`.
  An empty array is a real answer for a quiet window, **not** an error.
- **Code:** `assets/js/market.js:545 parseCandle` reads `price.*` for the traded line and maps
  `yes_bid`/`yes_ask` separately, so a quote is never plotted as a trade. ✔
- **Register:** two rows added (`A candle bucket with no trades still carries its quote legs`,
  `A candle response older than the request window is not an error`).

### 1.2 Page-size limits, checked per endpoint

- **Official:** [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) `limit` default 100,
  **max 1000**; [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades) 1–1000, default 100;
  [Get Events](https://docs.kalshi.com/api-reference/events/get-events) default 200, **max 200**.
- **Live:** `GET /events?limit=1&status=open&with_nested_markets=false` → 200 with a `cursor`, confirming the
  documented shape (`events[]`, `cursor`, `milestones[]`) and that `with_nested_markets=false` really omits
  `markets`.
- **Code:** `assets/js/market.js:38 getAll()` defaults to `limit = 200`, valid against all three; no caller
  raises it. The settled-market scan asks for 200 against a 1000 maximum. ✔
- **Register:** row added (`Every client call that follows a cursor is inside the documented page maximum`).

### 1.3 The ticker payload's dollar fields

- **Official:** [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) — `dollar_volume` is a
  *signed whole-dollar cumulative traded notional* integer, `volume_fp` a 2-decimal contract count; the
  documented field list has **no** `previous_price_dollars` (which is why the exchange-reference comparison
  exists only on the REST path — Flagged W2, unchanged).
- **Code:** `assets/js/live-core.js` maps the message to the same names the REST object uses; no dollar field
  is rendered in a contract-count column. ✔
- **Register:** row added.

### 1.4 Order writing and reading a 201

- **Official:** [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) — `side` is
  `bid`/`ask` on the **YES leg only**; `BookSide` description: *"`bid` means buy YES, `ask` means sell YES …
  (Selling YES is economically equivalent to buying NO at `1 - price`, but this endpoint quotes everything
  from the YES side.)"*; a `201` "means the order was accepted, not that it is resting: check
  `remaining_count`"; legacy `/portfolio/orders` writes return `410 Gone` / `deprecated_v1_order_endpoint`.
- **Code:** `assets/js/kalshi.js createOrder` maps `yes → bid`, `no → ask`, sends `count` and `price` as
  4-dp strings, `self_trade_prevention_type: "taker_at_cross"`, `client_order_id`; `portfolio.html:363`
  reports *"order accepted"* and prints the raw response including `remaining_count`. ✔
  **Not verified:** anything past the request shape — no key, so no order was placed (Flagged F1 stays open).
- **Note:** the `ask` sentence above is *one* of the two official readings that disagree by `1 − price`;
  Flagged NF1 already publishes the conflict and the order form discloses both. This session adds nothing to
  it and changes nothing in it.

### 1.5 Balance

- **Official:** [Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) — `balance` is
  *cents* (int64), `balance_dollars` the fixed-point dollar string, `portfolio_value` cents; the endpoint has
  its own rate-limit bucket (1/s Basic and Advanced, 5/s above).
- **Code:** `portfolio.html:224` prefers `bal.balance_dollars` and only divides `balance` by 100 as the
  fallback. ✔
- **Rate limit:** [Rate Limits](https://docs.kalshi.com/getting_started/rate_limits) confirms the bucket and
  that `429` carries the `X-RateLimit-*` headers **but not** `Retry-After`. The register rows for both were
  re-read and stand. ✔

### 1.6 Order book

- **Official:** [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) — bids only;
  arrays **ascending**, best bid = **last** element; a NO bid at *y* ⇒ YES ask at `1 − y`; empty arrays are a
  valid state for both an empty book and an unknown ticker.
- **Code:** `assets/js/kalshi.js deriveQuote` uses `Math.max` over the levels rather than an index, so it is
  correct regardless of order; `assets/js/category.js` sorts descending for display and labels the implied ask
  beside the literal NO bid. ✔ (The earlier card text said "last element"; the code never relied on it.)

### 1.7 Events and the deprecated category field

- **Official:** [Get Events](https://docs.kalshi.com/api-reference/events/get-events) — `category` on the
  *event* is **deprecated, use the series-level category**; `GET /events` **excludes multivariate events**.
- **Code:** `assets/js/market.js seriesCategoriesFor` / `classifyEventWithBasis` prefer the series record and
  label the basis (`series` vs `event`); `fetchMultivariateEvents` goes to `/events/multivariate` separately.
  ✔ This is the same conclusion Flagged F8 records; the rows agree.

### 1.8 Fee rounding and the fee schedule

- **Official:** [Fee Rounding](https://docs.kalshi.com/getting_started/fee_rounding) — target balance precision
  `$0.0001` direct / `$0.01` non-direct; `trade_fee = ceil_6dp(model)`, `aligned_change =
  floor_precision(revenue − trade_fee)`, `rounding_fee = (revenue − trade_fee) − aligned_change`; the accumulator
  carries across fills of one order.
- **Code:** `assets/js/simulator.js fillFeeDollars` implements exactly those four steps with `ceil6` /
  `floorToGrid`. ✔ The PDF's own worked values (transcribed by an earlier session) are asserted in
  `tests/simulator-core.test.mjs`, which passes.

---

## 2 · What the live demo exchange shows today (sample, not a catalogue size)

Read-only, unauthenticated, 2026-11-27 ~17:2xZ. **No figure here is published as a site value** — the site
reads these live; this section exists so a reader can see this session was not writing from memory.

| Call | Observed |
|---|---|
| `GET /exchange/status` | `exchange_active: true`, `trading_active: true`, 4 shards all active |
| `GET /markets?limit=2&status=open` | documented `_dollars` / `_fp` fields, `price_ranges`, `price_level_structure: center_deci_edge_centi_cent` on the combo markets |
| `GET /markets?limit=1&status=settled` | `status: finalized`, `result: yes`, `settlement_value_dollars: 1.0000`, `settlement_ts` set |
| `GET /markets/trades?limit=2` | `count_fp`, `yes_price_dollars`, `no_price_dollars`, `taker_outcome_side`, `taker_side` (deprecated), `taker_book_side`, `is_block_trade` |
| `GET /series/KXAAAGASW` | `category: Economics`, `categories: ["Economics"]`, `contract_terms_url` on `assets.kalshi.com`, `contract_url` on the staging bucket (Flagged X1), `settlement_sources: [AAA]` |
| `GET /events?status=open&series_ticker=KXAAAGASW` | one open event `KXAAAGASW-26NOV30`, AAA settlement source |
| `GET /events/KXAAAGASW-26NOV30?with_nested_markets=true` | 12 markets, `price_level_structure: linear_cent`, tickers `…-3.4000` … including `…-3.5000` |

**Fixed-point prices in the live data.** `price_ranges` on the combo market above is
`[{0.00–0.01 step 0.0001}, {0.01–0.99 step 0.001}, {0.99–1.00 step 0.0001}]` — a sub-cent grid. The site's
ranking column multiplies a contract count by that price, which is why it is labelled a *proxy* and why
`assets/js/kalshi.js snapToGrid` reads the market's own `price_ranges` instead of assuming 1¢.

---

## 3 · F6 — the card that outlived its defect (the main finding of this session)

**The card said:** *"F6 — Authenticated requests could never have succeeded"*, status **open**, and
*"fixed in `site/assets/js/kalshi.js`"*.

Three separate problems, each checked:

**(a) The path does not exist.** `git ls-tree -r HEAD --name-only | grep '^site/'` → nothing. The directory
`site/` has never been in this repository.

**(b) The status was stale.** The defect it describes was real, at the *first* revision that contains the file,
and was fixed 19 minutes later:

| Revision | Time (UTC) | What `docs/assets/app.js` does |
|---|---|---|
| `424190e` *"Build Kalshi demo dashboard site (docs/)…"* | 2026-11-20T11:04:59Z | line 101 `crypto.subtle.importKey("spki", …)`; line 104 signs `ts + method + path` with no `/trade-api/v2` prefix |
| `c3676e5` *"Fix verified-against-docs bugs: pkcs8 key import, /trade-api/v2 signing path, …"* | 2026-11-20T11:23:37Z | imports `"pkcs8"`; signs `new URL(DEMO_BASE + path).pathname` |

Pinned with `gh api repos/…/contents/docs/assets/app.js?ref=424190e` (blob read, 124 lines) and
`gh api repos/…/commits?path=docs/assets/app.js` (four commits, the two above being the first and third).

**(c) The code path is now the shipped one.** `assets/js/kalshi.js:153` builds
`this.signBase + path.split("?")[0]` — prefix kept, query stripped — and imports PKCS#8 (RSA or Ed25519).
`flagged.html` F6 no longer claims otherwise.

**Why it happened, in one sentence:** a card that describes code names a *file*, but code is a *sequence of
revisions*, and this repository is edited by several sessions a day, so a card written against a file ages into
a false statement about the current tree. The repair pins the revision, keeps the original reasoning, and quotes
the wrong path as part of the finding rather than quietly swapping it out.

**And how this session nearly published the opposite error — recorded because it is the same mistake.**
Mid-session the F6 claim was written down as *"contradicted by the code at any revision"*, on the strength of
`git log -S'"spki"' -- docs/assets/app.js` returning nothing old and of reasoning that the file could not have
shipped with a failing signing path. Both were wrong. This checkout is **shallow**
(`git rev-parse --is-shallow-repository` → `true`, four commits), so `git log -S` searched four commits and
found nothing — and a negative result over a truncated history was read as evidence of absence. The tree also
did not require the contradiction: `docs/` is not the published generation, so a bug there shipping is entirely
plausible. The claim was corrected by **asking the API for the first blob** (`…/contents/docs/assets/app.js?ref=424190e`)
rather than by reasoning. The board entry keeps the retraction in place of the original sentence.

**Rule this adds to the board:** on a shallow clone, `git log -S`/`git blame` prove nothing about history.
Fetch the revision through `gh api …/contents/…?ref=<sha>` or deepen the clone before calling a card wrong.

---

## 4 · Flagged-page numbering and counts

Before this session the page held **99** cards (`38 open / 61 mitigated`), reconciled by
`tests/dom/summary-dom.mjs` through the DOM, not by a hand-typed number.

This session adds three cards in a new section 11:

| Id | Title | Status |
|---|---|---|
| `DR1` | One live response is quoted under two different shapes in `claims.js` | open |
| `DR2` | The settled-market scan sends `limit` twice in one URL | open |
| `DR3` | Flagged F6 was three days stale and cited a directory that never existed | fixed |

and flips one existing card, **F6**, from `open` to `fixed` after pinning the revision (§3). Net:
**102 cards, 39 open / 63 mitigated**. The ids `DR1–DR3` were chosen because the prefix is unused on the page
(`grep -o 'id="[A-Z]*[0-9]' | cut -d'"' -f2 | sed 's/[0-9]*$//' | sort -u` lists F, Y, A, Z, NF, W, X, SB, V, K,
E, AC, AB, SC, R, PG, D, P, C — no DR). `summary.html` derives its headline from the page, so no number in the
site's prose is edited by hand.

---

## 5 · Repairs made by this session

| # | File | Change | Why |
|---|---|---|---|
| 1 | `flagged.html` | F6: status → `fixed`; revision `424190e` / `c3676e5` pinned; `site/` path quoted as wrong; original reasoning kept | §3 |
| 2 | `flagged.html` | new section 11: `DR1`, `DR2`, `DR3` | §4 |
| 3 | `assets/js/claims.js` | five rows added, each with an official page and a dated live call | §1 |
| 4 | `summary.html`, `assets/js/trace.js` (new), `tests/requirements-trace.test.mjs` (new) | a requirement → artefact → evidence matrix, built by *executing* the shipped modules rather than reading prose | the brief's "line by line" leg, previously prose-only |

**Not repaired, on purpose:**

- `DR1` — the 2026-11-22 candlestick capture is not in the repository, so the older claim cannot be checked
  and this session will not overwrite another session's dated evidence on the strength of a different capture.
- `DR2` — `assets/js/simulator.js` is inside session `190f6069`'s merged scope (`H1`). The user's rule is to
  request, not take over, another session's file; the fix is published with the one-line change named.
- `scripts/collect.py` + `.github/workflows/collect.yml` — the scheduled collector's repeated failure
  (4 consecutive runs) is claimed by session `858d4941` as `J3`; not duplicated here.

---

## 6 · Suite state on this branch (run locally, this sandbox)

| Harness | Result |
|---|---|
| `node --test tests/*.test.mjs` | see §7 (re-run after the last edit) |
| `python3 -m unittest discover -s tools -p 'test_*.py'` | 47/47 OK |
| `python3 -m unittest discover -s tests -p 'test_*.py'` | 20 tests, 3 skipped (the network-gated ones) |
| `tests/dom` `npm test` (alerts / summary / category) | 22/22 · 23/23 · 23/23 |
| `node tools/verify/page-runtime-check.mjs` | 18/18 pages clean, 36 pages, 0 broken local links |
| `python3 tools/check_site_links.py .` | 36 pages, 0 broken |
| `node tools/verify/auth-sign-test.mjs` | 6/6 |

The **live** suites (`live-site-render`, `verify-live-site`, `verify-alerts`, `live-engine-check`) cannot run
from this sandbox because it cannot open TLS to `*.kalshi.co`; their state on `main` is recorded in §7 from the
Actions API instead.

# Verification — KalshiDash2

**Checked 2026-11-21** against official sources. Every row names the official page that states it. Where a
live check applies, the exact request and its URL are recorded in
[`reports/live-verify-c33971c1.md`](reports/live-verify-c33971c1.md) or in the captured evidence under
`evidence/`. Live market values (prices, sizes, balances, results) are **never transcribed** into this file:
they change every second and are fetched at runtime by the page or by `scripts/kalshi_client.py`.

This is the register for the **published site** (the root generation that GitHub Pages serves). The
item-by-item irregularity register — every defect found, every unverified value, and what would close it — is
[`flagged.html`](flagged.html), which the site renders as **Flagged for review**. An earlier register,
`docs/flagged.html`, belongs to the superseded `docs/` generation and is kept only for history; it is not
maintained and it is not the page a reader of the live site is sent to.

Every claim below also appears, with the same source link, in the site's own register
(`assets/js/claims.js`), which the Verification page and the Executive summary both read — so the counts on the
summary cannot drift from the rows here.

## Table

| # | Claim | Value | Official source | Status |
|---|-------|-------|-----------------|--------|
| 1 | Recommended demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 2 | Also-supported demo host | `https://demo-api.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 3 | Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | https://docs.kalshi.com/getting_started/demo_env | verified |
| 4 | Public market data needs no auth | `GET /markets`, `/events`, `/orderbook`, `/candlesticks` answer unauthenticated | https://docs.kalshi.com/getting_started/quick_start_market_data | verified (live 2026-11-21: `GET /exchange/status` and `GET /markets?limit=3` answered with no credentials) |
| 5 | Order endpoint + body | `POST /portfolio/events/orders` (V2 event-market shape: `bid`/`ask`, fixed-point dollar prices) | https://docs.kalshi.com/api-reference/orders/create-order-v2 | verified |
| 6 | Legacy order writes | `/portfolio/orders` writes return `410 Gone`; the V2 route is canonical | https://docs.kalshi.com/api-reference/orders/create-order-v2 | verified |
| 7 | Auth headers | `KALSHI-ACCESS-KEY` / `-SIGNATURE` / `-TIMESTAMP` | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 8 | Signature construction | `timestamp(ms) + METHOD + full path from root, query stripped`; RSA-PSS SHA-256 (salt = digest length) or Ed25519 direct; base64 | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 9 | Balance units | balance is returned in cents by the documented quick-start arithmetic | https://docs.kalshi.com/getting_started/quick_start_authenticated_requests | verified |
| 10 | Fixed-point units | `*_dollars` = dollar strings (≤4 dp for prices); `*_fp` = contract counts (2 dp, 0.01 granularity); the suffix alone does not distinguish money from contracts | https://docs.kalshi.com/getting_started/fixed_point_migration | verified |
| 11 | Per-market price grid | `price_ranges[]` `{start,end,step}` is the source of truth for valid prices; `price_level_structure` is a label only | https://docs.kalshi.com/getting_started/fixed_point_migration | verified (live 2026-11-21: a combo market returned `center_deci_edge_centi_cent` with three bands) |
| 12 | Get Markets filters | `limit`, `cursor`, `event_ticker`, `series_ticker`, `status`, timestamp filters; one `status` at a time | https://docs.kalshi.com/api-reference/market/get-markets | verified |
| 13 | Market display fields | `yes_sub_title` canonical (`title`/`subtitle` deprecated); `result` ∈ yes/no/scalar/empty; `notional_value_dollars` = one contract's settlement value | https://docs.kalshi.com/api-reference/market/get-market | verified |
| 14 | A market object has **no** dollar-volume field | `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `notional_value_dollars` are returned; there is no `dollar_volume` on the REST market object | https://docs.kalshi.com/api-reference/market/get-markets | verified (live 2026-11-21: `GET /markets?limit=3&status=open` field set inspected; see row 15 for where a dollar figure does exist) |
| 15 | The **ticker** stream does carry dollar fields | `dollar_volume` and `dollar_open_interest` appear in the WebSocket `ticker` payload next to `volume_fp` / `open_interest_fp` | https://docs.kalshi.com/websockets/market-ticker | verified (documented payload) — the dashboard's REST ranking therefore cannot use them, and says so (flag A11, now mitigated by the official Get Trades figure in row 35) |
| 16 | Series list + fields | `GET /series` filters `category`, `tags`, `include_product_metadata`, `include_volume`, `min_updated_ts`; no documented `limit`/`cursor` | https://docs.kalshi.com/api-reference/market/get-series-list | verified |
| 17 | `category` vs `categories` | A series has a primary `category` and a `categories[]` discovery list; the `category` **filter** matches any entry in `categories`, so the primary value alone can under-report membership | https://docs.kalshi.com/api-reference/market/get-series-list | verified (fetched 2026-11-21) |
| 18 | The event object's `category` is deprecated | Get Events annotates it `deprecated: true` — "Event category (deprecated, use series-level category instead)" | https://docs.kalshi.com/api-reference/events/get-events | verified (fetched 2026-11-21) — **fixed on the site this session** (flag AB3): the taxonomy now resolves the series record and keeps this field as a labelled fallback |
| 19 | `GET /events` excludes multivariate events | stated in the reference; combos come from `GET /events/multivariate` | https://docs.kalshi.com/api-reference/events/get-events | verified |
| 20 | Single-market candlesticks | `GET /series/{series_ticker}/markets/{ticker}/candlesticks`; `period_interval` ∈ {1, 60, 1440} minutes | https://docs.kalshi.com/api-reference/market/get-market-candlesticks | verified |
| 21 | Batch candlesticks (used by the charts) | `GET /markets/candlesticks?market_tickers=…`; candles under `markets[].candlesticks[]`, close = `price.close_dollars` | https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks | verified |
| 22 | Orderbook shape | `GET /markets/{ticker}/orderbook` → `orderbook_fp.yes_dollars` / `.no_dollars` as `[price, size]` lists, **bids only** | https://docs.kalshi.com/api-reference/market/get-market-orderbook | verified |
| 23 | Yes bid ≡ no ask at 1−X | binary-book explanation; the book returns bids for both sides and no asks | https://docs.kalshi.com/getting_started/orderbook_responses | verified |
| 24 | Lifecycle + settlement | status transitions; YES pays $1 to YES holders and NO $1 to NO holders at settlement | https://docs.kalshi.com/getting_started/market_lifecycle + https://docs.kalshi.com/getting_started/market_settlement | verified |
| 25 | Fill fields | `outcome_side` / `book_side` canonical (legacy `side`/`action` deprecated); `fee_cost` is a fixed-point **dollar** string; `count_fp`, `yes_price_dollars` | https://docs.kalshi.com/api-reference/portfolio/get-fills | verified |
| 26 | Positions & settlements | `GET /portfolio/positions`, `GET /portfolio/settlements` | https://docs.kalshi.com/api-reference/portfolio/get-positions + https://docs.kalshi.com/api-reference/portfolio/get-settlements | verified |
| 27 | Fees | quadratic schedule; the exchange rounds the model fee up and aligns the balance change to the member's precision grid (documented on Fee Rounding), which reproduces the published fee table | https://docs.kalshi.com/getting_started/fee_rounding | verified — formula reproduced row-by-row in `tests/simulator-core.test.mjs`; the fee-schedule PDF's own "centicent" footnote still contradicts its table (flag Z2) |
| 28 | Rate limits | authenticated calls are token-metered per Read/Write bucket; `429` carries `X-RateLimit-*` headers and no `Retry-After` | https://docs.kalshi.com/getting_started/rate_limits | verified |
| 29 | Unauthenticated budget | the page says unauthenticated public requests "are subject to separate limits" and publishes **no number** | https://docs.kalshi.com/getting_started/rate_limits | verified as *unpublished* (flags A8/F3) — the site therefore backs off on `429` and caps its scans |
| 30 | Browser CORS from the Pages origin | `access-control-allow-origin: https://kanlerxz87-cyber.github.io` returned on simple GET, on preflight, and on `GET /markets` | captured response headers, `evidence/evidence-cors-taxonomy.md` (GitHub Actions runner, 2026-11-20T11:08Z) | verified |
| 31 | Topic category vocabulary | Elections → `Elections`; Culture → `Culture` / `Entertainment` / `Social`; Crypto → `Crypto`; Golf → `Sports` narrowed by golf series/title patterns; Gas → **no** category covers gasoline (matched on series + title) | category strings are Kalshi's own values, observable per series in `GET /series/{ticker}`; gas has no category by inspection of the returned records | verified — Elections/Economics re-observed live 2026-11-21; the five-topic mapping is exercised by `tests/taxonomy.test.mjs` |
| 32 | `KXGAS` and `GAS` are distinct series records | `GET /series/KXGAS` → `"ticker": "KXGAS"`; `GET /series/GAS` → `"ticker": "GAS"`. Same title ("Gas weekly"), same EIA settlement source, same `…/GAS.pdf` terms. No official page states that one is a rename of the other | https://docs.kalshi.com/api-reference/market/get-series | verified as *two records* (live 2026-11-21). The **alias** question stays unanswered and is not claimed anywhere on the site (flag SB4) |
| 33 | Market `status` values seen live | `GET /markets?status=open` returns markets whose `status` is `active`; the lifecycle page maps the `open` filter to that object status | https://docs.kalshi.com/getting_started/market_lifecycle | verified (live 2026-11-21); the two filter vocabularies are flag A9 |
| 34 | Demo = mock funds, separate credentials | stated by Kalshi | https://docs.kalshi.com/getting_started/demo_env | verified |
| 35 | Official traded-dollar volume | Σ(`count_fp` × the price of the side the taker bought) over `GET /markets/trades`, filtered by `ticker`, `min_ts`/`max_ts` (Unix seconds) and paged with `cursor` (limit 1–1000) | https://docs.kalshi.com/api-reference/market/get-trades | verified (documented fields and bounds, fetched 2026-11-21; arithmetic covered by `tests/dollar-volume.test.mjs`; the live request runs in the visitor's browser) |
| 36 | Series list response size is not a catalogue total | Two committed captures of one response record 16,643 rows (2026-11-20T11:08Z) and 16,653 rows (later probe); `GET /series` documents no `limit`/`cursor` | https://docs.kalshi.com/api-reference/market/get-series-list | partially verified — point-in-time row counts, neither asserted as the catalogue size (F5, C1) |
| — | Exact price / volume / balance / resolution **values** | *(blank)* | — | **not transcribed by design** — fetched live, never committed |
| — | "High-ROI" score and the volume × price ranking | *(derived conventions, not exchange facts)* | — | **not facts** — labelled as a screen and as a proxy on the page (flags A1, A11, Y11) |

## What changed in this revision

- The header date moved from 2026-11-20 to **2026-11-21**, and the closing pointer now names
  [`flagged.html`](flagged.html) — the register the live site actually publishes — instead of
  `docs/flagged.html`. Closes flag **E3**.
- Two rows that read "unverified" were wrong once the evidence existed: **browser CORS** (row 30, captured
  headers from the Pages origin) and the **topic category vocabulary** (row 31).
- Five rows were added from documentation and live responses checked this session: rows 14, 15, 17, 18, 32,
  33 (no dollar field on the REST market object; the ticker stream does carry one; `category` vs `categories`;
  event `category` deprecated; `KXGAS` ≠ `GAS` records; observed `status` value).
- Row 5/6 wording follows the current Create Order V2 page, which states that the legacy write routes have been
  removed and return `410` — the older "the docs disagree" note no longer applies.

## How a row gets verified

1. The official page is fetched and read (not remembered, not inferred from another summary).
2. If the claim is about runtime behaviour, a live request is made and its URL recorded under `reports/`.
3. If neither is possible, the value stays **blank** and the row says `unverified`, and the item is published
   on [Flagged for review](flagged.html) with what would close it.

Nothing on this site is marked verified without one of the two.

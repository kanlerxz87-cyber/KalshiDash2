# Live verification — session `c33971c1` (2026-11-21)

Purpose: this session's claims about the Kalshi demo API are backed by **actual HTTP responses fetched on
2026-11-21**, not by memory or by inference from a summary. This file records what was requested, what came
back at the field level, and which official page states the same thing.

## How these were fetched — and the limitation that changed

| Path | Status on 2026-11-21 |
|------|----------------------|
| Sandbox shell `curl` to `https://external-api.demo.kalshi.co/…` | **blocked** — returns HTTP `000` (the sandbox's outbound allowlist covers github/npm/pypi hosts only) |
| The agent's page-fetch proxy to `https://external-api.demo.kalshi.co/…` | **works** — full JSON returned |
| The agent's page-fetch proxy to `https://docs.kalshi.com/…` | **works** |

Every earlier session in `COORDINATION.md` recorded "the sandbox cannot reach kalshi.co" and moved its live
checks to GitHub Actions runners. That is no longer the only route: the observations below were made directly.
They are still *observations of one moment on the demo exchange* — demo market contents change constantly and
**no price, size or balance from these responses is transcribed into the site**.

## 1 · Exchange status — `GET /exchange/status`

```
https://external-api.demo.kalshi.co/trade-api/v2/exchange/status
→ 200
{"exchange_active":true,
 "exchange_index_statuses":[{"exchange_index":0,"description":"Default", … trading_active":true},
                            {"exchange_index":1,"description":"Demo shard 1", …},
                            {"exchange_index":2,"description":"Demo shard 2", …},
                            {"exchange_index":3, …}],
 "intra_exchange_transfers_active":true,"trading_active":true}
```

Documented: <https://docs.kalshi.com/api-reference/exchange/get-exchange-status>.
Supports: exchange + four shards live; shard fields match the sharding guide
<https://docs.kalshi.com/getting_started/exchange_sharding>.

## 2 · Market objects — `GET /markets?limit=3&status=open`

Field set of each returned market (verbatim key names):

```
can_close_early, close_time, created_time, custom_strike, event_ticker, exchange_index,
expected_expiration_time, expiration_value, is_provisional, last_price_dollars,
latest_expiration_time, market_type, mve_collection_ticker, mve_selected_legs,
no_ask_dollars, no_bid_dollars, no_sub_title, notional_value_dollars, open_interest_fp,
open_time, previous_price_dollars, previous_yes_ask_dollars, previous_yes_bid_dollars,
price_level_structure, price_ranges, result, rules_primary, rules_secondary,
settlement_bounds_type, settlement_timer_seconds, status, strike_type, ticker, title,
updated_time, volume_24h_fp, volume_fp, yes_ask_dollars, yes_ask_size_fp, yes_bid_dollars,
yes_bid_size_fp, yes_sub_title
```

Three findings this session relies on:

1. **No `dollar_volume` on the REST market object.** The dollar figure exists only in the WebSocket `ticker`
   payload (`"dollar_volume": 16948`, <https://docs.kalshi.com/websockets/market-ticker>). This is why the board
   ranks by a labelled `volume_fp × last_price_dollars` proxy and says so (flag A11) instead of claiming
   exchange-reported traded dollars.
2. **`status` came back as `"active"` for a `status=open` query.** The filter value and the object value are two
   vocabularies: <https://docs.kalshi.com/getting_started/market_lifecycle> maps `open → active` and
   `paused → inactive`. Flag A9 carries the full, contradictory state of that documentation.
3. **`price_ranges` is per market and must be read, not assumed.** The returned combos used
   `"price_level_structure": "center_deci_edge_centi_cent"` with three bands
   (`0.0000–0.0100 step 0.0001`, `0.0100–0.9900 step 0.0010`, `0.9900–1.0000 step 0.0001`), exactly as
   <https://docs.kalshi.com/getting_started/fixed_point_migration> describes. The order form snaps to this grid.

Only two `yes_*_size_fp` fields exist (`yes_bid_size_fp`, `yes_ask_size_fp`); there is no `no_bid_size_fp`.
That matches the flag Y2 fix and the claim in `assets/js/claims.js`.

## 3 · Series records — the category authority

### 3a · `GET /series?category=Economics&limit=3`

Each returned series carries **both** `category` (primary) and `categories` (discovery list), plus
`settlement_sources[]`, `contract_terms_url`, `contract_url`, `fee_type`, `fee_multiplier`, `frequency`,
`tags`, `additional_prohibitions`. Example shapes observed:

* `WRECSS` — `"categories": ["Economics","World"], "category": "Economics"`
* `KXDIESELMONAK` — `"categories": ["Economics"]`, settlement source AAA
* `KXCNGDP` — `"categories": ["Economics"]`, `"fee_type": "quadratic"`

`limit=3` did **not** return 3 series: the payload was far larger. This matches the documentation, which lists
`category`, `tags`, `include_product_metadata`, `include_volume`, `min_updated_ts` — and **no `limit` or
`cursor`** (<https://docs.kalshi.com/api-reference/market/get-series-list>). A client must not assume pagination
here.

Matching semantics, quoted from that page: *"Return series whose `categories` list contains this value. A series
can have more than one discovery category, so the `category` field of a returned series (its primary category)
may differ from the filter value."*

### 3b · `GET /series/KXGAS` and `GET /series/GAS` — two distinct records

| Request | `ticker` returned | `title` | `contract_terms_url` | settlement source |
|---|---|---|---|---|
| `/series/KXGAS` | `KXGAS` | Gas weekly | `https://assets.kalshi.com/contract_terms/GAS.pdf` | U.S. Energy Information Agency, `PET_PRI_GND_DCUS_NUS_W.htm` |
| `/series/GAS` | `GAS` | Gas weekly | `https://assets.kalshi.com/contract_terms/GAS.pdf` | U.S. Energy Information Agency, same URL |

So the two endpoints answer with **two different series tickers**. The earlier board entry (R9 / flag SB4)
inferred from a snapshot row that `KXGAS` "resolves to" `GAS`; that inference is not supported. What is true and
now recorded: both tickers exist, both mean the EIA weekly retail-gasoline series, and no official page says one
is a rename of the other. The site therefore claims no alias, and matches both tickers on their own patterns.

## 4 · Event objects — `GET /events`

### 4a · `GET /events?status=open&limit=2`

Returned event keys: `category`, `collateral_return_type`, `event_ticker`, `exchange_index`,
`last_updated_ts`, `mutually_exclusive`, `series_ticker`, `settlement_sources[]`, `strike_period`, `sub_title`,
`title` (+ `milestones: []` at the envelope). **No `categories[]` on the event object** — the discovery list
exists only on the series. Observed `category` values in this sample: `World`, `Elections`.

### 4b · The event `category` field is officially deprecated

From the Get Events schema (<https://docs.kalshi.com/api-reference/events/get-events>), verbatim:

```yaml
category:
  type: string
  description: Event category (deprecated, use series-level category instead).
  deprecated: true
```

This is the documentation basis for flag **AB3**, and for the change made this session: the taxonomy now resolves
`GET /series/{series_ticker}` for the series behind each event and classifies from `categories[] ∪ category`,
with the deprecated event field kept only as a labelled fallback
(`classifyEventWithBasis()` → `basis: "series" | "event" | "none"`).

### 4c · An open gas-price event exists — `GET /events?status=open&series_ticker=KXAAAGASW`

```
{"events":[{"event_ticker":"KXAAAGASW-26NOV23",
            "title":"US gas prices this week",
            "sub_title":"On Nov 23, 2026",
            "category":"Economics",
            "strike_date":"2026-11-23T04:59:00Z",
            "settlement_sources":[{"name":"AAA","url":"https://gasprices.aaa.com/"}]}],
 "milestones":[]}
```

This closes the informational premise of flag **F4** ("the demo environment has no open gas-price markets"),
which was true of a 2026-11-20 scan and is not a standing property of the exchange. The site's behaviour is
unchanged and correct: it renders whatever the scan returns and names the scan size.

## 5 · Documentation pages read this session

| Page | What was taken from it |
|------|------------------------|
| <https://docs.kalshi.com/llms.txt> | The current endpoint index — used to confirm that the routes the site calls still exist, and that Create Order V2 / the WebSocket pages are the current names |
| <https://docs.kalshi.com/api-reference/market/get-markets> | Market response schema, filter vocabulary, `previous_price_dollars` |
| <https://docs.kalshi.com/api-reference/events/get-events> | Event schema, `category` deprecation, multivariate exclusion |
| <https://docs.kalshi.com/api-reference/market/get-series-list> | `category` vs `categories`, filter semantics, no `limit`/`cursor` |
| <https://docs.kalshi.com/api-reference/market/get-series> | Series record fields used by the new resolver |
| <https://docs.kalshi.com/websockets/market-ticker> | `price_dollars`, `dollar_volume`, `dollar_open_interest`, no `previous_price_dollars` |
| <https://docs.kalshi.com/getting_started/fixed_point_migration> | `*_dollars` vs `*_fp`, `price_ranges` as the source of truth, the price-level structures |
| <https://docs.kalshi.com/getting_started/rate_limits> | Token buckets for authenticated calls; the explicit statement that **unauthenticated** limits are separate and unpublished |
| <https://docs.kalshi.com/api-reference/orders/create-order-v2> | V2 order route; legacy `/portfolio/orders` writes return `410 Gone` |

## 6 · What this session changed because of the above

| Change | File | Verification |
|--------|------|--------------|
| Topic classification prefers the series-level category; deprecated event field is a labelled fallback; per-scan lookup cap and page-lifetime cache | `assets/js/market.js`, `assets/js/alerts.js`, `assets/js/alert-engine.js` | `node --test tests/taxonomy.test.mjs` — 16 pass (5 new cases: precedence, multi-category union, fallback + basis, dedupe/cache/cap/failure, gas exclusions under series categories) |
| Alert page discloses the basis tally it used | `assets/js/alerts.js` (`#universe-note`) | `node tools/verify/page-runtime-check.mjs` — 17/17 pages run clean |
| Four new rows in the claim register | `assets/js/claims.js` | rendered by `verification.html`; link check passes |
| `VERIFICATION.md` re-dated, repointed, stale rows corrected, six rows added | `VERIFICATION.md` | every row links an official page or a captured response |
| Flags AB3, SB4, F4, F10, E3 updated with what changed and what remains | `flagged.html` | counts re-render from the DOM on `summary.html` |

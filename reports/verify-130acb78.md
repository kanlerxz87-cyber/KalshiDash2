# Portfolio and table verification — session `130acb78`

Checked 2026-11-22. Branch: `arena/130acb78-kalshidash2`. PR: [#125](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/125).

## Scope and limits

Reviewed the published `portfolio.html`, `strategies.html`, `resolved.html`, and
`event.html` controllers and the helpers they call against the official sources
below. This is a source/schema review plus offline tests, **not** proof that a
private account call or an order executed successfully. No credentials were
requested and no orders were placed by this session.

Public demo `/events` and `/markets` responses were fetched read-only. No private
balance, performance, fill, or settlement value is transcribed into the site.
Missing values remain visibly unavailable rather than being replaced by zero.

**Correction to earlier revisions of this report:** the claimed NO-order price
fix was not adequately verified. It has been withdrawn before merge. The original
client behavior is retained, with the existing NF1 documentation-conflict warning.
The removed `tests/order-leg.test.mjs` merely encoded an assumption; passing that
test was not evidence of exchange behavior. See §3.

## 1. Official contracts checked

Each row links the official source for the stated contract. A match against a
schema is not labelled as a successful live authenticated test.

| Surface | Documented fields or rule checked | Result / limitation | Official source |
|---|---|---|---|
| Demo environment | Public demo REST environment is distinct from production | Read-only public responses checked; no private account verification | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) |
| Authentication | Timestamp + uppercase method + full path without query; RSA-PSS/SHA-256 or Ed25519; timestamp in milliseconds, within 30 seconds | Signing implementation is covered by offline generated-key tests | [API keys](https://docs.kalshi.com/getting_started/api_keys) |
| Balance | `balance_dollars`; legacy `balance` and `portfolio_value` in cents; `updated_ts` in Unix seconds | Documented units match the renderer; missing inputs must not become zero | [Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) |
| Market positions | `ticker`, `position_fp`, `market_exposure_dollars`, `realized_pnl_dollars`, `fees_paid_dollars`, `total_traded_dollars` | Documented fields; `market_title`, `status`, and `settlement_status` are not response fields | [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) |
| Position coverage | `limit`, `cursor`, `settlement_status` query; unsettled is the default, including closed markets awaiting settlement | A bounded response is not lifetime account performance or necessarily open/tradeable markets | [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) |
| Fills | `count_fp`, `yes_price_dollars`, `no_price_dollars`, `fee_cost`, `is_taker`, `outcome_side`, `created_time`, `ts` | Schema checked; no authenticated fills fetched | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |
| Liquidity role | Boolean `is_taker` | Display as taker / maker; missing or invalid roles stay unclassified | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |
| Order direction | `bid ≡ yes`, `ask ≡ no`; direction guide says direction does not change price | Side vocabulary checked; **NO price interpretation remains unverified** | [Order direction](https://docs.kalshi.com/getting_started/order_direction) |
| V2 orders | `POST /portfolio/events/orders`; fixed-point `count` and `price`; reference describes YES-leg pricing | Required fields and signing tested offline; no NO-price conversion claimed | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) |
| Order acceptance | `201` is acceptance, not proof of a fill | `remaining_count` is surfaced; execution was not tested live | [Create Order quick start](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| Event rows | `event_ticker`, `series_ticker`, nested markets; quoted prices, volume, result, rules, settlement fields | Source links are rendered per data row | [Get Event](https://docs.kalshi.com/api-reference/events/get-event) |
| Category basis | Event category is deprecated in favor of series category | Main's series-category lookup retained | [Get Series](https://docs.kalshi.com/api-reference/market/get-series) |
| Settled-market scan | `status=settled`; pagination is bounded | Current-scan results, not an exhaustive history | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Resolution | Literal `result` (yes / no / scalar); status alone is not a result | Main's scalar tracking and “awaiting result” behavior retained | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) |
| Settlement | Binary winner receives $1 per contract; scalar cases are distinct | No outcome inferred from price | [Market settlement](https://docs.kalshi.com/getting_started/market_settlement) |
| Order book | Bids only; NO bid at y implies YES ask at 1 − y | This order-book rule is not independent verification of the ambiguous order-entry price field | [Orderbook responses](https://docs.kalshi.com/getting_started/orderbook_responses) |

## 2. Proven defects addressed

### Missing position fields displayed as zero

At baseline `252e623`, the renderer used:

```js
p.market_exposure_dollars ?? (num(p.market_exposure) / 100)
p.realized_pnl_dollars ?? (num(p.realized_pnl) / 100)
```

When both fields are absent, `num(undefined)` is `null`, and `null / 100` is `0`.
That is not an API-reported zero. Missing dollar values must render `n/a`.
Undocumented `market_title` and status fields are removed from the position row.
A Fees paid column and scoped, explicitly documented performance aggregates are
added. Only the current documented dollar fields are read; undocumented cents
alternates are not used. Any missing input withholds that aggregate rather than
showing a partial sum. Explicit API zeroes remain zeroes.

### Query, coverage, failure states and fractions

The old caller supplied `"?limit=200"` to a client method that already inserts
`?`, producing `??limit=200`. `loadPositions()` now passes a bare, encoded query,
requests `settlement_status=unsettled`, follows cursors for at most five pages of
200, and explicitly reports whether paging finished. Missing required response
fields, a repeated cursor, or a failed request is not treated as an empty account.
A capped scan displays only its returned rows and withholds every aggregate.

The UI calls these “unsettled-row” figures, not lifetime account performance or
open/tradeable-market counts. It preserves fractional `position_fp` and fill
`count_fp` quantities, clears stale totals on a failed reload, and prevents a
pending account response from repopulating the display after the key is forgotten.
Offline tests execute the actual published controller and the real client query
builder; none is labelled live account verification.

Source: [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions).

### Role buckets were boolean strings

`analyseFills()` previously grouped `is_taker` by `String(value)`, and the page
printed “true” and “false”. It now supplies `byRole` with taker / maker /
unclassified keys. The table labels side and role buckets separately; these are
two overlapping breakdowns, not quantities to add together.

Source: [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills).

### Empty-state table widths

`assets/js/alerts.js` used 9 columns for a 10-column alert table.
`simulator.html` used 10 columns for a 12-column scoreboard. These are corrected.
`tests/table-shape.test.mjs` checks static placeholders and explicit inline table
assignments (including ternary renderers) in root and category HTML, not the old
`docs/` generation. It also checks the alerts controller's local `body` aliases.
Mutation fixtures prove that restoring the alert's nine-column bug or a ternary
width mismatch makes the guard fail. This is deliberately scoped syntax coverage,
not a general JavaScript parser or proof of all external-controller layouts. The
category-book error-path mismatch remains logged for its owner, not silently
claimed fixed. These are local markup defects, not claims about Kalshi data.

## 3. Unverified order pricing — attempted change withdrawn

The endpoint reference describes `bid` / `ask` on the YES leg, while the direction
guide says order direction does not change the price. Main already publishes this
as [Flagged NF1](../flagged.html#NF1). This session initially treated the endpoint
sentence alone as proof that a NO price must be complemented. That was insufficient
verification and the attempted conversion, new sell interface, and assumption-based
tests have been removed. No part of that interpretation is reported as a fixed or
verified exchange behavior.

The existing `side: "ask"` NO request and unchanged request price are preserved.
The existing visible warning remains, and the confirmation additionally identifies
NO-order pricing as unverified. No demo order was submitted to settle the question.

Sources: [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2)
and [Order direction](https://docs.kalshi.com/getting_started/order_direction).

## 4. Remaining limitations

- Whether `realized_pnl_dollars` includes fees is **unverified** in the cited
  schema. No extra fee subtraction, net-P&L, or ROI figure is invented.
- Private account results and live order execution remain **unverified** for this
  session. Offline fixtures are labelled tests, never published as account data.
- Unsettled-position totals are not lifetime account returns; archived positions,
  deposits, withdrawals and return history are outside the response's coverage.
- Historical notes on F5, A11, the fee PDF and K1 belong to their existing review
  cards. This report does not claim to have re-verified or closed them.

## 5. Integration checks

Local pre-integration checks (2026-11-22):

- `node --test`: **238/238** (including 13 portfolio-core, 12 real-controller
  fixture checks, and 6 table-shape guards).
- Python tools: **42 passed**; Python client/relay suite: **20 run, 3 skipped**.
- Published-page runtime harness: **18/18**; local links: **36 HTML pages,
  0 broken links**.
- DOM fixtures: **22 alerts, 5 summary, 23 category checks passed**.
- Signing self-test (`tools/verify/auth-sign-test.mjs`): **6/6**.
- `git diff --check`: clean.

CI runs the new portfolio and table suites. The final combined-tree result, PR
merge SHA and Pages deployment will be appended after integration; the above
numbers are explicitly dated local results, not a claim about a later commit.

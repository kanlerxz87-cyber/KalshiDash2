# Independent verification pass — session `46f45a35` (2026-11-27 UTC)

Branch `arena/46f45a35-kalshidash2` @ `db91232` (== `origin/main` at claim time).
Open PR #141 (`d3e0e9f5`) owns `flagged.html` — not touched here; the one
cross-scope item found is logged in `COORDINATION.md` instead.

Method: every official page below was re-fetched and read directly on
2026-11-27, then compared line-by-line against the site's claim register
(`assets/js/claims.js`, 114 claims) and source register
(`assets/js/sources.js`, 49 sources). Deployed pages were read as rendered
(per session `54220d3d`'s advice that prose defects are only visible that
way). No live market numbers were transcribed; no authenticated call was
made; no order was placed.

## 1. Official docs re-fetched — all confirmed, no contradictions

| # | Claim (register) | Official page fetched 2026-11-27 | Result |
|---|------------------|----------------------------------|--------|
| 1 | Demo REST `external-api.demo.kalshi.co/trade-api/v2` recommended; `demo-api.kalshi.co` also supported | [demo_env](https://docs.kalshi.com/getting_started/demo_env) | ✅ verbatim table match |
| 2 | Demo WS `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`; `wss://demo-api.kalshi.co/trade-api/ws/v2` still supported | [demo_env](https://docs.kalshi.com/getting_started/demo_env) | ✅ verbatim table match |
| 3 | Demo = mock funds; credentials not shared with production | [demo_env](https://docs.kalshi.com/getting_started/demo_env) | ✅ "mock funds… credentials are not shared" |
| 4 | Headers `KALSHI-ACCESS-KEY` / `-TIMESTAMP` / `-SIGNATURE` | [quick_start_authenticated_requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) | ✅ |
| 5 | Pre-sign text = `timestamp + METHOD + full path`, query stripped; RSA-PSS SHA-256 (salt = digest length) or Ed25519 direct; base64 | same | ✅ incl. Python reference implementation |
| 6 | Balance returned in cents (`balance / 100`) | same | ✅ |
| 7 | `POST /portfolio/events/orders` (V2); legacy `/portfolio/orders` → `410 deprecated_v1_order_endpoint` | [create-order-v2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | ✅ meta description verbatim |
| 8 | `side` quotes the YES leg: "bid means buy YES, ask means sell YES… buying NO at `1 - price`… quotes everything from the YES side" (F20 / NF1 quote) | same (OpenAPI `side` description) | ✅ verbatim — F20/NF1 quotes are exact |
| 9 | `bid ≡ yes`, `ask ≡ no`; "An order at price p with outcome_side=no is matched by an order at the same price p with outcome_side=yes" | [order_direction](https://docs.kalshi.com/getting_started/order_direction) | ✅ verbatim — NF1's other quote is exact |
| 10 | Orderbook returns bids only; `orderbook_fp.yes_dollars` / `.no_dollars` as `[price, size]`, ascending, best = last; YES bid X ≡ NO ask 1−X; best YES ask = 1 − best NO bid | [orderbook_responses](https://docs.kalshi.com/getting_started/orderbook_responses) | ✅ incl. worked spread example |
| 11 | Unknown ticker → `200` with empty book, not `404` | same | ✅ "returns 200 with empty arrays rather than 404" |
| 12 | `*_dollars` ≤ 4 dp; `*_fp` ≤ 2 dp, 0.01 granularity; `price_ranges` is the source of truth, `price_level_structure` a label only | [fixed_point_migration](https://docs.kalshi.com/getting_started/fixed_point_migration) | ✅ |
| 13 | Authenticated calls token-metered per Read/Write bucket; `429` carries `X-RateLimit-*`, no `Retry-After` | [rate_limits](https://docs.kalshi.com/getting_started/rate_limits) | ✅ |
| 14 | Unauthenticated budget unpublished ("subject to separate limits", no number) — F3 | same | ✅ confirmed as unpublished |
| 15 | `GET /events` excludes multivariate events (use `/events/multivariate`) | [get-events](https://docs.kalshi.com/api-reference/events/get-events) | ✅ meta description verbatim |
| 16 | `GET /markets`: one `status` filter at a time (`unopened`/`open`/`closed`/`settled`) | [get-markets](https://docs.kalshi.com/api-reference/market/get-markets) | ✅ |
| 17 | REST market object has **no** dollar-volume field (`volume_fp`, `volume_24h_fp`, `open_interest_fp`, `notional_value_dollars` only) | same + [get-market](https://docs.kalshi.com/api-reference/market/get-market) | ✅ field list confirmed |
| 18 | `previous_price_dollars` = "Price for the last traded YES contract on this market **a day ago**" | [get-market](https://docs.kalshi.com/api-reference/market/get-market) (OpenAPI field description) | ✅ verbatim — alerts page's "24-hour move" labelling is correct |
| 19 | `result` ∈ `yes` / `no` / `scalar` / `""`; `yes_sub_title` canonical, `title`/`subtitle` deprecated | same | ✅ |
| 20 | Settlement: YES holders $1, NO holders $1 | [market_settlement](https://docs.kalshi.com/getting_started/market_settlement) | ✅ |

Not re-fetched this pass (previously verified, cited as-is): fee-schedule
PDF + fee rounding (PR #135), ticker WS payload/`dollar_volume` (claim 15),
candlestick intervals (claims 20–21), historical tier (claim 37), CORS
headers (claim 30, live-probed by CI `verify-live-site`).

## 2. Deployed pages read as rendered (2026-11-27)

- **Homepage** — connects to `external-api.demo.kalshi.co`, "Trading on the
  demo exchange is **active**"; proxy labelling correct; no prose defects.
- **`alerts.html`** — both swing comparisons named; the `previous_price_dollars`
  variant explicitly labelled a 24-hour move; High-ROI watch labelled a rule
  set, not a model; settlement sources explicitly "not causes". No defects.
- **`portfolio.html`** — NO-order panel correctly reconciled with F20
  (YES-leg request quoting); signing note "salt = 32" matches
  `PSS.DIGEST_LENGTH` for SHA-256. No defects.
- **`verification.html`** — renders **102 verified / 9 partially verified /
  3 unverified / 114 total**, matching `claims.js` exactly (counted
  programmatically: `total 114 { verified: 102, 'partially verified': 9, unverified: 3 }`).
  `sources.js`: 49 entries, 0 unverified. No defects.

## 3. Local suites (this sandbox, 2026-11-27)

- `node --test tests/*.test.mjs` — **266/266 passed** (repo docs said 263 —
  stale; fixed in this PR, task K2).
- `cd tests/dom && npm test` — alerts **26/26**, summary **5/5** (flag counts
  40 open / 66 mitigated / 106 total), category **24/24** → **55/55**.
- `python3 -m unittest discover -s tools` — **55/55**.
- `python3 -m unittest discover -s tests` — **28 ran, 24 passed, 4 skipped**
  (skips are `cryptography`-not-installed locally; CI installs it — the
  exec-summary snapshot's "20 ran / 3 skipped" was stale).
- `tools/check_site_links.py` — **36 pages, 0 broken**.
- `evidence/auth-sign-test.mjs` — **6/6**.
- `tools/verify/page-runtime-check.mjs` — **18/18 pages clean**.

## 4. Irregularities & observations

1. **NF1 title/body wording (cross-scope, not edited):** `flagged.html#NF1`'s
   title ("The official pages disagree…") and body ("do not agree") still
   carry the pre-F20 narrative under a *mitigated* tag whose callout says
   the pages answer different questions. `flagged.html` is owned by open
   PR #141, so this session logged the request in `COORDINATION.md`
   instead of editing (already noted by `54220d3d`).
2. **Stale test counts (fixed here):** `EXECUTIVE_SUMMARY.md` and
   `README.md` said 263/263 Node tests and 20 Python tests; current is
   266/266 and 28 ran (24 pass, 4 skip without `cryptography`).
3. **Observation, not a defect:** [order_direction](https://docs.kalshi.com/getting_started/order_direction)
   now documents WebSocket `orderbook_delta`/`orderbook_snapshot` no-leg
   pricing with an opt-in `use_yes_price` flag (default flip planned).
   The site makes no claim about WS orderbook pricing, so nothing is
   stale — but it is a candidate future suggestion (S-register) if the
   relay ever subscribes to orderbook channels.
4. **Not verified, not claimed:** no live authenticated order (F1);
   no live price/volume/balance/resolution transcribed; no claim
   upgraded without an official source.

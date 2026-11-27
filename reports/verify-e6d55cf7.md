# Orderbook liquidity-at-price, CLI/CSV hardening & live demo verification — session `e6d55cf7`

Checked **2026-11-27 UTC**. Branch: `arena/e6d55cf7-kalshidash2`. PR: [#163](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/163) (merged at `700c0d4`).

## Scope and boundaries

Reviewed line-by-line and updated the orderbook liquidity module and category pages
(`assets/js/kalshi.js`, `assets/js/category.js`, `categories/{gas,elections,culture,crypto,golf}.html`),
the Python demo CLI, WebSocket relay, and offline fill analyzer
(`scripts/kalshi_client.py`, `scripts/relay.py`, `scripts/analyze_trades.py`,
`data/trades_template.csv`, `docs/assets/trades_template.csv`), and the browser
fills CSV export on `portfolio.html` and `strategies.html` (`assets/js/portfolio-core.js`).

Public read-only Kalshi demo REST responses (`GET /exchange/status`, `GET /markets`,
`GET /markets/{ticker}/orderbook`) and official `docs.kalshi.com` documentation
were fetched directly on `2026-11-27`. **No private demo API key was supplied,
no authenticated account read (`GET /portfolio/*`) was executed against an account,
and no order (`POST /portfolio/events/orders`) was placed.** Every unverified item
is left blank (`n/a` or empty CSV cell) and explicitly flagged rather than inferred.

---

## 1. Official documentation & live demo endpoints verified (2026-11-27)

Every row in the table below was fetched and verified on `2026-11-27` against its
official Kalshi documentation page or live demo endpoint:

| Surface | Verified rule / live response (`2026-11-27`) | Verification status | Official source |
|---|---|---|---|
| Demo REST & WS hosts | Demo REST roots are `https://external-api.demo.kalshi.co/trade-api/v2` and `https://demo-api.kalshi.co/trade-api/v2`; demo WS Trade API roots are `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` and `wss://demo-api.kalshi.co/trade-api/ws/v2` | Verified from docs | [Test In The Demo Environment](https://docs.kalshi.com/getting_started/demo_env) · [API Environments and Endpoints](https://docs.kalshi.com/getting_started/api_environments) |
| Live demo exchange status | `GET /exchange/status` returned `{"exchange_active": true, "trading_active": true, ...}` with 4 active shards (`0..3`) | Verified live (public read-only) | [Live demo `/exchange/status`](https://external-api.demo.kalshi.co/trade-api/v2/exchange/status) · [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) |
| Fixed-point quantities & prices | Prices (`*_dollars`) carry up to 4 decimal places; contract quantities (`*_fp`, `FixedPointCount`) accept 0–2 decimals on input and always emit 2 decimals (`0.01` contract granularity) | Verified from docs + live `/markets` | [Fixed-Point Representation](https://docs.kalshi.com/getting_started/fixed_point_migration) · [Live demo `/markets?status=open&series_ticker=KXBTCD&limit=3`](https://external-api.demo.kalshi.co/trade-api/v2/markets?status=open&series_ticker=KXBTCD&limit=3) |
| Orderbook reciprocal rule | `orderbook_fp` returns bids only (`yes_dollars`, `no_dollars`), sorted ascending with best bid last; a NO bid at $y$ implies a YES ask at $\$1.00 - y$ and a YES bid at $x$ implies a NO ask at $\$1.00 - x$ | Verified from docs + live orderbook | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) · [Live demo orderbook (`KXBTCD-26NOV2817-T71249.99`)](https://external-api.demo.kalshi.co/trade-api/v2/markets/KXBTCD-26NOV2817-T71249.99/orderbook?depth=20) |
| Orderbook HTTP `200` empty-array caveat | Both an empty book and an unknown or archived ticker return HTTP `200` with `{"orderbook_fp":{"no_dollars":[],"yes_dollars":[]}}` | Verified live on `KXDOESNOTEXIST-999` | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) · [Live probe (`/markets/KXDOESNOTEXIST-999/orderbook?depth=20`)](https://external-api.demo.kalshi.co/trade-api/v2/markets/KXDOESNOTEXIST-999/orderbook?depth=20) |
| `Create Order (V2)` request body | `POST /portfolio/events/orders` requires `ticker`, `side` (`bid` \| `ask`), `count` (`FixedPointCount` string, e.g. `"10.00"`), `price` (`FixedPointDollars` string, e.g. `"0.5600"`), `time_in_force`, `self_trade_prevention_type` | Schema verified from docs; **live authenticated order execution unverified (no demo key)** | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) · [Quick Start: Create an Order](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| `Get Fills` V2 fields | `Fill` schema includes `created_time`, `ticker`, `market_ticker`, `outcome_side`, `book_side`, `count_fp`, `yes_price_dollars`, `no_price_dollars`, `is_taker`, `fee_cost`, plus `cursor` pagination | Schema verified from docs; **live authenticated fills unverified (no demo key)** | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) · [Pagination](https://docs.kalshi.com/getting_started/pagination) |
| Request signing | `KALSHI-ACCESS-TIMESTAMP` (13-digit ms) + uppercase HTTP method + full path from API root (`/trade-api/v2/...`) without query string, signed with RSA-PSS SHA-256 (`salt_length = digest_length`) or Ed25519 | Verified against docs + offline generated-key tests | [API Keys](https://docs.kalshi.com/getting_started/api_keys) |

---

## 2. Line-by-line defects found & fixed

| ID | File(s) | Defect found during line-by-line audit | Fix shipped & test coverage | Official source |
|---|---|---|---|---|
| `L1-a` | `assets/js/kalshi.js`, `assets/js/category.js`, `categories/*.html` | Category pages rendered static bid/ask ladders, requiring manual mental subtraction (`1 − y` / `1 − x`) and cumulative depth addition to answer *"how many contracts are available at price $P$?"* | Added pure `liquidityAtPrice(quote, { side, limitPrice })` in `assets/js/kalshi.js` (using integer hundredths of a contract to avoid IEEE-754 drift) and interactive `#book-check-side` (`Buy YES` / `Buy NO`) + `#book-check-price` + `#book-check-result` across all 5 topic pages, plus resting YES-ask depth KPI and live orderbook source link (`tests/order-contract.test.mjs`, `tests/dom/category-dom.mjs`) | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) |
| `L1-b` | `assets/js/category.js` | Orderbook level counts used `int(l.count)`, rounding fractional `count_fp` strings (e.g. `"0.25"` → `"0"`, `"13.50"` → `"14"`) despite Kalshi V2 documenting 2-decimal `FixedPointCount` | Added `qty(v)` preserving integer counts cleanly (`15` → `"15"`) while rendering fractional contract sizes to 2 decimals (`0.25` → `"0.25"`); disclosed the HTTP `200` empty-array vs unknown/archived-ticker caveat in `#book-src` (`tests/order-contract.test.mjs`, `tests/dom/category-dom.mjs`) | [Fixed-Point Representation](https://docs.kalshi.com/getting_started/fixed_point_migration) · [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) |
| `L2-a` | `scripts/kalshi_client.py`, `scripts/relay.py` | `ensure_demo()` used a 3-string `PRODUCTION_MARKERS` substring blocklist instead of an allowlist, and `relay.py::discover_universe()` did not validate `KALSHI_DEMO_BASE` at all; `kalshi_client.py` also called `sys.exit` at import time when `requests` was absent | Replaced substring blocklists with strict `urlparse` allowlists (`https` + `external-api.demo.kalshi.co` / `demo-api.kalshi.co` + `/trade-api/v2`; `wss` + `external-api-ws.demo.kalshi.co` / `demo-api.kalshi.co` + `/trade-api/ws/v2`), validated `KALSHI_DEMO_BASE` in `relay.py::discover_universe()`, and deferred `requests` check to call time (`tests/test_kalshi_client.py`) | [API Environments and Endpoints](https://docs.kalshi.com/getting_started/api_environments) · [Test In The Demo Environment](https://docs.kalshi.com/getting_started/demo_env) |
| `L2-b` | `scripts/kalshi_client.py` | `place-order` restricted `--count` to `type=int` (emitting `"1"` instead of 2-decimal `FixedPointCount` `"1.00"` and rejecting fractional contracts) and accepted out-of-range `--price` values (`<= 0` or `>= 1`, e.g. `--price 50` cents typo); `markets`, `positions`, and `fills` silently ignored non-empty `cursor` | Added `build_v2_order()` validating `count >= 0.01` (max 2 decimals, formatted `"%.2f"`) and `0 < price < 1` (`"%.4f"`), UTC timestamps, and `_warn_if_truncated()` to `stderr` whenever `cursor` is non-empty (`tests/test_kalshi_client.py`) | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) · [Pagination](https://docs.kalshi.com/getting_started/pagination) |
| `L2-c` | `scripts/kalshi_client.py`, `scripts/analyze_trades.py`, `data/trades_template.csv`, `docs/assets/trades_template.csv` | `kalshi_client.py fills --export-csv` omitted `no_price_dollars` and `is_taker`, causing `analyze_trades.py::fill_price_for_band()` to fall back to `yes_price_dollars` on NO fills — misclassifying a `$0.08` NO longshot (`yes_price_dollars = "0.9200"`) as `"Near-certain (>= $0.90)"` | Added `no_price_dollars` and `is_taker` + CSV formula-injection escaping to `export_fills_csv()` and both CSV templates, and updated `fill_price_for_band()` so NO fills lacking `no_price_dollars` return `None` (`"unclassified (no price)"`) instead of reading `yes_price_dollars` or inferring `1 − yes_price_dollars` (`tests/test_kalshi_client.py`, `tests/test_analyze_trades.py`) | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |
| `L3-a` | `assets/js/portfolio-core.js`, `portfolio.html`, `strategies.html` | Browser users who loaded real demo fills had no way to export them as the `Get Fills` CSV required by `scripts/analyze_trades.py`, and clicking `Forget key` on `portfolio.html` left `#fills-body` and `window.__fills` populated in the DOM | Added `FILL_CSV_COLUMNS`, `escapeCsvCell`, `fillsToCsv`, and `downloadFillsCsv` in `assets/js/portfolio-core.js` (leaving unreturned fields blank, never `0`), wired `Export fills CSV` on `portfolio.html` and `strategies.html`, and cleared `#fills-body` + `window.__fills` on `Forget key` (`tests/portfolio-core.test.mjs`, `tests/portfolio-page.test.mjs`) | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |

---

## 3. Unverified items & cross-scope notes flagged for review

1. **Authenticated endpoints (`GET /portfolio/balance`, `GET /portfolio/positions`, `GET /portfolio/fills`, `POST /portfolio/events/orders`):** Unverified against a live demo account in this session because no demo API key/PEM exists in the workspace and autonomous mode does not request credentials. All private-account tables remain empty by default unless a user loads a demo key in tab memory.
2. **Orderbook empty-array ambiguity (`GET /markets/{ticker}/orderbook`):** Confirmed live on `2026-11-27` (`KXDOESNOTEXIST-999` returned HTTP `200` with empty `yes_dollars` / `no_dollars` arrays); explicitly disclosed in `#book-src` and `#book-check-result` across all five category pages rather than claiming proof of zero resting liquidity from the orderbook call alone.
3. **Cross-scope handoff notes logged in `COORDINATION.md` (files owned by sibling sessions were not edited here):**
   - `summary.html` (owned by sibling session `032f1ca5`): check §2 `bid`/`ask` wording vs `flagged.html#F20`, §3 browser streaming prose vs `flagged.html#W1` (WS requires signed headers and browser `WebSocket` cannot attach custom headers directly without `scripts/relay.py`), and section numbering (`1..6, 8, 7`).
   - `flagged.html` (owned by sibling sessions `8299bffe` / `032f1ca5`): verify `NF1` card prose stays aligned with `F20`'s documented resolution.

---

## 4. Executed local verification suite (`2026-11-27`, rebased onto `origin/main` @ `0676925`)

- `node --test tests/*.test.mjs`: **288/288 passed** (`0` failures)
- `node tests/dom/category-dom.mjs`: **25/25 passed** (`alerts-dom.mjs` **26/26**, `summary-dom.mjs` **5/5** → **56/56** DOM checks)
- `node tools/verify/page-runtime-check.mjs`: **18/18 published pages ran clean**, **36 HTML pages checked with `0` broken local links**
- `python3 tools/check_site_links.py .`: **36 HTML pages checked, `0` broken links/anchors**
- `python3 -m unittest discover -s tools`: **55/55 passed**
- `python3 -m unittest discover -s tests`: **35 tests ran (`30` passed, `5` cryptography-dependent tests skipped locally and executed in CI where `pip install cryptography` runs)**

# Verification round — session `8299bffe` (2026-11-27, UTC)

**What is different about this round.** Earlier sessions recorded, correctly, that the agent sandbox could not
reach `*.kalshi.co` from its shell (`curl` returns `SSL_ERROR_SYSCALL`; outbound is allowlisted to
github/npm/pypi). This session's fetch tool reaches **both** `docs.kalshi.com` **and** the demo REST host, so for
the first time the site's statements could be checked against **dated live demo responses** from the same
environment that produced the documentation. That is the capability this report spends.

**Rules this report keeps**

- Every live value below was transcribed from the response fetched at the URL printed next to it. No value is
  inferred, and none was pasted into site prose without a date.
- A live observation is **not** a documentation claim and is labelled as such: "live" ≠ "documented".
- Nothing was edited in another session's claimed files. `assets/js/sources.js`, `simulator.html`,
  `assets/js/simulator.js`, `summary.html`, `assets/js/trace.js`, `alerts.html` and `assets/js/alerts.js` were not
  touched (see `COORDINATION.md`, session `8299bffe`).
- Capture times are UTC on **2026-11-27**. "22:2xZ" means the minute was not written down before the value was
  transcribed; the request was issued between 22:20 and 22:40Z.

---

## 1 · What was checked, with its source

| # | Check | Official source (fetched 2026-11-27) | Live response (fetched 2026-11-27) | Result |
|---|-------|--------------------------------------|-----------------------------------|--------|
| 1 | Exchange status flags describe the **default index (0)** | [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status.md) — "The top-level fields describe the default exchange index (0)." | [`GET /exchange/status`](https://external-api.demo.kalshi.co/trade-api/v2/exchange/status) | **Confirmed.** Response carried `exchange_active: true`, `trading_active: true` **and** a four-entry `exchange_index_statuses`. |
| 2 | A lone `false` on a shard is **not** a pause | same page — "an index other than 0 whose status request failed or timed out is reported with all of its flags `false`. Read the status again before treating a single `false` reading for one index as a pause." | same response | **Rule implemented verbatim** in `assets/js/exchange-status.js` (`shardState` → `re-read`), not paraphrased. |
| 3 | Breakdown may be **absent** | same page, `ExchangeStatus.exchange_index_statuses` — "Absent when the per-index breakdown is unavailable." | n/a (a 200 with a breakdown was returned) | **Implemented as a stated state**, never as invented shards (`tests/exchange-status.test.mjs`, "an absent breakdown is stated"). |
| 4 | Shard **assignment** by category/tag | [Exchange Sharding](https://docs.kalshi.com/getting_started/exchange_sharding.md) — table: 0 = all other, 1 = Exotics (Combos), 2 = Crypto · Commodities, 3 = Sports (Tennis, Baseball, Basketball) | [`GET /series?category=Crypto&limit=5`](https://external-api.demo.kalshi.co/trade-api/v2/series?category=Crypto&limit=5), [`GET /series?category=Sports&tags=Golf&limit=3`](https://external-api.demo.kalshi.co/trade-api/v2/series?category=Sports&tags=Golf&limit=3) | **Confirmed on the live host** for three of the four rows: `KXBTCE` (Crypto) → `exchange_index: 2`; `KXGOLFTENNISMAJORS` (tags Golf, Tennis) → `exchange_index: 3`; `KXPGA5BALL`, `KXPGARYDERTOP`, `KXGOLFMAJORS`, `KXPGAHOLE` (tag Golf only) → `exchange_index: 0`. Shard 1 (Exotics) was **not** exercised. |
| 5 | Market `status` filter has **five** values incl. `paused` | [Get Markets `/openapi.yaml` `MarketStatusQuery`](https://docs.kalshi.com/api-reference/market/get-markets.md) — `enum: [unopened, open, paused, closed, settled]` | [`GET /markets?limit=1&status=paused`](https://external-api.demo.kalshi.co/trade-api/v2/markets?limit=1&status=paused) | **Confirmed.** HTTP 200 returned `KXNHLFIRSTGOAL-26NOV27PITBUF-BUFZMETSA73` with object `status: "inactive"`. |
| 6 | `paused` → `inactive` mapping | [Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle.md) — filter table `paused` → `inactive` | same request as #5 | **Confirmed live.** This closes Flagged **A9**'s "whether the exchange accepts `status=paused`". |
| 7 | The **event** filter is four values, not five | [Market Lifecycle FAQ](https://docs.kalshi.com/getting_started/market_lifecycle.md) — "`GET /events` supports a `status` filter with values `unopened`, `open`, `closed`, and `settled`" | [`GET /events?limit=2&status=open`](https://external-api.demo.kalshi.co/trade-api/v2/events?limit=2&status=open) | **Recorded** as a separate vocabulary. The two lists must not be copied across endpoints; the dashboard alerts on markets, so it uses the five-value market filter. |
| 8 | Get Markets **prose** contradicts its own enum | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets.md) (prose sentence: four values, no `paused`) vs the same page's `MarketStatusQuery` enum (five) | — | **Defect stands**, recorded in A9 rather than resolved away. The site now cites the enum and says why. |
| 9 | Markets returned by `status=open` report `status: "active"` | [Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle.md) — `open` → `active` | [`GET /markets?limit=2&status=open`](https://external-api.demo.kalshi.co/trade-api/v2/markets?limit=2&status=open) | **Confirmed.** Both returned markets carried `exchange_index: 1` — a useful second live observation: **Events-market rows do sit on shard 1**, which is the shard this round did not otherwise exercise. |
| 10 | Order book shape is `orderbook_fp` with `yes_dollars` / `no_dollars` | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses.md) | [`GET /markets/{ticker}/orderbook?depth=3`](https://external-api.demo.kalshi.co/trade-api/v2/markets/KXMVECROSSCATEGORY-S2026YYX54GJWQBCTRMGP-YZY3XOLKY/orderbook?depth=3) | **Confirmed shape** (`{"orderbook_fp":{"no_dollars":[],"yes_dollars":[]}}`). The book was **empty**, so the six-column rendering of *resting* levels was **not** exercised by this sample. Not claimed otherwise. |
| 11 | Series object carries `tags`, `categories`, `exchange_index` | [Get Series](https://docs.kalshi.com/api-reference/market/get-series.md) | [`GET /series/KXBTCE`](https://external-api.demo.kalshi.co/trade-api/v2/series/KXBTCE) | **Confirmed.** `tags: ["Crypto","Bitcoin"]`, `categories: ["Crypto"]`, `exchange_index: 2`. This is the same `series.tags` the Golf topic now reads (Flagged F19's fix). |
| 12 | Unauthenticated limits are **not** published numerically | [Rate Limits and Tiers](https://docs.kalshi.com/getting_started/rate_limits.md) — "Unauthenticated public requests are subject to separate limits. Authenticate requests where supported and back off on `429`." | — | **Still true on the 2026-11-27 page.** Flagged **F3** stays `open`; this round **narrows** it: the page *does* publish the token model, per-bucket sizes and headers for authenticated tiers, and the `429` body shape, but no number for unauthenticated callers. |

## 2 · What this round changed on the site

| File | Change | Why |
|------|--------|-----|
| `assets/js/exchange-status.js` (**new**) | Pure parser for a 200 `ExchangeStatus`: per-shard rows, conflict with the top-level flags, `re-read required` state, absent-breakdown state, unusable-entry counting | Flagged **F18** |
| `index.html` | The environment strip now prints a one-line summary that cannot overclaim, plus a per-shard table (7 columns); a `<details>` block quotes the official shard-assignment table with each exercised row **dated**; source links added for Get Exchange Status and Exchange Sharding | F18 |
| `tests/exchange-status.test.mjs` | 8 new checks (11 total) covering ✓one row per shard, ✓lone `false` → re-read, ✓never "not trading" from a single shard, ✓default-index disagreement shown, ✓absent breakdown stated, ✓unusable entries skipped and counted, ✓`confirmedTrading` only from true readings, ✓non-200 keeps AC1 behaviour | guard against regression |
| `flagged.html` | **F18** → `mitigated`, with the implemented behaviour and its evidence; **A9** → both open questions answered by the enum and the live `status=paused` 200, with the page's self-contradiction kept visible | the fixes above |
| `assets/js/claims.js` | "Exchange status endpoint" row expanded with the shard rule and the dated live response; **new** "Shard assignment for the tracked topics" row; "Market status filter values" row corrected to five values and moved `partially verified` → `verified` | the checks above |
| `README.md`, `EXECUTIVE_SUMMARY.md`, `VERIFICATION.md` | Hand-written counters re-synced to the register | they quote the register and would otherwise be stale within the hour |

## 3 · Irregularities found in this round

1. **Get Markets contradicts itself** on the status filter (four values in prose, five in the OpenAPI enum).
   Published as part of **A9**; the site now cites the enum and says the prose disagrees. Not "fixed" — the
   official page is what it is.
2. **`GET /events` and `GET /markets` have different status vocabularies** (four vs five values). Previously
   recorded nowhere. Now in A9 as a cross-endpoint warning.
3. **`data/probe/**` is stale.** The newest probe capture in the repo is `api_surface_2026-11-24.json`; nothing
   in this round refreshed it, and the scheduled `collect.yml` commits on its own schedule. Any figure quoted
   from `data/probe/**` is a capture of that date, not of today. No site figure in this round depends on it.
4. **An order book can legitimately be empty.** A 200 with two empty arrays is a valid answer and must not be
   rendered as "no liquidity" or "zero"; the category pages already treat absent levels as `n/a`.
5. **This sandbox cannot `curl` `*.kalshi.co`.** The live reads in this report came from the agent's fetch tool,
   not from a repository runner. Anything that must be reproducible from CI is covered by the workflows
   (`verify-facts.yml`, `live-site-render.yml`), not by this file.

## 4 · Not verified, not claimed

- No authenticated call of any kind; **no order was placed** (Flagged **F1** remains open). Balance, positions,
  fills and P&L were not read.
- No candlestick series was transcribed; the chart parsing was not re-exercised against a fresh payload this
  round.
- Shard 1's documented "Exotics (Combos)" assignment was not exercised by a `category=Exotics` request; the
  Events-market rows that returned on shard 1 are annotated as an observation, not as proof of the table row.
- No live price, volume, open interest or resolution was transcribed into static prose.
- The per-shard semantics beyond the two quoted sentences were not explored; F18's fix implements exactly what
  the reference says and nothing more.

## 5 · Local suite at the end of this round

```
node --test tests/*.test.mjs              278/278 pass
tests/dom/alerts-dom.mjs                   26/26 checks
tests/dom/category-dom.mjs                 24/24 checks
tests/dom/summary-dom.mjs                  all pass (104/115 verified, 8 partial, 3 unverified; 38 open / 68 mitigated / 106 total)
tools/verify/page-runtime-check.mjs        18/18 pages clean
python3 tools/check_site_links.py .        36 pages, 0 broken
```

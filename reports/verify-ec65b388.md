# Independent verification — session `ec65b388` (2026-11-27)

Branch `arena/ec65b388-kalshidash2`, based on `main` @ `db91232`, verified on the tree after
integrating PR #141 and syncing `main` through PR #156 (`54c3ca1` and later bot refreshes).

## 1. Method and limits

| Step | What was done | Evidence |
|---|---|---|
| 1 | Re-fetch the official Kalshi documentation pages this session's claims rest on | URLs in §2, fetched 2026-11-27 ~22:35–22:50Z with the page-fetch tool |
| 2 | Call the **live demo REST API** directly and record the response shapes the site consumes | URLs in §3, fetched same window |
| 3 | Compare each live/doc result against the repository's own code, line by line | `file:line` in §4 |
| 4 | Recount the published registers from source | §5 |
| 5 | Run every local suite over the merged tree | §6 |

**Limits, stated plainly:**

- The sandbox shell cannot open TLS to `*.kalshi.co` (`node tests/live-alerts-check.mjs` →
  `TypeError: fetch failed … secure TLS connection` — reproduced this session). Live REST checks
  therefore go through the page-fetch tool, which can reach the host. The WebSocket surface was **not**
  re-handshaked here; the repo's own CI covered it (`live-ws-check` run `46045042020`, success,
  on `main` 2026-11-27).
- **No authenticated call was made and no order was placed** (flag F1 stands). No API keys exist in
  this repository.
- No live price, volume, open interest, liquidity figure or resolution is transcribed into any static
  page by this session. Live values below are recorded only in this dated report as evidence of
  *shape*, not as site content.

## 2. Official documentation re-fetched this session

| # | Source | What it confirmed | Verdict |
|---|---|---|---|
| D1 | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | Recommended REST root `https://external-api.demo.kalshi.co/trade-api/v2`, alternate `https://demo-api.kalshi.co/trade-api/v2`; WS `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`, alternate `wss://demo-api.kalshi.co/trade-api/ws/v2` — exactly the four endpoints in the project brief and in `assets/js/config.js` | match |
| D2 | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | Response schema: `last_price_dollars`, `previous_price_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `yes_bid/ask_dollars`, `yes_bid/ask_size_fp`, `no_bid/ask_dollars`, `price_ranges[]`, `market_type`, `result`, `settlement_value_dollars`, `notional_value_dollars`, `exchange_index`, `mve_selected_legs` — every field the client reads | match |
| D3 | [Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) | Object `status` enum: `initialized, active, inactive, closed, determined, disputed, amended, finalized`; filter mapping `unopened→initialized, open→active, paused→inactive, closed→past close_time, settled→finalized`; `result` set to `yes`/`no`/`scalar`; settled markets end at `finalized` with `settlement_ts` populated; `GET /events` status filter matches **child market** statuses and `with_nested_markets=true` exposes them | match |
| D4 | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | `POST /portfolio/events/orders`; body `ticker`, `client_order_id`, `side` ∈ {`bid`,`ask`}, `count`/`price` fixed-point **strings** (`"10.00"`, `"0.5600"`), `time_in_force`, `self_trade_prevention_type: "taker_at_cross"`, optional `exchange_index`; headers `KALSHI-ACCESS-KEY/SIGNATURE/TIMESTAMP` | match |

## 3. Live demo-API checks (fetched 2026-11-27 ~22:35–22:50Z)

Base `https://external-api.demo.kalshi.co/trade-api/v2`. Responses are quoted here only for their
**shape**; no figure was copied to a static page.

| # | Request | What the live response showed | Verdict |
|---|---|---|---|
| L1 | `GET /exchange/status` | `exchange_active: true`, `trading_active: true`, plus four `exchange_index_statuses` rows (`exchange_index` 0–3, each `trading_active: true`) — the per-shard rows PR #152's F18 fix reads | match |
| L2 | `GET /markets?status=open&limit=3` | Every D2 field present on live objects; `status: "active"` (a documented D3 value); `result: ""` while unresolved; `price_ranges` steps `0.0001/0.0010/0.0100` | match |
| L3 | `GET /events?status=open&with_nested_markets=true&limit=2` | Nested `markets[]` with per-market `status`; event-level `category` present (deprecated per [Get Events](https://docs.kalshi.com/api-reference/events/get-events) — the site classifies from the series level); `series_ticker` present; `settlement_sources[]` with name+URL | match |
| L4 | `GET /markets/KXELONMARS-99/orderbook?depth=5` | `orderbook_fp.yes_dollars` = `[[price, count], …]` string pairs, ascending (best last); `no_dollars: []` empty — the documented bids-only shape ([Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses)) | match |
| L5 | `GET /series/KXELONMARS/markets/KXELONMARS-99/candlesticks?start_ts=…&end_ts=…&period_interval=1440` | `candlesticks[]` with `end_period_ts`, `price.{close,open,high,low,mean,previous}_dollars`, `volume_fp`, `open_interest_fp`, `yes_bid/yes_ask.{close,…}_dollars` — exactly `parseCandle()`'s input (`assets/js/market.js:618-635`) | match |
| L6 | `GET /series/KXELONMARS` | `category: "Politics"`, `categories: ["Politics"]`, `tags: ["International"]`, `fee_type: "quadratic"`, `fee_multiplier: 1` — the series-level basis the taxonomy reads. Note the same event's **event-level** `category` was `"World"` (L3): live confirmation that series- and event-level categories differ, which is why the site classifies from the series | match |
| L7 | `GET /markets?status=settled&limit=2` | `status: "finalized"`, `result: "yes"` with `settlement_value_dollars: "1.0000"`, and `result: "no"` with `"0.0000"`, both with `settlement_ts` populated — the yes/no resolution record the brief asks the site to track | match |

A wrong-path probe (`GET /markets/{ticker}/candlesticks`) returned an error; the site already uses the
documented series-scoped route (`assets/js/market.js:639-640`), so no defect — the error was mine.

## 4. Line-by-line code checks (this session)

| # | Code | What it does | Official / brief basis | Verdict |
|---|---|---|---|---|
| C1 | `assets/js/alerts-core.js:16,83,134` + `config.js:234` | `THRESHOLD = 0.10`, `defaultThreshold: 0.10`; both the last-price move and the 24 h reference move are compared with the threshold **inclusive, both directions** | brief: "greater than or equal to $0.10 in either direction" | match |
| C2 | `alerts.html:120-126` | Exactly two scrolling feeds: `#feed-all` ("All alerts") and the High-ROI watch chat; `role="log"`, `aria-live="polite"` | brief: "two scrolling chats … all events … selective filter … high ROI" | match |
| C3 | `assets/js/config.js:87-164` | Topic keys `gas`, `elections`, `culture`, `crypto`, `golf` — the brief's five topics, each its own category page under `categories/` | brief | match |
| C4 | `assets/js/config.js:182-195` | Chart windows `10s, 1m, 5m, 1h, 6h, 24h, 7d` with the disclosed note that Kalshi has no seconds-resolution candle API | brief: "choose between seconds, minutes, hours timestamp graph length" | match |
| C5 | `assets/js/category.js:617,645` | Liquidity panel from `GET …/orderbook?depth=20` (documented depth 0–100), per-price contracts + resting notional, and the implied YES ask `1 − NO bid` ([Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses)) | brief: "current liquidity amounts, how many contracts are available at a given price" | match |
| C6 | `assets/js/market.js:662` `detectJumps` + `category.js:401` | Jump markers at `|Δ| ≥ $0.10` inclusive on the charts, linked to the candle endpoint and the event's `settlement_sources` (DOM test: "the jump is linked to the official candle endpoint and the event's settlement source") | brief: "sharp jump … ≥ $0.10 … events and website links" — see F14 below | match, with F14 caveat |
| C7 | `assets/js/kalshi.js:200-216` | Order body: `side` `bid`≡yes/`ask`≡no, `count` `.toFixed(2)`, `price` `.toFixed(4)` strings, `time_in_force`, `self_trade_prevention_type: "taker_at_cross"`, optional `exchange_index`, route `POST /portfolio/events/orders` | D4 | match |
| C8 | `assets/js/market.js:790-800` | Terminal-status handling enumerates exactly D3's eight lifecycle values; resolution keys on `result`, not the status string | D3 | match |
| C9 | `assets/js/market.js:331-371` | Resolution feed reads `/events?status=open|closed|settled&with_nested_markets=true` and multivariate from `/events/multivariate` ([Get Events](https://docs.kalshi.com/api-reference/events/get-events): `/events` excludes multivariate) | D3 + Get Events | match |
| C10 | `flagged.html#F14` + `questions.html` Q | The brief's "website links that may have caused a sharp jump" cannot be sourced officially: Kalshi's API publishes no news feed and no causal link. The site says so on the Flagged page (F14, *open*) and under every chart shows the market's `settlement_sources` and `rules_primary` labelled *where the market is decided*, never as the cause | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) (`settlement_sources`, `rules_primary`); no official news/causality endpoint exists on docs.kalshi.com | honest gap — flagged, not invented |

## 5. Register recounts (from source, this session)

| Register | Recount | Published figure | Verdict |
|---|---|---|---|
| `assets/js/claims.js` statuses | 105 `verified` + 8 `partially verified` + 3 `unverified` = **116** | `summary.html` renders `${verified} / ${CLAIMS.length}` dynamically (`summary.html:56-58,117`) — no hard-coded count to drift | match |
| `flagged.html` cards | **107** `.irregularity` blocks | `8299bffe` board note "107 flagged, 38 open"; tag census: 39 `open`, 31 `mitigated`, 39 `fixed`, 2 `corrected`, 1 `untested` (one `open` tag belongs to a non-card element — the summary DOM test, which pins the counters, passes) | match |
| Requirement trace | `tests/requirements-trace.test.mjs` **10/10** | brief requirements → implementation matrix on `summary.html` §8 | match |

## 6. Local suite on the verified tree (2026-11-27 ~22:4x–23:0xZ)

| Harness | Result |
|---|---|
| `node --test tests/*.test.mjs` | **278/278**, 0 fail |
| `node --test tests/dom/*.test.mjs` | **15/15** |
| `cd tests/dom && npm test` (jsdom) | alerts **26/26**, summary **PASS**, category **24/24** |
| `python3 -m unittest discover -s tools` | **55/55** |
| `python3 -m unittest discover -s tests` | **28 run** (4 skipped: live-WS gated) |
| `python3 tools/check_site_links.py` | **36 pages / 0 broken** |
| `node tools/verify/page-runtime-check.mjs` | **18/18 pages clean**, 36 pages, 0 broken links |
| `node evidence/auth-sign-test.mjs` | **6/6** |
| CI `live-ws-check` on `main` (run `46045042020`) | success (WS surface, cited not re-run locally) |

## 7. Irregularities found and how they were handled

| ID | Finding | Action |
|---|---|---|
| EC-X1 | `flagged.html#NF1`'s `<h3>` still asserted "The official pages **disagree**…" under a *mitigated* tag although the card's own callout and F20 resolve the matter as "different questions, not disagreement" — requested for reconciliation by sessions `54220d3d` and `46f45a35` | **Fixed** in this branch: title now reads "**appeared to disagree**"; body, callout and F20 link untouched. Claim logged on the board (EC4) before the edit; no test pins the title; no open PR touched `flagged.html` |
| EC-X2 | PR #141's DR3 body called `1a30722` "the root commit" | **Disproven and superseded**: `git rev-list --max-parents=0 origin/main` → `6081bb7` ("Initial commit", 2026-11-20, only `README.md`); `1a30722` is the merge commit of PR #130 (2026-11-25, two parents). The merge kept `main`'s measured rewrite of the DR3 paragraph (session `032f1ca5`), which carries the same measured intent with the correct SHA; PR #141's report (`reports/verify-d3e0e9f5.md` §7) and board record are kept in full |
| EC-X3 | Local `node tests/live-alerts-check.mjs` fails with `TypeError: fetch failed` (TLS blocked for `*.kalshi.co` from the sandbox shell) | Environment limit, not a defect — same limit every session records; the check runs in GitHub Actions where it is green |

Nothing else in §2–§5 contradicted the published site. No new flag was opened.

## 8. Not verified, not claimed

- Any authenticated request, order acceptance, balance, position or P&L (F1; no credentials exist here).
- Any live price, volume, open interest, liquidity or resolution transcribed into a static page
  (live values render in the browser only).
- A live WebSocket handshake from this sandbox (delegated to CI `live-ws-check`).
- Third-party URLs (news, help centre) — not fetched; only `docs.kalshi.com`, `external-api.demo.kalshi.co`
  and `github.com` were used as sources.

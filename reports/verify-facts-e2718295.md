# Verification report — session `e2718295` (2026-11-21)

Independent, line-by-line check of the claims this repository makes about the official Kalshi
interface, plus the fix for the two red checks that were failing on `main` at `bbdc3a0`.

Every row below quotes the official page it was checked against. Pages were fetched and read on
**2026-11-21** (UTC). Nothing here is inferred: where a value could not be read from an official
page, the row says so instead of filling it in.

---

## 1. Interface claims re-verified today

| # | Claim in this repo | Where it is asserted | Official text (verbatim) | Source | Verdict |
|---|---|---|---|---|---|
| 1 | Demo REST root is `https://external-api.demo.kalshi.co/trade-api/v2` | `assets/js/config.js` `DEMO.rest` | "Demo's recommended Trade API root is `https://external-api.demo.kalshi.co/trade-api/v2`." | <https://docs.kalshi.com/getting_started/demo_env> | verified |
| 2 | `https://demo-api.kalshi.co/trade-api/v2` is also supported | `assets/js/config.js` `ALTERNATES.rest` | Table row "REST Trade API": recommended `https://external-api.demo.kalshi.co/trade-api/v2`, also supported `https://demo-api.kalshi.co/trade-api/v2` | <https://docs.kalshi.com/getting_started/demo_env> | verified |
| 3 | Demo WebSocket is `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | `assets/js/config.js` `DEMO.ws`; `VERIFICATION.md` | Table row "WebSocket API": recommended `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`, also supported `wss://demo-api.kalshi.co/trade-api/ws/v2` | <https://docs.kalshi.com/getting_started/demo_env> | verified |
| 4 | The demo uses mock funds, has credentials separate from production, and its prices may not reflect real markets | `EXECUTIVE_SUMMARY.md`, `assets/js/claims.js` | "Kalshi offers a *demo* environment with mock funds … For safety, credentials are not shared between this environment and production. … The price and behavior of markets in the demo environment may not be reflective of those in real markets." | <https://docs.kalshi.com/getting_started/demo_env> | verified |
| 5 | `volume_fp`, `volume_24h_fp`, `open_interest_fp` are contract counts, not dollars | `data/snapshot.json` `_meta.derivation_notes`, `scripts/collect.py` | `volume_fp`: "String representation of the market volume in contracts"; `volume_24h_fp`: "String representation of the 24h market volume in contracts"; `open_interest_fp`: "String representation of the number of contracts bought on this market disconsidering netting" | <https://docs.kalshi.com/api-reference/market/get-market> | verified |
| 6 | `notional_value_dollars` is the value of **one** contract at settlement, not turnover | `scripts/collect.py` note, `assets/js/claims.js`, `QUESTIONS.md` Q9 | "The total value of a single contract at settlement in dollars" | <https://docs.kalshi.com/api-reference/market/get-market> | verified |
| 7 | `previous_price_dollars` is the exchange's own day-old reference price, used for the swing test | `assets/js/config.js` `ALERT` comment; Flagged `Z1` | "Price for the last traded YES contract on this market a day ago in dollars" | <https://docs.kalshi.com/api-reference/market/get-market> | verified (the wording is precise; the *use* as a swing baseline is the project's own choice and is already flagged `Z1`) |
| 8 | Orderbook returns `orderbook_fp.yes_dollars` / `no_dollars`, each entry `[price_dollars, count_fp]`, bids only, ascending, best bid last, no auth | `assets/js/kalshi.js` `parseBook` | "The orderbook response is wrapped in an `orderbook_fp` object containing two arrays of bids: `yes_dollars` … and `no_dollars` … Each bid is a two-element string array: `[price_dollars, count_fp]`… Arrays are sorted by price in **ascending order**. The **highest** bid (best bid) is the **last** element in each array… Kalshi's orderbook only returns bids, not asks." | <https://docs.kalshi.com/getting_started/orderbook_responses> | verified |
| 9 | Candlestick `period_interval` is only `1`, `60` or `1440` minutes | `assets/js/config.js` `CANDLE.intervals` | "Time period length of each candlestick in minutes. Valid values are 1 (1 minute), 60 (1 hour), or 1440 (1 day)." | <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | verified |
| 10 | One candlestick request may span at most 5,000 periods, so longer windows must be split | `assets/js/config.js` `CANDLE.maxPeriodsPerRequest`; `assets/js/market.js` `fetchCandles` chunk loop | "One request can span at most 5,000 periods. If the minutes between `start_ts` and `end_ts` divided by `period_interval` exceed 5,000, the request is rejected with 400 `bad_request`…" | <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | verified |
| 11 | Candle `close` price is `price.close_dollars` | `assets/js/market.js`, `VERIFICATION.md` | Response schema: `"price": { "open_dollars", "low_dollars", "high_dollars", "close_dollars", "mean_dollars", "previous_dollars", "min_dollars", "max_dollars" }` | <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | verified |
| 12 | The ticker WebSocket payload names the last trade `price_dollars` (REST calls it `last_price_dollars`) | `assets/js/claims.js`, `assets/js/live-core.js` field list | Ticker example payload: `"price_dollars": "0.4800"`, with `yes_bid_dollars`, `yes_ask_dollars`, `volume_fp`, `open_interest_fp`, `dollar_volume`, `dollar_open_interest`, `yes_bid_size_fp`, `yes_ask_size_fp`, `last_trade_size_fp`, `ts`, `ts_ms`, `time` — no `previous_price_dollars` | <https://docs.kalshi.com/websockets/market-ticker> | verified (including the "no `previous_price_dollars`" note in Flagged `W2`) |
| 13 | A WebSocket connection requires API-key authentication at the handshake, even for public channels | `assets/js/claims.js`, `README.md` | "API key authentication required for WebSocket connections. The API key should be provided during the WebSocket handshake." | <https://docs.kalshi.com/websockets/market-ticker> (Security Schemes) | verified |
| 14 | `GET /markets/trades` is cursor-paginated with `limit` 1–1000 and `min_ts`/`max_ts` in seconds | `scripts/collect.py` trade sample; snapshot notes | "Use the 'limit' parameter to control page size (1-1000, defaults to 100)… `min_ts` and `max_ts` must be in seconds; millisecond values are rejected with 400 `bad_request`." | <https://docs.kalshi.com/api-reference/market/get-trades> | verified |
| 15 | Fees: model fee rounded up to `$0.000001`, then a rounding fee restores the member's balance grid; net fee ≥ 0 | `assets/js/simulator.js` `fillFeeDollars`; `tests/simulator-core.test.mjs` | "**Trade fee** | Fee from the fee model, rounded up to the nearest `$0.000001`" … "**Net fee** = trade fee + rounding fee - rebate (always >= $0.00)"; worked example: revenue `-$0.055`, model fee `$0.00363825` → trade fee `$0.003639`, rounding fee `$0.001361`, net `$0.005` | <https://docs.kalshi.com/getting_started/fee_rounding> | verified — and the simulator's unit test reproduces that worked example exactly (test passing on the fixed tree) |
| 16 | Order writes use `POST /portfolio/events/orders` with `ticker, side(bid/ask), count, price, time_in_force, self_trade_prevention_type, client_order_id` | `VERIFICATION.md`, `assets/js/portfolio`-side trading code | "Create Order (V2) … `POST …/portfolio/events/orders`" with the same body fields, `side` `bid`/`ask`, string `count`/`price` | <https://docs.kalshi.com/api-reference/orders/create-order-v2> | verified |
| 17 | Markets (and their candlesticks) that settled before the published cutoff are only reachable through `/historical/*` | (not asserted anywhere; checked while auditing the strategy tester's universe) | "`market_settled_ts` … Markets and their candlesticks that settled before this timestamp are only available via `GET /historical/markets`" | <https://docs.kalshi.com/getting_started/historical_data> | verified as a *boundary*: the simulator builds its universe from `GET /markets?status=settled` (the live tier only) and reads candles from the live candlestick endpoint, so the boundary is consistent. Older archived markets are simply not offered — a stated scope limit, not an error. |

---

## 2. The defect this session fixed (E1)

At `main` = `bbdc3a0` ("chore(data): refresh Kalshi demo snapshot [skip ci]", bot, 2026-11-21T19:29Z)
two checks failed locally on a clean checkout:

| Check | Result at `bbdc3a0` |
|---|---|
| `python3 -m unittest discover -s tools -p 'test_*.py'` | **1 of 28 failing** — `SnapshotMetadataTests.test_snapshot_labels_contract_counts_and_sampled_trade_value` asserted the phrase `contract-count fields`, which the regenerated snapshot no longer contained |
| `node --test tests/*.test.mjs` | **1 of 71 failing** — `tests/activity-proxy.test.mjs` asserted the phrase `not asserted as actual all-side cash turnover`, which the regenerated snapshot no longer contained |

**Cause.** `.github/workflows/collect.yml` (cron `23 */6 * * *`) rewrites `data/snapshot.json`
from `scripts/collect.py` and commits it with `[skip ci]`. The generator's disclosure strings and
the two test suites had drifted apart, and because of `[skip ci]` no test ran on the bot commit.
Every nightly refresh therefore re-broke `main`.

**Duplicate-work note.** While this session was preparing the fix, session `0d6f4f1f` shipped the same
symptom fix on its own branch: PR [#63](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/63)
(commit `f25ecd7`, merged as `882e074`) restored the two phrases inside `scripts/collect.py` and
re-synced `data/snapshot.json`. That wording is **kept verbatim** here — this PR does not revert or
rewrite it. The difference is structural: PR #63 restores the strings, this PR makes the strings a
single constant and adds a test plus a CI gate so the same drift cannot silently land on `main`
again. With PR #63 merged, `data/snapshot.json` needs no further change at all (verified: the
committed notes equal `collect.DERIVATION_NOTES` exactly).

**Fix (three parts, all verified locally).**

1. `scripts/collect.py` now holds the disclosure text in one place, `DERIVATION_NOTES`, and writes it
   verbatim into `_meta.derivation_notes`. The wording is PR #63's (the official one from section 1
   rows 5–6 and 14 — "contract-count fields … not traded-dollar volume";
   "not asserted as actual all-side cash turnover").
2. `data/snapshot.json` needed **no** change after PR #63 merged: its two note strings already equal
   the canonical text. The earlier draft of this fix changed only those two strings; a deep
   comparison of the parsed snapshot before and after (`_meta.derivation_notes` excluded) returned
   `True` — no captured price, volume, order-book level, candlestick, timestamp, API call count or
   source URL was ever touched, and no new live data was fetched.
3. `tools/test_collect.py` gains `test_snapshot_notes_match_the_generator_exactly` (exact equality
   between the generator constant and the committed snapshot, so wording drift fails immediately)
   plus `test_generator_notes_state_the_official_field_semantics` (the disclosure must keep saying
   "contract-count fields", "not traded-dollar volume", "single contract at settlement",
   "No min_ts time bound",
   "pagination is capped" and "not asserted as actual all-side cash turnover").
   `.github/workflows/collect.yml` runs both metadata suites **before** it commits, so a drifting
   refresh fails the job instead of landing a red tree on `main`.

**Result on the fixed tree**

| Suite | Result |
|---|---|
| `python3 -m unittest discover -s tools -p 'test_*.py'` | **30/30 OK** (was 27/28) |
| `node --test tests/*.test.mjs` | **71/71 pass** (was 70/71) |
| `tests/dom/alerts-dom.mjs` | 16/16 |
| `tests/dom/summary-dom.mjs` | pass — 78/89 verified, 8 partial, 3 unverified, 32 open flags, 28 sourced rows |
| `node tools/verify/page-runtime-check.mjs` | 17/17 pages ran clean; 34 local links, 0 broken |
| `python3 tools/check_site_links.py` | pass — 17 HTML pages |
| `python3 -m unittest discover -s tests -p 'test_*.py'` | 18 OK, 3 skipped (`cryptography` not installed) |
| `node evidence/auth-sign-test.mjs` | 6/6 |
| `python3 -m py_compile scripts/collect.py`, `git diff --check` | clean |

---

## 3. Irregularities found during this pass (published for review, none blocking)

| ID | Item | What the official source says | Why it is flagged | Suggested fix (not applied here — see the board) |
|---|---|---|---|---|
| **E-I1** | `QUESTIONS.md` Q9 says "API gives contracts (`*_fp`), not dollars" | The official **ticker** payload documents `"dollar_volume": 16948` and `"dollar_open_interest": 10211` next to `volume_fp` / `open_interest_fp` (<https://docs.kalshi.com/websockets/market-ticker>), and `GET /markets` returns `notional_value_dollars` (<https://docs.kalshi.com/api-reference/market/get-market>). | The statement is true for the REST ranking fields the dashboard uses, but read literally it is incomplete: a dollar-denominated volume field **does** exist in the streaming payload. The same sentence appears on `questions.html` (Q9) and, in the same spirit, on `docs/questions.html` and `docs/flagged.html` (F7). | Reword Q9: "REST market objects report contract counts (`*_fp`) plus `notional_value_dollars` (one contract at settlement); the WebSocket ticker also carries integer `dollar_volume` / `dollar_open_interest`." Not edited here because `questions.html` is inside open PR #60's file list. |
| **E-I2** | `VERIFICATION.md` header still reads "Checked 2026-11-20" and refers to "`docs/flagged.html` (F1–F7 plus doc discrepancies D1–D3)" | The published site generation is now the root pages (`flagged.html` with flags through `Z2`, `Y1`–`Y11`, `A5`, `A11`, `A12`, `W2`–`W4`…), per `README.md`'s "two site generations" note. | A reader can take a two-day-old header as current, and the flag references point at the superseded generation. The individual rows I re-checked (§1) are still accurate. | Re-date the header and point to the current `flagged.html` register. Not edited here: `VERIFICATION.md` is in open PR #60's file list. |
| **E-I3** | `main` shipped two failing checks (§2) | — | Repeated red builds caused by the scheduled bot refresh. | Fixed by PR #63 (symptom); this PR adds the drift test + collect-workflow gate so it cannot recur. |
| **E-I4** | Archived settled markets are outside the strategy tester's universe | Historical tier documented at <https://docs.kalshi.com/getting_started/historical_data> (`GET /historical/markets`, `GET /historical/markets/{ticker}/candlesticks`, cutoff from `GET /historical/cutoff`) | Not an error — `GET /markets?status=settled` only returns markets still in the live tier, and their candlesticks are in the same tier, so the tester never requests archived data. Recorded so the scope limit is explicit rather than looking like a bug. | Optional future work: query `GET /historical/cutoff` and `/historical/markets` to widen the backtest universe. Not implemented — the exact historical query parameters were not read in full this session, and guessing them would violate the no-inference rule. |

---

## 4. What this session did **not** verify

- No authenticated request was made: no demo API key exists in this repo or this sandbox, so
  balance, positions, fills and order placement were checked against the official request/response
  schemas only, not executed.
- No WebSocket handshake was opened from the sandbox (the handshake needs signed headers; the
  browser-side/relay path is exercised by the repository's own live checks).
- Live market values (prices, volumes, balances, resolutions) are never transcribed here by design;
  the site reads them live in the browser.
- `docs/` (the superseded site generation) was not re-verified row by row; its landing page is a
  redirect to the root site (Flagged `Y10`).

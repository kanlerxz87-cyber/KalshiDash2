# Integration verification — session `e7931fe7` (2026-11-22)

Scope: a line-by-line pass over the published root site and the code behind it, checked against
the official Kalshi documentation and the repository's own tests. Files changed are listed at the
end; nothing outside the claimed scope was edited.

## 1. Official sources re-read in this pass

| # | What was checked | Official source | Result |
|---|---|---|---|
| 1 | Both REST bases and both WebSocket URLs used by the brief and the site | <https://docs.kalshi.com/getting_started/demo_env> | Match verbatim: `https://external-api.demo.kalshi.co/trade-api/v2` (recommended) with `https://demo-api.kalshi.co/trade-api/v2` also supported; `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` with `wss://demo-api.kalshi.co/trade-api/ws/v2` also supported. Page also states demo prices "may not be reflective of those in real markets" — the site says the same. |
| 2 | Order-book response shape parsed by the liquidity tables | <https://docs.kalshi.com/api-reference/market/get-market-orderbook> | `orderbook_fp.yes_dollars` / `no_dollars` as `[price, count]` **strings** — exactly what `assets/js/market.js` and the category liquidity tables read. `depth` documented as `0 <= x <= 100` (omit or 0 = all levels); the page requests `depth=20`, inside the bound. |
| 3 | Trades endpoint behind the "Dollars actually traded" panel | <https://docs.kalshi.com/api-reference/market/get-trades> | Documented fields `trade_id`, `ticker`, `count_fp`, `yes_price_dollars`, `no_price_dollars`, `taker_outcome_side`, `taker_book_side`, `created_time`, `is_block_trade`, deprecated `taker_side`, plus `cursor`; `limit` default 100, max 1000; `min_ts`/`max_ts` Unix seconds; `ticker` filter. The site's request uses only these parameters and its arithmetic uses only these fields. |
| 4 | Index of all documentation pages, to confirm the cited pages exist | <https://docs.kalshi.com/llms.txt> | The pages cited above are in the index. |
| 5 | Pages deployment of the current `main` tree | `GET /repos/…/pages/builds/latest` | `status: built`, commit `252e623`, `error: null`, built 2026-11-22T07:06:08Z — the published site is generated from the current `main`. |

Not verified in this pass (unchanged from earlier sessions): any authenticated call (no demo key in
the repository), and the fee-schedule PDF, which this sandbox cannot read.

## 2. What was re-checked and found correct

- `/markets/trades` request construction: only documented parameters (`ticker`, `min_ts`, `max_ts`,
  `limit`, `cursor`), ticker URL-encoded, `limit` clamped to the documented 1000.
- Cursor walk: stops on an empty cursor; a page budget that runs out and a failed page both make the
  result `complete:false`, which the panel renders as n/a rather than as a total (test-covered).
- Order-book depth rendering: literal NO-bid price kept beside the implied YES ask `1 − y`; the
  reciprocal rule is cited on the page; YES-bid rows leave the implied column blank.
- Chart windows: the 7-day window requests the documented 60-minute `period_interval`, and long
  windows label the X axis with a date rather than only a clock time.
- Resolution semantics: `result` is displayed literally (`yes` / `no` / `scalar`), never inferred
  from price.
- Alert threshold: a swing is reported only at an absolute change of at least $0.10 in either
  direction, and each message names which comparison produced it.
- Static link check (36 pages), page-runtime harness (18/18), signing self-test (6/6), Python tools
  (42) and Python tests (20, 3 skipped) are green on the merged tree.

## 3. Defects found and fixed (published as Z5–Z7 on `flagged.html`)

All three are in the traded-dollar panel added by PR #98. They share one cause: the panel's prose
promised properties its arithmetic did not have, and no fixture exercised the cases that break them.

| ID | Defect | Why it was wrong | Fix |
|---|---|---|---|
| Z5 | `tradeDollars()` valued a row with **no recorded taker side** on the YES leg (`priced:true`) | Which of `yes_price_dollars` / `no_price_dollars` applies is decided by the side the taker took. Without a recorded side that choice is unknown: 10 contracts at YES $0.40 are $4.00 for a YES taker and $6.00 for a NO taker. The guess was then summed into a figure labelled "official". The module's own header already said the opposite. | Rows with no recorded side, or no price on the recorded side, are excluded and counted (`unsided` / `missing`); the page states how many and why. `missingNote()` names the two reasons separately. |
| Z6 | Headline total computed as `rows.reduce((a, r) => a + (r.dollars || 0), 0)` | An unreadable market's row carries `dollars: null`; `|| 0` turned an unknown amount into zero, so a partial sum was printed as the topic's total — the exact thing the page text promised never to do. | Only complete rows are summed; if any measured market was unreadable the headline is withheld as n/a with the reason, and the trade/contract counts are labelled as completed rows only. |
| Z7 | Row evidence link built from `ev.markets[0].ticker` while the row summed several markets | The link behind a multi-market total opened one market's trades — sometimes a market that was not measured at all. | `rankByTradedDollars()` returns the tickers actually measured; the row renders one link per ticker with the same `min_ts`/`max_ts`/`limit`, marking an incomplete read. Every dollar figure is now re-addable by hand from the responses it links. |

Also corrected in the same pass: the panel did not display the `created_time` span of the trades it
read, although `EXECUTIVE_SUMMARY.md` said it did. The result now carries that span and the note
prints it beside the requested window.

## 4. Tests added (each fails without its fix)

- `tests/dollar-volume.test.mjs` — 31 checks (was 25): unknown-side rows are not valued; a NO taker
  is never valued at the YES price; the two exclusion reasons are counted and named separately; rows
  carry their measured tickers; unvaluable trades reach the result counts; the observed
  `created_time` span is reported.
- `tests/dom/category-dom.mjs` — 23 checks (was 18): every measured market's trades response is
  linked with the measured window; the headline is the documented sum; six cells per row; an
  unreadable market withholds both the headline and the row figure; the observed trade span is
  printed.
- `.github/workflows/site-check.yml` now runs the three DOM suites in CI (`dom` job). They were
  local-only before, which is how Z5–Z7 reached `main`.

## 5. Limitations that remain (unchanged)

- Alerts poll only while the tab is open; the scan universe is capped (12 × 200 events, top 30 open
  markets per topic by the volume × last-price proxy).
- Last traded price only: quote-only moves and moves that reverse inside one poll are invisible.
- The WS ticker path detects consecutive-reading swings only (no `previous_price_dollars` in the
  ticker payload) and needs a demo key plus `scripts/relay.py`, so the published site runs on REST
  polling.
- No demo API key exists in the repository, so no account performance, fill, or end-to-end order is
  claimed.
- Simulated fills omit fees/slippage/queue position (F15); the High-ROI watch is a rule set, not a
  validated model (A1); ranking on the boards still uses the labelled proxy (A11, mitigated).
- A trade whose pages were read only partly is excluded from the total, so a topic total can be
  smaller than the true traded dollars; the page says how many markets were skipped or unreadable.

## 6. Files changed by this session

`assets/js/dollar-volume.js`, `assets/js/category.js`, `tests/dollar-volume.test.mjs`,
`tests/dom/category-dom.mjs`, `flagged.html`, `index.html`, `categories/{gas,elections,culture,crypto,golf}.html`,
`EXECUTIVE_SUMMARY.md`, `README.md`, `.github/workflows/site-check.yml`, `COORDINATION.md`,
`reports/audit-e7931fe7.md`.

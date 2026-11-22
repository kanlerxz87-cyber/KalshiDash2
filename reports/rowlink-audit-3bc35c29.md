# Rendered-table source-link audit — session `3bc35c29` (2026-11-22)

**Brief requirement tested:** "Every table row must have a source link to an official site. If a value can't be
confirmed from an official source, leave it blank and flag it as unverified."

**Base:** `main` @ `252e623`. **Board:** `COORDINATION.md`, section *Session `3bc35c29`*.

## Method

1. **Static parse** of every published HTML file (`*.html`, `categories/*.html`): every `<table>`, every `<tr>` with
   at least one `<td>`, and whether the row contains any `<a href>`.
2. **Runtime template review** of every JavaScript row template that fills a table after load
   (`assets/js/category.js`, `assets/js/alerts.js`, inline module in `index.html`), because most data tables are
   filled by JavaScript and a static parse cannot see them.
3. **Runtime harness:** `node tools/verify/page-runtime-check.mjs` (18/18 pages ran clean) and
   `python3 tools/check_site_links.py .` (36 pages, 0 broken local links) — run on `main` before any edit.
4. **Fresh live re-read** of the one factual claim in a table that contradicted live data (see §3), using the
   browser-side fetch tool against the official demo REST host, on 2026-11-22.

## 1. Results by page (static parse)

Rows counted are `<td>`-bearing rows. "No link" rows are, in every case, one of: a runtime placeholder
(`Loading…`, `No fills loaded.`, `No data.`, `Load a market first.`), a legend row, or a row that is not an exchange
fact. Data rows in the tables that are filled from the API carry a link in the template (§2).

| Page | Data-bearing tables | Rows with no link | What those rows are |
|---|---|---|---|
| `index.html` | 3 | 3 (one per table) | runtime placeholders (`Loading…`, `No demo API key loaded in this tab.`) |
| `alerts.html` | 3 | 3 | placeholders (`Waiting for the first poll…`, `No simulated trades yet.`) |
| `simulator.html` | 5 | 4 of 5 | placeholders; table #5 (9 rows) — all linked |
| `summary.html` | 3 | 1 (table #1) | the row "Executive summary · This page · done · Project deliverable; no exchange fact asserted." — deliberately asserts no exchange fact |
| `verification.html` | 3 | 2 (table #1) | status-legend rows (`verified`, `partially verified`) |
| `sources.html` | 2 | 4 (table #1) | status-legend rows (`read`, `matched`, `unverified`, `third party`) |
| `questions.html` | 1 | 5 of 6 (before fix) | see §3 — **two stale rows fixed**, one process row removed, one row now linked |
| `resolved.html`, `portfolio.html`, `strategies.html`, `event.html` | 2–5 each | all placeholders | `Loading…`, `No markets tracked yet.`, `No fills loaded.`, `No data.` |
| `categories/{gas,elections,culture,crypto,golf}.html` | 4 each | all placeholders | `Loading…`, `Load a market first.`, `Press “Measure traded dollars”…` |

## 2. Runtime row templates (what a filled table row links to)

| Table | Template | Link in every data row |
|---|---|---|
| Category board, Events (`assets/js/category.js` ~L153) | event title; `API response ↗` | `${DEMO.rest}/events/{event_ticker}?with_nested_markets=true` — official Kalshi demo REST |
| Category, dollars-actually-traded (`category.js` ~L247) | event title; `trades response ↗` | `${DEMO.rest}/markets/trades?...` — official Get Trades |
| Category, price jumps (`category.js` ~L428) | `market ↗` | `…/trade-api/v2/markets/{ticker}` — official Get Market |
| Category, order book (`category.js` ~L541) | `API response ↗` | official orderbook endpoint |
| Dashboard events (`index.html` ~L313) | event title; `API response ↗` | official Get Events |
| Alerts feed (`alerts.js` ~L655–706) | `market`, `event` links; simulator rows `src(...)` | official Get Market / Get Events |

Result: every template that emits a data row includes at least one link to an official Kalshi host.

## 3. Findings and fixes

| # | Finding | Evidence | Action |
|---|---|---|---|
| F-1 | **Stale, unlinked factual row** on `questions.html`: "Gas-price market coverage on the demo exchange — *The gas topic currently has no open demo markets*." | Live demo REST, re-read 2026-11-22 via browser fetch: `GET https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASW&limit=5` returns open event `KXAAAGASW-26NOV23` "US gas prices this week", `strike_date` 2026-11-23, `settlement_sources` AAA `https://gasprices.aaa.com/`. Board already records F4 as **superseded** (`COORDINATION.md` GC1, session `29749918`; `reports/live-verify-c33971c1.md`). | **Row removed** from the public table. The flagged register keeps F4 with its history. |
| F-2 | **Stale WebSocket row** on `questions.html`: "Streaming … Until then polling is used"; "add a small relay". | The same page's Q10 states the alerts page already includes an optional same-origin relay, default REST polling. Market Ticker doc: <https://docs.kalshi.com/websockets/market-ticker> (fetched 2026-11-22: "No additional channel-level authentication beyond the authenticated WebSocket connection"; flush "scheduled every second"). | Row reworded to the open question that remains (browser-side authenticated handshake), with the official link and consistent with Q10. |
| F-3 | Process note on a public page: "Which sessions own the other branches — Five sessions wrote to this repository concurrently…". Not an exchange fact; stale. | Coordination belongs in `COORDINATION.md` per the brief. | **Row removed** from the public table. |
| F-4 | "Broker-side cost basis" row named `GET /portfolio/fills` without a link. | Official page: <https://docs.kalshi.com/api-reference/portfolio/get-fills> (fetched 2026-11-22; `GET /portfolio/fills`, fill fields `outcome_side`, `book_side`, `yes_price_dollars`, `no_price_dollars`, `fee_cost`). | Link added. |
| F-5 | Legend tables (`sources.html`, `verification.html`, `summary.html`) contain rows that are status definitions, not sourced values. | Visible in the static parse. | **Not changed.** They define the status vocabulary; no exchange value appears in them. Logged so a reviewer can decide. |

## 4. Not verified here (flagged)

- Runtime rows (placeholders and API-filled rows) were checked by **template inspection and the page-runtime
  harness**, not by a real browser render. The harness does not render layout.
- The live gas re-read is a single open event returned for one series prefix on 2026-11-22; it establishes that
  open gas events exist on the demo today, not a complete count of them.
- The WebSocket handshake from a browser was **not** executed (no authenticated handshake is possible from the
  build sandbox, and the fetch tool cannot set headers). It remains an open question on `questions.html`.

## 5. Checks run on the branch (exact counts)

| Check | Result |
|---|---|
| `node tools/verify/page-runtime-check.mjs` (full) | 18/18 pages ran clean (before edit) |
| `node tools/verify/page-runtime-check.mjs questions.html` (after edit) | 1/1 ran clean |
| `python3 tools/check_site_links.py .` | 36 pages, 0 broken local links |
| `node --test tests/*.test.mjs` | 155/155 pass |
| `python3 -m unittest discover -s tools -p 'test_*.py'` | 42 OK |
| `tools/audit_external_links.py --help` | exit 0 |

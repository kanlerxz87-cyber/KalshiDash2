# KalshiDash2

Live dashboard for the **Kalshi demo** exchange: highest-dollar live events in gas prices, elections,
culture, crypto and golf — tracked until they resolve (yes/no), with a live price-alert stream,
automated simulated trades, demo trading, trade categorization and performance analysis.

> **Two site generations live in this repository, and both are reachable.**
>
> * **root `index.html` + `categories/`, `assets/`, `evidence/`** — the verified rebuild documented
>   below. GitHub Pages source is `main:/`, so this is what
>   <https://kanlerxz87-cyber.github.io/KalshiDash2/> serves. It fixes three defects the
>   `docs/` generation still carries (see `flagged.html` F6–F8).
> * **`docs/`** — the earlier generation, still reachable at `/docs/` because the legacy `main:/`
>   build publishes the whole repository. Its separate deploy workflow
>   (`.github/workflows/pages.yml`) has been manual-only since PR #17 ended the two-deployer race
>   (see `COORDINATION.md`, task P1), so nothing under `docs/` is auto-deployed any more. Nothing
>   in it was deleted or edited by the merge that brought the rebuild in.
>
> `COORDINATION.md` records which session owns what.

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key).
Trading needs your own demo API key, entered in the browser only (or via `scripts/kalshi_client.py`)
— never commit keys. Official docs: https://docs.kalshi.com · demo site: https://demo.kalshi.co

**Repo-side tools:** `scripts/kalshi_client.py` (verified demo API client: markets, orderbook,
candlesticks, balance, positions, fills, guarded order placement; supports RSA + Ed25519;
hard-locked to the demo host), `scripts/analyze_trades.py` (categorize fills by trade
type/topic/direction), `data/trades_template.csv` (header-only template in official Get Fills
field names), `evidence/auth-sign-test.mjs` (6-check signing-rule self-test, no network needed),
`tools/verify/page-runtime-check.mjs` (executes every published page against a DOM shim).

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`,
`COORDINATION.md` (shared task board for parallel sessions).

**Verification rule:** every table row links an official source; values that can't be confirmed
are left blank and flagged on the Flagged for Review page — never inferred. Live values are
fetched in the browser and never transcribed into the repo.

## What it does

- **Overview** — every live event in the five topics, ranked by money traded, open interest or
  contract volume, with the formula for each shown inline, plus the biggest $0.10+ swings in
  the current scan.
- **Live alerts** — two scrolling chats: every contract-price swing of **$0.10 or more in either
  direction**, and a **High-ROI watch** of the moves that pass a transparent rule set (a
  placeholder for a model, not an edge). Swings are detected two ways — against the exchange's own
  `previous_price_dollars` and between two consecutive polls — and every message is labelled with
  the comparison that produced it. A table view of the same events carries one official API link
  per row. Four paper strategies run automatically on the alerts; no orders are placed.
- **Strategy tester** — strategy rules replayed over official one-minute candlesticks. Every
  simulated trade is scored against the market's own `settlement_value_dollars`, with the
  assumptions (no fees, no spread, no slippage) stated above the results. A **chance
  baseline** ("Random entry") enters once at a seeded pseudo-random point in the same window,
  so a rule only shows an edge if it beats that row. The same trades are re-cut into
  **rollups by direction (YES/NO) and by topic**, and both the backtest ledger and the live
  paper book export to CSV. Includes a live paper-trading book driven by the same alert engine
  as the Live alerts page.
- **Category pages** (gas, elections, culture, crypto, golf) — the live board for that topic,
  a price chart with 10s → 7d windows, markers on every ≥$0.10 jump inside the official candle
  series, and order-book depth showing how many contracts rest at each price.
- **Event detail** — every market in an event with prices, sizes, rules and the exchange's
  reported resolution.
- **Resolved** — markets tracked until the API reports `result` as `yes` or `no`, plus a live
  scan of recently settled markets.
- **Portfolio** — demo balance, positions and fills, and V2 order placement with prices snapped
  to each market's own published price grid. The API key stays in the browser tab.
- **Strategies** — fills categorised by topic, side and maker/taker role, plus a catalogue of
  fill-based rules and the six history-based rules the Strategy Tester can already score.
- **Suggestions · Questions · Verification · Flagged** — the decision register: what is proven,
  what is not, what to decide next, and every source link.

## Ground rules this site follows

- No value is inferred. A field the API did not return renders as `n/a`, never as `$0.00`.
- Computed figures name their formula; API figures name the endpoint that produced them.
- A "model" that cannot be measured is labelled as a screen, not an edge.
- Every claim on the **Verification** page links an official Kalshi source, and where possible
  a captured live response committed under `evidence/`.
- Anything unconfirmed is listed on **Flagged for review** with the evidence that would close it.

## Layout

```
index.html                overview board            <- published site root (Pages: main:/)
  summary.html            executive summary
  alerts.html             live alerts: $0.10+ swings, High-ROI watch, paper strategies
  simulator.html          strategy tester (backtest over official candles)
  categories/*.html       one page per topic
  event.html              single-event detail
  resolved.html           resolution tracking
  portfolio.html          demo account + order entry
  strategies.html         trade analysis + strategy catalogue
  suggestions.html        decision board
  questions.html          questions, information, answers
  verification.html       claim register with official sources
  flagged.html            irregularities + unverified items
  assets/js/*.js          client, market data, chart, alerts, simulator, UI (ES modules)
  assets/css/app.css
  evidence/               captured API evidence + signing self-test
reports/                  raw CI captures of the demo API
tools/verify/             auditable verification harness
COORDINATION.md           shared task board for parallel sessions
```

## Running locally

Any static server works; ES modules require HTTP, not `file://`:

```bash
python3 -m http.server 8080
```

## Verification

```bash
node evidence/auth-sign-test.mjs          # 6/6 signing-rule checks
node tools/verify/page-runtime-check.mjs  # every published page executes cleanly + local link check
node --test tests/alerts-core.test.mjs    # alert engine unit tests
node --test tests/simulator-core.test.mjs # simulated-trade engine: baseline, rollups, CSV
(cd tests/dom && npm ci && npm test)      # alerts page + executive summary, end-to-end with fixtures
python3 tools/check_site_links.py .       # local links, anchors and HTML tag balance
python3 -m unittest discover -s tools     # link-checker tests
```

The live-API checks run on GitHub runners, because the build sandbox cannot open TLS to
Kalshi hosts: `verify-alerts` writes `reports/alerts-live-check.md`, and `live-engine-check`
writes `reports/live-engine-check.md`.

See `verification.html` for the full claim register and `flagged.html` for everything
that could not be confirmed.

Demo environment only: funds are mock, and demo prices may not reflect production markets.
Not affiliated with or endorsed by Kalshi.

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
>   in it was deleted or edited by the merge that brought the rebuild in. Since 2026-11-21 its
>   landing page (`docs/index.html`) redirects to the root site (Flagged Y10, mitigated), so
>   visitors no longer land on the defective generation; subpages remain for historical reference.
>
> `COORDINATION.md` records which session owns what.

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key).
Trading needs your own demo API key, entered in the browser only (or via `scripts/kalshi_client.py`)
— never commit keys. Official docs: https://docs.kalshi.com · demo site: https://demo.kalshi.co

**Sources register:** `sources.html` (data in `assets/js/sources.js`, tests in
`tests/sources-page.test.mjs`) lists every official page the site depends on, what each is used for, and how it was
checked — read in full, matched against the official <https://docs.kalshi.com/llms.txt> index, or left unverified
and flagged.

**Official traded-dollar volume:** every category page can sum `GET /markets/trades` for its topic
(Σ `count_fp` × the price of the side the taker bought) — the real dollar figure, beside the volume × price proxy
that the ranking column still uses. Logic in `assets/js/dollar-volume.js`, tests in `tests/dollar-volume.test.mjs`.

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

- **Overview** — every live event in the five topics, ranked by a clearly labelled volume × last YES-price proxy, open interest or
  contract volume, with the formula for each shown inline. The volume-price figure is not actual dollars traded; the dashboard flags this limitation. It also shows the biggest $0.10+ swings in
  the current scan.
- **Live alerts** — two scrolling chats: every contract-price swing of **$0.10 or more in either
  direction**, and a **High-ROI watch** of the moves that pass a transparent rule set (a
  placeholder for a model, not an edge). Swings are detected two ways — against the exchange's own
  `previous_price_dollars` and between two consecutive readings — and every message is labelled with
  the comparison that produced it. A table view of the same events carries one official API link
  per row. Four paper strategies run automatically on the alerts; no orders are placed.
  The feed has two possible sources and the status pill always names the one that is running:
  the Kalshi **WebSocket `ticker` channel** (about one flush per second, reached through
  `scripts/relay.py`) or the REST poll. A browser cannot open a Kalshi socket itself — the
  handshake needs headers a page cannot set — so the relay opens it server-side and republishes
  the frames. Without the relay the page falls back to polling and says so.
- **Strategy tester** — strategy rules replayed over official one-minute candlesticks. Every
  simulated trade is scored against the market's own `settlement_value_dollars`, with YES and NO
  entry prices handled as complements and the assumptions (official-schedule fees modelled; no spread,
  no slippage) stated
  above the results. Includes a reproducible seeded random-control baseline, rollups by topic and
  YES/NO direction, CSV export of the simulated ledger, and a live paper-trading book driven by the
  same alert engine as the Live alerts page. The random baseline is a comparison, not a prediction
  or statistical significance test; historical NO-side results from before the correction are flagged
  on the Flagged for Review page.
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
  sources.html            source register: every official page, its use and how it was checked
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

### With the live WebSocket ticker feed (optional)

The plain static server above gives the REST-polled alerts page. To get the
exchange's own per-second ticker flush instead, run the relay. It needs a
**demo** API key — create one at <https://demo.kalshi.co> (Account & security →
API Keys). The key is never written to disk and never sent to the browser.

```bash
pip install websockets cryptography requests

export KALSHI_KEY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export KALSHI_PRIVATE_KEY_PATH=./kalshi-demo-key.pem

python3 scripts/relay.py --port 8080 --auto-universe
# then open http://localhost:8080/alerts.html
```

The relay serves the site on the same origin and republishes the Kalshi
WebSocket frames to the page as Server-Sent Events on `/live/stream`. Without
it, the page falls back to the REST poll and the status pill says which source
is running.

To watch the raw ticker stream without the site:

```bash
python3 scripts/kalshi_ws.py --ticker KXHIGHNY-26NOV20-T74.5
```

Both scripts are hard-locked to the demo hosts and refuse to talk to production.

## Verification

```bash
node evidence/auth-sign-test.mjs          # 6/6 signing-rule checks
node tools/verify/page-runtime-check.mjs  # every published page executes cleanly + local link check
node --test tests/alerts-core.test.mjs    # alert engine unit tests (18)
node --test tests/live-core.test.mjs      # live-feed field mapping and $0.10 threshold tests (23)
node --test tests/taxonomy.test.mjs       # topic taxonomy + combo classifier (10)
node --test tests/simulator-core.test.mjs # simulator P&L, random baseline, rollup, CSV tests
node --test tests/dollar-volume.test.mjs  # official traded-dollar volume (Get Trades) + incompleteness rules
node --test tests/sources-page.test.mjs   # Sources register: links, checks, no transcribed values
(cd tests/dom && npm ci && node alerts-dom.mjs)   # alerts page end-to-end with fixtures
python3 tools/check_site_links.py .       # local links and anchors in the published site
python3 -m unittest discover -s tools     # link-checker tests
```

The live-API checks run on GitHub runners, because the build sandbox cannot open TLS to
Kalshi hosts: `verify-alerts` writes `reports/alerts-live-check.md`, and `live-engine-check`
writes `reports/live-engine-check.md`.

See `verification.html` for the full claim register and `flagged.html` for everything
that could not be confirmed.

Demo environment only: funds are mock, and demo prices may not reflect production markets.
Not affiliated with or endorsed by Kalshi.

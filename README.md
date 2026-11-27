# KalshiDash2

Live dashboard for the **Kalshi demo** exchange: highest-dollar live events in gas prices, elections,
culture, crypto and golf — tracked until they resolve (`yes` / `no` / `scalar`), with a live price-alert
stream, candle-replay strategy tester, paper trading, guarded demo order entry, trade categorization and
audit registers.

> **Two site generations live in this repository:**
>
> * **Root `index.html` + `categories/`, `assets/`, `evidence/`** — the canonical site served by GitHub Pages
>   (<https://kanlerxz87-cyber.github.io/KalshiDash2/>, source `main:/`, `build_type: legacy`).
> * **`docs/`** — the earlier generation retained for history; `docs/index.html` redirects to the root site,
>   and `.github/workflows/pages.yml` is manual-only (uploading `path: .`, the repository root) so nothing
>   under `docs/` auto-deploys over `main:/`.
>
> [`COORDINATION.md`](COORDINATION.md) coordinates parallel sessions.

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key).
Trading needs your own demo API key, entered in `portfolio.html` (kept in the browser tab) or passed to
`scripts/kalshi_client.py` / `scripts/relay.py` — never commit keys.
Official docs: <https://docs.kalshi.com> · demo site: <https://demo.kalshi.co>.

**Sources & Claims registers:** [`sources.html`](sources.html) (`assets/js/sources.js`, 49 sources verified,
0 unverified) lists every documentation source used; [`verification.html`](verification.html)
(`assets/js/claims.js`, 114 claims: 102 verified, 9 partially verified, 3 unverified) links every technical
claim to an official page or probe; [`flagged.html`](flagged.html) records open defects, design limits, and
verified irregularities (**F1–F20**, **DR1–DR3**, 40 open / 66 mitigated / 106 total).

**Official traded-dollar volume:** every category page can sum `GET /markets/trades` for its topic
(Σ `count_fp` × price of the taker's recorded `taker_outcome_side`), alongside the ranking column's
labelled `volume_fp × last_price_dollars` proxy. Incomplete/untagged trades are counted and excluded, and any
market read failure withholds the topic total (`n/a`). See `assets/js/dollar-volume.js` and `tests/dollar-volume.test.mjs`.

**Repo-side Python & CLI tools:** `scripts/kalshi_client.py` (demo-locked REST client with RSA/Ed25519 signing),
`scripts/relay.py` & `scripts/kalshi_ws.py` (demo-locked WebSocket `ticker` stream & SSE relay),
`scripts/collect.py` (API surface probe writer), `scripts/analyze_trades.py` (fill categorizer),
`data/trades_template.csv`, `evidence/auth-sign-test.mjs` (6 signing checks), and
`tools/verify/page-runtime-check.mjs` (executes all 18 root/category pages against a DOM shim).

**Docs in repo:** [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md), [`QUESTIONS.md`](QUESTIONS.md),
[`SUGGESTIONS.md`](SUGGESTIONS.md), [`VERIFICATION.md`](VERIFICATION.md), [`COORDINATION.md`](COORDINATION.md).

## What it does

- **Overview (`index.html`)** — live events across Gas, Elections, Culture, Crypto, and Golf, ranked by the
  clearly labelled `volume_fp × last_price_dollars` proxy, open interest, or contract volume, plus current ≥$0.10 swings.
- **Live alerts (`alerts.html`)** — scrolling **All alerts** (≥$0.10 swings via `previous_price_dollars` and
  consecutive polls) and rule-screened **High-ROI watch**, with swing permalinks, transcript filtering,
  per-topic mute chips, opt-in watch sound cue, and four browser-local paper strategies. Runs on REST polling
  by default and supports Kalshi's WebSocket `ticker` stream (~1s flush) via optional local same-origin `scripts/relay.py`.
- **Strategy tester (`simulator.html`)** — strategy replay over official 1-minute candlesticks scored against
  `settlement_value_dollars`, modelling official fee-schedule rounding while omitting spread/slippage, with
  seeded random-control baseline, topic/direction rollups, CSV export, and live paper-book integration.
- **Category pages (`categories/{gas,elections,culture,crypto,golf}.html`)** — topic event boards (including
  series `category`, `categories[]`, and `tags[]` taxonomy matching such as `tags: ["Golf"]`), 10s–7d price
  charts marking ≥$0.10 jumps, 6-column bid order books with implied YES asks (`1 − best NO bid`), and
  on-demand `GET /markets/trades` dollar-volume sampling.
- **Event detail (`event.html`) & Resolved (`resolved.html`)** — per-market prices, sizes, settlement status
  (`marketResultState`), rules, and resolution watchlist tracking.
- **Portfolio (`portfolio.html`) & Strategies (`strategies.html`)** — demo balance, positions, fills, V2 order
  entry (`POST /portfolio/events/orders` with `price_ranges[]` grid snapping), and fill breakdown.
- **Summary · Suggestions · Questions · Verification · Sources · Flagged** — requirement coverage, decision
  board (`S1–S17`, `Q1–Q17`), claim audit (`VERIFICATION.md`), source audit, and flagged issues (`F1–F20`).

## Ground rules this site follows

- No value is inferred: missing API fields render as `n/a`, never `$0.00`.
- Computed figures name their formula; API figures link to their endpoint or documentation source.
- Screens and proxies (`High-ROI watch`, `volume_fp × last_price_dollars`) are labelled as filters/proxies, not edge or actual cash turnover.
- Unconfirmed behaviour stays blank or logged on [`flagged.html`](flagged.html).

## Running locally

Any static HTTP server works for REST-polled pages (ES modules require HTTP, not `file://`):

```bash
python3 -m http.server 8080
```

### With the optional live WebSocket ticker relay

To stream Kalshi's `ticker` channel into `alerts.html` via `/live/stream`, supply a demo API key (`demo.kalshi.co`)
to the local relay (both `scripts/relay.py` and `scripts/kalshi_ws.py` are hard-locked to the demo host):

```bash
pip install websockets cryptography requests
export KALSHI_KEY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export KALSHI_PRIVATE_KEY_PATH=./kalshi-demo-key.pem
python3 scripts/relay.py --port 8080 --auto-universe
# open http://localhost:8080/alerts.html
```

## Verification

Full local verification matches `.github/workflows/site-check.yml`:

```bash
node evidence/auth-sign-test.mjs            # 6/6 Web Crypto signing checks
node tools/verify/page-runtime-check.mjs    # 18/18 published pages execute cleanly + 36-page link check
node --test tests/*.test.mjs                # 270/270 Node unit, CI-coverage, requirements-trace, taxonomy, table-shape, alert-engine & simulator tests
(cd tests/dom && npm ci && npm test)        # 55/55 jsdom checks (alerts 26, summary 5, category 24)
python3 -m unittest discover -s tools       # 55/55 link-checker & probe-collector tests
python3 -m unittest discover -s tests       # Python relay/ws/trade-analyzer unit tests
python3 tools/check_site_links.py .         # 36 HTML pages, 0 broken local links or anchors
```

Live API workflows run on GitHub Actions runners (`verify-alerts.yml` → `reports/alerts-live-check.md`,
`verify-facts.yml`, `live-site-render.yml`, `collect.yml`). See [`verification.html`](verification.html),
[`flagged.html`](flagged.html), and [`reports/verify-2f98889c.md`](reports/verify-2f98889c.md).

Demo environment only: funds are mock, and demo prices may differ from production markets.
Not affiliated with or endorsed by Kalshi.

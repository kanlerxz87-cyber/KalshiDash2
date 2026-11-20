# KalshiDash2

Live dashboard for the **Kalshi demo** exchange: highest-dollar events in gas prices, elections,
culture, crypto, and golf — tracked until they resolve (yes/no), with demo trading, trade
categorization, and performance analysis.

> **Two site generations are in this repository, and both are reachable.**
>
> * **root `index.html` + `categories/`, `assets/`, `evidence/`** — the verified rebuild documented
>   below. GitHub Pages source is `main:/`, so this is what
>   <https://kanlerxz87-cyber.github.io/KalshiDash2/> now serves. It fixes three defects the
>   `docs/` generation still carries (see `flagged.html` F6–F8).
> * **`docs/`** — the earlier generation, still built and still deployed to `/docs/`
>   by `.github/workflows/pages.yml`. Nothing in it was deleted or edited by the merge that
>   brought the rebuild in.
>
> `COORDINATION.md` records which session owns what.

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key).
Trading needs your own demo API key, entered in the browser only (or via `scripts/kalshi_client.py`)
— never commit keys. Official docs: https://docs.kalshi.com · demo site: https://demo.kalshi.co

**Repo-side tools:** `scripts/kalshi_client.py` (verified demo API client: markets, orderbook,
candlesticks, balance, positions, fills, guarded order placement; supports RSA + Ed25519;
hard-locked to the demo host), `scripts/analyze_trades.py` (categorize fills by trade
type/topic/direction), `data/trades_template.csv` (header-only template in official Get Fills
field names), `evidence/auth-sign-test.mjs` (6-check signing-rule self-test, no network needed).

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`,
`COORDINATION.md` (shared task board for parallel sessions).

**Verification rule:** every table row links an official source; values that can't be confirmed
are left blank and flagged on the Flagged for Review page — never inferred. Live values are
fetched in the browser and never transcribed into the repo.

## What it does

- **Overview** — every live event in the five topics, ranked by money traded, open interest or
  contract volume, with the formula for each shown inline.
- **Category pages** (gas, elections, culture, crypto, golf) — the live board for that topic,
  a price chart with 10s → 7d windows, and order-book depth showing how many contracts rest
  at each price.
- **Event detail** — every market in an event with prices, sizes, rules and the exchange's
  reported resolution.
- **Resolved** — markets tracked until the API reports `result` as `yes` or `no`, plus a live
  scan of recently settled markets.
- **Portfolio** — demo balance, positions and fills, and V2 order placement with prices snapped
  to each market's own published price grid. The API key stays in the browser tab.
- **Strategies** — fills categorised by topic, side and maker/taker role, plus six strategy
  rules that are marked *untested* until real fills exist to score them.
- **Live alerts** — every swing of $0.10 or more in an open market's last traded price, between polls, in two scrolling feeds: all alerts, and a High-ROI watch that passes a transparent rule set (a placeholder for a model). Four paper strategies run automatically on the alerts; no orders are placed.
- **Suggestions · Questions · Verification · Flagged** — the decision register: what is proven,
  what is not, what to decide next, and every source link.

## Ground rules this site follows

- No value is inferred. A field the API did not return renders as `n/a`, never as `$0.00`.
- Computed figures name their formula; API figures name the endpoint that produced them.
- Every claim on the **Verification** page links an official Kalshi source, and where possible
  a captured live response committed under `evidence/`.
- Anything unconfirmed is listed on **Flagged for review** with the evidence that would close it.

## Layout

```
index.html                overview board            <- published site root (Pages: main:/)
  summary.html            executive summary
  alerts.html             live alerts: $0.10+ swings, High-ROI watch, paper strategies
  categories/*.html       one page per topic
  event.html              single-event detail
  resolved.html           resolution tracking
  portfolio.html          demo account + order entry
  strategies.html         trade analysis + strategy catalogue
  suggestions.html        decision board
  questions.html          questions, information, answers
  verification.html       claim register with official sources
  flagged.html            irregularities + unverified items
  categories/*.html       one page per topic
  assets/js/*.js          client, market data, chart, UI (ES modules)
  assets/css/app.css
  evidence/               captured API evidence + signing self-test
reports/                  raw CI captures of the demo API
COORDINATION.md           shared task board for parallel sessions
```

## Running locally

Any static server works; ES modules require HTTP, not `file://`:

```bash
python3 -m http.server 8080
```

## Verification

```bash
node evidence/auth-sign-test.mjs      # 6/6 signing-rule checks
```

See `verification.html` for the full claim register and `flagged.html` for everything
that could not be confirmed.

Demo environment only: funds are mock, and demo prices may not reflect production markets.
Not affiliated with or endorsed by Kalshi.
Live dashboard for the **Kalshi demo** exchange: highest-dollar events in gas prices, elections, culture, crypto, and golf — tracked until they resolve (yes/no), with demo trading and performance analysis.
Live dashboard for the **Kalshi demo** exchange: highest-dollar events in gas prices, elections, culture, crypto, and golf — tracked until they resolve (yes/no), with demo trading, trade categorization, and performance analysis.

**Site:** GitHub Pages from `docs/` (deployed by `.github/workflows/pages.yml` on push to `main`). Pages: Home + executive summary, Live Dashboard, Categories (subpages per topic: gas, elections, culture, crypto, golf), Portfolio & Trading, Trades & Strategy, Resolved Events, Analysis & Strategies, Suggestions (decision gates — nothing implemented until you pick), Open Questions, Verification (line-by-line), Sources (every official doc used), Flagged for Review (non-blocking).

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key). Trading needs your own demo API key, entered in the browser only (or via `scripts/kalshi_client.py`) — never commit keys. Official docs: https://docs.kalshi.com · demo site: https://demo.kalshi.co

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`, `COORDINATION.md` (shared task board).

**Repo-side tools:** `scripts/kalshi_client.py` (verified demo API client: markets, orderbook, candlesticks, balance, positions, fills, guarded order placement; supports RSA + Ed25519; hard-locked to the demo host), `scripts/analyze_trades.py` (categorize fills by trade type/topic/direction), `data/trades_template.csv` (header-only template in official Get Fills field names).

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`, `COORDINATION.md` (shared task board for parallel sessions).

**Verification rule:** every table row links an official source; values that can't be confirmed are left blank and flagged on the Flagged for Review page — never inferred. Live values are fetched in the browser and never transcribed into the repo.

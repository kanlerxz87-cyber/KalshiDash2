# KalshiDash2

> **Two generations of the site live in this repository.**
>
> * `docs/` — the site built by the first sessions (`4b7b4e2f`, `210dfcb8`). Live dashboard for the **Kalshi demo** exchange: highest-dollar events in gas prices, elections, culture, crypto, and golf — tracked until they resolve (yes/no), with demo trading and performance analysis.
> * **repository root** — the verified rebuild documented below (`index.html`, `categories/`,
>   `assets/`, `evidence/`). It fixes three defects found in `docs/` (see `flagged.html` F6–F8).
>   This is what GitHub Pages serves, because the Pages source is `main:/`.
>
> `COORDINATION.md` records which session owns what. Nothing from the earlier generation was
> deleted by this merge.

A live dashboard for the **Kalshi demo exchange** (`https://external-api.demo.kalshi.co/trade-api/v2`)
covering five topics — gas prices, elections, culture, crypto and golf — tracked from
open through resolution, with a demo portfolio, trade analysis and a decision register.

**Published site:** https://kanlerxz87-cyber.github.io/KalshiDash2/

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

**Site:** GitHub Pages from `docs/` (see `.github/workflows/pages.yml`). Pages: Home/executive summary, Live Dashboard, Portfolio & Trading, Resolved Events, Analysis & Strategies, Suggestions, Open Questions, Verification, Flagged for Review.

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public data, no key). Trading needs your own demo API key, entered in the browser only — never commit keys. Docs: https://docs.kalshi.com

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`, `COORDINATION.md` (shared task board).


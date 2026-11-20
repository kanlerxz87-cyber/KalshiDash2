# KalshiDash2

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
  a captured live response committed under `site/tools/`.
- Anything unconfirmed is listed on **Flagged for review** with the evidence that would close it.

## Layout

```
site/                     the published site (no build step, no dependencies)
  index.html              overview board
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
  assets/js/*.js          client, market data, chart, UI (ES modules)
  assets/css/app.css
  tools/                  captured API evidence + signing self-test
reports/                  raw CI captures of the demo API
COORDINATION.md           shared task board for parallel sessions
```

## Running locally

Any static server works; ES modules require HTTP, not `file://`:

```bash
cd site && python3 -m http.server 8080
```

## Verification

```bash
node site/tools/auth-sign-test.mjs   # 6/6 signing-rule checks
```

See `site/verification.html` for the full claim register and
`site/flagged.html` for everything that could not be confirmed.

Demo environment only: funds are mock, and demo prices may not reflect production markets.
Not affiliated with or endorsed by Kalshi.

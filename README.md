# KalshiDash2

A dashboard for the **Kalshi demo** exchange: the highest dollar-amount live
events in gas prices, elections, culture, crypto and golf, tracked until the
exchange resolves them (yes/no), with demo trading, a trading journal and
performance analysis by strategy.

**Live site:** https://kanlerxz87-cyber.github.io/KalshiDash2/

## How the data works

The site does not depend on your browser being allowed to call Kalshi.

```
GitHub Actions (every 15 min)
  └─ scripts/collect_kalshi.py  →  Kalshi demo REST API
       └─ writes docs/data/*.json  (each file stores the request URL it came from)
            └─ committed to main
                 └─ GitHub Pages serves the static site
                      └─ docs/assets/app.js renders only what those files contain
```

`docs/data/meta.json` is the provenance record: every request, its HTTP status
and its timestamp. If a request fails, the file records the error and the page
shows it. Nothing falls back to a remembered or estimated value.

## What is on the site

| Page | What it answers |
|---|---|
| `index.html` | Executive summary, snapshot freshness, topic → taxonomy mapping |
| `dashboard.html` | Top markets per topic by dollar amount, price chart (60 s → 7 d), order-book depth |
| `resolved.html` | Which markets settled, and how (yes / no), plus the open ones being tracked |
| `portfolio.html` | Demo balance, positions, order entry (V2), orders, fills, local journal |
| `analysis.html` | Trades by strategy / topic / side / time-in-force, win rate, net P&L |
| `suggestions.html` | 10 proposals with evidence, cost, risk and a decision gate |
| `questions.html` | Verified / assumed / unknown / how to settle each open question |
| `verification.html` | Every claim, its official source, and the live check result |
| `flagged.html` | Irregularities and unverifiable items, with evidence links |
| `review.html` | Line-by-line repository review (also in `REPO_REVIEW.md`) |

## Trading

Trading is opt-in and uses **your own demo key**, entered in the browser and
stored in `sessionStorage` only. It is never committed and never sent anywhere
except `external-api.demo.kalshi.co`.

Requirements, from Kalshi's own docs:

- The key must be **RSA** (RSA-PSS / SHA-256). Browsers cannot sign Ed25519.
  See [API keys](https://docs.kalshi.com/getting_started/api_keys).
- Order endpoint is `POST /portfolio/events/orders`
  ([Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2)).
- Never paste a production key into this site. Demo and production credentials
  are separate ([environments](https://docs.kalshi.com/getting_started/api_environments)).

## Running the checks

```bash
python3 scripts/verify_site.py      # broken links, nav drift, data provenance
python3 -m py_compile scripts/collect_kalshi.py
python3 scripts/collect_kalshi.py   # needs network access to *.kalshi.co
```

`verify_site.py` runs in CI before the Pages deploy, so a broken page cannot
publish.

## Documentation

`EXECUTIVE_SUMMARY.md` · `REPO_REVIEW.md` · `QUESTIONS.md` · `SUGGESTIONS.md` ·
`VERIFICATION.md` · `COORDINATION.md` (shared task board for parallel sessions)

## Scope and limits

Demo only — mock funds. The exchange's demo prices may not reflect production.
Known limitations, each with a source and a proposed fix, are listed on the
Flagged page; the short version is: no key in the repo, no Ed25519 in the
browser, no gasoline-specific market category, and chart windows beyond six
hours are shorter than their labels.

Data source: Kalshi demo Trade API · <https://docs.kalshi.com>

# KalshiDash2

Read-only Kalshi market dashboard (demo + production public data), published with GitHub Pages.

- **Live site:** https://kanlerxz87-cyber.github.io/KalshiDash2/
- **Executive summary:** [reports/executive-summary.md](reports/executive-summary.md)
- **Repo review:** [reports/repo-review.md](reports/repo-review.md)
- **Task board / log:** [COORDINATION.md](COORDINATION.md)
- **Flagged for review (on the site):** `site/flagged.html`

## Layout

| Path | What it is |
|------|------------|
| `site/` | Static site (no build step). Pages: home, live dashboard, five topic pages, analysis, portfolio (blocked), suggestions, questions, flagged. |
| `scripts/collect.mjs` | Reads public, unauthenticated Kalshi Trade API GET endpoints and writes `site/data/*.json` (generated, git-ignored). |
| `scripts/check-site.mjs` | Build gate: broken links, JSON validity, every data row has a `source_url`. |
| `.github/workflows/pages.yml` | Hourly + on-push: collect → check → upload Pages artifact; deploy from `main`. |

## Run locally

```bash
node scripts/collect.mjs      # needs network access to Kalshi API hosts
node scripts/check-site.mjs
python3 -m http.server --directory site 8000   # then open http://localhost:8000
```

## Scope and limits

- No orders are placed and no credentials are used. Portfolio and trading need an authenticated demo API key that has not been provided.
- Demo prices may not reflect real markets (per Kalshi's demo documentation).
- Source documentation: https://docs.kalshi.com/welcome

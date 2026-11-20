# KalshiDash2

Live dashboard for the **Kalshi demo** exchange: highest-dollar events in gas prices, elections, culture, crypto, and golf — tracked until they resolve (yes/no), with demo trading, trade categorization, and performance analysis.

**Site:** GitHub Pages from `docs/` (deployed by `.github/workflows/pages.yml` on push to `main`). Pages: Home + executive summary, Live Dashboard, Categories (subpages per topic: gas, elections, culture, crypto, golf), Portfolio & Trading, Trades & Strategy, Resolved Events, Analysis & Strategies, Suggestions (decision gates — nothing implemented until you pick), Open Questions, Verification (line-by-line), Sources (every official doc used), Flagged for Review (non-blocking).

**Data:** `https://external-api.demo.kalshi.co/trade-api/v2` (public market data needs no key). Trading needs your own demo API key, entered in the browser only (or via `scripts/kalshi_client.py`) — never commit keys. Official docs: https://docs.kalshi.com · demo site: https://demo.kalshi.co

**Repo-side tools:** `scripts/kalshi_client.py` (verified demo API client: markets, orderbook, candlesticks, balance, positions, fills, guarded order placement; supports RSA + Ed25519; hard-locked to the demo host), `scripts/analyze_trades.py` (categorize fills by trade type/topic/direction), `data/trades_template.csv` (header-only template in official Get Fills field names).

**Docs in repo:** `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`, `COORDINATION.md` (shared task board for parallel sessions).

**Verification rule:** every table row links an official source; values that can't be confirmed are left blank and flagged on the Flagged for Review page — never inferred. Live values are fetched in the browser and never transcribed into the repo.

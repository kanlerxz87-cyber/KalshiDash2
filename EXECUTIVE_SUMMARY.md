# Executive Summary — KalshiDash2

**Purpose.** Collect, organize, and analyze the highest-dollar live Kalshi **demo** events in five topics — gas prices, elections, culture, crypto, golf — track each until it resolves (yes/no), and trade/analyze performance on the demo account.

**Data source (official).** Kalshi demo REST API `https://external-api.demo.kalshi.co/trade-api/v2` (recommended) and WebSocket `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`; also-supported hosts `https://demo-api.kalshi.co/trade-api/v2` / `wss://demo-api.kalshi.co/trade-api/ws/v2`. Public market data needs no key; trading/portfolio needs a signed API key (RSA-PSS or Ed25519). Demo uses mock funds. Sources: https://docs.kalshi.com/getting_started/quick_start_create_order and https://docs.kalshi.com/getting_started/quick_start_authenticated_requests (checked 2026-11-20).

**What was built.** A static GitHub Pages site in `docs/` (no build step): landing + executive summary, live dashboard (topic ranking by open interest/volume, price chart with seconds/minutes/hours windows, order-book liquidity), portfolio & trading (browser-side RSA-PSS signing, keys never stored in repo), resolved-event tracker (yes/no outcomes), analysis (real fills only — empty state otherwise), suggestions with decision gates, open questions, verification table, and a Flagged for Review page.

**Verification rule.** Every value is either returned live by the demo API in the browser or linked to an official source. Unconfirmable values are blank + flagged. See `VERIFICATION.md` and `docs/flagged.html`.

**Key risks / unknowns.** Browser CORS unverified from sandbox (F1); no demo keys in repo (F2); Ed25519 unsupported in-browser (F3); keyword topic matching is heuristic (F4). See `QUESTIONS.md`.

**Coordination.** `COORDINATION.md` is the shared task board. Session `4b7b4e2f` owns all tasks on branch `arena/4b7b4e2f-kalshidash2`.

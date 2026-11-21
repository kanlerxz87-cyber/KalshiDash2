# Independent current-site audit — session `f468e69b`

**Checked:** 2026-11-21 UTC  
**Initial review base:** `cc9112b974f9957c4ddcacbe606b79e142b7cb4f` (PR #88 merge); the branch was rebased onto `70744d5a802e238f6e0d8742a9abebfc1158dd5a` (PR #89 merge) and then onto `afc2c0bf25e9cd873e7130193303fce8f40ebf30` after PR #92 merged. The current deploy, live-page probe and live-render checks were confirmed after the integration merge.

**Live Pages URL:** <https://kanlerxz87-cyber.github.io/KalshiDash2/>  
**Scope:** current published root site, primary API claims, test suites, Pages configuration and latest deployment checks. This is a fresh cross-check of the current release, not a claim that every historical evidence file was re-captured in this turn; prior line-by-line reports remain linked from `COORDINATION.md` and the Verification page.

## Official-source review

| Area | Official source checked | What it confirms | Audit conclusion |
|---|---|---|---|
| Demo environment | [Kalshi Demo Environment](https://docs.kalshi.com/getting_started/demo_env) | Demo uses mock funds; demo credentials are separate from production; demo prices/behavior may not reflect real markets; recommended REST and WebSocket roots match `assets/js/config.js`; alternate hosts are also listed. | Endpoint configuration matches the official recommendation. The site is clearly demo-only. |
| Candles / chart | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | Candlestick fields include time-bucketed prices; allowed `period_interval` values are 1, 60 and 1440 minutes. | Site's short live chart samples and longer candle chart are appropriately distinguished; no seconds-history claim is made for the API. |
| Liquidity | [Orderbook Responses](https://docs.kalshi.com/getting_started/orderbook_responses) | Public orderbook contains YES and NO bids with price and fixed-point contract counts; asks are implied by the complementary side; order counts per level are not returned. | Rendering resting contract depth per price level is supported; the site should not claim the API returns order-counts or direct ask-side orders. |
| WebSocket ticker | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) | Ticker updates carry `price_dollars`, market ticker and timestamp fields; WebSocket connection requires API key authentication. | Project's signed/relayed WebSocket architecture and its opt-in credential requirement are consistent with the source. Hosted static Pages does not itself run the private relay. |
| Demo orders | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | V2 order route is authenticated and its request requires a market, side, count and price fields. | The portfolio UI correctly cannot show private account data or place an order without the account's demo credentials. No account fills, balance or executed order are claimed in this report. |

## Requirements cross-check

The root product provides overview and separate Gas, Elections, Culture, Crypto and Golf pages; event and resolution views; price charts; orderbook depth; a two-feed alert page; strategy simulation and trade analysis; portfolio/order functionality; source and verification registers; and the prominently labelled Flagged for Review page. `tests/dom/summary-dom.mjs` currently verifies 20 requirement areas and the source/evidence labels in the decision tables.

Important requirements that cannot be honestly described as fully automated in the hosted Pages deployment:

1. **Private demo portfolio and actual order execution:** a user must supply their own API key/private signing key. There are no credentials in the repo or this session, so we did not connect an account, execute orders or assert account performance. This constraint and the browser-only key handling are documented in the site and source-linked to the authenticated order docs.
2. **WebSocket live stream on GitHub Pages:** the ticker is authenticated and requires a relay process. The hosted static page falls back to REST polling; it does not run a persistent relay or claim a WebSocket connection. Live relay setup is optional and cannot be enabled by this audit without credentials/hosting.
3. **“Highest dollar amount” ranking:** the overview explicitly labels volume × last YES price as a proxy, not actual cash turnover. A11 remains open because the current implementation does not calculate windowed executed dollar value from individual trades.
4. **High-ROI:** the secondary feed is a rules-based watch list, not a validated predictive model or demonstrated return. The site labels this distinction.
5. **API reachability in this editing sandbox:** a direct local `live-engine-check` attempt failed with `fetch failed`, consistent with the sandbox's outbound host restriction. This is not treated as a Kalshi outage or a product pass. GitHub-hosted live verification was dispatched against the current `main` SHA instead (see below).

No new factual market values were added. No new requirement row or claim was marked verified solely from local fixtures.

## Verification results

### Local checks on this tree

- `node --test tests/*.test.mjs`: **78/78 passed**.
- `node tests/dom/alerts-dom.mjs`: **19/19 passed**.
- `node tests/dom/summary-dom.mjs`: passed; requirements **20**, claims **78/89 verified**, **8 partial**, **3 unverified**, flags **41 open / 31 mitigated / 72 total**, source/project-labelled rows **28**.
- `node tools/verify/page-runtime-check.mjs`: **17/17 published root pages ran clean**.
- `python3 -m unittest discover -s tools -p 'test_*.py'`: **42 passed**.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: **20 run, 17 passed / 3 skipped** (`cryptography` is unavailable in this local environment; the test suite reports the skips explicitly).
- `python3 tools/check_site_links.py .`: **35 HTML pages checked, zero broken local links**.
- `npm audit --prefix tests/dom --audit-level=moderate`: **zero vulnerabilities**; test harness uses `esbuild@0.25.0`.
- `git diff --check`: passed.

The first attempt to run DOM checks before installing the test dependencies could not resolve `jsdom`; `npm ci --prefix tests/dom` installed the locked test-only dependencies (no tracked lockfile change). The complete suite above was rerun afterwards.

### Live GitHub checks and publication

- Pages API reports **`status: built`**, **legacy** source **`main:/`**, URL <https://kanlerxz87-cyber.github.io/KalshiDash2/>.
- **PR #92** ([audit: independent current-release review](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/92)) merged at `2026-11-21T23:11:40Z`, merge commit [`31e251b`](https://github.com/kanlerxz87-cyber/KalshiDash2/commit/31e251b6b3f280581e523dc777ed4c8d255bbb1a); both PR checks passed.
- Final Pages build after the merge: [run #44960633462](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960633462) **success** at SHA `afc2c0b`; Pages API reports **built**, source `main:/`.
- Post-merge current-site checks: [verify-live-site #44960608485](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960608485), [live-site-render #44960608499](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960608499), [Static site link check #44960608522](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960608522), [verify-alerts #44960608611](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960608611) and [live-engine-check #44960608578](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44960608578) all **success** on SHA `0de03ce` (the merge tree before a generated report-only bot commit).
- Two overlapping Pages builds for `31e251b` and `0de03ce` were **cancelled** by GitHub's priority/concurrency handling; the subsequent Pages build #44960633462 for `afc2c0b` completed successfully and Pages API is now `built`. This was deployment-run contention, not a Jekyll/content failure.
- Live-render runs report a **GitHub Actions Node.js 20 deprecation annotation** for `actions/*@v4`; tests passed. This is runner/tooling maintenance, not a failed site check.

## Irregularities / items retained for review

- Existing [Flagged for Review](https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html) register: **72 entries** (41 open, 31 mitigated at this audit's DOM check). Review at least A11 (dollar-volume proxy), A1/A5 (unvalidated high-ROI filter and paper-trading assumptions), W1–W3 (authenticated relay, ticker limitations), and remaining documented data/API edge cases.
- The live API can't be accessed from the local editor sandbox; local live check failure is explicitly an environment limitation. A fresh GitHub runner successfully rendered the current site against demo data.
- Public GitHub Pages files are not a secure storage location for API keys. The project does not include secrets; the UI's private-account features remain disabled until the user chooses to provide their own demo credentials locally.
- GitHub Actions emitted the Node 20 deprecation warning noted above. Consider a separate, coordinated dependency update once supported action versions are available; no workflow file was changed in this audit.

## Result

The existing root site is published and the local checks and current-commit GitHub Pages/live-render checks pass. The requested features are substantially present. What remains unavailable without credentials or persistent hosting is actual demo-account access and a permanently running WebSocket relay; these are explicitly disclosed rather than simulated. The open review items remain visible on the site. No market numbers or trading results were invented by this audit.

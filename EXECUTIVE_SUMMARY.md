# Executive Summary — KalshiDash2

**As of:** 2026-11-27 (UTC) · synced with `main` across live verification passes in `reports/verify-54220d3d.md` (fee schedule PDF, `Get Market` / `Get Events`, `previous_price_dollars`, `Create Order V2` YES-side quoting `F20`, Golf `series.tags` gap `F19`) and `reports/verify-2f98889c.md` (taxonomy `series.tags` fix, `category.js` 6-column order-book error guard, `event.html` pending resolution alignment, documentation sync).

**Purpose:** a no-build, read-only-by-default dashboard for the Kalshi **demo** exchange. It discovers live events across five topics—gas prices, elections, culture, crypto, and golf—tracks exchange-reported settlement outcomes (`yes`, `no`, `scalar`, or explicit pending state), displays price charts and order-book liquidity, and provides browser-local alert, paper-strategy, and strategy-backtest tooling alongside guarded demo order entry.

## Published site

- **Live Pages:** <https://kanlerxz87-cyber.github.io/KalshiDash2/>
- **Executive summary:** <https://kanlerxz87-cyber.github.io/KalshiDash2/summary.html>
- **Live alerts and paper strategies:** <https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html>
- **Strategy tester (candle replay):** <https://kanlerxz87-cyber.github.io/KalshiDash2/simulator.html>
- **Sources register:** <https://kanlerxz87-cyber.github.io/KalshiDash2/sources.html>
- **Flagged for review:** <https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html>
- GitHub Pages builds from `main:/` (`build_type: legacy`). The earlier `docs/` generation remains only for history and its landing page (`docs/index.html`) redirects to the root site.

## Official demo APIs

The dashboard's configured read base is `https://external-api.demo.kalshi.co/trade-api/v2`; its WebSocket setting is `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (documented alternatives `https://demo-api.kalshi.co/trade-api/v2` and `wss://demo-api.kalshi.co/trade-api/ws/v2`). Public market reads need no key; trading and portfolio endpoints require a user-supplied demo API key entered in the Portfolio page (`portfolio.html`) and kept in that browser tab. No user credentials are in the repository.

Official references: [Demo environment](https://docs.kalshi.com/getting_started/demo_env), [API environments](https://docs.kalshi.com/getting_started/api_environments), [Get Events](https://docs.kalshi.com/api-reference/events/get-events), [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), [Get Event](https://docs.kalshi.com/api-reference/events/get-event), [Get Series](https://docs.kalshi.com/api-reference/market/get-series), [Market lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [Market settlement](https://docs.kalshi.com/getting_started/market_settlement).

## What is implemented

- **Exchange health (`index.html`, `assets/js/exchange-status.js`):** the environment strip reports the default index (0) from the top-level flags **and** prints the exchange's own per-shard breakdown (`exchange_index_statuses`) as a dated table — one row per shard, with a `false` on a shard that was already confirmed trading labelled *re-read required* rather than a halt, an absent breakdown stated as the schema documents it, unusable entries skipped and counted, and any shard-0 row that disagrees with the top-level flags shown as a disagreement. The official shard-assignment table is quoted alongside it, with each row this project has exercised on the live demo exchange dated (Flagged `F18`, mitigated).
- **Overview and topic pages (`index.html`, `categories/*.html`):** live event discovery for gas, elections, culture, crypto, and golf using series `category`/`categories[]`/`tags[]` (`tagPatterns: [/^Golf$/i]` classifies series such as `KXDPWORLDTOURR2LEAD`) and explicit pattern rules; ranking controls using a clearly labelled `volume_fp × last_price_dollars` proxy alongside contract volume and open interest (`A11` mitigated by on-demand `GET /markets/trades` calculation).
- **Dollars actually traded (official):** every category page sums `GET /markets/trades` (`count_fp` × price of the taker's recorded `taker_outcome_side`), states the requested window and observed `created_time` span, counts excluded untagged trades, and withholds the headline total (`n/a`) if any market's pages fail (`tests/dollar-volume.test.mjs`).
- **Charts, order book, and event detail (`categories/*.html`, `event.html`):** short live-sampled charts (10s–5m) and official candlestick charts (15m–7d) marking ≥$0.10 candle-close jumps; 6-column resting bid order books deriving implied YES asks (`1 − best NO bid`); and event detail tables aligning `#ev-markets` and `#ev-resolution` via `marketResultState()` (`yes` / `no` / `scalar` / `unresolved` / `awaiting result`).
- **Live alerts (`alerts.html`) & WebSocket relay (`scripts/relay.py`):** compares `last_price_dollars` across consecutive readings and against `previous_price_dollars` for ≥$0.10 swings in either direction, includes swing permalinks (`#swing=<id>`), transcript search, per-topic mute chips, opt-in watch sound cue (`S15`/`S16`), a rule-based **High-ROI watch** filter (a transparent tradeability filter, not predicted ROI), and four automatic browser-local paper strategies. Supports an optional same-origin SSE relay (`scripts/relay.py`) over Kalshi's `ticker` channel (1s coalesced flush; server-side signing flagged `W1–W4`); falls back to 15s REST polling when no relay runs.
- **Strategy tester (`simulator.html`):** replays strategy rules over official 1-minute candlesticks scored against `settlement_value_dollars`, modelling official fee-schedule rounding (`kalshi.com/docs/kalshi-fee-schedule.pdf`, `Fee Rounding`) while omitting spread and slippage (`F15`), with a seeded random-control baseline, topic/direction breakdowns, and CSV export (`tests/simulator-core.test.mjs`).
- **Portfolio and demo trading (`portfolio.html`, `strategies.html`):** client-side Web Crypto RSA-PSS / Ed25519 request signing (`evidence/auth-sign-test.mjs`), `Create Order V2` (`POST /portfolio/events/orders`) with `price_ranges[]` snapping and explicit YES-side request quoting (`F20`), plus fill/position categorization by topic, side, and maker/taker role.
- **Decision and audit registers (`summary.html`, `suggestions.html`, `questions.html`, `verification.html`, `sources.html`, `flagged.html`):** 20 requirement areas + 17/17 requirement-traceability rows (`assets/js/trace.js`), 116 claims (`105` verified, `8` partially verified, `3` unverified), 49 audited documentation sources (**49 verified, 0 unverified** after retiring the fee-schedule PDF), and Flagged items **F1–F20** and **DR1–DR4** (**38 open, 69 closed — 30 mitigated, 38 fixed, 1 corrected, 107 total**) plus historical cross-references.

## Key coverage boundaries and limitations

- REST scans cover a bounded prefix of open events (`12` pages of `200`, top `30` open markets per topic by proxy); markets outside that window or moves reversing between polls can be missed (`F16`, `A2`, `A3`).
- Event `settlement_sources` identify where the underlying benchmark is published—never the verified cause of a price move (`F14`, `A4`).
- No real demo order has been placed end-to-end without an owner key (`F1`, `Q8`), and direct unassisted browser WebSocket authentication cannot send custom handshake headers (`F10`, `W4`).
- Public unauthenticated rate budgets are not published numerically (`F3`, re-read 2026-11-27: the Rate Limits page publishes the token model, bucket sizes and headers for authenticated tiers, and the `429` body shape, but no number for unauthenticated callers); the dashboard polls conservatively and surfaces `429` responses.

## Local verification snapshot (2026-11-27 22:4xZ UTC, session `8299bffe`)

Re-verified on branch `arena/8299bffe-kalshidash2`, rebased onto `main` @ `bd464b8` and carrying this session's
F18 work. The independent re-fetch of 20 official doc claims made by session `46f45a35` is recorded in
[`reports/verify-46f45a35.md`](reports/verify-46f45a35.md); the live-API round for this snapshot is
[`reports/verify-8299bffe.md`](reports/verify-8299bffe.md).

- **Node unit & static suites (`node --test tests/*.test.mjs`):** **281/281 passed** (including the `alert-engine-dedupe` and `live-engine-report-consistency` guards added in this round).
- **jsdom DOM suites:** alerts **26/26**, category **24/24**, summary **all pass** (105/116 verified · 8 partial · 3 unverified; 38 open / 69 mitigated / 107 total — recounted from `flagged.html` and `assets/js/claims.js` on this tree).
- **Python unit tests:** `tools` **55/55** passed; `tests` OK (**4** network-gated skips without `cryptography` — CI installs it).
- **Site link, signing & runtime checks:** `tools/check_site_links.py` — **36** HTML pages, **0** broken links; `evidence/auth-sign-test.mjs` — **6/6**; `tools/verify/page-runtime-check.mjs` — **18/18** pages executed cleanly, `0` errors.
- **Live verification with dated sources:** [`reports/verify-8299bffe.md`](reports/verify-8299bffe.md) records 12 checks against official `.md` pages and **live demo responses fetched from this session's sandbox** — the first round able to read the exchange directly. It closes `A9`'s two open questions (the Get Markets OpenAPI enum has five status values including `paused`; `GET /markets?status=paused` returns `200` with a market at `status: "inactive"`, confirming the `paused` → `inactive` mapping on the live host) and records that Get Markets' prose still contradicts its own enum.
- **Verification logs & workflows:** CI gate `.github/workflows/site-check.yml`, live API probe [`reports/alerts-live-check.md`](reports/alerts-live-check.md), and the session reports above.

Demo only: funds are simulated, and demo prices may differ from production. KalshiDash2 is not affiliated with or endorsed by Kalshi.

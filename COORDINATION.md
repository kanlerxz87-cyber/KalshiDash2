# COORDINATION.md — shared task board

Status values: `unclaimed` · `in progress` · `done` · `needs review`
(`needs review` items appear on the Flagged for Review page and do not block anything.)

## Operating note (this session)

The platform runs each session on one branch. Here that branch is `arena/9a4750fd-kalshidash2` (base `6081bb7`, `main`). Separate `session-<id>/<task>` branches are not used, because this session works only on its own branch. One session holds every task below, so it also acts as the integration session. All merges to `main` go through a single PR from this branch.

## Task board

| Task | Status | Owner (session) | Branch | Files in scope | Notes |
|---|---|---|---|---|---|
| T1 Repo review (line-by-line, sources, flags) | done | arena/9a4750fd (this session) | arena/9a4750fd-kalshidash2 | README.md, COORDINATION.md, data/snapshot.json (F-20, F-21) | Flags published on Flagged for Review. |
| T2 Executive summary | done | arena/9a4750fd | arena/9a4750fd-kalshidash2 | site/index.html via build.js | On the landing page. |
| T3 Data snapshot (5 topics, every row sourced) | done | arena/9a4750fd | arena/9a4750fd-kalshidash2 | data/snapshot.json | 21 series, 9 markets, 8 reference prices, 21 flags. Sample only (see below). |
| T4 Static site + category subpages | done | arena/9a4750fd | arena/9a4750fd-kalshidash2 | build.js, index.html, pages/*.html, assets/* | Built from snapshot.json. |
| T5 Live dashboard (client-side Kalshi API) | done (code); browser test pending, see F-18 | arena/9a4750fd | arena/9a4750fd-kalshidash2 | live.html, assets/live.js | Browser CORS unverified (F-18). |
| T6 Portfolio & trade execution | **blocked** (no demo key) | arena/9a4750fd | arena/9a4750fd-kalshidash2 | pages/portfolio.html | No demo API key available in sandbox. No trades placed (F-19). |
| T7 Analysis, questions, suggestions | done | arena/9a4750fd | arena/9a4750fd-kalshidash2 | pages/analysis.html, pages/questions.html, pages/suggestions.html | Suggestions are proposals only. Nothing implemented without your choice. |
| T8 Integration: link check, build, PR, merge, Pages verify | in progress | arena/9a4750fd | arena/9a4750fd-kalshidash2 | scripts/check.js | Runs last. |

## Sources used (official)

Kalshi API docs and live API responses, EIA tables, and the Kalshi contract terms PDF. Full list with links is on the Sources page. Summary:

- Kalshi docs: https://docs.kalshi.com/welcome · https://docs.kalshi.com/llms.txt · https://docs.kalshi.com/getting_started/api_environments · https://docs.kalshi.com/getting_started/demo_env · https://docs.kalshi.com/getting_started/api_keys · https://docs.kalshi.com/getting_started/rate_limits · https://docs.kalshi.com/getting_started/orderbook_responses · https://docs.kalshi.com/api-reference/market/get-markets · https://docs.kalshi.com/api-reference/market/get-market · https://docs.kalshi.com/api-reference/market/get-market-candlesticks · https://docs.kalshi.com/api-reference/market/get-series-list · https://docs.kalshi.com/api-reference/events/get-events
- Kalshi API responses (captured 2026-11-20): see `data/snapshot.json`, each row's `source_url`.
- Kalshi contract terms: https://assets.kalshi.com/contract_terms/DIESEL.pdf
- EIA: https://www.eia.gov/petroleum/prices/table.php?show_by=12_series&period=D&table_key=PET_PRI_SPT_S1_D · https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm

## Verification performed

- Endpoint paths and parameters were checked against the Kalshi docs pages above.
- Every snapshot row was copied from a response captured by the fetch tool on 2026-11-20. Each row's `source_url` is the exact URL that returned it.
- The sandbox cannot reach Kalshi or EIA directly, so nothing was re-fetched with curl. Values are as captured, and may have changed since.
- Blank cells are left blank on purpose wherever a value could not be confirmed (for example bid/ask on finalized markets).

## Sample scope

The snapshot is a sample, not a full dump. The live dashboard covers all open markets in the chosen categories, subject to the browser's ability to reach the API.

## Irregularities flagged (summary)

See the Flagged for Review page for full text and links. Headlines: diesel contract names a different EIA table than the API lists (F-02); no open diesel markets returned (F-01); a placeholder-looking election title (F-05); culture settlement sources containing placeholder text (F-08); golf quotes with zero trades (F-13); the only settlement source for one golf series is a participant's own channel (F-15); the API's status values do not match the documented filter names (F-16); no dollar-volume field exists (F-17).

## Log

- 2026-11-20 — Session `arena/9a4750fd` claimed T1–T8 and pushed the claim with the first sourced snapshot (commit `0e1173c`).
- 2026-11-20 — Built the site (`scripts/build.js`), live dashboard (`assets/live.js`), and checks (`scripts/check.js`). `node scripts/check.js` passes (280 internal links, 21 series, 9 markets, 8 reference prices, 21 flags, each with an allow-listed source URL).
- Browser testing: no browser is installed in the sandbox. The live dashboard has not been run in a browser. Its CORS behavior from GitHub Pages is unverified (F-18).
- Handoffs / conflicts: none. This session created `COORDINATION.md` on an empty repo (README only).
- Blocked: T6 portfolio. Needs a demo API key from you. No trades were placed.

## PR and merge

PR: https://github.com/kanlerxz87-cyber/KalshiDash2/pull/7 (`arena/9a4750fd-kalshidash2` → `main`). Merge result and Pages deploy status are recorded in the PR thread after the merge (the merge commit cannot record its own result).

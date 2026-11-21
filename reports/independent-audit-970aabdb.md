# Independent audit — session `970aabdb` (2026-11-21)

**Scope:** independent, line-by-line read of the published (root) site and repo, plus the full
local verification suite, on branch `arena/970aabdb-kalshidash2` at base `bbdc3a0`
(`chore(data): refresh Kalshi demo snapshot [skip ci]`, 2026-11-21T19:29:03Z), rebased onto
`main` at `b254e21` before merge (PR #63/#65 landed mid-session). No shared file was
edited except one claimed table cell in `simulator.html` (see D1). Parallel sessions `0d6f4f1f`,
`f2176447` and `9543cf0d` were active at audit time; their scopes were not touched.

**Network limit (unchanged from every prior session):** the sandbox shell has no route to
kalshi.co / docs.kalshi.com (all such requests return `000`). Live API verification therefore
happens client-side in the browser and on GitHub-hosted runners; documentation pages in this audit
were read with the `fetch_page` tool, which is how prior sessions verified them. Raw live-API
values are never transcribed into the repo.

---

## A1 — local verification suite, exact results

| Check | Command | Result |
|---|---|---|
| Node unit tests | `node --test` | **73 pass / 0 fail after rebase onto `main@b254e21`** (at claim time on `bbdc3a0`: 72/1 — the failure was the R1 snapshot-label drift, since fixed on `main` by PR #63) |
| Python tool tests | `python3 -m unittest discover -s tools -p 'test_*.py'` | **28 pass / 0 fail after rebase** (at claim time: 27/1, same R1 drift, fixed by PR #63) |
| Python WS tests | `python3 -m unittest discover -s tests -p 'test_*.py'` | **18 pass, 3 skipped** (`cryptography` not installed in this sandbox) |
| Static link check | `python3 tools/check_site_links.py .` | **PASS — 34 HTML pages, 0 broken local links** |
| Page runtime check | `node tools/verify/page-runtime-check.mjs` | **17/17 pages clean**, 34 links |
| Alerts DOM | `npm test` in `tests/dom` | **16/16 pass** |
| Summary DOM | `node tests/dom/summary-dom.mjs` | **PASS** — 20 requirement areas; 78/89 claims verified, 8 partial, 3 unverified; 32 open / 23 mitigated / 55 flags; 28 sourced rows |
| npm audit | `npm audit` in `tests/dom` | **0 vulnerabilities** |
| Secret scan | repo-wide grep for PEM/private-key material | **No committed keys.** Only code that *parses* user-entered keys (`assets/js/kalshi.js`, `docs/assets/app.js`), runtime key generation in the signing self-test, and the placeholder textarea in `portfolio.html` |
| Tracked junk | `git ls-files` | No `*.pyc`, no `node_modules` (123 files, 34 HTML pages) |

**The two failing tests seen at claim time were one defect — the R1 snapshot-label drift — and
were not fixed here.** `scripts/collect.py` derivation notes and `data/snapshot.json`
`_meta.derivation_notes` had lost the two phrases both guards require when the snapshot was
regenerated (`bbdc3a0`, 2026-11-21T19:29Z). Session `0d6f4f1f` claimed R1 and fixed it (PR #63,
merged 2026-11-21T~20:2xZ, commit `f25ecd7`, merge `882e074`); this branch was rebased onto that
`main` (`b254e21`) and **every suite now passes** (73/73 Node, 28/28 tools, rest unchanged).
`f2176447` also repaired the same wording on their branch independently.

## A2 — line-by-line review of the published site

### Verified against official sources in this session

| What | How | Result |
|---|---|---|
| Documentation index exists and is current | `fetch_page https://docs.kalshi.com/llms.txt` | Reachable; lists `api-reference/market/get-market-candlesticks` as "Valid values: 1 (1 minute), 60 (1 hour), 1440 (1 day)" — matches the site's candle claims |
| `Get Markets` page and schema | `fetch_page https://docs.kalshi.com/api-reference/market/get-markets` | 200; documented response fields match the site's usage (`last_price_dollars`, `previous_price_dollars`, `volume_fp`, `volume_24h_fp`, `open_interest_fp`, `result`, `status`) |
| WebSocket `ticker` schema | `fetch_page https://docs.kalshi.com/websockets/market-ticker` | `price_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `volume_fp`, `open_interest_fp`, `ts_ms` confirmed; **no** `previous_price_dollars` — matches the site's W2 wording; authentication required at handshake confirmed |
| Demo environment status | GitHub Pages API `repos/…/pages` | `source: {branch: main, path: /}`, `status: built` at audit start; `building` later in the session (a re-build triggered by the 19:29Z snapshot refresh on `main`) |
| Published pages serve with expected content | `fetch_page` on `/`, `/alerts.html`, `/categories/crypto.html`, `/simulator.html`, `/verification.html` | All return 200 with their documented titles and content (the root pages are static shells; live data loads client-side from the demo API as designed) |
| Live API data is fresh | `data/snapshot.json` `_meta.generated_at` | `2026-11-21T19:29:02+00:00`, 208 API calls, zero errors, collection caps recorded (`max_events_per_series: 10`, trade sample ≤ 3×1000 rows) — consistent with `_meta` and `collection_scope` |

### Findings

| # | Finding | Disposition |
|---|---|---|
| **D1** | `simulator.html` "Where each number comes from" table said **"Fee schedule (not applied in the simulation)"** — stale since session `bc079e84` (BC2) added official-schedule fees to the simulated trades. The page's own assumptions block and scoreboard note both state fees ARE modelled (round-up taker fee on entry and on round-trip exits; no settlement fee); the ledger carries per-trade fee columns. | **Fixed in this session** (one table cell, plus fee-rounding link and the formula; see commit). Verified: `node --test` unchanged (no assertion on the string), page-runtime 17/17, static links 34/0. |
| **D2** | `flagged.html` **F10 — "WebSocket streaming is documented but not wired in" (tag `open`)** is stale: PR #55 (merged 2026-11-21T06:33Z as `arena/1607f1f9-kalshidash2`) wired the WS `ticker` feed via `scripts/relay.py` with REST fallback, and the same page's **W1** flag documents the residual gap (opt-in, relay required, key never leaves the tab). Leaving F10 as `open` contradicts the site's own README, alerts page and verification register. | **Not edited here** — `flagged.html` is in PR #60's open scope (`A9` status mapping + `W4` disclosure) and its DOM counts (32 open / 23 mitigated / 55) are asserted by `tests/dom/summary-dom.mjs`. Logged as a request below for the PR #60 owner or the integration session: mark F10 `mitigated (superseded by W1; see PR #55)`, or fold it into W1, and update the DOM counts to match. |
| **D3** | R1 snapshot-label drift on `main` (two failing guard tests at audit start). | Fixed on `main` by PR #63 (session `0d6f4f1f`) during this session; branch rebased onto it; suite green here. Independently fixed on `f2176447`'s branch too. |
| **D4** | PR **#60** (`9543cf0d`) is `CONFLICTING` with `main` at audit time, and `live-site-render` had not completed successfully on `main` (session `df4e0876` recorded this; `f2176447` took over I2 and reports the live-render check green on their branch, run `44945820999`). | Not this session's scope. Recorded as context for whoever completes the final integration. |

### Observations (no action taken, logged for the register owners)

- **O1.** `assets/js/config.js` topic notes carry historical scan counts as evidence ("740 of
  1,000 live events scanned" Elections; "only 2 live events in the demo scan" Crypto; "0
  gas-price events in the open-event scan" in `claims.js`). They are labelled as scans, not as
  live guarantees, but an undated "Live: …" reads as current. Suggest dating every scan-bound
  sentence, e.g. "Live: 740 of 1,000 scanned events (2026-11-20)". Register owners (`claims.js`,
  `config.js`) not edited here.
- **O2.** `QUESTIONS.md` / `SUGGESTIONS.md` still list Q3 (WebSocket wanted?) and S1/S3 as open
  decision gates even though PR #55 shipped an opt-in WS feed. The registers are decision
  documents; updating them is an editorial decision for their owner, not an audit fix. `questions.html`
  is in PR #60's scope anyway.
- **O3.** `docs/` legacy generation is still reachable at `/docs/` by design (README documents it;
  `docs/index.html` redirects to the root site since Y10). Fine as-is.
- **O4.** `reports/verify-facts-v4.md` and friends are point-in-time captures; they are labelled as
  such in the board and were not re-captured here.

### Suggestions (audit perspective — the brief asks for these; none are implemented here)

- **G1.** Add a tiny "session staleness" badge to the pages that quote scan counts, fed by the
  snapshot's `_meta.generated_at`, so historical evidence can never read as current.
- **G2.** Add the relay/WS runbook link (`scripts/relay.py`) to the alerts page's "Live source"
  definition, so an operator can reproduce the WS path without reading the repo.
- **G3.** A GitHub-hosted nightly `live-site-render` on `main` with the (now fixed) 429-retry
  harness, so demo-API burst throttling can no longer produce spurious red runs.
- **G4.** `flagged.html` F10/W1 deduplication (see D2).

## A3 — PR, merge, Pages confirmation

Recorded in `COORDINATION.md` (this session's section) after the PR is merged: PR number, merge
commit, Pages API `status`, `pages build and deployment` run id, `Static site link check` run id,
and the state of the two R1-owned tests on the branch at merge time.

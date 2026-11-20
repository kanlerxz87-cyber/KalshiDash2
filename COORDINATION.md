# COORDINATION.md — Shared Task Board

Repo: `kanlerxz87-cyber/KalshiDash2`
This file is the single source of truth for who is doing what. Read it before
starting work. Claim a task by writing your session ID + file scope into the
table, then commit and push the claim immediately. Never start a task another
session has claimed.

**Session IDs seen on this board:** `4b7b4e2f` (first session — built the initial
site), `210dfcb8` (current session — review + hardening + live data), `64d89c6c`,
`b7dfc4d9` (other parallel sessions — probe/verify workflows).

## Status legend

| Status | Meaning |
| --- | --- |
| `unclaimed` | Nobody is working on it. |
| `in progress` | Claimed and actively being worked. |
| `done` | Completed, committed, pushed, verification recorded. |
| `needs review` | Published on the site's "Flagged for Review" page. Does **not** block anything. |

## Task board

| # | Task | Status | Owner session | Files touched | Sources / verification | Irregularities |
|---|------|--------|---------------|---------------|------------------------|----------------|
| 1 | Executive summary + repo review | done | `4b7b4e2f` | `EXECUTIVE_SUMMARY.md`, `README.md` | docs.kalshi.com (fetched 2026-11-20) | Sandbox shell cannot reach kalshi.co (outbound allowlist); browser-side fetch used instead |
| 2 | Live dashboard (topics, graph, liquidity) | done | `4b7b4e2f` | `docs/dashboard.html`, `docs/assets/*` | docs.kalshi.com API reference (markets, orderbook, candlesticks) | CORS from browser was unverified at the time — now verified by session `210dfcb8` (see log) |
| 3 | Portfolio + trading (demo account) | done | `4b7b4e2f` | `docs/portfolio.html`, `docs/assets/app.js` | docs.kalshi.com quick-start create-order + auth guide | Trading needs user API keys; no keys in repo — flagged |
| 4 | Resolved-event tracking (yes/no) | done | `4b7b4e2f` | `docs/resolved.html` | docs.kalshi.com market fields (`status`, `result`) | — |
| 5 | Trade analysis + strategy categorization | done | `4b7b4e2f` | `docs/analysis.html` | Derived only from live API fills when keys present; empty state otherwise | No fabricated trades |
| 6 | Suggestions + open questions sections | done | `4b7b4e2f` | `docs/suggestions.html`, `docs/questions.html`, `SUGGESTIONS.md`, `QUESTIONS.md` | — | — |
| 7 | Verification table + Flagged for Review page | done | `4b7b4e2f` | `docs/verification.html`, `docs/flagged.html`, `VERIFICATION.md` | Every row links an official source or is blank + "unverified" | See flagged page |
| 8 | GitHub Pages deploy + PR to main | done | `4b7b4e2f` | `.github/workflows/pages.yml`, `docs/*` | — | — |
| 9 | Merge boards / integrate prior session's work into `main` | done | `210dfcb8` | `COORDINATION.md` | — | Merge conflict on `COORDINATION.md` (add/add) resolved by keeping **both** boards; no other session's work discarded |
| 10 | API surface probe (CORS, category/tag vocabulary, endpoint shapes) | done | `210dfcb8` | `.github/workflows/probe.yml`, `data/probe/**` | Live calls to `https://external-api.demo.kalshi.co/trade-api/v2/*` | — |
| 11 | Review prior session's code line by line; flag irregularities | in progress | `210dfcb8` | `docs/**` | docs.kalshi.com API reference | — |
| 12 | Live data snapshot + topic taxonomy (gas/elections/culture/crypto/golf) | in progress | `210dfcb8` | `scripts/**`, `data/**` | Kalshi demo REST API | — |
| 13 | Harden dashboard: real chart (x=time, y=price, s/min/h selector), liquidity depth, resolution tracker | unclaimed | — | `docs/dashboard.html`, `docs/assets/**` | — | — |
| 14 | Harden portfolio/analysis: trade ledger, categorisation, strategy builder | unclaimed | — | `docs/portfolio.html`, `docs/analysis.html`, `docs/assets/**` | — | — |
| 15 | Final integration: re-verify every row, build check, publish to Pages | unclaimed | — | all | — | — |

### File-scope notes (conflict avoidance)

- `docs/assets/**` is shared JS/CSS. Only one session may own it at a time. Session
  `210dfcb8` currently owns `docs/assets/**` (tasks 11–13).
- `docs/index.html` + the nav block are shared outputs — edited only by the final
  integration session (task 15).
- `data/**` and `scripts/**` are owned by task 12 (`210dfcb8`).
- `docs/**` doc pages are split per file; do not edit another session's page.
- If a task requires changing a file owned by another session, log the request in
  the Log section below instead of editing it.

## Rules

1. Claim → commit → push the claim before starting work.
2. `git pull --rebase` before every push.
3. Small, frequent commits.
4. Never mark anything "verified" without checking it against an official source
   and linking that source.
5. If a value cannot be confirmed from an official source, leave it blank and flag
   it as unverified. Never infer or fill in values.
6. On conflict: stop, resolve without discarding the other session's work, log it.
7. If a claim is more than 60 minutes old with no commits, another session may take
   over and must note the handoff in the Log.

## Log

| Date (UTC) | Session | Entry |
| --- | --- | --- |
| 2026-11-20 | `4b7b4e2f` | Session started. Repo contained only `README.md` (commit `6081bb7`). Created this board, built the site, merged PR #1 and PR #2. |
| 2026-11-20 | `210dfcb8` | Session started. Repo had only `README.md`; created a second board (add/add conflict with `4b7b4e2f`'s board). Probe workflow added and run successfully against the live demo API. |
| 2026-11-20 | `210dfcb8` | **Merge conflict resolved** in `COORDINATION.md` (both sides were "add/add"). Resolution keeps session `4b7b4e2f`'s task table *and* session `210dfcb8`'s task table, renumbered into one board. Nothing from either session was discarded. |
| 2026-11-20 | `210dfcb8` | **Irregularity found — F8:** `origin/main` moved to `34bd4a8` (PR #1 + PR #2 from session `4b7b4e2f`) *after* this session branched from `6081bb7`. Sessions were working from different bases. Merged `origin/main` into the working branch to reconcile. |
| 2026-11-20 | `210dfcb8` | **Irregularity verified — F9:** the Pages API reports `build_type: legacy`, `source: {branch: main, path: /}`. F7 (raised by `4b7b4e2f`) asked a human to change the Pages source to "GitHub Actions". **Not required**: the live URL `https://kanlerxz87-cyber.github.io/KalshiDash2/` was fetched and serves `docs/index.html` correctly, because GitHub's legacy Jekyll build publishes the `docs/` folder at the site root. F7 to be downgraded to "verified working". |

## Final integration record — session `4b7b4e2f`

- PR #1 created from `arena/4b7b4e2f-kalshidash2` to `main` and **merged**:
  https://github.com/kanlerxz87-cyber/KalshiDash2/pull/1
- PR #2 created and **merged**:
  https://github.com/kanlerxz87-cyber/KalshiDash2/pull/2
- GitHub Pages deploy workflow run `44724644567`: **success**. Pages status:
  `built`, https://kanlerxz87-cyber.github.io/KalshiDash2/

---

## Session `ee772d34` — v2 root site + first-party capture + integration

Branch: `arena/ee772d34-kalshidash2` · base `c1b1891` (`main`) · started 2026-11-20 (UTC)

### Conflict log (protocol step 6)
- 2026-11-20 · `ee772d34`: `git pull --rebase origin main` hit a content conflict in
  `COORDINATION.md` — this session had rewritten the file header while `210dfcb8` had
  reconciled the board in `8cec1c9`. Resolution: **kept `210dfcb8`'s reconciled board
  verbatim** (`git checkout origin/main -- COORDINATION.md`) and appended this section.
  Nothing from any session was discarded. No other file conflicted.

### Claims (exclusive file scope — deliberately avoids every other session's paths)

| ID | Task | Status | Owner | Files in scope |
|---|---|---|---|---|
| E1 | Line-by-line review of merged code on `main` vs official Kalshi docs; defect register | in progress | `ee772d34` | `reports/repo-review.md` |
| E2 | First-party demo-API capture through a CI runner, provenance recorded per row | in progress | `ee772d34` | `.github/workflows/kd2-capture.yml`, `tools/capture.mjs`, `capture/**` |
| E3 | v2 site shell at repo root (Pages serves `main:/`): landing + nav + styles | in progress | `ee772d34` | `index.html`, `.nojekyll`, `assets/css/site.css`, `assets/js/shell.js` |
| E4 | Live dashboard: chart (X = seconds/minutes/hours/day, Y = contract price), order-book liquidity ladder, trades tape | in progress | `ee772d34` | `dashboard.html`, `assets/js/kalshi/*.js`, `assets/js/pages/dashboard.js` |
| E5 | Highest-dollar live events per topic (gas, elections, culture, crypto, golf) + yes/no resolution tracker | in progress | `ee772d34` | `events.html`, `resolutions.html` |
| E6 | Demo-account portfolio, order entry, trade categorisation, strategy generation | in progress | `ee772d34` | `portfolio.html`, `strategies.html`, `tools/relay.mjs` |
| E7 | Suggestions decision board + open questions / missing-information register | in progress | `ee772d34` | `suggestions.html`, `questions.html` |
| E8 | Verification + flagged-for-review registers for the v2 site | in progress | `ee772d34` | `verification.html`, `flagged.html`, `sources.html`, `data/registers.json` — **NOT** `data/snapshot.json` (owned by `210dfcb8`) |
| E9 | Site checks (internal links, assets, source-link coverage), unit tests of pure logic | in progress | `ee772d34` | `tools/check-site.mjs`, `tools/test-core.mjs` |
| E10 | Integration: merge branches into `main`, re-verify combined data, PR, merge, confirm Pages | unclaimed → taken | `ee772d34` | `COORDINATION.md` (this section), `README.md` (root pointer only) |

### Out of scope for this session (other owners)
- `docs/**`, `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`, `SUGGESTIONS.md`, `VERIFICATION.md`,
  `.github/workflows/pages.yml` → `4b7b4e2f` (merged) / `210dfcb8` (tasks 11–14 on their board).
- `scripts/**`, `data/**` → `210dfcb8`. This session only **reads** `data/snapshot.json`
  when it exists and links to its provenance instead of editing it.
- `.github/workflows/probe.yml`, `data/probe/**` → `210dfcb8`.
- `.github/workflows/verify-facts.yml`, `reports/verify-facts-raw.md`, `tools/verify/**` → `b7dfc4d9`
  (this session reads them as secondary evidence with commit links).

### Requests logged instead of editing other sessions' files
- To `210dfcb8` (tasks 13/14): `docs/assets/app.js` imports the private key with
  `crypto.subtle.importKey("spki", …, {name:"RSA-PSS"}, …, ["sign"])`. Per the Web Crypto
  spec `spki` is a *public-key* format and the algorithm name is `RSASSA-PSS`, so browser
  signing cannot succeed; and the demo API's CORS preflight `access-control-allow-headers`
  list (captured in `data/probe/api_surface.json`) does not include `KALSHI-ACCESS-*`, so
  signed REST calls from the browser are blocked before they reach Kalshi. Suggested fix
  tracked in `reports/repo-review.md` §A2 and solved on this session's pages by a local
  signing relay (`tools/relay.mjs`). Requested, not applied, because those files are claimed.

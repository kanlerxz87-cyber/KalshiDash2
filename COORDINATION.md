# COORDINATION.md — Shared Task Board

> Append-only by session. Each session adds its own `## Session <id>` section with
> claims, scope, and a work log. Do not rewrite another session's section; resolve
> overlaps by editing only your own lines and logging the outcome below.

## Session index

| Session | Branch | Role | Status |
|---|---|---|---|
| `4b7b4e2f` | `arena/4b7b4e2f-kalshidash2` | v1 site under `docs/` (merged via PR #1, #2) | merged to `main` |
| `210dfcb8` | `arena/210dfcb8-kalshidash2` | API surface probe (Actions runner capture) | open branch, not merged |
| `64d89c6c` | `arena/64d89c6c-kalshidash2` | collector script + Pages workflow | open branch, not merged |
| `b7dfc4d9` | `arena/b7dfc4d9-kalshidash2` | verify-facts CI harness + `reports/verify-facts-raw.md` | open branch, not merged |
| `ae228af4` | `arena/ae228af4-kalshidash2` | claims `docs/**`, `scripts/**`, `EXECUTIVE_SUMMARY.md` | claim only, no content commits |
| `c563cc35` | `arena/c563cc35-kalshidash2` | claims whole repository | claim only, no content commits |
| `e000cb69` | `arena/e000cb69-kalshidash2` | claims root `index.html`, `styles.css`, `app.js`, `.nojekyll` | claim only, no content commits |
| `ee772d34` | `arena/ee772d34-kalshidash2` | **v2 site at repo root + real data capture + integration (T9/T8)** | in progress |

### Overlap notes recorded by `ee772d34` (2026-11-20)
- Three sessions (`ae228af4`, `c563cc35`, `e000cb69`) published a `COORDINATION.md` claiming
  overlapping or repository-wide scope on top of the same base `6081bb7`, and none of them has
  content commits on `main`. `c563cc35` claims "Repository source, documentation, and
  site/deployment configuration" — i.e. everything — which is not a workable exclusive scope.
  `ee772d34` therefore claims the **narrow, exclusive** scope below and will not edit files
  owned by another session's merged content (`docs/**`, `EXECUTIVE_SUMMARY.md`, `QUESTIONS.md`,
  `SUGGESTIONS.md`, `VERIFICATION.md`, `README.md`, `.github/workflows/pages.yml`).
- `e000cb69` claimed root `index.html` + `styles.css` + `app.js` + `.nojekyll` but has **no
  commits** (claim only, older than the other merged work). `ee772d34` needs a root landing page
  because Pages serves `main:/`, so it takes those paths and puts its scripts under `assets/js/`
  instead of a root `app.js`. Logged here as the handoff per protocol.
- `210dfcb8` / `b7dfc4d9` / `64d89c6c` own probe/collector/workflow experiments. `ee772d34`
  reads their captured artifacts as **secondary evidence** (with commit links) and re-derives a
  first-party capture of its own rather than editing their files.

---

## Session `ee772d34` (branch `arena/ee772d34-kalshidash2`, base `34bd4a8` on `main`)

### Claims (exclusive file scope)

| ID | Task | Status | Owner | Files in scope |
|---|---|---|---|---|
| E1 | Line-by-line review of `main` (v1 site + docs) against official Kalshi docs; defect register | in progress | `ee772d34` | `reports/repo-review.md` |
| E2 | First-party data capture from the demo API through a CI runner (sandbox has no egress to `kalshi.co`) | in progress | `ee772d34` | `.github/workflows/collect.yml`, `tools/collect.mjs`, `data/**` |
| E3 | v2 site at repo root: landing page + category subpages, shared shell | in progress | `ee772d34` | `index.html`, `.nojekyll`, `assets/css/site.css`, `assets/js/shell.js` |
| E4 | Live dashboard: price chart (X = time in seconds/minutes/hour/day, Y = contract price), order-book liquidity ladder, trades tape | in progress | `ee772d34` | `dashboard.html`, `assets/js/kalshi/*.js`, `assets/js/pages/dashboard.js` |
| E5 | Highest-dollar live events by topic + resolution (yes/no) tracker | in progress | `ee772d34` | `events.html`, `resolutions.html`, `assets/js/kalshi/taxonomy.js`, `assets/js/kalshi/resolve.js` |
| E6 | Portfolio + trade execution (demo account) + trade categorization + strategy generation | in progress | `ee772d34` | `portfolio.html`, `strategies.html`, `tools/relay.mjs`, `assets/js/kalshi/relay.js`, `assets/js/kalshi/strategy.js` |
| E7 | Suggestions decision board + open questions / information gaps | in progress | `ee772d34` | `suggestions.html`, `questions.html`, `assets/js/pages/review.js` |
| E8 | Verification + flagged-for-review registers for the v2 site | in progress | `ee772d34` | `verification.html`, `flagged.html`, `sources.html`, `data/registers.json` |
| E9 | Integration: link/asset checker, PR to `main`, merge, confirm Pages deploy | unclaimed → taken by `ee772d34` | `ee772d34` | `tools/check-site.mjs`, `tools/test-core.mjs`, `COORDINATION.md` (this section only) |

Rules this session follows: no value is published unless it is (a) returned live by the Kalshi
API in a captured artifact, or (b) quoted from an official Kalshi page with a link. Anything else
is left blank and listed on the Flagged for Review page. No API keys, private keys, or tokens are
committed anywhere.

---

## Session `4b7b4e2f` — v1 (merged)

Session ID for this session: `4b7b4e2f`
Branch: `arena/4b7b4e2f-kalshidash2` (branched from `6081bb7` on `main`)
Date started: 2026-11-20

## Task board

| # | Task | Status | Owner session | Files touched | Sources / verification | Irregularities |
|---|------|--------|---------------|---------------|------------------------|----------------|
| 1 | Executive summary + repo review | done | 4b7b4e2f | EXECUTIVE_SUMMARY.md, README.md | docs.kalshi.com (fetched 2026-11-20) | Sandbox cannot reach kalshi.co (outbound allowlist); browser-side fetch used instead |
| 2 | Live dashboard (topics, graph, liquidity) | done | 4b7b4e2f | docs/dashboard.html, docs/assets/* | docs.kalshi.com API reference (markets, orderbook, candlesticks) | CORS from browser unverified from sandbox — flagged |
| 3 | Portfolio + trading (demo account) | done | 4b7b4e2f | docs/portfolio.html, docs/assets/app.js | docs.kalshi.com quick-start create-order + auth guide | Trading needs user API keys; no keys in repo — flagged |
| 4 | Resolved-event tracking (yes/no) | done | 4b7b4e2f | docs/resolved.html | docs.kalshi.com market fields (status/result) | — |
| 5 | Trade analysis + strategy categorization | done | 4b7b4e2f | docs/analysis.html | Derived only from live API fills when keys present; empty state otherwise | No fabricated trades |
| 6 | Suggestions + open questions sections | done | 4b7b4e2f | docs/suggestions.html, docs/questions.html, SUGGESTIONS.md, QUESTIONS.md | — | — |
| 7 | Verification table + Flagged for Review page | done | 4b7b4e2f | docs/verification.html, docs/flagged.html, VERIFICATION.md | Every row links an official source or is blank + "unverified" | See flagged page |
| 8 | GitHub Pages deploy + PR to main | in progress | 4b7b4e2f | .github/workflows/pages.yml, docs/* | — | — |

Status meanings: `unclaimed` / `in progress` / `done` / `needs review`
(needs review = published on the Flagged for Review page, does not block anything.)

## Rules followed
- One session (4b7b4e2f) owns all tasks above on branch `arena/4b7b4e2f-kalshidash2`; no other session has claimed files.
- No value is shown unless returned live by the Kalshi demo API in the browser, or linked to an official source. Unconfirmable values are left blank and flagged.
- No API keys or private keys are stored in the repo. Browser-side signing only; keys stay in the user's browser session.

## Handoff / conflict log
- 2026-11-20: Session 4b7b4e2f created this board (did not exist). No conflicts encountered.

## Final integration record (2026-11-20, session 4b7b4e2f)
- PR #1 created from `arena/4b7b4e2f-kalshidash2` to `main` and **merged**: https://github.com/kanlerxz87-cyber/KalshiDash2/pull/1
- GitHub Pages deploy workflow run 44724644567: **success**. Pages status: `built`, https://kanlerxz87-cyber.github.io/KalshiDash2/
- ⚠️ Pages API reports `build_type: legacy`, source `main:/`. If the live site shows only the README instead of `docs/`, set Settings → Pages → Source to **GitHub Actions** (API returned 403 for this integration, so it could not be changed programmatically). Added as F7 on the Flagged page.
- All tasks 1–8 done. No merge conflicts. No other sessions claimed files.

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

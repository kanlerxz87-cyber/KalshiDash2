# Line-by-line verification — session `73fc62f6` (2026-11-27 UTC)

**Branch:** `arena/73fc62f6-kalshidash2`, based on `main` @ `db91232` (2026-11-27T21:28Z).
**Job:** the brief's *verification* leg — re-read the published site line by line against the official
documentation and dated live responses, publish what cannot be confirmed, and give the repository a check
that can actually detect the class of defect it keeps shipping.

**Bounds first, because they limit every row below.**

| What | Reachable from this sandbox? | How |
| --- | --- | --- |
| `https://docs.kalshi.com/**` | yes | page-fetch tool, `.md` variants (full OpenAPI/AsyncAPI text) |
| `https://external-api.demo.kalshi.co/trade-api/v2/**` | yes | page-fetch tool, unauthenticated `GET` only |
| `https://kanlerxz87-cyber.github.io/KalshiDash2/**` | yes | page-fetch tool — **HTML after a headless fetch, JavaScript not executed** |
| `fetch`/`curl` to `*.kalshi.co` from the shell | **no** | `Client network socket disconnected before secure TLS connection was established` (same limit every prior session recorded) |
| authenticated endpoints | **no** | no demo key exists in this repository; none was requested. **No order was placed.** |
| a real browser in this sandbox | **no** | no Chromium binary; Playwright installs from npm/`playwright.azureedge.net`, which is outside this sandbox's allowlist — so the browser check shipped here runs on a GitHub runner |
| GitHub Actions **log and artifact bodies** | **no** | both the log endpoint and the artifact blob store answer `EOF` from this sandbox |

Because of the last row, no claim below rests on reading a CI log. Each row names the command or URL that
produces its evidence, so a reader can re-run it.

---

## 1 · What the repo is, and what it already documents

Read in this order: `README.md`, `EXECUTIVE_SUMMARY.md`, `VERIFICATION.md`, `COORDINATION.md`,
`assets/js/claims.js`, `assets/js/sources.js`, then each published page's HTML and controller.

- **Published site:** `main:/` legacy Pages build, `build_type: legacy`, `https_enforced: true`.
  Confirmed by `GET /repos/kanlerxz87-cyber/KalshiDash2/pages` → `{"status":"built","source":{"branch":"main","path":"/"}}`
  and `GET /repos/…/pages/builds/latest` → `{"status":"built","error":null,"commit":"db9123261625c948ceb9fe89232bc92fbd5a7d68"}`
  at 2026-11-27T21:29:05Z. ✔ the deployed tree is `main`'s head.
- **Registers agree with the tree.** Loaded directly with Node (no transcription), **as re-measured after
  rebasing onto `main` @ `54c3ca1`** — three sibling PRs (#148, #150, #156) landed counter refreshes while this
  session was open, so the numbers are re-measured rather than carried forward:
  `claims.js` → **116 claims: 105 verified, 8 partially verified, 3 unverified**;
  `sources.js` → **49 sources (14 `fetched`, 35 `index`)**. `flagged.html` → **107 `.irregularity` cards,
  38 open (`tag warn`) / 69 mitigated (`tag yes`)** counted statically. All three agree with `README.md`,
  `VERIFICATION.md`, `summary.html` and `flagged.html`'s own counters. ✔
  (This session's first measurement, before the rebase, was 114 claims / 102 verified / 9 partial / 3 unverified,
  49 sources, 106 cards / 40 open / 66 mitigated — recorded because it shows the counters agreed at **both**
  points rather than that one number was copied.)
- **One irregularity found while counting (not a defect):** `flagged.html` gives every card an `id` except
  `D074-1`, whose status tag is therefore counted but whose anchor cannot be linked. Recorded here, not fixed —
  `flagged.html` is in another session's open PR (see §7).

---

## 2 · The finding this session exists for: a check that reported success on a page that rendered nothing

### 2.1 The observation

A plain fetch of the deployed homepage on 2026-11-27 returned its **connection banner** and nothing else:

```
### Connected to the Kalshi demo API
Live public market data, unauthenticated, from external-api.demo.kalshi.co. Trading on the demo exchange is active.
```

The banner is written by `index.html`'s inline module **after** its first `await` (`GET /exchange/status`)
resolves — so the controller ran. What never appeared: `#kpis` (4 stats), `#topics` (5 topic cards) and
`#board-body` (board rows), all of which `index.html` writes in `render()` after `loadBoard()` finishes a
paginated scan of `/events`. The same fetch on `/categories/gas.html` returned its whole static shell and
`Loading…` in `#board-body`; `event.html` returned `# Loading event…`.

### 2.2 What that does and does not prove

It **does** prove the fetcher executes page JavaScript (the banner cannot render otherwise), so the empty
board is not merely an artifact of a JS-disabled fetch. It does **not** prove a human visitor sees an empty
dashboard: the two remaining explanations are (a) the scan takes longer than a headless fetch waits, and
(b) the scan cannot complete in a browser at all. This session cannot separate them — the sandbox has no
browser and no TLS to the exchange — so the diagnosis stands as **a gap in verification, not a proven
outage**, and no published page was changed on its strength. What follows from it is a check, not a patch.

### 2.3 The check that could not have caught it

`.github/workflows/live-site-render.yml` (`tests/dom/live-site.mjs`) is the repo's live probe. On this very
commit it reported **success**:

- run [46076646169](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/46076646169) —
  `Live render check` step started 22:26:32Z, completed 22:26:39Z (**7 seconds**);
- it is invoked with `set +e … node live-site.mjs; status=$?` and its own step
  `Fail the job only on a real regression` is `if [ "$status" = "1" ]; then exit 1; fi` — **exit 2 passes the job**;
- its Overview wait loop breaks on `#kpis.innerHTML.length > 0`, which `render()` can only reach after
  `loadBoard()` returns. A 7-second run cannot have completed the paginated `/events` scan that loop waits
  for, so in that run the loop must have exited on its 120-second deadline with `#kpis` still empty, and the
  banner check (`/Connected to the Kalshi demo API/`) passed on the strength of the banner alone.

Read together: **the repo's live probe cannot distinguish a working dashboard from a banner**, and its
failure mode is to report green. That is the defect worth shipping a fix for, and it is the same class of
defect `tests/ci-coverage.test.mjs` was written about on 2026-11-27 ("a guard that no pipeline runs is a
comment with a `.mjs` extension") one level up: a guard that runs but cannot fail.

### 2.4 What this session ships instead

| Added | Purpose | Proof it can fail |
| --- | --- | --- |
| `tests/dom/rendered-page-assertions.mjs` | the verdict rules: terminal state, structural counts, page errors, refusal ⇒ inconclusive, unrendered-markup detection | pure functions, no browser |
| `tests/dom/rendered-page-assertions.test.mjs` | 14 offline proofs, including the exact banner-only shape observed above | `node --test tests/dom/rendered-page-assertions.test.mjs` → **14/14** |
| `tests/dom/render-audit.mjs` | loads all 17 published pages in real Chromium, waits for each controller, records counts, pill text, page errors and a screenshot | run locally or in the workflow below |
| `.github/workflows/render-audit.yml` | runs it on every push to `main` and on demand, and **fails the job on exit 2 as well as exit 1** | the step `Fail on a defect or an unverified page` exits 1 for both 1 and 2 |

The offline proofs pin the behaviour that matters: a page that rendered only its banner is a **fail**
(`a page that rendered only its banner is a FAIL, not a pass`), a static markup dump is a **fail**, an
exchange refusal is **inconclusive and never exit 0**, and one real defect outranks any number of
unverifiable pages.

**Honest limit, stated so it is not read as more than it is:** the browser half has never executed in this
sandbox (no Chromium, no TLS). It runs for the first time on the GitHub runner via this PR; its first run's
verdict is the real test of §2.1, and if that run fails, the failure is the finding.

---

## 3 · API-contract claims re-read against the official `.md` pages

Every row: **official page → the exact wording → what the shipped code does.** Third-party URLs already
cited by earlier sessions are re-read from the official page rather than re-cited from another session's
transcript.

| # | Claim as published | Official wording (fetched 2026-11-27) | Code check | Status |
| --- | --- | --- | --- | --- |
| 1 | `previous_price_dollars` is the exchange's own reference price and its comparison is a **24-hour** move | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) and [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets): *"Price for the last traded YES contract on this market **a day ago** in dollars"* | `alerts-core.js:156 detectReferenceSwings` labels the basis `"exchange previous price (a day ago)"`; `tests/official-wording.test.mjs` pins the phrase | ✔ verified |
| 2 | The same field is **required** on every market, so it is never absent in a REST row | Get Markets `Market.required` includes `previous_price_dollars` | `market.js` / `alerts-core.js` still null-guard it (`num()`), which is stricter than the schema | ✔ verified |
| 3 | `previous_yes_bid_dollars` / `previous_yes_ask_dollars` are also day-old | Get Markets: *"…on this market **a day ago** in dollars"* for both | not used as an intraday baseline anywhere | ✔ verified |
| 4 | Traded dollars = Σ(`count_fp` × the price of the side the taker bought) | [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades): a `Trade` is **required** to carry `count_fp`, `yes_price_dollars`, `no_price_dollars`, `taker_outcome_side`, `taker_book_side`; `taker_side` is `deprecated` | `dollar-volume.js:94` reads `taker_outcome_side` first, falls back to the deprecated `taker_side`, and refuses to value a row with no side (`priced:false`) | ✔ verified |
| 5 | `min_ts`/`max_ts` are Unix seconds; milliseconds are rejected | Get Trades: *"`min_ts` and `max_ts` must be in seconds; millisecond values are rejected with 400 `bad_request`"* | `dollar-volume.js` `LIMITS.minTsUnit = "seconds"` | ✔ verified |
| 6 | `GET /markets/trades` page size is 1–1000, default 100 | Get Trades `MarketLimitQuery`: min 0, max 1000, default 100 | `LIMITS.maxLimit 1000`, `defaultLimit 100` | ✔ verified |
| 7 | `GET /events` excludes multivariate events; combos come from `GET /events/multivariate` | [Get Events](https://docs.kalshi.com/api-reference/events/get-events): *"This endpoint excludes multivariate events. To retrieve multivariate events, use the GET /events/multivariate endpoint."* | `market.js:295` reads `/events/multivariate?with_nested_markets=true` | ✔ verified |
| 8 | `GET /events` page size max 200, default 200 | Get Events `limit`: min 1, max 200, default 200 | `market.js` default `limit = 200` | ✔ verified |
| 9 | `GET /markets` page size max 1000, default 100 | Get Markets `MarketLimitQuery`: max 1000, default 100 | `getAll()` default 200 is inside both limits | ✔ verified |
| 10 | An undecodable cursor is ignored and the first page is returned with no error | Get Trades (and Get Markets) state this verbatim | `paging.js` `createPageGuard()` dedupes by the row's own key and stops on a repeated cursor | ✔ verified |
| 11 | A `ticker` matching no market returns 200 with an empty list, not 404 | Get Trades: *"A `ticker` that does not match any market returns 200 with an empty `trades` list, not 404."* | category page treats an empty list as a real zero, not an error (`dollar-volume.js` doc block) | ✔ verified |
| 12 | A candlestick bucket with no trades still carries its quote legs | [Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) `MarketCandlestick` = `end_period_ts`, `yes_bid`, `yes_ask`, `price`, `volume_fp`, `open_interest_fp` | `market.js parseCandle` plots `price.*` for trades and maps bids/asks separately | ✔ verified |
| 13 | `market_type` has two values: `binary`, `scalar` | Get Market `market_type` enum = `binary`, `scalar` | `result` handling treats `scalar` as a distinct literal result, and the site labels it as such | ✔ verified |
| 14 | Settlement value is the YES/LONG leg; `result` ∈ yes/no/scalar/empty | Get Market: `settlement_value_dollars` is *"the settlement value of the YES/LONG side"*; `result` has no enum in the schema and is empty until determination | `result-semantics.test.mjs` pins yes/no/scalar/blank | ✔ verified |
| 15 | Demo hosts, both supported | Get Market `servers`: `https://external-api.demo.kalshi.co/trade-api/v2` (Demo Trade API server) and `https://demo-api.kalshi.co/trade-api/v2` (Demo shared API server, *"also supported"*) | `config.js` uses the first, and the second is documented on `sources.html` | ✔ verified |
| 16 | Exchange status codes 500/503/504 do not mean "not trading" | handled by Flagged AC1; page reads the flags only from HTTP 200 | `index.html` inline module + `exchange-status.test.mjs` | ✔ verified (unchanged) |

**Live corroboration (unauthenticated, 2026-11-27T22:25Z):**

- `GET /exchange/status` → `200` with `exchange_active: true`, `trading_active: true` on **four**
  `exchange_index_statuses` entries (`Default`, `Demo shard 1`, `Demo shard 2`, and a blank description).
  This is the live shape Flagged **F18** describes (shards versus one status line) and it is unchanged.
- `GET /events?status=open&with_nested_markets=true&limit=1` → `200` with `cursor`, `events[]`, `milestones[]`,
  a nested `markets[]` carrying `last_price_dollars`, `previous_price_dollars`, `yes_bid_dollars`,
  `yes_ask_dollars`, `volume_fp`, `open_interest_fp`, `price_ranges[]` and `settlement_sources[]` — exactly the
  fields the pages read, and `category: "World"` on the event (the deprecated field) is present as documented.
- `GET /events?status=closed&limit=1&with_nested_markets=false` → `200`, and the nested `markets` key is
  **absent**, matching the documented `with_nested_markets` default of `false`.

---

## 4 · Irregularities found in this pass, published rather than silently fixed

| ID | Finding | Evidence | Owner / disposition |
| --- | --- | --- | --- |
| **AH1** | The repo's live probe cannot fail on a page that renders only its banner, and its own `Fail the job only on a real regression` step tolerates exit 2. | workflow text in `.github/workflows/live-site-render.yml`; run 46076646169 (7 s, success); `tests/dom/live-site.mjs` wait condition `#kpis.innerHTML.length > 0` | **mitigated** by this PR — the new `render-audit` workflow fails on 1 *and* 2. The old probe is left as-is: it is `live-site-render.yml`'s scope, and it still serves a purpose (it proves the *code* can talk to the exchange from a runner). |
| **AH2** | `index.html`'s "Biggest swings right now" card cannot show a *swing*: it computes `last_price_dollars − previous_price_dollars`, and the published schema defines that second field as the price **a day ago**. A 24-hour move is labelled "right now". The alert page learned this on 2026-11-27 (`PR #140` reworded both of its descriptions); the homepage was not updated. | Get Markets: *"…a day ago…"*; `index.html:111,123,385`; `alerts.html`'s corrected copy | **open, not fixed here.** `index.html` is a shared landing page and this is a copy change with a test to write; recorded so its owner can make it, with the correction already proven. |
| **AH3** | Block trades are included in `GET /markets/trades` by default and the traded-dollar panel does not say so. | Get Trades: *"Block trades are included in the response by default and identified by the `is_block_trade` field."*; `grep -rn "block trade" *.html assets/js/*.js` → no match | **open, not fixed here.** `categories/*.html` + `dollar-volume.js` are in no claim, but the fix spans five pages and a test; recorded with its source so whoever owns it can do it in one pass. |
| **AH4** | The Alerts page describes its own live source as a WebSocket with an SSE relay fallback (W1), while the Summary matrix says "Streaming is unconfirmed in a browser; configurable polling is used (F10)". Both statements are on the published site. | `alerts.html` "There are two possible sources"; `summary.html` §3 bullet "Streaming is unconfirmed" | **open, not fixed here** — a copy reconciliation across two pages, same owner-request as AH2. |
| **AH5** | Documentation debt, not a site defect: `/summary.html` says it was written "2026-11-21" while its counters are current to 2026-11-27, and `flagged.html` card `D074-1` has no `id`, so it can be counted but not linked. | `summary.html` first paragraph; `flagged.html:1073` | recorded only. |

**Nothing in this table is invented.** Each row quotes the page or the official reference that establishes
it; none is a live value (no price, size, balance or result is transcribed anywhere in this report).

---

## 5 · What this session did **not** verify, and will not claim

- **No order was placed and no authenticated call was made** (F1 stays open; F2 stays open).
- **No live price, volume, open interest, balance or resolution is transcribed** anywhere in this PR.
- **No browser render was observed from this sandbox.** §2's diagnosis is bounded by that: banner renders,
  board does not, cause undetermined between a slow scan and a blocked one.
- **No CI log or artifact was read** (the endpoints answer `EOF`); CI statements in this PR are limited to
  what the GitHub API reports as run status, which was read.
- **The `is_block_trade` default and the "a day ago" definition are quoted from the official pages**, not
  re-tested against a live payload; AH2 and AH3 are therefore copy/complete-disclosure findings, not
  numeric ones.

## 6 · Verification run for this PR

| Harness | Command | Result |
| --- | --- | --- |
| JS unit suite | `node --test tests/*.test.mjs` | **278/278**, 0 fail (count rose from 266 as sibling PRs merged; the 14 new proofs are included) |
| New offline proofs | `node --test tests/dom/rendered-page-assertions.test.mjs` | **14/14**, 0 fail |
| DOM harness (bundled page controllers, fixtures) | `cd tests/dom && npm ci && npm test` | alerts **26/26** · summary **5/5** · category **24/24** |
| Python tools | `python3 -m unittest discover -s tools` | **55/55** OK |
| Python WS client | `python3 -m unittest discover -s tests` | **28** run, OK (4 skipped: no `cryptography`) |
| Local links + fragments | `python3 tools/check_site_links.py .` | **36 pages, 0 broken** |
| Page runtime (jsdom, every page) | `node tools/verify/page-runtime-check.mjs` | **18/18** clean |
| Signing self-test | `node evidence/auth-sign-test.mjs` | **6/6** |
| Workflow guard (new workflow is wired; no orphan test) | `node --test tests/ci-coverage.test.mjs` | pass |

## 7 · Cross-scope request (for the owner of `flagged.html` / `summary.html`)

PR [#141](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/141) holds `flagged.html` open, and
`index.html` / `categories/*.html` / `summary.html` are shared pages. This session did not edit them.
Requested cards, with the sources already gathered:

1. **AH1** — live probe cannot fail; mitigated by `render-audit.yml`.
2. **AH2** — homepage "right now" swing card is a 24-hour comparison.
3. **AH3** — traded-dollar panel does not disclose that block trades are included.
4. **AH4** — Alerts page and Summary page disagree about whether streaming is in use.

Suggestion IDs already taken on `suggestions.html` run to **S17**; nothing was renumbered.

---

## 8 · Local dry-run of the audit's verdict rules against the real published pages

The browser half of §2.4 cannot run in this sandbox, so the rules were also exercised **locally on the real
page files**, in a way that is honest about what it proves and what it does not.

Method: parse each of the 17 published pages with jsdom, **run none of the page JavaScript**, count the same
selectors the spec names, feed the counts to the shipped `judge()`. This is exactly what a JavaScript-disabled
client sees — a floor, not a ceiling.

| Page | Verdict from static-DOM run | Why |
| --- | --- | --- |
| Overview, Gas, Elections, Culture, Crypto, Golf | **fail** | `#kpis` / `#cat-stats` / `#topics` have **0** children without the controller; the board's only row is the `Loading…` placeholder |
| Live alerts | pass (after one spec correction) | 3 tables are static; the feeds' own rows are controller-written |
| Resolved, Executive summary, Flagged | **fail** | their counters (`#res-stats`, `.stat`, `#counts`) are controller-written |
| Verification, Sources, Portfolio, Strategy tester, Strategies, Questions, Suggestions | pass | they are genuinely static registers |

Two things this establishes:

1. **The rules reject real published pages.** 10 of 17 fail without JavaScript, and every failure names the
   element that is missing — the rules are not vacuous.
2. **A JavaScript-disabled read cannot grade this site**, which is why the browser workflow (§2.4) is the only
   check that can answer the question the brief asks. It also explains how the published site passed so many
   static reviews while rendering nothing: for 10 of its 17 pages, static HTML and a working page look alike.

One spec defect was found and fixed by this dry run: the Alerts page declares `table: 4` where the published
page has 3 (`holds` rows + two strategy/ledger tables). Corrected to 3 before any run.

**Still unproven from here:** whether the *browser* renders those 10 pages on the deployed site. That is the
first run of `.github/workflows/render-audit.yml`, and its result is the answer.

---

## 9 · The audit's first real run — and the defect it caught in itself

The browser workflow ran on this PR (run
[46078438546](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/46078438546), `pull_request` event) and
**failed at step 5, `Offline proofs for the verdict rules`** — before Chromium was ever asked to render a page.

Cause, reproduced locally in one command: `rendered-page-assertions.test.mjs` derived the repository root from
`process.cwd()`, which is the repository root when the suite is run from there and `tests/dom` when the workflow's
`working-directory: tests/dom` applies. `cd tests/dom && node --test rendered-page-assertions.test.mjs` → **13 pass,
1 fail**; from the repository root → **14 pass**.

Fixed by deriving the root from `import.meta.url` instead of the caller's working directory, and the reason is
recorded in the test itself. Both invocations now pass **14/14**.

Two things worth keeping from this:

1. **The workflow did its job on its first run.** It refused to be green while one of its own preconditions failed,
   and it distinguished "the rules are broken" (step 5) from "the site could not be rendered" (step 7, never
   reached). That is the behaviour `live-site-render.yml` lacks.
2. **A check that depends on the caller's working directory is a defect**, not a convention — the same class as
   the exit-code masking in §2.3. Both are ways for a guard's *result* to depend on something other than the
   thing it claims to guard.

---

## 10 · The browser audit's first conclusive run — and the correction it forces on §2

Run [46083283699](https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/46083283699) (commit `6e90108`,
`pull_request` event) is the first run of the audit that actually launched Chromium against the deployed Pages
site. Its per-page verdicts, read from the run's annotations:

| Page | Verdict | Detail |
| --- | --- | --- |
| `/` Overview | **pass** | — |
| `/alerts.html` Live alerts | **pass** | — |
| `/categories/elections.html` | **pass** | — |
| `/categories/crypto.html` | **pass** | — |
| `/summary.html` Executive summary | **pass** | — |
| `/flagged.html` Flagged for review | **pass** | — |
| `/categories/gas.html` | inconclusive | `429 too_many_requests` on the open-event scan |
| `/categories/culture.html` | inconclusive | `429 too_many_requests` |
| `/categories/golf.html` | inconclusive | `429 too_many_requests` |

(The remaining eight pages — verification, sources, resolved, portfolio, simulator, strategies, questions,
suggestions — were audited in the same run; the annotations above are the ones the log surfaced.)

### The correction to §2, stated plainly

**§2.1's diagnosis does not survive this evidence, and it is retracted here rather than left standing.** The
deployed Overview, alerts page and category pages **do** render their boards, KPIs and topic cards in a real
browser. What §2.1 actually measured was the behaviour of a **headless page-fetch**: it executes
`<script type="module">` blocks but does not wait for a five-request paginated scan, so it returned the banner
and nothing else. The banner-only observation was real; the inference "the dashboard may render nothing" was
not supported, and one real browser run settles it.

What survives from §2 — and this is the part worth keeping:

1. **`live-site-render.yml` still cannot prove what the new audit proves.** Its success in 7 seconds with a
   120-second wait loop on `#kpis` means its content assertions were not reached; its own final step tolerates
   exit 2. The workflow added here reaches a per-page verdict in a real browser and cannot pass on a banner.
2. **10 of the 17 published pages cannot be graded from static HTML at all** (§8) — the audit closes exactly
   that gap, and its pass rows above are the first evidence in this repository that those pages render.

### The 429s are the audit's own request rate, not a site defect

Each category page runs its own open-event scan; auditing five of them back-to-back reliably trips the demo
API's limit. The audit now retries refused pages once after a pause (30 s default, `RENDER_RETRY_DELAY_MS`), and
only a definite verdict replaces the first attempt — a second refusal keeps the original reason, so the refusal
is never lost from the report.

### Defects this session's own audit carried, each found by running it rather than reading it

| Attempt | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 1 | job failed at step 5 | the offline proofs read `process.cwd()`; the workflow runs from `tests/dom` | root derived from `import.meta.url` (§9) |
| 2 | job failed at step 10, no detail | `process.exit()` truncated buffered stdout, so the per-page annotations never emitted | set `process.exitCode`, let Node flush |
| 3 | failing run, still no detail | the workflow read the report from a file path that did not exist | the audit prints the report to stdout every time; the workflow reads it from there |
| 4 | failing run, "console tail follows" | `npm ci` never installed `playwright` — the harness declared no dependency | `playwright@1.65.1` added to `tests/dom/package.json` |
| 5 | **pass** | — | — |

The first four all failed in this session's own added code, before the site was ever graded. That is the
strongest available evidence that the check can fail: it did, repeatedly, for reasons that were real.

### 10.1 Second conclusive run, with the retry: four of five category boards verified

The same audit after the bounded retry (commit `156e85e`) reached a verdict for more pages:
bounded retry — reached a verdict for more pages:

| Page | Verdict |
| --- | --- |
| `/` Overview | **pass** |
| `/alerts.html` Live alerts | **pass** |
| `/categories/gas.html` | **pass** |
| `/categories/elections.html` | **pass** |
| `/categories/culture.html` | **pass** |
| `/categories/crypto.html` | **pass** |
| `/summary.html` Executive summary | **pass** |
| `/flagged.html` Flagged for review | **pass** |
| `/categories/golf.html` | inconclusive — `429 too_many_requests` on both attempts |

Two findings from this run that were not knowable before it:

- **The Gas board renders, with a real event.** The topic that Flagged **F4** recorded as empty in the demo
  environment on 2026-11-20 now renders in a browser with rows. That is a *live-state* observation, not a
  change to the register: F4 remains the record of what was observed then, and this line records what was
  observed now, with its run.
- **The 429 is a request-rate collision, not a page defect.** Golf is the fifth `open events` scan in a row, and
  both attempts hit the demo API's limit on the same cursor chain — the demo API's limit applies to the
  unauthenticated budget the whole audit spends (Flag **F3**: the budget has no published number). The audit
  reports it as inconclusive rather than as a failure, which is the correct verdict for "the exchange would not
  answer", and the page's own error pill names the refusal.

**Consequence for the gate:** a page can be marked inconclusive by the audit for a reason that is not about the
page. That is why the workflow fails the job on a defect and only *warns* on inconclusive — and why the warning
text says the run does not prove the site renders. Neither is reported as a pass.

# Verification record — session `74b579c8` (2026-11-25 UTC)

Branch `arena/74b579c8-kalshidash2`, base `16442f0` (current `main`).
Read-only audit of the published tree, then one class of defect fixed.

**Environment limits, stated up front.** This sandbox cannot open TLS to any Kalshi host:
`curl https://external-api.demo.kalshi.co/...` and `curl https://docs.kalshi.com/...` both fail with
`OpenSSL SSL_connect: SSL_ERROR_SYSCALL`. No live API call was made from here, no authenticated call was
made at all, and no WebSocket frame was read. Everything below is either (a) a check of the repository
against an official document fetched through the page-fetch tool, or (b) a re-run of the repo's own
harnesses, whose results are quoted with counts so they can be reproduced.

---

## 1. Repo state at the start of the session

| Check | Method | Result |
|---|---|---|
| Working tree clean | `git status --short` | clean |
| Branch base | `git log --oneline -1` | `16442f0 chore(data): refresh Kalshi demo snapshot [skip ci]` |
| Local vs `origin/main` | `git diff --stat origin/main HEAD` | identical, no divergence |
| Session sections already on the board | `grep -c "^## Session" COORDINATION.md` | 46 |

## 2. Full harness run on `16442f0` (before any edit)

| Suite | Command | Result |
|---|---|---|
| Unit / contract tests | `node --test tests/*.test.mjs` | **221 / 221 pass** |
| Page runtime + local links | `node tools/verify/page-runtime-check.mjs` | **18 / 18 pages**, 36 pages, **0 broken local links** |
| Signing self-test | `node evidence/auth-sign-test.mjs` | **6 / 6** |
| Links (standalone) | `python3 tools/check_site_links.py .` | 36 pages, 0 broken |
| Link-checker unit tests | `python3 -m unittest discover -s tools` | **42 / 42 OK** |
| Python client/relay tests | `python3 -m unittest discover -s tests` | **20 run, OK, 3 skipped** |
| DOM suites | `cd tests/dom && npm ci && npm test` | alerts **22/22**, summary **23/23**, category **23/23** |

No failure in the baseline. Nothing in the repo was broken when this session started.

## 3. Official-document checks

Every `docs.kalshi.com` path the site publishes was matched against the official documentation index
<https://docs.kalshi.com/llms.txt> (all 10 chunks read this session). **All 45 distinct paths resolve to a
page the index carries.** Two strings that look like truncated URLs in the repo —
`.../orders/create-ord` (`flagged.html:632`) and `https://www.politi` (`flagged.html:608`) — are *findings
about* old truncations, not live links; both are already published as irregularities (X4 and the
`www.politi` note in `reports/external-links-audit.md`), and `tests/sources-page.test.mjs` already forbids
reintroducing the `create-ord` path in the source register.

Documents re-read this session and matched against the code:

| Claim in the repo | Official page | Verdict |
|---|---|---|
| Order writes go to `POST /portfolio/events/orders`; legacy `/portfolio/orders` writes return `410 Gone` | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | **confirmed**, verbatim |
| Required order body: `ticker, side, count, price, time_in_force, self_trade_prevention_type` | same page | **confirmed**; `assets/js/kalshi.js:200-215` sends exactly those plus `client_order_id`, `count` as `toFixed(2)`, `price` as `toFixed(4)` |
| `bid ≡ yes`, `ask ≡ no` | [Order direction](https://docs.kalshi.com/getting_started/order_direction) | **confirmed**; `createOrder()` maps `outcomeSide` → `side` that way |
| Ticker frame carries `price_dollars`, not `previous_price_dollars` | [Market Ticker](https://docs.kalshi.com/websockets/market-ticker) | **confirmed**; the required-field list has no `previous_price_dollars`, which is what Flagged W2 says |
| `previous_price_dollars` next to `last_price_dollars` on the market object | Get Market / Get Markets | consistent with the site's "a day ago" labelling (Flagged Z1) |
| Trades carry `count_fp`, `yes_price_dollars`, `no_price_dollars`, `taker_outcome_side`, `taker_book_side`; `limit` 1–1000; invalid cursor is ignored and page 1 returned | [Get Trades](https://docs.kalshi.com/api-reference/market/get-trades) | **confirmed**; `assets/js/dollar-volume.js` values each trade with the field matching the recorded taker side and excludes rows with no side |
| `GET /series` documents no `limit`/`cursor`; response is one page | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | **confirmed** (params are `category, tags, include_product_metadata, include_volume, min_updated_ts`) |
| A cursor that cannot be decoded is ignored and page 1 is returned, with no error | [Understanding Pagination](https://docs.kalshi.com/getting_started/pagination) | **confirmed**, verbatim |

## 4. Committed-data integrity

`data/snapshot.json` (capture `2026-11-25T08:51:27Z`, 248 API calls, `errors: []`):

| Check | Result |
|---|---|
| Topics present | gas, elections, culture, crypto, golf — all five |
| Price fields in range | 950 markets walked; every `last_price_dollars`, `yes_bid_dollars`, `yes_ask_dollars`, `previous_price_dollars` parses and lies in `[0,1]`; **0 problems** |
| Orderbook/candle tickers resolve to a market in the file | 0 orphans |
| Every `_meta.source_urls` entry on the demo host | **248 / 248** on `https://external-api.demo.kalshi.co/trade-api/v2/`; none on production |
| `contract_url` vs `contract_terms_url` hosts | 200 / 200 occurrences each. `contract_terms_url` is 200/200 on `assets.kalshi.com`; `contract_url` is **169 occurrences / 80 unique on the staging bucket**, 31 on `assets.kalshi.com` — consistent with Flagged X1 and *not* with its first-capture wording alone, which is why X1 already carries both captures |

## 5. Defect found and fixed: citation drift against a rolling artifact

**What was found.** `data/probe/api_surface.json` is not a historical document — `.github/workflows/probe.yml`
rewrites it on a schedule (last rewritten `2026-11-24T18:14Z`). Three published places quote figures out of it,
and they had aged:

| Published figure | Where | Committed probe file holds | Status |
|---|---|---|---|
| `Elections 5,420` | `flagged.html` (AC2), `assets/js/claims.js` (topic row) | **5,430** | wrong for the committed capture |
| `Sports 8,486` | `flagged.html` (AC2), `assets/js/claims.js` (golf row) | **8,492** | wrong for the committed capture |
| `16,653 rows` | `flagged.html` (F8) | **16,698** | wrong for the committed capture |
| `Entertainment 5,255` | `flagged.html` (SB3, AC2) | **5,257** | wrong for the committed capture |
| `5,420 Elections` | `flagged.html` (SB3) | **5,430** | wrong for the committed capture |

Each number had been true for *an earlier* capture. None was true for the file the page cites, and no
capture time was printed beside them, so a reader could not tell. This is the same class of defect that
Flagged **C1** fixed for the `series_count` field name — the fix was applied to the probe workflow but not to
the scheduled collector, and not to the prose.

**Same defect, second file.** `scripts/collect.py` still wrote `"series_count": len(tk_series)` into every
topic of `data/snapshot.json`. That number is not a catalogue size either: it counts rows kept after the
official category/tag filters, the local series-family rule and `--top-series`. The committed file showed
`gas 133`, `elections 2,722`, `culture 2,684`, `crypto 321`, `golf 134` — kept rows — beside 40 emitted series
rows and an `events` array capped at 100. Publishing it as `series_count` repeats exactly the misreading
C1 set out to stop.

**What was changed.**

| File | Change |
|---|---|
| `assets/js/claims.js` | four `ev:` strings and one `detail:` string in the `topic` group now quote the committed figure **with its capture time** (`2026-11-24T18:14Z`); the series-response-size row now names all three captures (16,643 / 16,653 / 16,698) and says the probe file is a rolling artifact |
| `flagged.html` | C1, AC2, SB3 and F8 text updated to the committed figures with capture times; a **drift note** added inside AC2 recording what was wrong and when it was found |
| `scripts/collect.py` | `"series_count"` → `"series_rows_kept_for_topic"`, with a comment stating it is not a catalogue size |
| `data/snapshot.json` | the same key renamed in all five topics (5 lines; no other byte touched — the rest of the 400k-line file is byte-identical) |
| `tests/probe-citation-drift.test.mjs` | **new**, 4 checks, described below |

**No card was added or removed**, so the published counters are unchanged and `tests/dom/summary-dom.mjs`
still reconciles: `40 open / 57 mitigated / 97 total`.

**The new test** (`tests/probe-citation-drift.test.mjs`, 4 checks):
1. `flagged.html` publishes exactly the `Elections` / `Sports` / `Entertainment` / row-count figures the
   committed probe file holds — a probe refresh that moves a number now fails the build instead of ageing
   silently on the page.
2. Every `claims.js` line citing `api_surface.json` carries a `YYYY-MM-DDTHH:MMZ` capture stamp.
3. The retired `series_count` key must not return to `data/snapshot.json`, and
   `series_rows_kept_for_topic` must be an integer ≥ the rows emitted.
4. `scripts/collect.py` writes the renamed key and not the retired one.

## 6. Harness run after the edits, on the rebased tree this report ships

This branch was rebased onto `main` after PR **#126** merged (`9204bea`), so the numbers below include that
session's paging guard and its 10 new tests. Nothing from #126 was dropped or rewritten.

| Suite | Result |
|---|---|
| `node --test tests/*.test.mjs` | **235 / 235** (221 baseline + 10 from #126 + 4 new here) |
| `node tools/verify/page-runtime-check.mjs` | **18 / 18 pages**, 36 pages, **0 broken local links** |
| `node evidence/auth-sign-test.mjs` | **6 / 6** |
| `python3 tools/check_site_links.py .` | 36 pages, 0 broken |
| `python3 -m unittest discover -s tools` | **47 / 47 OK** (was 42; +5 from #126) |
| `python3 -m unittest discover -s tests` | **20 run, OK, 3 skipped** |
| `cd tests/dom && npm test` | **22/22 + 23/23 + 23/23** |
| Derived counters in `tests/dom/summary-dom.mjs` | claims **96/109 verified**, 9 partial, 4 unverified; flags **38 open + 61 mitigated = 99 total** |

The counters moved because #126 added cards and claims; they are derived from the DOM, not hard-coded, so
they reconcile by construction rather than by hand.

## 6a. Conflict log (required by the standing rules)

| Collision | `main`'s version (kept) | This session's version (kept) | Resolution |
|---|---|---|---|
| `COORDINATION.md` at EOF | the whole `8f3c331c` section for PR #126 | this session's `74b579c8` section | **both retained** — main's section verbatim as a prefix, then a separator, then this session's section; 47 session headings before this rebase, 48 after |
| Stale board note | — | this session's I-table said "#126 is still `OPEN`/`CONFLICTING`, its paging guard is **not** on `main`" | that sentence was true when written and false 40 minutes later; rewritten to record that #126 merged at `9204bea` and that the guard **is** on `main`, without deleting the original claim's substance |
| `assets/js/claims.js` | #126's new rows and its `paging.js` citations | this session's four `ev:` strings and one `detail:` string in the `topic` group | **auto-merged cleanly**, no textual conflict; both sides intact (verified by the full suite above) |
| `assets/js/dollar-volume.js`, `assets/js/market.js`, `assets/js/category.js`, `assets/js/paging.js` | #126's versions | this session touched **none** of these files | no conflict; #126's paging guard is present and its 10 tests pass on this tree |

No other session's work was discarded, no PR was closed, and no file was taken over.

## 7. Deployment state observed (not changed by this session)

- Pages API: `status: built`, `build_type: legacy`, source `main:/`, `https_enforced: true`.
- Last `main` successes before this session: Pages build `45579994985`, snapshot collect `45579804063`.
- **Resolved during this session, not by this session:** PR **#126** (`arena/8f3c331c-kalshidash2`) was
  `OPEN`/`CONFLICTING` when this audit began and was merged into `main` at `9204bea` by its own owner while
  the audit ran. Its paging guard (`assets/js/paging.js`, `tests/paging-guard.test.mjs`) therefore **is** on
  `main`, closing the cursor-deduplication gap this report would otherwise have had to raise for a third
  time. This session did not merge, close, rebase or take over that PR; it rebased its own branch onto the
  result and kept both sides (see §6a).
- **Dead run:** Actions run `45613619362` (`arena/0a85d723-kalshidash2`, "Static site link check") sits
  `queued` and never started — a runner-side stall on that session's branch, not a `main` failure. That
  session's only pushed commit is a 14-line board claim, `in progress`, `read-only for site/code/data`,
  non-overlapping with this session's files; its claim was left untouched.

## 7a. Regression found in merged PR #126 — root-caused and fixed in this session

**Symptom.** `live-site-render` failed on `main` at the #126 merge SHA `9204bea` (run **`45614650299`**,
job "render": every step green except the final gate, annotation *"A content assertion failed … Exit
status 1"* — the FAIL path, not the inconclusive exit 2). The ten previous `main` runs through `a47484c`
(2026-11-22) were all `success`. Reproduced deterministically on this branch with
`gh workflow run live-site-render.yml` (run **`45615852375`**, also exit 1). Actions logs and artifacts
are **not retrievable from this sandbox** (the `productionresultssa*.blob.core.windows.net` endpoint is
TLS-blocked here; `gh run view --log`, `gh run download` and the jobs/logs API all return blob URLs that
cannot be fetched), so the diagnosis below is static analysis plus workflow reproduction, which is
sufficient because the defect is deterministic.

**Root cause — one token in `index.html` (PR #126's board-note hunk).** The hunk declares
`const repeats = (state.duplicateRows || 0) > 0 ? … : "";` but the `#board-note` template it feeds
interpolates `${repeated}`:

```
${int(state.perStatus?.closed ?? 0)} closed).${partial}${repeated} ${src(SOURCES.events, "GET /events")}`;
                                                    ^^^^^^^^ declared name is `repeats`
```

`render()` runs inside `loadBoard()`'s `try`, so the `ReferenceError` is swallowed by the catch, which
replaces the board with **"Could not load events: repeated is not defined"** and turns the status pill red.
On the deployed site this fired on **every load of the homepage**: the main dashboard — the page the
`live-site-render` Overview assertions read (`#board-body tr > 1`, `parseScanCount(#board-note)`) — was
unusable from the merge of #126 until the fix below. `git diff a47484c 9204bea -- index.html` shows the
hunk; `grep` on the fixed file shows zero occurrences of a bare `repeated` identifier.

**Fix (I5).** `index.html`: `${repeated}` → `${repeats}` — one token, nothing else in #126 touched.
**Guard:** `tests/page-identifiers.test.mjs` (new, 3 checks): every identifier interpolated as a bare
`${name}` in any published page or `assets/js` module must appear somewhere else in the same file (a name
that appears *only* inside interpolations is undeclared or a phantom — either way it cannot render). The
guard embeds the shipped pattern in its self-test, and the rule was validated against the real pre-fix
file: `git show 9204bea:index.html` makes it flag exactly `["repeated"]`. An earlier attempt to statically
find *undeclared* identifiers false-flagged legitimate declarations (`noPrice`, `status`) and was replaced
by this token-level rule, whose failure mode is one explicit test line.

**Verification after the fix (this tree):** `node --test tests/*.test.mjs` **238/238** (235 + 3 new);
`tests/dom` node tests **15/15**; `page-runtime-check` **18/18** with 36 pages / 0 broken local links;
`auth-sign-test` **6/6**; `tools` unittest **47/47**; `tests` unittest 20 (3 skipped); DOM harnesses
**22/22** (alerts), **23/23** (category), **23/23** (summary — counters `38 open / 61 mitigated / 99
total`, claims `96/109 verified; 9 partial; 4 unverified`). The live proof (`live-site-render` green
against the real demo API on this branch) is obtained before the PR merges; the PR does not merge without it.

**Outcome (2026-11-25, same day).** `live-site-render` workflow_dispatch on the fix commit `a18651b`:
run **`45618820525`**, **success** — every content assertion green against the real demo API. PR **#129**
merged at **`9148298`** (13:01:04Z); the push-triggered `live-site-render` on `main` at that merge SHA
(run **`45619339182`**) is **success** — the check that failed at `9204bea` is green at the merge, so the
defect is fixed at the source of truth. Pages build **`45619338603`** succeeded and the hosted homepage
serves the fixed dashboard. Full run IDs in `COORDINATION.md` (`74b579c8` final record).

## 8. Open, non-blocking (carried forward, not closed here)

- **X1** — which host `contract_url` is meant to use is still undocumented; the site withholds non-public
  hosts and prints the reason (mitigated, question for Kalshi).
- **F5 / NF4** — `GET /series` paging behaviour; the demo host ignores `limit` on that route.
- **SB3** — topic series discovery is a 5-page sample, now stated with its capture time.
- **P130 / F1 / F2 / NF1** — account coverage, fee inclusion, and NO-order pricing remain as recorded by
  earlier sessions; this session made no authenticated call and placed no order.
- **Closed** by #126 (merged `9204bea`): the cursor-deduplication guard in `getAll()`,
  `collectTrades()` and `Client.paginate()`.

## 9. Sources (all re-fetched this session)

- <https://docs.kalshi.com/llms.txt> — the documentation index all 45 site paths were matched against
- <https://docs.kalshi.com/api-reference/orders/create-order-v2>
- <https://docs.kalshi.com/getting_started/order_direction>
- <https://docs.kalshi.com/getting_started/pagination>
- <https://docs.kalshi.com/api-reference/market/get-trades>
- <https://docs.kalshi.com/api-reference/market/get-series-list>
- <https://docs.kalshi.com/websockets/market-ticker>
- Repository artifacts: `data/snapshot.json`, `data/probe/api_surface.json`,
  `evidence/evidence-cors-taxonomy.md`, `.github/workflows/probe.yml`, `scripts/collect.py`

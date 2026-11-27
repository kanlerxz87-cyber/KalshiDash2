# Verification report — session `bc28428d` (2026-11-27 UTC)

Branch `arena/bc28428d-kalshidash2`, base `main` @ `db91232`.
Independent line-by-line review of the published site and its modules, plus one defect found and fixed.

---

## 0 · Method and the one hard constraint

The review used the repository's own harnesses (they execute the shipped modules, so a rename or a deleted
export fails a check rather than ageing quietly), plus direct reading of the source and of the official docs.

**Constraint observed, not worked around.** This sandbox cannot reach `*.kalshi.co`. `curl` to both demo
hosts fails at the TLS handshake:

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://external-api.demo.kalshi.co/trade-api/v2/exchange/status
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to external-api.demo.kalshi.co:443
000
$ curl ... https://demo-api.kalshi.co/trade-api/v2/exchange/status
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to demo-api.kalshi.co:443
000
```

Every prior session recorded the same restriction. **No live market figure is transcribed in this report.**
Live behaviour is delegated to the repo's Actions workflows, which run on GitHub runners with reachable
network (`live-site-render`, `verify-live-site`, `verify-alerts`, `live-engine-check`, `live-ws-check`).

Official documentation **was** reachable and was re-read for the contract checks in §2.

---

## 1 · The defect found and fixed (A1)

### What it was

`assets/js/alert-engine.js` de-duplicated swings on

```js
const key = `${s.ticker}|${s.from.toFixed(2)}|${s.to.toFixed(2)}`;
```

— **no time and no basis in the key**, and `this.seen` lives for the whole page session. So for any given
market, a swing between the same two prices could be reported **once and never again**.

A contract trading `0.40 → 0.55 → 0.40 → 0.55` has produced **four** genuine $0.15 moves. The engine reported
two. A fuller retracement (`0.40 → 0.55 → 0.45`) had its second leg suppressed too, because the pair
`(0.55 → 0.40)` had already been seen.

### Why it matters here specifically

`AlertEngine` is the reusable half of the alerting system. The **Strategy Tester's live paper trader**
(`simulator.html` → `paperEngine = new AlertEngine({...})`) and `tools/verify/live-engine-check.mjs` both
consume it. The dropped moves are exactly the round trips a strategy is being tested on, so the paper trader
under-counted entries in a way that biases towards quieter markets.

`alerts.html` itself was **not** affected: it uses its own detector (`detectMoves` in
`assets/js/alerts-core.js`) which keys nothing and reports every poll-to-poll delta. That is asserted in §3.

### Reproduction before the fix

Driven through the real module with a stubbed `fetch` and a moving price:

```
swings delivered: 2
   observed between polls 0.4 -> 0.55 delta 0.15
   observed between polls 0.55 -> 0.4 delta -0.15
EXPECTED: 4 (same-price retracements are distinct real moves)
```

### The fix

The key now carries the observation context:

```js
const pair = `${s.ticker}|${s.from.toFixed(2)}|${s.to.toFixed(2)}`;
const key = s.basis === "observed between polls"
  ? `poll|${pair}|${this.pollSeq}`   // a new scan is a new measurement
  : `ref|${pair}`;                   // the daily reference only moves once a day
```

* **Poll-to-poll moves** key on the scan (`this.pollSeq`, incremented once per completed scan). A repeat in
  the *same* scan is still collapsed — the exchange serves one price per market per response — but a repeat on
  a later scan is a real, new move and is reported.
* **Reference swings** (`previous_price_dollars`, which the market schema describes as the last traded YES
  price *a day ago*) keep the pair-only key. That value only changes when the day rolls, so re-reporting it on
  every poll would flood the feed with the same 24-hour move. When the reference value itself changes, the new
  pair is reported.
* The two bases are now kept **apart**. Previously an exchange-reference swing and a poll-to-poll swing over
  the same `(from, to)` pair collided, so whichever arrived second was discarded — even though they are
  measurements against two different references. `alerts.html` already treats them as independent (it keeps a
  separate `S.refSeen` set); the engine now matches that behaviour.

After the fix, the same reproduction yields `4` swings with the four expected `(from → to)` pairs.

### The guard

`tests/alert-engine-dedupe.test.mjs` (new, 4 checks) drives the real module with a stubbed `fetch`:

| Check | What it pins |
|---|---|
| `a retracement is a new swing, not a duplicate` | the exact four-move sequence yields four alerts |
| `one scan never reports the same pair twice` | the fix does not turn the feed into a flood |
| `the two documented comparisons are independent measurements` | both bases report for the same price pair |
| `the daily reference does not re-fire on every poll` | 1 report over 6 polls; a **changed** reference reports again |

**The guard was shown to fail on the pre-fix file** (`git stash` of `alert-engine.js`, test re-run):

```
not ok 1 - a retracement is a new swing, not a duplicate
ok     2 - one scan never reports the same pair twice
not ok 3 - the two documented comparisons are independent measurements
ok     4 - the daily reference does not re-fire on every poll
# pass 2
# fail 2
```

That is the point of a guard: it is a test that already fails on the code that shipped.

`tests/ci-coverage.test.mjs` then correctly failed with
`these guards no workflow runs, so they can never fail a build: alert-engine-dedupe.test.mjs`, so
`.github/workflows/site-check.yml` gained a named step alongside the existing named-guard steps. All workflow
YAML re-parsed after the edit.

### No Kalshi fact is asserted by the fix

The change compares the two fields the engine already read. Their meaning is taken from
[Get Market](https://docs.kalshi.com/api-reference/market/get-market) — `last_price_dollars` (most recent
trade) and `previous_price_dollars` (the exchange's own reference) — and the "a day ago" reading of the latter
was already recorded and disclosed as Flagged **Z1** in an earlier session. This session adds no new claim and
changes no register, so the published counters are unchanged (§2).

---

## 2 · What was checked and agreed with the official sources

| # | Check performed | Result | Official source |
|---|---|---|---|
| 2.1 | `AlertEngine` reads `last_price_dollars` / `previous_price_dollars` and computes both comparisons from documented fields | correct; field names match the schema | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) |
| 2.2 | Order body built by `KalshiClient.createOrder` | matches the documented body: `ticker`, `side` (`bid`/`ask`), `count` and `price` as fixed-point **strings**, `time_in_force`, `self_trade_prevention_type`, `client_order_id`; route `POST /portfolio/events/orders` | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) |
| 2.3 | `side` semantics | matches the doc's note that the field is YES-leg vocabulary: `bid` = buy YES, `ask` = sell YES (≡ buy NO at `1 − price`). Code comment says the same | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) |
| 2.4 | `exchange_index` handling | matches the doc's auto-routing note — omitted unless the caller supplies it, so a stale shard is never guessed | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2), [Exchange sharding](https://docs.kalshi.com/getting_started/exchange_sharding) |
| 2.5 | Alert threshold is `$0.10` **inclusive**, float-safe, and read from one module | correct: `THRESHOLD = 0.10` in `alerts-core.js`; `alerts.js` renders the brief check from that constant; `trace.js` re-reads it and fails the matrix if the page and engine disagree | project brief; measured, no Kalshi fact |
| 2.6 | Claims register counts | `114` entries = `102 verified` + `9 partially verified` + `3 unverified` — **matches** `README.md` exactly | recomputed from `assets/js/claims.js` |
| 2.7 | Flagged register counts | `106` cards; from each card's own `<h3>`, `40 open` (`.tag.warn`) + `66 mitigated` (`.tag.yes`), 0 cards with any other/multiple status — **matches** `README.md`'s "40 open / 66 mitigated / 106 total" | recomputed from `flagged.html` |
| 2.8 | Every register row carries an official source link | enforced by `tests/dom/summary-dom.mjs` (each summary row's evidence must contain a `docs.kalshi.com` / `kalshi.com` link or be labelled a project decision) — passes | run locally |

**Deliberately not claimed:** anything requiring an authenticated demo account or a live price (§0).

---

## 3 · Local verification on this branch (after the fix)

| Harness | Result |
|---|---|
| `node --test tests/*.test.mjs` | **270 / 270** pass (266 before + 4 new) |
| `tests/dom` (`npm ci && npm test`) | **55 / 55** (alerts 26, summary 5, category 24) |
| `tools/check_site_links.py .` | **36 pages, 0 broken** local links or anchors |
| `tools/verify/page-runtime-check.mjs` | **18 / 18** pages run clean, 0 page errors |
| `python3 -m unittest discover -s tools` | **55 / 55** |
| `python3 -m unittest discover -s tests` | **28 run (24 pass, 4 skipped)** — the skips are the live-WebSocket tests, which need network |
| `node evidence/auth-sign-test.mjs` | **6 / 6** signing checks |
| Workflow YAML | all files under `.github/workflows/` re-parse cleanly |

---

## 4 · Irregularities recorded (not fixed here, out of scope)

| ID | Observation | Why it was not changed here |
|---|---|---|
| B1 | `alerts.js` keeps polled moves in an unbounded-but-capped in-memory log; reloading the tab loses the feed and the `S.prev` baseline. This is disclosed on `alerts.html` ("Polling only runs while this page is open") and cross-referenced by suggestion **S13**, so it is a known, published limit rather than an unreported one. | Published and disclosed; changing it is a feature (S13), not a correction. |
| B2 | `alerts-core.js` `mergeAlerts` collapses across two *different* alert objects, so a poll-to-poll move and a reference swing over the same `(from, to)` pair cannot both appear in the **same** poll's output list, although they can both appear across polls. The two bases are also counted separately on the page's own basis line (`categoryBasis`), so nothing is mislabelled. | This is a presentation choice inside a well-tested module with its own DOM suite (26 checks). Changing it would alter a published feed shape without a live run to validate against (§0). Recorded for review. |
| B3 | `docs/` (the superseded generation) is still reachable directly and still contains its old tables. `docs/index.html` redirects to the current site and Flagged **Y10** records the decision. | Deliberate, documented, and outside this session's scope. |

---

## 5 · Sources used in this report

| Ref | Source | Used for |
|---|---|---|
| S1 | [Get Market](https://docs.kalshi.com/api-reference/market/get-market) | `last_price_dollars`, `previous_price_dollars` and the fields the engine compares |
| S2 | [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2) | order body, `side` semantics, `exchange_index` auto-routing |
| S3 | [Exchange sharding](https://docs.kalshi.com/getting_started/exchange_sharding) | auto-routing / shard caveat referenced by the client comment |
| S4 | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | which host the site reads (demo only) |

All four were fetched on 2026-11-27. No source is paraphrased into a market figure anywhere in this report.

---

## 6 · Second defect found in the live report itself (fixed here)

### The contradiction

`reports/live-engine-check.md`, committed by the `live-engine-check` workflow on
2026-11-27T22:31:01Z, published these lines **in the same section**:

```
- Swings of $0.10 or more detected: 0
- Largest single move against the exchange's previous price: +0.14 on `KXTVSEASONRELEASETHELASTOFUS-26-APR`
```

A report that says "no swing met the threshold" immediately above a $0.14 move is contradicting itself. Neither
line was individually wrong — they measured **different populations**:

* the swing count came from `AlertEngine`, which scans only markets whose `status` is `active` or `open`
  (`assets/js/alert-engine.js`: `if (!["active", "open"].includes(m.status)) continue;`);
* the "largest move" diagnostic was built by a bare loop over `engine.lastEvents` with **no status filter**.

The `+0.14` market was one the engine had deliberately skipped, so the count of `0` was correct *for the engine's
population* and the diagnostic was correct *for a wider one*. The pair is what misleads.

### Reproduction

Driven against the real module, with the same shape the live run saw:

```
engine reported: (none)
engine markets counted: 0
report diagnostic population: 2 largest: { ticker: 'KXTV-OPEN', d: 0.14 }
```

The control — the identical `$0.14` move on a market with `status: "active"` — *is* reported by the engine
(`KXTV-OPEN 0.7->0.84 (exchange previous_price_dollars)`), which confirms the status gate is the difference and
not a broken stub.

### The fix

`tools/verify/live-engine-check.mjs`:

* one named constant, `const ENGINE_STATUSES = ["active", "open"];`, instead of a re-typed list;
* the diagnostic filters on it **before** a market can become the "largest move";
* markets excluded by status are collected in `skippedByStatus` and reported with a count, so the exclusion is
  visible rather than silent;
* the count's own label now states the population it was measured over.
* `reports/live-engine-check.md` itself is regenerated by the workflow — it is **not** hand-edited here, because a
  hand-written "live" report would be exactly the kind of unverified value this site refuses to publish.

### The guard

`tests/live-engine-report-consistency.test.mjs` (3 checks): the status scoping, the disclosure of exclusions, and
a behavioural proof that an `active/open`-only scan ignores a market outside those statuses while the control
market is reported. Shown to fail on the pre-fix script (`git stash` of the script):

```
not ok 1 - the report scopes its move diagnostic to the statuses the engine scans
not ok 2 - a market excluded by status is counted and disclosed, never silently dropped
ok     3 - a market outside active/open produces no swing, ...
# pass 1
# fail 2
```

Wired into `site-check.yml` as a named step; `tests/ci-coverage.test.mjs` would otherwise flag it as an orphan
guard, and all workflow YAML re-parsed after the edit.

**Why the earlier board note was corrected.** The first version of the `bc28428d` board record repeated the
report's framing ("0 poll-to-poll swings … largest move +0.14") without noticing that the two numbers came from
different populations. That paragraph was rewritten to state the contradiction and to point at this section.
Correcting my own note is the same rule as correcting a page: the claim was wrong, so it was fixed and logged,
not left standing.

---

## 7 · Third defect: the live-check workflow did not keep its own promise (fixed here)

### What was observed

After §6 merged, `live-engine-check` on `main` at `19853f1` failed twice in a row
(runs **46079257668** at 22:52:49Z and **46079375710** at 22:54:03Z) on the step *Run the live engine check*.

The same script **succeeded at 22:48:20Z on `97eda74`**, and the only commits between the two are `COORDINATION.md`,
`reports/verify-3e859f7c.md` and `reports/verify-facts-v3.md` — no code, yml or data file. So the failure is
**not** attributable to the §6 change, and `main` has produced that check successfully on other commits the same
evening. What it is attributable to could not be established from here: the job logs are not readable from this
sandbox (`blob.core.windows.net` is outside its allowlist — `EOF` on every attempt).

### The defect that made it undiagnosable

The workflow's own header says:

> "The report is committed even when the check fails, so a red run still leaves evidence behind."

It does not. The `Commit the report` step has no `if: always()`, so GitHub **skipped** it:

```
1. Set up job → success
2. Run actions/checkout@v4 → success
3. Run actions/setup-node@v4 → success
4. Run the live engine check → failure
5. Commit the report → skipped
```

The one artefact that would have made the red run diagnosable — the partially written report, which shows how far
the script got (alert engine done? simulator history? candles?) — was discarded by the workflow's own default. The
comment promised the opposite, so nobody looking at the workflow would have known to check.

### The fix

`.github/workflows/live-engine-check.yml`: `Commit the report` now carries **`if: always()`**. The check step
still fails the job on a real failure (no `continue-on-error`), so the run stays red; the report is committed
alongside it, exactly as the header claims.

`tests/live-engine-workflow.test.mjs` (2 checks) pins both halves: the commit step must carry `if: always()`, and
the workflow must not neutralise a failure with `continue-on-error`. Shown to fail on the pre-fix workflow
(`git stash` of the yml): `not ok 1 … / # pass 1 / # fail 1`.

Wired into `site-check.yml` as a named step; all workflow YAML re-parsed.

### What this session does not claim

**This session does not claim to have fixed the live-engine failure itself.** It fixed the reason the failure
could not be read. The next green `live-engine-check` run — which commits its report either way — will say what
failed. That is recorded here rather than guessed at, in line with the rule against inventing a diagnosis.

---

## 8 · Final results, and what the live exchange then did (2026-11-27)

Three PRs, all merged without waiting for review, all deployed, all with a guard that was shown to fail on the
code it replaces.

| PR | Merged at | What it fixed |
|---|---|---|
| [#149](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/149) | `6a54db8` (22:30:52Z) | `AlertEngine` reported a price pair only once per page life |
| [#157](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/157) | `97eda74` (22:48:18Z) | the live-engine report counted its move diagnostic over a wider population than the engine scans |
| [#162](https://github.com/kanlerxz87-cyber/KalshiDash2/pull/162) | `2069daa` (22:59:38Z) | the live-engine workflow skipped its own report-commit step on failure |

### §6 proven on the live exchange, not just in a test

The `live-engine-check` run at **23:01:26Z** (success) regenerated `reports/live-engine-check.md` on `main` with
the fixed script. The two lines that used to contradict each other now reconcile exactly:

```
- Markets in the five topics: 2741
- Markets with a readable previous price (status active or open): 2741
- Excluded from that count: 8 market(s) ... whose status is outside active/open
- Largest single move against the exchange's previous price: 0.00 on `KXNEXTNATOSECGEN-99-KIOH`
```

Before the fix the same section read *2,749* readable prices against *2,741* scanned markets, drew its "largest
move" from the 8-market difference, and printed **+0.14** directly beneath **"Swings: 0"**. Now the population
is named, the 8 exclusions are counted and disclosed, and the largest move (**0.00**) is one the engine actually
looked at. The fix is verified against live data, which is the only verification that counts for a live report.

### §7's failure did not reproduce — and that is recorded, not hidden

The two red `live-engine-check` runs (22:52:49Z, 22:54:03Z) did **not** recur: the next run on the same merged
tree passed at **23:01:17Z**. So the cause was transient (most plausibly an exchange-side or runner-side
condition during those two minutes) and this session never claimed otherwise. What was fixed is what could be
proved from here: the workflow now commits its report on a failed run too, so the next occurrence will leave
evidence instead of nothing.

This is the honest resolution of the episode: **two fixes that are proved, and one transient failure that is
documented as transient rather than dressed up as a diagnosis.**

### Deploy state

Pages `status: built`, `error: null` after each merge (`build_type: legacy`, source `main:/`), with
`verify-alerts`, `verify-live-site`, `live-site-render` and `Static site link check` green on `main`. The
deployed `assets/js/alert-engine.js` was re-read over HTTPS and serves the fixed module (`pollSeq` and the new
`poll|…|pollSeq` / `ref|…` key), so the §1 fix is live and not merely committed.

### Local suite at the end of this session

`node --test tests/*.test.mjs` **290/290** (260 at the start, +4 dedupe, +3 report-consistency, +2 workflow
contract, plus the guards other sessions added meanwhile) · `check_site_links.py` **36 pages / 0 broken** ·
`page-runtime-check` **18/18** clean · `tests/dom` **55/55** · Python `tools` **55/55** · `tests` 28 run
(4 network-gated skips) · `auth-sign-test` **6/6** · every workflow YAML parses.

### Still open, deliberately

F1/F2 (no authenticated order — no demo key exists in this repo or this session), the transient live-check
condition above, and every pre-existing item already published on `flagged.html`. None of them blocks the merge,
per the standing rules; they are listed here so nothing found in this session disappears into a commit message.

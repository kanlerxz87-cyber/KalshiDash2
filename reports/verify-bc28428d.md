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

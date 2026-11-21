# Independent verification report — session `5a9b44b9`

Date: 2026-11-21 (UTC) · Branch: `arena/5a9b44b9-kalshidash2` · Base: `main` @ `bbdc3a0`
Scope: topic taxonomy (gas, elections, culture, crypto, golf), the official source URLs the site
renders, and every claim the repository makes about those topics. Read-only on the live pages.

Everything below was checked against an official Kalshi source fetched during this session, or
against data the repository itself captured from the official demo API and committed. Nothing is
inferred. Where a value could not be confirmed, it is recorded as **unverified** and left alone.

---

## 1. Sources fetched this session (2026-11-21)

| # | Official source | What it was used for |
|---|---|---|
| S1 | [llms.txt — documentation index](https://docs.kalshi.com/llms.txt) | Canonical list of official pages. Every `SOURCES` URL in `assets/js/config.js` was matched against it. |
| S2 | [Test In The Demo Environment](https://docs.kalshi.com/getting_started/demo_env) | Demo REST/WS roots and alternates; mock funds; credentials not shared with production. |
| S3 | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | `/series` query parameters (`category`, `tags`, `include_product_metadata`, `include_volume`, `min_updated_ts`), exact/case-sensitive matching, `category` matches any entry in `categories`, and the `Series` schema (`category` = primary category, `categories` = discovery list). |
| S3b | [Get Series](https://docs.kalshi.com/api-reference/market/get-series) | `GET /series/{series_ticker}?include_volume=true` returns `{series: …}`; used to fetch `KXGAS`, which discovery filters cannot reliably return. |
| S4 | [Market Settlement](https://docs.kalshi.com/getting_started/market_settlement) | YES holders receive $1 per contract on a yes outcome; NO holders $1 on a no outcome; only net positions settle. |
| S5 | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | `period_interval` ∈ {1, 60, 1440}; `start_ts`/`end_ts` required (as indexed in S1). |
| S6 | [Market Ticker WebSocket](https://docs.kalshi.com/websockets/market-ticker) and [WebSocket Connection](https://docs.kalshi.com/websockets/websocket-connection) | Channel names and handshake authentication (as indexed in S1). |

Verbatim checks against S2 and S4:

- S2: “Demo's recommended Trade API root is `https://external-api.demo.kalshi.co/trade-api/v2`”; the
  table lists `https://demo-api.kalshi.co/trade-api/v2` and `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`
  / `wss://demo-api.kalshi.co/trade-api/ws/v2` as also supported. **Matches** `DEMO` and `ALTERNATES`
  in `assets/js/config.js` exactly.
- S2: demo “has mock funds”; “credentials are not shared between this environment and production”.
  **Matches** the two `demo_env` claims in `assets/js/claims.js`.
- S4: “**Yes outcome**: Yes contract holders receive \$1 per contract”; “**No outcome**: No contract holders
  receive \$1 per contract”. **Matches** the simulator's $1/$0 settlement scoring.
- S3: `/series` documents **no ticker-prefix parameter**. Any series-family rule must therefore be
  applied after the official query — which is exactly what the repair in §3 does.

### 1.1 Official URLs in `assets/js/config.js::SOURCES`

All 28 entries resolve to a page listed in the official index (S1). No moved or removed URL was
found this session. Examples checked line by line: `demo_env`, `api_environments`, `api_keys`,
`quick_start_authenticated_requests`, `quick_start_create_order`, `create-order-v2`,
`order_direction`, `orderbook_responses`, `get-market-candlesticks`, `get-markets`, `get-events`,
`get-series-list`, `get-series`, `get-exchange-status`, `get-market`, `get-balance`, `get-fills`,
`get-positions`, `get-orders`, `rate_limits`, `quick_start_websockets`, `fixed_point_migration`,
`market_settlement`, `market_lifecycle`, `historical_data`, `exchange_sharding`, `fee_rounding`,
`terms`; plus `websockets/market-ticker` and `websockets/websocket-connection` used by the live feed.

### 1.2 Known, previously published irregularities re-checked

- Truncated URLs `https://docs.kalshi.com/api-reference/orders/create-ord` and `https://www.politi`
  exist **only** inside raw captures under `evidence/` and `reports/`; they are already published as
  **X4 / F-X2** on `flagged.html` and were deliberately not edited. Confirmed this session by
  `grep -rn` (see §5). No action.
- `previous_price_dollars` semantics remain as corrected by session `3b869340` (flag **Z1**).

---

## 2. What the site claims about the five topics, and what the data shows

| Topic | Site rule (`assets/js/config.js` + `market.js::classifyEvent`) | Official basis | Result |
|---|---|---|---|
| Gas | series `^KXA{3}GAS` **or** gas-price title, with crude / natural-gas / diesel / Vegas excluded | No category covers gasoline (S3; probe vocabulary in `data/probe/api_surface.json` lists no Gas/Gasoline value); series/tags are the documented vocabulary fields | Correct: `AAAGAS*` series are still caught by the title patterns (`/gas price/i`), so the narrower series regex does not lose legacy AAA gas series. Verified against the committed series rows. |
| Elections | category `Elections` | S3 `category` filter, exact/case-sensitive | Correct |
| Culture | categories `Culture`, `Entertainment`, `Social` | S3; probe vocabulary lists `Culture` (4 series), `Entertainment`, `Social` | Correct, with one caveat — see **R2** |
| Crypto | category `Crypto` | S3; probe vocabulary lists `Crypto` | Correct |
| Golf | category `Sports` narrowed to golf series/titles | S3; probe vocabulary has no golf category, tag `Golf` exists | Correct |

---

## 3. Findings that were repaired in this session

### R1 — The collector and the dashboard used different topic rules

`scripts/collect.py` selected:

- **Gas** by the official tags `Gas`, `Oil & Gas`, `Oil and energy`, with no exclusions.
- **Culture** by the category `Culture` only.

Consequences in the committed snapshot (`data/snapshot.json`, generated 2026-11-21T19:29Z):

| Observed in `data/snapshot.json` | Contradicts |
|---|---|
| Gas topic contains 40 series including `KXWTI`, `KXWTIW`, `KXBRENTW`, `KXBRENTD`, `KXNATGASW`, `KXNATGASD`, `KXDIESELMON`, `KXDIESELD`, `KXTXERCOTPEAK`, `KXSOLAR`, `KXBARRELS`, `KXOILRIGS`; 10 of its 41 events are `KXWTIH` | The dashboard's documented gas rule, which excludes crude, natural gas, diesel, WTI/Brent, oil and Vegas rows |
| Culture topic: **2 series, 0 events, 0 markets** | The dashboard's rule covering `Culture` + `Entertainment` + `Social`; the probe shows `Entertainment` has 5,255 series |

Repair (in this branch):

- `scripts/collect.py` now discovers candidates with **official category filters only** — Gas:
  `Economics` + `Commodities`; Culture: `Culture` + `Social` + `Entertainment` — plus a documented
  direct lookup (`GET /series/KXGAS`, S3b) for the EIA weekly retail-gasoline series that carries no
  tag. It then applies the same explicit local rule as the dashboard. The API has no ticker-prefix
  filter (S3), so the series-family rule is applied locally and **can only narrow** the official
  candidate list. `KXGAS` does not occur anywhere in the committed snapshot (`grep -c` → 0), which
  independently confirms session `32b15793`'s AB1 finding that tag discovery could never return it.
- Replaying the new Gas rule over the committed 40-series list keeps exactly the 17 gasoline series
  (`KXAAAGASW`, `KXAAAGASM`, `KXAAAGASD`, `KXAAAGASMTX`, `KXAAAGASMINCA`, `KXAAAGASMINTX`,
  `KXAAAGASWNJ`, `KXAAAGASDGA`, `KXAAAGASMAXCA`, `KXAAAGASMAXTX`, `KXAAAGASDOH`, `KXAAAGASDMI`,
  `AAAGASM`, `AAAGASMIN`, `AAAGASMAX`, `AAAGASMINCA`, `AAAGASMAXCA`) and drops all 23 oil/energy
  rows. Verified by executing `collect.collect_series` against the snapshot rows.
- `topic_rules` in the snapshot metadata was reworded so it no longer claims “never free-text
  matching” while a gasoline series-family rule is in fact applied; it now states that local rules
  only narrow official candidates. Because `main` now enforces exact generator↔snapshot equality,
  the **only** change to `data/snapshot.json` is that one note string — verified with `diff`, which
  shows no other line (no captured API value, timestamp, call count or source URL) altered.

**Does not add any value that is not returned by the official API.**

### R2 — Demo data can put a natural-gas series under `Entertainment`

`data/snapshot.json` series row: `KXNATGASD` — title “Natural Gas Daily”, primary `category`
`Entertainment`, tags `["Oil & Gas"]`.

Because the Culture rule accepts the `Entertainment` category (correctly — most Entertainment series
are film/TV/music), a demo market about natural gas can appear on the Culture page. This is demo data
noise, not a matcher bug: the series genuinely carries that category. **Published for review** — do
not silently special-case it, because excluding titles inside `Entertainment` would be an undocumented
heuristic.

### R3 — The two red metadata checks on `main` (resolved upstream; duplicate dropped here)

At `bbdc3a0` two assertions were red because the snapshot's note wording had drifted from the
sentences the tests expected. While this session was working, session `e2718295` landed the better
fix on `main` (`4df6552`, `f25ecd7`): the disclosure text now lives in one constant
(`DERIVATION_NOTES`), the required phrases were restored in both generator and snapshot, and an
exact generator↔snapshot drift test plus a CI gate were added.

**This session's duplicate sentence-level fix was therefore dropped during the rebase onto
`91754f1`.** `tests/activity-proxy.test.mjs` and the metadata assertions in
`tools/test_collect.py` are exactly `main`'s version; only the three new taxonomy tests below were
re-applied. The ledger:

| Test | `main` @ `bbdc3a0` | `main` @ `91754f1` |
|---|---|---|
| `node --test` | 72/73 | 73/73 |
| `python3 -m unittest discover -s tools` | 27/28 | 30/30 (33/33 after the three new taxonomy tests) |

### R4 — Three published statements contradicted the repository's own evidence

| Location | Statement (before) | Contradicted by | Repair |
|---|---|---|---|
| `assets/js/claims.js` (topic register, “No gas-price category”) | evidence: “Live: 0 gas-price events in the open-event scan”, marked **verified** | The same file's later claim “A live gas-price event exists on the demo exchange” (`KXAAAGASW-26NOV23`, 2026-11-20) and `assets/js/config.js`, which records that the zero-count caveat was removed as false | Evidence now cites the captured category vocabulary (no Gas/Gasoline value) and the dated classification cases; the contradicted zero-count assertion is explicitly retired in the text. Status stays `verified` because the vocabulary capture supports the claim itself. |
| `assets/js/config.js` (Crypto topic note) | “Matched on Kalshi category `Crypto` (only 2 live events in the demo scan).” | The 2026-11-21 snapshot holds 86 crypto events across 40 series; the “2” came from an undated single-page scan | Count removed; the mapping rule remains. A comment records why a fixed number cannot be shown. |
| `assets/js/config.js` (Elections topic note) | “Matched on Kalshi category `Elections` (740 of 1,000 live events scanned).” | Correct for the 2026-11-20 capture but presented as a standing fact | Count removed from the page note; the dated capture is cited in `claims.js` and `reports/verify-facts-v3.md` §G. |
| `questions.html` (Q2) | `dontknow`: “`Culture` and `Gas prices` are not category values”; answer omitted `Culture` | Probe vocabulary lists `Culture` (4 series); `claims.js` already records the corrected mapping | Q2 now states that a category named `Culture` exists (4 series) and that Culture maps to Culture + Entertainment + Social; only “Gas prices” is described as not being a category. |

---

## 4. Irregularities recorded, not changed (for review)

| ID | Item | Evidence | Why not changed here |
|---|---|---|---|
| R5 | `.github/workflows/collect.yml` header says the snapshot “backs the repo's verification tables and the site's offline fallback”, but no published page reads `data/snapshot.json` (`grep -rn "snapshot" assets/js/*.js *.html` finds only prose in `flagged.html` and `suggestions.html`) | grep this session | Documentation in a workflow file owned by CI; a wording correction, not a data defect. Logged for the integration session. |
| R6 | Per-topic `/series` discovery is capped at 5 pages (`collect_series`, `max_pages=5`) while `Entertainment` alone has 5,255 series; the returned page order is not volume-ordered, so “top 40 by volume” is really “top 40 by volume among the first pages returned” | S3 (no ordering guarantee documented); `data/probe/api_surface.json` counts | Increasing the cap multiplies runtime for every scheduled run; the snapshot already labels coverage as sampled. Recorded so the claim “top series by volume” is not over-read. |
| R7 | Culture/Entertainment sub-classification is category-level only; a “culture war” elections series is not moved into Culture | probe tag `Culture war`; `categoryPatterns` in `config.js` | Changing membership would be a product decision, not a factual correction. |

---

## 5. Reproducible checks run on this branch

```
node --test                                   73/73 pass
python3 -m unittest discover -s tools -p ...  33/33 OK   (30 from main + 3 new taxonomy tests)
python3 -m unittest discover -s tests -p ...  18 OK (3 skipped: cryptography absent)
node tests/dom/alerts-dom.mjs                 16/16 checks pass
node --test tests/dom/summary-dom.mjs         pass (counts derived from claims.js)
node tools/verify/page-runtime-check.mjs      17/17 pages, 34 links, 0 broken
python3 tools/check_site_links.py .           34 HTML pages, 0 broken local links
node evidence/auth-sign-test.mjs              6/6 checks pass
git diff --check                              clean
```

Rebase note: this branch was rebased from `bbdc3a0` onto `origin/main` `91754f1` after four other
sessions merged. Every duplicate of their work was dropped (see R3); nothing of theirs was reverted.

Note on `tests/dom/live-site.mjs`: it is a **live-network** harness and times out in this sandbox
(outbound access to `kalshi.co` is blocked by the environment, as every earlier session recorded).
Session `f2176447` holds the exclusive claim on that file and is repairing it; this session did not
touch it.

## 6. Requests to the final-integration session (`f2176447`)

1. Publish **R2** (demo `Entertainment` category carrying a natural-gas series) as a flag card with
   the source link [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list)
   and the captured row `KXNATGASD` in `data/snapshot.json`.
2. Publish **R5** and **R6** as flag cards, with `collect.yml` / `collect_series` as the evidence.
3. After this branch merges, dispatch `collect` and confirm the regenerated snapshot shows
   non-empty Culture and gasoline-only Gas (task **V5**), then record the run ID on this board.
4. No change to `flagged.html` was made by this session: it is a shared output reserved for the
   integration session.

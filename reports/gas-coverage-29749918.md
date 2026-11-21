# Gas-price coverage audit — session `29749918` (task GC1)

**Date of evidence:** 2026-11-21 (UTC), fetched during this session.
**Board claim:** `COORDINATION.md` → "Session `29749918`", task GC1.
**Scope:** read-only. No site code, no `data/`, and no `flagged.html` were edited. Findings are logged on the board as requests for the owning sessions.

## 1. Method

- **Official API:** `https://external-api.demo.kalshi.co/trade-api/v2` (Kalshi demo REST host, as listed in the official [Demo environment](https://docs.kalshi.com/getting_started/demo_env) and [API environments](https://docs.kalshi.com/getting_started/api_environments.md) pages).
- **How it was fetched:** the sandbox shell cannot reach Kalshi hosts (`curl` returns nothing), so each URL below was read with the page-fetch tool. Every URL in the tables can be opened directly in a browser for manual review.
- **Schema references:** [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) (`tags`, `categories`, `category` filters), [Get Events](https://docs.kalshi.com/api-reference/events/get-events), [Get Market](https://docs.kalshi.com/api-reference/market/get-market) (`status`, `updated_time`), [Get Series](https://docs.kalshi.com/api-reference/market/get-series).
- **Local re-implementation:** the browser's gas rule (`assets/js/config.js` → `TOPICS` gas: series `^KXA{3}GAS`, title patterns, exclude patterns) and the collector's rule (`scripts/collect.py` → `TOPICS["gas"]`: official tags `Gas`, `Oil & Gas`, `Oil and energy`) were applied to the 40 series stored in `data/snapshot.json`. Those counts are reproducible with the Python snippet in §5.

## 2. Verdict on flag F4 ("no open gas-price markets on the demo")

**F4 is superseded.** On 2026-11-21, the live demo API returns open, active gas-price events from the AAA series family. The 2026-11-20 scan that F4 relied on is therefore out of date. Some gas events were open on 2026-11-20 as well (the comment in `config.js` records one such event). The flag should be re-titled or closed by the integration session. This audit does not change the flag itself.

## 3. Live results — open gas-related events (demo API, 2026-11-21)

| # | Series / event | Official title | Official `tags` / `category` (live) | Settlement source (official, live) | Browser rule (`config.js`) | Collector rule (`collect.py`) | Source |
|---|---|---|---|---|---|---|---|
| 1 | `KXAAAGASW` / `KXAAAGASW-26NOV23` | US gas prices this week | `["Econ Weekly","Oil and energy"]` / Economics | AAA `https://gasprices.aaa.com/` | **IN** (series prefix) | IN (`Oil and energy`) | [series](https://external-api.demo.kalshi.co/trade-api/v2/series/KXAAAGASW) · [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASW&with_nested_markets=true) |
| 2 | `KXAAAGASW-26NOV23-3.6200` (market inside #1) | "Will average gas prices be above $3.6200?" | `status: active`, `yes_bid_dollars 0.9600`, `yes_ask_dollars 1.0000`, `open_interest_fp 15652.27` | AAA | IN | IN | same URL as #1 |
| 3 | `KXAAAGASD` / `KXAAAGASD-26NOV22` | US gas prices tomorrow | (event fields: `category` Economics; `strike_date` 2026-11-22) | AAA | **IN** | IN (series tags in `data/snapshot.json`: `Oil & Gas`, `Oil and energy`, `Econ Daily`; not re-fetched live) | [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASD&limit=50) |
| 4 | `KXAAAGASM` / `KXAAAGASM-26NOV30`, `KXAAAGASM-26DEC31` | Gas prices in the US in Nov 2026? / Dec 2026? | (event fields: Economics; `strike_date` 2026-11-30 / 2026-12-31) | AAA | **IN** | IN | [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASM&limit=50) |
| 5 | `KXAAAGASWNJ` / `KXAAAGASWNJ-26NOV23` | New Jersey gas prices this week | (event fields: Economics; `strike_date` 2026-11-23) | AAA `…?state=NJ` | **IN** | IN | [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXAAAGASWNJ&limit=50) |
| 6 | `KXAAAGASMINFL` (series) | Florida lowest gas price yearly | `["Oil & Gas","Oil and energy"]` / Economics | AAA | IN (series prefix) | IN | [series list, tags=Oil & Gas](https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Oil%20%26%20Gas) |
| 7 | `AAAGASM` (series, **no `KX` prefix**) | US gas price | `["Oil and energy"]` / Economics | AAA `https://gasprices.aaa.com/` | **IN only via title** (`/gas price/i`) | IN | [series](https://external-api.demo.kalshi.co/trade-api/v2/series/AAAGASM) |

Rows 3–5 were read from the open-event lists in the tool result. The open events for `KXAAAGASD` and `KXAAAGASM` show `last_updated_ts` values of 2026-11-21 and 2026-11-13. These are event metadata timestamps, not quote times.

## 4. Gas-related series that the rules do **not** classify as gasoline (live check)

| Series | Official title | Official tags / category | Settlement source | Browser rule | Collector rule | Open events now? | Source |
|---|---|---|---|---|---|---|---|
| **`KXGAS`** | **Gas weekly** | `tags: null` · Economics | **U.S. Energy Information Agency** `https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm` — the EIA page is titled "Weekly Retail Gasoline and Diesel Prices" (U.S., dollars per gallon, including taxes) | **OUT** (no series match; title has no gas-price pattern) | **OUT** (no tags) | **No** (`events: []`) | [series](https://external-api.demo.kalshi.co/trade-api/v2/series/KXGAS) · [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXGAS&limit=50) · [EIA source](https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm) |
| `KXDIESELW` | Diesel prices this week | Economics; settlement AAA (live event); series tags in snapshot: `Econ Weekly`, `Oil and energy` | AAA | OUT (diesel exclusion) | IN | **Yes** (1 event) | [open events](https://external-api.demo.kalshi.co/trade-api/v2/events?status=open&series_ticker=KXDIESELW&limit=50) |
| `KXWTI` | WTI oil election day | `["Oil & Gas"]` · Commodities | ICE | OUT (WTI/oil exclusion) | IN | (not checked) | [series list, tags=Oil & Gas](https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Oil%20%26%20Gas) |
| `KXHOILMON` | Heating Oil Monthly | `["Oil & Gas"]` · Commodities | Trading Economics | OUT | IN | (not checked) | [series list, tags=Oil & Gas](https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Oil%20%26%20Gas) |
| `KXIAETHANOL` | Iowa ethanol production | `["Oil and energy"]` · Economics | Federal Reserve Bank of New York (SOFR page) | OUT | IN | (not checked) | [series list, tags=Oil and energy](https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Oil%20and%20energy) |

`KXGAS` is the one row where a **gasoline price** series is missed by **both** rules. Its open-event list is empty at fetch time, so the impact is latent, not current.

## 5. Snapshot audit (`data/snapshot.json`, `topics.gas`, generated 2026-11-21T19:29:02Z)

The committed snapshot stores **40** gas series out of a `series_count` of **228**. `collect.py` keeps the top 40 by default (`--top-series 40`), which is a documented truncation, not an error.

Applying the two rules to those 40 stored series:

| Result | Count | Examples |
|---|---|---|
| Matched by **both** rules | 17 | `KXAAAGASW`, `KXAAAGASM`, `KXAAAGASD`, `KXAAAGASMINCA`, `KXAAAGASWNJ` |
| Matched by **collector only** (not gasoline) | **23** | `KXWTI`, `KXBRENTD`, `KXNATGASW`, `KXNGASMAX`, `KXDIESELD`, `KXOILRIGS`, `KXSOLAR` ("Solar capcity installation"), `KXTXERCOTPEAK` (ERCOT electricity demand), `KXBARRELS`, `KXSPRUSE` |
| Matched by **browser only** | 0 | — |
| Gasoline series absent from the stored 40 | `KXGAS` (not in snapshot list) | — |

Reproduction (run from the repo root):

```python
import json,re
g=json.load(open('data/snapshot.json'))['topics']['gas']
series_pat=[re.compile(r'^KXA{3}GAS',re.I)]
title_pat=[re.compile(p,re.I) for p in [r'gas price',r'gasoline',r'gas average',r'AAA gas']]
excl=[re.compile(p,re.I) for p in [r'natural\s*gas',r'\bNATGAS\b',r'\bWTI\b',r'\bBRENT\b',r'crude',r'diesel',r'\bVEGAS\b',r'\bbarrels?\b',r'\boil\b']]
def browser_in(s):
    if any(e.search(x) for e in excl for x in (s['title'],s['ticker'])): return False
    return any(p.search(s['ticker']) for p in series_pat) or any(p.search(s['title']) for p in title_pat)
def collector_in(s): return bool(set(s.get('tags') or []) & {'Gas','Oil & Gas','Oil and energy'})
```

## 6. Irregularities (for review — none of these are edited in this session)

| ID | Irregularity | Evidence | Owner / where to fix | Suggested remedy |
|---|---|---|---|---|
| **GC-I1** | **F4 is out of date.** It states the demo has no open gas-price markets; the live API shows open AAA gas events on 2026-11-21. | §3 rows 1–6 | `flagged.html` (F4) — integration session | Re-title F4 to the current evidence, or mark it superseded and link §3. |
| **GC-I2** | **Two gas definitions disagree.** The collector's `topics.gas` (tags) and the browser's gas board (series regex + title) classify different markets. | §5: 23 of 40 stored series are collector-only | `scripts/collect.py` `TOPICS["gas"]`; `assets/js/config.js` gas entry | Pick one definition for both, or label the snapshot topic as "oil & energy (tag-based)". |
| **GC-I3** | **The collector's `gas` bucket includes non-gasoline markets:** WTI/Brent crude, natural gas, diesel, electricity demand, solar, oil rigs, SPR. The snapshot's label "Gas Prices" therefore overstates what it contains. | §5 list | `scripts/collect.py` label/tag filter; `data/snapshot.json` (regenerated only by the `collect` workflow) | Narrow the filter, or relabel to "Energy & commodities". |
| **GC-I4** | **`KXGAS` (EIA weekly retail gasoline) is missed by both rules.** It is a gasoline price series by its official settlement source. | §4 | `assets/js/config.js` (add the exact ticker to `seriesPatterns`, e.g. `/^KXGAS$/`); `scripts/collect.py` (no tag) | Add an exact-ticker rule. No open events now, so no current row changes. |
| **GC-I5** | **`AAAGASM` family (no `KX` prefix) is matched only through the title pattern.** The series regex misses it; the title `US gas price` happens to match `/gas price/i`. | §3 row 7 | `assets/js/config.js` | Add `^AAAGAS` to `seriesPatterns` so the rule does not depend on title wording. |
| **GC-I6** | **Quote freshness is not established by `updated_time`.** The live `KXAAAGASW` market record shows `updated_time` 2026-11-15, while its quotes look active. The official schema defines `updated_time` as "Time of the last non-trading metadata update" and the response is "cached for a short time". | [Get Market](https://docs.kalshi.com/api-reference/market/get-market.md) schema | Any page that shows "last updated" from `updated_time` | Do not label it as a quote time. Use the WebSocket or fresh REST fetch for current quotes. |

## 7. Limitations (stated, not hidden)

- **Live scan not run in full.** The browser's gas board scans up to 12 pages of 200 open events (`assets/js/market.js`), i.e. up to 2,400 events. This audit sampled specific series families; it did not count every open gas event.
- **Single point in time.** Results are as of the fetch on 2026-11-21 (UTC). Gas markets open and close; rerun before relying on counts.
- **No prices are published here** beyond the one market row cited in §3 row 2. Quote and liquidity values are only as current as the API cache (Get Market docs).
- **Fetch route.** The data was read through the page-fetch tool because sandbox `curl` cannot reach Kalshi hosts. A manual browser check of each URL in the tables reproduces the same results.

# Verification round 12 — session `032f1ca5` (2026-11-27)

Branch `arena/032f1ca5-kalshidash2`, base `main` @ `db91232`. This round did three things: re-ran every
local suite on the tree it inherited, re-derived the revisions and counts the published pages assert, and made
fresh read-only calls to the demo exchange. Nothing below is inferred from a previous session's report — where a
figure appears, the command or URL that produced it appears beside it.

**No price, size, balance, fill or resolution value is published by this round.** The live calls in §5 are
recorded as field presence and arithmetic, not as market facts, and nothing from them was transcribed into the site.

---

## 1. Suite results on the inherited tree (`db91232`)

| Harness | Command | Result |
|---|---|---|
| Node unit/static | `node --test tests/*.test.mjs` | **266 pass / 0 fail** on `db91232`; **270 / 0** after rebasing onto `bd464b8` (session `bc28428d` added the alert-engine dedupe guard while this round was open) |
| jsdom DOM suites | `cd tests/dom && npm ci && npm test` | **55 pass** (alerts 26, summary 5, category 24) |
| Python tools | `python3 -m unittest discover -s tools` | **55 pass** |
| Python scripts | `python3 -m unittest discover -s tests` | **28 run, 24 pass, 4 skipped** (3 live-socket opt-ins + the crypto test, absent `cryptography`) |
| Local link check | `python3 tools/check_site_links.py .` | **36 HTML pages, 0 broken** |
| Page runtime | `node tools/verify/page-runtime-check.mjs` | **18/18 pages clean**, 36-page link check |
| Web Crypto signing | `node evidence/auth-sign-test.mjs` | **6/6** |

`main` was therefore green when this round started, and the three defects in §2–§4 are prose/count defects
that no suite was asserting — which is why they survived.

## 2. The Flagged page's own status counts described the wrong set

`flagged.html`'s KPI block and the Summary headline both derived "mitigated" from the CSS class
(`.tag.yes`) rather than the word in the tag. The page uses four status words, and `.tag.yes` is worn by three
of them:

| Status word in the card heading | Cards | Counted as "mitigated" before |
|---|---|---|
| `open` | 40 | no |
| `mitigated` | 28 | yes |
| `fixed` | 38 | **yes** (mis-labelled) |
| `corrected` | 1 | **yes** (mis-labelled) |
| **total** | **106** at `db91232` (107 after this round's DR4 card) | headline read "66 mitigated", "106 items" |

The legend at the top of the page defines *mitigated* as one specific state, so the tile contradicted the page
underneath it. Fixed by counting the status word and publishing the breakdown
(`flagged.html` counts script, `summary.html` headline). `tests/dom/summary-dom.mjs` now asserts that every
card states one of the four words, that the breakdown sums to the card count, and that the headline names each
closed status with the number of cards that state it — the assertion that would have caught this originally.

Documented on the site as **Flagged DR4**.

## 3. `DR3`'s universal negative, and the pending PR that mis-cited the root commit

`DR3` said there is "no `site/` directory in this repository at any revision". That is a claim about the whole
history, and it was asserted rather than measured. Measured today, through the GitHub API (this checkout is a
**shallow** clone — `git rev-parse --is-shallow-repository` → `true` — so local history cannot answer it):

| Check | URL | Result |
|---|---|---|
| Root commit | `GET /repos/kanlerxz87-cyber/KalshiDash2/commits/6081bb7` | `6081bb7ed1a93aa588d2a7ccebdce4250bd43a4c`, *"Initial commit"*, 2026-11-20T10:57:48Z, **no parents** |
| Its tree | `GET /git/trees/6081bb7` | one entry: `README.md` — no `site/` |
| Commits touching `site` | `GET /commits?path=site&per_page=100` | **0** |
| History size at check time | `GET /commits?per_page=1&page=851` | 851 commits, oldest = `6081bb7` |

- **Irregularity (recorded, not merged):** open PR **#141** (session `d3e0e9f5`) proposes the same wording
  repair but names `1a30722` as *the root commit*. That SHA is the **merge commit of PR #130**
  (2026-11-25T13:06:13Z) and has two parents (`84cfebe`, `cad704e`). The conclusion is right; the citation is
  not. This round re-derived the measurement and attributed it to `6081bb7`, crediting the intent to #141 in
  Flagged DR4.
- **Irregularity (recorded):** PR #141 is `mergeable: false`, `mergeable_state: "dirty"`, **2 ahead / 34 behind**
  `main`, last commit 2026-11-27T17:45Z. Under the board's 60-minute rule it is stale. This session could not
  repair it (it may not push to another session's branch), so it took over only its one substantive repair and
  left the PR open for its owner to close as superseded.
- **Re-checked independently of the report:** `GET /contents/docs/assets/app.js?ref=424190e` returns
  `importKey("spki", …)` and `ts + method.toUpperCase() + path` — so DR3's underlying claim is true of that
  revision, read through the API rather than from `reports/verify-d3e0e9f5.md` alone.

## 4. Register counts, restated from the runs above

The same class of drift `X5` recorded on 2026-11-22 had recurred in the Markdown registers:

Counts typed into prose are stale the moment another session lands: this round measured **266/266** on
`db91232`, and the same suite reported **270/270** an hour later on `bd464b8` after `bc28428d`'s guard merged.
Every figure below is therefore pinned to the revision it was measured on, and each register line now carries the
command beside the number.

| Register statement | Was published | Measured today |
|---|---|---|
| Node suite | 263/263 (`README.md`, `EXECUTIVE_SUMMARY.md`) | **266/266** |
| Python scripts | 20 run / 17 passed / 3 skipped (`EXECUTIVE_SUMMARY.md`) | **28 run / 24 passed / 4 skipped** |
| Flagged items | 40 open / 66 "mitigated" / 106 (`README.md`, `VERIFICATION.md`, `EXECUTIVE_SUMMARY.md`) | **40 open / 67 closed (28 mitigated, 38 fixed, 1 corrected) / 107** |
| Claims | 114 (102 verified) | **115 (103 verified)** from this round's one new row; the merged tree holds **116 (105 verified, 8 partial, 3 unverified)** because session `8299bffe` added and re-graded a row in parallel |

Every one of these now carries the command that produces it, so the next drift is a diff.

## 5. Live demo-exchange reads (read-only, 2026-11-27T22:3x–22:4xZ)

No credentials, no order calls, no writes.

| URL | Observed |
|---|---|
| `GET /exchange/status` | `exchange_active: true`, `trading_active: true`, and **four** `exchange_index_statuses` entries (indices 0–3, all trading; index 3 carries an empty `description`) — direct evidence for the sharding point in Flagged **F18** |
| `GET /events?status=open&with_nested_markets=true&limit=1` | `200`; one event with a nested `markets[]` array, `cursor` returned; the market object carried `yes_bid_dollars`, `yes_ask_dollars`, `no_bid_dollars`, `no_ask_dollars`, `last_price_dollars`, `previous_price_dollars`, `price_ranges[]` |
| `GET /markets?status=open&series_ticker=KXGAS&limit=2` | `200`, `markets: []` — the `KXGAS` series has **no open markets** at that time (not an error; row 32 of `VERIFICATION.md` already treats `KXGAS` and `GAS` as distinct records) |
| `GET /markets?status=open&series_ticker=KXAAAGASW&limit=2` | `200`; two open gas-price markets, both settling 2026-11-30 with `rules_primary` naming AAA (`gasprices.aaa.com`) as the settlement source, both still untraded (`volume_fp` `0.00`, `open_interest_fp` `0.00`) |

**What this adds to the register:** a new verified claim (`claims.js`, row count 114 → 115 on this branch, 116 on the merged tree) that a market
object quotes **both sides** — `yes_bid`/`yes_ask` and `no_bid`/`no_ask` — and that the reciprocal rule held on
every market sampled: `yes_bid + no_ask = 1.0000` and `no_bid + yes_ask = 1.0000`. That makes the category
pages' derived implied YES ask (`1 − best NO bid`) checkable against the exchange's own `yes_ask_dollars`
instead of merely plausible. Three markets is a **sample, not a proof**, and the register row says so.

Also noted for the alerting design, and already published: the exchange documents that REST responses are
cached briefly and "can lag the exchange by several seconds"
([Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), quoted in `claims.js` and on the
alerts page). The two untraded gas markets above are exactly the state the gas board's "no resting YES bids"
empty state has to render — a quote of `0.0000` is a real value, not a missing one.

## 6. Documentation pages read this round

| Page | What it settled |
|---|---|
| [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) | `orderbook_fp.yes_dollars` / `no_dollars` as `[price, count]`; `depth` is a documented query parameter, `default: 0`, "omit it or pass 0 for all levels", values outside 0–100 rejected with 400 — the category pages' `?depth=20` is inside the bound |
| [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | `status` filter vocabulary `unopened`/`open`/`closed`/`settled`, only one at a time; timestamp filters mutually exclusive with certain status filters; **when `event_ticker` or `tickers` is the only filter, `limit` is not applied and every match is returned with an empty cursor**; short-lived response caching |
| [Get Series](https://docs.kalshi.com/api-reference/market/get-series) / [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | series-level `category`, `categories[]`, `tags[]` — the taxonomy the five topic pages match on |

## 7. Irregularities recorded, not fixed

1. **PR #141** — stale (last commit ~4h45m before this claim), conflicted (2 ahead / 34 behind), and it
   mis-cites the root commit (§3). Left open for its owner; this round carried its one substantive repair.
2. **Section numbering on `flagged.html`** duplicated before this round: `9` twice and `11` three times. Only
   the ambiguity was fixed (`9b`, `11a`, `11b`, `11c`); the page still does not number its 21 sections in
   document order (1, 2, 3, 4, 1b, 1d, 1e, 1c, 7, 5, 6, 8, …). A full renumber is a separate editorial task and
   was not attempted here.
3. **`reports/alerts-live-check.md`** is regenerated by the `verify-alerts` workflow on every run, so it appears
   as a diff in unrelated pull requests. Not repaired (the file is authored by CI, not by a session).

## 8. Not verified, not claimed

- No authenticated call was made; **no demo order was placed** — Flagged **`F1`** stands unchanged.
- No realised P&L, fill, position or balance was read or published (`F2`).
- The live reads in §5 are four requests at one moment; they say nothing about later prices, and the
  sample of three market objects is not a proof of the reciprocal rule in general.
- The exact unauthenticated rate budget remains unpublished by Kalshi (`F3`).
- No claim is made that a `/series` response is the full exchange catalogue (`F5`).
- No market value from §5 was written into any page, register or table.

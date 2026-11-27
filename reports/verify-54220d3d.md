# Line-by-line re-verification — session `54220d3d`, 2026-11-27 (UTC)

Base commit: `bb4ede5` (`main`, "chore(probe): refresh API surface probe", committed 2026-11-27T16:57:25Z).
Branch: `arena/54220d3d-kalshidash2`.

## 0 · What is different about this pass

Every earlier entry on `COORDINATION.md` records the same environment limit: **the build sandbox cannot open
TLS to Kalshi hosts** (`curl` exits 35, `"socket disconnected before secure TLS connection was established"`),
so live facts had to be captured by a GitHub Actions runner and committed as a report.

That is still true of `curl` here, but **not of this session's page-fetch tool**. Every response quoted below
was read directly from the live host during this pass. Reproduce any line by opening the URL in a browser:

- REST: `https://external-api.demo.kalshi.co/trade-api/v2/…` (unauthenticated public data)
- Docs: `https://docs.kalshi.com/…` (`…/llms.txt` is the index; `.md` variants give the raw OpenAPI block)
- Fee schedule: `https://kalshi.com/docs/kalshi-fee-schedule.pdf`

No figure below is inferred. Each is either the literal text of an official page or a field value copied out of
a live response. Where something could not be confirmed it says so and is left out of the site.

## 1 · What re-verified cleanly today (no change needed)

| Claim on the site | Official source read today | Result |
|---|---|---|
| `previous_price_dollars` is "the last traded YES price **a day ago**", and the site must label that comparison as a 24-hour move, not an intraday swing | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) — *"Price for the last traded YES contract on this market a day ago in dollars"* | **Confirmed verbatim.** The site's wording (and Flagged Z1) is correct; no edit. |
| A 5xx from `GET /exchange/status` must never be rendered as a trading halt | [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) — *"Read the flags only from a 200 response. When the status of the default index cannot be read, the response is a 500, 503 or 504; its body can be an `ExchangeStatus` with `exchange_active` and `trading_active` set to `false` … and in neither case does it mean the exchange is paused."* | **Confirmed verbatim**, and `tests/exchange-status.test.mjs` pins it. |
| Taker fee = `round_up(M × 0.07 × C × P × (1−P))`, maker = `M × 0.0175 × …` with maker multiplier default 0 | [Fee schedule PDF](https://kalshi.com/docs/kalshi-fee-schedule.pdf) (title: *"Fee Schedule for July 2026 – 7.7.26 Update"*, *"Last updated and effective: July 7, 2026"*) | **Confirmed verbatim**; matches `FEE_SCHEDULE` in `assets/js/simulator.js`. |
| The four "multiplier 0" series the simulator special-cases | same PDF, *Non-Standard Fees* table | All four present: `KXBTCY` (0/0), `KXETHY` (0/0), `KXIRANDEMOCRACY` (0/0), `KXELECTIRAN` (0/0), `KXGREENLAND` (0/0), `KXGAMBLINGREPEAL` (0/0), plus `KXPAHLAVIHEAD`, `KXDOED`, `KXCITRINI`, `KXLAYOFFSYINFO` — the ten `ZERO_TAKER_FEE_SERIES` tickers. |
| `KXAAAGASM` ("US gas price") is a fee-listed series, i.e. the gas family is a real product line | same PDF, *Non-Standard Fees* — `KXAAAGASM | US gas price | 1 | 1` | **Confirmed.** (moved onto the register, §2) |
| Fee rounding: trade fee `ceil_6dp`, balance aligned to `$0.01` non-direct / `$0.0001` direct, rebate cannot make net fee negative | [Fee Rounding](https://docs.kalshi.com/getting_started/fee_rounding) | **Confirmed verbatim**; matches `fillFeeDollars()`. |
| Unauthenticated budget is not published; clients back off on 429; 429 carries no `Retry-After` | [Rate Limits and Tiers](https://docs.kalshi.com/getting_started/rate_limits) — *"Unauthenticated public requests are subject to separate limits. Authenticate requests where supported and back off on `429`."* and *"429 responses carry the rate limit headers below, but not `Retry-After`."* | **Confirmed verbatim** (Flags F3/A8 stand). |
| `GET /events` page size is 200 max; `status` enum is `unopened/open/closed/settled`; `series_ticker` is a documented filter; the endpoint excludes multivariate events; `category` is **deprecated** at event level ("use series-level category instead") | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) | **Confirmed verbatim** — the taxonomy's use of the series category first, and the event category only as a labelled fallback, is the documented order. |
| `GET /markets` page size is 1–1000 (default 100); `previous_price_dollars` is a required field; `status` enum includes `paused` | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | **Confirmed.** |
| `contract_url` on a series really does point at a staging bucket | live `GET /series?category=Sports&tags=Golf`, e.g. `KXHOLEINONE` → `https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFACHIEVEMENT.pdf` | **Re-confirmed 2026-11-27** (Flagged X1 stays open; the site's rule of withholding such a host is right). |

## 2 · Retired: the fee-schedule PDF is readable, and only one row said it was not

`assets/js/sources.js` carried the register's **only** `verified: "unverified"` row:

> *"Kalshi's own site, but the PDF could not be read from the build sandbox; the rate used is published on the
> Strategy Tester page for review (Flag F15/A5)."*

The PDF was read in full this pass (both pages, incl. the *Non-Standard Fees* table). The row is now
`verified: "fetched"` with what the PDF actually says, and the *Get Series List* / *Get Series* rows now note
the `tags` filter and the `tags[]` field observed live today (the basis of F19). **Effect: the register's
unverified count goes 1 → 0** (`sourceStats().unverified`), so `tests/sources-page.test.mjs` no longer requires
"at least one unverified row" — it now requires that *every* row marked unverified is well-formed and carries a
reason, which is the invariant that actually matters and holds at zero.
This is a status change backed by a source read today, not a loosening of the rule: nothing was moved to
"verified" without the page being read.

The two `flagged.html` sentences that said the PDF *could not be read* are corrected in the same pass
(wording only, no card added or removed).

## 3 · New irregularities found this pass (published as F18 and F19)

### F18 · The exchange is sharded, and the site reports a single status line

`GET https://external-api.demo.kalshi.co/trade-api/v2/exchange/status` on 2026-11-27 answered:

```json
{"exchange_active":true,"trading_active":true,"intra_exchange_transfers_active":true,
 "exchange_index_statuses":[
   {"description":"Default","exchange_index":0,…},{"description":"Demo shard 1","exchange_index":1,…},
   {"description":"Demo shard 2","exchange_index":2,…},{"description":"","exchange_index":3,…}]}
```

The reference now says, in its own words: *"The top-level fields describe the default exchange index (0) …
In `exchange_index_statuses` on a 200 response, an index other than 0 whose status request failed or timed out
is reported with all of its flags `false`. Read the status again before treating a single `false` reading for
one index as a pause."*
([Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status))

The repository already knows markets carry `exchange_index` (the order path handles it), but nothing on the
site reads `exchange_index_statuses`. The Overview therefore prints one exchange-wide line while a single
shard can be paused. This is presented as-is on the page (no invented per-shard verdict), and the reader is
told to re-read before treating one shard's `false` as a pause.

### F19 · A Golf-tagged series the topic filter cannot see

The Kalshi series vocabulary carries a **`Golf` tag** (the 2026-11-27 probe capture in
`data/probe/api_surface.json` records 134 series carrying it), and `GET /series` filters on it — documented as
`tags` in [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list). The site's Golf
topic does not read tags; it narrows category `Sports` with series/title patterns.

Running the site's own `classifyEvent()` (unmodified, imported from `assets/js/market.js`) over series records
copied verbatim from the live API today:

| Series (live) | Title (live) | `tags` | Site's topic | Why |
|---|---|---|---|---|
| `KXDPWORLDTOURR2LEAD` | DP World Tour R2 Leader | `["Golf"]` | **not classified** | no golf word in the title; ticker has no `GOLF`/`PGA`/`RYDER`/`MASTERS` | 
| `KXLPGAR2LEAD` | LPGA Round 2 Leader | `["Golf"]` | golf | matched by the **title** pattern `/pga/i` on "LPGA" (verified: title only → golf, ticker only → null) |
| `KXPGAPLAYOFF` | Golf Playoff | `["Golf"]` | golf | title contains "Golf" |
| `KXHOLEINONE` | Golf Hole in One | `["Golf"]` | golf | title contains "Golf" |
| `KXGOLFCAT` | `a` | `["Golf"]` | golf | ticker contains `GOLF` |
| `KXMLBGAME` | Pro Baseball Game | `[]` | not classified | **correct** — the control row; not a golf series |

So a Golf-tagged series is missed whenever **neither** its ticker nor its title carries a word the site's
patterns hold. `KXDPWORLDTOURR2LEAD` is that case today: `series.tags` says `["Golf"]`, and the classifier
returns `null`. The miss matters only when that series has an event inside the scanned page of `/events` (the
series had no open event on 2026-11-27, checked directly), but it is a coverage hole in a required topic, and it
is exactly the kind of value the brief says must not be papered over. It is published, not silently patched
inside `config.js`/`market.js` (shared taxonomy files other sessions edit); the fix — match the series `tags`
array before the title patterns — is proposed on the page and in §4.

Honesty note on this row: `KXGOLFCAT`'s live title is the single character `a`, not blank. An earlier draft of
this section said "(blank in the API)" and listed it as unclassified; both were wrong, and the table above is
the corrected version produced by re-running the classifier on the live records.

### F20 · NF1 was resolvable from documentation — the request price is the YES-leg quote

NF1 (section 10 of the Flagged page) said two official pages "do not agree" on what `price` means on a NO
order. Read in full today, they do not conflict; they answer different questions:

| Page | Text (verbatim) | What it defines |
|---|---|---|
| [Create Order (V2)](https://docs.kalshi.com/api-reference/orders/create-order-v2), `BookSide` schema | *"Side of the book for an order or trade. For event markets, this refers to the **YES leg only**: `bid` means buy YES, `ask` means sell YES. (Selling YES is economically equivalent to buying NO at `1 - price`, but this endpoint **quotes everything from the YES side**.)"* | the **request field** — the price you send |
| [Order direction](https://docs.kalshi.com/getting_started/order_direction) | *"`outcome_side` describes directional exposure only; it does not change the order's price. An order at price `p` with `outcome_side=no` is matched by an order at the same price `p` with `outcome_side=yes`: both parties trade at the same price, just on opposite directions."* | the **matching** price — the same on both sides |

So: a NO order is sent at the YES-leg price `p` (V2 schema), it matches a YES order at the same `p`
(order-direction page), and the NO contract's own cost is the complement `1 − p`. No live order was needed to
settle it, which matters because no demo key exists here.

Live corroboration of the complement and of the canonical direction fields, from public data only:

```
GET https://external-api.demo.kalshi.co/trade-api/v2/markets/trades?limit=2   (2026-11-27)
{"trades":[
 {"count_fp":"0.03","is_block_trade":false,"no_price_dollars":"0.9940",
  "taker_book_side":"bid","taker_outcome_side":"yes","taker_side":"yes",
  "ticker":"KXMARMAD-27-MIZZ","trade_id":"…","yes_price_dollars":"0.0060"},
 {"count_fp":"0.68","is_block_trade":false,"no_price_dollars":"0.5700",
  "taker_book_side":"bid","taker_outcome_side":"yes","taker_side":"yes",
  "ticker":"KXNBAGAME-26NOV27MIANYK-MIA","trade_id":"…","yes_price_dollars":"0.4300"}]}
```

`0.0060 + 0.9940 = 1.0000` and `0.4300 + 0.5700 = 1.0000`. The canonical `taker_outcome_side` /
`taker_book_side` fields are present beside the deprecated `taker_side` — which is what
`assets/js/dollar-volume.js:94` already reads.

**Site changes (this session):** `portfolio.html` no longer calls the scale "unverified": the side selector says
the price is the YES-leg quote, and the confirmation states `NO position costs 1 − price`. The request is
unchanged (entered price, `side: "ask"`) and still requires an explicit confirmation. `tests/portfolio-page.test.mjs`
now asserts both halves, including that the old "unverified" wording cannot come back. F1 ("no live order was
executed") stands — nothing was placed.

## 4 · Recommendation recorded, not applied (file ownership)

`assets/js/config.js` (topic taxonomy) and `assets/js/market.js` (classifier) are shared controllers that other
live sessions touch. Per the board's rule this session does not edit them. The change for whoever owns them:

1. read `series.tags` in `fetchSeriesCategories()` (it already stores `categories` and `category`);
2. in `TOPICS`, give Golf `tagPatterns: [/^Golf$/i]` and test tags before the title/series patterns;
3. extend `tests/taxonomy.test.mjs` with the `KXDPWORLDTOURR2LEAD` fixture above (it is a live record).

Until then the Golf page states the limitation in its own note.

## 5 · Harness results on this branch (all local, no network)

| Suite | Result |
|---|---|
| `node --test tests/*.test.mjs` | **237 pass / 1 fail** — the one failure is pre-existing on `main` @ `bb4ede5`: `tests/probe-citation-drift.test.mjs` expects `flagged.html` to publish the probe's *newest* capture (Elections 5,472). That artifact is rewritten every morning by `.github/workflows/probe.yml`, and the repair is claimed by sessions `858d4941`, `bacbd8a9` and `c0aa9245`; this session does not touch it. |
| `python3 -m unittest discover -s tools` | **47 / 47** |
| `python3 -m unittest discover -s tests` | **20 run, 3 skipped, OK** |
| `tests/dom` (`npm test`, jsdom) | **23 + 23 + 23 checks pass** |
| `tools/verify/page-runtime-check.mjs` | **18 / 18 pages, 0 broken local links** |
| `tools/check_site_links.py` | **36 pages, 0 broken links** |

After this session's edits the same suites are re-run and recorded on `COORDINATION.md`.

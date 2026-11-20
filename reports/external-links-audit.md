# External link audit

Generated 2026-11-20 19:24 UTC by `tools/audit_external_links.py` (session `751ee13f`).

**What this is.** Every external `http(s)` URL found in tracked text files, classified by host.
**What this is not.** A verdict on whether a cited fact is true. A host being official does not make a claim on the page correct.

- Unique external URLs: **1326** (226 non-API, 1100 Kalshi API endpoint variants)
- Live HTTP check: **performed**
- Flagged URLs: **67**

## Counts by class

| Class | URLs |
| --- | --- |
| GitHub | 11 |
| GitHub docs | 2 |
| Kalshi API (demo) | 1100 |
| Kalshi asset host | 79 |
| Kalshi demo site | 3 |
| Kalshi help centre | 1 |
| Kalshi official docs | 36 |
| Kalshi official site | 3 |
| Kalshi-named settlement source (news) | 8 |
| OTHER (unclassified) | 7 |
| Origin string (not a link) | 1 |
| STAGING bucket (flag) | 66 |
| Test fixture (reserved domain) | 3 |
| This project's Pages site | 4 |
| W3C standard | 2 |

## Flagged for review

| URL | Flag | Note |
| --- | --- | --- |
| 66 URLs on `kalshi-public-docs-staging.s3.us-east-1.amazonaws.com` (e.g. <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAADIESEL.pdf>, <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGAS.pdf>) | staging host | Kalshi 'staging' S3 bucket; observed as the contract_url field in data/snapshot.json (market data) |
| <https://www.politi> | unrecognised TLD '.politi' (possibly truncated) | Not in the host list; a reviewer must confirm it |

## Review notes (what each flag means)

1. **Staging bucket (66 URLs).** Every one is a `contract_url` value on a series object in `data/snapshot.json`, a raw capture from the demo API. No published page links them (grep of `*.html` / `*.js` finds none). The official [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) schema names `contract_url` and `contract_terms_url`; the page does not say which host is correct. Action for review: confirm with Kalshi whether `contract_url` should point to the staging bucket.
2. **Truncated URL `https://www.politi`.** Found in `evidence/evidence-routes-settled.md` and `reports/verify-facts-v2.md` (both at line 81). These are excerpts cut mid-string by the capture tool, not links a reader can use. The full `settlement_sources[]` values come from the [Get Event](https://docs.kalshi.com/api-reference/events/get-event) response.
3. **Kalshi-named settlement sources (news and sports).** These are the outlets an event's `settlement_sources[]` names. Their presence confirms only what the event declares. The site does not verify any news claim against them.
4. **Lockfile and test fixtures** (`tests/dom/package-lock.json`, `example.com`/`example.org` in test files) are excluded or classed as fixtures; they are not cited sources.


## All non-API URLs

| URL | Class | Official publisher? | Reachability | Where cited |
| --- | --- | --- | --- | --- |
| <https://github.com/advisories/GHSA-67mh-4wv8-2f99> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:38`, `flagged.html:385` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44745300283> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:46` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/assets/js/alert-engine.js> | GitHub | yes | HTTP 200 | `assets/js/claims.js:301` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/docs/assets/app.js> | GitHub | yes | HTTP 200 | `assets/js/claims.js:213` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/tools/verify/page-runtime-check.mjs> | GitHub | yes | HTTP 200 | `assets/js/claims.js:253` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/branches> | GitHub | yes | HTTP 200 | `flagged.html:300`, `questions.html:241`, `suggestions.html:193` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/commit/6081bb7> | GitHub | yes | HTTP 200 | `assets/js/claims.js:205` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/commits/main> | GitHub | yes | HTTP 200 | `flagged.html:301` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/pull/20> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:44` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/pull/21> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:45` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/tree/main/reports> | GitHub | yes | HTTP 200 | `assets/js/claims.js:221`, `suggestions.html:127` |
| <https://docs.github.com/en/pages> | GitHub docs | yes | HTTP 200 | `assets/js/claims.js:209`, `questions.html:232` |
| <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site> | GitHub docs | yes | HTTP 200 | `docs/flagged.html:16`, `flagged.html:312`, `flagged.html:392` |
| <https://assets.kalshi.com/contract_terms/AAADIESEL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:474`, `data/snapshot.json:688`, `data/snapshot.json:728` |
| <https://assets.kalshi.com/contract_terms/AAAGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:300`, `data/snapshot.json:320`, `data/snapshot.json:398`, `data/snapshot.json:570` (+5 more) |
| <https://assets.kalshi.com/contract_terms/AAAGASMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:1000`, `data/snapshot.json:1019`, `data/snapshot.json:649`, `data/snapshot.json:708` (+4 more) |
| <https://assets.kalshi.com/contract_terms/ACHIEVEMENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34121`, `data/snapshot.json:34197`, `data/snapshot.json:34235`, `data/snapshot.json:34254` (+4 more) |
| <https://assets.kalshi.com/contract_terms/ADVANCE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12266` |
| <https://assets.kalshi.com/contract_terms/ATHLETEEVENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34482` |
| <https://assets.kalshi.com/contract_terms/AVAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22891`, `data/snapshot.json:22942` |
| <https://assets.kalshi.com/contract_terms/BARRELS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:550` |
| <https://assets.kalshi.com/contract_terms/BCH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23033` |
| <https://assets.kalshi.com/contract_terms/BILL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12225` |
| <https://assets.kalshi.com/contract_terms/BRPRES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11779` |
| <https://assets.kalshi.com/contract_terms/BTC.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22519`, `data/snapshot.json:22621`, `data/snapshot.json:22722` |
| <https://assets.kalshi.com/contract_terms/BTCMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22857`, `data/snapshot.json:22962`, `data/snapshot.json:23070`, `data/snapshot.json:23090` (+1 more) |
| <https://assets.kalshi.com/contract_terms/COMMOD15M.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:905` |
| <https://assets.kalshi.com/contract_terms/COMMODITIES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:339`, `data/snapshot.json:358`, `data/snapshot.json:417`, `data/snapshot.json:455` (+1 more) |
| <https://assets.kalshi.com/contract_terms/CONTROL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11836` |
| <https://assets.kalshi.com/contract_terms/CRYPTO.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22539`, `data/snapshot.json:22579`, `data/snapshot.json:22662`, `data/snapshot.json:22682` |
| <https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23110`, `data/snapshot.json:23190`, `data/snapshot.json:23230`, `data/snapshot.json:23270` |
| <https://assets.kalshi.com/contract_terms/CRYPTOHIT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23170` |
| <https://assets.kalshi.com/contract_terms/CRYPTOMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22559`, `data/snapshot.json:23016`, `data/snapshot.json:23210`, `data/snapshot.json:23250` |
| <https://assets.kalshi.com/contract_terms/DOGE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22703`, `data/snapshot.json:22820` |
| <https://assets.kalshi.com/contract_terms/DOT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22908`, `data/snapshot.json:23050` |
| <https://assets.kalshi.com/contract_terms/ECONSTATE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:436` |
| <https://assets.kalshi.com/contract_terms/ELECTION.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11856`, `data/snapshot.json:12010` |
| <https://assets.kalshi.com/contract_terms/ELECTIONMOV.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11679`, `data/snapshot.json:11698`, `data/snapshot.json:12070` |
| <https://assets.kalshi.com/contract_terms/ELECTIONPLACE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11660` |
| <https://assets.kalshi.com/contract_terms/ETH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22600`, `data/snapshot.json:22642` |
| <https://assets.kalshi.com/contract_terms/ETHMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22779`, `data/snapshot.json:23150` |
| <https://assets.kalshi.com/contract_terms/FRENCHPRES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12128` |
| <https://assets.kalshi.com/contract_terms/GOLF3BALL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34615`, `data/snapshot.json:34691` |
| <https://assets.kalshi.com/contract_terms/GOLFCATEGORYLEADER.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34406` |
| <https://assets.kalshi.com/contract_terms/GOLFCUT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34273`, `data/snapshot.json:34710` |
| <https://assets.kalshi.com/contract_terms/GOLFENTITYSTAT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34558` |
| <https://assets.kalshi.com/contract_terms/GOLFERMAJOR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34748` |
| <https://assets.kalshi.com/contract_terms/GOLFFINISH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34140`, `data/snapshot.json:34178`, `data/snapshot.json:34216`, `data/snapshot.json:34387` (+5 more) |
| <https://assets.kalshi.com/contract_terms/GOLFH2H.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34672` |
| <https://assets.kalshi.com/contract_terms/GOLFMILESTONES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34805` |
| <https://assets.kalshi.com/contract_terms/GOLFPTSLEADER.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34368` |
| <https://assets.kalshi.com/contract_terms/GOLFROUNDSCORE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34330` |
| <https://assets.kalshi.com/contract_terms/GOLFSLAM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34539` |
| <https://assets.kalshi.com/contract_terms/GOV.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11562`, `data/snapshot.json:11601` |
| <https://assets.kalshi.com/contract_terms/GOVHEAD.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12168` |
| <https://assets.kalshi.com/contract_terms/GOVPARTYNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11736`, `data/snapshot.json:11913` |
| <https://assets.kalshi.com/contract_terms/LEAVEOFFICE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11991` |
| <https://assets.kalshi.com/contract_terms/LINK.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22759`, `data/snapshot.json:22837` |
| <https://assets.kalshi.com/contract_terms/LTC.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22874`, `data/snapshot.json:22925` |
| <https://assets.kalshi.com/contract_terms/NEXTPM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11817` |
| <https://assets.kalshi.com/contract_terms/NGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:609`, `data/snapshot.json:629`, `data/snapshot.json:924` |
| <https://assets.kalshi.com/contract_terms/OILRIGS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:512` |
| <https://assets.kalshi.com/contract_terms/PGARYDERMATCH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34425` |
| <https://assets.kalshi.com/contract_terms/PGATOPX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34577` |
| <https://assets.kalshi.com/contract_terms/PGATOUR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34083`, `data/snapshot.json:34102`, `data/snapshot.json:34159`, `data/snapshot.json:34311` (+4 more) |
| <https://assets.kalshi.com/contract_terms/POLITICALECONOMICEVENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11640`, `data/snapshot.json:11759`, `data/snapshot.json:12149` |
| <https://assets.kalshi.com/contract_terms/PRESNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11502`, `data/snapshot.json:11542` |
| <https://assets.kalshi.com/contract_terms/PRESPERSON.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11522` |
| <https://assets.kalshi.com/contract_terms/ROLEATEVENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:493` |
| <https://assets.kalshi.com/contract_terms/SEATSCONGRESS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11934`, `data/snapshot.json:12050`, `data/snapshot.json:12246` |
| <https://assets.kalshi.com/contract_terms/SENATEPARTY.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11972` |
| <https://assets.kalshi.com/contract_terms/SENATEPARTYNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11875`, `data/snapshot.json:11894`, `data/snapshot.json:12029`, `data/snapshot.json:12109` |
| <https://assets.kalshi.com/contract_terms/SHIBA.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22742`, `data/snapshot.json:22799` |
| <https://assets.kalshi.com/contract_terms/SOLAR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:531` |
| <https://assets.kalshi.com/contract_terms/SPR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:867` |
| <https://assets.kalshi.com/contract_terms/SPRUSE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:668` |
| <https://assets.kalshi.com/contract_terms/USELECTION.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11581`, `data/snapshot.json:11621`, `data/snapshot.json:11798`, `data/snapshot.json:12090` (+2 more) |
| <https://assets.kalshi.com/contract_terms/VOTEPERCENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11717` |
| <https://assets.kalshi.com/contract_terms/WLEADEROUT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11953` |
| <https://assets.kalshi.com/contract_terms/WTIMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:377`, `data/snapshot.json:589` |
| <https://assets.kalshi.com/contract_terms/WTIOIL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:261`, `data/snapshot.json:280` |
| <https://assets.kalshi.com/contract_terms/XBANNED.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22469`, `data/snapshot.json:22488` |
| <https://assets.kalshi.com/contract_terms/XLM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22979`, `data/snapshot.json:22996` |
| <https://assets.kalshi.com/regulatory/product-certifications/AAAGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:942` |
| <https://assets.kalshi.com/regulatory/product-certifications/AAAGASMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:1018`, `data/snapshot.json:961`, `data/snapshot.json:980`, `data/snapshot.json:999` |
| <https://assets.kalshi.com/regulatory/product-certifications/ACHIEVEMENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34120`, `data/snapshot.json:34196`, `data/snapshot.json:34234`, `data/snapshot.json:34253` (+4 more) |
| <https://assets.kalshi.com/regulatory/product-certifications/COMMODITIES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:885` |
| <https://assets.kalshi.com/regulatory/product-certifications/CRYPTO.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22538`, `data/snapshot.json:22578`, `data/snapshot.json:22661`, `data/snapshot.json:22681` |
| <https://assets.kalshi.com/regulatory/product-certifications/CRYPTOMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22558`, `data/snapshot.json:23015`, `data/snapshot.json:23209`, `data/snapshot.json:23249` |
| <https://assets.kalshi.com/regulatory/product-certifications/GOLFENTITYSTAT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34557` |
| <https://assets.kalshi.com/regulatory/product-certifications/NGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:923` |
| <https://assets.kalshi.com/regulatory/product-certifications/POLITICALECONOMICEVENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11639`, `data/snapshot.json:12148` |
| <https://demo.kalshi.co> | Kalshi demo site | yes | HTTP 200 | `README.md:23`, `docs/flagged.html:10` |
| <https://demo.kalshi.co/> | Kalshi demo site | yes | HTTP 200 | `docs/sources.html:9` |
| <https://demo.kalshi.co/account/profile> | Kalshi demo site | yes | HTTP 200 | `portfolio.html:23`, `questions.html:63` |
| <https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account> | Kalshi help centre | yes | HTTP 200 | `docs/sources.html:29` |
| <https://docs.kalshi.com> | Kalshi official docs | yes | HTTP 200 | `README.md:23`, `assets/js/claims.js:13`, `assets/js/ui.js:152`, `data/snapshot.json:7` (+24 more) |
| <https://docs.kalshi.com/api-reference/events/get-event> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `alerts.html:194`, `flagged.html:344`, `flagged.html:451` (+2 more) |
| <https://docs.kalshi.com/api-reference/events/get-events> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `assets/js/alert-engine.js:198`, `assets/js/config.js:32`, `assets/js/market.js:517` (+14 more) |
| <https://docs.kalshi.com/api-reference/exchange/get-exchange-status> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:35` |
| <https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:20`, `docs/category-crypto.html:21`, `docs/category-culture.html:21`, `docs/category-elections.html:21` (+8 more) |
| <https://docs.kalshi.com/api-reference/market/get-market> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:17`, `alerts.html:131`, `assets/js/alert-engine.js:10`, `assets/js/alerts-core.js:125` (+28 more) |
| <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:23`, `VERIFICATION.md:19`, `assets/js/config.js:30`, `assets/js/simulator.js:14` (+19 more) |
| <https://docs.kalshi.com/api-reference/market/get-market-orderbook> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:21`, `docs/category-crypto.html:26`, `docs/category-culture.html:26`, `docs/category-elections.html:26` (+5 more) |
| <https://docs.kalshi.com/api-reference/market/get-markets> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:16`, `alerts.html:193`, `assets/js/config.js:31` (+17 more) |
| <https://docs.kalshi.com/api-reference/market/get-series> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:34` |
| <https://docs.kalshi.com/api-reference/market/get-series-list> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:18`, `assets/js/config.js:33`, `data/snapshot.json:11482`, `data/snapshot.json:22452` (+18 more) |
| <https://docs.kalshi.com/api-reference/orders/> | Kalshi official docs | yes | HTTP 200 | `reports/verify-facts-v3.md:130` |
| <https://docs.kalshi.com/api-reference/orders/create-ord> | Kalshi official docs | yes | HTTP 404 | `evidence/evidence-cors-taxonomy.md:278`, `flagged.html:457`, `reports/verify-facts-raw.md:278` |
| <https://docs.kalshi.com/api-reference/orders/create-order-v2> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:12`, `assets/js/config.js:27`, `docs/portfolio.html:25` (+9 more) |
| <https://docs.kalshi.com/api-reference/orders/get-orders> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:40` |
| <https://docs.kalshi.com/api-reference/portfolio/get-balance> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:37`, `portfolio.html:129`, `summary.html:147`, `summary.html:40` |
| <https://docs.kalshi.com/api-reference/portfolio/get-fills> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:25`, `assets/js/config.js:38`, `docs/analysis.html:7` (+12 more) |
| <https://docs.kalshi.com/api-reference/portfolio/get-positions> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:26`, `assets/js/config.js:39`, `docs/portfolio.html:18` (+8 more) |
| <https://docs.kalshi.com/api-reference/portfolio/get-settlements> | Kalshi official docs | yes | HTTP 200 | `docs/analysis.html:36`, `docs/flagged.html:14`, `docs/questions.html:15`, `docs/sources.html:26` (+1 more) |
| <https://docs.kalshi.com/getting_started/api_environments> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `assets/js/config.js:23`, `docs/sources.html:10` |
| <https://docs.kalshi.com/getting_started/api_keys> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:24`, `docs/sources.html:11`, `evidence/auth-sign-test.mjs:2`, `flagged.html:59` (+4 more) |
| <https://docs.kalshi.com/getting_started/demo_env> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:27`, `VERIFICATION.md:7`, `VERIFICATION.md:8` (+17 more) |
| <https://docs.kalshi.com/getting_started/exchange_sharding> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:47` |
| <https://docs.kalshi.com/getting_started/fee_rounding> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:48` |
| <https://docs.kalshi.com/getting_started/fixed_point_migration> | Kalshi official docs | yes | HTTP 200 | `QUESTIONS.md:16`, `VERIFICATION.md:23`, `assets/js/config.js:43`, `docs/category-crypto.html:14` (+12 more) |
| <https://docs.kalshi.com/getting_started/historical_data> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:46`, `docs/questions.html:12` |
| <https://docs.kalshi.com/getting_started/market_lifecycle> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:24`, `alerts.html:195`, `assets/js/config.js:45` (+4 more) |
| <https://docs.kalshi.com/getting_started/market_settlement> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `alerts.html:196`, `assets/js/config.js:44`, `docs/resolved.html:7` (+12 more) |
| <https://docs.kalshi.com/getting_started/order_direction> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:28`, `flagged.html:76`, `strategies.html:29`, `summary.html:124` |
| <https://docs.kalshi.com/getting_started/order_errors> | Kalshi official docs | yes | HTTP 200 | `portfolio.html:304` |
| <https://docs.kalshi.com/getting_started/orderbook_responses> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:23`, `VERIFICATION.md:22`, `assets/js/config.js:29`, `docs/dashboard.html:27` (+8 more) |
| <https://docs.kalshi.com/getting_started/quick_start_authenticated_requests> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:13`, `VERIFICATION.md:14`, `VERIFICATION.md:15`, `assets/js/config.js:25` (+14 more) |
| <https://docs.kalshi.com/getting_started/quick_start_create_order> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:10`, `VERIFICATION.md:11`, `assets/js/config.js:26`, `docs/flagged.html:9` (+7 more) |
| <https://docs.kalshi.com/getting_started/quick_start_websockets> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:42`, `flagged.html:197` |
| <https://docs.kalshi.com/getting_started/rate_limits> | Kalshi official docs | yes | HTTP 200 | `alerts.html:197`, `assets/js/config.js:204`, `assets/js/config.js:41`, `flagged.html:145` (+2 more) |
| <https://docs.kalshi.com/getting_started/terms> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:49` |
| <https://kalshi.com> | Kalshi official site | yes | HTTP 429 | `tests/dom/summary-dom.mjs:81` |
| <https://kalshi.com/> | Kalshi official site | yes | HTTP 429 | `evidence/evidence-routes-settled.md:81` ×4, `reports/verify-facts-v2.md:81` ×4 |
| <https://kalshi.com/docs/kalshi-fee-schedule.pdf> | Kalshi official site | yes | HTTP 429 | `VERIFICATION.md:28`, `assets/js/claims.js:249`, `docs/sources.html:28`, `docs/verification.html:30` (+7 more) |
| <https://www.abc.net.au/> | Kalshi-named settlement source (news) | no | HTTP 200 | `reports/alerts-live-check.md:38` |
| <https://www.ap.org> | Kalshi-named settlement source (news) | no | HTTP 200 | `evidence/evidence-routes-settled.md:81`, `reports/verify-facts-v2.md:81` |
| <https://www.nytimes.com> | Kalshi-named settlement source (news) | no | HTTP 200 | `evidence/evidence-routes-settled.md:81`, `reports/verify-facts-v2.md:81` |
| <https://www.nytimes.com/> | Kalshi-named settlement source (news) | no | HTTP 200 | `reports/alerts-live-check.md:32` |
| <https://www.reuters.com> | Kalshi-named settlement source (news) | no | HTTP 401 | `evidence/evidence-routes-settled.md:81`, `reports/verify-facts-v2.md:81` |
| <https://www.reuters.com/> | Kalshi-named settlement source (news) | no | HTTP 401 | `reports/alerts-live-check.md:34` |
| <https://www.theguardian.com> | Kalshi-named settlement source (news) | no | HTTP 200 | `evidence/evidence-routes-settled.md:81`, `reports/verify-facts-v2.md:81` |
| <https://www.wsj.com/> | Kalshi-named settlement source (news) | no | HTTP 401 | `reports/alerts-live-check.md:36`, `reports/alerts-live-check.md:37` |
| <https://apnews.com/> | OTHER (unclassified) | unknown | HTTP 403 | `reports/alerts-live-check.md:33` |
| <https://www.axios.com/> | OTHER (unclassified) | unknown | HTTP 403 | `reports/alerts-live-check.md:35` |
| <https://www.cbsnews.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:39` |
| <https://www.cnn.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:40` |
| <https://www.foxnews.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:41` |
| <https://www.msnbc.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:42` |
| <https://www.politi> | OTHER (unclassified) | unknown | error: gaierror | `evidence/evidence-routes-settled.md:81`, `flagged.html:433`, `reports/verify-facts-v2.md:81` |
| <https://kanlerxz87-cyber.github.io> | Origin string (not a link) | unknown | HTTP 404 | `assets/js/claims.js:45`, `docs/flagged.html:9`, `evidence/evidence-cors-taxonomy.md:12`, `evidence/evidence-cors-taxonomy.md:31` (+14 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAADIESEL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:473`, `data/snapshot.json:687`, `data/snapshot.json:727` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGAS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:299`, `data/snapshot.json:319`, `data/snapshot.json:397`, `data/snapshot.json:569` (+4 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGASMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:648`, `data/snapshot.json:707`, `data/snapshot.json:787`, `data/snapshot.json:807` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ADVANCE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12265` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ATHLETEEVENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34481` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AVAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22890`, `data/snapshot.json:22941` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BARRELS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:549` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BCH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23032` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BILL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12224` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BRPRES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11778` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BTC.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22518`, `data/snapshot.json:22620`, `data/snapshot.json:22721` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BTCMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22856`, `data/snapshot.json:22961`, `data/snapshot.json:23069`, `data/snapshot.json:23089` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/COMMOD15M.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:904` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/COMMODITIES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:338`, `data/snapshot.json:357`, `data/snapshot.json:416`, `data/snapshot.json:454` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CONTROL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11835` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CRYPTO15M.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23109`, `data/snapshot.json:23189`, `data/snapshot.json:23229`, `data/snapshot.json:23269` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CRYPTOHIT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23169` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/DOGE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22702`, `data/snapshot.json:22819` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/DOT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22907`, `data/snapshot.json:23049` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ECONSTATE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:435` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTION.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11855`, `data/snapshot.json:12009` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTIONMOV.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11678`, `data/snapshot.json:11697`, `data/snapshot.json:12069` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTIONPLACE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11659` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ETH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22599`, `data/snapshot.json:22641` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ETHMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22778`, `data/snapshot.json:23149` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/FRENCHPRES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12127` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLF3BALL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34614`, `data/snapshot.json:34690` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFCATEGORYLEADER.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34405` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFCUT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34272`, `data/snapshot.json:34709` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFERMAJOR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34747` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFFINISH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34139`, `data/snapshot.json:34177`, `data/snapshot.json:34215`, `data/snapshot.json:34386` (+5 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFH2H.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34671` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFMILESTONES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34804` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFPTSLEADER.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34367` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFROUNDSCORE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34329` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFSLAM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34538` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOV.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11561`, `data/snapshot.json:11600` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOVHEAD.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12167` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOVPARTYNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11735`, `data/snapshot.json:11912` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LEAVEOFFICE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11990` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LINK.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22758`, `data/snapshot.json:22836` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LTC.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22873`, `data/snapshot.json:22924` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/NEXTPM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11816` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/NGAS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:608`, `data/snapshot.json:628` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/OILRIGS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:511` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGARYDERMATCH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34424` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGATOPX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34576` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGATOUR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34082`, `data/snapshot.json:34101`, `data/snapshot.json:34158`, `data/snapshot.json:34310` (+4 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/POLITICALECONOMICEVENTS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11758` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PRESNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11501`, `data/snapshot.json:11541` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PRESPERSON.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11521` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ROLEATEVENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:492` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SEATSCONGRESS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11933`, `data/snapshot.json:12049`, `data/snapshot.json:12245` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SENATEPARTY.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11971` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SENATEPARTYNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11874`, `data/snapshot.json:11893`, `data/snapshot.json:12028`, `data/snapshot.json:12108` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SHIBA.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22741`, `data/snapshot.json:22798` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SOLAR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:530` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SPR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:866` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SPRUSE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:667` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/USELECTION.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11580`, `data/snapshot.json:11620`, `data/snapshot.json:11797`, `data/snapshot.json:12089` (+2 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/VOTEPERCENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11716` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WLEADEROUT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11952` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WTIMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:376`, `data/snapshot.json:588` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WTIOIL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:260`, `data/snapshot.json:279` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/XBANNED.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22468`, `data/snapshot.json:22487` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/XLM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22978`, `data/snapshot.json:22995` |
| <https://example.com/news> | Test fixture (reserved domain) | no | HTTP 404 | `tools/verify/page-runtime-check.mjs:87` |
| <https://example.com/results> | Test fixture (reserved domain) | no | HTTP 404 | `tools/verify/page-runtime-check.mjs:88` |
| <https://example.org/fixture-> | Test fixture (reserved domain) | no | HTTP 404 | `tests/dom/alerts-dom.mjs:74` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:9`, `README.md:11`, `evidence/README.md:4`, `reports/live-site-6.md:3` (+4 more) |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:10`, `EXECUTIVE_SUMMARY.md:25`, `tests/dom/alerts-dom.mjs:84` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:11`, `EXECUTIVE_SUMMARY.md:47` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/summary.html> | This project's Pages site | yes | HTTP 200 | `tests/dom/summary-dom.mjs:30` |
| <http://www.w3.org/2000/svg> | W3C standard | yes | HTTP 200 | `index.html:8` |
| <https://www.w3.org/TR/WebCryptoAPI/> | W3C standard | yes | HTTP 200 | `assets/js/claims.js:121` |

## Kalshi API endpoints (not fetched as pages)

Query-string variants of API calls are counted per host, not listed one by one.

| API host | Distinct URLs |
| --- | --- |
| `demo-api.kalshi.co` | 1 |
| `external-api.demo.kalshi.co` | 1099 |

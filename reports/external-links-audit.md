# External link audit

Generated 2026-11-20 19:19 UTC by `tools/audit_external_links.py` (session `751ee13f`).

**What this is.** Every external `http(s)` URL found in tracked text files, classified by host.
**What this is not.** A verdict on whether a cited fact is true. A host being official does not make a claim on the page correct.

- Unique external URLs: **1327** (229 non-API, 1098 Kalshi API endpoint variants)
- Live HTTP check: **performed**
- Flagged URLs: **68**

## Counts by class

| Class | URLs |
| --- | --- |
| GitHub | 11 |
| GitHub docs | 2 |
| Kalshi API (demo) | 1098 |
| Kalshi asset host | 79 |
| Kalshi demo site | 3 |
| Kalshi help centre | 1 |
| Kalshi official docs | 37 |
| Kalshi official site | 3 |
| Kalshi-named settlement source (news) | 6 |
| Kalshi-named settlement source (sports) | 2 |
| OTHER (unclassified) | 9 |
| Origin string (not a link) | 1 |
| STAGING bucket (flag) | 66 |
| Test fixture (reserved domain) | 3 |
| This project's Pages site | 4 |
| W3C standard | 2 |

## Flagged for review

| URL | Flag | Note |
| --- | --- | --- |
| 66 URLs on `kalshi-public-docs-staging.s3.us-east-1.amazonaws.com` (e.g. <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAADIESEL.pdf>, <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGAS.pdf>) | staging host | Kalshi 'staging' S3 bucket; observed as the contract_url field in data/snapshot.json (market data) |
| <https://www.abc.net.au/> | unrecognised TLD '.au' (possibly truncated) | Not in the host list; a reviewer must confirm it |
| <https://www.politi> | unrecognised TLD '.politi' (possibly truncated) | Not in the host list; a reviewer must confirm it |

## Review notes (what each flag means)

1. **Staging bucket (66 URLs).** Every one is a `contract_url` value on a series object in `data/snapshot.json`, a raw capture from the demo API. No published page links them (grep of `*.html` / `*.js` finds none). The official [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) schema names `contract_url` and `contract_terms_url`; the page does not say which host is correct. Action for review: confirm with Kalshi whether `contract_url` should point to the staging bucket.
2. **Truncated URL `https://www.politi`.** Found in `evidence/evidence-routes-settled.md` and `reports/verify-facts-v2.md` (both at line 81). These are excerpts cut mid-string by the capture tool, not links a reader can use. The full `settlement_sources[]` values come from the [Get Event](https://docs.kalshi.com/api-reference/events/get-event) response.
3. **Kalshi-named settlement sources (news and sports).** These are the outlets an event's `settlement_sources[]` names. Their presence confirms only what the event declares. The site does not verify any news claim against them.
4. **Lockfile and test fixtures** (`tests/dom/package-lock.json`, `example.com`/`example.org` in test files) are excluded or classed as fixtures; they are not cited sources.


## All non-API URLs

| URL | Class | Official publisher? | Reachability | Where cited |
| --- | --- | --- | --- | --- |
| <https://github.com/advisories/GHSA-67mh-4wv8-2f99> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:38`, `flagged.html:373`, `reports/external-links-audit.md:51` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/actions/runs/44745300283> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:46`, `reports/external-links-audit.md:52` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/assets/js/alert-engine.js> | GitHub | yes | HTTP 503 | `assets/js/claims.js:301`, `reports/external-links-audit.md:53` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/docs/assets/app.js> | GitHub | yes | HTTP 503 | `assets/js/claims.js:213`, `reports/external-links-audit.md:54` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/blob/main/tools/verify/page-runtime-check.mjs> | GitHub | yes | HTTP 503 | `assets/js/claims.js:253`, `reports/external-links-audit.md:55` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/branches> | GitHub | yes | HTTP 200 | `flagged.html:288`, `questions.html:241`, `reports/external-links-audit.md:56`, `suggestions.html:193` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/commit/6081bb7> | GitHub | yes | HTTP 200 | `assets/js/claims.js:205`, `reports/external-links-audit.md:57` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/commits/main> | GitHub | yes | HTTP 200 | `flagged.html:289`, `reports/external-links-audit.md:58` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/pull/20> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:44`, `reports/external-links-audit.md:59` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/pull/21> | GitHub | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:45`, `reports/external-links-audit.md:60` |
| <https://github.com/kanlerxz87-cyber/KalshiDash2/tree/main/reports> | GitHub | yes | HTTP 200 | `assets/js/claims.js:221`, `reports/external-links-audit.md:61`, `suggestions.html:127` |
| <https://docs.github.com/en/pages> | GitHub docs | yes | HTTP 200 | `assets/js/claims.js:209`, `questions.html:232`, `reports/external-links-audit.md:62` |
| <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site> | GitHub docs | yes | HTTP 200 | `docs/flagged.html:16`, `flagged.html:300`, `flagged.html:380`, `reports/external-links-audit.md:63` |
| <https://assets.kalshi.com/contract_terms/AAADIESEL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:474`, `data/snapshot.json:688`, `data/snapshot.json:728`, `reports/external-links-audit.md:64` |
| <https://assets.kalshi.com/contract_terms/AAAGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:300`, `data/snapshot.json:320`, `data/snapshot.json:398`, `data/snapshot.json:570` (+6 more) |
| <https://assets.kalshi.com/contract_terms/AAAGASMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:1000`, `data/snapshot.json:1019`, `data/snapshot.json:649`, `data/snapshot.json:708` (+5 more) |
| <https://assets.kalshi.com/contract_terms/ACHIEVEMENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34121`, `data/snapshot.json:34197`, `data/snapshot.json:34235`, `data/snapshot.json:34254` (+5 more) |
| <https://assets.kalshi.com/contract_terms/ADVANCE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12266`, `reports/external-links-audit.md:68` |
| <https://assets.kalshi.com/contract_terms/ATHLETEEVENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34482`, `reports/external-links-audit.md:69` |
| <https://assets.kalshi.com/contract_terms/AVAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22891`, `data/snapshot.json:22942`, `reports/external-links-audit.md:70` |
| <https://assets.kalshi.com/contract_terms/BARRELS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:550`, `reports/external-links-audit.md:71` |
| <https://assets.kalshi.com/contract_terms/BCH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23033`, `reports/external-links-audit.md:72` |
| <https://assets.kalshi.com/contract_terms/BILL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12225`, `reports/external-links-audit.md:73` |
| <https://assets.kalshi.com/contract_terms/BRPRES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11779`, `reports/external-links-audit.md:74` |
| <https://assets.kalshi.com/contract_terms/BTC.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22519`, `data/snapshot.json:22621`, `data/snapshot.json:22722`, `reports/external-links-audit.md:75` |
| <https://assets.kalshi.com/contract_terms/BTCMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22857`, `data/snapshot.json:22962`, `data/snapshot.json:23070`, `data/snapshot.json:23090` (+2 more) |
| <https://assets.kalshi.com/contract_terms/COMMOD15M.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:905`, `reports/external-links-audit.md:77` |
| <https://assets.kalshi.com/contract_terms/COMMODITIES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:339`, `data/snapshot.json:358`, `data/snapshot.json:417`, `data/snapshot.json:455` (+2 more) |
| <https://assets.kalshi.com/contract_terms/CONTROL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11836`, `reports/external-links-audit.md:79` |
| <https://assets.kalshi.com/contract_terms/CRYPTO.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22539`, `data/snapshot.json:22579`, `data/snapshot.json:22662`, `data/snapshot.json:22682` (+1 more) |
| <https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23110`, `data/snapshot.json:23190`, `data/snapshot.json:23230`, `data/snapshot.json:23270` (+1 more) |
| <https://assets.kalshi.com/contract_terms/CRYPTOHIT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:23170`, `reports/external-links-audit.md:82` |
| <https://assets.kalshi.com/contract_terms/CRYPTOMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22559`, `data/snapshot.json:23016`, `data/snapshot.json:23210`, `data/snapshot.json:23250` (+1 more) |
| <https://assets.kalshi.com/contract_terms/DOGE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22703`, `data/snapshot.json:22820`, `reports/external-links-audit.md:84` |
| <https://assets.kalshi.com/contract_terms/DOT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22908`, `data/snapshot.json:23050`, `reports/external-links-audit.md:85` |
| <https://assets.kalshi.com/contract_terms/ECONSTATE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:436`, `reports/external-links-audit.md:86` |
| <https://assets.kalshi.com/contract_terms/ELECTION.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11856`, `data/snapshot.json:12010`, `reports/external-links-audit.md:87` |
| <https://assets.kalshi.com/contract_terms/ELECTIONMOV.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11679`, `data/snapshot.json:11698`, `data/snapshot.json:12070`, `reports/external-links-audit.md:88` |
| <https://assets.kalshi.com/contract_terms/ELECTIONPLACE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11660`, `reports/external-links-audit.md:89` |
| <https://assets.kalshi.com/contract_terms/ETH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22600`, `data/snapshot.json:22642`, `reports/external-links-audit.md:90` |
| <https://assets.kalshi.com/contract_terms/ETHMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22779`, `data/snapshot.json:23150`, `reports/external-links-audit.md:91` |
| <https://assets.kalshi.com/contract_terms/FRENCHPRES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12128`, `reports/external-links-audit.md:92` |
| <https://assets.kalshi.com/contract_terms/GOLF3BALL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34615`, `data/snapshot.json:34691`, `reports/external-links-audit.md:93` |
| <https://assets.kalshi.com/contract_terms/GOLFCATEGORYLEADER.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34406`, `reports/external-links-audit.md:94` |
| <https://assets.kalshi.com/contract_terms/GOLFCUT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34273`, `data/snapshot.json:34710`, `reports/external-links-audit.md:95` |
| <https://assets.kalshi.com/contract_terms/GOLFENTITYSTAT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34558`, `reports/external-links-audit.md:96` |
| <https://assets.kalshi.com/contract_terms/GOLFERMAJOR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34748`, `reports/external-links-audit.md:97` |
| <https://assets.kalshi.com/contract_terms/GOLFFINISH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34140`, `data/snapshot.json:34178`, `data/snapshot.json:34216`, `data/snapshot.json:34387` (+6 more) |
| <https://assets.kalshi.com/contract_terms/GOLFH2H.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34672`, `reports/external-links-audit.md:99` |
| <https://assets.kalshi.com/contract_terms/GOLFMILESTONES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34805`, `reports/external-links-audit.md:100` |
| <https://assets.kalshi.com/contract_terms/GOLFPTSLEADER.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34368`, `reports/external-links-audit.md:101` |
| <https://assets.kalshi.com/contract_terms/GOLFROUNDSCORE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34330`, `reports/external-links-audit.md:102` |
| <https://assets.kalshi.com/contract_terms/GOLFSLAM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34539`, `reports/external-links-audit.md:103` |
| <https://assets.kalshi.com/contract_terms/GOV.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11562`, `data/snapshot.json:11601`, `reports/external-links-audit.md:104` |
| <https://assets.kalshi.com/contract_terms/GOVHEAD.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:12168`, `reports/external-links-audit.md:105` |
| <https://assets.kalshi.com/contract_terms/GOVPARTYNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11736`, `data/snapshot.json:11913`, `reports/external-links-audit.md:106` |
| <https://assets.kalshi.com/contract_terms/LEAVEOFFICE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11991`, `reports/external-links-audit.md:107` |
| <https://assets.kalshi.com/contract_terms/LINK.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22759`, `data/snapshot.json:22837`, `reports/external-links-audit.md:108` |
| <https://assets.kalshi.com/contract_terms/LTC.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22874`, `data/snapshot.json:22925`, `reports/external-links-audit.md:109` |
| <https://assets.kalshi.com/contract_terms/NEXTPM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11817`, `reports/external-links-audit.md:110` |
| <https://assets.kalshi.com/contract_terms/NGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:609`, `data/snapshot.json:629`, `data/snapshot.json:924`, `reports/external-links-audit.md:111` |
| <https://assets.kalshi.com/contract_terms/OILRIGS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:512`, `reports/external-links-audit.md:112` |
| <https://assets.kalshi.com/contract_terms/PGARYDERMATCH.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34425`, `reports/external-links-audit.md:113` |
| <https://assets.kalshi.com/contract_terms/PGATOPX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34577`, `reports/external-links-audit.md:114` |
| <https://assets.kalshi.com/contract_terms/PGATOUR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34083`, `data/snapshot.json:34102`, `data/snapshot.json:34159`, `data/snapshot.json:34311` (+5 more) |
| <https://assets.kalshi.com/contract_terms/POLITICALECONOMICEVENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11640`, `data/snapshot.json:11759`, `data/snapshot.json:12149`, `reports/external-links-audit.md:116` |
| <https://assets.kalshi.com/contract_terms/PRESNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11502`, `data/snapshot.json:11542`, `reports/external-links-audit.md:117` |
| <https://assets.kalshi.com/contract_terms/PRESPERSON.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11522`, `reports/external-links-audit.md:118` |
| <https://assets.kalshi.com/contract_terms/ROLEATEVENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:493`, `reports/external-links-audit.md:119` |
| <https://assets.kalshi.com/contract_terms/SEATSCONGRESS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11934`, `data/snapshot.json:12050`, `data/snapshot.json:12246`, `reports/external-links-audit.md:120` |
| <https://assets.kalshi.com/contract_terms/SENATEPARTY.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11972`, `reports/external-links-audit.md:121` |
| <https://assets.kalshi.com/contract_terms/SENATEPARTYNOM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11875`, `data/snapshot.json:11894`, `data/snapshot.json:12029`, `data/snapshot.json:12109` (+1 more) |
| <https://assets.kalshi.com/contract_terms/SHIBA.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22742`, `data/snapshot.json:22799`, `reports/external-links-audit.md:123` |
| <https://assets.kalshi.com/contract_terms/SOLAR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:531`, `reports/external-links-audit.md:124` |
| <https://assets.kalshi.com/contract_terms/SPR.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:867`, `reports/external-links-audit.md:125` |
| <https://assets.kalshi.com/contract_terms/SPRUSE.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:668`, `reports/external-links-audit.md:126` |
| <https://assets.kalshi.com/contract_terms/USELECTION.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11581`, `data/snapshot.json:11621`, `data/snapshot.json:11798`, `data/snapshot.json:12090` (+3 more) |
| <https://assets.kalshi.com/contract_terms/VOTEPERCENT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11717`, `reports/external-links-audit.md:128` |
| <https://assets.kalshi.com/contract_terms/WLEADEROUT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11953`, `reports/external-links-audit.md:129` |
| <https://assets.kalshi.com/contract_terms/WTIMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:377`, `data/snapshot.json:589`, `reports/external-links-audit.md:130` |
| <https://assets.kalshi.com/contract_terms/WTIOIL.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:261`, `data/snapshot.json:280`, `reports/external-links-audit.md:131` |
| <https://assets.kalshi.com/contract_terms/XBANNED.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22469`, `data/snapshot.json:22488`, `reports/external-links-audit.md:132` |
| <https://assets.kalshi.com/contract_terms/XLM.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22979`, `data/snapshot.json:22996`, `reports/external-links-audit.md:133` |
| <https://assets.kalshi.com/regulatory/product-certifications/AAAGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:942`, `reports/external-links-audit.md:134` |
| <https://assets.kalshi.com/regulatory/product-certifications/AAAGASMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:1018`, `data/snapshot.json:961`, `data/snapshot.json:980`, `data/snapshot.json:999` (+1 more) |
| <https://assets.kalshi.com/regulatory/product-certifications/ACHIEVEMENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34120`, `data/snapshot.json:34196`, `data/snapshot.json:34234`, `data/snapshot.json:34253` (+5 more) |
| <https://assets.kalshi.com/regulatory/product-certifications/COMMODITIES.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:885`, `reports/external-links-audit.md:137` |
| <https://assets.kalshi.com/regulatory/product-certifications/CRYPTO.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22538`, `data/snapshot.json:22578`, `data/snapshot.json:22661`, `data/snapshot.json:22681` (+1 more) |
| <https://assets.kalshi.com/regulatory/product-certifications/CRYPTOMINMAX.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:22558`, `data/snapshot.json:23015`, `data/snapshot.json:23209`, `data/snapshot.json:23249` (+1 more) |
| <https://assets.kalshi.com/regulatory/product-certifications/GOLFENTITYSTAT.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:34557`, `reports/external-links-audit.md:140` |
| <https://assets.kalshi.com/regulatory/product-certifications/NGAS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:923`, `reports/external-links-audit.md:141` |
| <https://assets.kalshi.com/regulatory/product-certifications/POLITICALECONOMICEVENTS.pdf> | Kalshi asset host | yes | HTTP 200 | `data/snapshot.json:11639`, `data/snapshot.json:12148`, `reports/external-links-audit.md:142` |
| <https://demo.kalshi.co> | Kalshi demo site | yes | HTTP 200 | `README.md:23`, `docs/flagged.html:10`, `reports/external-links-audit.md:143` |
| <https://demo.kalshi.co/> | Kalshi demo site | yes | HTTP 200 | `docs/sources.html:9`, `reports/external-links-audit.md:144` |
| <https://demo.kalshi.co/account/profile> | Kalshi demo site | yes | HTTP 200 | `portfolio.html:23`, `questions.html:63`, `reports/external-links-audit.md:145` |
| <https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account> | Kalshi help centre | yes | HTTP 200 | `docs/sources.html:29`, `reports/external-links-audit.md:146` |
| <https://docs.kalshi.com> | Kalshi official docs | yes | HTTP 200 | `README.md:23`, `assets/js/claims.js:13`, `assets/js/ui.js:152`, `data/snapshot.json:7` (+25 more) |
| <https://docs.kalshi.com/api-reference/events/get-event> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `alerts.html:194`, `flagged.html:332`, `flagged.html:438` (+4 more) |
| <https://docs.kalshi.com/api-reference/events/get-events> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `assets/js/alert-engine.js:198`, `assets/js/config.js:32`, `assets/js/market.js:517` (+15 more) |
| <https://docs.kalshi.com/api-reference/exchange/get-exchange-status> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:35`, `reports/external-links-audit.md:150` |
| <https://docs.kalshi.com/api-reference/market/batch-get-market-candlesticks> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:20`, `docs/category-crypto.html:21`, `docs/category-culture.html:21`, `docs/category-elections.html:21` (+9 more) |
| <https://docs.kalshi.com/api-reference/market/get-market> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:17`, `alerts.html:131`, `assets/js/alert-engine.js:10`, `assets/js/alerts-core.js:125` (+28 more) |
| <https://docs.kalshi.com/api-reference/market/get-market-candlesticks> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:23`, `VERIFICATION.md:19`, `assets/js/config.js:30`, `assets/js/simulator.js:14` (+17 more) |
| <https://docs.kalshi.com/api-reference/market/get-market-orderbook> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:21`, `docs/category-crypto.html:26`, `docs/category-culture.html:26`, `docs/category-elections.html:26` (+6 more) |
| <https://docs.kalshi.com/api-reference/market/get-markets> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:16`, `alerts.html:193`, `assets/js/config.js:31` (+18 more) |
| <https://docs.kalshi.com/api-reference/market/get-series> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:34`, `reports/external-links-audit.md:156` |
| <https://docs.kalshi.com/api-reference/market/get-series-list> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:18`, `assets/js/config.js:33`, `data/snapshot.json:11482`, `data/snapshot.json:22452` (+20 more) |
| <https://docs.kalshi.com/api-reference/orders/> | Kalshi official docs | yes | HTTP 200 | `reports/external-links-audit.md:158`, `reports/verify-facts-v3.md:130` |
| <https://docs.kalshi.com/api-reference/orders/create-ord> | Kalshi official docs | yes | HTTP 404 | `evidence/evidence-cors-taxonomy.md:278`, `reports/external-links-audit.md:159`, `reports/verify-facts-raw.md:278` |
| <https://docs.kalshi.com/api-reference/orders/create-order-v2> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:12`, `assets/js/config.js:27`, `docs/portfolio.html:25` (+9 more) |
| <https://docs.kalshi.com/api-reference/orders/get-orders> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:40` |
| <https://docs.kalshi.com/api-reference/portfolio/get-balance> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:37`, `portfolio.html:129`, `reports/external-links-audit.md:161`, `summary.html:147` (+1 more) |
| <https://docs.kalshi.com/api-reference/portfolio/get-fills> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:25`, `assets/js/config.js:38`, `docs/analysis.html:7` (+13 more) |
| <https://docs.kalshi.com/api-reference/portfolio/get-orders> | Kalshi official docs | yes | HTTP 404 | `reports/external-links-audit.md:163` |
| <https://docs.kalshi.com/api-reference/portfolio/get-positions> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:28`, `VERIFICATION.md:26`, `assets/js/config.js:39`, `docs/portfolio.html:18` (+9 more) |
| <https://docs.kalshi.com/api-reference/portfolio/get-settlements> | Kalshi official docs | yes | HTTP 200 | `docs/analysis.html:36`, `docs/flagged.html:14`, `docs/questions.html:15`, `docs/sources.html:26` (+2 more) |
| <https://docs.kalshi.com/getting_started/api_environments> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `assets/js/config.js:23`, `docs/sources.html:10`, `reports/external-links-audit.md:166` |
| <https://docs.kalshi.com/getting_started/api_keys> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:24`, `docs/sources.html:11`, `evidence/auth-sign-test.mjs:2`, `flagged.html:59` (+5 more) |
| <https://docs.kalshi.com/getting_started/demo_env> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:27`, `VERIFICATION.md:7`, `VERIFICATION.md:8` (+18 more) |
| <https://docs.kalshi.com/getting_started/exchange_sharding> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:47`, `reports/external-links-audit.md:169` |
| <https://docs.kalshi.com/getting_started/fee_rounding> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:48`, `reports/external-links-audit.md:170` |
| <https://docs.kalshi.com/getting_started/fixed_point_migration> | Kalshi official docs | yes | HTTP 200 | `QUESTIONS.md:16`, `VERIFICATION.md:23`, `assets/js/config.js:43`, `docs/category-crypto.html:14` (+13 more) |
| <https://docs.kalshi.com/getting_started/historical_data> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:46`, `docs/questions.html:12`, `reports/external-links-audit.md:172` |
| <https://docs.kalshi.com/getting_started/market_lifecycle> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `VERIFICATION.md:24`, `alerts.html:195`, `assets/js/config.js:45` (+5 more) |
| <https://docs.kalshi.com/getting_started/market_settlement> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:18`, `alerts.html:196`, `assets/js/config.js:44`, `docs/resolved.html:7` (+12 more) |
| <https://docs.kalshi.com/getting_started/order_direction> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:28`, `flagged.html:76`, `reports/external-links-audit.md:175`, `strategies.html:29` (+1 more) |
| <https://docs.kalshi.com/getting_started/order_errors> | Kalshi official docs | yes | HTTP 200 | `portfolio.html:304`, `reports/external-links-audit.md:176` |
| <https://docs.kalshi.com/getting_started/orderbook_responses> | Kalshi official docs | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:23`, `VERIFICATION.md:22`, `assets/js/config.js:29`, `docs/dashboard.html:27` (+7 more) |
| <https://docs.kalshi.com/getting_started/quick_start_authenticated_requests> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:13`, `VERIFICATION.md:14`, `VERIFICATION.md:15`, `assets/js/config.js:25` (+15 more) |
| <https://docs.kalshi.com/getting_started/quick_start_create_order> | Kalshi official docs | yes | HTTP 200 | `VERIFICATION.md:10`, `VERIFICATION.md:11`, `assets/js/config.js:26`, `docs/flagged.html:9` (+8 more) |
| <https://docs.kalshi.com/getting_started/quick_start_websockets> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:42`, `flagged.html:197`, `reports/external-links-audit.md:180` |
| <https://docs.kalshi.com/getting_started/rate_limits> | Kalshi official docs | yes | HTTP 200 | `alerts.html:197`, `assets/js/config.js:204`, `assets/js/config.js:41`, `flagged.html:145` (+3 more) |
| <https://docs.kalshi.com/getting_started/terms> | Kalshi official docs | yes | HTTP 200 | `assets/js/config.js:49`, `reports/external-links-audit.md:182` |
| <https://kalshi.com> | Kalshi official site | yes | HTTP 429 | `tests/dom/summary-dom.mjs:81` |
| <https://kalshi.com/> | Kalshi official site | yes | HTTP 429 | `evidence/evidence-routes-settled.md:81` ×4, `reports/external-links-audit.md:183`, `reports/verify-facts-v2.md:81` ×4 |
| <https://kalshi.com/docs/kalshi-fee-schedule.pdf> | Kalshi official site | yes | HTTP 429 | `VERIFICATION.md:28`, `assets/js/claims.js:249`, `docs/sources.html:28`, `docs/verification.html:30` (+8 more) |
| <https://www.ap.org> | Kalshi-named settlement source (news) | no | HTTP 200 | `evidence/evidence-routes-settled.md:81`, `reports/external-links-audit.md:185`, `reports/verify-facts-v2.md:81` |
| <https://www.nytimes.com> | Kalshi-named settlement source (news) | no | HTTP 403 | `evidence/evidence-routes-settled.md:81`, `reports/external-links-audit.md:186`, `reports/verify-facts-v2.md:81` |
| <https://www.nytimes.com/> | Kalshi-named settlement source (news) | no | HTTP 403 | `reports/alerts-live-check.md:32` |
| <https://www.reuters.com> | Kalshi-named settlement source (news) | no | HTTP 401 | `evidence/evidence-routes-settled.md:81`, `reports/external-links-audit.md:187`, `reports/verify-facts-v2.md:81` |
| <https://www.reuters.com/> | Kalshi-named settlement source (news) | no | HTTP 401 | `reports/alerts-live-check.md:34` |
| <https://www.theguardian.com> | Kalshi-named settlement source (news) | no | HTTP 200 | `evidence/evidence-routes-settled.md:81`, `reports/external-links-audit.md:188`, `reports/verify-facts-v2.md:81` |
| <https://www.espn.com> | Kalshi-named settlement source (sports) | no | HTTP 200 | `reports/external-links-audit.md:189` |
| <https://www.fifa.com> | Kalshi-named settlement source (sports) | no | HTTP 200 | `reports/external-links-audit.md:190` |
| <https://apnews.com/> | OTHER (unclassified) | unknown | HTTP 403 | `reports/alerts-live-check.md:33` |
| <https://www.abc.net.au/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:38` |
| <https://www.axios.com/> | OTHER (unclassified) | unknown | HTTP 403 | `reports/alerts-live-check.md:35` |
| <https://www.cbsnews.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:39` |
| <https://www.cnn.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:40` |
| <https://www.foxnews.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:41` |
| <https://www.msnbc.com/> | OTHER (unclassified) | unknown | HTTP 200 | `reports/alerts-live-check.md:42` |
| <https://www.politi> | OTHER (unclassified) | unknown | error: gaierror | `evidence/evidence-routes-settled.md:81`, `flagged.html:420`, `reports/external-links-audit.md:191`, `reports/external-links-audit.md:37` (+2 more) |
| <https://www.wsj.com/> | OTHER (unclassified) | unknown | HTTP 401 | `reports/alerts-live-check.md:36`, `reports/alerts-live-check.md:37` |
| <https://kanlerxz87-cyber.github.io> | Origin string (not a link) | unknown | HTTP 404 | `assets/js/claims.js:45`, `docs/flagged.html:9`, `evidence/evidence-cors-taxonomy.md:12`, `evidence/evidence-cors-taxonomy.md:31` (+15 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAADIESEL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:473`, `data/snapshot.json:687`, `data/snapshot.json:727`, `reports/external-links-audit.md:192` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGAS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:299`, `data/snapshot.json:319`, `data/snapshot.json:397`, `data/snapshot.json:569` (+6 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AAAGASMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:648`, `data/snapshot.json:707`, `data/snapshot.json:787`, `data/snapshot.json:807` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ADVANCE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12265`, `reports/external-links-audit.md:195` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ATHLETEEVENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34481`, `reports/external-links-audit.md:196` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/AVAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22890`, `data/snapshot.json:22941`, `reports/external-links-audit.md:197` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BARRELS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:549`, `reports/external-links-audit.md:198` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BCH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23032`, `reports/external-links-audit.md:199` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BILL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12224`, `reports/external-links-audit.md:200` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BRPRES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11778`, `reports/external-links-audit.md:201` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BTC.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22518`, `data/snapshot.json:22620`, `data/snapshot.json:22721`, `reports/external-links-audit.md:202` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BTCMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22856`, `data/snapshot.json:22961`, `data/snapshot.json:23069`, `data/snapshot.json:23089` (+2 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/COMMOD15M.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:904`, `reports/external-links-audit.md:204` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/COMMODITIES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:338`, `data/snapshot.json:357`, `data/snapshot.json:416`, `data/snapshot.json:454` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CONTROL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11835`, `reports/external-links-audit.md:206` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CRYPTO15M.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23109`, `data/snapshot.json:23189`, `data/snapshot.json:23229`, `data/snapshot.json:23269` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/CRYPTOHIT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:23169`, `reports/external-links-audit.md:208` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/DOGE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22702`, `data/snapshot.json:22819`, `reports/external-links-audit.md:209` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/DOT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22907`, `data/snapshot.json:23049`, `reports/external-links-audit.md:210` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ECONSTATE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:435`, `reports/external-links-audit.md:211` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTION.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11855`, `data/snapshot.json:12009`, `reports/external-links-audit.md:212` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTIONMOV.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11678`, `data/snapshot.json:11697`, `data/snapshot.json:12069`, `reports/external-links-audit.md:213` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ELECTIONPLACE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11659`, `reports/external-links-audit.md:214` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ETH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22599`, `data/snapshot.json:22641`, `reports/external-links-audit.md:215` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ETHMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22778`, `data/snapshot.json:23149`, `reports/external-links-audit.md:216` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/FRENCHPRES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12127`, `reports/external-links-audit.md:217` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLF3BALL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34614`, `data/snapshot.json:34690`, `reports/external-links-audit.md:218` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFCATEGORYLEADER.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34405`, `reports/external-links-audit.md:219` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFCUT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34272`, `data/snapshot.json:34709`, `reports/external-links-audit.md:220` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFERMAJOR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34747`, `reports/external-links-audit.md:221` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFFINISH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34139`, `data/snapshot.json:34177`, `data/snapshot.json:34215`, `data/snapshot.json:34386` (+6 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFH2H.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34671`, `reports/external-links-audit.md:223` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFMILESTONES.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34804`, `reports/external-links-audit.md:224` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFPTSLEADER.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34367`, `reports/external-links-audit.md:225` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFROUNDSCORE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34329`, `reports/external-links-audit.md:226` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOLFSLAM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34538`, `reports/external-links-audit.md:227` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOV.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11561`, `data/snapshot.json:11600`, `reports/external-links-audit.md:228` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOVHEAD.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:12167`, `reports/external-links-audit.md:229` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GOVPARTYNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11735`, `data/snapshot.json:11912`, `reports/external-links-audit.md:230` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LEAVEOFFICE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11990`, `reports/external-links-audit.md:231` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LINK.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22758`, `data/snapshot.json:22836`, `reports/external-links-audit.md:232` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/LTC.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22873`, `data/snapshot.json:22924`, `reports/external-links-audit.md:233` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/NEXTPM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11816`, `reports/external-links-audit.md:234` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/NGAS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:608`, `data/snapshot.json:628`, `reports/external-links-audit.md:235` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/OILRIGS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:511`, `reports/external-links-audit.md:236` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGARYDERMATCH.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34424`, `reports/external-links-audit.md:237` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGATOPX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34576`, `reports/external-links-audit.md:238` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PGATOUR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:34082`, `data/snapshot.json:34101`, `data/snapshot.json:34158`, `data/snapshot.json:34310` (+5 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/POLITICALECONOMICEVENTS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11758`, `reports/external-links-audit.md:240` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PRESNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11501`, `data/snapshot.json:11541`, `reports/external-links-audit.md:241` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/PRESPERSON.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11521`, `reports/external-links-audit.md:242` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/ROLEATEVENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:492`, `reports/external-links-audit.md:243` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SEATSCONGRESS.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11933`, `data/snapshot.json:12049`, `data/snapshot.json:12245`, `reports/external-links-audit.md:244` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SENATEPARTY.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11971`, `reports/external-links-audit.md:245` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SENATEPARTYNOM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11874`, `data/snapshot.json:11893`, `data/snapshot.json:12028`, `data/snapshot.json:12108` (+1 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SHIBA.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22741`, `data/snapshot.json:22798`, `reports/external-links-audit.md:247` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SOLAR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:530`, `reports/external-links-audit.md:248` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SPR.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:866`, `reports/external-links-audit.md:249` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/SPRUSE.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:667`, `reports/external-links-audit.md:250` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/USELECTION.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11580`, `data/snapshot.json:11620`, `data/snapshot.json:11797`, `data/snapshot.json:12089` (+3 more) |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/VOTEPERCENT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11716`, `reports/external-links-audit.md:252` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WLEADEROUT.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:11952`, `reports/external-links-audit.md:253` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WTIMINMAX.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:376`, `data/snapshot.json:588`, `reports/external-links-audit.md:254` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/WTIOIL.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:260`, `data/snapshot.json:279`, `reports/external-links-audit.md:255` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/XBANNED.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22468`, `data/snapshot.json:22487`, `reports/external-links-audit.md:256` |
| <https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/XLM.pdf> | STAGING bucket (flag) | no | HTTP 403 | `data/snapshot.json:22978`, `data/snapshot.json:22995`, `reports/external-links-audit.md:257` |
| <https://example.com/news> | Test fixture (reserved domain) | no | HTTP 404 | `reports/external-links-audit.md:258`, `tools/verify/page-runtime-check.mjs:87` |
| <https://example.com/results> | Test fixture (reserved domain) | no | HTTP 404 | `reports/external-links-audit.md:259`, `tools/verify/page-runtime-check.mjs:88` |
| <https://example.org/fixture-> | Test fixture (reserved domain) | no | HTTP 404 | `reports/external-links-audit.md:260`, `tests/dom/alerts-dom.mjs:74` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:9`, `README.md:11`, `evidence/README.md:4`, `reports/external-links-audit.md:262` (+5 more) |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:10`, `EXECUTIVE_SUMMARY.md:25`, `reports/external-links-audit.md:263`, `tests/dom/alerts-dom.mjs:84` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html> | This project's Pages site | yes | HTTP 200 | `EXECUTIVE_SUMMARY.md:11`, `EXECUTIVE_SUMMARY.md:47`, `reports/external-links-audit.md:264` |
| <https://kanlerxz87-cyber.github.io/KalshiDash2/summary.html> | This project's Pages site | yes | HTTP 200 | `tests/dom/summary-dom.mjs:30` |
| <http://www.w3.org/2000/svg> | W3C standard | yes | HTTP 200 | `index.html:8`, `reports/external-links-audit.md:265` |
| <https://www.w3.org/TR/WebCryptoAPI/> | W3C standard | yes | HTTP 200 | `assets/js/claims.js:121`, `reports/external-links-audit.md:266` |

## Kalshi API endpoints (not fetched as pages)

Query-string variants of API calls are counted per host, not listed one by one.

| API host | Distinct URLs |
| --- | --- |
| `demo-api.kalshi.co` | 1 |
| `external-api.demo.kalshi.co` | 1097 |

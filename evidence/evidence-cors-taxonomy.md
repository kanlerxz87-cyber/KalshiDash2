# Raw facts captured from the Kalshi DEMO API

- Captured (UTC): 2026-11-20T11:08:00Z
- Runner: GitHub Actions `ubuntu-latest`
- Base: `https://external-api.demo.kalshi.co/trade-api/v2`
- Commit: `3fed79cf3abc470f837400e0f9704418a210edf1`

## 1. CORS — simple GET with Origin header
```
HTTP/2 200 
access-control-allow-credentials: true
access-control-allow-origin: https://kanlerxz87-cyber.github.io
access-control-expose-headers: X-Csrf-Token,X-Ratelimit-Limit,X-Ratelimit-Remaining,X-Ratelimit-Reset,X-Ratelimit-Cost
cache-control: public, max-age=1
content-security-policy: default-src 'none';
content-type: application/json; charset=utf-8
strict-transport-security: max-age=31536000; includeSubDomains
vary: Origin, Accept-Language
x-content-type-options: nosniff
content-length: 632
date: Fri, 20 Nov 2026 11:08:00 GMT

```

## 2. CORS — OPTIONS preflight on /markets
```
HTTP/2 204 
access-control-allow-credentials: true
access-control-allow-headers: Origin,Content-Length,Content-Type,Idempotency-Key,X-Csrf-Token,X-Aws-Waf-Token,Traceparent,Tracestate,X-Gclid,X-Msclkid,X-Gbraid,X-Fbclid,X-Fbp,X-Fbc,X-Rdt-Cid,X-Ttclid,X-Ttp,X-Twclid,X-Sc-Cid,X-Idfa,X-Device-Idfv,X-Advertising-Id,X-Firebase-App-Instance-Id,X-Appsflyer-Web-Id,X-Af-Channel,X-Af-Media-Source,X-Appsflyer-Device-Id,X-Att-Status,X-Signature
access-control-allow-methods: GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS
access-control-allow-origin: https://kanlerxz87-cyber.github.io
access-control-max-age: 43200
content-security-policy: default-src 'none';
strict-transport-security: max-age=31536000; includeSubDomains
vary: Origin
vary: Access-Control-Request-Method
vary: Access-Control-Request-Headers
x-content-type-options: nosniff
date: Fri, 20 Nov 2026 11:08:00 GMT

```

## 3. CORS — GET /markets with Origin header
```
HTTP/2 200 
access-control-allow-credentials: true
access-control-allow-origin: https://kanlerxz87-cyber.github.io
access-control-expose-headers: X-Csrf-Token,X-Ratelimit-Limit,X-Ratelimit-Remaining,X-Ratelimit-Reset,X-Ratelimit-Cost
cache-control: public, max-age=5
content-security-policy: default-src 'none';
content-type: application/json
strict-transport-security: max-age=31536000; includeSubDomains
vary: Origin, Accept-Encoding, Accept-Language
x-content-type-options: nosniff
x-kalshi-cache-hits: 1
content-length: 2280
date: Fri, 20 Nov 2026 11:08:00 GMT

```

## 4. Event categories present in the demo environment
Total events returned: 200

| Category | Count |
| --- | --- |
| Economics | 55 |
| Sports | 46 |
| Elections | 39 |
| Science and Technology | 15 |
| Politics | 14 |
| Financials | 9 |
| Climate and Weather | 8 |
| Entertainment | 8 |
| Companies | 2 |
| Crypto | 2 |
| World | 1 |
| Social | 1 |

## 5. Series matching the five required topics

Method: `GET /series?limit=200` (paginated up to 5 pages), filtered client-side on
ticker/title/category substrings. Case-insensitive. No ticker is hardcoded.

Series returned on first page: 16643 | next cursor present: false

### gas — 196 matching series

| Series ticker | Kalshi category | Title |
| --- | --- | --- |
| KXAAAGASCDMT | Economics | Montana gas price |
| KXAAAGASMIN | Economics | US lowest gas price yearly |
| KXAAAGASCDCO | Economics | Colorado gas price |
| KXAAAGASY | Economics | US gas price up |
| NGASMAX | Economics | Natural gas price peak |
| KXGAS-MONTH | Economics | Gas monthly |
| KXAAAGASMINFL | Economics | Florida lowest gas price yearly |
| AAAGASMAXTX | Economics | Texas highest gas price yearly |
| KXAAAGASCDME | Economics | Maine gas price |
| KXNATGASMON | Commodities | Natural Gas Monthly |
| KXAAAGASDGA | Economics | Georgia gas price |
| KXEIAGASINVM | Economics | U.S. gasoline inventories |
| KXAAAGASCDIN | Economics | Indiana gas price |
| KXAAAGASCDAR | Economics | Arkansas gas price |
| AAAGASMIN | Economics | US lowest gas price yearly |
| KXNBALASVEGAS | Sports | Las Vegas NBA team |
| KXNGAS | Economics | Natural gas price max and min monthly |
| KXSUSPENDGASTAX | Politics | Will the federal gas tax be suspended? |
| KXNGASMIN | Economics | Natural gas yearly low |
| KXAAAGASMTX | Economics | Texas gas price this month |
| KXNATGAS15M | Commodities | Natural Gas 15-minute |
| KXAAAGASCDID | Economics | Idaho gas price |
| KXGAS | Economics | Gas weekly |
| KXAAAGASMAXTX | Economics | Texas highest gas price yearly |
| KXPGASTROKEMARGIN | Sports | PGA Stroke Margin |
| KXAAAGASDOK | Economics | Oklahoma gas price |
| GASD | Economics | Gas daily |
| KXLALIGASPREAD | Sports | La Liga Spread |
| KXAAAGASCDDE | Economics | Delaware gas price |
| KXTTFD | Commodities | Dutch TTF gas daily |

### elections — 3073 matching series

| Series ticker | Kalshi category | Title |
| --- | --- | --- |
| KXNEPRIMARY | Elections | Nebraska Primary Winners |
| KXSTATELEGAK | Elections | Alaska Legislature race winner? |
| TRDBAN | Politics | Congress banned from trading stocks |
| KXAUDITORRACE | Elections | Auditor race winner? |
| FLORIDA |  | Florida Governor's Race |
| KXCLARITYVOTE | Politics | Will the Senate vote on the Clarity Act? |
| KXDELTASTATEGOV | Elections | Delta State Governor winner |
| KXMANCHINCOMBO | Elections | Manchin Senate combo |
| KXLTGOVVT | Elections | Lt. Gov in Vermont |
| KXKSSENGOVCOMBO | Elections | Kansas Senate-Governor Combo |
| KXLEAVEGONZALES | Politics | Will Tony Gonzales leave Congress before the Midterms? |
| KXGOVSENSPLIT | Elections | Senate-Governor split results |
| KXNLPROVINCIAL | Elections | Dutch Provincial Elections: Most Votes Won |
| KXHILTONOUTPERFORMRCP | Elections | Will Steve Hilton outperform the polls? |
| KXAPCALLVAGOV | Elections | Associated Press calls VA gubernatorial race |
| KXWTIE | Commodities | WTI oil election day |
| KXSECSTATEID | Elections | Idaho Secretary of State winner? |
| KXMAYORDET | Elections | Detroit election |
| KXKHANNARUN | Elections | Ro Khanna announces presidential run by...? |
| KXTXABBOTTPAXTON | Elections | Texas: Abbott vs. Paxton margin |
| KXMNRECOUNTMARGIN | Elections | Minnesota Republican Governor primary recount: margin shift? |
| KXFIRSTENDORSENOMD | Elections | Which groups' first 2028 endorsement will be the Democratic nominee? |
| KXVALENCIACOUNCIL | Elections | Valencia municipal election winner |
| HOUSECA13 | Elections | House CA 13 |
| KXSENDEMNO3 | Elections | No. 3 Senate Democrat |
| KXDUTCHPM | Elections | next Dutch prime minister |
| KXNAVAJOPRES | Elections | Navajo Nation presidential election |
| KXMALAWIPRES | Elections | Malawi presidency |
| KXMOVKSNESEN | Elections | Larger margin of victory: Kansas or Nebraska Senate? |
| KXGREENPERCENT | Elections | Green % |

### culture — 843 matching series

| Series ticker | Kalshi category | Title |
| --- | --- | --- |
| KXSAGNOMACTOLIM | Entertainment | Outstanding Performance by a Male Actor in a Television Movie or Limited Series |
| OSCARCOUNTDUNE2 | Entertainment | Dune Part Two Oscar wins |
| KXAWARDCOUNTKENDRICK | Entertainment | HOW MANY AWARDS WILL KENDRICK LAMAR WIN? |
| KXPPTONIGHT | Entertainment | total streams for Tonight |
| KXDIRECTORMARVEL | Entertainment | WILL PERSON DIRECT MARVEL MOVIE? |
| KXOSCARPROD | Entertainment | Oscar for Best Production Design |
| KXLBLGAME | Sports | Latvia LBL Game |
| KXGGDRAMATVACTO | Entertainment | Golden Globe for Best Actor in a Drama TV |
| KXBAFTAPRODDES | Entertainment | BAFTA Film Awards: Best Production Design Winner |
| KXTVSEASONRELEASEACOURTOFTHORNSANDROSES | Entertainment | Will ACOTAR (A Court Of Thorns and Roses) obtain a running tv series before 2030? |
| KXMOSTSTREAMEDWICKED | Entertainment | Most streamed song on wicked |
| KXOSCARDEI | Entertainment | Oscars DEI ended |
| KXGRAMMYCOUNTPOSTMALONE | Entertainment | POST MALONE Grammy Wins |
| KXGGMCOMFILMACTR | Entertainment | Golden Globe for Best Actress in a Musical or Comedy film |
| KXSPOTIFYSONGSALM | Entertainment | TOTAL SPOTIFY STREAMS FOR ED SHEERANS A LITTLE MORE |
| KXLATVIAPARLIAMENT | Elections | Latvia Parliament elections |
| KXPCTVOTELANR1 | Elections | Lander |
| KXCASEWINMUSIC | Entertainment | will party win its lawsuit against party? |
| KXPERSONAWARD | Entertainment | when will person win award |
| KXSPOTIFYSONGSBRUNAWAY | Entertainment | Will song receive a billion streams on spotify |
| KXOSCARCOUNTSUBSTANCE | Entertainment | The Substance Oscar Wins |
| KXLATINGRAMMYROTY | Entertainment | LATIN GRAMMY RECORD OF THE YEAR  |
| KXCRITICSLSERIESSUPACTR | Entertainment | Critics Choice Award for Best Supporting Actress |
| KXHOBEYBAKER | Sports | Hobey Baker Award |
| KXGGFILMSUPACTO | Entertainment | Golden Globe for Best Supporting Actor in a film |
| KXSAGAWARDENSEMBLE | Entertainment | SAG Award for Outstanding Cast |
| KXGGTVSUPACTR | Entertainment | Golden Globe for Best Supporting Actress TV |
| KXGRAMMYNOMROTY | Entertainment | Grammy nominees for Record of the Year |
| KXCRITICSDRAMASUPACTR | Entertainment | Critics Choice Award for Best TV Drama Supporting Actress |
| OSCARACTO | Entertainment | Oscar for Best Actor |

### crypto — 503 matching series

| Series ticker | Kalshi category | Title |
| --- | --- | --- |
| KXSOLTXCOUNT | Crypto | SOL transaction count |
| KXBTCATH | Crypto | BTC ATH |
| KXVOTEHEGSETH | Politics | Senators voting for Pete Hegseth |
| KXDOTMAXY | Crypto | Polkadot max |
| KXSOLABOVE150BY | Crypto | Solana above $150 by a date |
| KXARTISTCOLLABDRAKEMINAJ | Entertainment | Will drake and nickie minaj make a song together |
| KXTOKENLAUNCHOPENSEA | Crypto | OpenSea token |
| KXBTC50VS100 | Crypto | Will BTC fall below 50k before hitting 100k? |
| KXCOUPEDEFRANCEMOF | Sports | Method of Finish |
| BTCETHRETURN | Crypto | BTC vs. ETH performance |
| KXNEARH | Crypto | NEAR Directional |
| KXAFCACMOV | Sports | Method of Victory |
| KXDOGEMINMON | Crypto | Doge min monthly |
| KXUSOPENCUPMOV | Sports | Method of Victory |
| KXDJTCHAIN | Crypto | DJT Chain launch |
| KXTON15M | Crypto | TON 15m |
| KXRPRESPRIMWIN | Elections | Who will win a state in the 2028 Republican primaries? |
| KXSTABLECOIN | Politics | Stablecoin legislation |
| KXESPSUPERCUPMOV | Sports | Method of Victory |
| KXBETHER | Entertainment | BET Her |
| KXRIPPLED | Crypto | Ripple price Above/below |
| KXLINK | Crypto | Chainlink range |
| KXTRUFCMC | Economics | CoinMarketCap Total Market Cap	 |
| KXDOTPERP | Crypto | 10 DOT |
| KXETHEU | Crypto | ETH up after election day |
| KXDOGEY | Crypto | DOGE yearly |
| KXXRPMAXY | Crypto | XRP Max |
| KXBTCMAXQ | Crypto | BTC Max Quarterly |
| KXSOL150 | Crypto | Will SOL hit $150 this year |
| KXZECH | Crypto | Zcash Directional |

### golf — 238 matching series

| Series ticker | Kalshi category | Title |
| --- | --- | --- |
| KXNYELIVE | Entertainment | WHO WILL BE ON CNN’s New Year’s Eve Live with Anderson Cooper and Andy Cohen |
| KXTRUMPGALLUP50 | Politics | Trump Gallup approval 50.0% or above |
| KXNEXTWIN | Sports | Will golfer win this tournament next? |
| KXGOLFTENNISMAJORS | Sports | More Major Wins, Tennis vs Golf |
| KXTRUMPGOLFD | Politics | Will Trump golf? |
| KXPGAT5 | Sports | T 5 |
| KXFACUPGAME | Sports | FA Cup Game |
| KXOSCARNOMSHORTFILM | Entertainment | LIVE ACTION SHORT FILM |
| KXPGAR2LEAD | Sports | PGA Round 2 Leader |
| KXSCOCUPGAME | Sports | Scottish Cup Game |
| KXPGAALBATROSS | Sports | Golf Albatross |
| KXPGA1STTIMEWIN | Sports | PGA 1st Time Winner |
| KXOSCARLASF | Entertainment | Live action short film |
| KXEFLCHAMPIONSHIPGAME | Sports | EFL Championship Game |
| KXPGABOGEYFREE | Sports | Will Golfer Record a bogey free round |
| KXTRUMPGOLFM | Politics | How many days will Trump golf? |
| KXPGAR1T10 | Sports | r1 top 10 |
| KXPGAHOLEINONE | Sports | PGA Hole in One |
| KXSRBCUPGAME | Sports | Serbian Cup Game |
| KXDELIVERIES | Financials | Top Delivery KPI  |
| KXGOLF | Sports | Golf Tournament Winner |
| KXPGASTROKEMARGIN | Sports | PGA Stroke Margin |
| KXBOLIVIARUNOFFMOV | Elections | Bolivia Runoff Margin of Victory |
| KXPGAHOLESCORE | Sports | PGA Hole Score |
| TOPALBUMBYDONTOLIVER | Entertainment | Don Toliver #1 album |
| KXLCATTLED | Commodities | Live cattle Daily |
| KXPGAREGION | Sports | PGA Region Winner |
| KXPGAWIN | Sports | Golfer to Win |
| KXPGATOP20 | Sports | PGA Top 20 Finisher |
| KXARGCUPGAME | Sports | Argentina Cup Game |

## 6. Candlestick endpoint — documented intervals and real response

Market with the largest volume_fp found in the demo sample: ``

## 7. Auth-protected endpoints without credentials

| Endpoint | HTTP status | Body (truncated) |
| --- | --- | --- |
| `/portfolio/balance` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `/portfolio/positions` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `/portfolio/fills` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `/portfolio/orders` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |

## 8. Order-placement route probe (unauthenticated; route existence only)

| Method+Path | HTTP status | Body (truncated) | Interpretation |
| --- | --- | --- | --- |
| `POST /portfolio/orders` | 410 | {"error":{"code":"deprecated_v1_order_endpoint","message":"Please switch to the V2 endpoints","details":"https://docs.kalshi.com/api-reference/orders/create-ord | 401 = route exists but needs auth; 404 = no such route |
| `POST /portfolio/events/orders` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} | 401 = route exists but needs auth; 404 = no such route |

## 9. Exchange status payload
```json
{"exchange_active":true,"exchange_index_statuses":[{"description":"Default","exchange_active":true,"exchange_index":0,"intra_exchange_transfers_active":true,"trading_active":true},{"description":"Demo shard 1","exchange_active":true,"exchange_index":1,"intra_exchange_transfers_active":true,"trading_active":true},{"description":"Demo shard 2","exchange_active":true,"exchange_index":2,"intra_exchange_transfers_active":true,"trading_active":true},{"description":"","exchange_active":true,"exchange_index":3,"intra_exchange_transfers_active":true,"trading_active":true}],"intra_exchange_transfers_active":true,"trading_active":true}```

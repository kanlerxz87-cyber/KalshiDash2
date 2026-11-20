# Verified facts (v2) — Kalshi DEMO API

| Field | Value |
| --- | --- |
| Captured (UTC) | 2026-11-20T11:08:51Z |
| Runner | GitHub Actions `ubuntu-latest` |
| Base URL | `https://external-api.demo.kalshi.co/trade-api/v2` |
| Commit | `d28d98efbd79ecd049f83d63b52786187430720f` |

## A. Deprecated v1 order route — what the exchange says
```
HTTP/2 410 
cache-control: no-store
content-security-policy: default-src 'none';
content-type: application/json; charset=utf-8
strict-transport-security: max-age=31536000; includeSubDomains
vary: Accept-Language
x-content-type-options: nosniff
content-length: 168
date: Fri, 20 Nov 2026 11:08:51 GMT

{"error":{"code":"deprecated_v1_order_endpoint","message":"Please switch to the V2 endpoints","details":"https://docs.kalshi.com/api-reference/orders/create-order-v2"}}```

## B. Highest-volume open markets (top 8 by `volume_fp`)

Markets returned: 1000 | cursor present: true

| Ticker | Event | Series | Last | YES bid | YES ask | Vol (fp) | OI (fp) | Tick structure |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| KXDEMOFUTHOURLY-26NOV20H12-UP | KXDEMOFUTHOURLY-26NOV20H12 |  | 0.3500 | 0.0100 | 1.0000 | 1275.00 | 85.00 | linear_cent |
| KXMVECROSSCATEGORY-S2026CFP43AOUHSQHDJFU-ZQRXCJKOM | KXMVECROSSCATEGORY-S2026CFP43AOUHSQHDJFU |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S2026NNLX45WOSELGRE3G-5Z2QAAJNH | KXMVECROSSCATEGORY-S2026NNLX45WOSELGRE3G |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S2026CIJJKVHMK2FGCZWA-WGFLTLBRR | KXMVECROSSCATEGORY-S2026CIJJKVHMK2FGCZWA |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S2026UG3SLRQGC67OBH6K-QRROPTP3W | KXMVECROSSCATEGORY-S2026UG3SLRQGC67OBH6K |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S20266DG7P47B5LEXSR45-EHJOPWJL7 | KXMVECROSSCATEGORY-S20266DG7P47B5LEXSR45 |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S2026PHAHG45UVPLEX4XJ-MPO43QQJK | KXMVECROSSCATEGORY-S2026PHAHG45UVPLEX4XJ |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |
| KXMVECROSSCATEGORY-S20262KHAIC6T3ZJNCHMN-ESSQ43Q2L | KXMVECROSSCATEGORY-S20262KHAIC6T3ZJNCHMN |  | 0.4500 | 0.0000 | 1.0000 | 100.00 | 100.00 | center_deci_edge_centi_cent |

Price ranges of the top market (source of truth for valid order prices):

```json
[
 {
  "end": "1.0000",
  "start": "0.0000",
  "step": "0.0100"
 }
]
```

## C. Candlesticks for a market that actually has volume

Ticker `KXDEMOFUTHOURLY-26NOV20H12-UP` · series ``

## D. Settled markets — how resolution is reported

Settled markets returned: 200

| `result` value | Count |
| --- | --- |
| yes | 82 |
| no | 118 |

Markets carrying a non-blank result: 200 of 200

Sample rows (API fields copied verbatim, no inference):

| Ticker | Result | Status | Settlement value | Expiration value | Close time |
| --- | --- | --- | --- | --- | --- |
| KXDEMOFUTHOURLY-26NOV20H11-UP | yes | finalized | 1.0000 |  | 2026-11-20T11:00:00Z |
| KXQUICKSETTLE-20NOV26H0530-3 | no | finalized | 0.0000 | 2.0 | 2026-11-20T10:30:00Z |
| KXQUICKSETTLE-20NOV26H0530-2 | yes | finalized | 1.0000 | 2.0 | 2026-11-20T10:30:00Z |
| KXQUICKSETTLE-20NOV26H0520-3 | no | finalized | 0.0000 | 2.0 | 2026-11-20T10:20:00Z |
| KXQUICKSETTLE-20NOV26H0520-2 | yes | finalized | 1.0000 | 2.0 | 2026-11-20T10:20:00Z |
| KXQUICKSETTLE-20NOV26H0510-3 | no | finalized | 0.0000 | 2.0 | 2026-11-20T10:10:00Z |
| KXQUICKSETTLE-20NOV26H0510-2 | yes | finalized | 1.0000 | 2.0 | 2026-11-20T10:10:00Z |
| KXDEMOFUTHOURLY-26NOV20H10-UP | no | finalized | 0.0000 |  | 2026-11-20T10:00:00Z |

## E. Events with categories (taxonomy source of truth)
```json
{"cursor":"CgYI8Oj1nQ8SDUtYRUxPTk1BUlMtOTk","events":[{"category":"World","collateral_return_type":"","event_ticker":"KXELONMARS-99","exchange_index":0,"last_updated_ts":"2026-11-05T22:11:40.575144Z","mutually_exclusive":false,"series_ticker":"KXELONMARS","settlement_sources":[{"name":"The Guardian","url":"https://www.theguardian.com"},{"name":"local news outlets with verifiable mastheads in ","url":"https://kalshi.com/"},{"name":"official social media accounts of  or their official representatives","url":"https://kalshi.com/"},{"name":"official government sources of ","url":"https://kalshi.com/"},{"name":"official representatives or offices of ","url":"https://kalshi.com/"},{"name":"The New York Times","url":"https://www.nytimes.com"},{"name":"the Associated Press","url":"https://www.ap.org"},{"name":"Reuters","url":"https://www.reuters.com"},{"name":"Politico","url":"https://www.politi
```

## F. Rate-limit headers observed on a public call
```
x-kalshi-cache-hits: 1
```

# Verified facts (v3) — Kalshi DEMO API

| Field | Value |
| --- | --- |
| Captured (UTC) | 2026-11-20T11:10:43Z |
| Runner | GitHub Actions `ubuntu-latest` |
| Base URL | `https://external-api.demo.kalshi.co/trade-api/v2` |
| Commit | `b3e2c4e84afdd65763668fc8d3a1daa4e8a5d041` |

## A. CORS on every endpoint the dashboard calls

| Endpoint | HTTP | `access-control-allow-origin` |
| --- | --- | --- |
| `GET /exchange/status` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /events?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /series?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/KXDEMOFUTHOURLY-26NOV20H12-UP` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/KXDEMOFUTHOURLY-26NOV20H12-UP/orderbook` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/trades?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /events/KXDEMOFUTHOURLY-26NOV20H12` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /series/KXDEMOFUTHOURLY/markets/KXDEMOFUTHOURLY-26NOV20H12-UP/candlesticks?start_ts=1795086644&end_ts=1795173044&period_interval=60` | 200 | https://kanlerxz87-cyber.github.io |

**Resolved ids used above:** market `KXDEMOFUTHOURLY-26NOV20H12-UP` → event `KXDEMOFUTHOURLY-26NOV20H12` → series `KXDEMOFUTHOURLY`

## B. Market → event → series lookup path (needed for candlesticks)

Does `GET /markets/{ticker}` contain `series_ticker`?
```json
{
 "keys": [
  "can_close_early",
  "close_time",
  "created_time",
  "event_ticker",
  "exchange_index",
  "expiration_value",
  "last_price_dollars",
  "latest_expiration_time",
  "market_type",
  "no_ask_dollars",
  "no_bid_dollars",
  "no_sub_title",
  "notional_value_dollars",
  "open_interest_fp",
  "open_time",
  "previous_price_dollars",
  "previous_yes_ask_dollars",
  "previous_yes_bid_dollars",
  "price_level_structure",
  "price_ranges",
  "result",
  "rules_primary",
  "rules_secondary",
  "settlement_bounds_type",
  "settlement_timer_seconds",
  "status",
  "ticker",
  "title",
  "updated_time",
  "volume_24h_fp",
  "volume_fp",
  "yes_ask_dollars",
  "yes_ask_size_fp",
  "yes_bid_dollars",
  "yes_bid_size_fp",
  "yes_sub_title"
 ],
 "series_ticker": null,
 "event_ticker": "KXDEMOFUTHOURLY-26NOV20H12"
}
```

Does `GET /events/{event_ticker}` contain `series_ticker`?
```json
{
 "keys": [
  "category",
  "collateral_return_type",
  "event_ticker",
  "exchange_index",
  "last_updated_ts",
  "mutually_exclusive",
  "series_ticker",
  "settlement_sources",
  "strike_period",
  "sub_title",
  "title"
 ],
 "series_ticker": "KXDEMOFUTHOURLY",
 "category": "Test"
}
```

## C. Candlesticks — real response and documented limits

`period_interval=1` (minutes), last 24h:
```json
{"candlesticks":[{"end_period_ts":1795172460,"open_interest_fp":"50.00","price":{"close_dollars":"0.6500","high_dollars":"0.6500","low_dollars":"0.3500","mean_dollars":"0.5667","open_dollars":"0.6500"},"volume_fp":"120.00","yes_ask":{"close_dollars":"0.9900","high_dollars":"1.0000","low_dollars":"0.5500","open_dollars":"1.0000"},"yes_bid":{"close_dollars":"0.0100","high_dollars":"0.6500","low_dollars":"0.0000","open_dollars":"0.6500"}},{"end_period_ts":1795172520,"open_interest_fp":"30.00","price":{"close_dollars":"0.6500","high_dollars":"0.6500","low_dollars":"0.3500","mean_dollars":"0.5500",
```

`period_interval=60` (minutes), last 24h:
```json
{"candlesticks":[],"ticker":"KXDEMOFUTHOURLY-26NOV20H12-UP"}
```

`period_interval=1440` (minutes), last 24h:
```json
{"candlesticks":[],"ticker":"KXDEMOFUTHOURLY-26NOV20H12-UP"}
```

Unsupported `period_interval=5`:
```
HTTP 400
{"msg":"Parameter validation failed for GetMarketCandlesticks: Key: 'GetMarketCandlesticksParams.PeriodInterval' Error:Field validation for 'PeriodInterval' failed on the 'oneof' tag"}
```

## D. Orderbook — resting bid depth (liquidity)
```json
{"orderbook_fp":{"no_dollars":[],"yes_dollars":[["0.0100","10.00"]]}}
```

## E. Order write routes (unauthenticated: route existence only)

| Request | HTTP | Body |
| --- | --- | --- |
| `POST /portfolio/events/orders` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `DELETE /portfolio/events/orders/abc` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `POST /portfolio/events/orders/abc/amend` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `DELETE /portfolio/orders/abc` | 410 | {"error":{"code":"deprecated_v1_order_endpoint","message":"Please switch to the V2 endpoints","details":"https://docs.kalshi.com/api-reference/orders/ |

## F. Read endpoints used by the portfolio page (unauthenticated)

| Endpoint | HTTP | Body |
| --- | --- | --- |
| `GET /portfolio/balance` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `GET /portfolio/positions` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `GET /portfolio/fills` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |
| `GET /portfolio/orders` | 401 | {"error":{"code":"token_authentication_failure","message":"token authentication failure"}} |

## G. Topic taxonomy — official `category` values and their counts

Events scanned: 1000

| Kalshi category | Events |
| --- | --- |
| Elections | 740 |
| Sports | 71 |
| Economics | 61 |
| Politics | 42 |
| Entertainment | 28 |
| Science and Technology | 26 |
| Financials | 10 |
| Climate and Weather | 9 |
| Companies | 7 |
| World | 2 |
| Crypto | 2 |
| Social | 1 |
| Test | 1 |

### Which official categories can serve the five required topics?

- **gas**: 0 events — categories: none
- **elections**: 740 events — categories: Elections (740)
- **culture**: 30 events — categories: Entertainment (28), Social (1), Politics (1)
- **crypto**: 2 events — categories: Crypto (2)
- **golf**: 3 events — categories: Sports (3)

### Sample series per topic (from live event rows)
- **gas**: none
- **elections**: `KXNEXTNATOSECGEN`, `KXNEWPOPE`, `KXPERSONPRESMAM`, `KXPERSONPRESFUENTES`, `KXNEXTISRAELPM`, `KXNEXTUKPRIMEMIN`
- **culture**: `KXGTA7RELEASEDATE`, `KXPOPCHANGESTATE10`, `KXPERFORMBONDSONG`, `KXJOHNNYDEPP`, `KXACTORSONNYCROCKETT`, `KXSOCIALSECURITYDEPLETE`
- **crypto**: `KXBTCD`
- **golf**: `KXPGAFUTURE`, `KXGOLFMAJOR`

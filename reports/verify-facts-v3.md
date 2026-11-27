# Verified facts (v3) — Kalshi DEMO API

| Field | Value |
| --- | --- |
| Captured (UTC) | 2026-11-27T22:40:09Z |
| Runner | GitHub Actions `ubuntu-latest` |
| Base URL | `https://external-api.demo.kalshi.co/trade-api/v2` |
| Commit | `41ca9bbed8fdeb36fb962a32edd1516158bdf17c` |

## A. CORS on every endpoint the dashboard calls

| Endpoint | HTTP | `access-control-allow-origin` |
| --- | --- | --- |
| `GET /exchange/status` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /events?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /series?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E/orderbook` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /markets/trades?limit=1` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /events/KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO` | 200 | https://kanlerxz87-cyber.github.io |
| `GET /series/KXMVECROSSCATEGORY/markets/KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E/candlesticks?start_ts=1795732813&end_ts=1795819213&period_interval=60` | 200 | https://kanlerxz87-cyber.github.io |

**Resolved ids used above:** market `KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E` → event `KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO` → series `KXMVECROSSCATEGORY`

## B. Market → event → series lookup path (needed for candlesticks)

Does `GET /markets/{ticker}` contain `series_ticker`?
```json
{
 "keys": [
  "can_close_early",
  "close_time",
  "created_time",
  "custom_strike",
  "event_ticker",
  "exchange_index",
  "expected_expiration_time",
  "expiration_value",
  "last_price_dollars",
  "latest_expiration_time",
  "market_type",
  "mve_collection_ticker",
  "mve_selected_legs",
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
  "strike_type",
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
 "event_ticker": "KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO"
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
 "series_ticker": "KXMVECROSSCATEGORY",
 "category": "Exotics"
}
```

## C. Candlesticks — real response and documented limits

`period_interval=1` (minutes), last 24h:
```json
{"candlesticks":[{"end_period_ts":1795819200,"open_interest_fp":"100.00","price":{"close_dollars":"0.4500","high_dollars":"0.4500","low_dollars":"0.4500","mean_dollars":"0.4500","open_dollars":"0.4500"},"volume_fp":"100.00","yes_ask":{"close_dollars":"1.0000","high_dollars":"1.0000","low_dollars":"1.0000","open_dollars":"1.0000"},"yes_bid":{"close_dollars":"0.0000","high_dollars":"0.4500","low_dollars":"0.0000","open_dollars":"0.4500"}}],"ticker":"KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E"}
```

`period_interval=60` (minutes), last 24h:
```json
{"candlesticks":[],"ticker":"KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E"}
```

`period_interval=1440` (minutes), last 24h:
```json
{"candlesticks":[],"ticker":"KXMVECROSSCATEGORY-S202656P2EAUXL7XYQNNO-NYYNCJR7E"}
```

Unsupported `period_interval=5`:
```
HTTP 400
{"msg":"Parameter validation failed for GetMarketCandlesticks: Key: 'GetMarketCandlesticksParams.PeriodInterval' Error:Field validation for 'PeriodInterval' failed on the 'oneof' tag"}
```

## D. Orderbook — resting bid depth (liquidity)
```json
{"orderbook_fp":{"no_dollars":[],"yes_dollars":[["0.0100","1.00"]]}}
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
| Elections | 724 |
| Sports | 71 |
| Economics | 61 |
| Politics | 54 |
| Science and Technology | 31 |
| Entertainment | 27 |
| Financials | 10 |
| Climate and Weather | 9 |
| Companies | 7 |
| World | 2 |
| Crypto | 2 |
| Social | 1 |
| Test | 1 |

### Which official categories can serve the five required topics?

- **gas**: 0 events — categories: none
- **elections**: 724 events — categories: Elections (724)
- **culture**: 29 events — categories: Entertainment (27), Social (1), Politics (1)
- **crypto**: 2 events — categories: Crypto (2)
- **golf**: 3 events — categories: Sports (3)

### Sample series per topic (from live event rows)
- **gas**: none
- **elections**: `KXNEXTNATOSECGEN`, `KXNEWPOPE`, `KXPERSONPRESMAM`, `KXPERSONPRESFUENTES`, `KXNEXTISRAELPM`, `KXNEXTUKPRIMEMIN`
- **culture**: `KXGTA7RELEASEDATE`, `KXPOPCHANGESTATE10`, `KXPERFORMBONDSONG`, `KXJOHNNYDEPP`, `KXACTORSONNYCROCKETT`, `KXSOCIALSECURITYDEPLETE`
- **crypto**: `KXBTCD`
- **golf**: `KXPGAFUTURE`, `KXGOLFMAJOR`

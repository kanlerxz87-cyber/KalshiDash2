# VERIFICATION.md — evidence for every claim

Companion to `docs/verification.html`. Three kinds of row:

- **documented** — checked against a specific page of Kalshi's documentation.
- **observed** — checked against the JSON in `docs/data/`, which records the URL
  each value came from.
- **unverified** — could not be checked. Left blank and flagged. Never filled in.

Checked 2026-11-20. Nothing on this page is inferred.

## Documented

| Claim | Value | Official source | Result |
|---|---|---|---|
| Recommended demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) | verified |
| Also-supported demo REST host | `https://demo-api.kalshi.co/trade-api/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) | verified |
| Recommended demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) | verified |
| Demo uses mock funds, may not match production | Stated on the page | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) | verified |
| Public market data needs no key | Stated in the guide | [Market data quick-start](https://docs.kalshi.com/getting_started/quick_start_market_data) | verified |
| Market status filter values | `unopened`, `open`, `closed`, `settled` | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | verified |
| Order book returns bids only, ascending, best bid last | Stated in the guide | [Orderbook responses](https://docs.kalshi.com/getting_started/orderbook_responses) | verified |
| Candlestick period intervals | `1`, `60`, `1440` minutes | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) | verified |
| Current order endpoint | `POST /portfolio/events/orders`; legacy writes return `410 Gone` | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | verified |
| V2 order required fields | `ticker`, `side`, `count`, `price`, `time_in_force`, `self_trade_prevention_type` | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | verified |
| Auth header names | `KALSHI-ACCESS-KEY`, `-TIMESTAMP`, `-SIGNATURE` | [API keys](https://docs.kalshi.com/getting_started/api_keys) | verified |
| Pre-sign string | `timestamp + METHOD + path`, query string excluded | [API keys](https://docs.kalshi.com/getting_started/api_keys) | verified |
| RSA signature scheme | RSA-PSS, SHA-256, MGF1-SHA-256, salt = digest length | [API keys](https://docs.kalshi.com/getting_started/api_keys) | verified |
| Timestamp tolerance | 30 seconds, else `401 header_timestamp_expired` | [API keys](https://docs.kalshi.com/getting_started/api_keys) | verified |
| Direction semantics | `bid ≡ yes`, `ask ≡ no`; legacy `side`/`action` deprecated | [Order direction](https://docs.kalshi.com/getting_started/order_direction) | verified |
| Series list filters | `category`, `tags`, `include_volume` supported | [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) | verified |
| Browsers cannot sign Ed25519 via WebCrypto | No Ed25519 signing algorithm exposed | [SubtleCrypto.sign](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign) | verified |
| Demo and production credentials are separate | Stated on the page | [API environments](https://docs.kalshi.com/getting_started/api_environments) | verified |

## Observed in the snapshot

These are computed from `docs/data/*.json` each time the page loads. The numbers
move with the exchange, so no figure is repeated in this file — read them on
[the live verification page](https://kanlerxz87-cyber.github.io/KalshiDash2/verification.html)
or in the JSON.

| Claim | Where it is checked | Result |
|---|---|---|
| Demo exchange reports itself active | `data/exchange.json` → `status.exchange_active` | pass when `true` |
| Trading is enabled | `data/exchange.json` → `status.trading_active` | pass when `true` |
| More than one exchange shard exists | `data/exchange.json` → `status.exchange_index_statuses.length > 1` | pass when true |
| Series list is readable without a key | `data/series.json` → `count > 0` | pass when non-zero |
| Each topic returns open markets using the category/tag filter | `data/topic-<t>.json` → `market_count > 0` | pass per topic |
| Settled markets carry `result` | `data/resolutions.json` → rows with `result` of `yes`/`no` | pass when any |
| Order book returns yes/no bid arrays | `data/depth.json` → `yes_bid_levels` is an array | pass when any |
| 1-minute candles are available | `data/candles.json` → total `candlesticks` count > 0 | pass when any |

A **failed** observed check is a real result about the exchange or the
collector, not a rendering bug. The page shows it rather than hiding it.

## Unverified (left blank on purpose)

| Item | Why it cannot be verified here | Flag |
|---|---|---|
| Browser CORS support for the demo API | No CORS policy is published; untestable from the build sandbox. | F1 |
| Any specific account balance, position or P&L | Requires your own key, which must not exist in this repository. | F2 |
| Whether your key is RSA or Ed25519 | Only you can see the key file. | F3 |
| A gasoline / pump-price market exists | The taxonomy lookup returned crude oil, not gasoline. | F8 |
| Per-shard balance breakdown | Requires an authenticated read. | Q7 |
| Current production prices | Out of scope: this project targets demo only. | Q8 |

## Provenance chain

```
scripts/collect_kalshi.py
        │  each call logs {url, http status, timestamp}
        ▼
docs/data/meta.json          ← the complete request log for a run
docs/data/*.json             ← each file also stores its own source URL
        ▼
docs/assets/app.js (KD.*)    ← renders only what is in those files
        ▼
GitHub Pages                 ← gated by scripts/verify_site.py
```

To re-check a single value: open `docs/data/meta.json`, find the URL, request it
yourself, and compare. If the snapshot is stale, the page says so.

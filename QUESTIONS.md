# QUESTIONS.md — what we know, what we assume, what we don't

Companion to `docs/questions.html`. A decision should not be made from an unknown
that is dressed up as a fact. Every row separates the three.

| # | Question | What is known (with source) | What is assumed | What is unknown | Smallest experiment that settles it | Blocks a decision? |
|---|----------|----------------------------|-----------------|-----------------|-------------------------------------|--------------------|
| Q1 | Does the Kalshi demo REST API allow cross-origin browser requests? | Kalshi documents the API for server clients and publishes no CORS policy; every official example is server-side. [Market data quick-start](https://docs.kalshi.com/getting_started/quick_start_market_data) | The earlier build assumed **yes**, untested. | Whether `Access-Control-Allow-Origin` is returned for a browser origin. | `curl -I -H "Origin: https://kanlerxz87-cyber.github.io" https://external-api.demo.kalshi.co/trade-api/v2/exchange/status` and read the headers. | no — reads no longer depend on it |
| Q2 | RSA or Ed25519 key for the demo account? | Both are supported and signing differs; Ed25519 is the default for new keys. [API keys](https://docs.kalshi.com/getting_started/api_keys) | Nothing — the page rejects a non-RSA key with an explicit message. | Your key type. Browsers cannot sign Ed25519. | First line of the key file, or `openssl pkey -in key.pem -text -noout`. | **yes** — blocks all trading |
| Q3 | Is a 15-minute snapshot cadence right? | `settlement_ts` is recorded by the exchange, so a slower poll still captures the outcome. [Market settlement](https://docs.kalshi.com/getting_started/market_settlement) | 15 min balances freshness against Actions minutes. | How fast you need to know about a resolution. | Compare `settlement_ts` with the first snapshot containing it, over a week. | no |
| Q4 | How should "highest dollar amount" be defined? | The API exposes `open_interest_fp`, `volume_fp`, `volume_24h_fp`, `notional_value_dollars`. [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | Open interest × notional, then volume. Printed on the page. | Whether you prefer traded volume in dollars, or event-level rather than market-level. | Rank both ways and compare the top 10. | no |
| Q5 | Is `/portfolio/events/orders` the current order endpoint? | Yes; the legacy `/portfolio/orders` writes return `410 Gone`. [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) | — | — | Answered. | — |
| Q6 | Do demo markets settle so outcomes can be tracked? | The demo exchange reports active and returns settled markets with a result. [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) | — | — | Answered: the collector counts only `result == yes|no`. | — |
| Q7 | Do crypto and sports markets live on separate shards, and is the balance split? | Markets carry `exchange_index`; the demo status endpoint lists four shards; order routing auto-routes by ticker when `exchange_index` is omitted. [Exchange sharding](https://docs.kalshi.com/getting_started/exchange_sharding) | Omitting `exchange_index` is safe because auto-routing is documented. | Whether one balance figure hides per-shard balances. | Read `GET /portfolio/balance` and inspect `balance_breakdown`. | **yes** — blocks per-account P&L reporting |
| Q8 | Should this ever touch production or real money? | Demo and production credentials are not interchangeable; demo prices may not match production. [API environments](https://docs.kalshi.com/getting_started/api_environments) | No — every request targets the demo host. | Intent. | An explicit decision. Production keys must never be pasted into a publicly served page. | no, but must be recorded |
| Q9 | Can fees and net P&L be shown per trade? | Fills carry `fee_cost`; positions carry `fees_paid_dollars`. [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) | The journal does not store per-order fees, so analysis reports gross P&L. | — | Answered: yes from fills, not yet wired in (proposal S5). | no |
| Q10 | What should happen when the exchange is paused? | The status endpoint reports `exchange_active` and `trading_active`; orders accept `cancel_order_on_pause`. [Get Exchange Status](https://docs.kalshi.com/api-reference/exchange/get-exchange-status) | The dashboard only displays the state. | Whether resting orders should be cancelled automatically. | Decide policy, then set `cancel_order_on_pause: true`. | no |

## What information is missing from the project entirely

| Missing | Why it cannot be filled in here | How to obtain it |
|---|---|---|
| Real account history | No credentials exist in the repository, and none should. | Add a demo key in your own browser on the Portfolio page. |
| Any change-over-time metric | Needs at least two snapshots 15 minutes apart; the first cannot show a delta. | Let the collector run, then revisit the dashboard. |
| A gasoline/pump-price market | The exchange taxonomy has `Oil & Gas` (crude) but no gasoline bucket. | Confirm whether crude is an acceptable proxy (Q4), or drop the topic. |
| Sub-minute price history | The public REST API's finest interval is 1 minute. | Authenticated WebSocket `ticker` streaming, which needs an API key. |
| Per-shard balances | The schema supports it but the response shape has not been observed here. | Read `balance_breakdown` with a key (Q7). |
| Repository licence | None is declared, so reuse terms are undefined. | The repository owner must choose one. |

## Questions that are cheap but were not worth guessing

- Whether `market.title` will be removed, and when. It is deprecated but still
  returned; the site keeps a fallback (F9).
- Whether the WebSocket accepts anonymous connections in practice (F14). Not
  tested, because nothing here opens a socket.
- Whether GitHub Actions cron drift matters at 15-minute cadence. Observable in
  the run history rather than answerable in advance.

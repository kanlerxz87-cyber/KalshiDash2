# Executive summary — Kalshi demo dashboard

Live site: https://kanlerxz87-cyber.github.io/KalshiDash2/ (published by `.github/workflows/pages.yml`)

## What was built
- A static, read-only dashboard (`site/`) with a landing page, a live dashboard, one page per topic (gas prices, elections, culture, crypto, golf), analysis, portfolio status, a suggestions decision board, questions and information gaps, and a Flagged for Review page.
- A collector (`scripts/collect.mjs`) that reads only public, unauthenticated Kalshi Trade API GET endpoints for two environments: the recommended demo host and the production host (read-only). It runs hourly in GitHub Actions.
- A checker (`scripts/check-site.mjs`) that fails the build on broken links, invalid JSON, or data rows without a source link.

## Key facts (each with an official source)
1. **Demo is not a real market.** Kalshi: demo markets' "price and behavior … may not be reflective of those in real markets"; demo uses mock funds. https://docs.kalshi.com/getting_started/demo_env
2. **Demo liquidity is thin.** In the first 1,000 open demo markets read, 95 had any volume; the top row was a `KXDEMOFUTHOURLY` market. https://external-api.demo.kalshi.co/trade-api/v2/markets?status=open&limit=1000
3. **Volume is in contracts.** The market fields are `volume_fp`, `volume_24h_fp`, `open_interest_fp`. A dollar figure is only available by summing trades (`count_fp × yes_price_dollars`), which the site does for a capped sample and labels as partial. https://docs.kalshi.com/api-reference/market/get-markets · https://docs.kalshi.com/api-reference/market/get-trades
4. **Resolution.** A settled market carries `result` = `yes` / `no` (or `scalar`) and status `finalized`. A YES outcome pays $1 per YES contract; NO pays $1 per NO contract. https://docs.kalshi.com/getting_started/market_settlement
5. **Chart granularity.** REST candlesticks offer 1-minute, 1-hour and 1-day periods only. Seconds require the WebSocket feed. https://docs.kalshi.com/api-reference/market/get-market-candlesticks
6. **Liquidity.** Order books return bids only. The YES ask is implied as $1.00 minus the best NO bid. https://docs.kalshi.com/getting_started/orderbook_responses
7. **Trading and portfolio are blocked.** Those endpoints need an authenticated demo API key that was not provided. No orders have been placed.

## What we can and cannot conclude
- Descriptive only: spreads, zero-volume share, price buckets and yes/no results by topic (Analysis page).
- No trade performance, no strategy edge and no account P&L can be stated yet.

## Decisions needed (see Suggestions and Questions pages)
- Approve or reject S1–S9 (WebSocket second-level data, demo API key, full dollar-volume ranking, series allow-list, rules text, depth chart, production vs demo focus, trade journal, alerts).
- Provide or decline a demo API key (the single blocker for portfolio tracking).
- Confirm the topic definitions ("culture" maps to the official Entertainment category; gas prices are AAA gasoline series only).

## Flags
See `reports/repo-review.md` and the Flagged for Review page. Flagged items do not block the site.

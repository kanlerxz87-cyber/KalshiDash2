# Live WebSocket check — Kalshi demo

- Started: `2026-11-21T20:30:48.018653+00:00`
- Finished: `not finished`
- WebSocket endpoint: `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2`
- REST endpoint: `https://external-api.demo.kalshi.co/trade-api/v2`
- Ticker frames received: **0**
- Subscription confirmed: **no**
- Error: `no demo key available; the socket handshake was not verified`

## Checks

| # | Check | Result | Detail |
|---|-------|--------|--------|
| 1 | public market data is readable without a key | PASS | 8 open markets returned by GET /markets |
| 2 | unauthenticated handshake is refused | PASS | InvalidStatus: server rejected WebSocket connection: HTTP 401 |
| 3 | authenticated handshake and ticker payload | NOT VERIFIED | not run: no KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH in this run's environment. The Kalshi WebSocket requires signed handshake headers, so this part cannot be verified without a demo key. Everything else in this report was verified. |

## How to reproduce

```bash
pip install websockets cryptography requests
export KALSHI_KEY_ID=... KALSHI_PRIVATE_KEY_PATH=./key.pem
python3 tools/verify/live-ws-check.py
```

This check is read-only. It subscribes to the public `ticker` channel and never places an order.

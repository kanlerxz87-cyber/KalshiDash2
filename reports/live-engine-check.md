# Live engine check — Kalshi demo API

- Run at: 2026-11-27T17:49:17.247Z
- API: https://external-api.demo.kalshi.co/trade-api/v2
- Alert threshold: $0.10 · model pass mark: 55/100

## 1 · Alert engine

- Events scanned: 1200
- Markets in the five topics: 2757
- Swings of $0.10 or more detected: 0

_No swing met the threshold in this scan. The demo exchange is quiet at the time of writing._

- Markets with a readable previous price: 2769
- Largest single move against the exchange's previous price: +0.14 on `KXTVSEASONRELEASETHELASTOFUS-26-APR`

| Market | previous_price_dollars | last_price_dollars | Δ |
| --- | --- | --- | --- |
| `KXTVSEASONRELEASETHELASTOFUS-26-APR` | 0.70 | 0.84 | +0.14 |
| `KXNEXTNATOSECGEN-99-KIOH` | 0.02 | 0.02 | 0.00 |
| `KXNEXTNATOSECGEN-99-KKAL` | 0.15 | 0.15 | 0.00 |
| `KXNEXTNATOSECGEN-99-BWAL` | 0.11 | 0.11 | 0.00 |
| `KXNEXTNATOSECGEN-99-MFRE` | 0.50 | 0.50 | 0.00 |
| `KXNEXTNATOSECGEN-99-ULEY` | 0.01 | 0.01 | 0.00 |
| `KXNEXTNATOSECGEN-99-PPAV` | 0.15 | 0.15 | 0.00 |
| `KXNEXTNATOSECGEN-99-ASTU` | 0.13 | 0.13 | 0.00 |
| `KXNEXTNATOSECGEN-99-KSTA` | 0.23 | 0.23 | 0.00 |
| `KXNEWPOPE-70-PPIZ` | 0.10 | 0.10 | 0.00 |

## 2 · Strategy tester

- Finalized markets loaded: 12
- With a yes/no result and a settlement value: 12

- Markets with usable one-minute history: 0
- History requests that failed: 0
- Simulated trades produced: 0

_No strategy fired in this universe._

---

Simulated fills ignore fees, spread and slippage, so the P&L above is optimistic (flag F15).
A rule that produced no trades is reported as zero trades, not as a zero result.

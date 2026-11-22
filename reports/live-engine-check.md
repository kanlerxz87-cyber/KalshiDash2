# Live engine check — Kalshi demo API

- Run at: 2026-11-22T08:47:25.626Z
- API: https://external-api.demo.kalshi.co/trade-api/v2
- Alert threshold: $0.10 · model pass mark: 55/100

## 1 · Alert engine

- Events scanned: 1200
- Markets in the five topics: 2750
- Swings of $0.10 or more detected: 1

| Topic | Market | From | To | Δ | Basis | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| elections | `KXNEWPOPE-70-LANT` | 0.12 | 0.98 | +0.86 | exchange previous_price_dollars | 58/100 |

- Markets with a readable previous price: 2771
- Largest single move against the exchange's previous price: +0.86 on `KXNEWPOPE-70-LANT`

| Market | previous_price_dollars | last_price_dollars | Δ |
| --- | --- | --- | --- |
| `KXNEWPOPE-70-LANT` | 0.12 | 0.98 | +0.86 |
| `KXTVSEASONRELEASETHELASTOFUS-26-APR` | 0.70 | 0.84 | +0.14 |
| `KXNEXTNATOSECGEN-99-KIOH` | 0.02 | 0.02 | 0.00 |
| `KXNEXTNATOSECGEN-99-KKAL` | 0.15 | 0.15 | 0.00 |
| `KXNEXTNATOSECGEN-99-BWAL` | 0.11 | 0.11 | 0.00 |
| `KXNEXTNATOSECGEN-99-MFRE` | 0.50 | 0.50 | 0.00 |
| `KXNEXTNATOSECGEN-99-ULEY` | 0.01 | 0.01 | 0.00 |
| `KXNEXTNATOSECGEN-99-PPAV` | 0.15 | 0.15 | 0.00 |
| `KXNEXTNATOSECGEN-99-ASTU` | 0.13 | 0.13 | 0.00 |
| `KXNEXTNATOSECGEN-99-KSTA` | 0.23 | 0.23 | 0.00 |

## 2 · Strategy tester

- Finalized markets loaded: 12
- With a yes/no result and a settlement value: 12

- Markets with usable one-minute history: 8
- History requests that failed: 0
- Simulated trades produced: 4

| Strategy | Trades | Wins | Losses | Hit rate | Avg entry price | P&L / contract | ROI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Buy the dip | 1 | 1 | 0 | 100.0% | $0.30 | 0.70 | 233.3% |
| Momentum continuation | 1 | 1 | 0 | 100.0% | $0.99 | 0.01 | 1.0% |
| Fade the extreme | 1 | 0 | 1 | 0.0% | $0.01 | -0.01 | -100.0% |
| Round-trip scalper | 1 | 1 | 0 | 100.0% | $0.99 | 0.01 | 1.0% |

### First simulated trades

| Strategy | Market | Side | Entry | Exit | Result | P&L / contract |
| --- | --- | --- | --- | --- | --- | --- |
| Buy the dip | `KXQUICKSETTLE-22NOV26H0310-2` | yes | 0.30 | held to settlement | yes | 0.70 |
| Momentum continuation | `KXQUICKSETTLE-22NOV26H0250-2` | yes | 0.99 | held to settlement | yes | 0.01 |
| Fade the extreme | `KXQUICKSETTLE-22NOV26H0250-2` | no | 0.01 | held to settlement | yes | -0.01 |
| Round-trip scalper | `KXQUICKSETTLE-22NOV26H0250-2` | yes | 0.99 | held to settlement | yes | 0.01 |

---

Simulated fills ignore fees, spread and slippage, so the P&L above is optimistic (flag F15).
A rule that produced no trades is reported as zero trades, not as a zero result.

# Live engine check — Kalshi demo API

- Run at: 2026-11-21T23:34:35.016Z
- API: https://external-api.demo.kalshi.co/trade-api/v2
- Alert threshold: $0.10 · model pass mark: 55/100

## 1 · Alert engine

- Events scanned: 1200
- Markets in the five topics: 2760
- Swings of $0.10 or more detected: 1

| Topic | Market | From | To | Δ | Basis | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| elections | `KXNEWPOPE-70-LANT` | 0.18 | 0.98 | +0.80 | exchange previous_price_dollars | 61/100 |

- Markets with a readable previous price: 2781
- Largest single move against the exchange's previous price: +0.80 on `KXNEWPOPE-70-LANT`

| Market | previous_price_dollars | last_price_dollars | Δ |
| --- | --- | --- | --- |
| `KXNEWPOPE-70-LANT` | 0.18 | 0.98 | +0.80 |
| `KXTVSEASONRELEASETHELASTOFUS-26-APR` | 0.70 | 0.84 | +0.14 |
| `KXGTA6SONGS-30-MOB` | 0.54 | 0.63 | +0.09 |
| `KXPERFORMBONDSONG-35-ELT` | 0.91 | 0.89 | -0.02 |
| `KXNEXTNATOSECGEN-99-KIOH` | 0.02 | 0.02 | 0.00 |
| `KXNEXTNATOSECGEN-99-KKAL` | 0.15 | 0.15 | 0.00 |
| `KXNEXTNATOSECGEN-99-BWAL` | 0.11 | 0.11 | 0.00 |
| `KXNEXTNATOSECGEN-99-MFRE` | 0.50 | 0.50 | 0.00 |
| `KXNEXTNATOSECGEN-99-ULEY` | 0.01 | 0.01 | 0.00 |
| `KXNEXTNATOSECGEN-99-PPAV` | 0.15 | 0.15 | 0.00 |

## 2 · Strategy tester

- Finalized markets loaded: 12
- With a yes/no result and a settlement value: 12

- Markets with usable one-minute history: 10
- History requests that failed: 1
- Simulated trades produced: 0

_No strategy fired in this universe._

---

Simulated fills ignore fees, spread and slippage, so the P&L above is optimistic (flag F15).
A rule that produced no trades is reported as zero trades, not as a zero result.

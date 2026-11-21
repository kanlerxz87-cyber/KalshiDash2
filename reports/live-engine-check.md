# Live engine check — Kalshi demo API

- Run at: 2026-11-21T23:26:48.577Z
- API: https://external-api.demo.kalshi.co/trade-api/v2
- Alert threshold: $0.10 · model pass mark: 55/100

## 1 · Alert engine

- Events scanned: 1200
- Markets in the five topics: 2836
- Swings of $0.10 or more detected: 1

| Topic | Market | From | To | Δ | Basis | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| elections | `KXNEWPOPE-70-LANT` | 0.18 | 0.98 | +0.80 | exchange previous_price_dollars | 61/100 |

- Markets with a readable previous price: 2857
- Largest single move against the exchange's previous price: +0.80 on `KXNEWPOPE-70-LANT`

| Market | previous_price_dollars | last_price_dollars | Δ |
| --- | --- | --- | --- |
| `KXNEWPOPE-70-LANT` | 0.18 | 0.98 | +0.80 |
| `KXTVSEASONRELEASETHELASTOFUS-26-APR` | 0.70 | 0.84 | +0.14 |
| `KXGTA6SONGS-30-MOB` | 0.54 | 0.63 | +0.09 |
| `KXPERFORMBONDSONG-35-ELT` | 0.91 | 0.89 | -0.02 |
| `KXNEWPOPE-70-PPIZ` | 0.10 | 0.10 | 0.00 |
| `KXNEWPOPE-70-PPAR` | 0.54 | 0.54 | 0.00 |
| `KXNEWPOPE-70-FAMB` | 0.11 | 0.11 | 0.00 |
| `KXNEWPOPE-70-MZUP` | 0.10 | 0.10 | 0.00 |
| `KXNEWPOPE-70-PERD` | 0.38 | 0.38 | 0.00 |
| `KXNEWPOPE-70-AARB` | 0.10 | 0.10 | 0.00 |

## 2 · Strategy tester

- Finalized markets loaded: 12
- With a yes/no result and a settlement value: 12

- Markets with usable one-minute history: 11
- History requests that failed: 0
- Simulated trades produced: 3

| Strategy | Trades | Wins | Losses | Hit rate | Avg entry price | P&L / contract | ROI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Momentum continuation | 1 | 0 | 1 | 0.0% | $0.65 | -0.65 | -100.0% |
| Buy the dip | 1 | 0 | 1 | 0.0% | $0.35 | -0.35 | -100.0% |
| Round-trip scalper | 1 | 0 | 1 | 0.0% | $0.65 | -0.65 | -100.0% |

### First simulated trades

| Strategy | Market | Side | Entry | Exit | Result | P&L / contract |
| --- | --- | --- | --- | --- | --- | --- |
| Momentum continuation | `KXDEMOFUTHOURLY-26NOV21H23-UP` | yes | 0.65 | held to settlement | no | -0.65 |
| Buy the dip | `KXDEMOFUTHOURLY-26NOV21H23-UP` | yes | 0.35 | held to settlement | no | -0.35 |
| Round-trip scalper | `KXDEMOFUTHOURLY-26NOV21H23-UP` | yes | 0.65 | held to settlement | no | -0.65 |

---

Simulated fills ignore fees, spread and slippage, so the P&L above is optimistic (flag F15).
A rule that produced no trades is reported as zero trades, not as a zero result.

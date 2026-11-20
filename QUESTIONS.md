# Open Questions — KalshiDash2

See `docs/questions.html` for the full table. Summary:

| # | Question | How to find out |
|---|----------|-----------------|
| Q1 | Does the demo API allow browser CORS calls from GitHub Pages? | Open live dashboard; check DevTools headers; else add proxy (S2) |
| Q2 | RSA or Ed25519 demo key? | Create demo key at demo.kalshi.co, note type |
| Q3 | Is WebSocket streaming wanted (needs auth)? | Try polling first; approve S1 if latency matters |
| Q4 | Where to store history (proxy/scheduler)? | Decide hosting: GitHub Actions cron / own server / browser-only |
| Q5 | Risk limits (max per market/day)? | Set numbers before automated trading (S6) |
| Q6 | Are keyword topic matches accurate enough? | Review matched series on dashboard; refine (S7) |
| Q7 | How is realized P&L per strategy computed? | Join fills to settlements (S4); verify vs `/portfolio/positions` |
| Q8 | Should this ever touch production (real money)? | Explicit decision required; never put production keys on this site |

| Q9 | What does “highest dollar amount” mean for ranking? | API gives contracts (`*_fp`), not dollars; notional = one contract's settlement value ([source](https://docs.kalshi.com/getting_started/fixed_point_migration)) | Which definition you want | Pick one of the four dashboard rankings (est. dollar volume / volume / 24h volume / open interest) |

No decision should be made until its missing information is found.

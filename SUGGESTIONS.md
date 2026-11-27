# Suggestions for Better Decisions — KalshiDash2

**Synced 2026-11-27** with the canonical site register on [`suggestions.html`](suggestions.html) (**S1–S17**).
Items are ordered by decision priority: **data trust** before **analysis insight**, **operational hardening**, and
**presentation**.

Status breakdown on `suggestions.html` (**17 total**): **3** built · **2** partly built · **12** open (**6** recommended, **10** optional, **1** later).

## Priority register (S1–S17)

| ID | Area | Recommended | Status | Suggestion | Decision it improves | Missing before deciding |
|---|---|---|---|---|---|---|
| **S1** | Trust | yes | open | Prove one real order end to end | Can this dashboard be trusted to trade at all? | Demo API key pair (`Q8`, `F1`) |
| **S2** | Trust | yes | **built** | Keep a versioned evidence file for every captured API fact | Can a reviewer re-check a claim without trusting the site? | Nothing (`reports/` + `evidence/`) |
| **S3** | Insight | yes | partly (simulated P&L measured; account P&L needs fills) | Pair fills into round trips and compute realised P&L | Which strategy actually makes money? | Fills on the account (`Q9`) |
| **S4** | Insight | yes | open | Show implied probability next to every price | Is this contract cheap or expensive? | Official basis & price-to-probability method |
| **S5** | Trust | yes | partly (alerts & board show scan time) | Publish a data-freshness clock per panel | Am I looking at a price that has already moved? | Nothing |
| **S6** | Insight | optional | **built** | Rank by a definable "dollars traded" and let the reader switch definition | What does "highest dollar amount" mean for us? | Business metric choice (`Q1`) |
| **S7** | Insight | optional | open | Add an event-level exposure view across mutually-exclusive markets | Am I taking one bet or several correlated ones? | Positions data (`Q9`) |
| **S8** | Ops | yes | **built** | Name a single integration owner for shared outputs | Whose version of the site is the site? | Closed (`PR #88` + `COORDINATION.md`) |
| **S9** | Ops | optional | open | Confirm a browser-authenticated WebSocket before promising streaming | Is polling fast enough, or do we need a stream? | Browser handshake check (`Q10`) |
| **S10** | Ops | optional | open | Cache public reads to stay clear of rate limits | Will the dashboard keep working when many tabs are open? | Observed `429` budget (`Q11`) |
| **S11** | UX | optional | open | Add keyboard navigation and a compact table mode | Can someone scan 25 events quickly? | User feedback on table density |
| **S12** | UX | later | open | Add a bespoke colour theme and illustrations | Does the site feel like a product? | Nothing (competes with `S1`/`S3`) |
| **S13** | Insight | yes | open | Deliver alerts outside the browser tab | Do I have to watch this page to catch a move? | Notification vs webhook security choice |
| **S14** | Ops | optional | open | Rotate the event cursor instead of re-reading the first pages | Am I missing swings because of the scan bound (`F16`)? | Sustained public endpoint `429` behaviour (`Q11`) |
| **S15** | UX | optional | open | Give every alert a permalink and a filterable transcript | Can I send a colleague the exact move I saw, with its evidence? | URL scheme & transcript text filter |
| **S16** | UX | optional | open | Per-topic mute and a sound cue for the shortlist chat | Can I follow one topic without noise from the other four? | User preference on active topics |
| **S17** | Insight | optional | open | Rank live boards by the exchange's own whole-dollar notional | Can I sort by whole-dollar notional instead of the volume × price proxy? | Live capture verifying WS `dollar_volume` sign convention (requires relay `scripts/relay.py`) |

See [`questions.html`](questions.html) (`QUESTIONS.md`) for how each missing piece can be obtained.

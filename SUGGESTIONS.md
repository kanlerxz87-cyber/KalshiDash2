# Suggestions — KalshiDash2

The canonical, interactive decision board is **`suggestions.html`** (published at
<https://kanlerxz87-cyber.github.io/KalshiDash2/suggestions.html>). This file is a
plain-text mirror of it so the same list can be read without a browser.

> **Reconciled 2026-11-20 (session `0c7b1b15`).** The previous version of this file
> carried a second, unrelated S1–S8 numbering that did not match `suggestions.html`.
> The two lists have been reconciled: the IDs below are the IDs used by the page.
> The earlier list is preserved in the git history of this file.

**Recommendation key:** `yes` = do it, `maybe` = worth doing, `no` = not recommended.
**Status:** `open` = not yet built, `built` = implemented in the site,
`partly` = implemented for part of the scope, with the remainder still open.

Nothing here is implemented without the maintainer's approval of the decision gate —
except where the status says `built`, which means the underlying brief asked for it.

| # | Suggestion | Rec | Status | Decision gate |
|---|------------|-----|--------|---------------|
| S1 | Prove one real order end to end | yes | open | Supply demo credentials — Q1/F1 |
| S2 | Keep a versioned evidence file for every captured API fact | yes | built | — done: `reports/` and `evidence/` |
| S3 | Pair fills into round trips and compute realised P&L | yes | partly | Real-account P&L still needs fills; simulated P&L is measured |
| S4 | Show implied probability next to every price | yes | open | — |
| S5 | Publish a data-freshness clock per panel | yes | partly | The alert feed and the board show their last scan time |
| S6 | Rank by a definable "dollars traded" and let the reader switch definition | maybe | built | — done: three ranking modes, each with its formula |
| S7 | Add an event-level exposure view across mutually-exclusive markets | maybe | open | — |
| S8 | Name a single integration owner for shared outputs | yes | open | — answered by the final integration session (Q14) |
| S9 | Confirm a browser-authenticated WebSocket before promising streaming | maybe | open | Q10 — F10 |
| S10 | Cache public reads to stay clear of rate limits | maybe | open | Q11 — F3 |
| S11 | Add keyboard navigation and a compact table mode | maybe | open | — |
| S12 | Add a bespoke colour theme and illustrations | no | open | — |
| S13 | Deliver alerts outside the browser tab | yes | open | Q4/F1 — hosting choice |
| S14 | Rotate the event cursor instead of re-reading the first pages | maybe | open | — |
| S15 | Give every alert a permalink and a filterable transcript | maybe | open | — |
| S16 | Per-topic mute and a sound cue for the shortlist chat | maybe | open | — |

## Implemented from the brief rather than from this list

These were requested directly in the brief and were built without a separate
suggestion round:

| Item | Where | Note |
|---|---|---|
| Two scrolling chats (all swings / high-ROI shortlist) | `alerts.html` | — |
| `$0.10` swing detection in both directions | `assets/js/alerts-core.js` | — |
| A chance baseline so a strategy's edge can be distinguished from luck | `simulator.html` | "Random entry" row in the scoreboard |
| Trade categorisation by direction and by topic | `simulator.html` | rollup tables |
| CSV export of the simulated ledger and the live paper book | `simulator.html` | — |
| Trade-type categorisation of real fills | `strategies.html` | needs the account's fills — F2 |

## Still open on the earlier list

The previous version of this file listed these under different IDs. They are mapped
onto the canonical list above so nothing is dropped:

| Earlier item | Now | Note |
|---|---|---|
| S1 WebSocket live ticks instead of polling | S9 | — |
| S2 Server proxy + scheduled snapshots to a data file | S13 | — |
| S3 Ed25519 key support in-browser | — | Already supported: `scripts/kalshi_client.py` handles RSA and Ed25519. A browser-side Ed25519 signer is still open (Q2). |
| S4 Outcome-joined realised P&L per strategy | S3 | — |
| S5 Alerts (price moves, new high-dollar events, resolutions) | S1/S5/S13 | Price-move alerts are built; the rest is open. |
| S6 Risk limits + kill switch | — | Not carried forward; depends on live order execution (S1). |
| S7 Topic taxonomy from `/series` categories vs keywords | — | Done: `assets/js/config.js` `TOPICS`; the classification cases are recorded under Flagged F8. |
| S8 CSV export of fills/positions/outcomes | S3 | Partly done: simulated ledger and paper book export to CSV; the real-fill export still needs the account's fills. |

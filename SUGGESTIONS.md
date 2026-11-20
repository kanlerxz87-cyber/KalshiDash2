# SUGGESTIONS.md — proposals with decision gates

Companion to `docs/suggestions.html`, where each proposal can be approved,
rejected or deferred. **Nothing here has been implemented.** A choice recorded on
the site is a note to self, not an authorisation to build.

Scoring: *decision effect* and *effort* are 1–5, where 5 is highest. The
effect-per-effort ratio is a judgement, labelled as such — it is not an API value.

| # | Proposal | Evidence | Effort | Risk | Effect | Gate before any work |
|---|----------|----------|--------|------|--------|----------------------|
| S1 | **Treat the collector as the product.** Serve every read from the committed snapshot; treat the browser as a renderer. | F1 (no documented CORS) | 1 (done) | 1 | 5 | None. Running on a 15-minute schedule. Decide only the cadence. |
| S2 | **Deploy Pages from the Actions artifact.** | F7 (site served the README) | 1 | 1 | 5 | None. Applied in this session; confirm the URL after merge. |
| S3 | **Extend the stored candle window to 30 days.** | F12 (24 h/7 d windows are shorter than labelled) | 2 | 3 | 4 | Approve the storage budget. 1-minute candles for 5 markets × 30 d ≈ 216k points. Consider 5-minute candles instead. |
| S4 | **Decide the key format: RSA-only or add Ed25519.** | F3 (browsers cannot sign Ed25519) | 3 | 3 | 4 | Choose: (a) document "create an RSA key", or (b) add a vetted Ed25519 library and review it. |
| S5 | **Store the per-order fee.** | F13 (analysis P&L is gross) | 2 | 1 | 4 | Approve one extra authenticated `GET /portfolio/fills` per order. |
| S6 | **Persist the journal outside one browser.** | Analysis is tied to one browser profile | 4 | 4 | 3 | Decide whether *any* secret may exist in CI. If not, keep the CSV export as the audit trail. |
| S7 | **Alert on resolution.** | The goal is tracking to resolution, which currently needs a visit | 2 | 1 | 3 | Approve GitHub Issues as the channel. A workflow can diff consecutive snapshots. |
| S8 | **Publish the snapshot schema.** | `docs/data/*.json` is already public and static | 2 | 1 | 2 | Approve a schema and a stability promise. |
| S9 | **Event-level scoreboard.** | A multi-outcome event over-weights market-level rankings | 2 | 1 | 3 | Approve the aggregation rule (sum of open interest × notional per `event_ticker`). |
| S10 | **Audit deprecated fields every snapshot.** | F9, F10 (`title`, `side`, `action` deprecated) | 1 | 1 | 3 | None. Fallbacks exist; add a check that warns when a field disappears. |

## Suggested order

1. **S1, S2** — already done; they remove the two failure modes that made the
   previous build unusable.
2. **S3** — the only proposal that makes an existing chart honest rather than
   short.
3. **S4** — gates every trading feature. Nothing else in the trading path matters
   until the key format is decided.
4. **S5, S10** — cheap accuracy wins on numbers already displayed.
5. **S7, S9** — the tracking features that match the stated goal.
6. **S6, S8** — only after the above, and only if a secret store is acceptable.

## What is deliberately *not* proposed

| Not proposed | Why |
|---|---|
| Server-side key storage for automated trading | It would put a credential in CI on a public repository. |
| Any prediction, forecast or expected-value model | The site reports what the API returned; a forecast would need a labelled model and its own verification. |
| Copying production prices into the demo pages | Demo and production are separate environments with separate credentials. |
| Scraping kalshi.com for numbers | The API is the documented source; a scrape has no contract and no provenance. |
| Auto-scaling the collector frequency to seconds | Unauthenticated rate limits are unpublished; a 2-second poll risks a block and buys little for event tracking. |

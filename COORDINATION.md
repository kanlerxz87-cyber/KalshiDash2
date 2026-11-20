

**Update 2026-11-20 ~20:40 UTC — rebase onto `main` @ `b783477` (PR #41 merged mid-session).**

Three collisions were found and resolved by keeping `main`'s already-merged work, per the board's canonical rule:

| Collision | `main`'s version (canonical) | This session's duplicate | Resolution |
|-----------|------------------------------|--------------------------|------------|
| Flag IDs | session `75932362`/`751ee13f` had already published `X1`–`X4` | this session's 11 items were also numbered `X1`–`X11` | renumbered this session's to **`Y1`–`Y11`**; no id reused, both registers intact (commit `765d8ef`) |
| Simulated-trade analysis | `replayRandomControl`, `aggregateBreakdowns`, `tradesToCsv` (+ `tests/simulator-core.test.mjs`) | `randomEntry`, `rollup`, `ledgerToCsv` (+ `tests/simulator-analysis.test.mjs`) | dropped this session's duplicates; `main`'s are richer (rollups by topic **and** direction; CSV carries per-trade official source URLs and formula-injection escaping) (commit `e34b64f`) |
| Executive-summary matrix | `main` derives counts from DOM (`.irregularity` cards) and added an "official basis / evidence" column | this session had hard-coded counts and a 3-column matrix | kept `main`'s derivation; contributed only the two new requirement rows (CSV export, chance baseline) |

Kept from this session because no one else had them: the `resolved.html` multivariate/combo settlement fix, `portfolio.html`
fee-display fix, `taxonomy.test.mjs` + multivariate scanning, `flagged.html` items `Y1`–`Y11`, and the 11 new `claims.js`
entries. The conflict log entry required by the standing rule is the table above.

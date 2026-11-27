/* KalshiDash2 — the live-engine report must not contradict itself.
 *
 * Why this exists
 * ---------------
 * `tools/verify/live-engine-check.mjs` runs on a GitHub runner against the real
 * demo exchange and commits `reports/live-engine-check.md`. On 2026-11-27 it
 * published, in the same section:
 *
 *   - Swings of $0.10 or more detected: 0
 *   - Largest single move against the exchange's previous price: +0.14 on `KXTVSEASONRELEASETHELASTOFUS-26-APR`
 *
 * Both lines were produced by correct code paths measuring **different
 * populations**: the swing count came from `AlertEngine`, which scans only
 * markets whose `status` is `active` or `open`, while the "largest move"
 * diagnostic was built from a bare loop over every market with a readable
 * `previous_price_dollars`. The +0.14 market was one the engine had
 * deliberately skipped, so the report claimed "no swing met the threshold"
 * directly above evidence of a $0.14 move.
 *
 * A reader cannot tell that from the page, and neither line is wrong on its
 * own — the pair is wrong. That is the defect this guard pins.
 *
 * What this asserts
 * -----------------
 *  1. The diagnostic is scoped to the same statuses the engine scans, read from
 *     one named constant rather than re-typed.
 *  2. The diagnostic no longer walks `engine.lastEvents` unconditionally: a
 *     market skipped by status is reported separately, with a count, so the
 *     exclusion is visible instead of silent.
 *  3. The status filter is applied **before** the market enters the diagnostic
 *     list, so a filtered market can never be the "largest move".
 *  4. A behavioural proof on the pure half: a market outside `active`/`open`
 *     with a $0.14 move produces no swing from `AlertEngine`, which is exactly
 *     why the report must not count it.
 *
 * This guard reads the shipped script as text — it cannot execute it, because
 * the script requires the live demo API, which the test environment does not
 * have. That is the same trade-off `tests/page-identifiers.test.mjs` makes, and
 * the same failure mode: one clear line in test output.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const script = readFileSync(join(root, "tools/verify/live-engine-check.mjs"), "utf8");

test("the report scopes its move diagnostic to the statuses the engine scans", () => {
  assert.match(
    script,
    /const ENGINE_STATUSES = \["active", "open"\];/,
    "the scanned statuses must be one named constant, not re-typed at each use"
  );
  assert.match(
    script,
    /if \(!ENGINE_STATUSES\.includes\(m\.status\)\) \{ skippedByStatus\.push\(m\.ticker\); continue; \}/,
    "a market outside the scanned statuses must be filtered out of the diagnostic " +
      "before it can become the 'largest move'"
  );
  assert.match(
    script,
    /Markets with a readable previous price \(status \$\{ENGINE_STATUSES\.join\(" or "\)\}\)/,
    "the count's own label must state the population it was measured over"
  );
});

test("a market excluded by status is counted and disclosed, never silently dropped", () => {
  assert.match(script, /const skippedByStatus = \[\];/, "exclusions are collected");
  assert.match(
    script,
    /if \(skippedByStatus\.length\) \{\s*\n\s*log\(`- Excluded from that count:/,
    "the excluded markets are reported with a count when there are any"
  );
});

test("a market outside active/open produces no swing, which is why the report must not count it", async () => {
  const { AlertEngine } = await import("../assets/js/alert-engine.js");
  /* The same shape the live run saw: a +0.14 move against the exchange's own
   * previous price, on a market whose status the engine does not scan. */
  const mk = (ticker, status) => ({
    ticker, event_ticker: "E", status,
    last_price_dollars: "0.84", previous_price_dollars: "0.70"
  });
  let markets = [mk("KXTV-OPEN", "initialized"), mk("KXTV-FINAL", "finalized")];
  globalThis.fetch = async (u) => {
    const body = String(u).includes("/events")
      ? {
          events: [{
            event_ticker: "E",
            series_ticker: "KXTVSEASONRELEASETHELASTOFUS",
            title: "TV season release",
            category: "Entertainment",
            markets
          }],
          cursor: ""
        }
      : { series: [] };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };

  const swings = [];
  const engine = new AlertEngine({ pollMs: 600000, onMessage: s => swings.push(s) });
  await engine.poll();
  assert.equal(engine.markets, 0, "no market outside active/open is scanned");
  assert.deepEqual(swings, [], "so no swing is reported for it");

  /* The control: the identical move on an `active` market DOES report. This is
   * the half that proves the guard is testing the status gate and not a broken
   * stub. */
  markets = [mk("KXTV-OPEN", "active"), mk("KXTV-FINAL", "finalized")];
  const swings2 = [];
  const engine2 = new AlertEngine({ pollMs: 600000, onMessage: s => swings2.push(s) });
  await engine2.poll();
  assert.equal(swings2.length, 1, "the same move on an active market is reported");
  assert.equal(swings2[0].ticker, "KXTV-OPEN");
  assert.equal(swings2[0].basis, "exchange previous_price_dollars");
});

/* KalshiDash2 — the AlertEngine must report every real swing, and only real swings.
 *
 * Why this exists
 * ---------------
 * `AlertEngine` is the reusable half of the alerting system. `alerts.html` has
 * its own move detector (`detectMoves` in `assets/js/alerts-core.js`), but the
 * Strategy Tester's *live paper trader* (`simulator.html`) drives an
 * `AlertEngine` directly, and so does `tools/verify/live-engine-check.mjs`.
 *
 * The engine de-duplicated on `${ticker}|${from}|${to}` — with no time in the
 * key. A market that trades 0.40 → 0.55 → 0.40 → 0.55 has produced four
 * genuine moves of $0.15, but the third and fourth were discarded as
 * "duplicates" of the first two, for the rest of the page's life. On the paper
 * trader that silently loses exactly the kind of round trip a strategy is meant
 * to be tested on.
 *
 * What this asserts
 * -----------------
 *  1. A retracement is reported: A→B, B→A, A→B, B→A yields four swings.
 *  2. One poll never yields the same swing twice (the exchange serves one
 *     reference price per market per response), so the fix does not turn the
 *     feed into a flood.
 *  3. The two documented comparisons are independent: an exchange
 *     `previous_price_dollars` swing and a poll-to-poll swing over the same
 *     (from, to) pair are two different measurements and both are reported.
 *  4. The daily reference does not re-fire on every poll, because
 *     `previous_price_dollars` only moves when the day rolls.
 *
 * Everything here is driven through the real module with a stubbed `fetch`; no
 * Kalshi fact is asserted, and no network call is made.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { AlertEngine } from "../assets/js/alert-engine.js";

/* A tiny stand-in for the two reads a scan performs. `latest` is read on every
 * call, so a test can move the price between polls exactly as the engine would
 * see it on the REST endpoint. */
function harness({ latest }) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    const m = {
      ticker: "KXGAS-TEST",
      event_ticker: "KXGAS-EV",
      status: "active",
      last_price_dollars: latest.last === null ? null : latest.last.toFixed(4),
      previous_price_dollars: latest.prev === null ? null : latest.prev.toFixed(4)
    };
    const body = u.includes("/events")
      ? {
          events: [{
            event_ticker: "KXGAS-EV",
            series_ticker: "KXGAS",
            title: "Gas harness event",
            category: "Economics",
            markets: [m]
          }],
          cursor: ""
        }
      : { series: [] };
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  };
  const messages = [];
  const engine = new AlertEngine({ pollMs: 60000, onMessage: s => messages.push(s) });
  return { engine, messages, calls, latest };
}

test("a retracement is a new swing, not a duplicate", async () => {
  const latest = { last: 0.40, prev: null };
  const { engine, messages } = harness({ latest });

  await engine.poll();                 // baseline, nothing to compare with
  latest.last = 0.55; await engine.poll();   // +0.15
  latest.last = 0.40; await engine.poll();   // −0.15
  latest.last = 0.55; await engine.poll();   // +0.15 again — a real second move
  latest.last = 0.40; await engine.poll();   // −0.15 again

  assert.equal(messages.length, 4,
    `four real moves must produce four alerts (got ${messages.length}: ` +
    messages.map(m => `${m.from}→${m.to}`).join(", ") + ")");
  assert.deepEqual(messages.map(m => [m.from, m.to]),
    [[0.40, 0.55], [0.55, 0.40], [0.40, 0.55], [0.55, 0.40]],
    "every move keeps its own direction and prices");
  assert.ok(messages.every(m => m.basis === "observed between polls"),
    "each of these is a poll-to-poll move");
});

test("one scan never reports the same pair twice", async () => {
  const latest = { last: 0.40, prev: null };
  const { engine, messages } = harness({ latest });

  await engine.poll();
  latest.last = 0.55;
  await engine.poll();
  /* Poll again with an unchanged price: the previous tick is now 0.55, so the
   * delta is zero and nothing may be produced — but even if the pair repeated,
   * poll-to-poll keys are per-scan now, and the scan is new. This asserts the
   * observable outcome: no alert. */
  await engine.poll();

  assert.equal(messages.length, 1, "an unchanged price produces no second alert");
});

test("the two documented comparisons are independent measurements", async () => {
  /* previous_price_dollars is the exchange's own reference (the schema
   * describes it as the last traded YES price a day ago). A market can be
   * +0.15 against that reference AND +0.15 against our previous poll at the
   * same time; both are reported, and their basis says which is which. */
  const latest = { last: 0.40, prev: 0.40 };
  const { engine, messages } = harness({ latest });

  await engine.poll();                       // poll 1: baseline 0.40, ref 0.40
  latest.last = 0.55; latest.prev = 0.40;    // poll 2: +0.15 on both comparisons
  await engine.poll();

  const bases = messages.map(m => m.basis).sort();
  assert.deepEqual(bases,
    ["exchange previous_price_dollars", "observed between polls"],
    `both comparisons must report (got: ${JSON.stringify(bases)})`);
});

test("the daily reference does not re-fire on every poll", async () => {
  const latest = { last: 0.55, prev: 0.40 };
  const { engine, messages } = harness({ latest });

  await engine.poll();
  const afterFirst = messages.length;
  assert.ok(afterFirst >= 1, "the reference swing is reported on the first scan");
  assert.ok(messages.some(m => m.basis === "exchange previous_price_dollars"));

  /* Five more scans with the identical reference pair: the day has not rolled,
   * so it must not be re-reported. */
  for (let i = 0; i < 5; i++) await engine.poll();
  const refs = messages.filter(m => m.basis === "exchange previous_price_dollars");
  assert.equal(refs.length, 1,
    `an unchanged daily reference must report once, not once per poll (got ${refs.length})`);

  /* When the day rolls and the reference value moves, the new reference pair is
   * a new measurement and is reported. */
  latest.prev = 0.10;                        // 0.55 vs 0.10 = +0.45
  await engine.poll();
  const refsAfterRoll = messages.filter(m => m.basis === "exchange previous_price_dollars");
  assert.equal(refsAfterRoll.length, 2, "a changed reference is reported");
});

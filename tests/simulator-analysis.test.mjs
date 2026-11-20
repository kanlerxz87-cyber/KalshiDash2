// Unit tests for the simulator's cross-cutting analysis: the random control,
// the topic/side rollups and the CSV export.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomEntry, rollup, ledgerToCsv, LEDGER_CSV_COLUMNS } from "../assets/js/simulator.js";

const market = (over = {}) => ({
  ticker: "T-1", event_ticker: "EV-1", event_title: "EV", topic: "crypto",
  result: "yes", settlement_value_dollars: "1.0000", series_ticker: "S",
  settlement_ts: "2026-11-20T18:00:00Z", category: "Crypto", ...over
});
const series = [{ t: 1000, close: 0.40, prevClose: 0.40, volume: 5 }];

test("random control is deterministic for the same ticker and seed", () => {
  const a = randomEntry(market(), series, { seed: 7 });
  const b = randomEntry(market(), series, { seed: 7 });
  assert.deepEqual(a, b);
  assert.equal(a.strategyKey, "control-random");
});

test("control payout follows the documented $1/0 settlement rule", () => {
  const yes = randomEntry(market(), series, { seed: 1, side: "yes" });
  assert.equal(yes.side, "yes");
  assert.equal(yes.payout, 1);
  assert.equal(Number((yes.pnlPerContract - (1 - 0.40)).toFixed(6)), 0);

  const no = randomEntry(market(), series, { seed: 1, side: "no" });
  assert.equal(no.side, "no");
  assert.equal(no.entryPrice, Number((1 - 0.40).toFixed(6)));
  assert.equal(no.payout, 0);            // market resolved yes, we bought no
  assert.ok(no.pnlPerContract < 0);
});

test("control is skipped when a market has no priced candle", () => {
  assert.equal(randomEntry(market(), [], { seed: 1 }), null);
  assert.equal(randomEntry(market(), [{ t: 1, close: null }], { seed: 1 }), null);
});

test("rollup groups by field and never counts an unscored trade as a win", () => {
  const trades = [
    { topic: "crypto", side: "yes", pnlPerContract: 0.2, capitalPerContract: 0.4 },
    { topic: "crypto", side: "no", pnlPerContract: -0.1, capitalPerContract: 0.6 },
    { topic: "golf", side: "yes", pnlPerContract: null, capitalPerContract: 0.5 }
  ];
  const byTopic = rollup(trades, "topic");
  const crypto = byTopic.find(r => r.key === "crypto");
  assert.equal(crypto.n, 2);
  assert.equal(crypto.scored, 2);
  assert.equal(crypto.winRate, 0.5);
  assert.equal(Number(crypto.pnl.toFixed(4)), 0.1);
  const golf = byTopic.find(r => r.key === "golf");
  assert.equal(golf.scored, 0);
  assert.equal(golf.winRate, null);      // n/a, not 0%
  assert.equal(golf.roi, null);
});

test("rollup labels an absent category rather than inventing one", () => {
  const r = rollup([{ topic: null, pnlPerContract: 0.1, capitalPerContract: 0.5 }], "topic");
  assert.equal(r[0].key, "(none)");
});

test("CSV has the documented header and writes a missing value as an empty cell", () => {
  const csv = ledgerToCsv([
    { strategyName: "Dip, buy", ticker: "T-1", eventTicker: "EV-1", topic: "crypto", side: "yes",
      entryPrice: 0.4, entryTs: 0, exitReason: "held to settlement", exitPrice: null, payout: 1,
      pnlPerContract: 0.6, capitalPerContract: 0.4, result: "yes", settlementValue: 1,
      category: "Crypto", seriesTicker: "S" }
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], LEDGER_CSV_COLUMNS.join(","));
  // Minimal RFC4180 parse so a quoted comma cannot shift the columns.
  const parse = line => {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cells = parse(lines[1]);
  // A quoted strategy name containing a comma must not shift the columns.
  assert.equal(cells[0], "Dip, buy");
  assert.equal(cells[8], "", "null exit price must be an empty cell, not 0");
  assert.equal(cells[6], "1970-01-01T00:00:00.000Z");
  assert.equal(cells.length, LEDGER_CSV_COLUMNS.length);
});

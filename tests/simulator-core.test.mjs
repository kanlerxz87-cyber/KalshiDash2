/* Unit tests for the simulated-trade engine: the chance baseline, the
 * trade-type rollups, and the CSV export.
 *
 * No network: every fixture here is a synthetic price series. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  replayStrategy, replayAll, aggregate, rollup,
  baselineIndex, hashString, tradesToCsv, paperToCsv, toSeries,
  fillFee, sideFee
} from "../assets/js/simulator.js";
import { STRATEGIES } from "../assets/js/config.js";

/* A synthetic one-minute series: close rises, then falls, then rises again. */
function makeSeries(n = 30) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const y = 0.40 + 0.002 * i - 0.004 * Math.max(0, i - 12);
    points.push({ t: 1700000000 + i * 60, y, volume: 100 + i });
  }
  return toSeries(points);
}

const MARKET = {
  ticker: "KXT-1",
  event_ticker: "KXT-1-E",
  event_title: "Test event",
  topic: "crypto",
  category: "Crypto",
  series_ticker: "KXT",
  result: "yes",
  settlement_value_dollars: "1.0000",
  settlement_ts: "2026-01-01T00:00:00Z"
};

const RANDOM = STRATEGIES.find(s => s.key === "random");
const FLAT = STRATEGIES.find(s => s.key === "flat");

test("hashString is stable and baselineIndex stays inside the series", () => {
  assert.equal(hashString("KXT-1"), hashString("KXT-1"));
  assert.notEqual(hashString("KXT-1"), hashString("KXT-2"));
  for (const ticker of ["A", "KXT-1", "KXT-9999999", ""]) {
    const idx = baselineIndex(ticker, 30);
    assert.ok(idx >= 0 && idx < 30, `index ${idx} in range`);
  }
});

test("the chance baseline enters exactly once and is reproducible", () => {
  const series = makeSeries();
  const a = replayStrategy(RANDOM, series, MARKET);
  const b = replayStrategy(RANDOM, series, MARKET);
  assert.ok(a, "the baseline always fires");
  assert.equal(a.entryPrice, b.entryPrice, "same entry price on a re-run");
  assert.equal(a.entryTs, b.entryTs, "same entry time on a re-run");
  assert.equal(a.side, "yes");
  assert.equal(a.strategyKey, "random");
  assert.ok(a.entryTs >= series[0].t && a.entryTs <= series[series.length - 1].t,
    "entry time comes from the scored window");
});

test("the never-trade control produces no trade and no P&L", () => {
  const trades = replayAll(STRATEGIES, makeSeries(), MARKET);
  const control = trades.filter(t => t.strategyKey === "flat");
  assert.equal(control.length, 0, "the control never opens a position");
});

test("the baseline is scored against the market's own settlement value", () => {
  const t = replayStrategy(RANDOM, makeSeries(), MARKET);
  assert.equal(t.result, "yes");
  assert.equal(t.settlementValue, 1);
  const gross = 1 - t.entryPrice;
  assert.ok(Math.abs(t.pnlBeforeFees - gross) < 1e-9,
    `gross pnl ${t.pnlBeforeFees} = 1 − ${t.entryPrice}`);
  assert.ok(Math.abs(t.pnlPerContract - (gross - t.feePaid)) < 1e-9,
    `net pnl ${t.pnlPerContract} = gross − fee`);
});

test("rollup groups the same trades by direction and by topic", () => {
  const trades = [
    { strategyKey: "a", strategyName: "A", side: "yes", topic: "crypto", pnlPerContract: 0.2, capitalPerContract: 0.5, entryPrice: 0.5 },
    { strategyKey: "b", strategyName: "B", side: "yes", topic: "crypto", pnlPerContract: -0.1, capitalPerContract: 0.5, entryPrice: 0.6 },
    { strategyKey: "c", strategyName: "C", side: "no", topic: "golf", pnlPerContract: 0.3, capitalPerContract: 0.4, entryPrice: 0.4 }
  ];
  const bySide = rollup(trades, t => t.side, (t, k) => k.toUpperCase());
  assert.equal(bySide.length, 2);
  const yes = bySide.find(g => g.key === "yes");
  assert.equal(yes.n, 2);
  assert.equal(yes.wins, 1);
  assert.equal(yes.losses, 1);
  assert.ok(Math.abs(yes.pnl - 0.1) < 1e-9, `pnl ${yes.pnl}`);
  assert.ok(Math.abs(yes.roi - 0.1 / 1.0) < 1e-9, `roi ${yes.roi}`);
  assert.equal(yes.winRate, 0.5);

  const byTopic = rollup(trades, t => t.topic, (t, k) => k);
  assert.equal(byTopic.length, 2);
  const crypto = byTopic.find(g => g.key === "crypto");
  assert.equal(crypto.n, 2);
  assert.ok(Math.abs(crypto.pnl - 0.1) < 1e-9);
});

test("rollup of no trades is empty, not a zero row", () => {
  assert.deepEqual(rollup([], t => t.side), []);
});

test("aggregate and rollup score the same trades the same way", () => {
  const trades = replayAll(STRATEGIES, makeSeries(), MARKET);
  const agg = aggregate(trades);
  const side = rollup(trades, t => t.side);
  const aggPnl = agg.reduce((a, g) => a + g.pnl, 0);
  const sidePnl = side.reduce((a, g) => a + g.pnl, 0);
  assert.ok(Math.abs(aggPnl - sidePnl) < 1e-9, "both cuts sum to the same P&L");
});

test("tradesToCsv writes a header, one row per trade, and a source link per row", () => {
  const trades = [{
    strategyName: "Momentum continuation", strategyKey: "momentum",
    eventTicker: "E1", ticker: "T1", eventTitle: "Title, with comma", topic: "crypto",
    side: "yes", entryPrice: 0.56, entryTs: 1700000000000,
    exitPrice: null, exitReason: "held to settlement", exitTs: 1700003600000,
    result: "yes", settlementValue: 1, pnlPerContract: 0.44, capitalPerContract: 0.56,
    category: "Crypto", seriesTicker: "S1"
  }];
  const csv = tradesToCsv(trades);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith("strategy,strategy_key,"), lines[0]);
  assert.ok(lines[0].includes("market_source"), "the export names the official source column");
  assert.ok(lines[1].includes('"Title, with comma"'), "commas are quoted");
  assert.ok(lines[1].includes("https://external-api.demo.kalshi.co/trade-api/v2/markets/T1"),
    "every row links the market response that produced it");
});

test("tradesToCsv escapes a quote inside a value", () => {
  const csv = tradesToCsv([{
    strategyName: 'Say "hi"', strategyKey: "k", eventTicker: "E", ticker: "T",
    eventTitle: "t", topic: "", side: "yes", entryPrice: 0.5, entryTs: null,
    exitPrice: null, exitReason: "", exitTs: null, result: "yes", settlementValue: 1,
    pnlPerContract: 0.5, capitalPerContract: 0.5, category: "", seriesTicker: ""
  }]);
  assert.ok(csv.includes('"Say ""hi"""'), csv);
});

test("tradesToCsv of no trades is a header with no rows", () => {
  const csv = tradesToCsv([]);
  assert.equal(csv.trim().split("\r\n").length, 1);
});

test("paperToCsv marks open and closed positions", () => {
  const csv = paperToCsv([
    { opened_at: "2026-01-01T00:00:00Z", ticker: "T1", event_ticker: "E1", event_title: "E", topic: "golf", side: "no", entry_price: 0.4, closed: false },
    { opened_at: "2026-01-01T01:00:00Z", ticker: "T2", event_ticker: "E2", event_title: "E2", topic: "golf", side: "yes", entry_price: 0.6, closed: true, result: "yes", settlement_value: 1, pnl_per_contract: 0.4 }
  ]);
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes(",open,"), lines[1]);
  assert.ok(lines[2].includes(",closed,"), lines[2]);
  assert.ok(lines[2].includes(",yes,"), "the settled outcome is exported");
});

/* -------------------------------------------------------------------------
 * Fees — checked against the published worked example.
 *
 * Source: https://docs.kalshi.com/getting_started/fee_rounding
 *   "FCM-cleared fill … suppose a buy has -$0.055000 of signed revenue and a
 *    model fee of $0.00363825:
 *      trade fee = ceil_6dp($0.00363825) = $0.003639
 *      aligned change = floor_cent(-$0.055 - $0.003639) = -$0.060000
 *      rounding fee = (-$0.055 - $0.003639) - -$0.06 = $0.001361
 *    The balance changes by -$0.06; the trade fee plus rounding fee is
 *    exactly $0.005."
 *
 * The example uses a non-direct member's $0.01 balance grid, so it is
 * reproduced with precision: 2.
 * ---------------------------------------------------------------------- */
test("the taker fee reproduces the published worked example exactly", () => {
  const f = fillFee(0.055, 1, { role: "taker", precision: 2 });
  assert.equal(f.modelFee, 0.00363825, "model fee");
  assert.equal(f.tradeFee, 0.003639, "trade fee is ceiled to 6dp");
  assert.equal(f.roundingFee, 0.001361, "rounding fee restores the $0.01 grid");
  assert.equal(f.netFee, 0.005, "trade fee plus rounding fee is exactly $0.005");
});

test("the maker rate is a quarter of the taker rate", () => {
  const taker = fillFee(0.40, 10, { role: "taker" });
  const maker = fillFee(0.40, 10, { role: "maker" });
  assert.ok(Math.abs(taker.modelFee / maker.modelFee - 4) < 1e-9,
    `taker ${taker.modelFee} is 4x maker ${maker.modelFee}`);
  assert.ok(Math.abs(maker.modelFee - 1 * 0.0175 * 10 * 0.40 * 0.60) < 1e-12);
});

test("the multiplier scales the fee linearly", () => {
  const one = fillFee(0.40, 1, { multiplier: 1 });
  const two = fillFee(0.40, 1, { multiplier: 2 });
  assert.ok(Math.abs(two.modelFee - one.modelFee * 2) < 1e-9);
});

test("a NO-side fee is priced on the NO price", () => {
  const no = sideFee("no", 0.40, 1);
  const expected = fillFee(0.60, 1).modelFee;   // NO price = 1 − 0.40
  assert.ok(Math.abs(no.modelFee - expected) < 1e-12,
    `no-side fee ${no.modelFee} uses the NO price 0.60`);
  /* The published formula is a function of the implied probability, so the
   * YES and NO fees at complementary prices are equal by construction. */
  const yes = sideFee("yes", 0.40, 1);
  assert.ok(Math.abs(yes.modelFee - no.modelFee) < 1e-12,
    "P(1−P) is symmetric, so YES and NO at complementary prices cost the same");
});

test("a fee is not computed for a price outside (0, 1)", () => {
  assert.equal(sideFee("yes", null, 1), null);
  assert.equal(sideFee("yes", 0, 1), null);
  assert.equal(sideFee("yes", 1, 1), null);
});

test("a simulated trade's P&L is net of the published fee", () => {
  const t = replayStrategy(RANDOM, makeSeries(), MARKET);
  const gross = t.payout - t.entryPrice;
  assert.ok(t.feePaid > 0, "a fee was charged");
  assert.ok(Math.abs(t.pnlBeforeFees - gross) < 1e-9, "gross P&L is payout − entry");
  assert.ok(Math.abs(t.pnlPerContract - (gross - t.feePaid)) < 1e-9, "net P&L is gross − fee");
  assert.ok(t.pnlPerContract < t.pnlBeforeFees, "fees make the result worse");
});

test("holding to settlement pays out with no exit fee", () => {
  const t = replayStrategy(RANDOM, makeSeries(), MARKET);
  assert.equal(t.exitReason, "held to settlement");
  const entryFee = sideFee(t.side, t.entryPrice, 1).netFee;
  assert.ok(Math.abs(t.feePaid - entryFee) < 1e-9, "only the entry leg is charged");
});

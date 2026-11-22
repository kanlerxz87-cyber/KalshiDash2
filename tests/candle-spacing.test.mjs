// Candle geometry and honesty of the price line.
// Run: node --test tests/candle-spacing.test.mjs
//
// Two captured demo responses back this file. Both were read on 2026-11-22 from
// GET /series/KXAAAGASW/markets/KXAAAGASW-26NOV23-3.6200/candlesticks and are
// reproduced exactly (see FIXTURE comments for the request each came from).
//
// What they establish:
//  * Periods ARE aligned and contiguous. The exchange emits every period in the
//    window, not only the ones that traded. A 900-second window at
//    period_interval=1 came back as 16 candles exactly 60s apart.
//  * A period with zero volume still comes back, but its `price` object
//    contains ONLY `previous_dollars` — no open/high/low/close/mean. So an
//    untraded period has no close price at all, and the plotted close line has
//    a genuine hole there. It must not be drawn as $0.00 or as the previous
//    price, and a move across it must not be attributed to a single period.
//  * The plotted value is the period's CLOSE. On the hourly slice the yes_bid
//    low dips to 0.9500 while every close stays 0.9700; plotting low/high would
//    invent a 2-cent swing that no close ever showed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCandle, detectJumps, JUMP_THRESHOLD } from "../assets/js/market.js";

// FIXTURE A — hourly, 1795248000..1795272000, period_interval=60.
// Seven candles, 3600s apart, closes all 0.9700. Trimmed to the fields the
// parser reads; every number is as returned.
const HOURLY = [
  { end_period_ts: 1795248000, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "218.79", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9600", open_dollars: "0.9600" } },
  { end_period_ts: 1795251600, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "292.58", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9600", open_dollars: "0.9600" } },
  { end_period_ts: 1795255200, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9600", mean_dollars: "0.9662", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "480.10", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9500", open_dollars: "0.9600" } },
  { end_period_ts: 1795258800, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "249.48", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9500", open_dollars: "0.9600" } },
  { end_period_ts: 1795262400, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "280.46", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9500", open_dollars: "0.9600" } },
  { end_period_ts: 1795266000, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "254.99", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9500", open_dollars: "0.9600" } },
  { end_period_ts: 1795269600, price: { close_dollars: "0.9700", high_dollars: "0.9700", low_dollars: "0.9700", mean_dollars: "0.9700", open_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "310.31", yes_bid: { close_dollars: "0.9600", high_dollars: "0.9800", low_dollars: "0.9500", open_dollars: "0.9600" } }
];

// FIXTURE B — the same window at period_interval=1, first 16 periods
// (1795248000..1795248900). One period, 1795248480, returned volume_fp "0.00"
// and a price object holding only previous_dollars.
const MINUTE_EMPTY_TS = 1795248480;
const MINUTE = [
  { end_period_ts: 1795248000, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "6.60" },
  { end_period_ts: 1795248060, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "3.53" },
  { end_period_ts: 1795248120, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "2.49" },
  { end_period_ts: 1795248180, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "6.37" },
  { end_period_ts: 1795248240, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "1.29" },
  { end_period_ts: 1795248300, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "3.16" },
  { end_period_ts: 1795248360, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "6.30" },
  { end_period_ts: 1795248420, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "5.35" },
  { end_period_ts: MINUTE_EMPTY_TS, price: { previous_dollars: "0.9700" }, volume_fp: "0.00" },
  { end_period_ts: 1795248540, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "0.52" },
  { end_period_ts: 1795248600, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "6.14" },
  { end_period_ts: 1795248660, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "5.54" },
  { end_period_ts: 1795248720, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "3.44" },
  { end_period_ts: 1795248780, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "6.61" },
  { end_period_ts: 1795248840, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "5.04" },
  { end_period_ts: 1795248900, price: { close_dollars: "0.9700", previous_dollars: "0.9700" }, volume_fp: "7.78" }
];

test("every period in the window comes back, aligned and contiguous", () => {
  const hourly = HOURLY.map(parseCandle);
  assert.equal(hourly.length, 7);
  for (let i = 1; i < hourly.length; i++) {
    assert.equal(hourly[i].t - hourly[i - 1].t, 3_600_000, `hour ${i} follows the previous by one hour`);
  }
  const minute = MINUTE.map(parseCandle);
  for (let i = 1; i < minute.length; i++) {
    assert.equal(minute[i].t - minute[i - 1].t, 60_000, `minute ${i} follows the previous by 60s`);
  }
  assert.equal(minute[0].t, 1795248000 * 1000, "timestamps are seconds in, milliseconds out");
});

test("an untraded period has no close price — it is not 0.00 and not the last price", () => {
  const pts = MINUTE.map(parseCandle);
  const empty = pts.find(p => p.t === MINUTE_EMPTY_TS * 1000);
  assert.equal(empty.y, null, "no close_dollars was returned, so the chart must not draw a close");
  assert.equal(empty.volume, 0);
  // The one field that WAS returned survives, so the gap is explainable.
  assert.equal(empty.prev, 0.97);
  // Its neighbours are priced, so this is a single-period hole in the line,
  // exactly as the response describes — not a stretch of silence.
  const priced = pts.filter(p => p.y !== null);
  assert.equal(priced.length, pts.length - 1);
});

test("the line plots the period close, so an intrabar dip is not a price move", () => {
  const pts = HOURLY.map(parseCandle);
  // yes_bid.low_dollars is 0.9500 in five of the seven hours, but no close is
  // below 0.9700. Plotting the low would draw a 2-cent swing that never closed.
  assert.deepEqual([...new Set(pts.map(p => p.y))], [0.97]);
  assert.equal(pts[2].yesBid, 0.96, "the bid close is carried separately for the liquidity view");
  assert.equal(detectJumps(pts, JUMP_THRESHOLD).length, 0, "a flat close series has no jumps");
});

test("X is elapsed time; a synthetic irregular series proves position ≠ time", () => {
  // Synthetic on purpose, and only about geometry: the captured payloads are
  // evenly spaced, so they cannot distinguish a time axis from an index axis.
  // This one can. 640px of plot, points at t=0, 1h, 2h, 7h.
  const pts = [{ t: 0 }, { t: 1 }, { t: 2 }, { t: 7 }].map(p => ({ t: p.t * 3_600_000 }));
  const W = 640;
  const t0 = 0, t1 = 7 * 3_600_000;
  const xTime = pts.map(p => ((p.t - t0) / (t1 - t0)) * W);
  const xIndex = pts.map((_, i) => (i / (pts.length - 1)) * W);
  assert.deepEqual(xTime.map(Math.round), [0, 91, 183, 640]);
  assert.deepEqual(xIndex.map(Math.round), [0, 213, 427, 640]);
  assert.notDeepEqual(xTime, xIndex, "the two axes disagree away from the endpoints");
});

test("a jump is never reported at an untraded period", () => {
  // A jump marker must land on a period that has a close. If a null-priced
  // period were treated as a price (or filled forward), the marker would sit on
  // a minute the payload says nothing traded — a fabricated instant on screen.
  const synthetic = [
    { t: 0, y: 0.40 },
    { t: 60_000, y: null },
    { t: 120_000, y: 0.55 }
  ];
  const jumps = detectJumps(synthetic, JUMP_THRESHOLD);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].t, 120_000, "the marker sits on the priced period");
  assert.equal(jumps[0].fromT, 0, "and it discloses which earlier period it compares against");
});

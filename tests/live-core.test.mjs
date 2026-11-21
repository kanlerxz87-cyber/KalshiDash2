/* Tests for the pure live-feed logic (assets/js/live-core.js).
 *
 * Run with:  node --test tests/live-core.test.mjs
 *
 * Every expectation below is tied to a documented Kalshi field or rule:
 *   - the WebSocket `ticker` payload fields
 *     https://docs.kalshi.com/websockets/market-ticker
 *   - the REST market object fields
 *     https://docs.kalshi.com/api-reference/market/get-markets
 *   - the alert threshold rule (|change| >= $0.10, inclusive)
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mod = await import(path.join(ROOT, "assets/js/live-core.js"));

const {
  round4, num, reading, swingBetween, foldReadings,
  fromTickerFrame, fromRestMarket, spreadOf, EPS
} = mod;

/* ---------------------------------------------------------------- rounding */

test("round4 matches the API's 4-decimal fixed-point dollar fields", () => {
  assert.equal(round4(0.7 - 0.6), 0.1);
  assert.equal(round4(1.0005), 1.0005);
  assert.equal(round4(0.123456), 0.1235);
  assert.equal(round4(-0.25), -0.25);
});

test("num returns null for values the API did not send", () => {
  assert.equal(num(null), null);
  assert.equal(num(undefined), null);
  assert.equal(num(""), null);
  assert.equal(num("not a number"), null);
  assert.equal(num("0.5600"), 0.56);
  assert.equal(num(0), 0);
});

/* ------------------------------------------------------- the swing test */

test("a swing of exactly $0.10 is detected (the threshold is inclusive)", () => {
  const prev = reading("M1", 0.60, { at: 1000 });
  const next = reading("M1", 0.70, { at: 2000 });
  const s = swingBetween(prev, next, 0.10);
  assert.ok(s, "exactly $0.10 must alert");
  assert.equal(s.from, 0.6);
  assert.equal(s.to, 0.7);
  assert.equal(s.delta, 0.1);
  assert.equal(s.direction, "up");
  assert.equal(s.fromAt, 1000);
  assert.equal(s.toAt, 2000);
});

test("a swing of exactly -$0.10 is detected in the other direction", () => {
  const prev = reading("M1", 0.70, { at: 1000 });
  const next = reading("M1", 0.60, { at: 2000 });
  const s = swingBetween(prev, next, 0.10);
  assert.ok(s);
  assert.equal(s.delta, -0.1);
  assert.equal(s.direction, "down");
});

test("a move smaller than the threshold is not a swing", () => {
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", 0.69)), null);
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", 0.61)), null);
});

test("a move of exactly $0.09 is not a swing", () => {
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", 0.69), 0.10), null);
});

test("no price change is not a swing", () => {
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", 0.60)), null);
});

test("a missing price on either side produces no swing", () => {
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", null)), null);
  assert.equal(swingBetween(reading("M1", null), reading("M1", 0.70)), null);
  assert.equal(swingBetween(reading("M1", 0.60), reading("M1", undefined)), null);
});

test("readings of different markets are never compared", () => {
  assert.equal(swingBetween(reading("M1", 0.60), reading("M2", 0.90)), null);
});

test("the float-safe EPS rule keeps 0.70-0.60 at exactly $0.10", () => {
  // 0.7 - 0.6 is 0.09999999999999998 in IEEE-754; the threshold test must
  // still pass because of the EPS allowance.
  const raw = 0.7 - 0.6;
  assert.ok(raw < 0.10, "the raw subtraction really is below 0.10");
  assert.ok(0.10 - raw < EPS, "and it is within the EPS allowance");
  assert.ok(swingBetween(reading("M1", 0.6), reading("M1", 0.7), 0.10));
});

/* ------------------------------------------------------ folding readings */

test("the first reading for a ticker only sets a baseline", () => {
  const state = new Map();
  const swings = foldReadings(state, [reading("M1", 0.60, { at: 1 })], 0.10);
  assert.equal(swings.length, 0, "there is nothing to compare the first reading with");
  assert.equal(state.get("M1").price, 0.6);
});

test("folding produces one swing per qualifying move and keeps the state", () => {
  const state = new Map();
  const swings = foldReadings(state, [
    reading("M1", 0.60, { at: 1 }),
    reading("M1", 0.65, { at: 2 }),   // below threshold
    reading("M1", 0.75, { at: 3 }),   // exactly +$0.10 -> swing
    reading("M1", 0.70, { at: 4 })    // -$0.05 -> not a swing
  ], 0.10);
  assert.equal(swings.length, 1);
  assert.equal(swings[0].delta, 0.1);
  assert.equal(swings[0].direction, "up");
  assert.equal(state.get("M1").price, 0.70);
});

test("folding tracks each ticker independently", () => {
  const state = new Map();
  const swings = foldReadings(state, [
    reading("M1", 0.60), reading("M2", 0.40),
    reading("M1", 0.75),   // +$0.15 -> swing
    reading("M2", 0.45)    // +$0.05 -> below the threshold, not a swing
  ], 0.10);
  assert.equal(swings.length, 1, "only M1 moved by at least $0.10");
  assert.deepEqual(swings.map(s => s.ticker), ["M1"]);
  assert.equal(state.get("M1").price, 0.75);
  assert.equal(state.get("M2").price, 0.45);
});

test("folding alerts each ticker once it has moved far enough", () => {
  const state = new Map();
  const swings = foldReadings(state, [
    reading("M1", 0.60), reading("M2", 0.40),
    reading("M2", 0.55),   // +$0.15 -> swing
    reading("M1", 0.75)    // +$0.15 -> swing
  ], 0.10);
  assert.equal(swings.length, 2);
  assert.deepEqual(swings.map(s => s.ticker).sort(), ["M1", "M2"]);
});

test("folding ignores readings without a ticker", () => {
  const state = new Map();
  const swings = foldReadings(state, [null, {}, reading("M1", 0.6)], 0.10);
  assert.equal(swings.length, 0);
  assert.equal(state.size, 1);
});

/* ------------------------------------------------ the WebSocket ticker frame */

test("a ticker frame maps onto a reading using the documented field names", () => {
  // Field names and types taken from the documented ticker payload:
  // https://docs.kalshi.com/websockets/market-ticker
  const r = fromTickerFrame({
    market_ticker: "KXHIGHNY-26NOV20-T74.5",
    price_dollars: "0.4800",
    yes_bid_dollars: "0.4500",
    yes_ask_dollars: "0.5300",
    volume_fp: "33896.00",
    open_interest_fp: "20422.00",
    ts_ms: 1669149841000
  });
  assert.ok(r);
  assert.equal(r.ticker, "KXHIGHNY-26NOV20-T74.5");
  assert.equal(r.price, 0.48);
  assert.equal(r.yesBid, 0.45);
  assert.equal(r.yesAsk, 0.53);
  assert.equal(r.volume, 33896);
  assert.equal(r.openInterest, 20422);
  assert.equal(r.at, 1669149841000);
});

test("the ticker frame carries price_dollars, not last_price_dollars", () => {
  // The two sources name the same field differently. A frame that used the
  // REST name must not silently read as a price of null.
  const r = fromTickerFrame({ market_ticker: "M1", price_dollars: "0.7000" });
  assert.equal(r.price, 0.7);
  const wrong = fromTickerFrame({ market_ticker: "M1", last_price_dollars: "0.7000" });
  assert.equal(wrong.price, null, "a REST-named field is not read from a WS frame");
});

test("a ticker frame without a market_ticker is ignored", () => {
  assert.equal(fromTickerFrame(null), null);
  assert.equal(fromTickerFrame({}), null);
  assert.equal(fromTickerFrame({ price_dollars: "0.5" }), null);
});

test("a ticker frame without ts_ms falls back to the arrival time", () => {
  const before = Date.now();
  const r = fromTickerFrame({ market_ticker: "M1", price_dollars: "0.5" });
  assert.ok(r.at >= before, "at must be set even when the frame omits ts_ms");
});

/* ------------------------------------------------------- the REST market */

test("a REST market maps onto a reading using last_price_dollars", () => {
  const r = fromRestMarket({
    ticker: "KXHIGHNY-26NOV20-T74.5",
    last_price_dollars: "0.5600",
    yes_bid_dollars: "0.5600",
    yes_ask_dollars: "0.5600",
    volume_fp: "10.00",
    open_interest_fp: "10.00"
  });
  assert.ok(r);
  assert.equal(r.price, 0.56);
  assert.equal(r.yesBid, 0.56);
  assert.equal(r.yesAsk, 0.56);
});

test("a REST market without a ticker is ignored", () => {
  assert.equal(fromRestMarket(null), null);
  assert.equal(fromRestMarket({ last_price_dollars: "0.5" }), null);
});

test("the two sources produce comparable readings", () => {
  const ws = fromTickerFrame({ market_ticker: "M1", price_dollars: "0.6000" });
  const rest = fromRestMarket({ ticker: "M1", last_price_dollars: "0.7000" });
  const s = swingBetween(ws, rest, 0.10);
  assert.ok(s, "a ticker frame and a REST read are comparable");
  assert.equal(s.delta, 0.1);
});

/* --------------------------------------------------------------- spread */

test("spread is null unless the quote is two-sided", () => {
  assert.equal(spreadOf(reading("M1", 0.5, { yesBid: 0.48, yesAsk: 0.52 })), 0.04);
  assert.equal(spreadOf(reading("M1", 0.5, { yesBid: 0.48 })), null);
  assert.equal(spreadOf(reading("M1", 0.5, { yesAsk: 0.52 })), null);
  assert.equal(spreadOf(reading("M1", 0.5)), null);
  assert.equal(spreadOf(null), null);
});

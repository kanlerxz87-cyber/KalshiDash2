// Unit tests for the live/historical data-tier handling in
// assets/js/market.js and assets/js/simulator.js.
// Run: node --test tests/historical-tier.test.mjs
//
// Official basis (fetched 2026-11-21):
//   https://docs.kalshi.com/getting_started/historical_data
//     "Markets and their candlesticks that settled before [market_settled_ts]
//      are only available via GET /historical/markets"; each data type has its
//      own cutoff and the cutoffs are published by GET /historical/cutoff.
//   https://docs.kalshi.com/api-reference/market/get-market-candlesticks
//     live candles: price.close_dollars / price.previous_dollars / volume_fp
//   https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks
//     archived candles: price.close / price.previous / volume
//
// The two tiers therefore carry the same numbers under different field names.
// These tests pin that both shapes parse to the same point object, that a
// settled market falls back to the archived tier only when the live tier is
// empty, and that the fallback reports which tier answered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { api, fetchCandles, isSettledMarket, parseCandle, detectJumps } from "../assets/js/market.js";
import { mergeTiers, HISTORICAL_UNIVERSE } from "../assets/js/simulator.js";

/* ------------------------------------------------------------ parseCandle */

const liveCandle = {
  end_period_ts: 1700000000,
  yes_bid: { open_dollars: "0.4300", low_dollars: "0.4200", high_dollars: "0.4500", close_dollars: "0.4400" },
  yes_ask: { open_dollars: "0.4500", low_dollars: "0.4400", high_dollars: "0.4700", close_dollars: "0.4600" },
  price: {
    open_dollars: "0.4000", low_dollars: "0.3500", high_dollars: "0.5000",
    close_dollars: "0.4500", mean_dollars: "0.4200", previous_dollars: "0.3000",
    min_dollars: "0.3500", max_dollars: "0.5000"
  },
  volume_fp: "12.00",
  open_interest_fp: "30.00"
};

/* Same period as returned by GET /historical/markets/{ticker}/candlesticks:
 * plain key names, and no min/max on price. */
const historicalCandle = {
  end_period_ts: 1700000000,
  yes_bid: { open: "0.4300", low: "0.4200", high: "0.4500", close: "0.4400" },
  yes_ask: { open: "0.4500", low: "0.4400", high: "0.4700", close: "0.4600" },
  price: {
    open: "0.4000", low: "0.3500", high: "0.5000",
    close: "0.4500", mean: "0.4200", previous: "0.3000"
  },
  volume: "12.00",
  open_interest: "30.00"
};

test("live-tier candle parses to the chart point shape", () => {
  const p = parseCandle(liveCandle);
  assert.equal(p.t, 1700000000 * 1000);
  assert.equal(p.y, 0.45);
  assert.equal(p.open, 0.40);
  assert.equal(p.high, 0.50);
  assert.equal(p.low, 0.35);
  assert.equal(p.mean, 0.42);
  assert.equal(p.prev, 0.30);
  assert.equal(p.yesBid, 0.44);
  assert.equal(p.yesAsk, 0.46);
  assert.equal(p.volume, 12);
  assert.equal(p.openInterest, 30);
});

test("archived-tier candle parses to exactly the same values", () => {
  assert.deepEqual(parseCandle(historicalCandle), parseCandle(liveCandle));
});

test("fields the response did not carry stay null (never 0)", () => {
  const p = parseCandle({ end_period_ts: 1, price: { close: "0.3100" }, volume: "0.00" });
  assert.equal(p.y, 0.31);
  assert.equal(p.open, null);
  assert.equal(p.high, null);
  assert.equal(p.low, null);
  assert.equal(p.prev, null);
  assert.equal(p.yesBid, null);
  assert.equal(p.openInterest, null);
  // An explicit API zero is preserved as 0, not turned into a gap.
  assert.equal(p.volume, 0);
});

/* -------------------------------------------------------- isSettledMarket */

test("a market is settled-tier eligible from its own exchange fields", () => {
  assert.equal(isSettledMarket({ result: "yes" }), true);
  assert.equal(isSettledMarket({ result: "NO" }), true);
  assert.equal(isSettledMarket({ status: "settled" }), true);
  assert.equal(isSettledMarket({ status: "finalized" }), true);
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(isSettledMarket({ close_time: past }), true);
});

test("an open market with no result is not settled-tier eligible", () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  assert.equal(isSettledMarket({ status: "active", close_time: future }), false);
  assert.equal(isSettledMarket({ status: "open" }), false);
  assert.equal(isSettledMarket({}), false);
  assert.equal(isSettledMarket(null), false);
});

/* --------------------------------------------------------- mergeTiers */

test("mergeTiers de-duplicates by ticker and keeps the live record", () => {
  const live = [{ ticker: "A", result: "yes", volume_fp: "2.00", _tier: "live" }];
  const archived = [
    { ticker: "A", result: "yes", volume_fp: "1.00", _tier: "historical" },
    { ticker: "B", result: "no", volume_fp: "3.00", _tier: "historical" }
  ];
  const merged = mergeTiers(live, archived);
  assert.equal(merged.length, 2);
  const a = merged.find(m => m.ticker === "A");
  assert.equal(a._tier, "live");
  assert.equal(a.volume_fp, "2.00");
  const b = merged.find(m => m.ticker === "B");
  assert.equal(b._tier, "historical");
});

test("mergeTiers tolerates an unreadable archived tier and empty input", () => {
  assert.equal(mergeTiers([{ ticker: "A" }], []).length, 1);
  assert.equal(mergeTiers([], []).length, 0);
  assert.equal(mergeTiers(undefined, undefined).length, 0);
});

test("the archived-tier scan is explicitly bounded", () => {
  assert.equal(HISTORICAL_UNIVERSE.limit, 100);
  assert.ok(HISTORICAL_UNIVERSE.maxPages >= 1);
});

/* ------------------------------------------------- fetchCandles fallback */

/* Stub the module's shared client so the routing can be proven offline. The
 * real client is restored after every test. */
async function withStubbedApi(handler, fn) {
  const original = api.get;
  const calls = [];
  api.get = async (path) => { calls.push(path); return handler(path); };
  try {
    return await fn(calls);
  } finally {
    api.get = original;
  }
}

const seriesEvent = { ticker: "T-1", series_ticker: "S-1", event_ticker: "E-1" };

test("a live market reads only the live tier", async () => {
  await withStubbedApi(
    () => ({ candlesticks: [liveCandle] }),
    async (calls) => {
      const res = await fetchCandles(
        { ...seriesEvent, status: "active", close_time: new Date(Date.now() + 86400000).toISOString() },
        { seconds: 3600, interval: 1 }
      );
      assert.equal(res.via, "live");
      assert.equal(res.points.length, 1);
      assert.match(res.source, /\/series\/S-1\/markets\/T-1\/candlesticks$/);
      assert.ok(calls.every(c => c.startsWith("/series/")), "no historical call for an open market");
    }
  );
});

test("a settled market falls back to the archived tier when live is empty", async () => {
  await withStubbedApi(
    (path) => (path.startsWith("/historical/")
      ? { candlesticks: [historicalCandle] }
      : { candlesticks: [] }),
    async (calls) => {
      const res = await fetchCandles(
        { ...seriesEvent, result: "yes", settlement_ts: "2026-11-01T00:00:00Z" },
        { seconds: 3600, interval: 1, endTs: 1793500000 }
      );
      assert.equal(res.via, "historical");
      assert.equal(res.points.length, 1);
      assert.equal(res.points[0].y, 0.45);
      assert.equal(res.points[0].prev, 0.30);
      assert.match(res.source, /\/historical\/markets\/T-1\/candlesticks$/);
      assert.ok(calls.some(c => c.startsWith("/historical/markets/T-1/candlesticks")));
      assert.ok(calls.some(c => c.startsWith("/series/S-1/markets/T-1/candlesticks")));
    }
  );
});

test("the archived tier is asked only after the live tier comes back empty", async () => {
  let historicalCalls = 0;
  await withStubbedApi(
    (path) => {
      if (path.startsWith("/historical/")) { historicalCalls += 1; return { candlesticks: [historicalCandle] }; }
      return { candlesticks: [liveCandle] };
    },
    async () => {
      await fetchCandles({ ...seriesEvent, result: "yes" }, { seconds: 3600, interval: 1, endTs: 1793500000 });
      assert.equal(historicalCalls, 0, "live data wins; the archived tier is not queried");
    }
  );
});

test("a refusal from the archived tier is reported, not hidden", async () => {
  await withStubbedApi(
    (path) => {
      if (path.startsWith("/historical/")) throw new Error("HTTP 403");
      return { candlesticks: [] };
    },
    async () => {
      const res = await fetchCandles({ ...seriesEvent, result: "no" }, { seconds: 600, interval: 1, endTs: 1793500000 });
      assert.equal(res.via, "live");
      assert.equal(res.points.length, 0);
      assert.equal(res.historicalError, "HTTP 403");
    }
  );
});

test("allowHistorical:false never touches the archived tier", async () => {
  await withStubbedApi(
    (path) => (path.startsWith("/historical/") ? { candlesticks: [historicalCandle] } : { candlesticks: [] }),
    async (calls) => {
      const res = await fetchCandles(
        { ...seriesEvent, result: "yes" },
        { seconds: 600, interval: 1, endTs: 1793500000, allowHistorical: false }
      );
      assert.equal(res.via, "live");
      assert.equal(res.points.length, 0);
      assert.ok(!calls.some(c => c.startsWith("/historical/")));
    }
  );
});

test("a $0.10 jump inside archived-tier candles is still detected", async () => {
  const older = { ...historicalCandle, end_period_ts: 1700000000, price: { ...historicalCandle.price, close: "0.3000", previous: "0.3000" } };
  await withStubbedApi(
    (path) => (path.startsWith("/historical/") ? { candlesticks: [older, historicalCandle] } : { candlesticks: [] }),
    async () => {
      const res = await fetchCandles({ ...seriesEvent, result: "yes" }, { seconds: 3600, interval: 1, endTs: 1793500000 });
      const jumps = detectJumps(res.points, { threshold: 0.10 });
      assert.equal(jumps.length, 1);
      assert.equal(jumps[0].from, 0.30);
      assert.equal(jumps[0].to, 0.45);
      assert.equal(jumps[0].dir, "up");
    }
  );
});

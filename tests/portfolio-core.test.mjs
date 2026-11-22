// Offline contracts, not live account data.
// Official schema: https://docs.kalshi.com/api-reference/portfolio/get-positions
import { test } from "node:test";
import assert from "node:assert/strict";
import { KalshiClient } from "../assets/js/kalshi.js";
import { analyseFills } from "../assets/js/market.js";
import { POSITION_FIELDS, positionDollars, summarizePositions, loadPositions } from "../assets/js/portfolio-core.js";

function row(overrides = {}) {
  return {
    ticker: "KXTEST-1", position_fp: "0.25", market_exposure_dollars: "2.5000",
    realized_pnl_dollars: "-1.2500", fees_paid_dollars: "0.1250",
    total_traded_dollars: "10.0000", ...overrides
  };
}

test("documented dollar strings are not divided by 100; explicit zero is preserved", () => {
  assert.equal(positionDollars(row(), "market_exposure_dollars"), 2.5);
  assert.equal(positionDollars(row(), "realized_pnl_dollars"), -1.25);
  assert.equal(positionDollars(row({ fees_paid_dollars: "0.0000" }), "fees_paid_dollars"), 0);
});

test("absent, invalid and undocumented values stay unavailable", () => {
  for (const raw of [null, undefined, "", "  ", "not a value", Infinity, NaN, true, false, [], {}]) {
    assert.equal(positionDollars({ fees_paid_dollars: raw }, "fees_paid_dollars"), null);
  }
  assert.equal(positionDollars({ fees_paid: 123 }, "fees_paid_dollars"), null,
    "an undocumented legacy/cents field is not used to invent a dollar value");
  assert.equal(positionDollars({ other_dollars: "1.00" }, "other_dollars"), null);
  assert.equal(positionDollars(null, "fees_paid_dollars"), null);
});

test("complete, known input fields produce their own separate totals", () => {
  const result = summarizePositions([row(), row()]);
  assert.deepEqual(result.sums, { realized: -2.5, fees: 0.25, traded: 20, exposure: 5 });
  assert.deepEqual(result.missing, { realized: 0, fees: 0, traded: 0, exposure: 0 });
  assert.equal(result.n, 2);
  assert.equal(result.complete, true);
  assert.equal("netPnl" in result, false, "fee inclusion is not assumed");
});

test("a single missing field withholds that total, not a plausible partial sum", () => {
  const result = summarizePositions([row(), row({ fees_paid_dollars: null })]);
  assert.equal(result.sums.fees, null);
  assert.equal(result.missing.fees, 1);
  assert.equal(result.sums.exposure, 5);
});

test("all missing inputs stay null; known zero is not confused with missing", () => {
  assert.deepEqual(summarizePositions([{}]).sums,
    { realized: null, fees: null, traded: null, exposure: null });
  const zero = Object.fromEntries(Object.values(POSITION_FIELDS).map(k => [k, "0.0000"]));
  assert.deepEqual(summarizePositions([zero]).sums, { realized: 0, fees: 0, traded: 0, exposure: 0 });
});

test("a capped scan withholds every total even if every returned row has values", () => {
  const result = summarizePositions([row()], { complete: false });
  assert.deepEqual(result.sums, { realized: null, fees: null, traded: null, exposure: null });
  assert.equal(result.complete, false);
});

test("empty complete and empty incomplete scans are distinguishable", () => {
  assert.deepEqual(summarizePositions([]).sums, { realized: 0, fees: 0, traded: 0, exposure: 0 });
  assert.deepEqual(summarizePositions([], { complete: false }).sums,
    { realized: null, fees: null, traded: null, exposure: null });
});

test("the real client gets one '?' and a properly encoded paging cursor", async () => {
  const client = new KalshiClient();
  const calls = [];
  client.request = async (method, path) => {
    calls.push({ method, path });
    return calls.length === 1
      ? { market_positions: [row()], cursor: "next?+/=" }
      : { market_positions: [row({ ticker: "KXTEST-2" })], cursor: "" };
  };
  const result = await loadPositions(client);
  assert.equal(result.complete, true);
  assert.equal(result.pages, 2);
  assert.equal(result.positions.length, 2);
  for (const call of calls) {
    assert.equal(call.method, "GET");
    assert.equal((call.path.match(/\?/g) || []).length, 1);
    const url = new URL(call.path, "https://example.test");
    assert.equal(url.pathname, "/portfolio/positions");
    assert.equal(url.searchParams.get("limit"), "200");
    assert.equal(url.searchParams.get("settlement_status"), "unsettled");
  }
  assert.equal(new URL(calls[1].path, "https://example.test").searchParams.get("cursor"), "next?+/=");
});

test("paging cap is explicit rather than silently called complete", async () => {
  let calls = 0;
  const result = await loadPositions({ positions: async () => ({
    market_positions: [row({ ticker: `KXTEST-${++calls}` })], cursor: `page-${calls}`
  }) }, { maxPages: 2 });
  assert.equal(calls, 2);
  assert.equal(result.complete, false);
  assert.equal(result.nextCursor, "page-2");
});

test("a request failure is not converted to an empty account", async () => {
  await assert.rejects(loadPositions({ positions: async () => { throw new Error("401 unauthorized"); } }), /401/);
  let calls = 0;
  await assert.rejects(loadPositions({ positions: async () => {
    if (++calls === 1) return { market_positions: [row()], cursor: "next" };
    throw new Error("429 rate limited");
  } }), /429/);
});

test("malformed or repeated-cursor responses do not claim verified coverage", async () => {
  for (const data of [{}, { market_positions: [] }, { cursor: "" }, { market_positions: null, cursor: "" }]) {
    await assert.rejects(loadPositions({ positions: async () => data }), /coverage is unverified/);
  }
  await assert.rejects(loadPositions({ positions: async () => ({ market_positions: [row()], cursor: "same" }) }),
    /repeated a cursor/);
});

test("query bounds are checked before any request", async () => {
  const client = { positions: () => { throw new Error("must not be called"); } };
  for (const opts of [{ limit: 0 }, { limit: 1001 }, { limit: 1.5 }, { maxPages: 0 }]) {
    await assert.rejects(loadPositions(client, opts), /must be/);
  }
});

test("liquidity-role buckets say taker/maker, not true/false; side is separate", () => {
  const base = { count_fp: "0.25", outcome_side: "yes", yes_price_dollars: "0.50", fee_cost: "0.01" };
  const result = analyseFills([
    { ...base, is_taker: true }, { ...base, is_taker: false },
    { ...base }, { ...base, is_taker: "true" }
  ]);
  assert.deepEqual(new Set(result.byRole.map(g => g.key)), new Set(["taker", "maker", "unclassified"]));
  assert.equal(result.byRole.find(g => g.key === "unclassified").n, 2);
  assert.equal(result.bySide[0].key, "yes");
  assert.equal(result.bySide[0].n, 4);
});

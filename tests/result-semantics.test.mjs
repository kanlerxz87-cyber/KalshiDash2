// Settlement-result semantics on the boards.
// Run: node --test tests/result-semantics.test.mjs
//
// Why this file exists: the overview and category boards collapse a list of
// markets into one event-level result. The exchange's `result` field is an
// enum, not a boolean, and `scalar` is one of its documented values:
//
//   Get Market, response schema `market.result`
//   https://docs.kalshi.com/api-reference/market/get-market
//     result: enum["yes","no","scalar",""]
//   market_type: enum["binary","scalar"]
//
// Before this test, an event whose only result was `scalar` (or any value that
// was not a literal "yes"/"no") was reported as **no** on the boards. That is
// an inferred value on a site that must never infer one. These cases pin the
// literal behaviour so the regression cannot return.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankEvents } from "../assets/js/market.js";
import { updateTrade } from "../assets/js/alerts-core.js";

const market = (ticker, result, extra = {}) => ({
  ticker,
  result,
  volume_fp: "100.00",
  open_interest_fp: "100.00",
  last_price_dollars: "0.5000",
  close_time: "2026-12-01T00:00:00Z",
  ...extra
});

const eventWith = (results, extra = {}) => ({
  event_ticker: "EVT",
  title: "Test event",
  category: "Crypto",
  series_ticker: "KXTEST",
  markets: results.map((r, i) => market(`MKT-${i}`, r, extra)),
});

test("a single settled scalar result is reported as scalar, never as no", () => {
  const [row] = rankEvents([eventWith(["scalar"])], "money");
  assert.equal(row.result, "scalar");
  assert.notEqual(row.result, "no");
});

test("a single settled YES result is still reported as yes", () => {
  const [row] = rankEvents([eventWith(["yes"])], "money");
  assert.equal(row.result, "yes");
});

test("a single settled NO result is still reported as no", () => {
  const [row] = rankEvents([eventWith(["no"])], "money");
  assert.equal(row.result, "no");
});

test("unsettled markets (empty result) report no result at all", () => {
  const [row] = rankEvents([eventWith(["", ""])], "money");
  assert.equal(row.result, null);
});

test("every market agreeing on one result reports that result", () => {
  const [row] = rankEvents([eventWith(["yes", "yes", "yes"])], "money");
  assert.equal(row.result, "yes");
});

test("YES and NO together are reported as mixed, not as one side", () => {
  const [row] = rankEvents([eventWith(["yes", "no"])], "money");
  assert.equal(row.result, "mixed");
});

test("a binary and a scalar outcome together are reported as mixed", () => {
  const [row] = rankEvents([eventWith(["yes", "scalar"])], "money");
  assert.equal(row.result, "mixed");
});

test("an unsettled market alongside a settled one does not erase the result", () => {
  const [row] = rankEvents([eventWith(["", "no"])], "money");
  assert.equal(row.result, "no");
});

test("result matching is case-insensitive and tolerates missing fields", () => {
  const [row] = rankEvents([
    { event_ticker: "E", title: "t", markets: [{ ticker: "M", result: "SCALAR" }] }
  ], "money");
  assert.equal(row.result, "scalar");
  const [none] = rankEvents([{ event_ticker: "E2", title: "t" }], "money");
  assert.equal(none.result, null);
});

/* A scalar payout is not $1/$0, so a paper trade must NOT be resolved on it.
 * This is the conservative half of the rule and is expected behaviour, not a
 * missing feature: the page says trades resolve only on an exchange yes/no. */
test("paper trades do not resolve a scalar settlement as a win or a loss", () => {
  const trade = {
    id: "t1", strategy: "follow-all", ticker: "MKT-0", side: "yes",
    entry: 0.5, status: "open", mark: null, unrealized: null,
    result: null, payout: null, pnl: null, closedAt: null
  };
  const after = updateTrade(trade, market("MKT-0", "scalar"), 1_700_000_000_000);
  assert.equal(after.status, "open");
  assert.equal(after.result, null);
  assert.equal(after.pnl, null);
  assert.equal(after.payout, null);
});

test("paper trades still resolve on a literal yes and no", () => {
  const trade = {
    id: "t2", strategy: "follow-all", ticker: "MKT-0", side: "yes",
    entry: 0.5, status: "open", mark: null, unrealized: null,
    result: null, payout: null, pnl: null, closedAt: null
  };
  const won = updateTrade(trade, market("MKT-0", "yes"), 1_700_000_000_000);
  assert.equal(won.status, "resolved");
  assert.equal(won.payout, 1);
  assert.equal(won.pnl, 0.5);
  const lost = updateTrade(trade, market("MKT-0", "no"), 1_700_000_000_000);
  assert.equal(lost.status, "resolved");
  assert.equal(lost.payout, 0);
  assert.equal(lost.pnl, -0.5);
});

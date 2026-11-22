/* KalshiDash2 — tests for the cursor-pagination guard (assets/js/paging.js).
 *
 * The rule under test is Kalshi's own, from the Get Markets reference
 * (https://docs.kalshi.com/api-reference/market/get-markets, read 2026-11-22):
 * "A `cursor` that cannot be decoded is ignored and the first page is returned,
 * with no error." A client that appends every page it receives therefore counts
 * one page twice without any signal from the API.
 *
 * Run: node --test tests/paging-guard.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createPageGuard, rowKey, KEY_FIELDS } from "../assets/js/paging.js";

test("rowKey uses the documented identifier fields, in order", () => {
  assert.equal(rowKey({ trade_id: "t1", ticker: "M" }), "trade_id:t1");
  assert.equal(rowKey({ event_ticker: "E", ticker: "M" }), "event_ticker:E");
  assert.equal(rowKey({ ticker: "M" }), "ticker:M");
  assert.deepEqual([...KEY_FIELDS], ["trade_id", "event_ticker", "ticker"]);
});

test("rowKey returns null rather than inventing a key", () => {
  assert.equal(rowKey({ title: "no id here" }), null);
  assert.equal(rowKey({ ticker: "" }), null, "an empty string is not an identifier");
  assert.equal(rowKey(null), null);
  assert.equal(rowKey("string"), null);
});

test("a repeated row is dropped once and counted, never silently merged", () => {
  const g = createPageGuard();
  const page1 = g.accept([{ ticker: "A" }, { ticker: "B" }]);
  assert.deepEqual(page1.map(r => r.ticker), ["A", "B"]);
  const page2 = g.accept([{ ticker: "A" }, { ticker: "C" }]);
  assert.deepEqual(page2.map(r => r.ticker), ["C"], "the repeat is removed, the new row is kept");
  assert.equal(g.state.dropped, 1);
  assert.equal(g.state.accepted, 3, "only distinct rows count as accepted");
});

test("rows with no documented identifier are always kept", () => {
  const g = createPageGuard();
  const first = g.accept([{ title: "x" }, { title: "x" }]);
  assert.equal(first.length, 2, "no key, no drop — the guard never guesses equality");
  assert.equal(g.state.dropped, 0);
  assert.equal(g.state.unkeyed, 2);
});

test("a cursor the exchange hands back a second time ends the walk", () => {
  const g = createPageGuard();
  assert.equal(g.remember("c1"), true, "first sight of a cursor is fine");
  assert.equal(g.remember("c2"), true);
  assert.equal(g.remember("c1"), false, "c1 was already sent: the list restarted");
  assert.equal(g.state.repeatedCursor, true);
});

test("an empty cursor is the documented end of the list, not a repeat", () => {
  const g = createPageGuard();
  assert.equal(g.remember(""), true);
  assert.equal(g.remember(""), true);
  assert.equal(g.state.repeatedCursor, false);
});

test("remember() tolerates a missing or non-string cursor without crashing", () => {
  const g = createPageGuard();
  assert.equal(g.remember(undefined), true);
  assert.equal(g.remember(null), true);
  assert.equal(g.remember(42), true);
});

test("accept() handles a missing page body", () => {
  const g = createPageGuard();
  assert.deepEqual(g.accept(undefined), []);
  assert.deepEqual(g.accept(null), []);
  assert.equal(g.state.accepted, 0);
});

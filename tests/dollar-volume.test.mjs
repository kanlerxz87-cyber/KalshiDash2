/* KalshiDash2 — tests for assets/js/dollar-volume.js
 *
 * Every assertion here is checked against the documented shape of
 * GET /markets/trades (https://docs.kalshi.com/api-reference/market/get-trades):
 * `count_fp` contracts, `yes_price_dollars` / `no_price_dollars`,
 * `taker_outcome_side`, `created_time`, a `cursor` and `limit` of 1–1000.
 *
 * The point of the suite is the "never invent a number" rule: a partial read,
 * a missing price and an unknown taker side must all be visible in the output
 * rather than silently averaged into a total.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  tradeDollars, foldTradesPage, emptyTally, summariseTally,
  windowQuery, tradesPath, collectTrades, rankByTradedDollars,
  LIMITS, TRADES_SOURCE, TRADES_PATH
} from "../assets/js/dollar-volume.js";

/* A trade in the documented shape. `side` is the taker's outcome side. */
function trade({ ticker = "T", count = "10.00", yes = "0.40", no = "0.60", side = "yes", at = "2026-11-21T12:00:00Z" } = {}) {
  return {
    trade_id: Math.random().toString(36).slice(2),
    ticker,
    count_fp: count,
    yes_price_dollars: yes,
    no_price_dollars: no,
    taker_outcome_side: side,
    taker_book_side: side === "yes" ? "bid" : "ask",
    created_time: at,
    is_block_trade: false
  };
}

test("source constants point at the official Get Trades page", () => {
  assert.equal(TRADES_SOURCE, "https://docs.kalshi.com/api-reference/market/get-trades");
  assert.equal(TRADES_PATH, "/markets/trades");
  assert.equal(LIMITS.maxLimit, 1000);
  assert.equal(LIMITS.defaultLimit, 100);
});

test("a YES taker pays count × yes_price_dollars", () => {
  const d = tradeDollars(trade({ count: "10.00", yes: "0.40", no: "0.60", side: "yes" }));
  assert.equal(d.priced, true);
  assert.equal(d.contracts, 10);
  assert.equal(d.price, 0.4);
  assert.equal(d.dollars, 4);
  assert.equal(d.side, "yes");
});

test("a NO taker pays count × no_price_dollars, not the YES price", () => {
  const d = tradeDollars(trade({ count: "10.00", yes: "0.40", no: "0.60", side: "no" }));
  assert.equal(d.price, 0.6);
  assert.equal(d.dollars, 6);
});

test("the deprecated taker_side is accepted when taker_outcome_side is absent", () => {
  const t = trade({ count: "5.00", yes: "0.20", no: "0.80" });
  delete t.taker_outcome_side;
  t.taker_side = "no";
  assert.equal(tradeDollars(t).dollars, 4);
});

test("a row with no side is valued on the YES leg and says so", () => {
  const t = trade({ count: "5.00", yes: "0.20", no: "0.80" });
  delete t.taker_outcome_side;
  const d = tradeDollars(t);
  assert.equal(d.priced, true);
  assert.equal(d.side, null);
  assert.equal(d.dollars, 1);
  assert.match(d.reason, /taker side not returned/);
});

test("a row without a usable price is not priced rather than counted as zero", () => {
  const t = { count_fp: "5.00", yes_price_dollars: null, no_price_dollars: null, taker_outcome_side: "no" };
  const d = tradeDollars(t);
  assert.equal(d.priced, false);
  assert.equal(d.dollars, null);
});

test("a row without count_fp is not priced", () => {
  const d = tradeDollars({ yes_price_dollars: "0.5", taker_outcome_side: "yes" });
  assert.equal(d.priced, false);
  assert.match(d.reason, /count_fp/);
});

test("folding pages accumulates dollars, contracts, trades and the observed window", () => {
  let acc = emptyTally();
  acc = foldTradesPage(acc, { trades: [
    trade({ count: "10.00", yes: "0.40", side: "yes", at: "2026-11-21T10:00:00Z" }),
    trade({ count: "10.00", yes: "0.40", no: "0.60", side: "no", at: "2026-11-21T12:00:00Z" })
  ] });
  acc = foldTradesPage(acc, { trades: [trade({ count: "2.50", yes: "0.80", side: "yes", at: "2026-11-21T11:00:00Z" })] });
  assert.equal(acc.trades, 3);
  assert.equal(acc.contracts, 22.5);
  assert.equal(acc.dollars, 4 + 6 + 2);
  assert.equal(acc.oldest, "2026-11-21T10:00:00Z");
  assert.equal(acc.newest, "2026-11-21T12:00:00Z");
  assert.equal(acc.missing, 0);
});

test("an unpriced row is counted as missing, not as zero dollars", () => {
  const acc = foldTradesPage(emptyTally(), { trades: [
    trade({ count: "1.00", yes: "0.50" }),
    { count_fp: "1.00", yes_price_dollars: null, taker_outcome_side: "yes" }
  ] });
  assert.equal(acc.trades, 2);
  assert.equal(acc.missing, 1);
  assert.equal(acc.dollars, 0.5);
});

test("AN EMPTY WINDOW IS ZERO, AND COMPLETE", () => {
  const s = summariseTally(emptyTally(), { complete: true, pagesRead: 1 });
  assert.equal(s.dollars, 0);
  assert.equal(s.complete, true);
  assert.equal(s.note, null);
});

test("AN INCOMPLETE READ HAS NO DOLLAR TOTAL AT ALL", () => {
  const acc = foldTradesPage(emptyTally(), { trades: [trade({ count: "10.00", yes: "0.50" })] });
  const s = summariseTally(acc, { complete: false, pagesRead: 1 });
  assert.equal(s.dollars, null);
  assert.equal(s.complete, false);
  assert.match(s.note, /could not be read/);
});

test("a capped page budget also refuses to present a total", () => {
  const s = summariseTally(emptyTally(), { complete: true, capped: true, pagesRead: 3 });
  assert.equal(s.dollars, null);
});

test("a missing-price disclosure survives into the summary", () => {
  const acc = foldTradesPage(emptyTally(), { trades: [
    trade({ count: "1.00", yes: "0.50" }),
    { count_fp: "1.00", yes_price_dollars: null, taker_outcome_side: "yes" }
  ] });
  const s = summariseTally(acc, { complete: true });
  assert.equal(s.dollars, 0.5);
  assert.match(s.note, /1 trade\(s\) carried no usable price/);
});

test("windowQuery emits Unix SECONDS inside the documented bounds", () => {
  const nowMs = Date.UTC(2026, 10, 21, 12, 0, 0);
  const w = windowQuery({ seconds: 3600, nowMs, limit: 5000 });
  assert.equal(w.max_ts, Math.floor(nowMs / 1000));
  assert.equal(w.min_ts, w.max_ts - 3600);
  assert.ok(Number.isInteger(w.min_ts) && Number.isInteger(w.max_ts));
  assert.equal(w.limit, LIMITS.maxLimit, "a limit above 1000 is clamped to the documented maximum");
});

test("windowQuery falls back to 24h and a default page size for nonsense input", () => {
  const nowMs = Date.UTC(2026, 10, 21, 12, 0, 0);
  const w = windowQuery({ seconds: "banana", nowMs, limit: 0 });
  assert.equal(w.seconds, 86400, "a non-numeric window falls back to 24 hours");
  assert.equal(w.limit, LIMITS.defaultLimit, "a falsy page size falls back to the documented default");
  assert.equal(windowQuery({ seconds: -5, nowMs, limit: -3 }).seconds, 86400);
  assert.equal(windowQuery({ seconds: 60, nowMs, limit: 0.4 }).limit, LIMITS.defaultLimit);
});

test("tradesPath encodes the ticker and carries only documented parameters", () => {
  const p = tradesPath("KXAAAGASW-26NOV23-T3.1", { min_ts: 100, max_ts: 200, limit: 1000 });
  assert.ok(p.startsWith("/markets/trades?"));
  const q = new URLSearchParams(p.split("?")[1]);
  assert.deepEqual([...q.keys()].sort(), ["limit", "max_ts", "min_ts", "ticker"]);
  assert.equal(q.get("ticker"), "KXAAAGASW-26NOV23-T3.1");
  assert.equal(q.get("limit"), "1000");
  assert.equal(q.get("min_ts"), "100");
});

test("tradesPath cannot be broken out of by a hostile ticker", () => {
  const p = tradesPath("A&limit=99999", { min_ts: 1, max_ts: 2, limit: 10 });
  const q = new URLSearchParams(p.split("?")[1]);
  assert.equal(q.get("ticker"), "A&limit=99999");
  assert.equal(q.get("limit"), "10");
});

test("collectTrades walks the cursor until the endpoint stops returning one", async () => {
  const pages = [
    { trades: [trade({ count: "10.00", yes: "0.30" })], cursor: "c1" },
    { trades: [trade({ count: "10.00", yes: "0.30" })], cursor: "c2" },
    { trades: [trade({ count: "10.00", yes: "0.30" })], cursor: "" }
  ];
  const seen = [];
  const get = async (path) => { seen.push(path); return pages[seen.length - 1]; };
  const res = await collectTrades(get, "T", { seconds: 3600, maxPages: 5 });
  assert.equal(seen.length, 3);
  assert.match(seen[1], /cursor=c1/);
  assert.match(seen[2], /cursor=c2/);
  assert.equal(res.summary.trades, 3);
  assert.equal(res.summary.dollars, 9);
  assert.equal(res.summary.complete, true);
  assert.equal(res.stopped, null);
});

test("collectTrades reports a page budget that ran out as incomplete, not as a total", async () => {
  const get = async () => ({ trades: [trade({ count: "10.00", yes: "0.30" })], cursor: "more" });
  const res = await collectTrades(get, "T", { seconds: 3600, maxPages: 2 });
  assert.equal(res.stopped, "cap");
  assert.equal(res.summary.complete, false);
  assert.equal(res.summary.dollars, null);
});

test("collectTrades reports a failed request as incomplete and names it", async () => {
  let n = 0;
  const get = async () => {
    n += 1;
    if (n === 1) return { trades: [trade({ count: "10.00", yes: "0.30" })], cursor: "c1" };
    throw new Error("429 too_many_requests");
  };
  const res = await collectTrades(get, "T", { seconds: 3600, maxPages: 4 });
  assert.equal(res.stopped, "error");
  assert.equal(res.summary.dollars, null);
  assert.match(res.summary.note, /could not be read/);
});

test("collectTrades requests the same window on every page", async () => {
  const paths = [];
  const get = async (p) => { paths.push(p); return { trades: [], cursor: paths.length < 2 ? "c" : "" }; };
  await collectTrades(get, "T", { seconds: 60, nowMs: Date.UTC(2026, 0, 1), maxPages: 3 });
  const [a, b] = paths.map(p => new URLSearchParams(p.split("?")[1]));
  assert.equal(a.get("min_ts"), b.get("min_ts"));
  assert.equal(a.get("max_ts"), b.get("max_ts"));
});

test("rankByTradedDollars measures only open markets, highest volume first", async () => {
  const events = [
    { event_ticker: "E1", title: "One", markets: [
      { ticker: "E1-A", status: "open", volume_fp: "10.00" },
      { ticker: "E1-B", status: "open", volume_fp: "100.00" },
      { ticker: "E1-C", status: "settled", volume_fp: "999.00" }
    ] },
    { event_ticker: "E2", title: "Two", markets: [
      { ticker: "E2-A", status: "active", volume_fp: "50.00" }
    ] }
  ];
  const asked = [];
  const get = async (path) => {
    const t = new URLSearchParams(path.split("?")[1]).get("ticker");
    asked.push(t);
    return { trades: [trade({ ticker: t, count: "10.00", yes: "0.50" })], cursor: "" };
  };
  const res = await rankByTradedDollars(get, events, { maxMarkets: 3, seconds: 3600 });
  assert.deepEqual(asked, ["E1-B", "E2-A", "E1-A"], "settled markets are never measured");
  assert.equal(res.totalMarkets, 3);
  assert.equal(res.measured, 3);
  assert.equal(res.rows.length, 2);
  assert.equal(res.rows[0].event.event_ticker, "E1");
  assert.equal(res.rows[0].dollars, 10, "two markets at $5 each");
});

test("rankByTradedDollars discloses the markets it did not measure", async () => {
  const events = [{ event_ticker: "E", markets: [
    { ticker: "A", status: "open", volume_fp: "3" },
    { ticker: "B", status: "open", volume_fp: "2" },
    { ticker: "C", status: "open", volume_fp: "1" }
  ] }];
  const get = async () => ({ trades: [], cursor: "" });
  const res = await rankByTradedDollars(get, events, { maxMarkets: 2 });
  assert.equal(res.measured, 2);
  assert.equal(res.skippedMarkets, 1);
  assert.equal(res.totalMarkets, 3);
});

test("an event with a failed market read is left without a dollar figure", async () => {
  const events = [{ event_ticker: "E", markets: [
    { ticker: "A", status: "open", volume_fp: "3" },
    { ticker: "B", status: "open", volume_fp: "2" }
  ] }];
  const get = async (path) => {
    if (path.includes("ticker=B")) throw new Error("network down");
    return { trades: [trade({ count: "10.00", yes: "0.50" })], cursor: "" };
  };
  const res = await rankByTradedDollars(get, events, { maxMarkets: 5 });
  assert.equal(res.failed, 1);
  assert.equal(res.rows[0].complete, false);
  assert.equal(res.rows[0].dollars, null, "a partially measured event gets no total");
});

test("rankByTradedDollars counts the HTTP requests it spends", async () => {
  const events = [{ event_ticker: "E", markets: [
    { ticker: "A", status: "open", volume_fp: "2" },
    { ticker: "B", status: "open", volume_fp: "1" }
  ] }];
  let calls = 0;
  const get = async () => { calls += 1; return { trades: [], cursor: "" }; };
  const res = await rankByTradedDollars(get, events, { maxMarkets: 5 });
  assert.equal(res.requests, calls);
  assert.equal(res.requests, 2);
});

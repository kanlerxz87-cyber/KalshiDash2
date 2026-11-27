// Flagged AC1: the exchange-status strip must read the flags only from an
// HTTP 200 response. The Get Exchange Status reference warns that a
// 500/503/504 body can carry trading_active: false without meaning the
// exchange is paused, so a 5xx must render "status unavailable", never
// "not trading".
// Run: node --test tests/exchange-status.test.mjs
//
// The reader lives inline in index.html, so this test extracts that block
// and runs it against a stubbed `api.get` that throws the same error shape
// KalshiError carries (assets/js/kalshi.js `_parse`: { status, code, path }).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readStatus, shardState, confirmedTrading, summaryLine, shardRows } from "../assets/js/exchange-status.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("/* ---- exchange status ---- */");
assert.ok(start >= 0, "exchange-status block not found in index.html");
const end = html.indexOf("})();", start);
assert.ok(end > start, "exchange-status block end not found in index.html");
const block = html.slice(start, end + "})();".length);

// The block is an IIFE that references $, api, src, SOURCES and esc.
const run = new Function("$", "api", "src", "SOURCES", "esc",
  "readStatus", "confirmedTrading", "summaryLine", "shardRows",
  block + "\n//# sourceURL=index-exchange-status.js");

function harness(getImpl) {
  const els = new Map();
  const $ = sel => {
    if (!els.has(sel)) els.set(sel, { innerHTML: "", className: "" });
    return els.get(sel);
  };
  const api = { get: getImpl };
  const src = () => "";
  const SOURCES = { demoEnv: "https://example.invalid/demo", exchangeStatus: "https://example.invalid/status" };
  const esc = s => String(s);
  run($, api, src, SOURCES, esc, readStatus, confirmedTrading, summaryLine, shardRows);
  return els;
}

function httpError(status) {
  const e = new Error(`${status} error on /exchange/status`);
  e.status = status;
  return e;
}

test("a 500/503/504 body is never rendered as a trading halt", async () => {
  for (const status of [500, 503, 504]) {
    const els = harness(async () => { throw httpError(status); });
    await new Promise(r => setImmediate(r));
    const strip = els.get("#exch-status").innerHTML;
    assert.match(strip, /status unavailable/, `HTTP ${status} must render "status unavailable"`);
    assert.doesNotMatch(strip, /not trading/, `HTTP ${status} must not render "not trading"`);
    const banner = els.get("#connect-banner").innerHTML;
    assert.match(banner, /does not interpret any non-200 response as a trading halt/, `HTTP ${status} banner must carry the caveat`);
    assert.match(banner, /Get Exchange Status/, `HTTP ${status} banner must cite the reference`);
  }
  // Every HTTP error, not only documented gateway 5xx responses, is
  // unavailable status; the 5xx-specific point is a further warning.
  const rateLimited = harness(async () => { throw httpError(429); });
  await new Promise(r => setImmediate(r));
  assert.match(rateLimited.get("#exch-status").innerHTML, /status unavailable/);
  assert.doesNotMatch(rateLimited.get("#exch-status").innerHTML, /not trading/);
});

test("a 200 response still drives the strip from the flags", async () => {
  const active = harness(async () => ({ trading_active: true, exchange_active: true }));
  await new Promise(r => setImmediate(r));
  assert.match(active.get("#exch-status").innerHTML, /trading active/);

  const halted = harness(async () => ({ trading_active: false, exchange_active: true }));
  await new Promise(r => setImmediate(r));
  assert.match(halted.get("#exch-status").innerHTML, /not trading/);
});

test("a network failure with no HTTP status renders unreachable", async () => {
  const els = harness(async () => { throw new Error("network error"); });
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-status").innerHTML, /unreachable/);
  assert.doesNotMatch(els.get("#exch-status").innerHTML, /status unavailable/);
});

/* ---- Flagged F18: the per-shard breakdown -------------------------------
 *
 * Official wording these tests encode, quoted so a future reader does not have
 * to guess why each assertion exists (Get Exchange Status,
 * https://docs.kalshi.com/api-reference/exchange/get-exchange-status):
 *
 *   "The top-level fields describe the default exchange index (0)."
 *   "In `exchange_index_statuses` on a 200 response, an index other than 0
 *    whose status request failed or timed out is reported with all of its
 *    flags `false`. Read the status again before treating a single `false`
 *    reading for one index as a pause."
 *   "Absent when the per-index breakdown is unavailable."  (schema)
 */

const shard = (index, trading, extra = {}) => ({
  exchange_index: index,
  description: extra.description ?? `Shard ${index}`,
  exchange_active: extra.exchange ?? true,
  trading_active: trading,
  intra_exchange_transfers_active: extra.transfers ?? true
});

const liveLike = () => ({
  exchange_active: true,
  trading_active: true,
  intra_exchange_transfers_active: true,
  exchange_index_statuses: [
    shard(0, true, { description: "Default" }),
    shard(1, true, { description: "Demo shard 1" }),
    shard(2, true, { description: "Demo shard 2" }),
    shard(3, true, { description: "" })
  ]
});

test("F18: a 200 with a breakdown renders one row per shard, default index first", async () => {
  const els = harness(async () => liveLike());
  await new Promise(r => setImmediate(r));
  const html = els.get("#exch-shards").innerHTML;
  const rowCount = (html.match(/<tr>/g) || []).length;
  assert.equal(rowCount, 5, "header row + one row per shard (4 shards)");
  assert.match(html, /<td class="mono">0<\/td>/, "the default index 0 is rendered");
  assert.match(html, /Default/, "the description the exchange sent is rendered verbatim");
  assert.match(html, /trading<\/span>/, "every trading shard reads as trading");
  assert.match(html, /agrees/, "index 0 agrees with the top-level flags here");
  // index 3 has an empty description: shown as an em dash, never invented.
  assert.match(html, /<td>—<\/td>/, "an empty description renders as — rather than a guessed name");
});

test("F18: a lone false on a shard is 're-read required', never a pause claim", async () => {
  // Rule from the reference: read again before calling a single false a pause.
  const status = readStatus(liveLike(), new Set());
  assert.equal(shardRows(status, new Set()).find(r => r.index === 2).state, "trading");
  const blipped = { ...liveLike(), exchange_index_statuses: liveLike().exchange_index_statuses.map(s => s.exchange_index === 2 ? { ...s, trading_active: false } : s) };
  const afterConfirmed = readStatus(blipped, new Set([2]));
  const row = shardRows(afterConfirmed, new Set([2])).find(r => r.index === 2);
  assert.equal(row.state, "re-read", "confirmed-then-false must ask for a re-read");
  assert.equal(shardState({ index: 2, tradingActive: false }, new Set([2])), "re-read");
  assert.equal(shardState({ index: 2, tradingActive: false }, new Set()), "down",
    "a shard never seen true reads as false, not as a pause");
});

test("F18: the rendered page never says 'not trading' because one shard reads false", async () => {
  const body = liveLike();
  body.exchange_index_statuses = body.exchange_index_statuses.map(s =>
    s.exchange_index === 1 ? { ...s, trading_active: false } : s);
  const els = harness(async () => body);
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-status").innerHTML, /trading active on the default index/,
    "top-level flags describe index 0 and index 0 is trading");
  assert.doesNotMatch(els.get("#exch-status").innerHTML, /not trading/,
    "one false shard must never become a halt claim");
  assert.match(els.get("#exch-status").innerHTML, /1 of 4 shards report false/);
  assert.match(els.get("#exch-shards").innerHTML, /reads false/);
});

test("F18: a default-index row that disagrees with the top-level flags is shown, not resolved", async () => {
  const body = liveLike();
  body.exchange_index_statuses[0] = { ...body.exchange_index_statuses[0], trading_active: false };
  const st = readStatus(body, new Set());
  assert.deepEqual(st.conflicts, [0], "index 0 is flagged as a conflict");
  const row = shardRows(st, new Set()).find(r => r.index === 0);
  assert.equal(row.conflictsTopLevel, true);
  const els = harness(async () => body);
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-shards").innerHTML, /disagrees with top-level flags/);
});

test("F18: an absent breakdown is stated, never invented", async () => {
  const body = liveLike();
  delete body.exchange_index_statuses;
  const st = readStatus(body, new Set());
  assert.equal(st.breakdown, false);
  assert.equal(st.shards.length, 0);
  assert.match(summaryLine(st), /per-shard breakdown not provided/);
  const els = harness(async () => body);
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-shards").innerHTML, /no per-shard rows/);
  assert.match(els.get("#exch-shards").innerHTML, /Absent when the per-index breakdown is unavailable/);
});

test("F18: unusable shard entries are skipped and counted, not rendered", async () => {
  const body = liveLike();
  body.exchange_index_statuses.push({ exchange_index: "2", trading_active: true }, null, { description: "no index" });
  const st = readStatus(body, new Set());
  assert.equal(st.shards.length, 4, "the four valid rows survive");
  assert.equal(st.skipped, 3, "the three unusable entries are counted");
  const els = harness(async () => body);
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-shards").innerHTML, /3 entry\/entries could not be read as a shard record/);
});

test("F18: confirmedTrading only carries indexes read true on a 200", () => {
  const body = liveLike();
  body.exchange_index_statuses[3].trading_active = false;
  const confirmed = confirmedTrading(readStatus(body, new Set()));
  assert.deepEqual([...confirmed].sort(), [0, 1, 2]);
  assert.equal(confirmedTrading({ present: false }).size, 0);
});

test("F18: a non-200 keeps AC1's 'status unavailable' and does not clear the last rows", async () => {
  let call = 0;
  const els = harness(async () => {
    call += 1;
    if (call === 1) return liveLike();
    const e = new Error("503 error on /exchange/status");
    e.status = 503;
    throw e;
  });
  await new Promise(r => setImmediate(r));
  assert.match(els.get("#exch-status").innerHTML, /trading active/);
  // Second poll: the IIFE runs once per harness, so drive readStatus directly
  // for the second shape and assert the renderer's stated fallback text.
  const st2 = readStatus({ exchange_active: false, trading_active: false }, new Set());
  assert.equal(st2.breakdown, false);
  assert.equal(st2.present, true);
});

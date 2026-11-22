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

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("/* ---- exchange status ---- */");
assert.ok(start >= 0, "exchange-status block not found in index.html");
const end = html.indexOf("})();", start);
assert.ok(end > start, "exchange-status block end not found in index.html");
const block = html.slice(start, end + "})();".length);

// The block is an IIFE that references $, api, src, SOURCES and esc.
const run = new Function("$", "api", "src", "SOURCES", "esc", block);

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
  run($, api, src, SOURCES, esc);
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

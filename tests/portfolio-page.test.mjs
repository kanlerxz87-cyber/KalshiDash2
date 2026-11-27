// Execute the actual published page controller, with its real formatters and
// portfolio helper. Only the DOM, API and storage boundaries are fixtures.
// No key is requested, no exchange request is made, no order is placed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ui from "../assets/js/ui.js";
import { SOURCES } from "../assets/js/config.js";
import { snapToGrid } from "../assets/js/kalshi.js";
import * as portfolio from "../assets/js/portfolio-core.js";

const html = readFileSync(new URL("../portfolio.html", import.meta.url), "utf8");
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/^import\s+.*?;\s*$/gm, "");
const position = (ticker = "KXTEST-1") => ({
  ticker, position_fp: "0.25", market_exposure_dollars: "2.5000",
  realized_pnl_dollars: "-1.2500", fees_paid_dollars: "0.1250", total_traded_dollars: "10.0000"
});

function fixture() {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => ["#" + m[1], {
    innerHTML: "", value: "", addEventListener() {}
  }]));
  const $ = selector => {
    assert.ok(elements.has(selector), `the real HTML has no ${selector}`);
    return elements.get(selector);
  };
  const state = {
    credentials: true, calls: [], confirmations: [],
    balance: async () => ({ balance_dollars: "12.5000", portfolio_value: 250, updated_ts: 1795334400 }),
    positions: async () => ({ market_positions: [position()], cursor: "" }),
    fills: async () => ({ fills: [], cursor: "" })
  };
  const api = {
    hasCredentials: () => state.credentials,
    setCredentials: () => { state.credentials = true; },
    clearCredentials: () => { state.credentials = false; },
    keyIdHint: () => "fixture",
    balance: async () => { state.calls.push("balance"); return state.balance(); },
    positions: async query => { state.calls.push(query); return state.positions(query); },
    fills: async () => { state.calls.push("fills"); return state.fills(); },
    createOrder: () => { throw new Error("unexpected order write in offline test"); }
  };
  const storage = new Map();
  const context = vm.createContext({
    ...ui, ...portfolio, SOURCES, snapToGrid, api, $, mountChrome() {}, window: {},
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    confirm: message => { state.confirmations.push(message); return false; },
    prompt: () => { throw new Error("unexpected prompt"); }
  });
  vm.runInContext(source, context, { filename: "portfolio.html:inline-module" });
  return { $, state, load: () => $("#load-account").onclick() };
}
const unavailable = value => (value.match(/>n\/a<\/span>/g) || []).length;

test("a complete response renders documented dollars, fractional positions and sources", async () => {
  const f = fixture();
  await f.load();
  assert.match(f.$("#pos-body").innerHTML, />0\.25<\/td>/);
  assert.match(f.$("#pos-body").innerHTML, /\$2\.50/);
  assert.match(f.$("#pos-body").innerHTML, /\$-1\.25/);
  assert.match(f.$("#pos-body").innerHTML, /\$0\.13/);
  assert.match(f.$("#pos-body").innerHTML, new RegExp(SOURCES.positions));
  assert.equal((f.$("#pos-body").innerHTML.match(/<td\b/g) || []).length, 6);
  assert.match(f.$("#perf-note").innerHTML, /Not lifetime account performance/);
  assert.match(f.$("#perf-note").innerHTML, /Paging exhausted/);
  assert.match(f.$("#acct-status").innerHTML, /account loaded/);
});

test("missing dollar fields do not fall back to undocumented cents or display $0.00", async () => {
  const f = fixture();
  f.state.positions = async () => ({ market_positions: [{
    ticker: "KXTEST", position_fp: "0.25", market_exposure: 100, realized_pnl: 100, fees_paid: 100
  }], cursor: "" });
  await f.load();
  assert.equal(unavailable(f.$("#pos-body").innerHTML), 3);
  assert.equal(unavailable(f.$("#perf-stats").innerHTML), 4);
  assert.doesNotMatch(f.$("#pos-body").innerHTML, /\$0\.00|\$1\.00/);
});

test("one missing fee suppresses the aggregate fee total instead of showing a partial total", async () => {
  const f = fixture();
  f.state.positions = async () => ({ market_positions: [position(), {
    ...position("KXTEST-2"), fees_paid_dollars: null
  }], cursor: "" });
  await f.load();
  assert.equal(unavailable(f.$("#perf-stats").innerHTML), 1);
  assert.match(f.$("#perf-stats").innerHTML, /\$5\.00/);
  assert.match(f.$("#perf-note").innerHTML, /fees 1/);
});

test("page-cap exhaustion is visible and all totals are withheld", async () => {
  const f = fixture();
  let calls = 0;
  f.state.positions = async () => ({ market_positions: [position(`KXTEST-${++calls}`)], cursor: `page-${calls}` });
  await f.load();
  assert.equal(calls, 5);
  assert.equal(unavailable(f.$("#perf-stats").innerHTML), 4);
  assert.match(f.$("#perf-note").innerHTML, /Incomplete scan: page cap reached/);
  assert.match(f.$("#acct-status").innerHTML, /incomplete/);
});

test("a failed positions reload clears old totals and does not invent a zero count", async () => {
  const f = fixture();
  await f.load();
  f.state.positions = async () => { throw new Error("429 <unavailable>"); };
  await f.load();
  assert.equal(f.$("#perf-stats").innerHTML, "");
  assert.equal(f.$("#perf-note").innerHTML, "");
  assert.equal(unavailable(f.$("#acct-stats").innerHTML), 1);
  assert.match(f.$("#acct-stats").innerHTML, /\$12\.50/);
  assert.match(f.$("#pos-body").innerHTML, /Positions unavailable: 429 &lt;unavailable&gt;/);
  assert.doesNotMatch(f.$("#pos-body").innerHTML, /no open|no unsettled|<unavailable>/i);
  assert.match(f.$("#acct-status").innerHTML, /positions unavailable/);
});

test("malformed position payloads are unavailable, not an empty verified account", async () => {
  const f = fixture();
  f.state.positions = async () => ({});
  await f.load();
  assert.match(f.$("#pos-body").innerHTML, /coverage is unverified/);
  assert.equal(unavailable(f.$("#acct-stats").innerHTML), 1);
});

test("a verified empty result is labelled no unsettled records, not no open markets", async () => {
  const f = fixture();
  f.state.positions = async () => ({ market_positions: [], cursor: "" });
  await f.load();
  assert.match(f.$("#pos-body").innerHTML, /no unsettled position records/);
  assert.doesNotMatch(f.$("#pos-body").innerHTML, /open positions/);
  assert.match(f.$("#perf-note").innerHTML, /0 unsettled row/);
});

test("a balance failure does not leave the page looking loaded or empty-verified", async () => {
  const f = fixture();
  f.state.balance = async () => { throw new Error("401 unauthorized"); };
  await f.load();
  assert.equal(f.$("#acct-stats").innerHTML, "");
  assert.equal(f.$("#perf-stats").innerHTML, "");
  assert.match(f.$("#pos-body").innerHTML, /Account request failed/);
  assert.deepEqual(f.state.calls, ["balance"]);
});

test("without credentials an account load makes no request", async () => {
  const f = fixture();
  f.state.credentials = false;
  await f.load();
  assert.deepEqual(f.state.calls, []);
  assert.match(f.$("#acct-status").innerHTML, /load a demo key first/);
});

test("forgetting the key clears the new account panels and blocks a late response", async () => {
  const f = fixture();
  await f.load();
  let resolveBalance;
  f.state.balance = () => new Promise(resolve => { resolveBalance = resolve; });
  const pending = f.load();
  f.$("#clear-key").onclick();
  resolveBalance({ balance_dollars: "999.00" });
  await pending;
  assert.equal(f.$("#acct-stats").innerHTML, "");
  assert.equal(f.$("#perf-stats").innerHTML, "");
  assert.equal(f.$("#perf-note").innerHTML, "");
  assert.match(f.$("#pos-body").innerHTML, /No positions loaded/);
  assert.equal(f.state.credentials, false);
});

test("fill quantities retain their documented fixed-point fraction and dollar fees", async () => {
  const f = fixture();
  f.state.fills = async () => ({ fills: [{
    ticker: "KXTEST-1", count_fp: "1.25", outcome_side: "yes", is_taker: true,
    yes_price_dollars: "0.50", no_price_dollars: "0.50", fee_cost: "0.12"
  }], cursor: "" });
  await f.load();
  assert.match(f.$("#fills-body").innerHTML, />1\.25<\/td>/);
  assert.match(f.$("#fills-body").innerHTML, /\$0\.12/);
  assert.equal((f.$("#fills-body").innerHTML.match(/<td\b/g) || []).length, 9);
});

test("a NO order states the YES-leg request price and the complement cost, and never claims a receipt", async () => {
  /* Flagged F20 (2026-11-27) settled NF1 from documentation: the Create Order V2
   * BookSide schema says the request price is the YES leg ("this endpoint quotes
   * everything from the YES side"), while the order-direction page says the
   * matching price is the same on both sides. So the entered price is sent
   * unchanged and the NO cost (1 - price) is stated, never sent. This test pins
   * both halves: the scale is named, and the order still cannot be submitted
   * without an explicit confirmation (it is declined here). */
  assert.match(html, /id="no-price-conflict"/);
  assert.match(html, /flagged\.html#NF1/);
  assert.match(html, /flagged\.html#F20/, "the resolving card is linked");
  assert.match(html, /flagged\.html#P130/, "unverified account coverage is linked before loading a key");
  assert.match(html, /reports\/verify-130acb78\.md/);
  assert.doesNotMatch(html, /NO-order price scale is unverified/,
    "the site must not still call the scale unverified after F20");
  const f = fixture();
  f.$("#o-ticker").value = "KXTEST-1";
  f.$("#o-side").value = "no";
  f.$("#o-price").value = "0.63";
  f.$("#o-count").value = "1";
  await f.$("#place").onclick();
  assert.match(f.state.confirmations[0], /YES-leg price/);
  assert.match(f.state.confirmations[0], /request price \$0\.6300/);
  assert.match(f.state.confirmations[0], /NO position costs 1 − price = \$0\.3700/);
  assert.deepEqual(f.state.calls, [], "confirmation declined: no order or account requests");
});

test("forgetting the key also clears fills/order panels and blocks a late fills response", async () => {
  const f = fixture();
  f.state.fills = async () => ({ fills: [{
    ticker: "KXTEST-1", count_fp: "2.00", outcome_side: "yes", is_taker: true,
    yes_price_dollars: "0.45", no_price_dollars: "0.55", fee_cost: "0.02"
  }], cursor: "" });
  await f.load();
  assert.match(f.$("#fills-body").innerHTML, /KXTEST-1/);
  f.$("#order-result").innerHTML = "<div>previous receipt</div>";

  let resolveFills;
  f.state.fills = () => new Promise(resolve => { resolveFills = resolve; });
  const pendingFills = f.$("#reload-fills").onclick();
  f.$("#clear-key").onclick();
  resolveFills({ fills: [{ ticker: "KXTEST-LATE", count_fp: "1.00", outcome_side: "yes", yes_price_dollars: "0.50", fee_cost: "0.01" }] });
  await pendingFills;

  assert.match(f.$("#fills-body").innerHTML, /No fills loaded/);
  assert.doesNotMatch(f.$("#fills-body").innerHTML, /KXTEST-1|KXTEST-LATE/);
  assert.equal(f.$("#order-result").innerHTML, "");
  assert.match(f.$("#fills-status").innerHTML, /idle/);
  assert.match(f.$("#order-status").innerHTML, /idle/);
});

test("fills CSV export outputs documented Get Fills fields and Forget key clears fills state", async () => {
  const f = fixture();
  f.state.fills = async () => ({
    fills: [{
      created_time: "2026-11-27T15:00:00Z",
      ticker: "KXTEST-1",
      market_ticker: "KXTEST-1",
      outcome_side: "no",
      book_side: "ask",
      count_fp: "1.50",
      yes_price_dollars: "0.8500",
      no_price_dollars: "0.1500",
      is_taker: false,
      fee_cost: "0.0100"
    }],
    cursor: ""
  });
  await f.load();
  assert.equal(f.$("#export-fills-csv").disabled, false);
  const csv = f.$("#export-fills-csv").onclick();
  assert.match(csv, /^created_time,ticker,market_ticker,outcome_side,book_side,count_fp,yes_price_dollars,no_price_dollars,is_taker,fee_cost\n/);
  assert.match(csv, /2026-11-27T15:00:00Z,KXTEST-1,KXTEST-1,no,ask,1\.50,0\.8500,0\.1500,false,0\.0100/);

  f.$("#clear-key").onclick();
  assert.equal(f.$("#export-fills-csv").disabled, true);
  assert.equal(f.$("#export-fills-csv").onclick(), "");
  assert.match(f.$("#fills-body").innerHTML, /No fills loaded\./);
});

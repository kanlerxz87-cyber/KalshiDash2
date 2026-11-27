// DOM end-to-end check for the category pages: bundles the real page controller
// (assets/js/category.js) with esbuild, runs it in jsdom against scripted
// Kalshi-shaped responses, and asserts the four things a trader reads there:
//
//   1. the live board (event discovered from GET /events, ranked, linked)
//   2. the price chart (official candles, >$0.10 jump markers, settlement sources)
//   3. the liquidity table (literal bid price AND the implied YES ask = 1 − NO bid,
//      so "how many contracts are available at a given price" is answerable)
//   4. the long-window X-axis labels carry a date (7-day view)
//
// Responses are fixtures, not recorded output: the shapes come from
// https://docs.kalshi.com/api-reference/market/get-market-candlesticks and
// https://docs.kalshi.com/getting_started/orderbook_responses. Live shapes are
// checked separately by the GitHub-runner workflows.
//
// Run: cd tests/dom && npm ci && node category-dom.mjs
import { JSDOM, VirtualConsole } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import assert from "node:assert/strict";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const BASE = "https://external-api.demo.kalshi.co/trade-api/v2";
const PAGE = "crypto";
const TOPIC_LABEL = "Crypto";

const strip = html => html.replace(/<script type="module" src="[^"]*"><\/script>/, "");
const html = strip(fs.readFileSync(`${REPO}/categories/${PAGE}.html`, "utf8"));
const bundle = (await esbuild.build({
  entryPoints: [`${REPO}/assets/js/category.js`],
  bundle: true, format: "iife", write: false, platform: "browser"
})).outputFiles[0].text;

/* ------------------------------------------------------------------ fixtures */

const NOW_S = Math.floor(Date.now() / 1000);

const mkMarket = (ticker, { last, bid, ask, oi, vol }) => ({
  ticker,
  event_ticker: "KXBTC-EV",
  title: `Bitcoin ${ticker} fixture`,
  status: "active",
  last_price_dollars: last,
  yes_bid_dollars: bid,
  yes_ask_dollars: ask,
  no_bid_dollars: String(Math.round((1 - Number(ask)) * 1e4) / 1e4),
  no_ask_dollars: String(Math.round((1 - Number(bid)) * 1e4) / 1e4),
  open_interest_fp: oi,
  volume_fp: vol,
  volume_24h_fp: "40.00",
  result: "",
  close_time: "2026-12-31T23:59:59Z",
  price_ranges: [{ start: "0.0100", end: "0.9900", step: "0.0100" }]
});

const MARKETS = [
  mkMarket("KXBTC-1", { last: "0.5200", bid: "0.5100", ask: "0.5300", oi: "2000.00", vol: "5000.00" }),
  mkMarket("KXBTC-2", { last: "0.3000", bid: "0.2900", ask: "0.3100", oi: "120.00", vol: "800.00" })
];

const EVENT = {
  event_ticker: "KXBTC-EV",
  series_ticker: "KXBTC",
  title: "Bitcoin above $100k this month",
  category: "Crypto",
  markets: MARKETS
};

/* One-minute candles for the 1-hour window. Every candle carries its own
 * price.previous_dollars; exactly one of them closes $0.10 above it. */
function minuteCandles() {
  const out = [];
  const n = 60;
  for (let i = 0; i < n; i++) {
    const close = i === 30 ? 0.52 : 0.42;
    const prev = i === 30 ? 0.42 : close;
    out.push({
      end_period_ts: NOW_S - (n - 1 - i) * 60,
      price: {
        open_dollars: prev.toFixed(4),
        close_dollars: close.toFixed(4),
        high_dollars: Math.max(prev, close).toFixed(4),
        low_dollars: Math.min(prev, close).toFixed(4),
        mean_dollars: close.toFixed(4),
        previous_dollars: prev.toFixed(4)
      },
      yes_bid: { close_dollars: "0.4100" },
      yes_ask: { close_dollars: "0.4300" },
      volume_fp: "10.00",
      open_interest_fp: "100.00"
    });
  }
  return out;
}

/* Eight hourly candles across seven days, for the long-window label check. */
function weeklyCandles() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const close = 0.40 + i * 0.01;
    out.push({
      end_period_ts: NOW_S - (7 - i) * 86400,
      price: {
        open_dollars: close.toFixed(4), close_dollars: close.toFixed(4),
        high_dollars: (close + 0.01).toFixed(4), low_dollars: (close - 0.01).toFixed(4),
        mean_dollars: close.toFixed(4), previous_dollars: close.toFixed(4)
      },
      volume_fp: "1.00", open_interest_fp: "1.00"
    });
  }
  return out;
}

/* Which market's trades request should fail, for the n/a assertion below. */
let tradesFailure = null;
/* Whether the orderbook request should fail, for the 6-column error-row check. */
let bookFailure = false;

const ORDERBOOK = {
  orderbook_fp: {
    yes_dollars: [["0.5000", "10.00"], ["0.5100", "25.00"]],
    no_dollars: [["0.4600", "40.00"], ["0.4700", "15.00"]]
  }
};

/* -------------------------------------------------------------------- fetch */

const requests = [];
const reply = (status, body) => ({
  ok: status < 400, status, statusText: String(status),
  text: async () => JSON.stringify(body)
});

async function mockFetch(url) {
  const u = new URL(url);
  const path = u.pathname.replace("/trade-api/v2", "");
  requests.push(path + (u.search || ""));
  if (!url.startsWith(BASE)) return reply(404, { error: { code: "not_mocked", url } });

  if (path === "/events") {
    assert.equal(u.searchParams.get("status"), "open");
    assert.equal(u.searchParams.get("with_nested_markets"), "true");
    return reply(200, { events: [EVENT], cursor: "" });
  }
  if (path === "/events/KXBTC-EV") {
    return reply(200, {
      event: {
        ...EVENT,
        settlement_sources: [
          { name: "Fixture settlement source", url: "https://example.org/btc-fixing" },
          { name: "Name-only filing reference", url: "" },
          { name: "Unsafe scheme entry", url: "javascript:alert(1)" }
        ]
      }
    });
  }
  if (path.startsWith("/series/KXBTC/markets/") && path.endsWith("/candlesticks")) {
    const interval = Number(u.searchParams.get("period_interval"));
    assert.ok([1, 60].includes(interval), `documented period_interval, got ${interval}`);
    assert.ok(Number(u.searchParams.get("start_ts")) < Number(u.searchParams.get("end_ts")));
    return reply(200, {
      ticker: "KXBTC-1",
      candlesticks: interval === 1 ? minuteCandles() : weeklyCandles()
    });
  }
  if (path === "/markets/trades") {
    const ticker = u.searchParams.get("ticker");
    assert.ok(u.searchParams.get("min_ts") && u.searchParams.get("max_ts"),
      "the trades request carries a documented min_ts/max_ts window");
    assert.equal(u.searchParams.get("limit"), "1000");
    if (ticker === tradesFailure) return reply(500, { error: { code: "fixture_failure" } });
    const yes = ticker === "KXBTC-2" ? "0.30" : "0.50";
    return reply(200, {
      trades: [{
        trade_id: "t-" + ticker,
        ticker,
        count_fp: "10.00",
        yes_price_dollars: yes,
        no_price_dollars: (1 - Number(yes)).toFixed(4),
        taker_outcome_side: "yes",
        taker_book_side: "bid",
        created_time: new Date((NOW_S - 60) * 1000).toISOString(),
        is_block_trade: false
      }],
      cursor: ""
    });
  }
  if (path === "/markets/KXBTC-1/orderbook") {
    assert.equal(u.searchParams.get("depth"), "20");
    if (bookFailure) return reply(500, { error: { code: "fixture_book_failure" } });
    return reply(200, ORDERBOOK);
  }
  return reply(404, { error: { code: "not_mocked", path } });
}

/* ---------------------------------------------------------------- jsdom run */

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", e => errors.push(String(e && (e.message || e))));
vc.on("error", e => errors.push(String(e)));

const dom = new JSDOM(html, {
  url: `https://kanlerxz87-cyber.github.io/KalshiDash2/categories/${PAGE}.html`,
  runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc
});
const w = dom.window;

/* jsdom has no canvas implementation. A recording no-op 2D context is enough:
 * the renderer only needs its calls not to throw, and the test wants the text
 * it drew (axis labels, last-price bubble). */
let drawnText = [];
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === "measureText") return s => ({ width: String(s).length * 6 });
    if (prop === "fillText") return (s) => drawnText.push(String(s));
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) { target[prop] = value; return true; }
});
w.HTMLCanvasElement.prototype.getContext = () => ctx;

w.fetch = mockFetch;
w.eval(bundle);

const $ = s => w.document.querySelector(s);
const $$ = s => [...w.document.querySelectorAll(s)];
const text = s => ($(s)?.textContent || "").replace(/\s+/g, " ").trim();

async function until(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (fn()) return true; } catch { /* keep waiting */ }
    await new Promise(r => setTimeout(r, 10));
  }
  return false;
}

const results = [];
function check(name, fn) {
  try { fn(); results.push([`PASS  ${name}`]); }
  catch (e) { results.push([`FAIL  ${name}\n        ${e.message}`]); }
}

/* 1. board */
await until(() => $$("#board-body tr").length === 1 && text("#board-body").includes("KXBTC-EV"));
check("the board renders the one event the mocked scan returned", () => {
  const rows = $$("#board-body tr");
  assert.equal(rows.length, 1);
  assert.match(text("#board-body"), /Bitcoin above \$100k this month/);
  assert.match(text("#board-body"), /KXBTC-EV/);
});
check("the board states the scan it performed instead of a hard-coded count", () => {
  assert.match(text("#topic-caveat"), /read 1 open event/);
  assert.match(text("#topic-caveat"), /matched 1 to Crypto/);
});
check("the topic title and note are filled from the taxonomy, not from a fetch", () => {
  assert.equal(text("#topic-title"), TOPIC_LABEL);
  assert.match(text("#topic-note"), /Matched on Kalshi category `Crypto`/);
});

/* 2. chart + jumps */
await until(() => text("#chart-jumps").includes("move(s) of $0.10"));
check("the chart drew its Y-axis in dollars and a contract price label", () => {
  assert.ok(drawnText.length > 5, "the renderer drew text");
  assert.ok(drawnText.some(t => /^\$0\.\d\d$/.test(t)), "dollar Y-axis ticks present");
  assert.ok(drawnText.some(t => t === "$0.42"), "last-price bubble present (last candle closes 0.42)");
});
check("the chart reports priced periods from the official candle response", () => {
  assert.match(text("#chart-status"), /60 priced periods/);
});
check("exactly one ≥$0.10 jump is listed, with both endpoints", () => {
  const rows = $$("#chart-jumps tbody tr");
  assert.equal(rows.length, 1);
  const cells = [...rows[0].cells].map(c => c.textContent.trim());
  assert.equal(cells[1], "$0.42");
  assert.equal(cells[2], "$0.52");
  assert.equal(cells[3], "+0.10");
});
check("the jump is linked to the official candle endpoint and the event's settlement source", () => {
  assert.match($("#chart-jumps").innerHTML, /candlesticks/);
  assert.match(text("#chart-jumps"), /Fixture settlement source/);
  const link = $("#chart-jumps a[href='https://example.org/btc-fixing']");
  assert.ok(link, "settlement source is a link, not prose");
  assert.match(text("#chart-jumps"), /Name-only filing reference/);
  assert.equal($$("#chart-sources a[href='']").length, 0, "name-only source must not emit an empty href link");
  assert.equal($$("#chart-sources a[href^='javascript:']").length, 0, "non-http(s) settlement source URL must not become a link");
});
check("chart labels are framed as data, not as a cause", () => {
  assert.ok(!/caused by/i.test($("#chart-jumps").textContent));
});

/* 3. liquidity */
await until(() => $$("#no-book tr").length === 2 && text("#book-status").includes("live"));
check("both sides of the book are drawn from orderbook_fp", () => {
  assert.equal($$("#yes-book tr").length, 2);
  assert.equal($$("#no-book tr").length, 2);
  assert.match(text("#book-status"), /4 levels/);
});
check("each book row has six cells, matching the published header", () => {
  for (const sel of ["#yes-book", "#no-book"]) {
    const header = $$(`#${sel.replace("#", "")}`)[0].closest("table").querySelectorAll("thead th");
    assert.equal(header.length, 6, `${sel} header has six columns`);
    for (const row of $$(`${sel} tr`)) assert.equal(row.cells.length, 6, `${sel} row has six cells`);
  }
});
check("the NO-bid table shows the literal NO price AND the implied YES ask (1 − price)", () => {
  const rows = $$("#no-book tr").map(r => [...r.cells].map(c => c.textContent.trim()));
  // Sorted best-first: NO 0.47 → YES ask 0.53, then NO 0.46 → YES ask 0.54.
  assert.deepEqual(rows.map(r => r[0]), ["$0.4700", "$0.4600"], "literal NO bid prices, unchanged");
  assert.deepEqual(rows.map(r => r[3]), ["$0.5300", "$0.5400"], "implied YES asks");
  assert.equal(rows[0][1], "15", "the contract count of that level");
});
check("YES-bid rows leave the implied-ask column blank rather than inventing one", () => {
  for (const row of $$("#yes-book tr")) assert.equal(row.cells[3].textContent.trim(), "—");
});
check("the summary states the best bid, implied ask and spread from those levels", () => {
  assert.match(text("#book-summary"), /Best YES bid\s*\$0\.5100/);
  assert.match(text("#book-summary"), /Implied YES ask\s*\$0\.5300/);
  assert.match(text("#book-summary"), /YES spread\s*2\.0¢/);
});
check("the book note names the reciprocal rule and its official source", () => {
  assert.match(text("#book-src"), /NO bid at y implies a\s*YES ask at 1 − y/);
  assert.match($("#book-src").innerHTML, /getting_started\/orderbook_responses/);
});
check("the interactive liquidity-at-price lookup answers contracts available at a chosen price", () => {
  // Default loads at best YES ask ($0.5300): 15 contracts immediately fillable.
  assert.match(text("#book-check-result"), /At \$0\.5300 \(YES buyer\): 15 contract\(s\) immediately fillable/);
  // Raise limit to $0.54 → sweeps both NO-bid levels (15 + 40 = 55 contracts).
  $("#book-check-price").value = "0.54";
  $("#book-check-price").dispatchEvent(new w.Event("input"));
  assert.match(text("#book-check-result"), /At \$0\.5400 \(YES buyer\): 55 contract\(s\) immediately fillable/);
  assert.match(text("#book-check-result"), /40 at exact \$0\.5400/);
  assert.match($("#book-check-result").innerHTML, /orderbook\?depth=20/);
  // Switch to Buy NO at $0.50 → sweeps YES bid $0.51 (implied NO ask $0.49, 25 contracts), not YES bid $0.50 (implied NO ask $0.50 → +10 = 35 contracts).
  $("#book-check-side").value = "no";
  $("#book-check-side").dispatchEvent(new w.Event("change"));
  $("#book-check-price").value = "0.50";
  $("#book-check-price").dispatchEvent(new w.Event("input"));
  assert.match(text("#book-check-result"), /At \$0\.5000 \(NO buyer\): 35 contract\(s\) immediately fillable/);
});

/* 4. long-window axis labels */
drawnText = [];
$("#window").value = "7d";
$("#window").dispatchEvent(new w.Event("change"));
await until(() => drawnText.some(t => /[A-Z][a-z]{2} \d{1,2},/.test(t)), 3000);
check("a 7-day window labels the X axis with a calendar date, not just a clock time", () => {
  const labels = drawnText.filter(t => /\d{1,2}:\d{2}/.test(t));
  assert.ok(labels.length >= 2, "several ticks were drawn");
  assert.ok(labels.some(t => /[A-Z][a-z]{2} \d{1,2},/.test(t)),
    `expected a date-qualified tick, got ${JSON.stringify(labels)}`);
});
check("the 7-day request used the documented 60-minute period interval", () => {
  const candle = requests.filter(r => r.includes("/candlesticks")).pop();
  assert.match(candle, /period_interval=60/);
});

/* 5. official traded dollars (GET /markets/trades) */
$("#dollar-run").click();
await until(() => text("#dollar-status").includes("measured"));
check("the traded-dollar table links every measured market's own trades response", () => {
  const html = $("#dollar-rows").innerHTML;
  assert.match(html, /ticker=KXBTC-1/, "market 1 response linked");
  assert.match(html, /ticker=KXBTC-2/, "market 2 response linked, not just the event's first market");
  assert.match(html, /max_ts=\d+/, "the link carries the same window that was measured");
  assert.equal($$("#dollar-rows tr").length, 1, "one event row aggregates its two markets");
});
check("the traded-dollar figure is the sum of the documented count × side price", () => {
  /* KXBTC-1: 10 × $0.50 = $5.00, KXBTC-2: 10 × $0.30 = $3.00 → $8.00. */
  assert.match(text("#dollar-kpis"), /Traded dollars\s*\$8\.00/);
  assert.match(text("#dollar-rows"), /\$8\.00/);
  assert.match(text("#dollar-kpis"), /Trades read\s*2/);
});
check("the panel states the created_time span of the trades it actually read", () => {
  assert.match(text("#dollar-note"), /Trades actually read span \d{4}-\d{2}-\d{2}T[\d:.]+Z/);
});
check("every table row keeps six cells, matching the published header", () => {
  const header = $("#dollar-rows").closest("table").querySelectorAll("thead th");
  assert.equal(header.length, 6);
  for (const row of $$("#dollar-rows tr")) assert.equal(row.cells.length, 6);
});

tradesFailure = "KXBTC-2";
$("#dollar-run").click();
await until(() => text("#dollar-status").includes("unreadable"));
check("an unreadable market withholds the headline total AND that row's figure", () => {
  assert.match(text("#dollar-kpis"), /Traded dollars\s*n\/a/, "no partial sum is shown as the total");
  assert.match(text("#dollar-rows"), /n\/a/, "the affected event shows n/a");
  assert.ok(!/\$8\.00/.test(text("#dollar-rows")), "the earlier total is replaced, not left behind");
});

bookFailure = true;
$("#book-refresh").click();
await until(() => text("#book-status").includes("500"));
check("an orderbook error spans all six columns on both sides and clears stale summary KPIs", () => {
  assert.equal(text("#book-summary"), "", "stale summary KPIs are cleared on error");
  assert.equal(text("#book-check-result"), "", "stale liquidity-at-price result is cleared on error");
  for (const sel of ["#yes-book", "#no-book"]) {
    const header = $$(`#${sel.replace("#", "")}`)[0].closest("table").querySelectorAll("thead th");
    assert.equal(header.length, 6, `${sel} header has six columns`);
    const rows = $$(`${sel} tr`);
    assert.equal(rows.length, 1, `${sel} renders one error row`);
    assert.equal(rows[0].cells.length, 1, `${sel} error row has one spanning cell`);
    assert.equal(rows[0].cells[0].colSpan, 6, `${sel} error row must span 6 columns, not 5`);
    assert.match(rows[0].textContent, /Order book unavailable\./);
  }
});

/* 6. hygiene */
check("no request left the demo host or hit an unmocked path", () => {
  assert.ok(!requests.some(r => r.includes("not_mocked")));
  for (const r of requests) assert.ok(!/^https?:\/\/(?!external-api\.demo\.kalshi\.co)/.test(r));
});
check("no page errors were logged", () => {
  assert.deepEqual(errors, []);
});

for (const [s] of results) console.log(s);
const failed = results.filter(r => r[0].startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
w.close();
process.exit(failed ? 1 : 0);

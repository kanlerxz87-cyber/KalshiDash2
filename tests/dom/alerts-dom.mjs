// DOM end-to-end check for alerts.html: bundles the real page controller with
// esbuild, runs it in jsdom, and serves scripted Kalshi-shaped responses for
// three polls (baseline -> moves -> yes resolution). The responses are fixtures
// (no network); live API shapes are checked separately by tests/live-alerts-check.mjs.
// Run: cd tests/dom && npm install && node alerts-dom.mjs
import { JSDOM, VirtualConsole } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import assert from "node:assert/strict";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const BASE = "https://external-api.demo.kalshi.co/trade-api/v2";
const html = fs.readFileSync(REPO + "/alerts.html", "utf8")
  .replace('<script type="module" src="assets/js/alerts.js"></script>', "");
const bundle = (await esbuild.build({
  entryPoints: [REPO + "/assets/js/alerts.js"], bundle: true, format: "iife", write: false, platform: "browser"
})).outputFiles[0].text;

const r4 = x => Math.round(x * 1e4) / 1e4;

// Scripted market state per phase. bid/ask are YES quotes; NO quotes derive from them.
const PHASES = [
  { "KXPRES-A-1": [.45, .44, .46], "KXPRES-A-2": [.30, .29, .31], "KXPGATOUR-1": [.20, .19, .21], "KXBTCD-1": [.50, .49, .51] },
  { "KXPRES-A-1": [.58, .57, .59], "KXPRES-A-2": [.30, .29, .31], "KXPGATOUR-1": [.09, .08, .10], "KXBTCD-1": [.38, .37, .39] },
  { "KXPRES-A-1": [.58, .57, .59], "KXPRES-A-2": [.30, .29, .31], "KXPGATOUR-1": [.09, .08, .10], "KXBTCD-1": [.38, .37, .39] }
];
const RESULTS = [{}, {}, { "KXPRES-A-1": "yes" }];
const state = { phase: 0 };

const META = {
  "KXPRES-A-1": { ev: "KXPRES-A", title: "Who wins the race?", cat: "Elections", series: "KXPRES" },
  "KXPRES-A-2": { ev: "KXPRES-A", title: "Who wins the race?", cat: "Elections", series: "KXPRES" },
  "KXPGATOUR-1": { ev: "KXPGATOUR-EV", title: "PGA Tour winner", cat: "Sports", series: "KXPGATOUR" },
  "KXBTCD-1": { ev: "KXBTCD-EV", title: "Bitcoin above 100k", cat: "Crypto", series: "KXBTCD" }
};

function market(t) {
  const [last, bid, ask] = PHASES[state.phase][t];
  const m = META[t];
  return {
    ticker: t, event_ticker: m.ev, title: m.title, status: "active",
    last_price_dollars: String(last), yes_bid_dollars: String(bid), yes_ask_dollars: String(ask),
    no_bid_dollars: String(r4(1 - ask)), no_ask_dollars: String(r4(1 - bid)),
    open_interest_fp: "500.00", volume_fp: "1000.00", volume_24h_fp: "40.00",
    result: RESULTS[state.phase][t] || ""
  };
}

const EVENTS = Object.values(META).reduce((acc, m) => { if (!acc.find(e => e.event_ticker === m.ev)) acc.push({ event_ticker: m.ev, title: m.title, category: m.cat, series_ticker: m.series }); return acc; }, []);

const requested = [];
async function mockFetch(url) {
  const u = new URL(url);
  const path = u.pathname.replace("/trade-api/v2", "");
  const reply = (status, body) => ({ ok: status < 400, status, statusText: String(status), text: async () => JSON.stringify(body) });
  if (!url.startsWith(BASE)) return reply(404, { error: { code: "not_mocked", url } });
  if (path === "/events") {
    assert.equal(u.searchParams.get("status"), "open");
    assert.equal(u.searchParams.get("with_nested_markets"), "true");
    return reply(200, {
      events: EVENTS.map(e => ({ ...e, markets: Object.keys(META).filter(t => META[t].ev === e.event_ticker).map(market) })),
      cursor: ""
    });
  }
  if (path === "/markets") {
    const tickers = (u.searchParams.get("tickers") || "").split(",").filter(Boolean);
    requested.push(tickers);
    return reply(200, { markets: tickers.filter(t => META[t]).map(market), cursor: "" });
  }
  if (path.startsWith("/events/")) {
    const ev = decodeURIComponent(path.slice("/events/".length));
    const e = EVENTS.find(x => x.event_ticker === ev);
    if (!e) return reply(404, { error: { code: "not_found" } });
    return reply(200, { event: { ...e, settlement_sources: [{ name: "Fixture settlement source", url: "https://example.org/fixture-" + ev }] }, markets: [] });
  }
  return reply(404, { error: { code: "not_mocked", path } });
}

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", e => errors.push(String(e && (e.message || e))));
vc.on("error", e => errors.push(String(e)));
const dom = new JSDOM(html, {
  url: "https://kanlerxz87-cyber.github.io/KalshiDash2/alerts.html",
  runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc
});
const w = dom.window;
w.fetch = mockFetch;
w.confirm = () => true;
w.eval(bundle);
const $ = s => w.document.querySelector(s);
const $$ = s => [...w.document.querySelectorAll(s)];

async function waitFor(cond, label, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error("timed out waiting for: " + label + "\nstatus: " + $("#poll-status")?.textContent);
}

const results = [];
function check(name, fn) { try { fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name + " — " + e.message]); } }

async function poll(n) {
  // Pause then resume triggers an immediate poll through the page's own control.
  await waitFor(() => $("#poll-status").textContent.includes(`poll #${n} `), `poll #${n}`);
}

// Poll 1 (baseline) happens on load.
await waitFor(() => $("#poll-status").textContent.includes("poll #1 "), "poll #1");
check("baseline poll raises no alerts", () => {
  assert.equal($$("#feed-all .msg").length, 0);
  assert.equal($$("#trade-body tr").length, 1); // empty-state row
});
check("empty feed shows the explicit empty message, not a blank", () => {
  assert.match($("#feed-all").textContent, /No move of \$0\.10 or more yet/);
});
check("universe scan covers the five topics that have open markets", () => {
  const note = $("#universe-note").textContent;
  assert.match(note, /Elections 2/);
  assert.match(note, /Golf 1/);
  assert.match(note, /Crypto 1/);
});

// Poll 2: moves.
state.phase = 1;
$("#pause").click(); $("#pause").click();
await poll(2);
check("two-poll move ≥ $0.10 raises alerts on the All feed (up, down, down)", () => {
  assert.equal($$("#feed-all .msg").length, 3, $("#feed-all").textContent.slice(0, 300));
  assert.equal($$("#feed-all .msg.up").length, 1);
  assert.equal($$("#feed-all .msg.down").length, 2);
});
check("High-ROI watch keeps only moves passing every rule (Elections, Crypto; golf fails price band)", () => {
  const titles = $$("#feed-watch .msg .ttl").map(e => e.textContent);
  assert.equal(titles.length, 2, titles.join(" | "));
  assert.ok(titles.includes("Who wins the race?"));
  assert.ok(titles.includes("Bitcoin above 100k"));
  assert.ok(!titles.includes("PGA Tour winner"));
});
check("alert shows the official endpoint link and the event settlement source", () => {
  const first = $("#feed-all .msg");
  assert.ok(first.querySelector('a[href="https://external-api.demo.kalshi.co/trade-api/v2/markets/KXPRES-A-1"]'));
});
check("golf alert's rule check names the failed price-band rule", () => {
  const golf = $$("#feed-all .msg").find(m => m.textContent.includes("PGA Tour winner"));
  assert.ok(golf);
  assert.match(golf.textContent, /fails: Price after move between/);
});
check("each strategy opened the expected number of simulated trades", () => {
  const rows = $$("#sim-body tr");
  const trades = Object.fromEntries(rows.map(r => [r.children[0].textContent, Number(r.children[2].textContent)]));
  assert.equal(trades["Follow · all alerts"], 3);
  assert.equal(trades["Fade · all alerts"], 3);
  assert.equal(trades["Follow · High-ROI watch"], 2);
  assert.equal(trades["Fade · High-ROI watch"], 2);
});
check("simulated trade rows show side and entry from the displayed ask", () => {
  const rows = $$("#trade-body tr");
  assert.equal(rows.length, 10);
  const pres = rows.find(r => r.textContent.includes("Who wins") && r.textContent.includes("Follow · all"));
  assert.equal(pres.children[4].textContent, "YES");
  assert.equal(pres.children[5].textContent, "$0.59");
  const fade = rows.find(r => r.textContent.includes("Who wins") && r.textContent.includes("Fade · all"));
  assert.equal(fade.children[4].textContent, "NO");
  assert.equal(fade.children[5].textContent, "$0.43");
});
check("open trades are marked at the best bid for their side", () => {
  const btc = $$("#trade-body tr").find(r => r.textContent.includes("Bitcoin") && r.textContent.includes("Follow · all"));
  // Bitcoin fell 0.50 → 0.38: follow buys NO at no_ask = 1 − 0.37 = 0.63; NO bid = 1 − 0.39 = 0.61.
  assert.equal(btc.children[4].textContent, "NO");
  assert.equal(btc.children[5].textContent, "$0.63");
  assert.match(btc.children[8].textContent, /−\$0\.02/);
});

// Poll 3: the Elections market resolves YES.
state.phase = 2;
$("#pause").click(); $("#pause").click();
await poll(3);
check("a market resolves only when the API reports yes/no, then pays $1 to the matching side", () => {
  const rows = $$("#trade-body tr").filter(r => r.textContent.includes("Who wins"));
  const resolved = rows.filter(r => r.textContent.includes("resolved yes"));
  assert.equal(resolved.length, 4);
  const followAll = rows.find(r => r.textContent.includes("Follow · all"));
  assert.match(followAll.children[8].textContent, /\+\$0\.41/);
  const fadeAll = rows.find(r => r.textContent.includes("Fade · all"));
  assert.match(fadeAll.children[8].textContent, /−\$0\.43/);
});
check("summary: realized P&L, win rate and ROI on cost use only resolved trades", () => {
  const row = $$("#sim-body tr").find(r => r.children[0].textContent === "Follow · all alerts");
  assert.equal(row.children[4].textContent, "1");                 // resolved
  assert.equal(row.children[5].textContent, "100.0%");            // win rate
  assert.match(row.children[6].textContent, /\+\$0\.4100/);       // realized
  assert.equal(row.children[7].textContent, "69.5%");             // 0.41 / 0.59
});
check("the poll requests were batched by tickers and never exceeded 25 per call", () => {
  assert.ok(requested.length >= 3);
  for (const t of requested) assert.ok(t.length <= 25 && t.length > 0);
});
check("state is saved to localStorage and survives a reload-shaped read", () => {
  const saved = JSON.parse(w.localStorage.getItem("kalshiDash.sim.v1"));
  assert.equal(saved.length, 10);
  assert.equal(saved.filter(t => t.status === "resolved").length, 4);
});
check("no page errors were logged", () => {
  assert.deepEqual(errors, []);
});
check("the settlement source link from the event record is rendered", () => {
  assert.ok($("#feed-all").innerHTML.includes("Fixture settlement source"));
});

for (const [s, n] of results) console.log(s, n);
const failed = results.filter(r => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
w.close();
process.exit(failed ? 1 : 0);

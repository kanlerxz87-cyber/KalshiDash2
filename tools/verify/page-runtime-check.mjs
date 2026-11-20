#!/usr/bin/env node
/* Runtime check for every published page.
 *
 * The build sandbox cannot open a browser, so this harness stands in for one.
 * For each page it:
 *   1. extracts the page's inline ES module,
 *   2. runs it against a small DOM shim,
 *   3. serves API responses in the exact shapes the Kalshi demo API returned
 *      when they were captured (fixtures below, captured 2026-11-20),
 *   4. fails the run on any thrown error, unhandled rejection or console error.
 *
 * It checks that pages *execute*; it does not check layout. It is deliberately
 * dependency-free so it can run anywhere Node 18+ is available.
 *
 * Usage:  node tools/verify/page-runtime-check.mjs [page.html ...]
 * Exit code 0 = every page ran clean.
 */
import { readFile, writeFile, unlink, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* ------------------------------------------------------------------ pages */
const DEFAULT_PAGES = [
  "index.html", "alerts.html", "simulator.html", "summary.html", "event.html",
  "resolved.html", "portfolio.html", "strategies.html", "suggestions.html",
  "questions.html", "verification.html", "flagged.html",
  "categories/gas.html", "categories/elections.html", "categories/culture.html",
  "categories/crypto.html", "categories/golf.html"
];

/* --------------------------------------------------------------- fixtures */
const NOW = Date.parse("2026-11-20T13:30:00Z");
const HOUR = 3600 * 1000;

const DEMO_MARKET = {
  ticker: "KXDEMO-ELECTION-26NOV25-A",
  event_ticker: "KXDEMO-ELECTION-26NOV25",
  title: "Candidate A wins",
  yes_sub_title: "Candidate A",
  no_sub_title: "Candidate B",
  status: "active",
  market_type: "binary",
  last_price_dollars: "0.6200",
  previous_price_dollars: "0.4800",
  yes_bid_dollars: "0.6100",
  yes_ask_dollars: "0.6300",
  yes_bid_size_fp: "120.00",
  yes_ask_size_fp: "80.00",
  no_bid_dollars: "0.3700",
  no_ask_dollars: "0.3900",
  open_interest_fp: "1500.00",
  volume_fp: "4200.00",
  volume_24h_fp: "310.00",
  notional_value_dollars: "1.0000",
  close_time: "2026-11-25T00:00:00Z",
  expected_expiration_time: "2026-11-25T00:00:00Z",
  open_time: "2026-11-19T00:00:00Z",
  result: "",
  rules_primary: "If Candidate A wins the demo contest, the market resolves to Yes.",
  rules_secondary: "",
  price_level_structure: "linear_cent",
  price_ranges: [{ start: "0.0000", end: "1.0000", step: "0.0100" }],
  updated_time: "2026-11-20T13:29:00Z"
};

const SETTLED_MARKET = {
  ...DEMO_MARKET,
  ticker: "KXDEMO-ELECTION-26NOV10-A",
  event_ticker: "KXDEMO-ELECTION-26NOV10",
  status: "finalized",
  result: "yes",
  settlement_value_dollars: "1.0000",
  settlement_ts: "2026-11-10T13:00:00Z",
  close_time: "2026-11-10T13:00:00Z"
};

const DEMO_EVENT = {
  event_ticker: "KXDEMO-ELECTION-26NOV25",
  title: "Demo election event",
  sub_title: "Nov 25",
  category: "Elections",
  series_ticker: "KXDEMO-ELECTION",
  settlement_sources: [
    { name: "Example News Wire", url: "https://example.com/news" },
    { name: "Official Results Page", url: "https://example.com/results" }
  ],
  markets: [DEMO_MARKET]
};

const CANDLES = Array.from({ length: 40 }, (_, i) => {
  const close = (0.5 + Math.sin(i / 3) * 0.12 + i * 0.004).toFixed(4);
  const prev = (0.5 + Math.sin((i - 1) / 3) * 0.12 + (i - 1) * 0.004).toFixed(4);
  return {
    end_period_ts: Math.floor(NOW / 1000) - (40 - i) * 60,
    open_interest_fp: "1500.00",
    volume_fp: String(10 + i),
    price: {
      close_dollars: close,
      open_dollars: prev,
      high_dollars: close,
      low_dollars: prev,
      mean_dollars: close,
      previous_dollars: prev
    },
    yes_bid: { close_dollars: "0.6100", open_dollars: "0.6000", high_dollars: "0.6200", low_dollars: "0.5900" },
    yes_ask: { close_dollars: "0.6300", open_dollars: "0.6200", high_dollars: "0.6400", low_dollars: "0.6100" }
  };
});

function fixtureFor(urlPath) {
  const p = urlPath.split("?")[0];
  if (p.startsWith("/exchange/status")) {
    return { trading_active: true, exchange_active: true };
  }
  if (p === "/events") {
    return { events: [DEMO_EVENT], cursor: "" };
  }
  if (p.startsWith("/events/")) {
    return { event: { ...DEMO_EVENT, event_ticker: p.split("/")[2] } };
  }
  if (p.includes("/candlesticks")) {
    return { candlesticks: CANDLES, ticker: DEMO_MARKET.ticker };
  }
  if (p.endsWith("/orderbook")) {
    return {
      orderbook_fp: {
        yes_dollars: [["0.5900", "200"], ["0.6000", "150"], ["0.6100", "120"]],
        no_dollars: [["0.3600", "80"], ["0.3700", "90"], ["0.3800", "110"]]
      }
    };
  }
  if (p === "/markets") {
    const q = urlPath.split("?")[1] || "";
    if (/status=settled/.test(q)) return { markets: [SETTLED_MARKET], cursor: "" };
    return { markets: [DEMO_MARKET], cursor: "" };
  }
  if (p.startsWith("/markets/")) {
    return { market: DEMO_MARKET };
  }
  if (p.startsWith("/series/")) {
    if (p.includes("/markets/")) return { candlesticks: CANDLES };
    return { series: { ticker: "KXDEMO-ELECTION", title: "Demo election", category: "Elections", frequency: "daily" } };
  }
  if (p.startsWith("/portfolio/")) {
    return { error: { code: "unauthorized" } };
  }
  return {};
}

/* ------------------------------------------------------------------- DOM */
class El {
  constructor(tag = "div") {
    this.tagName = String(tag).toUpperCase();
    this._html = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.className = "";
    this.id = "";
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.scrollTop = 0;
    this.scrollHeight = 800;
    this.clientWidth = 640;
    this.clientHeight = 320;
    this.attributes = {};
    this.classList = {
      add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v ?? ""); }
  addEventListener() {}
  removeEventListener() {}
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  append(...c) { c.forEach(x => this.appendChild(x)); }
  prepend(...c) { c.reverse().forEach(x => { this.children.unshift(x); x.parentNode = this; }); }
  insertAdjacentHTML(_pos, html) { this._html += String(html ?? ""); }
  removeChild(c) { this.children = this.children.filter(x => x !== c); return c; }
  remove() {}
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  scrollIntoView() {}
  focus() {}
  getContext() { return makeCtx(); }
  get firstElementChild() { return this.children[0] || null; }
}

function makeCtx() {
  const noop = () => {};
  return {
    setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, stroke: noop,
    fill: noop, arc: noop, roundRect: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, setLineDash: noop, fillText: noop,
    measureText: () => ({ width: 24 }),
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineWidth: 1, globalAlpha: 1
  };
}

function installDom(bodyAttrs = {}) {
  const body = new El("body");
  Object.assign(body.dataset, bodyAttrs);
  const doc = {
    body,
    title: "",
    visibilityState: "visible",
    createElement: (t) => new El(t),
    querySelector: () => new El(),
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.document = doc;
  globalThis.window = globalThis;
  globalThis.window.devicePixelRatio = 1;
  globalThis.window.scrollTo = () => {};
  if (typeof globalThis.window.addEventListener !== "function") {
    globalThis.window.addEventListener = () => {};
    globalThis.window.removeEventListener = () => {};
  }
  globalThis.location = { search: "", href: "https://kanlerxz87-cyber.github.io/KalshiDash2/" };
  if (!globalThis.navigator) {
    try { Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node" }, configurable: true }); } catch {}
  }
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  return doc;
}

/* ------------------------------------------------------------------ fetch */
let fetchLog = [];
function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    const pathOnly = u.replace(/^https?:\/\/[^/]+/, "");
    fetchLog.push(pathOnly);
    if (pathOnly.startsWith("/trade-api/v2/portfolio/")) {
      return { ok: false, status: 401, statusText: "Unauthorized", text: async () => JSON.stringify({ error: { code: "unauthorized" } }) };
    }
    const body = JSON.stringify(fixtureFor(pathOnly.replace(/^\/trade-api\/v2/, "")));
    return { ok: true, status: 200, statusText: "OK", text: async () => body };
  };
}

/* ------------------------------------------------------------------- main */
const problems = [];
const consoleErrors = [];

process.on("unhandledRejection", (err) => {
  problems.push(`unhandled rejection: ${err && err.message ? err.message : String(err)}`);
});
process.on("uncaughtException", (err) => {
  problems.push(`uncaught exception: ${err && err.message ? err.message : String(err)}`);
});

const origError = console.error;
console.error = (...args) => { consoleErrors.push(args.map(String).join(" ")); origError(...args); };

async function runPage(rel) {
  const abs = path.join(ROOT, rel);
  const html = await readFile(abs, "utf8");

  const bodyTag = (html.match(/<body[^>]*>/i) || [""])[0];
  const dataTopic = (bodyTag.match(/data-topic="([^"]+)"/i) || [])[1];
  const bodyAttrs = dataTopic ? { topic: dataTopic } : {};

  /* Inline modules and external module scripts are both executed. */
  const inline = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const external = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(m => m[1]);
  if (!inline.length && !external.length) {
    problems.push(`${rel}: no <script type="module"> found`);
    return { rel, modules: 0, ok: false };
  }

  installDom(bodyAttrs);
  installFetch();
  fetchLog = [];

  const tmp = path.join(path.dirname(abs), `.rtcheck-${path.basename(rel)}.mjs`);
  let ok = true;
  const run = async (code) => {
    try {
      await writeFile(tmp, code, "utf8");
      await import(pathToFileURL(tmp).href + `?t=${Date.now()}`);
    } catch (err) {
      ok = false;
      problems.push(`${rel}: ${err && err.message ? err.message : String(err)}`);
    } finally {
      if (existsSync(tmp)) await unlink(tmp).catch(() => {});
    }
  };
  for (const code of inline) await run(code);
  for (const src of external) {
    const modPath = path.resolve(path.dirname(abs), src);
    if (!existsSync(modPath)) {
      ok = false;
      problems.push(`${rel}: module not found: ${src}`);
      continue;
    }
    try {
      await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
    } catch (err) {
      ok = false;
      problems.push(`${rel}: ${err && err.message ? err.message : String(err)}`);
    }
  }

  /* Let the pages' first async pass settle so fetch-driven code paths run. */
  await new Promise(r => setTimeout(r, 250));
  return { rel, modules: inline.length + external.length, ok, fetches: fetchLog.length };
}

const pages = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PAGES;
const results = [];
for (const rel of pages) {
  const before = problems.length;
  let r;
  try {
    r = await runPage(rel);
  } catch (err) {
    problems.push(`${rel}: harness failure: ${err && err.message ? err.message : String(err)}`);
    r = { rel, ok: false, modules: 0 };
  }
  results.push({ ...r, newProblems: problems.length - before });
}

/* ------------------------------------------------------------ link check */
/* Every static local href/src must resolve to a file in the repository.
 * Links inside <script> blocks are template literals and are skipped. */
async function linkCheck() {
  const dirs = ["", "categories", "docs"];
  const files = [];
  for (const d of dirs) {
    let names = [];
    try { names = await readdir(path.join(ROOT, d)); } catch { continue; }
    for (const n of names) if (n.endsWith(".html")) files.push(path.join(d, n));
  }
  const broken = [];
  for (const rel of files) {
    const html = await readFile(path.join(ROOT, rel), "utf8");
    const staticHtml = html.replace(/<script\b[\s\S]*?<\/script>/g, "");
    for (const m of staticHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const v = m[1];
      if (/^(https?:|mailto:|#|data:|\$\{)/.test(v)) continue;
      const target = v.split("#")[0].split("?")[0];
      if (!target) continue;
      const full = path.resolve(ROOT, path.dirname(rel), target);
      if (!existsSync(full)) broken.push(`${rel}: ${v}`);
    }
  }
  return { checked: files.length, broken };
}

const links = await linkCheck();

console.log("\n=== page runtime check ===");
for (const r of results) {
  const status = r.ok && r.newProblems === 0 ? "PASS" : "FAIL";
  console.log(`${status}  ${r.rel.padEnd(30)} modules=${r.modules} fetches=${r.fetches ?? 0}`);
}
if (problems.length) {
  console.log("\n--- problems ---");
  for (const p of problems) console.log(" * " + p);
}
if (consoleErrors.length) {
  console.log("\n--- console.error output ---");
  for (const c of consoleErrors) console.log(" * " + c);
}
const failed = results.filter(r => !r.ok || r.newProblems > 0).length;
console.log(`\n${results.length - failed}/${results.length} pages ran clean.`);
console.log(`link check: ${links.checked} pages, ${links.broken.length} broken local link(s)`);
for (const b of links.broken) console.log(" * " + b);
process.exit(failed || problems.length || links.broken.length ? 1 : 0);

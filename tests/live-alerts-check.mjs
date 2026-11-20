// Live, read-only check of the Kalshi DEMO API calls that alerts.html depends on.
// Runs on a GitHub-hosted runner (the editing sandbox cannot reach Kalshi hosts).
// Writes reports/alerts-live-check.md. Makes no order calls and needs no credentials.
//
// Checks, in order:
//   1. GET /events?status=open&with_nested_markets=true   (universe + classification input)
//   2. GET /markets?tickers=<25 tickers>&limit=1000        (the batch read the poll uses)
//   3. GET /markets?tickers=<100 tickers>                  (informational: is a larger batch accepted?)
//   4. GET /events/{event_ticker}                          (settlement_sources shape)
//   5. A second batch read after a pause, fed through detectMoves()
import { writeFileSync } from "node:fs";
import { detectMoves, moneyTraded } from "../assets/js/alerts-core.js";

const BASE = "https://external-api.demo.kalshi.co/trade-api/v2";
const OUT = new URL("../reports/alerts-live-check.md", import.meta.url);
const BATCH = 25;
const SECOND_POLL_MS = 20_000;

const lines = [];
const out = (s = "") => lines.push(s);
const started = new Date().toISOString();

async function get(path) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, { headers: { Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  return { status: res.status, ms: Date.now() - t0, json, text, retryAfter: res.headers.get("retry-after") };
}

const short = s => (s.length > 120 ? s.slice(0, 117) + "…" : s);

async function main() {
  out("# Live alerts check — Kalshi DEMO API");
  out();
  out("| Field | Value |");
  out("| --- | --- |");
  out(`| Started (UTC) | ${started} |`);
  out(`| Runner | GitHub Actions \`${process.env.RUNNER_OS || "local"}\` |`);
  out(`| Commit | \`${process.env.GITHUB_SHA || "n/a"}\` |`);
  out(`| Base URL | \`${BASE}\` |`);
  out();
  out("Read-only. No credentials, no order calls. Each row is a single request as written.");
  out();

  // 1. Universe input.
  const ev = await get("/events?status=open&with_nested_markets=true&limit=200");
  const events = ev.json?.events || [];
  const nested = events.flatMap(e => (e.markets || []).map(m => ({ ...m, _event_ticker: e.event_ticker })));
  const active = nested.filter(m => m.status === "active" || m.status === "open");
  const statusCounts = {};
  for (const m of nested) statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  out("## 1. Open events with nested markets");
  out();
  out(`- \`GET /events?status=open&with_nested_markets=true&limit=200\` → HTTP **${ev.status}** in ${ev.ms} ms`);
  out(`- Events returned: **${events.length}**; nested markets: **${nested.length}**; markets with status \`active\` or \`open\`: **${active.length}**`);
  out(`- Market \`status\` values seen: ${Object.entries(statusCounts).map(([k, v]) => `\`${k}\` ${v}`).join(", ") || "none"}`);
  const fieldsOk = active.slice(0, 50).every(m => "last_price_dollars" in m && "yes_bid_dollars" in m && "yes_ask_dollars" in m && "no_ask_dollars" in m);
  out(`- Price/quote fields present on the first 50 active markets: **${fieldsOk ? "yes" : "NO"}**`);
  out();

  const top = [...active].sort((a, b) => (moneyTraded(b) ?? -1) - (moneyTraded(a) ?? -1));
  const tickers25 = top.slice(0, BATCH).map(m => m.ticker);
  const tickers100 = top.slice(0, 100).map(m => m.ticker);

  // 2. Batch read, 25 tickers (the size the page uses).
  const q = arr => arr.map(t => encodeURIComponent(t)).join(",");
  const b25 = await get(`/markets?tickers=${q(tickers25)}&limit=1000`);
  const got25 = new Set((b25.json?.markets || []).map(m => m.ticker));
  const missing25 = tickers25.filter(t => !got25.has(t));
  out("## 2. Batch read used by the page (25 tickers per call)");
  out();
  out(`- Requested: **${tickers25.length}** tickers, \`limit=1000\``);
  out(`- \`GET /markets?tickers=…\` → HTTP **${b25.status}** in ${b25.ms} ms; markets returned: **${got25.size}**; missing: **${missing25.length}**`);
  if (missing25.length) out(`- Missing tickers: ${missing25.map(t => "`" + t + "`").join(", ")}`);
  if (b25.status !== 200) out(`- Body (truncated): \`${short(b25.text)}\``);
  out();

  // 3. Informational: 100 tickers in one call.
  const b100 = await get(`/markets?tickers=${q(tickers100)}&limit=1000`);
  const got100 = (b100.json?.markets || []).length;
  out("## 3. Informational: larger batch (100 tickers in one call)");
  out();
  out(`- \`GET /markets?tickers=…\` (100) → HTTP **${b100.status}**; markets returned: **${got100}**. The page does not rely on this; it is recorded so the batch size can be reviewed.`);
  out();

  // 4. Settlement sources on the event record.
  const evTicker = (top[0] || active[0] || nested[0] || {}).event_ticker || (top[0] || {})._event_ticker;
  out("## 4. Event record (settlement sources)");
  out();
  if (evTicker) {
    const er = await get(`/events/${encodeURIComponent(evTicker)}`);
    const e = er.json?.event || er.json || {};
    const sources = Array.isArray(e.settlement_sources) ? e.settlement_sources : null;
    out(`- \`GET /events/${evTicker}\` → HTTP **${er.status}**`);
    out(`- \`settlement_sources\`: ${sources === null ? "field absent" : sources.length + " entr" + (sources.length === 1 ? "y" : "ies")}`);
    for (const s of sources || []) {
      const ok = typeof s.url === "string" && /^https:\/\//.test(s.url);
      out(`  - ${s.name ? "**" + s.name + "**" : "(unnamed)"} — ${ok ? "https link" : "not an https link, not rendered"}: \`${short(String(s.url || ""))}\``);
    }
    out(`- Category: \`${e.category ?? "null"}\`; series: \`${e.series_ticker ?? "null"}\``);
  } else {
    out("- No event ticker available to test (no open events returned).");
  }
  out();

  // 5. Second poll after a pause, fed through the same detection code.
  out("## 5. Two polls and the alert rule");
  out();
  const first = new Map((b25.json?.markets || []).map(m => [m.ticker, m]));
  const at1 = Date.now();
  await new Promise(r => setTimeout(r, SECOND_POLL_MS));
  const b25b = await get(`/markets?tickers=${q(tickers25)}&limit=1000`);
  const second = new Map((b25b.json?.markets || []).map(m => [m.ticker, m]));
  // Baseline from poll 1, then compare poll 2.
  const prev = {};
  for (const [t, m] of first) { const p = Number(m.last_price_dollars); if (Number.isFinite(p)) prev[t] = { price: p, at: at1 }; }
  const { alerts } = detectMoves(prev, [...second.values()], { at: Date.now() });
  out(`- Poll 1 → poll 2 (${SECOND_POLL_MS / 1000}s apart): HTTP ${b25.status} → **${b25b.status}**; markets in poll 2: **${second.size}**`);
  out(`- Moves of ≥ $0.10 between the two polls: **${alerts.length}**` + (alerts.length ? "" : " (none is a valid result for a quiet 20-second window; the rule is unit-tested in `tests/alerts-core.test.mjs`)"));
  for (const a of alerts.slice(0, 10)) {
    out(`  - \`${a.ticker}\` ${a.direction} ${a.from.toFixed(4)} → ${a.to.toFixed(4)} (Δ ${a.delta.toFixed(4)})`);
  }
  out();
  out("## What this does not prove");
  out();
  out("- It does not check the page itself in a browser (see `tests/dom/alerts-dom.mjs`, which uses scripted fixtures).");
  out("- Kalshi publishes no numeric limit for unauthenticated reads on the page we cite; a 429 is handled by backing off (`alerts.js`).");
  out("- A 25-ticker batch is the size the page uses. The API does not document a maximum for `tickers`; section 3 is a single observation.");
  out();
  out(`Generated by \`tests/live-alerts-check.mjs\` at ${new Date().toISOString()}.`);

  writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(lines.join("\n"));

  // Fail the job only when the calls the page depends on did not work.
  const fatal = ev.status !== 200 || b25.status !== 200 || b25b.status !== 200 || got25.size === 0;
  if (fatal) { console.error("Live check failed: a required endpoint did not return data."); process.exit(1); }
}

await main();

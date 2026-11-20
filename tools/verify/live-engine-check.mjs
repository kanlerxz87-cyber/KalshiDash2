#!/usr/bin/env node
/* Live engine check — runs the real alert and simulation engines against the
 * official Kalshi DEMO API and writes a timestamped report.
 *
 * The build sandbox cannot open TLS connections to Kalshi hosts, so this runs on
 * a GitHub-hosted runner. The report it prints is committed to `reports/` so the
 * behaviour of the two new engines can be reviewed without trusting the site.
 *
 * Usage:  node tools/verify/live-engine-check.mjs [outfile.md]
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const { AlertEngine } = await import(path.join(ROOT, "assets/js/alert-engine.js"));
const { loadSettledUniverse, loadHistory, toSeries, replayAll, aggregate } =
  await import(path.join(ROOT, "assets/js/simulator.js"));
const { ALERT, TRADE_SCREEN, STRATEGIES } = await import(path.join(ROOT, "assets/js/config.js"));

const lines = [];
const log = (s = "") => { lines.push(s); console.log(s); };

const started = new Date().toISOString();
log("# Live engine check — Kalshi demo API");
log();
log(`- Run at: ${started}`);
log(`- API: https://external-api.demo.kalshi.co/trade-api/v2`);
log(`- Alert threshold: $${ALERT.defaultThreshold.toFixed(2)} · model pass mark: ${TRADE_SCREEN.passScore}/100`);
log();

/* ------------------------------------------------------------- alerts --- */
log("## 1 · Alert engine");
log();

const swings = [];
const engine = new AlertEngine({
  threshold: ALERT.defaultThreshold,
  passScore: TRADE_SCREEN.passScore,
  pollMs: ALERT.defaultPollMs,
  maxEventsPerPoll: ALERT.maxEventsPerPoll,
  onMessage: (s) => swings.push(s),
  onState: () => {}
});

await engine.poll();
if (engine.errors.length) {
  console.error("live engine check FAILED — the demo API was not reachable:");
  console.error(engine.errors[engine.errors.length - 1].message);
  process.exit(1);
}
log(`- Events scanned: ${engine.scanned}`);
log(`- Markets in the five topics: ${engine.markets}`);
log(`- Swings of $${ALERT.defaultThreshold.toFixed(2)} or more detected: ${swings.length}`);

if (swings.length) {
  log();
  log("| Topic | Market | From | To | Δ | Basis | Screen |");
  log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const s of swings.slice(0, 25)) {
    log(`| ${s.topicKey} | \`${s.ticker}\` | ${s.from.toFixed(2)} | ${s.to.toFixed(2)} | ` +
        `${s.delta > 0 ? "+" : ""}${s.delta.toFixed(2)} | ${s.basis} | ` +
        `${s.screen ? `${s.screen.score}/${s.screen.max}` : "n/a"} |`);
  }
} else {
  log();
  log("_No swing met the threshold in this scan. The demo exchange is quiet at the time of writing._");
}

/* A swing may legitimately be zero: the threshold is high relative to the
 * sample of markets read in one scan. Record the highest observed move so the
 * report still carries evidence that the comparison works. */
const observed = [];
{
  const { classifyEvent, num } = await import(path.join(ROOT, "assets/js/market.js"));
  for (const ev of engine.lastEvents) {
    if (!classifyEvent(ev)) continue;
    for (const m of ev.markets || []) {
      const last = num(m.last_price_dollars), prev = num(m.previous_price_dollars);
      if (last === null || prev === null) continue;
      observed.push({ ticker: m.ticker, last, prev, d: Number((last - prev).toFixed(4)) });
    }
  }
  observed.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}
log();
log(`- Markets with a readable previous price: ${observed.length}`);
log(`- Largest single move against the exchange's previous price: ` +
    (observed.length ? `${observed[0].d > 0 ? "+" : ""}${observed[0].d.toFixed(2)} on \`${observed[0].ticker}\`` : "none"));
log();
log("| Market | previous_price_dollars | last_price_dollars | Δ |");
log("| --- | --- | --- | --- |");
for (const o of observed.slice(0, 10)) {
  log(`| \`${o.ticker}\` | ${o.prev.toFixed(2)} | ${o.last.toFixed(2)} | ${o.d > 0 ? "+" : ""}${o.d.toFixed(2)} |`);
}

/* ----------------------------------------------------------- simulator --- */
log();
log("## 2 · Strategy tester");
log();

const universe = await loadSettledUniverse({ limit: 12, maxPages: 2 });
log(`- Finalized markets loaded: ${universe.length}`);
log(`- With a yes/no result and a settlement value: ${universe.filter(m => m.result && m.settlement_value_dollars != null).length}`);
log();

const trades = [];
let withHistory = 0, errors = 0;
for (const m of universe) {
  const hist = await loadHistory(m, { minutes: 600, interval: 1 });
  if (hist.error) { errors++; continue; }
  const series = toSeries(hist.points);
  if (!series.length) continue;
  withHistory++;
  trades.push(...replayAll(STRATEGIES, series, m));
}
log(`- Markets with usable one-minute history: ${withHistory}`);
log(`- History requests that failed: ${errors}`);
log(`- Simulated trades produced: ${trades.length}`);
log();

const agg = aggregate(trades);
if (agg.length) {
  log("| Strategy | Trades | Wins | Losses | Hit rate | Avg entry price | P&L / contract | ROI |");
  log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const g of agg) {
    log(`| ${g.name} | ${g.n} | ${g.wins} | ${g.losses} | ` +
        `${g.winRate === null ? "n/a" : (g.winRate * 100).toFixed(1) + "%"} | ` +
        `${g.avgEntry === null ? "n/a" : "$" + g.avgEntry.toFixed(2)} | ` +
        `${g.pnl.toFixed(2)} | ${g.roi === null ? "n/a" : (g.roi * 100).toFixed(1) + "%"} |`);
  }
} else {
  log("_No strategy fired in this universe._");
}

if (trades.length) {
  log();
  log("### First simulated trades");
  log();
  log("| Strategy | Market | Side | Entry | Exit | Result | P&L / contract |");
  log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const t of trades.slice(0, 15)) {
    log(`| ${t.strategyName} | \`${t.ticker}\` | ${t.side} | ${t.entryPrice.toFixed(2)} | ` +
        `${t.exitPrice === null || t.exitPrice === undefined ? t.exitReason : t.exitPrice.toFixed(2)} | ` +
        `${t.result || "n/a"} | ${t.pnlPerContract === null ? "n/a" : t.pnlPerContract.toFixed(2)} |`);
  }
}

log();
log("---");
log();
log("Simulated fills ignore fees, spread and slippage, so the P&L above is optimistic (flag F15).");
log("A rule that produced no trades is reported as zero trades, not as a zero result.");

const out = process.argv[2] || path.join(ROOT, "reports/live-engine-check.md");
await writeFile(out, lines.join("\n") + "\n", "utf8");
console.log(`\nwritten: ${out}`);

// Unit tests for assets/js/alerts-core.js (pure logic, no network).
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectMoves, watchCheck, planTrades, updateTrade, summarize,
  pickUniverse, chunk, quoteOf, volumePriceProxy, THRESHOLD, WATCH_RULES,
  marketRefFromAlert, seriesContractLinks, isNonPublicHost, CONTRACT_FIELDS,
  NON_PUBLIC_CONTRACT_HOSTS
} from "../assets/js/alerts-core.js";

const mk = (over = {}) => ({
  ticker: "KXT-1",
  title: "Test market",
  status: "active",
  last_price_dollars: "0.4500",
  yes_bid_dollars: "0.4400",
  yes_ask_dollars: "0.4600",
  no_bid_dollars: "0.5400",
  no_ask_dollars: "0.5600",
  open_interest_fp: "120.00",
  volume_fp: "300.00",
  volume_24h_fp: "40.00",
  result: "",
  _topic: "elections",
  _event_ticker: "EV-1",
  ...over
});

test("first observation sets a baseline and never alerts", () => {
  const { alerts, next } = detectMoves({}, [mk()], { at: 1000 });
  assert.equal(alerts.length, 0);
  assert.deepEqual(next["KXT-1"], { price: 0.45, at: 1000 });
});

test("a move of exactly $0.10 up alerts (float-safe) with direction up", () => {
  const prev = { "KXT-1": { price: 0.45, at: 1 } };
  const { alerts } = detectMoves(prev, [mk({ last_price_dollars: "0.5500" })], { at: 2 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].delta, 0.1);
  assert.equal(alerts[0].direction, "up");
  assert.equal(alerts[0].from, 0.45);
  assert.equal(alerts[0].to, 0.55);
  assert.equal(alerts[0].prevAt, 1);
});

test("a $0.12 move down alerts; a $0.09 move does not", () => {
  const prev = { "KXT-1": { price: 0.45, at: 1 } };
  const down = detectMoves(prev, [mk({ last_price_dollars: "0.3300" })], { at: 2 });
  assert.equal(down.alerts.length, 1);
  assert.equal(down.alerts[0].direction, "down");
  assert.equal(down.alerts[0].delta, -0.12);
  const small = detectMoves(prev, [mk({ last_price_dollars: "0.5400" })], { at: 2 });
  assert.equal(small.alerts.length, 0);
  assert.equal(small.next["KXT-1"].price, 0.54);
});

test("markets without a trade price keep their previous baseline", () => {
  const prev = { "KXT-1": { price: 0.45, at: 1 } };
  const { alerts, next } = detectMoves(prev, [mk({ last_price_dollars: null })], { at: 2 });
  assert.equal(alerts.length, 0);
  assert.deepEqual(next["KXT-1"], { price: 0.45, at: 1 });
});

test("detectMoves never mutates the previous map", () => {
  const prev = { "KXT-1": { price: 0.45, at: 1 } };
  detectMoves(prev, [mk({ last_price_dollars: "0.6000" })], { at: 2 });
  assert.deepEqual(prev, { "KXT-1": { price: 0.45, at: 1 } });
});

test("threshold constant is the brief's $0.10", () => {
  assert.equal(THRESHOLD, 0.10);
});

test("High-ROI watch passes on a tight two-sided mid-band market", () => {
  const { alerts } = detectMoves({ "KXT-1": { price: 0.45, at: 1 } }, [mk({ last_price_dollars: "0.5600" })], { at: 2 });
  const w = watchCheck(alerts[0]);
  assert.equal(w.pass, true, JSON.stringify(w.checks));
});

test("High-ROI watch fails on a wide spread, a near-settled price, or a missing ask", () => {
  const base = { "KXT-1": { price: 0.45, at: 1 } };
  const wide = detectMoves(base, [mk({ last_price_dollars: "0.5600", yes_bid_dollars: "0.45", yes_ask_dollars: "0.56" })], { at: 2 }).alerts[0];
  assert.equal(watchCheck(wide).pass, false);
  assert.equal(watchCheck(wide).checks.find(c => c.key === "spread").ok, false);

  const high = detectMoves(base, [mk({ last_price_dollars: "0.9600", yes_bid_dollars: "0.95", yes_ask_dollars: "0.96" })], { at: 2 }).alerts[0];
  assert.equal(watchCheck(high).checks.find(c => c.key === "price-band").ok, false);

  const noAsk = detectMoves(base, [mk({ last_price_dollars: "0.5600", yes_ask_dollars: null })], { at: 2 }).alerts[0];
  assert.equal(watchCheck(noAsk).checks.find(c => c.key === "two-sided").ok, false);
});

test("Follow buys the side the move went toward; Fade buys the opposite", () => {
  const base = { "KXT-1": { price: 0.45, at: 1 } };
  const up = detectMoves(base, [mk({ last_price_dollars: "0.5600" })], { at: 2 }).alerts;
  const trades = planTrades(up, [], { watch: new Map([[up[0].id, watchCheck(up[0])]]), at: 2 }).created;
  const byKey = Object.fromEntries(trades.map(t => [t.strategy, t]));
  assert.equal(byKey["follow-all"].side, "yes");
  assert.equal(byKey["follow-all"].entry, 0.46);
  assert.equal(byKey["fade-all"].side, "no");
  assert.equal(byKey["fade-all"].entry, 0.56);
  assert.ok(byKey["follow-watch"] && byKey["fade-watch"], "watch strategies run when the alert passes the rule");

  const down = detectMoves({ "KXT-1": { price: 0.60, at: 1 } }, [mk({ last_price_dollars: "0.45", yes_bid_dollars: "0.44", yes_ask_dollars: "0.46", no_ask_dollars: "0.56" })], { at: 2 }).alerts;
  const d = planTrades(down, [], { watch: new Map(), at: 2 }).created;
  const dk = Object.fromEntries(d.map(t => [t.strategy, t]));
  assert.equal(dk["follow-all"].side, "no");
  assert.equal(dk["fade-all"].side, "yes");
  assert.equal(dk["follow-watch"], undefined, "watch-only strategies skip alerts that fail the rule");
});

test("a strategy never holds two open positions in the same market; missing asks are counted, not filled", () => {
  const base = { "KXT-1": { price: 0.45, at: 1 } };
  const a1 = detectMoves(base, [mk({ last_price_dollars: "0.5600" })], { at: 2 }).alerts;
  const first = planTrades(a1, [], { at: 2 });
  const a2 = detectMoves({ "KXT-1": { price: 0.56, at: 2 } }, [mk({ last_price_dollars: "0.6700" })], { at: 3 }).alerts;
  const second = planTrades(a2, first.created, { at: 3 });
  assert.equal(second.created.filter(t => t.strategy === "follow-all").length, 0);
  assert.ok(second.skipped["already holding this market in this strategy"] > 0);

  const noAsk = detectMoves(base, [mk({ last_price_dollars: "0.5600", no_ask_dollars: null, yes_ask_dollars: "0.5600" })], { at: 2 }).alerts;
  const r = planTrades(noAsk, [], { at: 2 });
  assert.ok(r.skipped["no NO ask in the poll that raised the alert"] > 0);
});

test("a trade resolves only on an official yes/no result and pays $1 for the matching side", () => {
  const t = { id: "x", ticker: "KXT-1", side: "yes", entry: 0.46, status: "open" };
  const m = updateTrade(t, mk({ result: "yes" }), 9);
  assert.equal(m.status, "resolved");
  assert.equal(m.payout, 1);
  assert.equal(m.pnl, 0.54);
  const lose = updateTrade({ ...t, side: "no", entry: 0.56 }, mk({ result: "yes" }), 9);
  assert.equal(lose.payout, 0);
  assert.equal(lose.pnl, -0.56);
});

test("an open trade is marked at the best bid for its side, not at last price", () => {
  const t = { id: "x", ticker: "KXT-1", side: "yes", entry: 0.46, status: "open" };
  const m = updateTrade(t, mk({ yes_bid_dollars: "0.5000" }), 5);
  assert.equal(m.status, "open");
  assert.equal(m.mark, 0.5);
  assert.equal(m.unrealized, 0.04);
  const n = updateTrade({ ...t, side: "no", entry: 0.56 }, mk({ no_bid_dollars: null }), 5);
  assert.equal(n.mark, null);
  assert.equal(n.unrealized, null);
});

test("summary figures are null (not zero) when there is nothing to compute", () => {
  const s = summarize([]);
  assert.equal(s.length, 4);
  for (const row of s) {
    assert.equal(row.trades, 0);
    assert.equal(row.winRate, null);
    assert.equal(row.realized, null);
    assert.equal(row.roi, null);
  }
});

test("summary computes win rate, realized P&L and ROI on cost from resolved trades", () => {
  const trades = [
    { strategy: "follow-all", status: "resolved", entry: 0.46, pnl: 0.54, unrealized: null },
    { strategy: "follow-all", status: "resolved", entry: 0.50, pnl: -0.50, unrealized: null },
    { strategy: "follow-all", status: "open", entry: 0.30, pnl: null, unrealized: 0.05 }
  ];
  const row = summarize(trades).find(r => r.key === "follow-all");
  assert.equal(row.trades, 3);
  assert.equal(row.resolved, 2);
  assert.equal(row.wins, 1);
  assert.equal(row.winRate, 0.5);
  assert.equal(row.realized, 0.04);
  assert.equal(row.roi, 0.04 / 0.96);
  assert.equal(row.unrealized, 0.05);
});

test("pickUniverse keeps the top N per topic by the volume-price proxy plus kept tickers", () => {
  const markets = [];
  for (let i = 0; i < 5; i++) markets.push(mk({ ticker: `E-${i}`, _topic: "gas", volume_fp: String(10 * (i + 1)), last_price_dollars: "0.5000" }));
  markets.push(mk({ ticker: "C-1", _topic: "crypto", volume_fp: "1", last_price_dollars: "0.1000" }));
  markets.push(mk({ ticker: "NOTOPIC", _topic: null }));
  const u = pickUniverse(markets, { perTopic: 2, keep: ["C-1", "E-0"] }).map(m => m.ticker).sort();
  assert.deepEqual(u, ["C-1", "E-0", "E-3", "E-4"]);
});

test("volume-price proxy is contract volume times current last YES price, or null if either is missing", () => {
  assert.equal(volumePriceProxy(mk({ volume_fp: "12.00", last_price_dollars: "0.2500" })), 3);
  assert.equal(volumePriceProxy(mk({ volume_fp: null, last_price_dollars: "0.2500" })), null);
  assert.equal(volumePriceProxy(mk({ volume_fp: "12.00", last_price_dollars: null })), null);
});

test("chunk splits arrays without losing items", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 25), []);
});

test("quoteOf derives the yes spread and keeps missing values null", () => {
  assert.equal(quoteOf(mk()).spread, 0.02);
  assert.equal(quoteOf(mk({ yes_ask_dollars: null })).spread, null);
});

test("High-ROI rule constants are the documented parameters", () => {
  assert.equal(WATCH_RULES.maxSpread, 0.05);
  assert.equal(WATCH_RULES.minPrice, 0.10);
  assert.equal(WATCH_RULES.maxPrice, 0.90);
});

/* ---- track-to-resolution reference (session 02091230) --------------------- */

test("marketRefFromAlert maps the alert's own documented fields and never invents one", () => {
  const a = {
    ticker: "KXAAAGASW-26NOV23-3.6400",
    title: "US gas prices this week",
    eventTicker: "KXAAAGASW-26NOV23",
    to: 0.04,
    status: "active",
    result: null,
    quote: { yesBid: 0.02, yesAsk: 0.04, spread: 0.02 }
  };
  const ref = marketRefFromAlert(a);
  assert.equal(ref.ticker, a.ticker);
  assert.equal(ref.event_ticker, a.eventTicker);
  assert.equal(ref.last_price_dollars, 0.04);
  assert.equal(ref.yes_bid_dollars, 0.02);
  assert.equal(ref.yes_ask_dollars, 0.04);
  // Not on an alert: stays null, so the UI shows n/a rather than $0.00 / a date.
  assert.equal(ref.close_time, null);
  assert.equal(ref.result, "");
});

test("marketRefFromAlert keeps a missing quote side null and rejects a tickerless alert", () => {
  const ref = marketRefFromAlert({ ticker: "T", to: 0.5 });
  assert.equal(ref.yes_bid_dollars, null);
  assert.equal(ref.yes_ask_dollars, null);
  assert.equal(marketRefFromAlert(null), null);
  assert.equal(marketRefFromAlert({ to: 0.5 }), null);
});

/* ---------------------------------------------------- series contract links
 *
 * Field semantics: https://docs.kalshi.com/api-reference/market/get-series
 *   contract_url        = "a direct link to the original filing of the contract"
 *   contract_terms_url  = "the URL to the current terms of the contract"
 * The staging host is the one Flagged X1 records as refusing public requests.
 */

// Exactly the values a live demo GET /series/KXGAS returned on 2026-11-22.
const KXGAS_SERIES = {
  ticker: "KXGAS",
  contract_url: "https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/GAS.pdf",
  contract_terms_url: "https://assets.kalshi.com/contract_terms/GAS.pdf"
};

test("a staging-host contract_url is withheld, never rendered", () => {
  const { links, withheld } = seriesContractLinks(KXGAS_SERIES);
  assert.deepEqual(links.map(l => l.url), ["https://assets.kalshi.com/contract_terms/GAS.pdf"]);
  assert.equal(withheld.length, 1);
  assert.equal(withheld[0].field, "contract_url");
  assert.equal(withheld[0].host, "kalshi-public-docs-staging.s3.us-east-1.amazonaws.com");
  assert.match(withheld[0].reason, /public requests/);
});

test("both documented documents are offered when both hosts are public", () => {
  const { links, withheld } = seriesContractLinks({
    contract_url: "https://kalshi.com/filings/A.pdf",
    contract_terms_url: "https://kalshi.com/terms/A.pdf"
  });
  assert.deepEqual(links.map(l => l.field), ["contract_terms_url", "contract_url"]);
  assert.deepEqual(links.map(l => l.label), ["current contract terms", "original contract filing"]);
  assert.deepEqual(withheld, []);
});

test("the terms document is preferred regardless of the field order in the response", () => {
  const a = seriesContractLinks({
    contract_url: "https://kalshi.com/filings/A.pdf",
    contract_terms_url: "https://kalshi.com/terms/A.pdf"
  });
  const b = seriesContractLinks({
    contract_terms_url: "https://kalshi.com/terms/A.pdf",
    contract_url: "https://kalshi.com/filings/A.pdf"
  });
  assert.deepEqual(a.links, b.links);
  assert.equal(CONTRACT_FIELDS[0].field, "contract_terms_url");
});

test("only when a series publishes neither document does the page get no link", () => {
  assert.deepEqual(seriesContractLinks({}), { links: [], withheld: [] });
  assert.deepEqual(seriesContractLinks(null), { links: [], withheld: [] });
  assert.deepEqual(seriesContractLinks({ contract_url: "", contract_terms_url: null }),
    { links: [], withheld: [] });
});

test("a documented URL that is not absolute https is withheld with its reason, not repaired", () => {
  const { links, withheld } = seriesContractLinks({
    contract_url: "http://kalshi.com/filings/A.pdf",
    contract_terms_url: "/terms/A.pdf"
  });
  assert.deepEqual(links, []);
  assert.equal(withheld.length, 2);
  assert.ok(withheld.every(w => w.reason === "not an absolute https URL"));
});

test("the non-public host list is explicit and matched on host boundaries only", () => {
  assert.deepEqual([...NON_PUBLIC_CONTRACT_HOSTS],
    ["kalshi-public-docs-staging.s3.us-east-1.amazonaws.com"]);
  assert.equal(isNonPublicHost(KXGAS_SERIES.contract_url), true);
  assert.equal(isNonPublicHost("https://assets.kalshi.com/contract_terms/GAS.pdf"), false);
  // A host that merely contains the string is not the listed host.
  assert.equal(isNonPublicHost("https://example.org/?u=kalshi-public-docs-staging.s3.us-east-1.amazonaws.com"), false);
  assert.equal(isNonPublicHost("not a url"), false);
});

test("the series record may arrive wrapped, as GET /series returns it", () => {
  const { links } = seriesContractLinks({ series: KXGAS_SERIES });
  assert.equal(links.length, 1);
  assert.equal(links[0].url, "https://assets.kalshi.com/contract_terms/GAS.pdf");
});

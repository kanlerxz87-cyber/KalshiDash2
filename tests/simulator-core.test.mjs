import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  aggregateBreakdowns,
  replayRandomControl,
  replayStrategy,
  tradesToCsv
} from "../assets/js/simulator.js";

const market = {
  ticker: "T-TEST-1",
  event_ticker: "E-TEST",
  event_title: "Test event",
  topic: "crypto",
  category: "Crypto",
  series_ticker: "T-TEST",
  result: "no",
  settlement_value_dollars: "0.0000",
  settlement_ts: "2026-01-01T00:00:00.000Z"
};

const fadeNo = {
  key: "fade-no",
  name: "Fade extreme NO",
  side: "no",
  hold: "settlement",
  signal: c => c.close >= 0.9 ? c.close : null
};

test("NO settlement P&L uses the complement of the YES entry quote", () => {
  const trade = replayStrategy(fadeNo, [{ t: 1000, close: 0.9, prevClose: 0.8, volume: 1 }], market);
  assert.ok(Math.abs(trade.entryPrice - 0.1) < 1e-12);
  assert.ok(Math.abs(trade.capitalPerContract - 0.1) < 1e-12);
  assert.equal(trade.payout, 1);
  assert.ok(Math.abs(trade.pnlPerContract - 0.9) < 1e-12);
  assert.equal(trade.yesPriceAtEntry, 0.9);
});

test("NO-side loss against a YES settlement is the NO entry cost", () => {
  const trade = replayStrategy(fadeNo, [{ t: 1000, close: 0.9, prevClose: 0.8, volume: 1 }], {
    ...market, result: "yes", settlement_value_dollars: "1.0000"
  });
  assert.equal(trade.payout, 0);
  assert.ok(Math.abs(trade.pnlPerContract + 0.1) < 1e-12);
});

test("random control is deterministic and uses the side-specific entry price", () => {
  const candles = [
    { t: 1000, close: 0.2, prevClose: 0.1, volume: 1 },
    { t: 2000, close: 0.5, prevClose: 0.2, volume: 2 },
    { t: 3000, close: 0.8, prevClose: 0.5, volume: 3 }
  ];
  const a = replayRandomControl(candles, market);
  const b = replayRandomControl(candles, market);
  assert.deepEqual(a, b);
  assert.ok(candles.some(c => c.t === a.entryTs));
  assert.ok(a.entryPrice >= 0 && a.entryPrice <= 1);
  assert.equal(a.entryPrice, a.side === "yes" ? a.yesPriceAtEntry : 1 - a.yesPriceAtEntry);
  assert.equal(a.exitReason, "held to settlement (random control)");
});

test("aggregates include independent topic and YES/NO rollups", () => {
  const trades = [
    { strategyKey: "s", strategyName: "S", topic: "crypto", side: "yes", ticker: "A", entryPrice: 0.2, capitalPerContract: 0.2, pnlPerContract: 0.3 },
    { strategyKey: "s", strategyName: "S", topic: "crypto", side: "no", ticker: "B", entryPrice: 0.4, capitalPerContract: 0.4, pnlPerContract: -0.1 },
    { strategyKey: "s", strategyName: "S", topic: "golf", side: "yes", ticker: "C", entryPrice: 0.5, capitalPerContract: 0.5, pnlPerContract: 0 }
  ];
  const rows = aggregateBreakdowns(trades);
  const crypto = rows.find(r => r.dimension === "Topic" && r.value === "crypto");
  const yes = rows.find(r => r.dimension === "Direction" && r.value === "YES");
  const no = rows.find(r => r.dimension === "Direction" && r.value === "NO");
  assert.equal(crypto.trades, 2);
  assert.ok(Math.abs(crypto.pnl - 0.2) < 1e-12);
  assert.ok(Math.abs(crypto.roi - (0.2 / 0.6)) < 1e-12);
  assert.equal(yes.trades, 2);
  assert.equal(no.trades, 1);
  assert.equal(aggregate(trades).length, 1);
});

test("CSV ledger export includes official-source URLs and escapes formula-like text", () => {
  const trade = {
    strategyName: "Control",
    ticker: "T/1",
    eventTicker: "E/1",
    eventTitle: '=HYPERLINK("bad")',
    topic: "culture",
    side: "yes",
    entryPrice: 0.25,
    yesPriceAtEntry: 0.25,
    entryTs: 1000,
    exitPrice: null,
    exitReason: "held to settlement",
    result: "no",
    settlementValue: 0,
    payout: 0,
    pnlPerContract: -0.25,
    capitalPerContract: 0.25
  };
  const csv = tradesToCsv([trade]);
  assert.match(csv, /"market_source"/);
  assert.match(csv, /https:\/\/external-api\.demo\.kalshi\.co\/trade-api\/v2\/markets\/T%2F1/);
  assert.match(csv, /https:\/\/external-api\.demo\.kalshi\.co\/trade-api\/v2\/events\/E%2F1/);
  assert.match(csv, /'\\?=HYPERLINK/);
  assert.ok(csv.includes("\r\n"));
});

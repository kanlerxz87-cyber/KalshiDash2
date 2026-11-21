import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  aggregateBreakdowns,
  fillFeeDollars,
  replayRandomControl,
  replayStrategy,
  takerFeeMultiplier,
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

/* ---- official fee schedule parity (session bc079e84) ----------------------
 * Every value below is transcribed from the official fee table in
 * https://kalshi.com/docs/kalshi-fee-schedule.pdf ("Fee Schedule for July
 * 2026 - 7.7.26 Update"), columns "Fee for 1 contract" and
 * "Fee for 100 contracts". The rounding mechanics are from
 * https://docs.kalshi.com/getting_started/fee_rounding. */
const OFFICIAL_FEE_TABLE = [
  [0.01, 0.01, 0.07], [0.05, 0.01, 0.34], [0.10, 0.01, 0.63], [0.15, 0.01, 0.90],
  [0.20, 0.02, 1.12], [0.25, 0.02, 1.32], [0.30, 0.02, 1.47], [0.35, 0.02, 1.60],
  [0.40, 0.02, 1.68], [0.45, 0.02, 1.74], [0.50, 0.02, 1.75], [0.55, 0.02, 1.74],
  [0.60, 0.02, 1.68], [0.65, 0.02, 1.60], [0.70, 0.02, 1.47], [0.75, 0.02, 1.32],
  [0.80, 0.02, 1.12], [0.85, 0.01, 0.90], [0.90, 0.01, 0.63], [0.95, 0.01, 0.34],
  [0.99, 0.01, 0.07]
];

test("net taker fee reproduces every published fee-table value", () => {
  for (const [price, fee1, fee100] of OFFICIAL_FEE_TABLE) {
    const one = fillFeeDollars({ price, count: 1, multiplier: 1 }).netFee;
    const hundred = fillFeeDollars({ price, count: 100, multiplier: 1 }).netFee;
    assert.ok(Math.abs(one - fee1) < 1e-9, `1 contract at ${price}: got ${one}, official ${fee1}`);
    assert.ok(Math.abs(hundred - fee100) < 1e-9, `100 contracts at ${price}: got ${hundred}, official ${fee100}`);
  }
});

test("fee rounding matches the official Fee Rounding worked example", () => {
  // The page's example: revenue -$0.055, model fee $0.00363825 ->
  // trade fee $0.003639, rounding fee $0.001361, net $0.005.
  // That is exactly a 1-contract buy at $0.055 under the taker formula.
  const f = fillFeeDollars({ price: 0.055, count: 1, multiplier: 1, action: "buy" });
  assert.ok(Math.abs(f.modelFee - 0.00363825) < 1e-12);
  assert.ok(Math.abs(f.tradeFee - 0.003639) < 1e-12);
  assert.ok(Math.abs(f.roundingFee - 0.001361) < 1e-12);
  assert.ok(Math.abs(f.netFee - 0.005) < 1e-12);
});

test("Non-Standard Fees zero-multiplier series pay no taker fee", () => {
  assert.equal(takerFeeMultiplier("KXBTCY"), 0);
  assert.equal(takerFeeMultiplier("KXETHY"), 0);
  assert.equal(takerFeeMultiplier("KXPGATOUR"), 1); // listed 1/1 in the PDF
  assert.equal(takerFeeMultiplier("KXUNKNOWN"), 1); // general default
  const f = fillFeeDollars({ price: 0.5, count: 100, multiplier: takerFeeMultiplier("KXBTCY") });
  assert.equal(f.netFee, 0);
});

test("replayed trades carry fee and net P&L fields; settlement exits add no exit fee", () => {
  const settleTrade = replayStrategy(fadeNo, [{ t: 1000, close: 0.9, prevClose: 0.8, volume: 1 }], {
    ...market, series_ticker: "KXPGATOUR"
  });
  // Entry: 1 contract NO at 0.10 -> official table fee $0.01; settlement exit: no fee.
  assert.ok(Math.abs(settleTrade.feePerContract - 0.01) < 1e-9);
  assert.ok(Math.abs(settleTrade.pnlNetPerContract - (settleTrade.pnlPerContract - 0.01)) < 1e-9);

  const roundTrip = replayStrategy(
    { key: "rt", name: "RT", side: "yes", hold: "roundtrip", signal: c => c.close >= 0.3 ? c.close : null },
    [
      { t: 1000, close: 0.3, prevClose: 0.2, volume: 1 },
      { t: 2000, close: 0.4, prevClose: 0.3, volume: 1 }
    ],
    { ...market, series_ticker: "KXPGATOUR" }
  );
  // Entry 0.30 -> $0.02 (table); exit sell at 0.40 -> $0.02 (table); total $0.04.
  assert.ok(Math.abs(roundTrip.feePerContract - 0.04) < 1e-9, `fees: ${roundTrip.feePerContract}`);
  assert.ok(Math.abs(roundTrip.pnlNetPerContract - (roundTrip.pnlPerContract - 0.04)) < 1e-9);

  const control = replayRandomControl(
    [{ t: 1000, close: 0.2, prevClose: 0.1, volume: 1 }],
    { ...market, series_ticker: "KXBTCY" }
  );
  // Zero-multiplier series: entry fee is $0 even though a fee field exists.
  assert.equal(control.feePerContract, 0);
  assert.ok(Math.abs(control.pnlNetPerContract - control.pnlPerContract) < 1e-12);
});

test("CSV ledger export carries fee columns and official fee-schedule links", () => {
  const trade = replayStrategy(fadeNo, [{ t: 1000, close: 0.9, prevClose: 0.8, volume: 1 }], {
    ...market, series_ticker: "KXPGATOUR"
  });
  const csv = tradesToCsv([trade]);
  assert.match(csv, /"fee_per_contract"/);
  assert.match(csv, /"pnl_net_of_fees_per_contract"/);
  assert.match(csv, /https:\/\/kalshi\.com\/docs\/kalshi-fee-schedule\.pdf/);
  assert.match(csv, /https:\/\/docs\.kalshi\.com\/getting_started\/fee_rounding/);
});

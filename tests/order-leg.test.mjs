/* KalshiDash2 — order submission must be expressed in the endpoint's YES-leg
 * vocabulary.
 *
 * The V2 order endpoint is single-book and quotes the YES leg only:
 *   "For event markets, this refers to the YES leg only: `bid` means buy YES,
 *    `ask` means sell YES."
 *   (https://docs.kalshi.com/api-reference/orders/create-order-v2)
 * The direction guide pins the bit and the legacy equivalence table:
 *   bid ≡ yes, ask ≡ no; buy YES ≡ bid, sell YES ≡ ask, buy NO ≡ ask, sell NO ≡ bid
 *   (https://docs.kalshi.com/getting_started/order_direction)
 *
 * Therefore, with `priceDollars` = price of the outcome the caller named:
 *   buy YES at p  → side "bid",  price p
 *   sell YES at p → side "ask", price p
 *   buy NO at p   → side "bid",  price 1 − p
 *   sell NO at p  → side "ask", price 1 − p
 * `side` is the caller's own bid/ask on the outcome they named (buy = bid,
 * sell = ask), and `price` is always the YES-leg price. A NO order MUST have
 * its price complemented: buying NO at 63¢ means paying 63¢ for the NO
 * outcome, i.e. the YES leg is priced at 37¢. Sending 0.6300 with a bid buys
 * YES at 63¢ — the opposite position. This is also the rule the official
 * traded-dollar code applies: `count_fp × p` for a YES taker, `count_fp ×
 * (1 − p)` for a NO taker (assets/js/dollar-volume.js).
 *
 * Runs offline: `request` (the network boundary) is replaced with a recorder.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

function recorder() {
  const calls = [];
  const client = {
    calls,
    request: null,
    async createOrder(opts) {
      return KalshiClient.prototype.createOrder.call(this, opts);
    }
  };
  client.request = async (method, path, body) => {
    calls.push({ method, path, body });
    return { order_id: "test-order", fill_count: "0.00", remaining_count: body.count, ts_ms: 1 };
  };
  return client;
}

let KalshiClient;
test("module loads", async () => {
  ({ KalshiClient } = await import("../assets/js/kalshi.js"));
  assert.ok(KalshiClient);
});

test("buy YES at 0.42 → bid, price 0.4200", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "yes", action: "buy", priceDollars: 0.42, count: 5 });
  assert.equal(c.calls.length, 1);
  assert.equal(c.calls[0].method, "POST");
  assert.equal(c.calls[0].path, "/portfolio/events/orders");
  assert.equal(c.calls[0].body.side, "bid");
  assert.equal(c.calls[0].body.price, "0.4200");
});

test("buy NO at 0.63 → bid, price 0.3700 (the YES-leg complement)", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "no", action: "buy", priceDollars: 0.63, count: 10 });
  assert.equal(c.calls[0].body.side, "bid", "a buy is a bid; the side is the caller's own");
  assert.equal(c.calls[0].body.price, "0.3700", "NO price 0.63 is YES price 0.37");
  assert.equal(c.calls[0].body.count, "10.00");
  assert.equal(c.calls[0].body.ticker, "KXTEST-1");
});

test("sell YES at 0.42 → ask, price 0.4200; sell NO at 0.63 → ask, price 0.3700", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "yes", action: "sell", priceDollars: 0.42, count: 5 });
  assert.equal(c.calls[0].body.side, "ask");
  assert.equal(c.calls[0].body.price, "0.4200");
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "no", action: "sell", priceDollars: 0.63, count: 5 });
  assert.equal(c.calls[1].body.side, "ask");
  assert.equal(c.calls[1].body.price, "0.3700");
  /* A 0.42 YES ask and a 0.63 NO ask are different YES-leg prices (0.42 vs
     0.37) but the same side, because `side` describes the caller's intent. */
  assert.equal(c.calls[0].body.side, c.calls[1].body.side);
  assert.notEqual(c.calls[0].body.price, c.calls[1].body.price);
});

test("the round trip: the YES-leg price is always the complement of the NO price", async () => {
  const c = recorder();
  for (const [side, action, p] of [["yes", "buy", 0.10], ["no", "buy", 0.90], ["yes", "sell", 0.25], ["no", "sell", 0.75]]) {
    await c.createOrder({ ticker: "KXTEST-1", outcomeSide: side, action, priceDollars: p, count: 1 });
  }
  /* Every order carries its YES-leg price: a 0.10 YES order and a 0.90 NO
     order are the same YES-leg price with opposite sides. */
  const sent = c.calls.map(k => `${k.body.side} ${k.body.price}`);
  assert.deepEqual(sent, ["bid 0.1000", "bid 0.1000", "ask 0.2500", "ask 0.2500"],
    "buy YES 0.10 and buy NO 0.90 are both a 0.10 YES-leg bid; sell YES 0.25 and sell NO 0.75 are both a 0.25 YES-leg ask");
});

test("the order body carries only documented fields", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "no", priceDollars: 0.5, count: 1 });
  const body = c.calls[0].body;
  for (const k of Object.keys(body)) {
    assert.ok(["ticker", "side", "count", "price", "time_in_force",
      "self_trade_prevention_type", "client_order_id", "exchange_index"].includes(k),
      `undocumented field sent: ${k}`);
  }
  assert.equal(typeof body.price, "string", "price is a fixed-point string, not a number");
  assert.match(body.price, /^\d+\.\d{4}$/, "price is fixed-point with 4 decimals");
});

test("an invalid outcome or action is rejected before any request", async () => {
  const c = recorder();
  await assert.rejects(() => c.createOrder({ ticker: "KXTEST-1", outcomeSide: "maybe", priceDollars: 0.5, count: 1 }));
  await assert.rejects(() => c.createOrder({ ticker: "KXTEST-1", outcomeSide: "yes", action: "hold", priceDollars: 0.5, count: 1 }));
  assert.equal(c.calls.length, 0);
});

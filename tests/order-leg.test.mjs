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
 * So `side` follows the POSITION DIRECTION on the YES leg (long YES → bid,
 * short YES → ask), and `price` is always the YES-leg price. With
 * `priceDollars` = price of the outcome the caller named:
 *   buy YES at p  → side "bid",  price p
 *   sell YES at p → side "ask", price p
 *   buy NO at q   → side "ask", price 1 − q
 *   sell NO at q  → side "bid",  price 1 − q
 * Buying NO at 63¢ is selling YES at 37¢. Sending `bid` at 0.37 would buy YES
 * at 37¢ — the opposite position. This matches the official traded-dollar rule
 * (`count_fp × p` for a YES taker, `count_fp × (1 − p)` for a NO taker) and the
 * quick-start example ("buy 1 YES contract for 1 cent" → `bid`, `0.0100`).
 *
 * Runs offline: `request` (the network boundary) is replaced with a recorder.
 * Complements tests/order-contract.test.mjs, which pins the same mapping
 * through a real signed request.
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

test("buy NO at 0.63 → ask, price 0.3700 (buy NO ≡ sell YES)", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "no", action: "buy", priceDollars: 0.63, count: 10 });
  assert.equal(c.calls[0].body.side, "ask", "buy NO ≡ sell YES ≡ ask");
  assert.equal(c.calls[0].body.price, "0.3700", "NO price 0.63 is YES price 0.37");
  assert.equal(c.calls[0].body.count, "10.00");
  assert.equal(c.calls[0].body.ticker, "KXTEST-1");
});

test("sell YES at 0.42 → ask, price 0.4200; sell NO at 0.63 → bid, price 0.3700", async () => {
  const c = recorder();
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "yes", action: "sell", priceDollars: 0.42, count: 5 });
  assert.equal(c.calls[0].body.side, "ask");
  assert.equal(c.calls[0].body.price, "0.4200");
  await c.createOrder({ ticker: "KXTEST-1", outcomeSide: "no", action: "sell", priceDollars: 0.63, count: 5 });
  assert.equal(c.calls[1].body.side, "bid", "sell NO ≡ buy YES ≡ bid");
  assert.equal(c.calls[1].body.price, "0.3700");
  /* A 0.42 YES ask and a 0.63 NO ask are different YES-leg prices (0.42 vs
     0.37) but the same side, because `side` describes the position direction. */
  assert.equal(c.calls[0].body.side, c.calls[1].body.side === "bid" ? "ask" : null);
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
  assert.deepEqual(sent, ["bid 0.1000", "ask 0.1000", "ask 0.2500", "bid 0.2500"],
    "buy YES 0.10 and buy NO 0.90 are both a 0.10 YES-leg price with opposite sides; sell YES 0.25 and sell NO 0.75 likewise");
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

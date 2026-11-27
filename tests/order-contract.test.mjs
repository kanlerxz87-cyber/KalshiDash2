// Order-write contract, pinned offline against the official documentation.
// Run: node --test tests/order-contract.test.mjs
//
// Why this file exists. The demo order path is the one part of the site that
// cannot be exercised from this container: placing an order needs a demo API
// key, and no key exists in the repository. So the two failures that would
// silently cost real (mock) money are pinned here instead, against the text of
// the official pages, with a fake `fetch` standing in for the exchange:
//
//  1. A `side: "ask"` order is a *NO* purchase, not a YES sale. The site's
//     earlier form offered "Sell Yes (ask)", which opened the opposite
//     position. https://docs.kalshi.com/getting_started/order_direction
//  2. The request carries a millisecond timestamp. The docs say the header is
//     "Request timestamp in milliseconds" and signing uses the same string, so
//     a seconds-based timestamp is both a bad signature and an expired one.
//     https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
//     https://docs.kalshi.com/api-reference/orders/create-order-v2
//
// The test drives the real client, not a copy of it, so it fails if
// assets/js/kalshi.js drifts away from either rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { KalshiClient, deriveQuote, liquidityAtPrice } from "../assets/js/kalshi.js";

// --- a real key pair, generated per run: the client really signs ------------
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });

// --- capture the one request the client makes ------------------------------
function capture() {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 201,
      statusText: "Created",
      text: async () => JSON.stringify({
        order_id: "3b23c1c7-f4ef-4f0d-8b9a-9e53c61f1a0d",
        client_order_id: JSON.parse(init.body).client_order_id,
        fill_count: "0.00",
        remaining_count: "1.00",
        ts_ms: 1715793600123
      })
    };
  };
  return calls;
}

const b64decode = s => Buffer.from(s, "base64");

test("buying YES sends side=bid and buys the yes outcome", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });

  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.side, "bid", "bid ≡ yes, per the order-direction table");
  assert.equal(body.ticker, "KXDEMO-26NOV22-T50");
});

test("buying NO sends side=ask and is never labelled a YES sale", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "no", priceDollars: 0.5, count: 1 });

  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.side, "ask", "ask ≡ no, per the order-direction table");
  // The regression this guards: an option reading "Sell Yes (ask)".
  assert.notEqual(body.side, "sell");
});

test("the V2 body carries every documented required field", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 2 });

  const body = JSON.parse(calls[0].init.body);
  for (const field of ["ticker", "side", "count", "price", "time_in_force", "self_trade_prevention_type"]) {
    assert.ok(body[field] !== undefined && body[field] !== "", `required field ${field} is present`);
  }
  assert.equal(body.time_in_force, "good_till_canceled");
  assert.equal(body.self_trade_prevention_type, "taker_at_cross");
  // Fixed-point strings, not JSON numbers: "2.00" / "0.5000".
  assert.equal(typeof body.count, "string");
  assert.equal(typeof body.price, "string");
  assert.match(body.count, /^\d+\.\d{2}$/);
  assert.match(body.price, /^\d+\.\d{4}$/);
});

test("the write goes to the V2 route, not the removed v1 route", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });

  assert.match(calls[0].url, /\/portfolio\/events\/orders$/);
  assert.ok(!/\/portfolio\/orders(\/|$|\?)/.test(calls[0].url),
    "the legacy /portfolio/orders write route now answers 410 deprecated_v1_order_endpoint");
  assert.equal(calls[0].init.method, "POST");
});

test("the timestamp header is epoch milliseconds, not seconds", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  const before = Date.now();
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });
  const after = Date.now();

  const ts = calls[0].init.headers["KALSHI-ACCESS-TIMESTAMP"];
  assert.match(String(ts), /^\d{13}$/, "13 digits = milliseconds; a 10-digit value would be seconds");

  const n = Number(ts);
  assert.ok(n >= before && n <= after, "the header is the moment of the request");
  // A seconds value would land ~1000x earlier and be rejected as expired.
  assert.ok(n > 1e12, "a 10-digit (seconds) timestamp would fail this bound");
});

test("the signature is over '<ms timestamp>POST<full path>' and excludes the query", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });

  const headers = calls[0].init.headers;
  const ts = headers["KALSHI-ACCESS-TIMESTAMP"];
  const path = new URL(calls[0].url).pathname; // /trade-api/v2/portfolio/events/orders
  assert.equal(path, "/trade-api/v2/portfolio/events/orders");

  const sig = b64decode(headers["KALSHI-ACCESS-SIGNATURE"]);
  const verify = msg => crypto.verify(
    "sha256",
    Buffer.from(msg),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
    sig
  );

  assert.ok(verify(`${ts}POST${path}`), "verifies against the documented pre-sign text");
  assert.ok(!verify(`${Math.floor(Number(ts) / 1000)}POST${path}`),
    "does NOT verify against a seconds-based timestamp — this is the unit regression");
  assert.ok(!verify(`${ts}POST/portfolio/events/orders`),
    "does NOT verify without the /trade-api/v2 prefix");
});

test("a 201 is reported as accepted, and remaining_count is surfaced", async () => {
  // createOrder must return the server's body untouched so callers can read
  // remaining_count; a 201 does not mean the order is resting.
  capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  const r = await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });
  assert.equal(r.remaining_count, "1.00");
  assert.equal(r.fill_count, "0.00");
});

test("exchange_index is omitted unless a caller supplies a valid shard", async () => {
  // Omitting it lets Kalshi auto-route by ticker; sending a guessed shard can
  // be rejected as insufficient_shard_balance.
  let calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1 });
  assert.equal(JSON.parse(calls[0].init.body).exchange_index, undefined);

  calls = capture();
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1, exchangeIndex: 2 });
  assert.equal(JSON.parse(calls[0].init.body).exchange_index, 2);

  calls = capture();
  await api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "yes", priceDollars: 0.5, count: 1, exchangeIndex: -1 });
  assert.equal(JSON.parse(calls[0].init.body).exchange_index, undefined, "a negative index is not sent");
});

test("an unknown outcome side is refused before any request is made", async () => {
  const calls = capture();
  const api = new KalshiClient();
  api.setCredentials({ keyId: "test-key-id", pem });
  assert.throws(
    () => api.createOrder({ ticker: "KXDEMO-26NOV22-T50", outcomeSide: "maybe", priceDollars: 0.5, count: 1 }),
    /outcomeSide/
  );
  assert.equal(calls.length, 0, "nothing was sent");
});

test("liquidityAtPrice computes exact and cumulative YES/NO contracts from reciprocal bids", () => {
  // Official Orderbook Responses rule: NO bid at y implies YES ask at 1 - y;
  // YES bid at x implies NO ask at 1 - x.
  const quote = deriveQuote({
    orderbook_fp: {
      yes_dollars: [["0.4000", "12.50"], ["0.5100", "25.00"]],
      no_dollars: [["0.4600", "40.25"], ["0.4700", "15.00"]]
    }
  });
  // YES asks are 0.5300 (15.00 contracts) and 0.5400 (40.25 contracts).
  const at53 = liquidityAtPrice(quote, { side: "yes", limitPrice: 0.53 });
  assert.equal(at53.valid, true);
  assert.equal(at53.bestAsk, 0.53);
  assert.equal(at53.exactContracts, 15);
  assert.equal(at53.fillableContracts, 15);
  assert.equal(at53.totalCostDollars, 7.95);
  assert.equal(at53.vwapDollars, 0.53);

  const at54 = liquidityAtPrice(quote, { side: "yes", limitPrice: "0.5400" });
  assert.equal(at54.exactContracts, 40.25);
  assert.equal(at54.fillableContracts, 55.25, "fractional count_fp hundredths are preserved, never rounded");
  assert.equal(at54.levelsMatched, 2);
  // 15 * 0.53 + 40.25 * 0.54 = 7.95 + 21.735 = 29.685
  assert.equal(at54.totalCostDollars, 29.685);

  // NO asks are 0.4900 (25.00 contracts from YES bid 0.51) and 0.6000 (12.50 from YES bid 0.40).
  const noAt55 = liquidityAtPrice(quote, { side: "no", limitPrice: 0.55 });
  assert.equal(noAt55.valid, true);
  assert.equal(noAt55.bestAsk, 0.49);
  assert.equal(noAt55.exactContracts, 0);
  assert.equal(noAt55.fillableContracts, 25);
  assert.equal(noAt55.totalOfferedContracts, 37.5);
});

test("liquidityAtPrice handles empty books and rejects out-of-range prices", () => {
  const empty = deriveQuote({ orderbook_fp: { yes_dollars: [], no_dollars: [] } });
  const res = liquidityAtPrice(empty, { side: "yes", limitPrice: 0.50 });
  assert.equal(res.valid, true);
  assert.equal(res.bestAsk, null);
  assert.equal(res.fillableContracts, 0);
  assert.equal(res.vwapDollars, null);

  for (const bad of ["", null, 0, 1, -0.1, 1.2, "abc"]) {
    assert.equal(liquidityAtPrice(empty, { side: "yes", limitPrice: bad }).valid, false, `rejected ${bad}`);
  }
  assert.equal(liquidityAtPrice(empty, { side: "both", limitPrice: 0.5 }).valid, false);
});

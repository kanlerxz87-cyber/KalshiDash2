/* KalshiDash2 — Kalshi DEMO API client (browser).
 *
 * Design rules, each traceable to docs.kalshi.com:
 *  - Public market data is read unauthenticated. (quick_start_market_data)
 *  - Authenticated calls are signed in this browser only: the private key never
 *    leaves the tab, is held in memory only, and is never written to storage or
 *    sent anywhere except the demo API.
 *  - Pre-sign text is `timestamp + METHOD + path`, path WITHOUT query string,
 *    path INCLUDING the /trade-api/v2 prefix. (api_keys)
 *  - RSA keys use RSA-PSS/SHA-256, MGF1-SHA256, salt length = digest length.
 *    Ed25519 keys sign the message directly. (api_keys)
 *  - Order writes use the V2 route POST /portfolio/events/orders. The legacy
 *    /portfolio/orders write route answers 410 deprecated_v1_order_endpoint.
 *  - Nothing is fabricated. Every fetch result is returned as-is; on error the
 *    caller receives a typed error object instead of a made-up value.
 */
import { DEMO } from "./config.js";

const B64 = {
  decode(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
  encode(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
};

function pemToDer(pem) {
  const body = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("Private key is empty or not PEM-encoded.");
  return B64.decode(body);
}

/* Detect key type from the PEM label and from the parsed DER, because the
 * documentation warns that a PKCS#8 RSA key and a PKCS#8 Ed25519 key share the
 * same `-----BEGIN PRIVATE KEY-----` header. */
async function importPrivateKey(pem) {
  const isPkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const der = pemToDer(pem);
  if (isPkcs1) {
    return { alg: "RSA-PSS", key: await crypto.subtle.importKey(
      "pkcs8", await pkcs1ToPkcs8(der), { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]) };
  }
  // PKCS#8: try Ed25519 first, then RSA-PSS.
  try {
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
    return { alg: "Ed25519", key };
  } catch {
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
    return { alg: "RSA-PSS", key };
  }
}

/* Wrap a PKCS#1 RSA private key into a PKCS#8 envelope. */
async function pkcs1ToPkcs8(pkcs1) {
  const algorithmId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
  ]);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const octet = wrap(0x04, pkcs1);
  const sequence = [...version, ...algorithmId, ...octet];
  return wrap(0x30, new Uint8Array(sequence));
}

function wrap(tag, content) {
  const len = content.length;
  let header;
  if (len < 0x80) header = [tag, len];
  else if (len < 0x100) header = [tag, 0x81, len];
  else header = [tag, 0x82, len >> 8, len & 0xff];
  const out = new Uint8Array(header.length + len);
  out.set(header, 0);
  out.set(content, header.length);
  return out;
}

export class KalshiError extends Error {
  constructor(message, { status, code, path, body } = {}) {
    super(message);
    this.name = "KalshiError";
    this.status = status;
    this.code = code;
    this.path = path;
    this.body = body;
  }
}

export class KalshiClient {
  constructor({ base = DEMO.rest, signBase = DEMO.signPath } = {}) {
    this.base = base;
    this.signBase = signBase;
    // Credentials live in memory for the lifetime of this object only.
    this._creds = null;
  }

  /* ---------------- unauthenticated reads ---------------- */

  async get(path, { signal } = {}) {
    const res = await fetch(this.base + path, {
      signal,
      headers: { Accept: "application/json" }
    });
    return this._parse(res, path);
  }

  async _parse(res, path) {
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
      const err = json && json.error ? json.error : {};
      throw new KalshiError(
        `${res.status} ${err.code || res.statusText} on ${path}`,
        { status: res.status, code: err.code, path, body: json }
      );
    }
    return json;
  }

  /* ---------------- credentials ---------------- */

  setCredentials({ keyId, pem }) {
    if (!keyId || !pem) throw new Error("Both the API key ID and the private key PEM are required.");
    this._creds = { keyId: String(keyId).trim(), pem: String(pem) };
  }
  clearCredentials() { this._creds = null; }
  hasCredentials() { return !!this._creds; }
  keyIdHint() {
    const id = this._creds?.keyId || "";
    return id ? id.slice(0, 4) + "…" + id.slice(-4) : "";
  }

  /* ---------------- signing ---------------- */

  /* Returns the three Kalshi headers for an arbitrary method+path.
   * `path` must be the path as sent (query string allowed here; it is stripped
   * before signing, per the documented warning). */
  async _authHeaders(method, path) {
    if (!this._creds) throw new KalshiError("No demo API credentials loaded in this tab.");
    const { alg, key } = await importPrivateKey(this._creds.pem);
    const ts = String(Date.now());
    const signPath = this.signBase + path.split("?")[0];
    const msg = new TextEncoder().encode(ts + method.toUpperCase() + signPath);
    let sigBytes;
    if (alg === "Ed25519") {
      sigBytes = await crypto.subtle.sign({ name: "Ed25519" }, key, msg);
    } else {
      sigBytes = await crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 }, key, msg);
    }
    return {
      "KALSHI-ACCESS-KEY": this._creds.keyId,
      "KALSHI-ACCESS-TIMESTAMP": ts,
      "KALSHI-ACCESS-SIGNATURE": B64.encode(sigBytes),
      alg
    };
  }

  async request(method, path, body) {
    const auth = await this._authHeaders(method, path);
    const { alg: _alg, ...headers } = auth;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return this._parse(res, path);
  }

  /* ---------------- authenticated reads ---------------- */

  balance() { return this.request("GET", "/portfolio/balance"); }
  positions(params = "") { return this.request("GET", "/portfolio/positions" + (params ? "?" + params : "")); }
  fills(params = "") { return this.request("GET", "/portfolio/fills?limit=1000" + (params ? "&" + params : "")); }
  orders(params = "") { return this.request("GET", "/portfolio/orders" + (params ? "?" + params : "")); }

  /* ---------------- trading (V2) ---------------- */

  /* Purchase a YES position at a price (side must be "bid") or a NO position
   * (side must be "ask"). `side` is book vocabulary: bid ≡ yes, ask ≡ no.
   * (https://docs.kalshi.com/api-reference/orders/create-order-v2 — the
   * documented body carries `side`, `count`, `price` as fixed-point strings.)
   *
   * `exchangeIndex` is optional. Per the sharding doc, an order write that
   * omits `exchange_index` and supplies a ticker auto-routes by ticker, so the
   * market's own `exchange_index` is NOT sent unless the caller asks for it —
   * sending a stale/guessed shard would be worse than letting Kalshi route. */
  createOrder({ ticker, outcomeSide, priceDollars, count, timeInForce = "good_till_canceled", clientOrderId, exchangeIndex }) {
    if (outcomeSide !== "yes" && outcomeSide !== "no") {
      throw new Error('outcomeSide must be "yes" or "no".');
    }
    const body = {
      ticker,
      side: outcomeSide === "yes" ? "bid" : "ask",
      count: Number(count).toFixed(2),
      price: Number(priceDollars).toFixed(4),
      time_in_force: timeInForce,
      self_trade_prevention_type: "taker_at_cross",
      client_order_id: clientOrderId || crypto.randomUUID()
    };
    if (Number.isInteger(exchangeIndex) && exchangeIndex >= 0) body.exchange_index = exchangeIndex;
    return this.request("POST", "/portfolio/events/orders", body);
  }

  /* Cancel a V2 order.
   *
   * The Cancel Order (V2) reference documents `market_ticker` and
   * `exchange_index` as QUERY parameters, and states that `market_ticker` is
   * required for auto-routing:
   *   "Exchange shard index. If omitted, auto-routes when market_ticker is
   *    provided; otherwise defaults to 0. ... The market_ticker parameter is
   *    required for auto-routing."
   * (https://docs.kalshi.com/api-reference/orders/cancel-order-v2)
   * The sharding doc adds that an order can only be cancelled on the shard
   * where it rests, and that a request reaching another shard is rejected,
   * so cancelling without the ticker can miss a non-zero shard.
   * (https://docs.kalshi.com/getting_started/exchange_sharding)
   *
   * `marketTicker` is therefore required here rather than optional: the old
   * signature sent neither parameter and could only ever hit shard 0. */
  cancelOrder(orderId, marketTicker) {
    if (!marketTicker) {
      throw new Error("A market ticker is required to cancel: Kalshi auto-routes a cancel by market_ticker.");
    }
    const q = "?market_ticker=" + encodeURIComponent(marketTicker);
    return this.request("DELETE", "/portfolio/events/orders/" + encodeURIComponent(orderId) + q);
  }
  amendOrder(orderId, body) {
    return this.request("POST", "/portfolio/events/orders/" + encodeURIComponent(orderId) + "/amend", body);
  }
}

/* ---------------------------------------------------------------------------
 * Price grid helper.
 *
 * Each market publishes `price_ranges` = [{start, end, step}] in fixed-point
 * dollars. Documentation states this is the authoritative source of valid
 * prices and that off-grid prices are rejected. We therefore snap to the grid
 * the market itself published instead of assuming a 1¢ tick.
 * ------------------------------------------------------------------------- */
export function snapToGrid(priceDollars, priceRanges) {
  const p = Number(priceDollars);
  if (!Array.isArray(priceRanges) || !priceRanges.length) {
    return { value: Number(p.toFixed(2)), step: 0.01, snapped: p !== Number(p.toFixed(2)), known: false };
  }
  const band = priceRanges.find(r => p >= Number(r.start) && p <= Number(r.end)) || priceRanges[0];
  const step = Number(band.step);
  const start = Number(band.start);
  const snapped = start + Math.round((p - start) / step) * step;
  const decimals = Math.max(0, String(step).split(".")[1]?.length ?? 0);
  return {
    value: Number(snapped.toFixed(decimals)),
    step,
    snapped: Math.abs(snapped - p) > 1e-9,
    known: true,
    range: band
  };
}

/* Best bid / best ask derived from an orderbook, using the reciprocal rule
 * documented in orderbook_responses: only bids are returned; a NO bid at y
 * implies a YES ask at 1 − y, and a YES bid at x implies a NO ask at 1 − x. */
export function deriveQuote(book) {
  const yes = (book?.orderbook_fp?.yes_dollars || book?.orderbook?.yes || []).map(([p, c]) => ({ p: Number(p), c: Number(c) }));
  const no = (book?.orderbook_fp?.no_dollars || book?.orderbook?.no || []).map(([p, c]) => ({ p: Number(p), c: Number(c) }));
  const bestYesBid = yes.length ? Math.max(...yes.map(l => l.p)) : null;
  const bestNoBid = no.length ? Math.max(...no.map(l => l.p)) : null;
  return {
    yes,
    no,
    bestYesBid,
    bestNoBid,
    bestYesAsk: bestNoBid === null ? null : Number((1 - bestNoBid).toFixed(4)),
    bestNoAsk: bestYesBid === null ? null : Number((1 - bestYesBid).toFixed(4)),
    yesSpread: bestYesBid !== null && bestNoBid !== null ? Number((1 - bestNoBid - bestYesBid).toFixed(4)) : null,
    noSpread: bestYesBid !== null && bestNoBid !== null ? Number((1 - bestYesBid - bestNoBid).toFixed(4)) : null
  };
}

/* Compute how many contracts are available to buy at a given limit price from a
 * derived orderbook quote, using ONLY the documented reciprocal relationship in
 * https://docs.kalshi.com/getting_started/orderbook_responses:
 *   - Buying YES takes resting NO bids y at implied YES ask = 1 − y (fillable when 1 − y <= limitPrice).
 *   - Buying NO takes resting YES bids x at implied NO ask = 1 − x (fillable when 1 − x <= limitPrice).
 * Contract quantities (`count_fp`) support 0.01 granularity per
 * https://docs.kalshi.com/getting_started/fixed_point_migration, so sums are
 * rounded to hundredths of a contract rather than truncated to integers.
 * Pre-fee resting notional only; taker fees and simultaneous queue changes are
 * not inferred. */
export function liquidityAtPrice(quote, { side = "yes", limitPrice } = {}) {
  if (side !== "yes" && side !== "no") {
    return { valid: false, reason: 'Side must be "yes" or "no".' };
  }
  const raw = limitPrice === "" || limitPrice === null || limitPrice === undefined ? NaN : Number(limitPrice);
  if (!Number.isFinite(raw) || !(raw > 0 && raw < 1)) {
    return { valid: false, reason: "Enter a limit price strictly between $0.00 and $1.00." };
  }
  const target = Number(raw.toFixed(4));
  const oppositeBids = side === "yes" ? (quote?.no || []) : (quote?.yes || []);
  const askLevels = oppositeBids
    .filter(l => Number.isFinite(l.p) && Number.isFinite(l.c) && l.c > 0)
    .map(l => ({
      bidPrice: Number(l.p.toFixed(4)),
      askPrice: Number((1 - l.p).toFixed(4)),
      contracts: Math.round(l.c * 100) / 100
    }))
    .sort((a, b) => a.askPrice - b.askPrice);

  let exactUnits = 0;
  let fillableUnits = 0;
  let totalOfferedUnits = 0;
  let totalCostDollars = 0;
  let levelsMatched = 0;

  for (const lvl of askLevels) {
    const units = Math.round(lvl.contracts * 100);
    totalOfferedUnits += units;
    if (Math.abs(lvl.askPrice - target) < 1e-9) {
      exactUnits += units;
    }
    if (lvl.askPrice <= target + 1e-9) {
      fillableUnits += units;
      totalCostDollars += (units / 100) * lvl.askPrice;
      levelsMatched++;
    }
  }

  const exactContracts = exactUnits / 100;
  const fillableContracts = fillableUnits / 100;
  const totalOfferedContracts = totalOfferedUnits / 100;
  const cost = Number(totalCostDollars.toFixed(4));
  const vwapDollars = fillableContracts > 0 ? Number((totalCostDollars / fillableContracts).toFixed(4)) : null;

  return {
    valid: true,
    side,
    oppositeSide: side === "yes" ? "no" : "yes",
    limitPrice: target,
    bestAsk: askLevels.length ? askLevels[0].askPrice : null,
    exactContracts,
    fillableContracts,
    totalOfferedContracts,
    levelsMatched,
    totalLevels: askLevels.length,
    totalCostDollars: cost,
    vwapDollars
  };
}

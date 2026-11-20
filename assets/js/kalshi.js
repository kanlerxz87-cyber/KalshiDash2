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
   * (side must be "ask"). `side` is book vocabulary: bid ≡ yes, ask ≡ no. */
  createOrder({ ticker, outcomeSide, priceDollars, count, timeInForce = "good_till_canceled", clientOrderId }) {
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
    return this.request("POST", "/portfolio/events/orders", body);
  }

  cancelOrder(orderId) {
    return this.request("DELETE", "/portfolio/events/orders/" + encodeURIComponent(orderId));
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
 * implies a YES ask at 1 − y. */
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
    yesSpread: bestYesBid !== null && bestNoBid !== null ? Number((1 - bestNoBid - bestYesBid).toFixed(4)) : null
  };
}

/* ==========================================================================
   auth.js — in-browser request signing for the Kalshi demo account.

   Official spec (verified line by line):
     https://docs.kalshi.com/getting_started/api_keys
     https://docs.kalshi.com/getting_started/quick_start_authenticated_requests

   Pre-sign text   : timestamp + HTTP_METHOD + path
                     (path = full path from the API root WITHOUT query string,
                      e.g. "/trade-api/v2/portfolio/balance")
   Timestamp       : unix milliseconds, must be within 30 s of Kalshi's clock
   RSA keys        : RSA-PSS, SHA-256, MGF1-SHA-256, salt length = digest length
   Ed25519 keys    : sign the pre-sign text directly
   Headers         : KALSHI-ACCESS-KEY, KALSHI-ACCESS-TIMESTAMP,
                     KALSHI-ACCESS-SIGNATURE (base64)

   Security: the private key never leaves the browser. It is kept in
   sessionStorage so it disappears when the tab closes, and it is never
   written to this repository, never sent to any host other than Kalshi, and
   never included in any URL.
   ========================================================================== */

import { baseUrl } from './api.js';

const CREDS_KEY = 'kalshi.demo.creds.v2';

export class AuthError extends Error {
  constructor(message, detail) { super(message); this.name = 'AuthError'; this.detail = detail; }
}

/* --------------------------------------------------------- credential IO -- */
export function loadCreds() {
  try {
    const raw = sessionStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveCreds({ keyId, pem }) {
  sessionStorage.setItem(CREDS_KEY, JSON.stringify({ keyId, pem }));
}

export function clearCreds() { sessionStorage.removeItem(CREDS_KEY); }
export function hasCreds() { return !!loadCreds(); }

/* ------------------------------------------------------------ PEM parsing -- */
export function parsePem(pem) {
  const text = String(pem || '').trim();
  const m = text.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END ([A-Z0-9 ]+)-----/);
  if (!m) throw new AuthError('That does not look like a PEM private key.', 'no PEM block found');
  const label = m[1].trim();
  const b64 = m[2].replace(/\s+/g, '');
  let der;
  try {
    der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    throw new AuthError('The PEM body is not valid base64.', 'bad base64');
  }
  const kind =
    label === 'RSA PRIVATE KEY' ? 'pkcs1-rsa'
    : label === 'PRIVATE KEY' ? 'pkcs8'
    : label === 'EC PRIVATE KEY' ? 'pkcs8-ec'
    : 'pkcs8';
  return { kind, label, der };
}

/* Detect the key type by asking WebCrypto to import it. The PEM header alone
   is NOT authoritative — PKCS#8 RSA keys also say "BEGIN PRIVATE KEY" — and
   byte-sniffing ASN.1 OIDs is fragile, so we simply try each supported
   algorithm and keep the one that imports. */
export async function importPrivateKey(pem) {
  const { kind, der } = parsePem(pem);
  const candidates = [];
  if (kind === 'pkcs1-rsa') {
    candidates.push({ data: pkcs1ToPkcs8(der), alg: { name: 'RSA-PSS', hash: 'SHA-256' }, keyType: 'rsa' });
  } else {
    candidates.push({ data: der, alg: { name: 'Ed25519' }, keyType: 'ed25519' });
    candidates.push({ data: der, alg: { name: 'RSA-PSS', hash: 'SHA-256' }, keyType: 'rsa' });
  }
  const failures = [];
  for (const c of candidates) {
    try {
      const key = await crypto.subtle.importKey('pkcs8', c.data.buffer, c.alg, false, ['sign']);
      return { key, keyType: c.keyType };
    } catch (err) {
      failures.push(`${c.alg.name}: ${err.name || err.message}`);
    }
  }
  throw new AuthError(
    'Unsupported or unreadable private key. Kalshi demo keys are RSA (2048-bit) ' +
    'or Ed25519. If your browser is older it may not support Ed25519 in WebCrypto — ' +
    'create an RSA key instead.',
    failures,
  );
}

/* --- PKCS#1 -> PKCS#8 wrapping -------------------------------------------
   WebCrypto can only import PKCS#8 ("pkcs8") private keys. Kalshi may hand out
   a PKCS#1 RSA key ("-----BEGIN RSA PRIVATE KEY-----"). We wrap the PKCS#1
   DER in a minimal PKCS#8 PrivateKeyInfo envelope so it can be imported.
   Structure (RFC 5958):
     SEQUENCE {
       INTEGER 0
       SEQUENCE { OID 1.2.840.113549.1.1.1, NULL }
       OCTET STRING { <PKCS#1 key> }
     }
   ------------------------------------------------------------------------ */
function derLen(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  let v = n;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  return [0x80 | bytes.length, ...bytes];
}
function derSeq(...parts) {
  const body = parts.flat();
  return [0x30, ...derLen(body.length), ...body];
}
function derInt0() { return [0x02, 0x01, 0x00]; }
function derOidRsa() { return [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]; }
function derNull() { return [0x05, 0x00]; }
function derOctet(bytes) { return [0x04, ...derLen(bytes.length), ...bytes]; }

function pkcs1ToPkcs8(pkcs1Der) {
  return new Uint8Array(derSeq(derInt0(), derSeq(derOidRsa(), derNull()), derOctet(Array.from(pkcs1Der))));
}

/* ---------------------------------------------------------------- import -- */
/* (importPrivateKey is defined above the DER helpers it uses.) */

/* --------------------------------------------------------------- signing -- */
export function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function signPreSign(key, keyType, timestamp, method, path) {
  const msg = new TextEncoder().encode(`${timestamp}${method.toUpperCase()}${path}`);
  if (keyType === 'ed25519') {
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, msg);
    return b64(new Uint8Array(sig));
  }
  // RSA-PSS: MGF1-SHA256, salt length = digest length (32 bytes).
  const sig = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, msg);
  return b64(new Uint8Array(sig));
}

/** Build the three KALSHI-ACCESS-* headers for a request. */
export async function authHeaders({ method = 'GET', path, keyId, pem, key, keyType }) {
  const ts = String(Date.now());
  let priv = key;
  let kt = keyType;
  if (!priv) {
    const imported = await importPrivateKey(pem);
    priv = imported.key;
    kt = imported.keyType;
  }
  const signature = await signPreSign(priv, kt, ts, method, path);
  return {
    'KALSHI-ACCESS-KEY': keyId,
    'KALSHI-ACCESS-TIMESTAMP': ts,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'Content-Type': 'application/json',
  };
}

/* --------------------------------------------------------------- request -- */
/**
 * Signed request against the Kalshi demo API.
 * `path` must be the FULL path from the API root, e.g.
 * "/trade-api/v2/portfolio/balance" — this is exactly what gets signed.
 */
export async function authRequest(path, { method = 'GET', body = null } = {}) {
  const creds = loadCreds();
  if (!creds) {
    throw new AuthError('No demo API credentials are loaded in this browser tab.', 'no-creds');
  }
  const signPath = (path.startsWith('/trade-api/v2') ? path : '/trade-api/v2' + path).split('?')[0];

  let headers;
  try {
    headers = await authHeaders({
      method, path: signPath, keyId: creds.keyId, pem: creds.pem,
    });
  } catch (err) {
    throw new AuthError('Could not sign the request: ' + err.message, err.detail);
  }

  const url = baseUrl() + signPath.slice('/trade-api/v2'.length);
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const code = json?.code || json?.error?.code || '';
    const msg = json?.message || json?.error?.message || text.slice(0, 200);
    throw new AuthError(`HTTP ${res.status}${code ? ' (' + code + ')' : ''}: ${msg}`, { status: res.status, body: json });
  }
  return json;
}

/* ------------------------------------------------------- order placement -- */
/**
 * Place a demo order.
 * Payload verified against the official quick start:
 *   https://docs.kalshi.com/getting_started/quick_start_create_order
 */
export async function placeOrder({ ticker, side, count, price, timeInForce = 'good_till_canceled', selfTradePrevention = 'taker_at_cross', clientOrderId }) {
  const body = {
    ticker,
    side,                       // "bid" = buy YES, "ask" = sell YES
    count: String(count),
    price: Number(price).toFixed(4),
    time_in_force: timeInForce,
    self_trade_prevention_type: selfTradePrevention,
    client_order_id: clientOrderId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
  };
  return { body, response: await authRequest('/portfolio/events/orders', { method: 'POST', body }) };
}

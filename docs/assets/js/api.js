/* ==========================================================================
   api.js — Kalshi REST client.

   Public market data needs no API key (official quick start:
   https://docs.kalshi.com/getting_started/quick_start_market_data).
   Private endpoints are signed in the browser with the user's own demo key;
   the key is never sent anywhere except the Kalshi host and is never stored
   in this repository.

   CORS: only the recommended host `external-api.demo.kalshi.co` returns an
   `Access-Control-Allow-Origin` header for a browser origin. The shared host
   `demo-api.kalshi.co` does not. Verified live — see data/probe/api_surface.json.
   ========================================================================== */

import { HOSTS, DEFAULT_HOST, ENDPOINTS } from './config.js';

let activeHost = DEFAULT_HOST;

export function getHostKey() { return activeHost; }
export function setHostKey(key) {
  if (!HOSTS[key]) return;
  activeHost = key;
  try { localStorage.setItem('kalshi.host', key); } catch { /* ignore */ }
}
export function restoreHost() {
  try {
    const saved = localStorage.getItem('kalshi.host');
    if (saved && HOSTS[saved]) activeHost = saved;
  } catch { /* ignore */ }
}
export function baseUrl() { return HOSTS[activeHost].base; }
export function basePath() { return '/trade-api/v2'; }

/* ------------------------------------------------------------ throttling --
   Kalshi uses token-bucket rate limits and documents exponential backoff on
   429 (https://docs.kalshi.com/getting_started/rate_limits). We keep a small
   client-side minimum gap between reads and retry with backoff. */
const MIN_GAP_MS = 220;
let lastCallAt = 0;

async function throttle() {
  const now = Date.now();
  const wait = MIN_GAP_MS - (now - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

/* --------------------------------------------------------------- errors -- */
export class ApiError extends Error {
  constructor(message, status, body, url) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

/* --------------------------------------------------------------- caching -- */
const cache = new Map();

export function cacheClear(prefix = '') {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function cacheGet(key, ttl) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttl) { cache.delete(key); return undefined; }
  return hit.value;
}
function cacheSet(key, value) { cache.set(key, { at: Date.now(), value }); }

/* ------------------------------------------------------------ public GET -- */
export async function get(path, { params = {}, ttl = 0, signal } = {}) {
  const url = buildUrl(path, params);
  if (ttl) {
    const hit = cacheGet(url, ttl);
    if (hit !== undefined) return hit;
  }
  await throttle();
  let res;
  try {
    res = await fetch(url, { method: 'GET', signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new ApiError(
      `Network/CORS failure calling ${url}. The recommended demo host is ` +
      `https://external-api.demo.kalshi.co/trade-api/v2 — the shared host does not ` +
      `return CORS headers for browser pages. (${err.message})`,
      0, { raw: String(err) }, url,
    );
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const detail = json && (json.message || json.error || json.code) ? JSON.stringify(json).slice(0, 300) : '';
    throw new ApiError(`HTTP ${res.status} from ${path}${detail ? ' — ' + detail : ''}`, res.status, json, url);
  }
  if (ttl) cacheSet(url, json);
  return json;
}

export function buildUrl(path, params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    clean[k] = v;
  }
  const qs = new URLSearchParams(clean).toString();
  return baseUrl() + path + (qs ? '?' + qs : '');
}

/* --------------------------------------------------------------- helpers -- */

/** Follow the official cursor pagination until the cursor comes back empty. */
export async function getAll(path, key, { params = {}, maxPages = 25, ttl = 0 } = {}) {
  const out = [];
  let cursor = '';
  for (let page = 0; page < maxPages; page++) {
    const p = { ...params };
    if (cursor) p.cursor = cursor;
    const data = await get(path, { params: p, ttl: page === 0 ? ttl : 0 });
    const items = data?.[key] || [];
    out.push(...items);
    cursor = data?.cursor || '';
    if (!cursor) break;
  }
  return out;
}

/* Convenience wrappers bound to the documented endpoint paths. */
export const Api = {
  series:      (params = {}, opts = {}) => get(ENDPOINTS.series.path, { params, ...opts }),
  events:      (params = {}, opts = {}) => get(ENDPOINTS.events.path, { params, ...opts }),
  event:       (ticker, opts = {}) => get(ENDPOINTS.event.path.replace('{ticker}', encodeURIComponent(ticker)), opts),
  markets:     (params = {}, opts = {}) => get(ENDPOINTS.markets.path, { params, ...opts }),
  market:      (ticker, opts = {}) => get(ENDPOINTS.market.path.replace('{ticker}', encodeURIComponent(ticker)), opts),
  orderbook:   (ticker, { depth = 0 } = {}) =>
                  get(ENDPOINTS.orderbook.path.replace('{ticker}', encodeURIComponent(ticker)), { params: { depth } }),
  candlesticks:(series, ticker, { startTs, endTs, period = 1 } = {}) =>
                  get(ENDPOINTS.candles.path.replace('{series}', encodeURIComponent(series)).replace('{ticker}', encodeURIComponent(ticker)),
                      { params: { start_ts: startTs, end_ts: endTs, period_interval: period } }),
  trades:      (params = {}, opts = {}) => get(ENDPOINTS.trades.path, { params, ...opts }),
};

/* --------------------------------------------------------- live polling -- */
/**
 * Polls a market ticker and yields the latest snapshot. Used for the
 * seconds-resolution price chart, because the Kalshi WebSocket API requires
 * an authenticated handshake with custom headers, which a browser page cannot
 * send (verified: the WS handshake returns 401 without auth).
 */
export function pollMarket(ticker, { intervalMs = 2000, onTick, onError } = {}) {
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const data = await Api.market(ticker);
      const m = data?.market || data;
      onTick?.(m);
    } catch (err) {
      onError?.(err);
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

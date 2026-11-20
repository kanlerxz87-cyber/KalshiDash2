/* KalshiDash2 shared client.
 *
 * Two data paths, both documented in REPO_REVIEW.md:
 *
 * 1. SNAPSHOT (default, always works): JSON files under data/ produced by
 *    scripts/collect_kalshi.py in a GitHub Actions run. Every file records the
 *    exact Kalshi demo API URL it came from and the UTC time of the request.
 *    No cross-origin request is made by the browser for this path.
 *
 * 2. LIVE (optional, user-triggered): direct reads of the public demo REST API
 *    from the browser. Kalshi does not document CORS support for browser
 *    clients (see Flagged F1); if the browser blocks it, the page says so and
 *    keeps showing the snapshot. Nothing is faked to hide a blocked request.
 *
 * Sources
 *   environments  https://docs.kalshi.com/getting_started/api_environments
 *   market data   https://docs.kalshi.com/getting_started/quick_start_market_data
 *   orderbook     https://docs.kalshi.com/getting_started/orderbook_responses
 *   auth          https://docs.kalshi.com/getting_started/api_keys
 *   order V2      https://docs.kalshi.com/api-reference/orders/create-order-v2
 *   direction     https://docs.kalshi.com/getting_started/order_direction
 */
'use strict';

/* Everything below is wrapped in one module scope. Pages talk to this file
 * through the single global `KD` object, so no page depends on cross-script
 * lexical declarations (which break if a file is loaded twice or deferred).
 * The `$`/`$$`/etc. names below are local to this wrapper. */
const KD = (() => {

const DEMO_BASE = 'https://external-api.demo.kalshi.co/trade-api/v2';
const DEMO_WS = 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2';
const DOCS = 'https://docs.kalshi.com';

/* Navigation is rendered from one list so every page stays in sync. */
const PAGES = [
  ['index.html', 'Overview'],
  ['dashboard.html', 'Live Dashboard'],
  ['resolved.html', 'Resolved'],
  ['portfolio.html', 'Portfolio & Trading'],
  ['analysis.html', 'Analysis & Strategy'],
  ['suggestions.html', 'Suggestions'],
  ['questions.html', 'Questions'],
  ['verification.html', 'Verification'],
  ['flagged.html', 'Flagged'],
  ['review.html', 'Repo Review'],
];

const TOPIC_ORDER = ['gas', 'elections', 'culture', 'crypto', 'golf'];
const TOPIC_LABELS = {
  gas: 'Gas Prices',
  elections: 'Elections',
  culture: 'Culture',
  crypto: 'Crypto',
  golf: 'Golf',
};

/* ---------- tiny helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* A dash means "the API returned no value". We never print 0 for null. */
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const fmtN = (v, d = 0) => {
  const n = num(v);
  if (n === null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
/* Fixed-point dollar strings -> $0.42 */
const fmtUsd = (v, d = 2) => {
  const n = num(v);
  if (n === null) return '—';
  const abs = Math.abs(n).toLocaleString('en-US',
    { minimumFractionDigits: d, maximumFractionDigits: d });
  return (n < 0 ? '-$' : '$') + abs;
};
/* Price -> cents. Rounded to 0.1¢ first so binary-float noise (0.43999999)
 * cannot turn a clean 44¢ into "44.0¢". Sub-penny prices keep one decimal. */
const cents = (v) => {
  const n = num(v);
  if (n === null) return '—';
  const c = Math.round(n * 1000) / 10;
  return (Number.isInteger(c) ? c.toFixed(0) : c.toFixed(1)) + '¢';
};
const pct = (v, d = 1) => {
  const n = num(v);
  if (n === null) return '—';
  return (n * 100).toFixed(d) + '%';
};
const fmtTs = (ts) => {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d)) return esc(String(ts));
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
};
const ago = (iso) => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (isNaN(t)) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 90) return s + 's ago';
  if (s < 5400) return Math.round(s / 60) + 'm ago';
  if (s < 172800) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
};
const setStatus = (el, ok, msg) => {
  if (!el) return;
  el.className = 'pill ' + (ok === true ? 'live' : ok === false ? 'err' : '');
  el.textContent = msg;
};
const srcLink = (url, label) =>
  url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label || url)}</a>` : '—';

/* ---------- page chrome ---------- */
function renderChrome() {
  const path = location.pathname.split('/').pop() || 'index.html';
  const nav = $('#nav');
  if (nav) {
    nav.innerHTML = PAGES.map(([href, label]) =>
      `<a href="${href}"${href === path ? ' class="active"' : ''}>${esc(label)}</a>`).join('');
  }
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

/* ---------- snapshot loading ---------- */
const S = {}; // snapshot cache

async function loadSnap(name) {
  if (S[name]) return S[name];
  const res = await fetch('data/' + name + '.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data/${name}.json missing (HTTP ${res.status})`);
  const json = await res.json();
  S[name] = json;
  return json;
}

/* Loads everything, tolerating individual failures. */
async function loadAll() {
  const names = ['meta', 'exchange', 'series', 'resolutions', 'events', 'depth', 'candles',
    ...TOPIC_ORDER.map((t) => 'topic-' + t)];
  const out = {};
  await Promise.all(names.map(async (n) => {
    try { out[n] = await loadSnap(n); } catch (e) { out[n] = { error: e.message }; }
  }));
  return out;
}

/* Freshest generation time across the snapshot files. */
function snapshotTime(d) {
  const times = Object.values(d)
    .map((x) => x && x.generated_at)
    .filter(Boolean)
    .map((t) => Date.parse(t))
    .filter((t) => !isNaN(t));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString().replace(/\.\d+Z$/, 'Z');
}

/* Renders the freshness banner that every data page shows. */
function renderFreshness(el, d) {
  if (!el) return;
  const t = snapshotTime(d);
  const meta = d.meta || {};
  const failed = Object.entries(d).filter(([, v]) => v && v.error);
  if (!t) {
    el.innerHTML = `<div class="banner bad"><b>No snapshot available yet.</b>
      The data files under <code>docs/data/</code> have not been generated.
      Run the <a href="https://github.com/kanlerxz87-cyber/KalshiDash2/actions/workflows/collect.yml">Collect Kalshi demo data</a>
      workflow, then reload. No values are shown rather than showing invented ones.</div>`;
    return;
  }
  const staleMin = (Date.now() - Date.parse(t)) / 60000;
  const cls = staleMin > 120 ? 'banner bad' : staleMin > 45 ? 'banner' : 'banner info';
  el.innerHTML = `<div class="${cls}">
    Snapshot collected <b>${esc(t)}</b> (${esc(ago(t))}) from
    ${srcLink(meta.base_url || DEMO_BASE, 'Kalshi demo API')}
    · ${fmtN(meta.requests)} requests logged
    · <a href="verification.html">source &amp; verification details</a>
    ${staleMin > 45 ? '<br><b>This snapshot is older than the 15-minute collection schedule.</b> Check the Actions run log.' : ''}
    ${failed.length ? '<br>Files with errors: ' + failed.map(([k, v]) => `<code>${esc(k)}</code>: ${esc(v.error)}`).join(' · ') : ''}
  </div>`;
}

/* ---------- topic aggregation ---------- */
function allMarkets(d) {
  const out = [];
  for (const t of TOPIC_ORDER) {
    const doc = d['topic-' + t] || {};
    for (const m of doc.markets || []) out.push({ ...m, topic: t });
  }
  return out;
}

/* The dashboard's headline metric: dollar value of open interest, computed only
 * from two API fields (open_interest_fp x notional_value_dollars). */
function topicStats(d) {
  const rows = {};
  for (const t of TOPIC_ORDER) {
    const doc = d['topic-' + t] || {};
    const ms = doc.markets || [];
    let oi = 0, oiKnown = 0, vol = 0, volKnown = 0, notional = 0;
    for (const m of ms) {
      const nv = num(m.notional_value_dollars);
      const n = num(m.open_interest_fp);
      if (n !== null && nv !== null) { oi += n * nv; oiKnown++; notional = nv; }
      const v = num(m.volume_fp);
      if (v !== null) { vol += v; volKnown++; }
    }
    rows[t] = {
      label: TOPIC_LABELS[t],
      series: doc.series_count ?? 0,
      markets: doc.market_count ?? 0,
      openInterestUsd: oiKnown ? oi : null,
      volumeContracts: volKnown ? vol : null,
      notional: notional || null,
      error: doc.error || null,
      sourceUrls: doc.source_urls || [],
      note: doc.note || '',
    };
  }
  return rows;
}

/* ---------- chart engine (canvas, no dependencies) ---------- */
const RANGES = {
  '60s': { label: '60 seconds', secs: 60, mode: 'live' },
  '5m': { label: '5 minutes', secs: 300, mode: 'live' },
  '15m': { label: '15 minutes', secs: 900, mode: 'live' },
  '1h': { label: '1 hour', secs: 3600, mode: 'candle', interval: 1 },
  '6h': { label: '6 hours', secs: 21600, mode: 'candle', interval: 1 },
  '24h': { label: '24 hours', secs: 86400, mode: 'candle', interval: 60 },
  '7d': { label: '7 days', secs: 604800, mode: 'candle', interval: 60 },
};

/**
 * Draw a time-series chart.
 * points: [{t: ms, y: number, y2?: number, y3?: number}]
 * opts:   {series:[{key,color,label}], yFmt, title, empty}
 */
function drawChart(canvas, points, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 700;
  const cssH = opts.height || 300;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 58, r: 14, t: 16, b: 34 };
  const W = cssW - pad.l - pad.r;
  const H = cssH - pad.t - pad.b;
  const series = opts.series || [{ key: 'y', color: '#388bfd', label: 'price' }];
  const yFmt = opts.yFmt || ((v) => cents(v));

  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.fillStyle = '#8b98a5';
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;

  const usable = points.filter((p) => num(p.y) !== null || series.some((s) => num(p[s.key]) !== null));
  if (!usable.length) {
    ctx.fillStyle = '#8b98a5';
    ctx.fillText(opts.empty || 'No data points for this window.', pad.l, cssH / 2);
    return;
  }

  const allY = [];
  for (const p of usable) for (const s of series) { const v = num(p[s.key]); if (v !== null) allY.push(v); }
  let y0 = Math.min(...allY), y1 = Math.max(...allY);
  if (y0 === y1) { y0 = Math.max(0, y0 - 0.02); y1 = y1 + 0.02; }
  const span = y1 - y0;
  y0 = Math.max(0, y0 - span * 0.08);
  y1 = Math.min(1.0001, y1 + span * 0.08);
  const xs = usable.map((p) => p.t);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= 30000; x1 += 30000; }

  const X = (t) => pad.l + ((t - x0) / (x1 - x0)) * W;
  const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * H;

  // horizontal grid + y labels
  for (let i = 0; i <= 5; i++) {
    const v = y0 + ((y1 - y0) * i) / 5;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cssW - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#8b98a5';
    ctx.textAlign = 'right';
    ctx.fillText(yFmt(v), pad.l - 8, y + 4);
  }
  // vertical grid + x labels
  const xTicks = cssW < 520 ? 3 : 5;
  ctx.textAlign = 'center';
  for (let i = 0; i <= xTicks; i++) {
    const t = x0 + ((x1 - x0) * i) / xTicks;
    const x = X(t);
    ctx.strokeStyle = '#21262d';
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + H); ctx.stroke();
    ctx.fillStyle = '#8b98a5';
    const d = new Date(t);
    const label = opts.xFmt ? opts.xFmt(d) :
      (x1 - x0 > 86400000 * 2
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    ctx.fillText(label, x, cssH - 12);
  }

  // series lines
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 2;
    ctx.beginPath();
    let started = false;
    for (const p of usable) {
      const v = num(p[s.key]);
      if (v === null) { started = false; continue; }
      const x = X(p.t), y = Y(v);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (s.fill && usable.length > 1) {
      const first = usable.find((p) => num(p[s.key]) !== null);
      const last = [...usable].reverse().find((p) => num(p[s.key]) !== null);
      if (first && last) {
        ctx.lineTo(X(last.t), pad.t + H);
        ctx.lineTo(X(first.t), pad.t + H);
        ctx.closePath();
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
    }
  }
  ctx.lineWidth = 1;

  if (opts.legend !== false) {
    ctx.textAlign = 'left';
    let lx = pad.l + 4;
    for (const s of series) {
      ctx.fillStyle = s.color;
      ctx.fillRect(lx, pad.t - 2, 10, 3);
      ctx.fillStyle = '#8b98a5';
      ctx.fillText(s.label, lx + 15, pad.t + 2);
      lx += ctx.measureText(s.label).width + 34;
    }
  }
}

/* ---------- order book helpers (documented semantics) ---------- */
/* Arrays are ascending, best bid is the LAST element.
 * Source: https://docs.kalshi.com/getting_started/orderbook_responses */
function bestBid(levels) {
  if (!levels || !levels.length) return null;
  const last = levels[levels.length - 1];
  return { price: num(last[0]), contracts: num(last[1]) };
}
function impliedYesAsk(noBidLevels) {
  const b = bestBid(noBidLevels);
  return b && b.price !== null ? { price: 1 - b.price, contracts: b.contracts } : null;
}
function impliedNoAsk(yesBidLevels) {
  const b = bestBid(yesBidLevels);
  return b && b.price !== null ? { price: 1 - b.price, contracts: b.contracts } : null;
}
/* Cumulative contracts available up to a price level. */
function cumulative(levels, ascending = true) {
  const sorted = [...(levels || [])].sort((a, b) =>
    ascending ? num(a[0]) - num(b[0]) : num(b[0]) - num(a[0]));
  let run = 0;
  return sorted.map(([p, c]) => {
    run += num(c) || 0;
    return { price: num(p), contracts: num(c), cumulative: run };
  });
}

/* ---------- authenticated demo requests ----------
 * Headers:  KALSHI-ACCESS-KEY / -TIMESTAMP (ms) / -SIGNATURE
 * Pre-sign: timestamp + METHOD + path WITHOUT query string
 * RSA keys: RSA-PSS, SHA-256, salt length = digest length (32)
 * Ed25519:  WebCrypto cannot sign Ed25519 (Chromium/Firefox/Safari all refuse),
 *           so this build supports RSA-PSS only and says so in the UI.
 * Sources:  https://docs.kalshi.com/getting_started/api_keys
 *           https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
 */
const CREDS_KEY = 'kalshi_demo_creds_v2';

function pemToDer(pem) {
  const body = String(pem)
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/* Returns the credential object or null. Stored in sessionStorage only. */
function getCreds() {
  try {
    const raw = sessionStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setCreds(obj) {
  if (obj) sessionStorage.setItem(CREDS_KEY, JSON.stringify(obj));
  else sessionStorage.removeItem(CREDS_KEY);
}

async function importRsaKey(pem) {
  if (!/BEGIN (RSA )?PRIVATE KEY/.test(pem)) {
    throw new Error('This is not an RSA PKCS#1/PKCS#8 PEM private key.');
  }
  const der = pemToDer(pem);
  // PKCS#8 (BEGIN PRIVATE KEY) imports as "pkcs8"; PKCS#1 as "pkcs8" after
  // wrapping is required, so try both and report which worked.
  try {
    return await crypto.subtle.importKey('pkcs8', der,
      { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['sign']);
  } catch (e1) {
    throw new Error('Could not import the key as PKCS#8 RSA. Kalshi issues RSA keys ' +
      'as PKCS#1 (BEGIN RSA PRIVATE KEY); convert with ' +
      '"openssl pkcs8 -topk8 -nocrypt -in key.pem -out key.pem". (' + e1.message + ')');
  }
}

async function signedHeaders({ method, path, creds }) {
  const key = await importRsaKey(creds.pem);
  const ts = String(Date.now());
  const signPath = path.split('?')[0];           // documented: strip query string
  const msg = new TextEncoder().encode(ts + method.toUpperCase() + signPath);
  const sig = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, msg);
  return {
    'KALSHI-ACCESS-KEY': creds.keyId,
    'KALSHI-ACCESS-TIMESTAMP': ts,
    'KALSHI-ACCESS-SIGNATURE': b64(sig),
  };
}

async function authFetch(path, { method = 'GET', body = null } = {}) {
  const creds = getCreds();
  if (!creds) throw new Error('No demo API credentials in this tab. Add them on the Portfolio page.');
  const headers = await signedHeaders({ method, path, creds });
  const res = await fetch(DEMO_BASE + path, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const code = json && json.error ? json.error.code : '';
    const e = new Error(`HTTP ${res.status}${code ? ' ' + code : ''}: ` +
      (json && json.error ? json.error.message : text.slice(0, 200)));
    e.status = res.status; e.body = json; throw e;
  }
  return json;
}

/* Public (unauthenticated) read straight from the browser. */
async function publicFetch(path) {
  const res = await fetch(DEMO_BASE + path, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return json;
}

/* ---------- local trading journal ----------
 * Every order this site submits is appended here so the Analysis page can
 * compute real performance. Nothing is estimated: a row exists only if an
 * order was actually accepted by the demo API.
 */
const JOURNAL_KEY = 'kalshi_journal_v2';
const Journal = {
  all() { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch { return []; } },
  add(row) {
    const rows = this.all();
    rows.push(row);
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(rows));
    return rows;
  },
  clear() { localStorage.removeItem(JOURNAL_KEY); },
  exportCsv() {
    const rows = this.all();
    if (!rows.length) return null;
    const cols = ['ts', 'mode', 'ticker', 'topic', 'event_ticker', 'side', 'count', 'price',
      'time_in_force', 'order_id', 'fill_count', 'remaining_count', 'status', 'resolve',
      'strategy', 'note'];
    const head = cols.join(',');
    const body = rows.map((r) => cols.map((c) => {
      const v = r[c] ?? '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(',')).join('\n');
    return head + '\n' + body + '\n';
  },
};

/* Trade classification used by the Analysis page. Rules are explicit so the
 * reader can audit every bucket. */
const STRATEGIES = {
  momentum: 'Momentum — bought the outcome after it moved up (price ≥ 60¢ on entry).',
  value: 'Value — bought the outcome while it was cheap (price < 25¢).',
  fade: 'Fade — bought the opposite of the favourite (price 25–40¢).',
  neutral: 'Mid-range — bought at 40–60¢, no strong directional signal.',
  maker: 'Maker — resting order, not immediately filled (time in force GTC).',
  ioc: 'Immediate — fill-or-kill / immediate-or-cancel order.',
  unknown: 'Unclassified — insufficient fields on the journal row.',
};

function classifyTrade(row) {
  if (!row) return 'unknown';
  const tif = (row.time_in_force || '').toLowerCase();
  if (tif === 'fill_or_kill' || tif === 'immediate_or_cancel') return 'ioc';
  const p = num(row.price);
  if (p === null) return 'unknown';
  if (p >= 0.60) return 'momentum';
  if (p < 0.25) return 'value';
  if (p >= 0.25 && p < 0.40) return 'fade';
  if (p >= 0.40 && p < 0.60) return tif === 'good_till_canceled' ? 'maker' : 'neutral';
  return 'unknown';
}

/* Parses a Kalshi event ticker's date segment when present, else null.
 * Never guesses: returns null when the pattern is not matched. */
function eventDate(eventTicker) {
  const m = /-(\d{2})([A-Z]{3})(\d{2})/.exec(String(eventTicker || ''));
  if (!m) return null;
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7,
    SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const mo = months[m[2]];
  if (mo === undefined) return null;
  const d = new Date(Date.UTC(2000 + Number(m[1]), mo, Number(m[3])));
  return isNaN(d) ? null : d;
}

/* ---------- misc UI ---------- */
function topicBadge(t) {
  return `<span class="badge info">${esc(TOPIC_LABELS[t] || t || '—')}</span>`;
}
function resultBadge(result, status) {
  const r = String(result || '').toLowerCase();
  if (r === 'yes') return '<span class="badge yes">YES</span>';
  if (r === 'no') return '<span class="badge no">NO</span>';
  if (r === 'scalar') return '<span class="badge">SCALAR</span>';
  return `<span class="badge">${esc(status || 'unresolved')}</span>`;
}
function table(headers, rows, opts = {}) {
  const th = headers.map((h, i) =>
    `<th${opts.numCols && opts.numCols.includes(i) ? ' class="num"' : ''}>${h}</th>`).join('');
  const body = rows.length ? rows.join('') :
    `<tr><td colspan="${headers.length}"><div class="empty">${opts.empty || 'No rows.'}</div></td></tr>`;
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}
function download(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

return {
  DEMO_BASE,
  DEMO_WS,
  DOCS,
  PAGES,
  TOPIC_ORDER,
  TOPIC_LABELS,
  RANGES,
  STRATEGIES,
  $,
  $$,
  esc,
  num,
  fmtN,
  fmtUsd,
  cents,
  pct,
  fmtTs,
  ago,
  setStatus,
  srcLink,
  renderChrome,
  loadSnap,
  loadAll,
  snapshotTime,
  renderFreshness,
  allMarkets,
  topicStats,
  drawChart,
  bestBid,
  impliedYesAsk,
  impliedNoAsk,
  cumulative,
  getCreds,
  setCreds,
  authFetch,
  publicFetch,
  Journal,
  classifyTrade,
  eventDate,
  topicBadge,
  resultBadge,
  table,
  download,
  pemToDer,
  importRsaKey,
  signedHeaders,
  S
};
})();

/* One explicit entry point, safe to call more than once. */
if (typeof window !== 'undefined') window.KD = KD;
document.addEventListener('DOMContentLoaded', () => KD.renderChrome());

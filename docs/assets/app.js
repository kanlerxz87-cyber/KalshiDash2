/* KalshiDash2 — browser-side client for the Kalshi DEMO API.
   Public market data needs no key (docs.kalshi.com/getting_started/quick_start_create_order).
   Trading/portfolio needs a signed request; keys are entered by the user,
   kept only in sessionStorage, and never sent anywhere except the demo API.
   Nothing here fabricates data: every number shown comes from a live API
   response, or the cell is left blank and marked unverified.

   Verified against official docs on 2026-11-20 (see docs/sources.html):
   - Signing: KALSHI-ACCESS-KEY/-TIMESTAMP(ms)/-SIGNATURE over
     timestamp+METHOD+full-path-from-root-without-query
     (docs.kalshi.com/getting_started/quick_start_authenticated_requests).
     The path signed MUST include the /trade-api/v2 prefix, e.g.
     "/trade-api/v2/portfolio/balance".
   - RSA keys: RSA-PSS SHA-256, salt length 32 (PSS.DIGEST_LENGTH).
   - Ed25519 keys sign the message directly; attempted via WebCrypto where the
     browser supports it, otherwise a clear error is raised (flagged F3).
   - Fixed-point fields: *_fp = contract-count strings, 2 decimals
     (docs.kalshi.com/getting_started/fixed_point_migration). */
const DEMO_BASE = "https://external-api.demo.kalshi.co/trade-api/v2";
const DEMO_WS = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2";
const DOCS = "https://docs.kalshi.com";
const TOPICS = {
  gas:      { label: "Gas Prices", keywords: ["gas", "gasoline", "fuel", "eia"],
              // Exclusions apply to ticker+title only (not tags/categories): the
              // "Oil & Gas" tag would otherwise drag crude/diesel/natgas futures
              // into the retail gas topic (finding G1 by session 64d89c6c,
              // COORDINATION.md). Retail gas = KXAAAGAS* family (fee schedule S20).
              excl: ["crude", "wti", "brent", "diesel", "natural gas", "natgas", "barrel", "oil"] },
  elections:{ label: "Elections",  keywords: ["election", "president", "senate", "house", "governor", "vote", "ballot", "congress", "nominee", "primary"] },
  culture:  { label: "Culture",    keywords: ["culture", "movie", "film", "music", "oscar", "grammy", "emmy", "book", "celebrity", "pop", "box office"] },
  crypto:   { label: "Crypto",     keywords: ["crypto", "bitcoin", "ethereum", "btc", "eth", "coin", "solana"] },
  golf:     { label: "Golf",       keywords: ["golf", "pga", "masters", "ryder", "open championship", "us open"] }
};
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt$ = v => (v === null || v === undefined || v === "") ? "—" : "$" + Number(v).toFixed(2);
const fmtN = v => (v === null || v === undefined || v === "") ? "—" : Number(v).toLocaleString(undefined, {maximumFractionDigits: 2});

async function api(path, opts = {}) {
  const res = await fetch(DEMO_BASE + path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) { const e = new Error(`HTTP ${res.status} on ${path}`); e.status = res.status; e.body = json; throw e; }
  return json;
}
function setStatus(el, ok, msg) { if (!el) return; el.className = "pill " + (ok ? "live" : "err"); el.textContent = msg; }

/* ---------- Topic discovery: keyword match against LIVE GET /series data.
   Source: docs.kalshi.com/api-reference/market/get-series-list (fields ticker,
   title, category, categories[], tags[], frequency). Series tickers are never
   hardcoded from memory — they come from the API. The API's exact category
   strings are not documented, so keyword matching stays heuristic and is
   labeled as such in the UI (flagged F4). */
function seriesMatchesTopic(series, topicKey) {
  const hay = [
    series.ticker, series.title, series.category, series.frequency,
    ...(Array.isArray(series.categories) ? series.categories : []),
    ...(Array.isArray(series.tags) ? series.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
  const t = TOPICS[topicKey];
  if (!t.keywords.some(k => hay.includes(k))) return false;
  if (t.excl) {
    const ident = [series.ticker, series.title].filter(Boolean).join(" ").toLowerCase();
    if (t.excl.some(k => ident.includes(k))) return false;
  }
  return true;
}
/* GET /series takes category/tags/include_* filters only — no documented
   limit/cursor params (verified in the OpenAPI spec on the Get Series List
   page), so this fetches the list in one call and follows `cursor` only if the
   server actually returns one. */
async function fetchSeries() {
  const out = []; let cursor = "";
  for (let i = 0; i < 10; i++) {
    const j = await api("/series" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""));
    out.push(...(j.series || []));
    cursor = j.cursor || "";
    if (!cursor) break;
  }
  return out;
}
async function fetchTopicMarkets(topicKey, limit = 200) {
  const series = await fetchSeries();
  const matched = series.filter(s => seriesMatchesTopic(s, topicKey));
  const markets = [];
  for (const s of matched) {
    // GET /markets filter series_ticker verified in the Get Markets OpenAPI spec.
    // Follow the cursor to exhaustion (Get Markets paging rules) so no entries are silently omitted.
    let cursor = "", pages = 0;
    do {
      const q = `series_ticker=${encodeURIComponent(s.ticker)}&status=open&limit=${limit}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
      const j = await api(`/markets?${q}`);
      for (const m of (j.markets || [])) markets.push({ ...m, _series_title: s.title || "", _series_ticker: s.ticker });
      cursor = j.cursor || ""; pages++;
    } while (cursor && pages < 50);
  }
  return { series: matched, markets };
}
/* Ranking metrics. "Highest dollar amount" is ambiguous (flagged Q1): the API
   reports volumes in CONTRACTS (*_fp, verified Fixed-Point page), not dollars.
   Est. dollar volume = volume_fp x last_price_dollars is a DERIVED figure,
   computed live from API fields and labeled derived wherever shown.
   notional_value_dollars is NOT a volume measure — it is the settlement value
   of one contract (Get Market schema) — and is deliberately not used here. */
const RANK_METRICS = {
  est_dollar_volume: { label: "Est. dollar volume (derived: volume × last price)", fn: m => Number(m.volume_fp ?? 0) * Number(m.last_price_dollars ?? 0) },
  volume:  { label: "Volume (contracts)", fn: m => Number(m.volume_fp ?? 0) },
  volume24:{ label: "24h volume (contracts)", fn: m => Number(m.volume_24h_fp ?? 0) },
  oi:      { label: "Open interest (contracts)", fn: m => Number(m.open_interest_fp ?? 0) }
};
function rankMarkets(markets, metricKey = "est_dollar_volume") {
  const fn = (RANK_METRICS[metricKey] || RANK_METRICS.est_dollar_volume).fn;
  return [...markets].sort((a, b) => fn(b) - fn(a));
}
function marketTitle(m) { return m.yes_sub_title || m.title || m._series_title || ""; }
function marketRow(m, extra = "") {
  return `<tr><td><code>${esc(m.ticker)}</code></td><td>${esc(marketTitle(m))}</td>
  <td>${fmt$(m.yes_bid_dollars)}</td><td>${fmt$(m.yes_ask_dollars)}</td>
  <td>${fmt$(m.last_price_dollars)}</td><td>${fmtN(m.open_interest_fp)}</td>
  <td>${fmtN(m.volume_fp)}</td><td>${esc(m.status || "")}</td>${extra}</tr>`;
}
function renderMarketsTable(tbodyEl, markets, metricKey, extraFn, topN = 25) {
  const top = rankMarkets(markets, metricKey).slice(0, topN);
  tbodyEl.innerHTML = top.length
    ? top.map(m => marketRow(m, extraFn ? extraFn(m) : "")).join("")
    : `<tr><td colspan="9">No open markets matched. This is a live result, not an error — the demo exchange may have no matching series right now.</td></tr>`;
  return top;
}

/* ---------- Price chart (canvas, no dependencies) ----------
   X axis = time, Y axis = contract price (USD). */
function drawChart(canvas, points, opts = {}) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.clientWidth * devicePixelRatio, H = canvas.height = 320 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  const w = canvas.clientWidth, h = 320, pad = { l: 56, r: 12, t: 14, b: 34 };
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#30363d"; ctx.fillStyle = "#9aa7b4"; ctx.font = "11px sans-serif";
  if (!points.length) { ctx.fillText("No price points yet — waiting for live data…", pad.l, h / 2); return; }
  const xs = points.map(p => p.t), ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) x1 = x0 + 1000;
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 === y0) { y1 += .01; y0 -= .01; }
  const X = t => pad.l + (t - x0) / (x1 - x0) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText("$" + v.toFixed(2), 6, y + 4); }
  for (let i = 0; i <= 4; i++) { const t = x0 + (x1 - x0) * i / 4;
    ctx.fillText(new Date(t).toLocaleTimeString(), X(t) - 22, h - 12); }
  ctx.strokeStyle = "#2f81f7"; ctx.lineWidth = 2; ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(X(p.t), Y(p.y)) : ctx.moveTo(X(p.t), Y(p.y)));
  ctx.stroke(); ctx.lineWidth = 1;
  if (opts.label) { ctx.fillStyle = "#e6edf3"; ctx.fillText(opts.label, pad.l, 12); }
}

/* ---------- Authenticated (demo account) requests ----------
   Source: docs.kalshi.com/getting_started/quick_start_authenticated_requests
   Message = timestamp(ms) + METHOD + full-path-from-root-without-query. */
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}
function pemIsEd25519(pem) {
  // PKCS#8 Ed25519 private keys carry OID 1.3.101.112 = bytes 06 03 2B 65 70.
  const buf = new Uint8Array(pemToArrayBuffer(pem));
  const needle = [0x06, 0x03, 0x2b, 0x65, 0x70];
  for (let i = 0; i + needle.length <= buf.length; i++) {
    if (needle.every((b, j) => buf[i + j] === b)) return true;
  }
  return false;
}
async function signRequest({ keyId, privateKeyPem, method, path }) {
  const signPath = new URL(DEMO_BASE + path).pathname; // full path incl. /trade-api/v2, no query
  const msg = new TextEncoder().encode(String(Date.now()) + method.toUpperCase() + signPath);
  let sig;
  if (pemIsEd25519(privateKeyPem)) {
    // Ed25519 signs the message directly (no hashing). WebCrypto support is
    // still uneven — feature-detected here, flagged F3 if unavailable.
    let key;
    try {
      key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKeyPem),
        { name: "Ed25519" }, false, ["sign"]);
    } catch {
      throw new Error("This is an Ed25519 key, but this browser's WebCrypto cannot sign Ed25519. Use an RSA key in-browser, or run scripts/kalshi_client.py (Ed25519 supported) — see Flagged F3.");
    }
    sig = await crypto.subtle.sign({ name: "Ed25519" }, key, msg);
  } else {
    // RSA private key = PKCS#8 PEM ("BEGIN PRIVATE KEY"). Import as pkcs8 —
    // "spki" is the PUBLIC key format and fails here.
    const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKeyPem),
      { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
    sig = await crypto.subtle.sign({ name: "RSA-PSS", saltLength: 32 }, key, msg);
  }
  return { "KALSHI-ACCESS-KEY": keyId, "KALSHI-ACCESS-TIMESTAMP": String(Date.now()),
           "KALSHI-ACCESS-SIGNATURE": btoa(String.fromCharCode(...new Uint8Array(sig))) };
}
async function authApi(path, { method = "GET", body = null } = {}) {
  const creds = JSON.parse(sessionStorage.getItem("kalshi_demo_creds") || "null");
  if (!creds) throw new Error("No demo API credentials in this browser session. Add them on the Portfolio page.");
  const headers = await signRequest({ keyId: creds.keyId, privateKeyPem: creds.pem, method, path });
  const res = await fetch(DEMO_BASE + path, { method, headers: { ...headers, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : null });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`); e.status = res.status; e.body = json; throw e; }
  return json;
}

/* ---------- Fill helpers (Get Fills schema verified 2026-11-20) ----------
   Canonical direction fields: outcome_side ('yes'|'no') and book_side
   ('bid'|'ask'). Legacy side/action are deprecated — used only as fallback. */
function fillSideOf(f) { return (f.outcome_side ?? f.book_side ?? f.side ?? f.action ?? "unknown").toString(); }
function fillCountOf(f) { return Number(f.count_fp ?? f.count ?? 0); }
function fillFeeOf(f) { return Number(f.fee_cost ?? f.fee_cost_dollars ?? 0); } // fee_cost is fixed-point dollars
function fillPriceOf(f) { return f.yes_price_dollars ?? f.price_dollars ?? f.price ?? null; }

/* Trade-type classification (proposal-only taxonomy, defined on
   docs/trades.html and docs/sources.html; price bands are OUR analytic
   convention, not an official Kalshi taxonomy). */
function tradeTypeOf(price) {
  const p = Number(price);
  if (!isFinite(p)) return "unclassified (no price)";
  if (p <= 0.10) return "Deep longshot (≤ 10¢)";
  if (p <= 0.40) return "Moderate underdog (11–40¢)";
  if (p <= 0.60) return "Coin flip (41–60¢)";
  if (p <= 0.89) return "Favorite (61–89¢)";
  return "Near-certain (≥ 90¢)";
}

/* ---------- Watched tickers (resolved tracking), localStorage only ---------- */
const Watch = {
  get() { try { return JSON.parse(localStorage.getItem("kalshi_watch") || "[]"); } catch { return []; } },
  add(t) { const w = this.get(); if (!w.includes(t)) { w.push(t); localStorage.setItem("kalshi_watch", JSON.stringify(w)); } },
  remove(t) { localStorage.setItem("kalshi_watch", JSON.stringify(this.get().filter(x => x !== t))); }
};
function loadSavedFills() { try { return JSON.parse(localStorage.getItem("kalshi_fills") || "[]"); } catch { return []; } }

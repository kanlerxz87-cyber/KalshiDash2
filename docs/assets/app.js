/* KalshiDash2 — browser-side client for the Kalshi DEMO API.
   Public market data needs no key (docs.kalshi.com quick-start).
   Trading/portfolio needs a signed request; keys are entered by the user,
   kept only in sessionStorage, and never sent anywhere except the demo API.
   Nothing here fabricates data: every number shown comes from a live API
   response, or the cell is left blank and marked unverified. */
const DEMO_BASE = "https://external-api.demo.kalshi.co/trade-api/v2";
const DEMO_WS = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2";
const DOCS = "https://docs.kalshi.com";
const TOPICS = {
  gas:      { label: "Gas Prices", keywords: ["gas", "gasoline", "fuel"] },
  elections:{ label: "Elections",  keywords: ["election", "president", "senate", "house", "governor", "vote", "ballot", "congress"] },
  culture:  { label: "Culture",    keywords: ["culture", "movie", "film", "music", "oscar", "grammy", "emmy", "book", "celebrity", "pop"] },
  crypto:   { label: "Crypto",     keywords: ["crypto", "bitcoin", "ethereum", "btc", "eth", "coin"] },
  golf:     { label: "Golf",       keywords: ["golf", "pga", "masters", "ryder"] }
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

/* ---------- Topic discovery: keyword match against LIVE /series data.
   Series tickers are never hardcoded from memory — they come from the API. */
function seriesMatchesTopic(series, topicKey) {
  const hay = [series.ticker, series.title, series.category, series.frequency].filter(Boolean).join(" ").toLowerCase();
  return TOPICS[topicKey].keywords.some(k => hay.includes(k));
}
async function fetchSeries() {
  const out = []; let cursor = "";
  do {
    const j = await api("/series?limit=200" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
    out.push(...(j.series || [])); cursor = j.cursor || "";
  } while (cursor && out.length < 1000);
  return out;
}
async function fetchTopicMarkets(topicKey, limit = 200) {
  const series = await fetchSeries();
  const matched = series.filter(s => seriesMatchesTopic(s, topicKey));
  const markets = [];
  for (const s of matched) {
    const j = await api(`/markets?series_ticker=${encodeURIComponent(s.ticker)}&status=open&limit=${limit}`);
    for (const m of (j.markets || [])) markets.push({ ...m, _series_title: s.title || "" });
  }
  return { series: matched, markets };
}
/* "Highest dollar amount" = ranked by open interest, then volume (raw API fields). */
function rankByDollars(markets) {
  return [...markets].sort((a, b) =>
    (Number(b.open_interest_fp ?? b.open_interest ?? 0) - Number(a.open_interest_fp ?? a.open_interest ?? 0)) ||
    (Number(b.volume_fp ?? b.volume ?? 0) - Number(a.volume_fp ?? a.volume ?? 0)));
}
function marketRow(m, extra = "") {
  return `<tr><td><code>${esc(m.ticker)}</code></td><td>${esc(m.title || m._series_title || "")}</td>
  <td>${fmt$(m.yes_bid_dollars ?? m.yes_bid)}</td><td>${fmt$(m.yes_ask_dollars ?? m.yes_ask)}</td>
  <td>${fmtN(m.last_price_dollars ?? m.last_price)}</td><td>${fmtN(m.open_interest_fp ?? m.open_interest)}</td>
  <td>${fmtN(m.volume_fp ?? m.volume)}</td><td>${esc(m.status || "")}</td>${extra}</tr>`;
}

/* ---------- Price chart (canvas, no dependencies) ---------- */
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

/* ---------- Authenticated (demo account) requests: RSA-PSS via WebCrypto ----------
   Source: docs.kalshi.com/getting_started/quick_start_authenticated_requests */
function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, "").replace(/-----END [^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}
async function signRequest({ keyId, privateKeyPem, method, path }) {
  const key = await crypto.subtle.importKey("spki", pemToArrayBuffer(privateKeyPem),
    { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
  const ts = String(Date.now());
  const msg = new TextEncoder().encode(ts + method.toUpperCase() + path);
  const sig = await crypto.subtle.sign({ name: "RSA-PSS", saltLength: 32 }, key, msg);
  return { "KALSHI-ACCESS-KEY": keyId, "KALSHI-ACCESS-TIMESTAMP": ts,
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

/* ---------- Watched tickers (resolved tracking), localStorage only ---------- */
const Watch = {
  get() { try { return JSON.parse(localStorage.getItem("kalshi_watch") || "[]"); } catch { return []; } },
  add(t) { const w = this.get(); if (!w.includes(t)) { w.push(t); localStorage.setItem("kalshi_watch", JSON.stringify(w)); } },
  remove(t) { localStorage.setItem("kalshi_watch", JSON.stringify(this.get().filter(x => x !== t))); }
};

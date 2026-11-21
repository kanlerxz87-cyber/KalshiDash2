/* KalshiDash2 — shared UI helpers: escaping, formatting, navigation, status
 * pills and the canvas chart. Kept dependency-free so the site has no build
 * step and no third-party runtime code.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Money. `null` renders as an explicit unverified marker, never as $0.00. */
export function money(v, { dp = 2 } = {}) {
  const n = num(v);
  if (n === null) return `<span class="unv" title="Not returned by the API">n/a</span>`;
  return "$" + n.toFixed(dp);
}

export function money4(v) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  return "$" + n.toFixed(4);
}

export function int(v) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function dec(v, dp = 2) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function pct(v, dp = 1) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  return (n * 100).toFixed(dp) + "¢";
}

export function dt(iso) {
  if (!iso) return `<span class="unv">n/a</span>`;
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return `<span class="unv">n/a</span>`;
  return `<time datetime="${d.toISOString()}" title="${d.toISOString()}">${d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  })}</time>`;
}

export function relTime(ms) {
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return secs + "s ago";
  if (secs < 3600) return Math.round(secs / 60) + "m ago";
  return Math.round(secs / 3600) + "h ago";
}

/* A source link. Every factual row on this site carries one of these. */
export function src(url, label = "source") {
  if (!url) return `<span class="unv">no source</span>`;
  return `<a class="src-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

export function pill(el, kind, text) {
  if (!el) return;
  el.className = "pill " + kind;
  el.innerHTML = (kind === "live" ? '<span class="status-dot"></span>' : "") + esc(text);
}

export function setHTML(el, html) { if (el) el.innerHTML = html; }

export function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}"><div class="empty">${esc(text)}</div></td></tr>`;
}

/* ---------------- navigation ---------------- */

export const PAGES = [
  { href: "index.html", label: "Overview" },
  { href: "alerts.html", label: "Live alerts" },
  { href: "summary.html", label: "Summary" },
  { href: "categories/gas.html", label: "Gas", topic: "gas" },
  { href: "categories/elections.html", label: "Elections", topic: "elections" },
  { href: "categories/culture.html", label: "Culture", topic: "culture" },
  { href: "categories/crypto.html", label: "Crypto", topic: "crypto" },
  { href: "categories/golf.html", label: "Golf", topic: "golf" },
  { href: "resolved.html", label: "Resolved" },
  { href: "portfolio.html", label: "Portfolio" },
  { href: "strategies.html", label: "Strategies" },
  { href: "simulator.html", label: "Simulator" },
  { href: "suggestions.html", label: "Suggestions" },
  { href: "questions.html", label: "Questions" },
  { href: "verification.html", label: "Verification" },
  { href: "flagged.html", label: "Flagged" }
];

export function mountChrome({ page, title, depth = 0 }) {
  const prefix = depth === 0 ? "" : "../";
  const nav = PAGES.map(p => {
    const href = prefix + p.href;
    const cur = p.href === page ? ' aria-current="page"' : "";
    return `<a href="${href}"${cur}>${esc(p.label)}</a>`;
  }).join("");

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="bar">
      <a class="brand" href="${prefix}index.html">
        <span class="dot">K</span> KalshiDash2
      </a>
      <span class="env-badge" title="Every number on this site comes from the Kalshi demo environment, not production.">demo</span>
      <nav class="nav" aria-label="Sections">${nav}</nav>
    </div>`;
  document.body.prepend(header);

  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = "#main";
  skip.textContent = "Skip to content";
  document.body.prepend(skip);

  if (!document.querySelector("main")) {
    const m = document.createElement("main");
    m.id = "main";
    document.body.append(m);
  }
  document.querySelector("main").id = "main";

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <p style="margin:0 0 6px">
      <strong>${esc(title || "KalshiDash2")}</strong> · built ${esc(BUILD_DATE)} ·
      data from the Kalshi <em>demo</em> environment (mock funds).
    </p>
    <p style="margin:0">
      Market data © Kalshi. Every figure links to the official source that produced it;
      values that could not be confirmed are blank and listed on the
      <a href="${prefix}flagged.html">Flagged for review</a> page.
      API reference: <a href="https://docs.kalshi.com" target="_blank" rel="noopener noreferrer">docs.kalshi.com</a>.
      Not affiliated with or endorsed by Kalshi.
    </p>`;
  document.body.append(footer);
}

export const BUILD_DATE = "2026-11-21";

/* ---------------- canvas line chart ----------------
 *
 * X axis = time, Y axis = contract price in USD. Renders the axes the brief
 * asked for and annotates where each series came from, so a viewer can tell a
 * real candlestick history from accumulated live samples.
 * --------------------------------------------------- */
export function lineChart(canvas, series, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 640;
  const cssH = opts.height || 320;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.height = cssH + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 54, r: 14, t: 16, b: 34 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;

  const allX = series.flatMap(s => s.points.map(p => p.t)).filter(Number.isFinite);

  const panel = (msg) => {
    ctx.fillStyle = "#5d6b7a";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(msg, cssW / 2, cssH / 2);
    ctx.textAlign = "left";
  };
  if (!allX.length) { panel(opts.emptyText || "No data yet for this window."); return; }

  let x0 = Math.min(...allX);
  let x1 = Math.max(...allX);
  if (x1 - x0 < 1000) { x1 = x0 + 1000; }
  if (opts.xDomain) [x0, x1] = opts.xDomain;

  // Y domain: prices from candles/trades, plus bid/ask overlays when present.
  const ys = [];
  for (const s of series) for (const p of s.points) {
    if (!opts.include || opts.include.includes(s.key)) {
      if (p.y !== null && p.y !== undefined) ys.push(p.y);
      if (p.bid !== null && p.bid !== undefined && s.kind === "live") ys.push(p.bid);
      if (p.ask !== null && p.ask !== undefined && s.kind === "live") ys.push(p.ask);
    }
  }
  let y0 = ys.length ? Math.min(...ys) : 0;
  let y1 = ys.length ? Math.max(...ys) : 1;
  if (y1 - y0 < 0.02) { const c = (y0 + y1) / 2; y0 = Math.max(0, c - 0.01); y1 = Math.min(1, c + 0.01); }
  const padY = (y1 - y0) * 0.08;
  y0 = Math.max(0, y0 - padY);
  y1 = Math.min(1, y1 + padY);
  if (y1 <= y0) y1 = y0 + 0.02;

  const X = t => pad.l + ((t - x0) / (x1 - x0)) * w;
  const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * h;

  // grid + y labels (price)
  ctx.font = "11px ui-monospace, monospace";
  ctx.strokeStyle = "#e3e8ee";
  ctx.fillStyle = "#5d6b7a";
  ctx.lineWidth = 1;
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const v = y0 + ((y1 - y0) * i) / ySteps;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
    ctx.fillText("$" + v.toFixed(2), 6, y + 4);
  }

  // x labels (time)
  ctx.strokeStyle = "#e3e8ee";
  const xSteps = Math.max(2, Math.min(6, Math.floor(w / 110)));
  for (let i = 0; i <= xSteps; i++) {
    const t = x0 + ((x1 - x0) * i) / xSteps;
    const x = X(t);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + h); ctx.stroke();
    /* Time-of-day alone is ambiguous once the window is longer than half a day:
     * a 7-day chart would print five different "03:15" labels with no date, and
     * a 24-hour chart would repeat the label at midnight. Windows over 12 hours
     * therefore carry the calendar date as well as the clock time. */
    const span = x1 - x0;
    const label = span > 12 * 3600 * 1000
      ? new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: span <= 600000 ? "2-digit" : undefined });
    ctx.fillStyle = "#5d6b7a";
    const tw = ctx.measureText(label).width;
    ctx.fillText(label, Math.max(pad.l, Math.min(x - tw / 2, pad.l + w - tw)), cssH - 12);
  }

  // axis captions
  ctx.fillStyle = "#5d6b7a";
  ctx.font = "10.5px system-ui, sans-serif";
  ctx.fillText("time", pad.l + w - 22, cssH - 1);
  ctx.save();
  ctx.translate(11, pad.t + 10);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("contract price (USD)", -70, 0);
  ctx.restore();

  // series
  for (const s of series) {
    if (opts.include && !opts.include.includes(s.key)) continue;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width || 1.8;
    ctx.setLineDash(s.dash || []);

    // bid / ask bands for live samples
    if (s.kind === "live" && opts.showBidAsk !== false) {
      const valid = s.points.filter(p => p.bid !== null && p.ask !== null && p.bid !== undefined);
      if (valid.length > 1) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        valid.forEach((p, i) => { const x = X(p.t), y = Y(p.ask); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        for (let i = valid.length - 1; i >= 0; i--) { const p = valid[i]; ctx.lineTo(X(p.t), Y(p.bid)); }
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // main line: candles use close, live uses last trade
    const line = s.points.filter(p => p.y !== null && p.y !== undefined);
    if (line.length) {
      ctx.beginPath();
      line.forEach((p, i) => { const x = X(p.t), y = Y(p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      if (line.length === 1) { ctx.beginPath(); ctx.arc(X(line[0].t), Y(line[0].y), 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.setLineDash([]);

    // markers for live samples
    if (s.kind === "live") {
      for (const p of s.points) {
        if (p.y === null || p.y === undefined) continue;
        ctx.beginPath(); ctx.arc(X(p.t), Y(p.y), 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // jump markers — e.g. the ≥$0.10 swings detected inside a candle series.
  // Additive: when `opts.markers` is absent the chart is unchanged.
  if (Array.isArray(opts.markers) && opts.markers.length) {
    ctx.save();
    ctx.font = "10.5px ui-monospace, monospace";
    for (const mk of opts.markers) {
      if (!Number.isFinite(mk.t)) continue;
      const x = X(mk.t);
      if (x < pad.l - 1 || x > pad.l + w + 1) continue;
      ctx.strokeStyle = mk.dir === "down" ? "#a3231b" : "#0a6b45";
      ctx.globalAlpha = 0.65;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (mk.y !== null && mk.y !== undefined && Number.isFinite(mk.y)) {
        const y = Y(mk.y);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // last-value label
  const lastSeries = series.find(s => (opts.include ? opts.include.includes(s.key) : true) &&
    s.points.some(p => p.y !== null && p.y !== undefined));
  if (lastSeries) {
    const lp = [...lastSeries.points].reverse().find(p => p.y !== null && p.y !== undefined);
    if (lp) {
      const x = X(lp.t), y = Y(lp.y);
      ctx.fillStyle = "#1b2430";
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      const label = "$" + lp.y.toFixed(2);
      ctx.font = "600 11px ui-monospace, monospace";
      const tw = ctx.measureText(label).width;
      const bx = Math.min(x + 8, pad.l + w - tw - 10);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d6dde5";
      ctx.beginPath();
      ctx.roundRect(bx - 4, y - 18, tw + 8, 16, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1b2430";
      ctx.fillText(label, bx, y - 6);
    }
  }
}

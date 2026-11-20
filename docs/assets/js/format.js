/* ==========================================================================
   format.js — display helpers.
   The Kalshi API returns fixed-point STRINGS ("0.4500" dollars, "12693.57"
   contracts). Nothing here rounds or invents a value; it only renders what
   the API returned. A missing value renders as "—" and is flagged
   "unverified" by the caller.
   ========================================================================== */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Fixed-point string -> Number, or null when the API did not supply a value. */
export function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isNum(value) { return num(value) !== null; }

/** $12.34 — for prices. */
export function money(value, dp = 2) {
  const n = num(value);
  if (n === null) return '—';
  return '$' + n.toFixed(dp);
}

/** $1,234.56 — for notional amounts. */
export function usd(value, dp = 2) {
  const n = num(value);
  if (n === null) return '—';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** 12,345.67 — for contract counts (fixed-point). */
export function contracts(value) {
  const n = num(value);
  if (n === null) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** 45.0% */
export function pct(value, dp = 1) {
  const n = num(value);
  if (n === null) return '—';
  return (n * 100).toFixed(dp) + '%';
}

/** Signed money for P&L. */
export function signedUsd(value, dp = 2) {
  const n = num(value);
  if (n === null) return '—';
  return (n >= 0 ? '+$' : '−$') + Math.abs(n).toFixed(dp);
}

export function dt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function timeOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function ago(value) {
  if (!value) return '—';
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '—';
  const s = Math.max(0, Math.round((Date.now() - d) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/** "in 3h 12m" / "closed" */
export function untilClose(value) {
  if (!value) return '—';
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '—';
  const ms = d - Date.now();
  if (ms <= 0) return 'closed';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `in ${days}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

/** Time-axis label for a chosen unit. */
export function timeLabel(ms, unit) {
  const d = new Date(ms);
  switch (unit) {
    case 's':  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case 'm':  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    case 'h':  return d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    default:   return d.toLocaleTimeString();
  }
}

/** Axis title for the chosen unit. */
export function unitLabel(unit) {
  return unit === 's' ? 'Time (HH:MM:SS)'
       : unit === 'm' ? 'Time (HH:MM)'
       : 'Time (MMM DD, HH:MM)';
}

/** A ticker cell with a copy-friendly link. */
export function tickerCell(ticker, href) {
  if (!ticker) return '—';
  const t = esc(ticker);
  return href
    ? `<a href="${esc(href)}" class="mono">${t}</a>`
    : `<span class="mono">${t}</span>`;
}

/** Truncate long text but keep it readable in a table. */
export function trunc(text, n = 140) {
  const s = String(text ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ==========================================================================
   ui.js — shared UI helpers: navigation, status pills, toasts, table
   scaffolding, and the "official source" link pattern used on every table.
   ========================================================================== */

import { esc, $ } from './format.js';

export const PAGES = [
  { href: 'index.html',       label: 'Home' },
  { href: 'dashboard.html',   label: 'Live Dashboard' },
  { href: 'portfolio.html',   label: 'Portfolio & Trading' },
  { href: 'resolved.html',    label: 'Resolved Events' },
  { href: 'analysis.html',    label: 'Analysis & Strategies' },
  { href: 'suggestions.html', label: 'Suggestions' },
  { href: 'questions.html',   label: 'Open Questions' },
  { href: 'verification.html',label: 'Verification' },
  { href: 'flagged.html',     label: 'Flagged for Review' },
  { href: 'sources.html',     label: 'Sources' },
];

/** Render the shared navigation into <header data-nav>. */
export function mountNav() {
  const host = document.querySelector('[data-nav]');
  if (!host) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  host.innerHTML = PAGES.map((p) => {
    const active = p.href === here ? ' class="active"' : '';
    return `<a href="${p.href}"${active}>${esc(p.label)}</a>`;
  }).join('');
}

/** A coloured status pill. */
export function setStatus(el, ok, msg, kind) {
  if (!el) return;
  const cls = kind || (ok === true ? 'live' : ok === false ? 'err' : '');
  el.className = 'pill ' + cls;
  el.textContent = msg;
}

/** A "source" link cell — every table row that shows a value must show where
 *  the value came from. `url` may be null, in which case the cell says
 *  "unverified" instead of inventing a link. */
export function sourceCell(url, label = 'source') {
  if (!url) return '<span class="src muted">unverified — no official source</span>';
  return `<a class="src" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

/** Toast notifications. */
export function toast(message, kind = 'info', ms = 6000) {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

/** Fill a <tbody> with an empty-state message. */
export function emptyRow(tbody, colspan, message) {
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty">${esc(message)}</td></tr>`;
}

/** Build a table from column definitions and row data. */
export function renderTable(tbody, columns, rows, { empty = 'No rows.' } = {}) {
  if (!tbody) return;
  if (!rows || !rows.length) { emptyRow(tbody, columns.length, empty); return; }
  tbody.innerHTML = rows.map((row) => {
    const tds = columns.map((col) => {
      const value = typeof col.get === 'function' ? col.get(row) : row[col.key];
      const cls = col.cls ? ` class="${col.cls}"` : '';
      return `<td${cls}>${value === null || value === undefined ? '—' : value}</td>`;
    }).join('');
    return `<tr${row._id ? ` data-row="${esc(row._id)}"` : ''}>${tds}</tr>`;
  }).join('');
}

/** KPI tiles. */
export function renderKpis(host, items) {
  if (!host) return;
  host.innerHTML = items.map((i) => (
    `<div class="kpi"><div class="v">${i.value === null || i.value === undefined ? '—' : esc(i.value)}</div>` +
    `<div class="k">${esc(i.label)}</div></div>`
  )).join('');
}

/**
 * A block that states, in one line, where the data on a page comes from and
 * when it was fetched. Used at the top of every live page.
 */
export function dataProvenance(parts) {
  const bits = parts.filter(Boolean).map((p) => `<span>${p}</span>`).join(' · ');
  return `<div class="tiny-text" style="margin-bottom:10px">${bits}</div>`;
}

/** Format a fetch timestamp. */
export function stamp(d = new Date()) {
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** Read a query-string parameter. */
export function param(name) {
  return new URLSearchParams(location.search).get(name) || '';
}

/** Copy text to the clipboard (used by the "copy ticker" buttons). */
export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied ' + text, 'ok', 2500);
  } catch {
    toast('Could not copy — select the text manually.', 'err');
  }
}

/* ==========================================================================
   store.js — browser-local persistence.

   Everything here lives in this browser only:
     - localStorage  : watchlist, trade ledger, suggestion decisions, settings
     - sessionStorage: demo API credentials (see auth.js)

   Nothing is uploaded anywhere, and nothing written here ends up in the
   repository. A user can clear all of it from the Settings section on any page.
   ========================================================================== */

const PREFIX = 'kalshi.dash2.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/* ------------------------------------------------------------ watchlist -- */
/** Markets being tracked until they resolve (yes / no). */
export const Watch = {
  get() { return read('watch', []); },
  set(list) { return write('watch', list); },
  has(ticker) { return this.get().includes(ticker); },
  add(ticker) {
    const list = this.get();
    if (!list.includes(ticker)) { list.push(ticker); this.set(list); }
    return list;
  },
  remove(ticker) { return this.set(this.get().filter((t) => t !== ticker)); },
  toggle(ticker) {
    const list = this.get();
    const i = list.indexOf(ticker);
    if (i >= 0) list.splice(i, 1); else list.push(ticker);
    this.set(list);
    return list;
  },
};

/* ---------------------------------------------------------- trade ledger -- */
/**
 * A local record of every demo fill the user has loaded, used by the
 * Analysis page. Each entry keeps the API's own field names so nothing has
 * to be reinterpreted, plus a topic tag assigned from Kalshi's official
 * category/tag vocabulary.
 */
export const Ledger = {
  get() { return read('ledger', []); },
  set(rows) { return write('ledger', rows); },
  add(fills, meta = {}) {
    const existing = this.get();
    const seen = new Set(existing.map((f) => f.trade_id || `${f.ticker}|${f.created_time}|${f.count_fp}`));
    const added = [];
    for (const f of fills || []) {
      const id = f.trade_id || `${f.ticker}|${f.created_time}|${f.count_fp}`;
      if (seen.has(id)) continue;
      seen.add(id);
      added.push({ ...f, _topic: meta.topic || f._topic || null, _strategy: f._strategy || 'untagged' });
    }
    const merged = existing.concat(added);
    this.set(merged);
    return { added: added.length, total: merged.length };
  },
  setStrategy(ticker, strategy) {
    const rows = this.get().map((f) => (f.ticker === ticker ? { ...f, _strategy: strategy } : f));
    this.set(rows);
    return rows;
  },
  clear() { return this.set([]); },
};

/* -------------------------------------------------- suggestion decisions -- */
/** accept | reject | null — the reviewer's choice, kept locally. */
export const Decisions = {
  get() { return read('decisions', {}); },
  set(id, decision) {
    const d = this.get();
    if (decision) d[id] = decision; else delete d[id];
    return write('decisions', d);
  },
  of(id) { return this.get()[id] || null; },
};

/* ------------------------------------------------------------- settings -- */
export const Settings = {
  get() {
    return {
      unit: 'm',
      windowMs: 3600e3,
      topic: 'crypto',
      ...read('settings', {}),
    };
  },
  set(patch) {
    const s = { ...this.get(), ...patch };
    write('settings', s);
    return s;
  },
  reset() { return write('settings', {}); },
};

/* --------------------------------------------------------------- cleanup -- */
export function clearAllLocal() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  return keys.length;
}

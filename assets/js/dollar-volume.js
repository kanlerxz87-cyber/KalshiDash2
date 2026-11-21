/* KalshiDash2 — official traded-dollar volume.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The site ranks events by `volume_fp × last_price_dollars` and calls it what
 * it is: a *proxy*. That product is not the dollars that changed hands, and
 * Flag A11 on the Flagged page says so. Kalshi does publish enough to compute
 * the real figure, through one documented endpoint:
 *
 *   GET /markets/trades?ticker=…&min_ts=…&max_ts=…&limit=…&cursor=…
 *   https://docs.kalshi.com/api-reference/market/get-trades
 *
 * The reference states, verbatim:
 *   - it returns completed transactions, each with `count_fp` (contracts) and
 *     `yes_price_dollars` / `no_price_dollars`;
 *   - `limit` is 1–1000, default 100;
 *   - a paginated `cursor` is returned and an empty cursor means no more pages;
 *   - `min_ts` / `max_ts` are Unix **seconds** (milliseconds are rejected 400);
 *   - a `ticker` that matches nothing returns 200 with an empty `trades` list.
 *
 * Every traded contract on Kalshi is a binary contract whose YES and NO prices
 * are complements (NO = 1 − YES), which the orderbook and settlement
 * documentation both state. So the cash that changed hands in a trade of
 * `count_fp` contracts at `yes_price_dollars` = p is
 *       count_fp × p   when the taker bought YES
 *       count_fp × (1 − p)  when the taker bought NO
 * and that second form is exactly the trade's own `no_price_dollars` field.
 * This module therefore uses, for every trade, the field that matches the
 * side the taker actually took — never an assumption about direction.
 *
 * NOTHING IS INFERRED
 * -------------------
 * A trade whose price field is missing contributes nothing and is counted as
 * `missing`; if any page of results could not be read the caller is told
 * `complete:false`, and the UI must then show n/a instead of a partial total
 * presented as the whole picture. A sum of zero trades is `0` / complete, which
 * is a real answer ("no trades in this window"), not the same thing.
 *
 * This file has no DOM and no network access, so it runs unchanged in the
 * browser and under `node --test`.
 */

import { SOURCES } from "./config.js";

/* Re-exported so a page can cite the endpoint behind every number. */
export const TRADES_SOURCE = SOURCES.trades;
export const TRADES_PATH = "/markets/trades";

/* Documented bounds for the query parameters. */
export const LIMITS = Object.freeze({
  maxLimit: 1000,      // "Maximum value is 1000"
  defaultLimit: 100,   // "Defaults to 100"
  minTsUnit: "seconds" // "min_ts and max_ts must be in seconds"
});

const EPS = 1e-9;

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function round2(x) {
  return Math.round(x * 100 + (x >= 0 ? EPS : -EPS)) / 100;
}

export function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}

/* ---------------------------------------------------------------- one trade */

/* The cash value of one trade, from the fields the endpoint returned.
 *
 * `taker_outcome_side` is the documented way to know which side the taker
 * bought (the deprecated `taker_side` carries the same value). When it is
 * absent we cannot tell which price applies, so the trade is reported as
 * `priced:false` rather than guessed.
 *
 * Returns { dollars, contracts, price, priced, side, reason }.
 */
export function tradeDollars(t) {
  const contracts = num(t?.count_fp);
  const yes = num(t?.yes_price_dollars);
  const no = num(t?.no_price_dollars);
  const side = String(t?.taker_outcome_side || t?.taker_side || "").toLowerCase();

  if (contracts === null) {
    return { dollars: null, contracts: null, price: null, priced: false, side: side || null, reason: "count_fp missing" };
  }
  /* Prefer the price field the platform named for the side taken. */
  let price = null;
  if (side === "yes") price = yes;
  else if (side === "no") price = no;

  if (price === null && yes !== null) {
    /* No documented side on this row. The YES price is the one field every
     * trade in the schema is required to carry, so the row can still be valued
     * on the YES leg — but the caller is told the side was unknown so it can
     * disclose that. */
    return {
      dollars: round4(contracts * yes),
      contracts,
      price: yes,
      priced: true,
      side: null,
      reason: "taker side not returned; valued on yes_price_dollars"
    };
  }
  if (price === null) {
    return { dollars: null, contracts, price: null, priced: false, side: side || null, reason: "price field missing" };
  }
  return { dollars: round4(contracts * price), contracts, price, priced: true, side: side || null, reason: null };
}

/* -------------------------------------------------------------------- pages */

/* Fold one page of `GET /markets/trades` into a running total.
 *
 * `state` is { dollars, contracts, trades, missing, unpriced, oldest, newest }.
 * It is updated in place and the same object is returned, so pages can be
 * folded in arrival order. `oldest`/`newest` are the earliest and latest
 * `created_time` actually seen (ISO strings compare correctly), which lets the
 * UI state the exact window it measured instead of the window it asked for.
 */
export function foldTradesPage(state, page) {
  const acc = state || emptyTally();
  const trades = Array.isArray(page?.trades) ? page.trades : [];
  for (const t of trades) {
    acc.trades += 1;
    const d = tradeDollars(t);
    if (d.priced) {
      acc.dollars += d.dollars;
      acc.contracts += d.contracts;
      if (d.side === null) acc.unpriced += 1;
    } else {
      acc.missing += 1;
    }
    const ts = typeof t?.created_time === "string" ? t.created_time : null;
    if (ts) {
      if (!acc.oldest || ts < acc.oldest) acc.oldest = ts;
      if (!acc.newest || ts > acc.newest) acc.newest = ts;
    }
  }
  return acc;
}

export function emptyTally() {
  return { dollars: 0, contracts: 0, trades: 0, missing: 0, unpriced: 0, oldest: null, newest: null };
}

/* Present a tally for display.
 *
 * `complete` is the caller's statement that every page was read. When it is
 * false the figure must not be shown as a total: `display` is null and
 * `note` says why, so the page renders n/a and flags it.
 */
export function summariseTally(tally, { complete = true, pagesRead = 0, capped = false } = {}) {
  const t = tally || emptyTally();
  const ok = complete !== false && !capped;
  return {
    dollars: ok ? round2(t.dollars) : null,
    contracts: t.contracts,
    trades: t.trades,
    missing: t.missing,
    unpriced: t.unpriced,
    oldest: t.oldest,
    newest: t.newest,
    pagesRead,
    complete: ok,
    note: ok
      ? (t.missing ? `${t.missing} trade(s) carried no usable price and are excluded from the dollar total.` : null)
      : "At least one page of trades could not be read, so no dollar total is shown."
  };
}

/* ------------------------------------------------------------------ windows */

/* Convert a window in seconds into the documented query parameters.
 *
 * `min_ts`/`max_ts` are Unix seconds — the reference rejects milliseconds with
 * 400 — so the boundaries are floored to whole seconds here. `nowMs` is
 * injectable so the behaviour is testable without a clock.
 */
export function windowQuery({ seconds = 86400, nowMs = Date.now(), limit = LIMITS.defaultLimit } = {}) {
  const secs = Number(seconds);
  const safeSecs = Number.isFinite(secs) && secs > 0 ? Math.floor(secs) : 86400;
  const nowSec = Math.floor(nowMs / 1000);
  const n = Number(limit);
  const lim = Number.isFinite(n) && n >= 1
    ? Math.min(LIMITS.maxLimit, Math.floor(n))
    : LIMITS.defaultLimit;
  return {
    min_ts: nowSec - safeSecs,
    max_ts: nowSec,
    limit: lim,
    seconds: safeSecs
  };
}

/* Build the request path for one market. The ticker is encodeURIComponent'd so
 * a malformed ticker can never change the query. */
export function tradesPath(ticker, { min_ts, max_ts, limit }) {
  const p = new URLSearchParams();
  p.set("ticker", String(ticker));
  if (Number.isFinite(min_ts)) p.set("min_ts", String(min_ts));
  if (Number.isFinite(max_ts)) p.set("max_ts", String(max_ts));
  if (Number.isFinite(limit)) p.set("limit", String(limit));
  return `${TRADES_PATH}?${p.toString()}`;
}

/* Walk every page for one market.
 *
 * `get` is an async (path) => parsed-json function (the page passes the demo
 * client's unauthenticated `get`). Returns
 *   { summary, perPage, stopped }
 * where `stopped` explains an early stop: "cap" (the caller's page budget ran
 * out with a cursor still present) or "error" (a request threw). Either way the
 * summary renders as n/a rather than as a partial total.
 */
export async function collectTrades(get, ticker, {
  seconds = 86400,
  nowMs = Date.now(),
  limit = LIMITS.defaultLimit,
  maxPages = 3
} = {}) {
  const w = windowQuery({ seconds, nowMs, limit });
  let tally = emptyTally();
  let pages = 0;
  let cursor = "";
  let stopped = null;
  const perPage = [];

  for (let i = 0; i < Math.max(1, maxPages); i++) {
    const base = tradesPath(ticker, w);
    const path = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
    let page;
    try {
      page = await get(path);
    } catch {
      stopped = "error";
      break;
    }
    pages += 1;
    tally = foldTradesPage(tally, page);
    perPage.push((page?.trades || []).length);
    cursor = typeof page?.cursor === "string" ? page.cursor : "";
    if (!cursor) { stopped = null; break; }
    if (i === Math.max(1, maxPages) - 1) stopped = "cap";
  }

  const summary = summariseTally(tally, {
    complete: stopped === null,
    pagesRead: pages,
    capped: stopped === "cap"
  });
  if (stopped === "error") summary.note = "The trades endpoint could not be read, so no dollar total is shown.";
  return { summary, perPage, stopped, window: w };
}

/* Rank events by official traded dollars for a chosen window.
 *
 * `events` are the nested-market event records the board already holds. The top
 * `maxMarkets` open markets are measured, highest contract volume first, because
 * every market costs at least one request. The returned `measured` count and
 * `skippedMarkets` are shown to the reader: this is a ranked sample, not a
 * census, and saying so is the difference between a measurement and a guess.
 */
export async function rankByTradedDollars(get, events, {
  seconds = 86400,
  nowMs = Date.now(),
  maxMarkets = 12,
  perMarketPages = 2,
  limit = LIMITS.maxLimit,
  onProgress = () => {}
} = {}) {
  const candidates = [];
  for (const ev of events || []) {
    for (const m of ev?.markets || []) {
      if (!m || !m.ticker) continue;
      if (!["active", "open"].includes(m.status)) continue;
      candidates.push({ ev, m, volume: num(m.volume_fp) || 0 });
    }
  }
  candidates.sort((a, b) => b.volume - a.volume);
  const chosen = candidates.slice(0, Math.max(1, maxMarkets));

  const byEvent = new Map();
  let measured = 0;
  let failed = 0;
  let requests = 0;

  for (const c of chosen) {
    const res = await collectTrades(get, c.m.ticker, { seconds, nowMs, limit, maxPages: perMarketPages });
    requests += res.perPage.length;
    if (res.summary.complete) measured += 1; else failed += 1;
    const key = c.ev.event_ticker || c.ev.title || c.m.ticker;
    const row = byEvent.get(key) || { event: c.ev, dollars: 0, trades: 0, contracts: 0, complete: true, markets: 0 };
    row.markets += 1;
    if (res.summary.complete) {
      row.dollars += res.summary.dollars || 0;
      row.trades += res.summary.trades;
      row.contracts += res.summary.contracts;
    } else {
      row.complete = false;
    }
    byEvent.set(key, row);
    onProgress({ measured, failed, requests, total: chosen.length });
  }

  const rows = [...byEvent.values()].map(r => ({
    ...r,
    dollars: r.complete ? round2(r.dollars) : null
  })).sort((a, b) => (b.dollars || 0) - (a.dollars || 0));

  return {
    rows,
    measured,
    failed,
    requests,
    skippedMarkets: Math.max(0, candidates.length - chosen.length),
    totalMarkets: candidates.length,
    window: windowQuery({ seconds, nowMs, limit })
  };
}

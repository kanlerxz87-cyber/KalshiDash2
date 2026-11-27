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
 * A trade whose price field is missing, or whose recorded taker side is absent,
 * contributes nothing and is counted as `missing`; if any page of results could
 * not be read the caller is told `complete:false`, and the UI must then show n/a
 * instead of a partial total presented as the whole picture. A sum of zero
 * trades is `0` / complete, which is a real answer ("no trades in this window"),
 * not the same thing.
 *
 * The taker side is what decides which of the two price fields applies, so a
 * row without it is NOT valued on the YES leg: doing that would invent a dollar
 * amount for a trade whose recorded side is unknown, which is exactly what the
 * verification rules forbid. It is counted in `unsided` and disclosed.
 *
 * This file has no DOM and no network access, so it runs unchanged in the
 * browser and under `node --test`.
 */

import { SOURCES } from "./config.js";
import { createPageGuard } from "./paging.js";

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

  /* No recorded side: which of the two price fields applied is unknown, so the
   * row gets no dollar amount. Valuing it on the YES leg would manufacture a
   * number the exchange never recorded. */
  if (!side) {
    return { dollars: null, contracts, price: null, priced: false, side: null, reason: "taker side not returned" };
  }
  if (price === null) {
    return { dollars: null, contracts, price: null, priced: false, side, reason: `no ${side}_price_dollars on this trade` };
  }
  return { dollars: round4(contracts * price), contracts, price, priced: true, side: side || null, reason: null };
}

/* -------------------------------------------------------------------- pages */

/* Fold one page of `GET /markets/trades` into a running total.
 *
 * `state` is { dollars, contracts, trades, missing, unsided, oldest, newest }.
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
    } else {
      acc.missing += 1;
      if (!d.side) acc.unsided += 1;
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
  return { dollars: 0, contracts: 0, trades: 0, missing: 0, unsided: 0, oldest: null, newest: null };
}

/* The sentence that discloses trades excluded from a total.
 *
 * A row can be excluded for two different reasons, and the reader is told which:
 * no usable price, or no recorded taker side. The second is the one an earlier
 * version of this module got wrong — it valued those rows on the YES leg and
 * folded the guess into the total.
 */
export function missingNote(t) {
  const missing = t?.missing || 0;
  if (!missing) return null;
  const unsided = t?.unsided || 0;
  const priced = missing - unsided;
  const parts = [];
  if (unsided) parts.push(`${unsided} had no recorded taker side`);
  if (priced) parts.push(`${priced} carried no usable price`);
  return `${missing} trade(s) could not be valued (${parts.join("; ")}) and are excluded from the dollar total.`;
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
    missing: t.missing || 0,
    unsided: t.unsided || 0,
    oldest: t.oldest,
    newest: t.newest,
    pagesRead,
    complete: ok,
    duplicateTrades: t.duplicateTrades || 0,
    note: ok
      ? [
          t.missing ? missingNote(t) : null,
          t.duplicateTrades ? `${t.duplicateTrades} repeated trade row(s) were counted once (the exchange re-sent a page).` : null
        ].filter(Boolean).join(" ") || null
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
 * out with a cursor still present), "repeat" (the exchange handed back a cursor
 * it had already given us — see below) or "error" (a request threw). Either way
 * the summary renders as n/a rather than as a partial total.
 *
 * WHY THE "repeat" CASE EXISTS
 * ----------------------------
 * Kalshi's Get Markets reference documents that "a `cursor` that cannot be
 * decoded is ignored and the first page is returned, with no error"
 * (https://docs.kalshi.com/api-reference/market/get-markets, read 2026-11-22).
 * A dollar total is the worst place for that to happen silently: the same trades
 * would be summed twice and still look complete. Rows are therefore deduplicated
 * by `trade_id` and a repeated cursor ends the walk with `complete: false`, so
 * the page prints n/a and says why instead of doubling the figure.
 */
/* A disclosed footnote for rows the guard removed. The dollar figure stays the
 * sum of distinct trades; the reader is told repeats were seen rather than being
 * shown a number whose provenance changed. */
function summaryNoteDuplicateTrades(tally, dropped) {
  tally.duplicateTrades = (tally.duplicateTrades || 0) + dropped;
}

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
  const guard = createPageGuard();

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
    // Both fields are required by Get Trades. A malformed success response
    // is not evidence of zero trades or of the end of pagination.
    if (!Array.isArray(page?.trades) || typeof page.cursor !== "string") {
      stopped = "invalid";
      break;
    }
    pages += 1;
    const raw = page.trades;
    /* Fold only the trades this walk has not already counted. */
    const fresh = guard.accept(raw);
    tally = foldTradesPage(tally, { trades: fresh });
    perPage.push(raw.length);
    const next = page.cursor;
    if (!next) { stopped = null; break; }
    if (raw.length > 0 && fresh.length === 0) {
      /* Every row on this page was already seen: the listing restarted, so the
         pages after it are unknown and no total may be claimed. */
      stopped = "repeat";
      break;
    }
    if (!guard.remember(next)) { stopped = "repeat"; break; }
    cursor = next;
    if (i === Math.max(1, maxPages) - 1) stopped = "cap";
  }
  /* Repeats the guard removed are disclosed beside the total; when the walk was
   * cut short the total is suppressed anyway, and the note explains the stop. */
  if (guard.state.dropped) summaryNoteDuplicateTrades(tally, guard.state.dropped);

  const summary = summariseTally(tally, {
    complete: stopped === null,
    pagesRead: pages,
    capped: stopped === "cap"
  });
  if (stopped === "invalid") summary.note = "The trades response did not contain the required trades array and string cursor, so no dollar total is shown.";
  if (stopped === "error") summary.note = "The trades endpoint could not be read, so no dollar total is shown.";
  if (stopped === "repeat") {
    summary.note = "The exchange re-sent a page it had already returned (an undecodable cursor restarts the "
      + "listing without error), so the walk stopped and no dollar total is shown.";
  }
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
  /* Trades that could not be valued, carried to the page so the exclusion is
   * disclosed instead of silently shrinking the total. */
  let missingTrades = 0;
  let unsidedTrades = 0;
  const observed = { oldest: null, newest: null };

  for (const c of chosen) {
    const res = await collectTrades(get, c.m.ticker, { seconds, nowMs, limit, maxPages: perMarketPages });
    requests += res.perPage.length;
    if (res.summary.complete) measured += 1; else failed += 1;
    const key = c.ev.event_ticker || c.ev.title || c.m.ticker;
    const row = byEvent.get(key) || { event: c.ev, dollars: 0, trades: 0, contracts: 0, complete: true, markets: 0, tickers: [], missing: 0, unsided: 0 };
    row.markets += 1;
    row.tickers.push({ ticker: c.m.ticker, complete: res.summary.complete, dollars: res.summary.dollars });
    row.missing += res.summary.missing || 0;
    row.unsided += res.summary.unsided || 0;
    missingTrades += res.summary.missing || 0;
    unsidedTrades += res.summary.unsided || 0;
    /* The timestamps of the trades actually read, so the page can state the
     * window it observed instead of only the window it asked for. */
    if (res.summary.oldest && (!observed.oldest || res.summary.oldest < observed.oldest)) observed.oldest = res.summary.oldest;
    if (res.summary.newest && (!observed.newest || res.summary.newest > observed.newest)) observed.newest = res.summary.newest;
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
    missingTrades,
    unsidedTrades,
    observed,
    skippedMarkets: Math.max(0, candidates.length - chosen.length),
    totalMarkets: candidates.length,
    window: windowQuery({ seconds, nowMs, limit })
  };
}

/* KalshiDash2 — alert engine (pure logic: no DOM, no network).
 *
 * Everything in this file is arithmetic on fields the Kalshi API returns:
 *   price        = last_price_dollars   (GET /markets, Get Markets schema)
 *   quote        = yes_bid_dollars / yes_ask_dollars / no_bid_dollars / no_ask_dollars
 *   open_interest_fp, volume_24h_fp, result, status
 * Nothing is predicted. The "High-ROI watch" is a transparent rule set that
 * stands in for a model; it is not a model, and no return is forecast.
 *
 * Imports only TRADE_SCREEN from config.js (no DOM, no network), so it runs
 * unchanged in the browser and in Node tests.
 */

/* A sudden swing is a change of at least this many dollars per contract
 * between two consecutive polls. */
export const THRESHOLD = 0.10;

/* High-ROI watch rules. Every rule must pass. Values are parameters, not
 * claims: they are shown on the page and listed on the Flagged page. */
export const WATCH_RULES = Object.freeze({
  maxSpread: 0.05,     // yes_ask − yes_bid must be ≤ $0.05 (tradeable, two-sided quote)
  minPrice: 0.10,      // price after the move must sit between 10¢ and 90¢
  maxPrice: 0.90,      // (near-settled contracts are excluded)
  minOpenInterest: 1   // at least one contract open
});

/* Paper strategies. "Follow" buys the side the move went toward; "Fade" buys
 * the opposite side. Each runs on all alerts or only on the High-ROI watch. */
export const STRATEGIES = Object.freeze([
  { key: "follow-all",   label: "Follow · all alerts",       side: "follow", scope: "all" },
  { key: "fade-all",     label: "Fade · all alerts",         side: "fade",   scope: "all" },
  { key: "follow-watch", label: "Follow · High-ROI watch",   side: "follow", scope: "watch" },
  { key: "fade-watch",   label: "Fade · High-ROI watch",     side: "fade",   scope: "watch" }
]);

import { TRADE_SCREEN } from "./config.js";

const EPS = 1e-9;

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Round to 4 decimals: the API's dollar fields are 4-decimal strings. */
export function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}

export function priceOf(m) {
  return num(m?.last_price_dollars);
}

export function quoteOf(m) {
  const yesBid = num(m?.yes_bid_dollars);
  const yesAsk = num(m?.yes_ask_dollars);
  return {
    yesBid,
    yesAsk,
    noBid: num(m?.no_bid_dollars),
    noAsk: num(m?.no_ask_dollars),
    spread: yesBid !== null && yesAsk !== null ? round4(yesAsk - yesBid) : null
  };
}

/* Project-defined volume-price proxy: cumulative contract volume × current last YES price.
 * This is not the sum of actual trade consideration (nor an exchange-provided dollar-volume field). */
export function volumePriceProxy(m) {
  const v = num(m?.volume_fp);
  const p = priceOf(m);
  return v === null || p === null ? null : v * p;
}

/* ------------------------------------------------------------------ moves */

/* Compare each market's last traded price with the price seen on the previous
 * poll. `prev` maps ticker → { price, at }. Markets with no trade price are
 * skipped and keep their previous baseline; a market seen for the first time
 * sets a baseline and cannot alert yet.
 *
 * Returns { alerts, next } and never mutates `prev`. */
export function detectMoves(prev, markets, { threshold = THRESHOLD, at = Date.now() } = {}) {
  const next = { ...prev };
  const alerts = [];
  for (const m of markets || []) {
    if (!m || !m.ticker) continue;
    const price = priceOf(m);
    if (price === null) continue;
    const before = prev[m.ticker];
    if (before && before.price !== null && before.price !== undefined) {
      const delta = round4(price - before.price);
      if (Math.abs(delta) >= threshold - EPS && delta !== 0) {
        alerts.push({
          id: `${m.ticker}@${at}`,
          at,
          prevAt: before.at,
          ticker: m.ticker,
          title: m.title || "",
          eventTicker: m._event_ticker || m.event_ticker || "",
          topic: m._topic || null,
          from: before.price,
          to: price,
          delta,
          direction: delta > 0 ? "up" : "down",
          basis: "between two polls",
          quote: quoteOf(m),
          status: m.status || null,
          result: (m.result || "").toLowerCase() || null,
          openInterest: num(m.open_interest_fp),
          volume24h: num(m.volume_24h_fp),
          screen: screenMarket(m)
        });
      }
    }
    next[m.ticker] = { price, at };
  }
  return { alerts, next };
}

/* A swing measured against the exchange's own previous price.
 *
 * Kalshi publishes `previous_price_dollars` on every market. The schema
 * describes it as the last traded YES price a day ago; this page uses it as
 * the exchange's own reference price (see Flagged Z1). Comparing it with
 * `last_price_dollars` gives a swing that is available on the very first
 * poll, without waiting for a second reading, and it is the exchange's own
 * reference rather than this page's.
 * (https://docs.kalshi.com/api-reference/market/get-market)
 *
 * The same move is reported again on every later poll until the exchange rolls
 * its reference forward, so callers must de-duplicate on (ticker, from, to).
 */
export function detectReferenceSwings(markets, { threshold = THRESHOLD, at = Date.now() } = {}) {
  const swings = [];
  for (const m of markets || []) {
    if (!m || !m.ticker) continue;
    const last = num(m.last_price_dollars);
    const prev = num(m.previous_price_dollars);
    if (last === null || prev === null) continue;
    const delta = round4(last - prev);
    if (Math.abs(delta) < threshold - EPS || delta === 0) continue;
    swings.push({
      id: `${m.ticker}@ref${at}`,
      at,
      prevAt: null,
      ticker: m.ticker,
      title: m.title || "",
      eventTicker: m._event_ticker || m.event_ticker || "",
      topic: m._topic || null,
      from: prev,
      to: last,
      delta,
      direction: delta > 0 ? "up" : "down",
      // The schema is explicit: previous_price_dollars is the last traded YES
      // price *a day ago*, so this comparison is a 24-hour move, not an
      // intraday swing. The label says so, because a 24-hour move printed next
      // to sub-minute poll moves would otherwise read as sudden.
      basis: "exchange previous price (a day ago)",
      quote: quoteOf(m),
      status: m.status || null,
      result: (m.result || "").toLowerCase() || null,
      openInterest: num(m.open_interest_fp),
      volume24h: num(m.volume_24h_fp),
      screen: screenMarket(m)
    });
  }
  return swings;
}

/* Merge two alert lists, dropping a swing that is already present with the
 * same ticker and the same from/to pair. The first list wins. */
export function mergeAlerts(first, second) {
  const seen = new Set();
  const out = [];
  for (const a of [...(first || []), ...(second || [])]) {
    const key = `${a.ticker}|${a.from}|${a.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/* ------------------------------------------------------------ High-ROI rule */

/* Returns { pass, checks } so the page can show exactly which rule failed. */
export function watchCheck(alert, rules = WATCH_RULES) {
  const q = alert.quote || {};
  const checks = [
    {
      key: "two-sided",
      label: "Two-sided quote (yes bid and yes ask present)",
      ok: q.yesBid !== null && q.yesAsk !== null && q.yesBid > 0 && q.yesAsk > 0
    },
    {
      key: "spread",
      label: `Spread ≤ $${rules.maxSpread.toFixed(2)}`,
      ok: q.spread !== null && q.spread <= rules.maxSpread + EPS
    },
    {
      key: "price-band",
      label: `Price after move between $${rules.minPrice.toFixed(2)} and $${rules.maxPrice.toFixed(2)}`,
      ok: alert.to >= rules.minPrice - EPS && alert.to <= rules.maxPrice + EPS
    },
    {
      key: "open-interest",
      label: `Open interest ≥ ${rules.minOpenInterest} contract`,
      ok: alert.openInterest !== null && alert.openInterest >= rules.minOpenInterest
    }
  ];
  return { pass: checks.every(c => c.ok), checks };
}

/* ------------------------------------------------------------ strategies */

/* Which side a strategy buys for a given alert, and at what displayed ask.
 * Returns { side, entry } or { skip } with the reason. */
export function entryFor(alert, strategy) {
  const buyYes = strategy.side === "follow" ? alert.direction === "up" : alert.direction === "down";
  const side = buyYes ? "yes" : "no";
  const entry = side === "yes" ? alert.quote?.yesAsk : alert.quote?.noAsk;
  if (entry === null || entry === undefined || !(entry > 0 && entry < 1)) {
    return { skip: `no ${side.toUpperCase()} ask in the poll that raised the alert` };
  }
  return { side, entry: round4(entry) };
}

export function hasOpen(trades, strategyKey, ticker) {
  return trades.some(t => t.status === "open" && t.strategy === strategyKey && t.ticker === ticker);
}

/* Open one simulated 1-contract trade per (alert × applicable strategy).
 * A strategy never holds two open positions in the same market. */
export function planTrades(alerts, trades, { watch = new Map(), at = Date.now() } = {}) {
  const created = [];
  const skipped = {};
  const open = [...trades];
  for (const alert of alerts) {
    const isWatch = !!watch.get(alert.id)?.pass;
    for (const s of STRATEGIES) {
      if (s.scope === "watch" && !isWatch) continue;
      const e = entryFor(alert, s);
      if (e.skip) { skipped[e.skip] = (skipped[e.skip] || 0) + 1; continue; }
      if (hasOpen(open, s.key, alert.ticker)) { skipped["already holding this market in this strategy"] = (skipped["already holding this market in this strategy"] || 0) + 1; continue; }
      const trade = {
        id: `${s.key}:${alert.ticker}:${at}`,
        strategy: s.key,
        ticker: alert.ticker,
        title: alert.title,
        eventTicker: alert.eventTicker,
        topic: alert.topic,
        side: e.side,
        entry: e.entry,
        alertId: alert.id,
        openedAt: at,
        status: "open",
        mark: null,
        unrealized: null,
        result: null,
        payout: null,
        pnl: null,
        closedAt: null
      };
      created.push(trade);
      open.push(trade);
    }
  }
  return { created, skipped };
}

/* Update one simulated trade from a fresh market object. A trade is resolved
 * only when the API reports result yes/no; until then it is marked at the
 * best bid for its side (what it could be sold for right now, before fees). */
export function updateTrade(trade, m, at = Date.now()) {
  if (!m || trade.status !== "open") return trade;
  const result = (m.result || "").toLowerCase();
  if (result === "yes" || result === "no") {
    const payout = trade.side === result ? 1 : 0;
    return { ...trade, status: "resolved", result, payout, pnl: round4(payout - trade.entry), closedAt: at, mark: null, unrealized: null };
  }
  const bid = trade.side === "yes" ? num(m.yes_bid_dollars) : num(m.no_bid_dollars);
  return {
    ...trade,
    result: null,
    mark: bid,
    unrealized: bid === null ? null : round4(bid - trade.entry),
    markedAt: at
  };
}

/* Per-strategy summary. Every figure is computed from the trade list; a figure
 * with no inputs is null, not zero. */
export function summarize(trades) {
  return STRATEGIES.map(s => {
    const mine = trades.filter(t => t.strategy === s.key);
    const resolved = mine.filter(t => t.status === "resolved");
    const open = mine.filter(t => t.status === "open");
    const wins = resolved.filter(t => t.pnl > 0).length;
    const realized = resolved.length ? round4(resolved.reduce((a, t) => a + t.pnl, 0)) : null;
    const cost = resolved.reduce((a, t) => a + t.entry, 0);
    const marks = open.filter(t => t.unrealized !== null);
    return {
      key: s.key,
      label: s.label,
      scope: s.scope,
      trades: mine.length,
      open: open.length,
      resolved: resolved.length,
      wins,
      winRate: resolved.length ? wins / resolved.length : null,
      realized,
      roi: resolved.length && cost > 0 ? realized / cost : null,
      unrealized: marks.length ? round4(marks.reduce((a, t) => a + t.unrealized, 0)) : null,
      marked: marks.length
    };
  });
}

/* -------------------------------------------------------------- universe */

/* Choose which open markets to poll: the top `perTopic` markets per topic by
 * the volume × last YES-price proxy, plus any ticker in `keep` (open positions keep being tracked
 * until they resolve). */
export function pickUniverse(markets, { perTopic = 30, keep = [] } = {}) {
  const byTopic = new Map();
  for (const m of markets || []) {
    if (!m || !m._topic) continue;
    if (!byTopic.has(m._topic)) byTopic.set(m._topic, []);
    byTopic.get(m._topic).push(m);
  }
  const out = new Map();
  for (const list of byTopic.values()) {
    list.sort((a, b) => (volumePriceProxy(b) ?? -1) - (volumePriceProxy(a) ?? -1));
    for (const m of list.slice(0, perTopic)) out.set(m.ticker, m);
  }
  const keepSet = new Set(keep);
  for (const m of markets || []) if (m && keepSet.has(m.ticker)) out.set(m.ticker, m);
  return [...out.values()];
}

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ---------------------------------------------------------------------------
 * Tradeability screen.
 *
 * A transparent ranking of a contract by how tradeable it is right now:
 * liquidity, the cost of getting in, the size resting at the touch, whether
 * the price sits at a lottery extreme, how long the market has left, and
 * whether anything has traded recently.
 *
 * This is deliberately NOT a probability model and it forecasts nothing. It
 * adds up points from named components so a reader can see exactly why a
 * market was ranked where it was. The hit rate of each signal is measured
 * separately on settled demo markets by the Strategy Tester.
 *
 * Every input is a documented market field
 * (https://docs.kalshi.com/api-reference/market/get-market):
 *   open_interest_fp, yes_bid_dollars, yes_ask_dollars, yes_bid_size_fp,
 *   yes_ask_size_fp, volume_24h_fp, close_time, last_price_dollars
 */
export function screenMarket(market, { now = Date.now(), components } = {}) {
  const comps = components || TRADE_SCREEN.components;
  const last = num(market.last_price_dollars);
  const bid = num(market.yes_bid_dollars);
  const ask = num(market.yes_ask_dollars);
  const bidSize = num(market.yes_bid_size_fp);
  const askSize = num(market.yes_ask_size_fp);
  const oi = num(market.open_interest_fp);
  const vol24 = num(market.volume_24h_fp);
  const close = market.close_time ? Date.parse(market.close_time) : null;
  const hoursLeft = close && Number.isFinite(close) ? (close - now) / 3600000 : null;

  const spread = (bid !== null && ask !== null) ? Number((ask - bid).toFixed(4)) : null;
  const depth = (bidSize !== null || askSize !== null) ? (bidSize || 0) + (askSize || 0) : null;

  const inputs = {
    open_interest_fp: oi,
    "yes_ask_dollars \u2212 yes_bid_dollars": spread,
    "yes_bid_size_fp + yes_ask_size_fp": depth,
    last_price_dollars: last,
    close_time: hoursLeft,
    volume_24h_fp: vol24
  };

  const parts = [];
  let score = 0;
  for (const c of comps) {
    const raw = inputs[c.field];
    /* A field the API did not return scores nothing — it is never treated
     * as a value. */
    const got = (raw === null || raw === undefined) ? 0 : c.score(raw);
    parts.push({ key: c.key, label: c.label, rule: c.rule, max: c.max, got, input: raw });
    score += got;
  }
  const max = comps.reduce((a, c) => a + c.max, 0) || 100;
  return { score: Math.round(score), max, parts, spread, depth, hoursLeft, last, bid, ask };
}

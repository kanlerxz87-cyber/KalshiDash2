/* ==========================================================================
   classify.js — topic selection and dollar metrics.

   Everything in this file is driven by Kalshi's OFFICIAL category / tag
   vocabulary (see config.js and data/probe/api_surface.json). Market titles
   are never keyword-matched: "Las Vegas" must not land in the Gas Prices
   topic, and "weather"/"whether" must not land in Crypto.

   DOLLAR METRIC (important, and stated on every table that uses it):
     Kalshi reports volume as a fixed-point CONTRACT COUNT
     (`volume_fp`, `volume_24h_fp`, `open_interest_fp`). Every market also
     reports `notional_value_dollars = "1.0000"`, i.e. one contract carries
     exactly $1.00 of notional. A contract count is therefore numerically
     equal to gross dollar notional — no price weighting or estimation is
     applied. Trading fees are NOT included (Kalshi publishes its fee
     schedule separately at https://kalshi.com/docs/kalshi-fee-schedule.pdf).
   ========================================================================== */

import { TOPICS, TOPIC_ORDER, TTL } from './config.js';
import { Api, getAll } from './api.js';
import { num } from './format.js';

/** Series filters for one topic, as query parameters for GET /series. */
export function seriesQueries(topicKey) {
  const t = TOPICS[topicKey];
  const queries = [];
  if (t.category) queries.push({ category: t.category });
  for (const tag of t.tags || []) queries.push({ tags: tag });
  return queries;
}

/**
 * Load the series for a topic.
 * Uses the official server-side `category` / `tags` filters so the browser
 * never downloads the full 16k-series catalogue.
 */
export async function loadSeries(topicKey) {
  const t = TOPICS[topicKey];
  const wantedTags = new Set((t.tags || []).map((x) => x.toLowerCase()));
  const byTicker = new Map();
  const sources = [];

  for (const q of seriesQueries(topicKey)) {
    const list = await Api.series({ ...q, include_volume: true }, { ttl: TTL.series });
    for (const s of list || []) {
      if (!byTicker.has(s.ticker)) byTicker.set(s.ticker, s);
    }
    sources.push(Object.keys(q).map((k) => `${k}=${encodeURIComponent(q[k])}`).join('&'));
  }

  let series = Array.from(byTicker.values());
  // When a topic is defined by tags only, keep only series that really carry
  // one of those tags (the API `tags` filter is exact and case-sensitive).
  if (!t.category && wantedTags.size) {
    series = series.filter((s) => (s.tags || []).some((tag) => wantedTags.has(String(tag).toLowerCase())));
  }
  series.sort((a, b) => (num(b.volume_fp) || 0) - (num(a.volume_fp) || 0));
  return { series, sources };
}

/**
 * Load the open events + their markets for a set of series tickers.
 * GET /events?series_ticker=...&status=open&with_nested_markets=true
 */
export async function loadEvents(seriesTickers, { maxSeries = 40 } = {}) {
  const events = new Map();
  const markets = new Map();
  for (const st of seriesTickers.slice(0, maxSeries)) {
    let list;
    try {
      list = await Api.events({ series_ticker: st, status: 'open', with_nested_markets: true }, { ttl: TTL.events });
    } catch {
      continue; // one bad series must not kill the whole page
    }
    for (const ev of list?.events || []) {
      if (!ev.event_ticker) continue;
      if (!events.has(ev.event_ticker)) events.set(ev.event_ticker, { ...ev, markets: [] });
      const target = events.get(ev.event_ticker);
      for (const m of ev.markets || []) {
        if (!markets.has(m.ticker)) markets.set(m.ticker, m);
        target.markets.push(m);
      }
    }
  }
  return { events: Array.from(events.values()), markets: Array.from(markets.values()) };
}

/** Dollar metrics for one market, from verbatim API fields. */
export function marketMetrics(m) {
  const notional = num(m.notional_value_dollars);
  return {
    last: num(m.last_price_dollars),
    yesBid: num(m.yes_bid_dollars),
    yesAsk: num(m.yes_ask_dollars),
    noBid: num(m.no_bid_dollars),
    noAsk: num(m.no_ask_dollars),
    volume: num(m.volume_fp),
    volume24h: num(m.volume_24h_fp),
    openInterest: num(m.open_interest_fp),
    contractNotional: notional,
    // 1 contract = $1 notional, so contracts -> dollars.
    volumeDollars: notional === null ? null : (num(m.volume_fp) || 0) * notional,
    volume24hDollars: notional === null ? null : (num(m.volume_24h_fp) || 0) * notional,
    openInterestDollars: notional === null ? null : (num(m.open_interest_fp) || 0) * notional,
  };
}

/** Aggregate an event's markets into event-level dollar metrics. */
export function eventMetrics(ev) {
  let vol = 0, vol24 = 0, oi = 0, n = 0, notional = null;
  for (const m of ev.markets || []) {
    const mm = marketMetrics(m);
    if (mm.contractNotional !== null) notional = mm.contractNotional;
    vol += mm.volume || 0;
    vol24 += mm.volume24h || 0;
    oi += mm.openInterest || 0;
    n += 1;
  }
  return {
    markets: n,
    volume: vol,
    volume24h: vol24,
    openInterest: oi,
    volumeDollars: notional === null ? null : vol * notional,
    volume24hDollars: notional === null ? null : vol24 * notional,
    openInterestDollars: notional === null ? null : oi * notional,
    contractNotional: notional,
  };
}

/** Rank events by 24h dollar volume, then lifetime dollar volume. */
export function rankEvents(events) {
  return [...events].sort((a, b) => {
    const am = eventMetrics(a), bm = eventMetrics(b);
    return (bm.volume24hDollars || 0) - (am.volume24hDollars || 0)
        || (bm.volumeDollars || 0) - (am.volumeDollars || 0);
  });
}

/** Rank markets by 24h dollar volume, then lifetime dollar volume. */
export function rankMarkets(markets) {
  return [...markets].sort((a, b) => {
    const am = marketMetrics(a), bm = marketMetrics(b);
    return (bm.volume24hDollars || 0) - (am.volume24hDollars || 0)
        || (bm.volumeDollars || 0) - (am.volumeDollars || 0);
  });
}

/**
 * Map any ticker/event title to a topic, using Kalshi's official category and
 * tag strings only. Returns null when it cannot be decided — the caller then
 * shows "unverified" rather than guessing.
 */
export function topicOfSeries(series) {
  if (!series) return null;
  const cats = [series.category, ...(series.categories || [])].filter(Boolean).map((c) => String(c).toLowerCase());
  const tags = (series.tags || []).map((t) => String(t).toLowerCase());
  for (const key of TOPIC_ORDER) {
    const t = TOPICS[key];
    if (t.category && cats.includes(String(t.category).toLowerCase())) return key;
    if ((t.tags || []).some((tag) => tags.includes(String(tag).toLowerCase()))) return key;
  }
  return null;
}

/** Pick the best (lowest) price on the market's official price grid. */
export function gridHint(market) {
  const ranges = market?.price_ranges || [];
  if (!ranges.length) return null;
  const r = ranges[ranges.length - 1];
  return { start: num(r.start), end: num(r.end), step: num(r.step) };
}

/**
 * Check a requested price against the market's official price grid.
 * The API rejects prices that are not on the grid with `invalid_price`
 * (https://docs.kalshi.com/getting_started/quick_start_create_order).
 */
export function priceOnGrid(market, price) {
  const g = gridHint(market);
  const p = num(price);
  if (!g || p === null || g.step === null) return null;   // unknown grid -> cannot verify
  if (p < g.start || p > g.end) return false;
  const steps = (p - g.start) / g.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

export { TOPICS, TOPIC_ORDER };

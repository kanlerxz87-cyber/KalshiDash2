/* KalshiDash2 — market data layer.
 *
 * Everything here is a thin, auditable wrapper over documented endpoints.
 * No ticker, price, or category is hardcoded: discovery reads live `/events`
 * and `/series`, and every returned object keeps the API fields verbatim plus
 * a `_source` URL so the UI can link each row to the exact call that produced
 * it.
 */
import { KalshiClient } from "./kalshi.js";
import { TOPICS, CANDLE, DEMO } from "./config.js";

export const api = new KalshiClient();

/* ---------------- pagination ---------------- */

/* Collect every page of a cursor-paginated list.
 *
 * Returns an array (as before) with two diagnostic properties attached:
 *   rows.__pages   number of requests actually made
 *   rows.__capped  true when `maxPages` ran out while the API still had a
 *                  cursor — the list is incomplete and callers must say so
 *                  rather than present a partial scan as the whole exchange.
 * The documented page limit for GET /markets and GET /events is 200
 * (https://docs.kalshi.com/api-reference/market/get-markets,
 *  https://docs.kalshi.com/api-reference/events/get-events), so a single page
 * is never assumed to be the full set. */
export async function getAll(path, { key, maxPages = 20, limit = 200, onPage } = {}) {
  const out = [];
  let cursor = "";
  let pages = 0;
  let capped = false;
  for (let i = 0; i < maxPages; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const url = path + sep + "limit=" + limit + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    const page = await api.get(url);
    pages += 1;
    const rows = page[key] || [];
    out.push(...rows);
    if (onPage) onPage(out.length, rows.length);
    cursor = page.cursor || "";
    if (!cursor || rows.length === 0) break;
    if (i === maxPages - 1) capped = true;
  }
  Object.defineProperty(out, "__pages", { value: pages, enumerable: false });
  Object.defineProperty(out, "__capped", { value: capped, enumerable: false });
  return out;
}

/* ---------------- topic discovery ---------------- */

function testAny(patterns, values) {
  return patterns.some(re => values.some(v => v && re.test(String(v))));
}

/* True when any exclude pattern hits a field value. Topics may declare
 * `excludePatterns` (e.g. gas must not match crude / natural gas / Vegas rows). */
function excluded(topic, cats, titles, series) {
  return Array.isArray(topic.excludePatterns) &&
    testAny(topic.excludePatterns, [...cats, ...titles, ...series]);
}

/* Classify an event into one of the five topics using only documented fields. */
/* Multivariate ("combo") markets have generic titles such as "yes Republican
 * party,no Democratic party" and the category `Exotics`, so a title/category
 * test cannot place them in a topic. What does place them is the event record
 * itself: every combo market carries `mve_selected_legs` — the underlying
 * markets it is made of, each with an `event_ticker`
 * (https://docs.kalshi.com/api-reference/events/get-multivariate-events).
 * Resolving a leg's own event therefore gives a documented basis for the combo's
 * topic instead of a guess. `legEventLookup` is an async (eventTicker) =>
 * event|null function supplied by the caller; without it the combo stays
 * unclassified rather than being forced into a topic. */
export async function classifyMultivariate(ev, legEventLookup) {
  if (!ev || typeof legEventLookup !== "function") return null;
  const markets = Array.isArray(ev.markets) ? ev.markets : [];
  const legs = [];
  for (const m of markets) {
    for (const leg of (m.mve_selected_legs || [])) {
      if (leg && leg.event_ticker && !legs.includes(leg.event_ticker)) legs.push(leg.event_ticker);
    }
  }
  const bases = [];
  for (const t of legs.slice(0, 8)) {
    const legEvent = await legEventLookup(t);
    if (!legEvent) continue;
    const k = classifyEvent(legEvent);
    if (k) bases.push({ event_ticker: t, topic: k });
  }
  if (!bases.length) {
    /* A combo of nothing, or of out-of-scope legs: explicitly out of scope. */
    return null;
  }
  const topics = [...new Set(bases.map(b => b.topic))];
  const counts = topics.map(t => ({ topic: t, legs: bases.filter(b => b.topic === t).length }));
  counts.sort((a, b) => b.legs - a.legs);
  return { topic: counts[0].topic, mixed: counts.length > 1, bases, counts };
}

export function classifyEvent(ev) {
  if (!ev) return null;
  const cats = [ev.category].filter(Boolean);
  const titles = [ev.title, ev.sub_title].filter(Boolean);
  const series = [ev.series_ticker].filter(Boolean);

  for (const topic of TOPICS) {
    const byCat = testAny(topic.categoryPatterns, cats);
    if (byCat) {
      // A category match is authoritative, except for broad categories
      // (Sports) that are narrowed by series/title.
      if (topic.key !== "golf" && !excluded(topic, cats, titles, series)) return topic.key;
    }
  }
  const golf = TOPICS.find(t => t.key === "golf");
  if (!excluded(golf, cats, titles, series) &&
      (testAny(golf.seriesPatterns, series) || testAny(golf.titlePatterns, titles))) return "golf";

  const gas = TOPICS.find(t => t.key === "gas");
  if (!excluded(gas, cats, titles, series) &&
      (testAny(gas.seriesPatterns, series) || testAny(gas.titlePatterns, titles))) return "gas";

  return null;
}

/* Collect multivariate ("combo") events from GET /events/multivariate.
 *
 * GET /events EXCLUDES multivariate events — the reference says so in as many
 * words ("This endpoint excludes multivariate events. To retrieve multivariate
 * events, use the GET /events/multivariate endpoint"), and live demo combos
 * whose legs include election markets exist. A board built only from /events
 * is therefore an incomplete reading of "all events".
 *
 * The combo endpoint documents `series_ticker`, `collection_ticker`, `cursor`
 * and `limit` query parameters and returns { events, cursor }. This helper only
 * walks the cursor with the documented page size; it does not filter by status
 * (the endpoint's documented filters do not include `status`), so per-market
 * `status` is applied later by the caller.
 * (https://docs.kalshi.com/api-reference/events/get-multivariate-events) */
export async function fetchMultivariateEvents({ maxPages = 2, limit = 100 } = {}) {
  const rows = await getAll("/events/multivariate?with_nested_markets=true", {
    key: "events", maxPages, limit
  });
  return rows;
}

/* Classify multivariate events by their selected legs. Each distinct leg event
 * is fetched once; failures are non-fatal and leave that combo unclassified. */
export async function classifyMultivariateList(events) {
  const cache = new Map();
  const lookup = async (t) => {
    if (!cache.has(t)) {
      try {
        const j = await api.get(`/events/${encodeURIComponent(t)}`);
        cache.set(t, j.event || j);
      } catch { cache.set(t, null); }
    }
    return cache.get(t);
  };
  const out = [];
  for (const ev of events || []) {
    const c = await classifyMultivariate(ev, lookup);
    if (!c) continue;
    ev._mve = c;
    out.push(ev);
  }
  return out;
}

/* Live discovery for one topic.
 * Returns { events, markets, seriesSeen, source, scanned }. */
export async function discoverTopic(topicKey, { includeSettled = true, includeMultivariate = true, onProgress } = {}) {
  const topic = TOPICS.find(t => t.key === topicKey);
  if (!topic) throw new Error("Unknown topic: " + topicKey);

  // Open + closed events give us both the live board and the resolution feed.
  const statuses = includeSettled ? ["open", "closed", "settled"] : ["open"];
  const events = [];
  /* `perStatus` records exactly how many events the API returned for each
   * status, so the page can state the size of the scan it actually performed
   * instead of repeating a hard-coded count that can go stale. */
  const perStatus = {};
  const capped = {};
  for (const status of statuses) {
    const maxPages = status === "open" ? 12 : 6;
    let pages = 0;
    const rows = await getAll(`/events?status=${status}&with_nested_markets=true`, {
      key: "events",
      maxPages,
      onPage: () => { pages += 1; }
    });
    rows.forEach(e => { e._status = status; });
    perStatus[status] = rows.length;
    /* getAll stops early when the API returns an empty cursor; if it used every
     * allowed page the scan may have been cut short and must say so. */
    capped[status] = pages >= maxPages && rows.length > 0;
    if (onProgress) onProgress(rows.length, status);
    events.push(...rows);
  }

  /* Combos are classified from their legs, not from their generic titles. */
  let mveScanned = 0;
  let mveCapped = false;
  if (includeMultivariate && (topicKey === "elections" || topicKey === "culture")) {
    const mve = await fetchMultivariateEvents({ maxPages: 2, limit: 100 });
    mveScanned = mve.length;
    mveCapped = !!mve.__capped;
    const live = mve.filter(e => (e.markets || []).some(m => ["active", "open"].includes(m.status)));
    const classified = await classifyMultivariateList(live);
    for (const ev of classified) {
      if (ev._mve.topic !== topicKey) continue;
      /* Only the combo's live markets enter the market list. */
      ev.markets = (ev.markets || []).filter(m => ["active", "open"].includes(m.status));
      ev._status = "multivariate";
      ev._combo = true;
      events.push(ev);
    }
  }

  const matched = events.filter(e => (e._combo ? e._mve?.topic === topicKey : classifyEvent(e) === topicKey));
  const markets = [];
  for (const ev of matched) {
    for (const m of ev.markets || []) {
      markets.push({
        ...m,
        _event_ticker: ev.event_ticker,
        _event_title: ev.title,
        _category: ev.category,
        _series_ticker: ev.series_ticker,
        _source: `${DEMO.rest}/events?status=${ev._status}&with_nested_markets=true`
      });
    }
  }
  return {
    topic,
    events: matched,
    markets,
    scanned: events.length,
    perStatus: { ...perStatus, multivariate: mveScanned },
    capped: { ...capped, multivariate: mveCapped },
    source: `${DEMO.rest}/events?with_nested_markets=true`
  };
}

/* ---------------- ranking ---------------- */

export function moneyTraded(m) {
  const vol = num(m.volume_fp ?? m.volume ?? 0);
  const px = num(m.last_price_dollars ?? m.last_price ?? 0);
  // Both inputs are API values. When there is no trade price, the money figure
  // is not derivable, so the row is flagged rather than guessed.
  if (px === null || vol === null) return { value: null, derivable: false };
  return { value: vol * px, derivable: true };
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Rank events by a documented metric, keeping both the derived value and the
 * raw inputs so the UI can prove the arithmetic. */
export function rankEvents(events, mode = "money") {
  const rows = events.map(ev => {
    const ms = ev.markets || [];
    let volume = 0, oi = 0, money = 0, missingPrice = 0;
    for (const m of ms) {
      volume += num(m.volume_fp) || 0;
      oi += num(m.open_interest_fp) || 0;
      const mt = moneyTraded(m);
      if (mt.derivable) money += mt.value; else missingPrice++;
    }
    return {
      event_ticker: ev.event_ticker,
      title: ev.title,
      sub_title: ev.sub_title,
      category: ev.category,
      series_ticker: ev.series_ticker,
      status: ev.markets?.[0]?.status ?? ev._status,
      marketCount: ms.length,
      volume, oi, money, missingPrice,
      result: dominantResult(ms),
      closeTime: earliest(ms.map(m => m.close_time)),
      seriesUrl: ev.series_ticker ? `${DEMO.rest}/events/${ev.event_ticker}` : `${DEMO.rest}/events/${ev.event_ticker}`,
      source: `${DEMO.rest}/events/${ev.event_ticker}`,
      markets: ms
    };
  });
  rows.sort((a, b) => {
    if (mode === "oi") return b.oi - a.oi;
    if (mode === "volume") return b.volume - a.volume;
    return b.money - a.money;
  });
  return rows;
}

function dominantResult(markets) {
  const results = markets.map(m => (m.result || "").toLowerCase()).filter(Boolean);
  if (!results.length) return null;
  const yes = results.filter(r => r === "yes").length;
  const no = results.filter(r => r === "no").length;
  if (yes && no) return "mixed";
  return yes ? "yes" : "no";
}

function earliest(times) {
  const ts = times.filter(Boolean).map(t => Date.parse(t)).filter(Number.isFinite);
  return ts.length ? new Date(Math.min(...ts)).toISOString() : null;
}

/* ---------------- single market helpers ---------------- */

export async function getMarket(ticker) {
  const j = await api.get(`/markets/${encodeURIComponent(ticker)}`);
  return j.market || j;
}

export async function getOrderbook(ticker, depth) {
  const q = depth ? `?depth=${depth}` : "";
  return api.get(`/markets/${encodeURIComponent(ticker)}/orderbook${q}`);
}

/* Resolve the series ticker for a market without guessing.
 * GET /markets/{ticker} does not carry series_ticker (verified 2026-11-20);
 * GET /events/{event_ticker} does. */
export async function resolveSeries(market) {
  if (market.series_ticker) return market.series_ticker;
  const ev = await api.get(`/events/${encodeURIComponent(market.event_ticker)}`);
  const s = (ev.event || ev).series_ticker;
  if (!s) throw new Error("The API did not return a series_ticker for event " + market.event_ticker);
  return s;
}

/* ---------------- candlesticks ---------------- */

/* Fetch candles, splitting the range so a request never exceeds the documented
 * 5,000-period cap. Returns points in the chart's {t, y} shape, where y is the
 * trade close price for the period and is null when the period had no trades. */
/* `endTs` (Unix seconds, optional) anchors the window at a chosen moment
 * instead of "now". A settled market's candles stop before now, so the strategy
 * tester MUST anchor on that market's own end; measuring 24 h back from the
 * current clock would request a window that ends after settlement and miss the
 * trading history entirely. (GET /series/{series}/markets/{ticker}/candlesticks
 * takes required `start_ts` and `end_ts` — no "now" default is documented.)
 * https://docs.kalshi.com/api-reference/market/get-market-candlesticks */
export async function fetchCandles(market, { seconds, interval, endTs }) {
  const series = await resolveSeries(market);
  const periodSeconds = interval * 60;
  const maxSpan = CANDLE.maxPeriodsPerRequest * periodSeconds;
  const end = Number.isFinite(endTs) ? Math.floor(endTs) : Math.floor(Date.now() / 1000);
  const start = end - seconds;

  const chunks = [];
  for (let s = start; s < end; s += maxSpan) chunks.push([s, Math.min(s + maxSpan, end)]);

  const points = [];
  let rawCount = 0;
  for (const [s, e] of chunks) {
    const url = `/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(market.ticker)}` +
      `/candlesticks?start_ts=${s}&end_ts=${e}&period_interval=${interval}`;
    const j = await api.get(url);
    const candles = j.candlesticks || [];
    rawCount += candles.length;
    for (const c of candles) {
      points.push({
        t: c.end_period_ts * 1000,
        y: num(c.price?.close_dollars),
        open: num(c.price?.open_dollars),
        high: num(c.price?.high_dollars),
        low: num(c.price?.low_dollars),
        mean: num(c.price?.mean_dollars),
        prev: num(c.price?.previous_dollars),
        yesBid: num(c.yes_bid?.close_dollars),
        yesAsk: num(c.yes_ask?.close_dollars),
        volume: num(c.volume_fp),
        openInterest: num(c.open_interest_fp)
      });
    }
  }
  points.sort((a, b) => a.t - b.t);
  return {
    points,
    interval,
    seconds,
    series,
    rawCount,
    source: `${DEMO.rest}/series/${series}/markets/${market.ticker}/candlesticks`
  };
}

/* Aggregate 1-minute candles into a coarser bucket when a window would need too
 * many points to draw. The aggregation is stated in the UI. */
export function bucketCandles(points, bucketSeconds) {
  if (bucketSeconds <= 60) return points;
  const buckets = new Map();
  for (const p of points) {
    const key = Math.floor(p.t / (bucketSeconds * 1000)) * bucketSeconds * 1000;
    const b = buckets.get(key) || { t: key, y: null, open: null, high: null, low: null, volume: 0, n: 0 };
    if (p.y !== null) {
      b.y = p.y;                          // last trade close in the bucket
      if (b.open === null) b.open = p.open ?? p.y;
      b.high = b.high === null ? (p.high ?? p.y) : Math.max(b.high, p.high ?? p.y);
      b.low = b.low === null ? (p.low ?? p.y) : Math.min(b.low, p.low ?? p.y);
    }
    b.volume += p.volume || 0;
    b.n++;
    buckets.set(key, b);
  }
  return [...buckets.values()].sort((a, b) => a.t - b.t);
}

/* ---------------- live sampling (seconds-scale charts) ----------------
 *
 * Kalshi publishes no seconds-resolution history: the candle endpoint accepts
 * only 1, 60 and 1440 minute periods, and REST quotes are cached for a few
 * seconds. A seconds-scale chart therefore has to be accumulated from live
 * samples while the page is open. `LiveSampler` makes that explicit: it stamps
 * each point with the time it was actually read and records the data source.
 * ------------------------------------------------------------------- */
export class LiveSampler {
  constructor({ ticker, intervalMs = 2000, onPoint, onState, maxAgeSeconds = 900 }) {
    this.ticker = ticker;
    this.intervalMs = intervalMs;
    this.onPoint = onPoint || (() => {});
    this.onState = onState || (() => {});
    this.maxAgeMs = maxAgeSeconds * 1000;
    this.points = [];
    this.timer = null;
    this.ws = null;
    this.mode = "poll";
  }

  start() {
    this.stop();
    this._pollOnce();
    this.timer = setInterval(() => this._pollOnce(), this.intervalMs);
    this.onState({ mode: "poll", intervalMs: this.intervalMs });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }

  async _pollOnce() {
    try {
      const m = await getMarket(this.ticker);
      const now = Date.now();
      const bid = num(m.yes_bid_dollars);
      const ask = num(m.yes_ask_dollars);
      const last = num(m.last_price_dollars);
      this.points.push({
        t: now, y: last, bid, ask, volume: num(m.volume_fp),
        openInterest: num(m.open_interest_fp),
        source: "GET /markets/{ticker}"
      });
      const cutoff = now - this.maxAgeMs;
      this.points = this.points.filter(p => p.t >= cutoff);
      this.onPoint(this.points);
      this.onState({ mode: "poll", ok: true, at: now });
    } catch (e) {
      this.onState({ mode: "poll", ok: false, error: e.message });
    }
  }

  /* Window of sampled points for a requested duration. */
  window(seconds) {
    const cutoff = Date.now() - seconds * 1000;
    return this.points.filter(p => p.t >= cutoff);
  }
}

/* ---------------- watched markets / resolution tracking ---------------- */

const WATCH_KEY = "kalshiDash.watch.v1";

export const Watchlist = {
  all() {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"); }
    catch { return []; }
  },
  has(ticker) { return this.all().some(w => w.ticker === ticker); },
  add(market, topicKey, eventTitle) {
    const list = this.all();
    if (list.some(w => w.ticker === market.ticker)) return list;
    list.push({
      ticker: market.ticker,
      title: market.title || eventTitle || "",
      event_ticker: market._event_ticker || market.event_ticker || "",
      topic: topicKey || null,
      added_at: new Date().toISOString(),
      open_price: num(market.last_price_dollars),
      last_seen: {
        status: market.status, result: market.result || "",
        yes_bid: num(market.yes_bid_dollars), yes_ask: num(market.yes_ask_dollars),
        last: num(market.last_price_dollars), close_time: market.close_time
      },
      resolved_at: null, final_result: null
    });
    localStorage.setItem(WATCH_KEY, JSON.stringify(list));
    return list;
  },
  remove(ticker) {
    const list = this.all().filter(w => w.ticker !== ticker);
    localStorage.setItem(WATCH_KEY, JSON.stringify(list));
    return list;
  },
  /* Poll every watched market and record the resolution the API reports. */
  async refresh() {
    const list = this.all();
    const out = [];
    for (const w of list) {
      try {
        const m = await getMarket(w.ticker);
        const result = (m.result || "").toLowerCase();
        w.last_seen = {
          status: m.status, result,
          yes_bid: num(m.yes_bid_dollars), yes_ask: num(m.yes_ask_dollars),
          last: num(m.last_price_dollars), close_time: m.close_time,
          settlement_value: num(m.settlement_value_dollars ?? m.settlement_value)
        };
        w.title = m.title || w.title;
        if (result === "yes" || result === "no") {
          w.final_result = result;
          w.resolved_at = w.resolved_at || new Date().toISOString();
        }
        w._error = null;
      } catch (e) {
        w._error = e.message;
      }
      out.push(w);
    }
    localStorage.setItem(WATCH_KEY, JSON.stringify(list));
    return out;
  }
};

/* ---------------- portfolio analytics ----------------
 *
 * Inputs are the documented Fill fields. Nothing is estimated: if a field the
 * analysis needs is missing, that trade is counted as "unclassified" and the
 * gap is reported instead of being filled in.
 * ------------------------------------------------------------------- */
export function analyseFills(fills, { topicResolver } = {}) {
  const rows = (fills || []).map(f => {
    const count = num(f.count_fp ?? f.count);
    const yesPrice = num(f.yes_price_dollars);
    const noPrice = num(f.no_price_dollars);
    const fee = num(f.fee_cost_dollars ?? f.fee_cost);
    const side = f.outcome_side || f.side || null;
    const price = side === "no" ? noPrice : yesPrice;
    const cost = count !== null && price !== null ? count * price : null;
    const notional = count !== null ? count * 1 : null;   // $1 per contract at settlement
    return {
      fill_id: f.fill_id || f.trade_id || "",
      order_id: f.order_id || "",
      ticker: f.ticker || f.market_ticker || "",
      side,
      book_side: f.book_side || null,
      count, price, cost, fee,
      notional,
      is_taker: f.is_taker ?? null,
      ts: f.created_time ? Date.parse(f.created_time) : (f.ts ? f.ts * 1000 : null),
      topic: topicResolver ? topicResolver(f.ticker || f.market_ticker) : null,
      raw: f
    };
  });

  const totals = {
    count: rows.length,
    contracts: sum(rows.map(r => r.count)),
    premium: sum(rows.filter(r => r.cost !== null).map(r => r.cost)),
    fees: sum(rows.filter(r => r.fee !== null).map(r => r.fee)),
    missingPrice: rows.filter(r => r.price === null).length,
    missingTopic: rows.filter(r => !r.topic).length
  };
  totals.netPremium = totals.premium + totals.fees;

  const by = key => groupBy(rows, key);
  return { rows, totals, byTopic: by("topic"), bySide: by("side"), byTaker: by("is_taker") };
}

function sum(xs) { return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = r[key] === null || r[key] === undefined || r[key] === "" ? "unclassified" : String(r[key]);
    out[k] = out[k] || { key: k, n: 0, contracts: 0, premium: 0, fees: 0 };
    out[k].n++;
    out[k].contracts += r.count || 0;
    if (r.cost !== null) out[k].premium += r.cost;
    if (r.fee !== null) out[k].fees += r.fee;
  }
  return Object.values(out).sort((a, b) => b.premium - a.premium);
}

/* ---------------- swing detection ----------------
 *
 * Kalshi publishes no "swing" field. Two documented fields let one be
 * derived honestly:
 *   previous_price_dollars — the exchange's own reference price (the schema
 *                            describes it as the last traded YES price a day
 *                            ago; see Flagged Z1)
 *   last_price_dollars     — the most recent trade price
 * (https://docs.kalshi.com/api-reference/market/get-market)
 *
 * `swingOf` returns the exchange-reported comparison. `detectJumps` does the
 * same over a candle series, where each candle also carries `previous_dollars`.
 */
export function swingOf(market) {
  const to = num(market.last_price_dollars);
  const from = num(market.previous_price_dollars);
  if (to === null || from === null) return null;
  const delta = Number((to - from).toFixed(4));
  if (delta === 0) return null;
  return { from, to, delta, dir: delta > 0 ? "up" : "down", basis: "exchange previous_price_dollars" };
}

/* Detect >= threshold moves inside a candle series.
 * `points` are the objects produced by fetchCandles(); each needs `t`, `y`
 * (close) and optionally `prev` (the candle's own previous_dollars). */
export function detectJumps(points, threshold = 0.10) {
  const jumps = [];
  let last = null;
  for (const p of points || []) {
    if (p.y === null || p.y === undefined) continue;
    const prev = p.prev !== undefined && p.prev !== null ? p.prev : last;
    if (prev !== null && prev !== undefined) {
      const delta = Number((p.y - prev).toFixed(4));
      if (Math.abs(delta) >= threshold) {
        jumps.push({ t: p.t, from: prev, to: p.y, delta, dir: delta > 0 ? "up" : "down" });
      }
    }
    last = p.y;
  }
  return jumps;
}

/* ---------------- the tradeability screen ----------------
 *
 * See TRADE_SCREEN in config.js. Returns the total score plus the per-
 * component breakdown so the UI can show exactly why a market was surfaced.
 * Every input is a documented market field; nothing is inferred.
 */
/* The tradeability screen lives in alerts-core.js so the browser and the Node
 * tests read one implementation. Re-exported here because the data layer is
 * where the market object it scores comes from. */
export { screenMarket } from "./alerts-core.js";

/* ---------------- event context ----------------
 *
 * GET /events/{event_ticker} carries `settlement_sources` — the official
 * sources Kalshi lists for determining the outcome — plus the market rules.
 * These are the source websites worth reading when a contract price jumps.
 * (https://docs.kalshi.com/api-reference/events/get-events)
 */
export async function getEvent(eventTicker) {
  const j = await api.get(`/events/${encodeURIComponent(eventTicker)}`);
  return j.event || j;
}

export function eventContext(event) {
  if (!event) return { sources: [], rules: null, series: null };
  const sources = (event.settlement_sources || [])
    .filter(s => s && (s.name || s.url))
    .map(s => ({ name: String(s.name || "").trim(), url: String(s.url || "").trim() }));
  const market = (event.markets || [])[0] || null;
  return {
    sources,
    rules: market ? (market.rules_primary || market.rules_secondary || "") : (event.rules_primary || ""),
    series: event.series_ticker || null
  };
}

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
 * Page-size limits differ by endpoint, so `limit` is never assumed to be the
 * whole set and every caller here follows the cursor instead:
 *   GET /markets  limit defaults to 100, maximum 1000
 *     (https://docs.kalshi.com/api-reference/market/get-markets)
 *   GET /events   limit defaults to 200, maximum 200
 *     (https://docs.kalshi.com/api-reference/events/get-events)
 * The default below (200) is valid for both endpoints. */
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

/* ---------------- series-level categories ----------------
 *
 * The official Get Events schema marks the *event* object's `category` field
 * `deprecated: true` — "Event category (deprecated, use series-level category
 * instead)" (https://docs.kalshi.com/api-reference/events/get-events). The
 * series-level equivalents are documented on Get Series / Get Series List:
 * `category` (primary) and `categories` (the discovery list, which is what the
 * `category` query filter matches).
 *   https://docs.kalshi.com/api-reference/market/get-series
 *   https://docs.kalshi.com/api-reference/market/get-series-list
 *
 * So the taxonomy prefers the series record and keeps the deprecated event
 * field only as a labelled fallback. Series are fetched at most once each per
 * page life and capped per scan, because public reads are rate-limited and a
 * series lookup is one extra request per distinct series.
 */
const SERIES_CATEGORIES = new Map(); // series_ticker -> { cats, primary, failed }

/* Seed the cache (also used by tests and by callers that already hold a series
 * record, so a page never re-requests what it has). */
export function primeSeriesCategories(entries) {
  for (const [ticker, value] of Object.entries(entries || {})) {
    if (!ticker) continue;
    const cats = Array.isArray(value) ? value : (value && value.cats) || [];
    const primary = Array.isArray(value) ? null : (value && value.primary) || null;
    SERIES_CATEGORIES.set(String(ticker), {
      cats: [...new Set([...cats, primary].filter(Boolean))],
      primary,
      failed: false
    });
  }
}

export function clearSeriesCategoryCache() { SERIES_CATEGORIES.clear(); }

/* Resolve the series-level categories for a set of series tickers.
 * Returns { requested, fetched, cached, failed, capped } so the caller can
 * disclose how many events were classified from the series record versus the
 * deprecated event field, instead of implying full coverage. */
export async function fetchSeriesCategories(tickers, { cap = 30, fetcher } = {}) {
  /* Order by how often each series appears in the scan, so the lookups that are
   * actually spent cover the most events. A scan of the open events on the demo
   * exchange touches far more distinct series than the cap allows; spending the
   * budget on one-off series while a series with fifty live events waits would
   * waste it. */
  const counts = new Map();
  for (const t of (tickers || [])) {
    if (!t) continue;
    const k = String(t);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const unique = [...counts.keys()].sort((a, b) => (counts.get(b) - counts.get(a)) || a.localeCompare(b));
  const get = fetcher || ((path) => api.get(path));
  let cached = 0, fetched = 0, failed = 0, capped = 0;
  for (const ticker of unique) {
    if (SERIES_CATEGORIES.has(ticker)) { cached += 1; continue; }
    if (fetched + failed >= cap) { capped += 1; continue; }
    try {
      const json = await get(`/series/${encodeURIComponent(ticker)}`);
      const series = (json && json.series) || json || {};
      const cats = Array.isArray(series.categories) ? series.categories : [];
      const primary = series.category || null;
      SERIES_CATEGORIES.set(ticker, {
        cats: [...new Set([...cats, primary].filter(Boolean))],
        primary,
        failed: false
      });
      fetched += 1;
    } catch {
      /* A failed lookup is not a category. Leave the event to the documented
       * fallback rather than guessing. */
      SERIES_CATEGORIES.set(ticker, { cats: [], primary: null, failed: true });
      failed += 1;
    }
  }
  return { requested: unique.length, fetched, cached, failed, capped };
}

export function seriesCategoriesFor(ticker) {
  return ticker ? SERIES_CATEGORIES.get(String(ticker)) || null : null;
}

/* Classify an event and report WHICH field decided it, so the UI can say
 * "series category" or "event category (deprecated field)". */
export function classifyEventWithBasis(ev) {
  if (!ev) return { topic: null, basis: "none", categories: [] };
  const series = seriesCategoriesFor(ev.series_ticker);
  const useSeries = !!(series && series.cats && series.cats.length);
  const cats = useSeries ? series.cats : [ev.category].filter(Boolean);
  return {
    topic: classifyEvent(ev, useSeries ? cats : null),
    basis: useSeries ? "series" : (cats.length ? "event" : "none"),
    categories: cats
  };
}

export function classifyEvent(ev, seriesCats) {
  if (!ev) return null;
  const resolved = seriesCats || seriesCategoriesFor(ev.series_ticker)?.cats;
  const cats = (resolved && resolved.length ? resolved : [ev.category]).filter(Boolean);
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
    const rows = await getAll(`/events?status=${status}&with_nested_markets=true`, {
      key: "events",
      maxPages
    });
    rows.forEach(e => { e._status = status; });
    perStatus[status] = rows.length;
    /* getAll() sets __capped when it stopped at its page budget with a
     * cursor still outstanding. Counting pages here (pages >= maxPages)
     * also fires when the final page exactly filled the budget but the
     * cursor was already empty, so the flag would over-report truncation. */
    capped[status] = !!rows.__capped;
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

  /* Prefer the series-level category (the field Get Events tells clients to
   * use) over the deprecated event `category`. One lookup per distinct series,
   * cached for the life of the page and capped per scan; anything not resolved
   * keeps the documented fallback and is counted, never assumed. */
  const seriesTickers = events.filter(e => !e._combo).map(e => e.series_ticker);
  const seriesCoverage = await fetchSeriesCategories(seriesTickers, { cap: 30 });

  const matched = events.filter(e => {
    if (e._combo) return e._mve?.topic === topicKey;
    const verdict = classifyEventWithBasis(e);
    e._topic = verdict.topic;
    e._categoryBasis = verdict.basis;
    e._categories = verdict.categories;
    return verdict.topic === topicKey;
  });
  const basisTally = { series: 0, event: 0, none: 0 };
  for (const e of events) {
    if (e._combo) continue;
    const b = e._categoryBasis || classifyEventWithBasis(e).basis;
    basisTally[b] = (basisTally[b] || 0) + 1;
  }
  const markets = [];
  for (const ev of matched) {
    for (const m of ev.markets || []) {
      markets.push({
        ...m,
        _event_ticker: ev.event_ticker,
        _event_title: ev.title,
        _category: ev.category,
        _categories: ev._categories || null,
        _categoryBasis: ev._categoryBasis || null,
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
    categoryBasis: basisTally,
    seriesCoverage,
    perStatus: { ...perStatus, multivariate: mveScanned },
    capped: { ...capped, multivariate: mveCapped },
    source: `${DEMO.rest}/events?with_nested_markets=true`
  };
}

/* ---------------- ranking ---------------- */

/* Project-defined volume-price proxy, not actual dollars traded. Kalshi documents
 * volume_fp as contracts and last_price_dollars as the last traded YES price.
 * The product is a ranking convention, not an exchange-reported dollar-volume field. */
export function volumePriceProxy(m) {
  // Both inputs are API values. When either is missing, the money figure is
  // not derivable, so the row is flagged rather than guessed. (Defaulting a
  // missing volume to 0 would report $0.00 for a market that simply never
  // returned a volume field.)
  const vol = num(m.volume_fp ?? m.volume);
  const px = num(m.last_price_dollars ?? m.last_price);
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
      const mt = volumePriceProxy(m);
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

/* Collapse a market list's settlement results without inventing one.
 *
 * `result` is a documented enum — yes | no | scalar | "" (empty = not settled):
 *   https://docs.kalshi.com/api-reference/market/get-market  (market.result)
 * `market_type` is likewise binary | scalar.
 *
 * Only literal values are reported:
 *   - no result at all            -> null (unresolved)
 *   - exactly one distinct value  -> that value ("yes" / "no" / "scalar")
 *   - more than one distinct value -> "mixed"
 *
 * An earlier version returned "no" whenever no market carried a literal "yes",
 * which silently turned a documented `scalar` settlement into a NO on the
 * overview and category boards. That was an inferred value on a site whose
 * rule is that values are never inferred, so it is fixed here.
 */
function dominantResult(markets) {
  const results = markets
    .map(m => String(m.result || "").toLowerCase())
    .filter(Boolean);
  if (!results.length) return null;
  const kinds = [...new Set(results)];
  return kinds.length === 1 ? kinds[0] : "mixed";
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

/* ---- one parser for both candy tiers -------------------------------------
 *
 * Kalshi partitions exchange data into a live tier and a historical tier
 * (https://docs.kalshi.com/getting_started/historical_data, fetched 2026-11-21):
 *
 *   "Markets and their candlesticks that settled before [market_settled_ts]
 *    are only available via `GET /historical/markets`" — and the candlesticks
 *    for those markets only via `GET /historical/markets/{ticker}/candlesticks`.
 *
 * The two endpoints return the SAME numbers under DIFFERENT field names:
 *
 *   live       GET /series/{series}/markets/{ticker}/candlesticks
 *              price.close_dollars, price.previous_dollars, volume_fp, ...
 *   historical GET /historical/markets/{ticker}/candlesticks
 *              price.close,         price.previous,         volume, ...
 *
 * (Both schemas fetched 2026-11-21 from
 *  https://docs.kalshi.com/api-reference/market/get-market-candlesticks and
 *  https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks.)
 *
 * `parseCandle` accepts either shape and never substitutes a value that the
 * response did not carry: a missing field stays null, which the UI renders as
 * a gap rather than a price.
 * ------------------------------------------------------------------------- */
export function parseCandle(c) {
  const dollars = o => num(o?.close_dollars ?? o?.close);
  return {
    t: Number(c?.end_period_ts) * 1000,
    y: dollars(c?.price),
    open: num(c?.price?.open_dollars ?? c?.price?.open),
    high: num(c?.price?.high_dollars ?? c?.price?.high),
    low: num(c?.price?.low_dollars ?? c?.price?.low),
    mean: num(c?.price?.mean_dollars ?? c?.price?.mean),
    prev: num(c?.price?.previous_dollars ?? c?.price?.previous),
    yesBid: num(c?.yes_bid?.close_dollars ?? c?.yes_bid?.close),
    yesAsk: num(c?.yes_ask?.close_dollars ?? c?.yes_ask?.close),
    volume: num(c?.volume_fp ?? c?.volume),
    openInterest: num(c?.open_interest_fp ?? c?.open_interest)
  };
}

/* A market is treated as settled-tier eligible only when the exchange's own
 * fields say so: it carries a `result`, or its status is one of the terminal
 * lifecycle states, or its published close time has already passed.
 * (https://docs.kalshi.com/getting_started/market_lifecycle,
 *  https://docs.kalshi.com/api-reference/market/get-market) */
const SETTLED_STATUSES = ["settled", "closed", "finalized", "determined"];

export function isSettledMarket(market, nowMs = Date.now()) {
  if (!market) return false;
  const result = String(market.result || "").toLowerCase();
  if (result === "yes" || result === "no") return true;
  const status = String(market.status || "").toLowerCase();
  if (SETTLED_STATUSES.includes(status)) return true;
  const close = Date.parse(market.close_time || "");
  return Number.isFinite(close) && close < nowMs;
}

/* Fetch candles, splitting the range so a request never exceeds the documented
 * 5,000-period cap. Returns points in the chart's {t, y} shape, where y is the
 * trade close price for the period and is null when the period had no trades. */
/* `endTs` (Unix seconds, optional) anchors the window at a chosen moment
 * instead of "now". A settled market's candles stop before now, so the strategy
 * tester MUST anchor on that market's own end; measuring 24 h back from the
 * current clock would request a window that ends after settlement and miss the
 * trading history entirely. (GET /series/{series}/markets/{ticker}/candlesticks
 * takes required `start_ts` and `end_ts` — no "now" default is documented.)
 * https://docs.kalshi.com/api-reference/market/get-market-candlesticks
 *
 * Historical tier: when the live tier returns no candles at all AND the market
 * is settled, the same window is requested from
 * GET /historical/markets/{ticker}/candlesticks, which the docs say is the only
 * place archived settled markets live. The result records which tier answered
 * (`via`) and links that exact request (`source`), so a chart or a backtest can
 * never imply it read the live tier when it did not.
 * https://docs.kalshi.com/api-reference/historical/get-historical-market-candlesticks */
export async function fetchCandles(market, { seconds, interval, endTs, allowHistorical = true } = {}) {
  const periodSeconds = interval * 60;
  const maxSpan = CANDLE.maxPeriodsPerRequest * periodSeconds;
  const end = Number.isFinite(endTs) ? Math.floor(endTs) : Math.floor(Date.now() / 1000);
  const start = end - seconds;

  const chunks = [];
  for (let s = start; s < end; s += maxSpan) chunks.push([s, Math.min(s + maxSpan, end)]);

  const readChunks = async (pathFor) => {
    const points = [];
    let rawCount = 0;
    for (const [s, e] of chunks) {
      const j = await api.get(pathFor(s, e));
      const candles = j.candlesticks || [];
      rawCount += candles.length;
      for (const c of candles) points.push(parseCandle(c));
    }
    points.sort((a, b) => a.t - b.t);
    return { points, rawCount };
  };

  const liveUrl = (series, s, e) =>
    `/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(market.ticker)}` +
    `/candlesticks?start_ts=${s}&end_ts=${e}&period_interval=${interval}`;
  const histUrl = (s, e) =>
    `/historical/markets/${encodeURIComponent(market.ticker)}` +
    `/candlesticks?start_ts=${s}&end_ts=${e}&period_interval=${interval}`;

  /* A market whose series cannot be resolved can still have archived candles:
   * the historical route needs only the ticker. So the resolve failure is kept
   * instead of thrown, and the fallback decides whether it matters. */
  let series = market.series_ticker || null;
  let liveError = null;
  let live = { points: [], rawCount: 0 };
  try {
    series = await resolveSeries(market);
    live = await readChunks((s, e) => liveUrl(series, s, e));
  } catch (e) {
    liveError = e;
  }

  if ((live.points.length > 0 || !allowHistorical || !isSettledMarket(market))) {
    if (!live.points.length && liveError) throw liveError;
    return {
      points: live.points,
      interval,
      seconds,
      series,
      rawCount: live.rawCount,
      via: "live",
      historicalError: null,
      source: `${DEMO.rest}/series/${series}/markets/${market.ticker}/candlesticks`
    };
  }

  /* Live tier returned nothing for a settled market: ask the historical tier. */
  try {
    const hist = await readChunks(histUrl);
    if (!hist.points.length && liveError) throw liveError;
    return {
      points: hist.points,
      interval,
      seconds,
      series,
      rawCount: hist.rawCount,
      via: "historical",
      historicalError: null,
      source: `${DEMO.rest}/historical/markets/${market.ticker}/candlesticks`
    };
  } catch (e) {
    if (liveError) throw liveError;
    return {
      points: live.points,
      interval,
      seconds,
      series,
      rawCount: live.rawCount,
      via: "live",
      historicalError: e.message,
      source: `${DEMO.rest}/series/${series}/markets/${market.ticker}/candlesticks`
    };
  }
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

/* Pure helper for a single market's result cell when `result` may be empty.
 * Kalshi's `Market.result` enum is "yes" | "no" | "scalar" | "" while
 * `Market.status` tracks lifecycle ("initialized", "inactive", "active",
 * "closed", "determined", "disputed", "amended", "finalized"):
 *   https://docs.kalshi.com/api-reference/market/get-market
 * Rendering "open" whenever `result` is "" contradicts `status: "closed"` on
 * markets awaiting determination (observed live on KXXRPD-26NOV2203-T1.5399). */
export function marketResultState(market) {
  const r = String(market?.result || "").toLowerCase();
  if (r === "yes" || r === "no" || r === "scalar") return { kind: "settled", label: r };
  if (r) return { kind: "settled", label: r };
  const status = String(market?.status || "").toLowerCase();
  if (["closed", "determined", "disputed", "amended", "finalized", "settled"].includes(status)) {
    return { kind: "pending", label: "awaiting result" };
  }
  return { kind: "unresolved", label: "unresolved" };
}

/* Update one watch-list entry from a documented Get Market response.
 * Any non-empty documented settlement outcome ("yes", "no", "scalar") is
 * recorded literally as `final_result` rather than leaving a scalar market
 * perpetually in "awaiting resolution". */
export function applyMarketToWatchEntry(w, m, nowIso = new Date().toISOString()) {
  const result = String(m?.result || "").toLowerCase();
  w.last_seen = {
    status: m.status, result,
    yes_bid: num(m.yes_bid_dollars), yes_ask: num(m.yes_ask_dollars),
    last: num(m.last_price_dollars), close_time: m.close_time,
    settlement_value: num(m.settlement_value_dollars ?? m.settlement_value)
  };
  w.title = m.title || m.yes_sub_title || w.title;
  if (result === "yes" || result === "no" || result === "scalar") {
    w.final_result = result;
    w.resolved_at = w.resolved_at || m.settlement_ts || nowIso;
  }
  w._error = null;
  return w;
}

export const Watchlist = {
  all() {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"); }
    catch { return []; }
  },
  has(ticker) { return this.all().some(w => w.ticker === ticker); },
  add(market, topicKey, eventTitle) {
    const list = this.all();
    if (list.some(w => w.ticker === market.ticker)) return list;
    const initResult = String(market.result || "").toLowerCase();
    const isResolved = initResult === "yes" || initResult === "no" || initResult === "scalar";
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
      resolved_at: isResolved ? (market.settlement_ts || new Date().toISOString()) : null,
      final_result: isResolved ? initResult : null
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
        applyMarketToWatchEntry(w, m);
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
    /* No `notional` field is derived here. Kalshi defines notional_value_dollars
     * as the settlement value of ONE contract, and it is not always $1 (scalar
     * markets settle on a value range), nor is it returned on a fill. The
     * previous `count × 1` guess was unused by every page and has been removed
     * rather than left as a plausible-looking wrong number.
     * (https://docs.kalshi.com/api-reference/market/get-market) */
    return {
      fill_id: f.fill_id || f.trade_id || "",
      order_id: f.order_id || "",
      ticker: f.ticker || f.market_ticker || "",
      side,
      book_side: f.book_side || null,
      count, price, cost, fee,
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
  /* `is_taker` is a boolean; String(true) would render as the bucket "true".
   * The documented meaning is taker = crossed the spread, maker = rested, so
   * label it with those words (null stays "unclassified").
   * (https://docs.kalshi.com/api-reference/portfolio/get-fills) */
  const byRole = groupBy(rows.map(r => ({ ...r, role: r.is_taker === true ? "taker" : r.is_taker === false ? "maker" : "unclassified" })), "role");
  return { rows, totals, byTopic: by("topic"), bySide: by("side"), byRole };
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

/* The brief's threshold: a move of at least $0.10 per contract, either way.
 * Same constant the alert feeds use (ALERT.defaultThreshold in config.js). */
export const JUMP_THRESHOLD = 0.10;

const JUMP_EPS = 1e-9;
const round4 = x => Math.round(x * 1e4) / 1e4;
const finite = v => v !== null && v !== undefined && Number.isFinite(Number(v));

/* Detect >= threshold moves inside a plotted series.
 *
 * `points` are the objects produced by fetchCandles() or LiveSampler(); each
 * needs `t` and `y` (the plotted price) and optionally `prev` (the candle's own
 * price.previous_dollars). Points with a null `y` are gaps: they are skipped
 * and the comparison crosses the gap, exactly like the plotted line does. The
 * comparison price is the candle's own `prev` when present and otherwise the
 * previous priced point — both documented fields
 * (https://docs.kalshi.com/api-reference/market/get-market-candlesticks).
 *
 * The threshold is inclusive and float-safe: exactly $0.10 fires. Every jump
 * carries both endpoints so the UI can show from → to and link the row.
 * Call shape: detectJumps(points, 0.10) or detectJumps(points, { threshold }). */
export function detectJumps(points, threshold = JUMP_THRESHOLD) {
  const limit = typeof threshold === "object" && threshold !== null
    ? (threshold.threshold ?? JUMP_THRESHOLD)
    : threshold;
  const jumps = [];
  let last = null;
  let lastT = null;
  for (const p of points || []) {
    if (!p || !finite(p.y)) continue;
    const y = Number(p.y);
    const ref = finite(p.prev) ? Number(p.prev) : last;
    if (ref !== null && ref !== undefined) {
      const delta = round4(y - ref);
      if (Math.abs(delta) >= limit - JUMP_EPS && delta !== 0) {
        const dir = delta > 0 ? "up" : "down";
        jumps.push({
          t: p.t,
          fromT: lastT,
          from: ref,
          to: y,
          delta,
          direction: dir,
          /* Alias for callers that read `dir` (the chart table). */
          dir,
          volume: finite(p.volume) ? Number(p.volume) : null,
          /* Intra-period range (candles only): high − low within one period. */
          intraRange: finite(p.high) && finite(p.low) ? round4(Number(p.high) - Number(p.low)) : null
        });
      }
    }
    last = y;
    lastT = p.t;
  }
  return jumps;
}

/* Chart markers in the shape assets/js/ui.js `lineChart` expects:
 * [{ t, y, dir, delta }]. `y` is the post-jump price (the dot position) and
 * `dir` is "up" | "down" (the line colour). Passing raw jumps (which carry
 * `to`, not `y`) drew the vertical line but never the dot. */
export function jumpMarkers(jumps) {
  return (jumps || []).map(j => ({
    t: j.t,
    y: j.to,
    dir: j.dir || j.direction || (j.delta > 0 ? "up" : "down"),
    delta: j.delta
  }));
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

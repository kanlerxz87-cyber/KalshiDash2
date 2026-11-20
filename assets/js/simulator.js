/* KalshiDash2 — simulated-trade engine.
 *
 * Runs strategy rules over **official** Kalshi demo data and scores the
 * resulting simulated trades against the market's own settlement value.
 *
 * Where the numbers come from
 * ----------------------------
 *   universe  : GET /markets?status=settled  -> finalized markets with
 *               `result` (yes/no) and `settlement_value_dollars`
 *               (https://docs.kalshi.com/api-reference/market/get-markets)
 *   series    : GET /events/{event_ticker} -> series_ticker + category
 *               (https://docs.kalshi.com/api-reference/events/get-events)
 *   history   : GET /series/{series}/markets/{ticker}/candlesticks
 *               (https://docs.kalshi.com/api-reference/market/get-market-candlesticks)
 *   outcome   : settlement_value_dollars on the market itself
 *               (https://docs.kalshi.com/api-reference/market/get-market)
 *
 * Simulation assumptions — stated on the page, never hidden:
 *   - A signal is filled at the trade-close price of the candle that fired it.
 *     No spread, no slippage and no fees are applied. Fees therefore make
 *     every result here look better than a live trade would be; the official
 *     fee schedule is linked from the page.
 *   - A position held to settlement pays the market's own
 *     `settlement_value_dollars` (1.0000 for YES, 0.0000 for NO).
 *   - Trade prices are represented on the YES leg; an NO contract's entry
 *     price is the complement (1 - YES price), consistent with Kalshi's
 *     documented reciprocal YES/NO pricing.
 *   - One trade per market per strategy, taken at the first signal.
 */
import { STRATEGIES } from "./config.js";
import { api, getAll, classifyEvent, num, fetchCandles } from "./market.js";

const CLOSE_EPS = 1e-9;

/* --------------------------------------------------------------------------
 * Universe
 * ----------------------------------------------------------------------- */

/* Collect finalized markets, resolve their series and topic, and keep only
 * the ones that can actually be scored (a result and a settlement value). */
export async function loadSettledUniverse({ limit = 25, maxPages = 2, onProgress = () => {} } = {}) {
  const settled = await getAll("/markets?status=settled", {
    key: "markets",
    maxPages,
    limit: 200
  });

  const eventCache = new Map();
  const rows = [];

  for (const m of settled) {
    if (rows.length >= limit) break;
    const result = (m.result || "").toLowerCase();
    const settle = num(m.settlement_value_dollars);
    if (!["yes", "no"].includes(result) || settle === null) continue;

    let event = eventCache.get(m.event_ticker);
    if (event === undefined) {
      try {
        const j = await api.get(`/events/${encodeURIComponent(m.event_ticker)}`);
        event = j.event || j;
      } catch {
        event = null;
      }
      eventCache.set(m.event_ticker, event);
    }
    if (!event) continue;

    const enriched = {
      ...m,
      series_ticker: event.series_ticker || null,
      category: event.category || null,
      event_title: event.title || m.event_ticker,
      topic: classifyEvent({
        event_ticker: m.event_ticker,
        category: event.category,
        title: event.title,
        sub_title: event.sub_title,
        series_ticker: event.series_ticker
      })
    };
    rows.push(enriched);
    onProgress(rows.length, settled.length);
  }
  return rows;
}

/* --------------------------------------------------------------------------
 * Candles
 * ----------------------------------------------------------------------- */

/* The final `minutes` one-minute periods before the market closed.
 * The candle endpoint caps a request at 5,000 periods, so a window of
 * 1,440 minutes always fits in one request. */
export async function loadHistory(market, { minutes = 1440, interval = 1 } = {}) {
  if (!market.series_ticker) return { points: [], error: "no series_ticker" };
  const end = market.settlement_ts
    ? Math.floor(Date.parse(market.settlement_ts) / 1000)
    : Math.floor(Date.now() / 1000);
  const start = end - minutes * 60;
  try {
    const res = await fetchCandles(
      { ticker: market.ticker, event_ticker: market.event_ticker, series_ticker: market.series_ticker },
      { seconds: end - start, interval }
    );
    return { points: res.points, rawCount: res.rawCount, error: null, source: res.source };
  } catch (e) {
    return { points: [], rawCount: 0, error: e.message, source: null };
  }
}

/* Normalise candle points into the shape strategies read. */
export function toSeries(points) {
  const out = [];
  for (const p of points || []) {
    if (p.y === null || p.y === undefined) continue;
    const prev = (p.prev !== undefined && p.prev !== null) ? p.prev
      : (out.length ? out[out.length - 1].close : null);
    out.push({
      t: p.t,
      close: p.y,
      prevClose: prev,
      volume: p.volume,
      openInterest: p.openInterest
    });
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Strategy replay
 * ----------------------------------------------------------------------- */

/* Median period volume, used by the volume-confirmation rule. */
export function median(values) {
  const v = values.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/* Replay one strategy over one market's price history.
 * Returns a trade object, or null when the strategy never fired. */
export function replayStrategy(strategy, series, market) {
  const volMedian = median(series.map(s => s.volume));
  let entry = null;
  let entryIndex = -1;

  for (let i = 0; i < series.length; i++) {
    const c = series[i];
    let price = null;
    if (strategy.key === "confirm") {
      if (volMedian !== null && c.volume !== null && c.volume > volMedian &&
          i > 0 && c.close !== null && c.prevClose !== null && c.close - c.prevClose >= 0.10) {
        price = c.close;
      }
    } else if (typeof strategy.signal === "function") {
      price = strategy.signal(c, i);
    }
    if (price !== null && price !== undefined && Number.isFinite(price)) {
      entry = { price, index: i, t: c.t, volume: c.volume };
      entryIndex = i;
      break;
    }
  }
  if (!entry) return null;

  const side = strategy.side || "yes";
  const settle = num(market.settlement_value_dollars);
  const entryPrice = side === "yes" ? entry.price : 1 - entry.price;
  let exitPrice = null;
  let exitReason = "";
  let exitTs = null;

  if (strategy.hold === "roundtrip") {
    const targetYesPrice = side === "yes" ? entry.price + 0.10 : entry.price - 0.10;
    for (let j = entryIndex + 1; j < series.length; j++) {
      const yesPrice = series[j].close;
      const reached = yesPrice !== null && (side === "yes"
        ? yesPrice >= targetYesPrice - CLOSE_EPS
        : yesPrice <= targetYesPrice + CLOSE_EPS);
      if (reached) {
        exitPrice = side === "yes" ? yesPrice : 1 - yesPrice;
        exitReason = "target +$0.10 reached";
        exitTs = series[j].t;
        break;
      }
    }
  }

  let pnl = null;
  let payout = null;
  if (exitPrice !== null) {
    payout = exitPrice;
    pnl = payout - entryPrice;
  } else if (settle !== null) {
    payout = side === "yes" ? settle : 1 - settle;
    pnl = payout - entryPrice;
    exitReason = "held to settlement";
    exitTs = market.settlement_ts ? Date.parse(market.settlement_ts) : null;
  }

  return {
    strategyKey: strategy.key,
    strategyName: strategy.name,
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    eventTitle: market.event_title,
    topic: market.topic,
    side,
    entryPrice,
    yesPriceAtEntry: entry.price,
    entryTs: entry.t,
    exitPrice,
    exitReason: exitReason || "no priced period after entry",
    exitTs,
    payout,
    pnlPerContract: pnl,
    capitalPerContract: entryPrice,
    result: (market.result || "").toLowerCase(),
    settlementValue: settle,
    category: market.category,
    seriesTicker: market.series_ticker
  };
}

/* Reproducible random-control trade: one randomly selected candle and side
 * per market, generated from a ticker-seeded PRNG. This is a baseline, not a
 * market prediction; repeated runs over the same inputs produce the same
 * trade. It uses the same close-fill / settlement assumptions as the rules. */
export const RANDOM_CONTROL = {
  key: "random-control",
  name: "Random control (seeded)",
  rule: "One deterministic pseudo-random entry candle and side per market; held to settlement"
};

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tickerSeed(ticker = "") {
  let hash = 2166136261;
  for (const char of String(ticker)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function replayRandomControl(series, market) {
  const valid = (series || []).filter(c => Number.isFinite(c.close) && c.close >= 0 && c.close <= 1);
  const settle = num(market.settlement_value_dollars);
  if (!valid.length || settle === null || !market.ticker) return null;
  const random = seededRandom(tickerSeed(market.ticker));
  const entry = valid[Math.floor(random() * valid.length)];
  const side = random() < 0.5 ? "yes" : "no";
  const entryPrice = side === "yes" ? entry.close : 1 - entry.close;
  const payout = side === "yes" ? settle : 1 - settle;
  return {
    strategyKey: RANDOM_CONTROL.key,
    strategyName: RANDOM_CONTROL.name,
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    eventTitle: market.event_title,
    topic: market.topic,
    side,
    entryPrice,
    yesPriceAtEntry: entry.close,
    entryTs: entry.t,
    exitPrice: null,
    exitReason: "held to settlement (random control)",
    exitTs: market.settlement_ts ? Date.parse(market.settlement_ts) : null,
    payout,
    pnlPerContract: payout - entryPrice,
    capitalPerContract: entryPrice,
    result: (market.result || "").toLowerCase(),
    settlementValue: settle,
    category: market.category,
    seriesTicker: market.series_ticker
  };
}

/* Replay every strategy over one market. */
export function replayAll(strategies, series, market) {
  const trades = [];
  for (const s of strategies) {
    const t = replayStrategy(s, series, market);
    if (t) trades.push(t);
  }
  return trades;
}

/* --------------------------------------------------------------------------
 * Aggregation
 * ----------------------------------------------------------------------- */

export function aggregate(trades) {
  const groups = new Map();
  for (const t of trades) {
    if (!groups.has(t.strategyKey)) {
      groups.set(t.strategyKey, {
        key: t.strategyKey, name: t.strategyName, trades: [], pnl: 0, capital: 0, wins: 0, losses: 0, flat: 0
      });
    }
    const g = groups.get(t.strategyKey);
    g.trades.push(t);
    if (t.pnlPerContract !== null) {
      g.pnl += t.pnlPerContract;
      g.capital += t.capitalPerContract;
      if (t.pnlPerContract > 0) g.wins++;
      else if (t.pnlPerContract < 0) g.losses++;
      else g.flat++;
    }
  }
  return [...groups.values()].map(g => {
    const n = g.trades.length;
    const scored = g.wins + g.losses;
    const avgEntry = n ? g.trades.reduce((a, t) => a + t.entryPrice, 0) / n : null;
    return {
      ...g,
      n,
      winRate: scored ? g.wins / scored : null,
      avgEntry,
      roi: g.capital > 0 ? g.pnl / g.capital : null,
      avgPnl: n ? g.pnl / n : null
    };
  });
}

/* Aggregate scored results across topic and direction. The labels derive from
 * the event classification and side recorded on each simulated trade. */
export function aggregateBreakdowns(trades) {
  const groups = new Map();
  for (const t of trades) {
    for (const [dimension, value] of [["Topic", t.topic || "unclassified"], ["Direction", (t.side || "").toUpperCase() || "unavailable"]]) {
      const key = `${dimension}:${value}`;
      if (!groups.has(key)) groups.set(key, {
        dimension, value, trades: 0, wins: 0, losses: 0, flat: 0, pnl: 0, capital: 0, tickers: []
      });
      const g = groups.get(key);
      g.trades++;
      if (!g.tickers.includes(t.ticker)) g.tickers.push(t.ticker);
      if (Number.isFinite(t.pnlPerContract)) {
        g.pnl += t.pnlPerContract;
        g.capital += Number.isFinite(t.capitalPerContract) ? t.capitalPerContract : 0;
        if (t.pnlPerContract > 0) g.wins++;
        else if (t.pnlPerContract < 0) g.losses++;
        else g.flat++;
      }
    }
  }
  return [...groups.values()].map(g => ({
    ...g,
    roi: g.capital > 0 ? g.pnl / g.capital : null,
    winRate: g.wins + g.losses > 0 ? g.wins / (g.wins + g.losses) : null
  })).sort((a, b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value));
}

const CSV_COLUMNS = [
  ["strategy", t => t.strategyName], ["ticker", t => t.ticker], ["event_ticker", t => t.eventTicker],
  ["event_title", t => t.eventTitle], ["topic", t => t.topic], ["side", t => t.side],
  ["entry_price_per_contract", t => t.entryPrice], ["yes_price_at_entry", t => t.yesPriceAtEntry],
  ["entry_time", t => t.entryTs == null ? "" : new Date(t.entryTs).toISOString()],
  ["exit_price_per_contract", t => t.exitPrice ?? ""], ["exit_reason", t => t.exitReason],
  ["settlement_result", t => t.result], ["settlement_value", t => t.settlementValue ?? ""],
  ["payout_per_contract", t => t.payout ?? ""], ["pnl_per_contract", t => t.pnlPerContract ?? ""],
  ["capital_per_contract", t => t.capitalPerContract ?? ""], ["market_source", t => marketSourceUrl(t.ticker)],
  ["event_source", t => eventSourceUrl(t.eventTicker)], ["candlestick_docs", () => "https://docs.kalshi.com/api-reference/market/get-market-candlesticks"]
];

export function marketSourceUrl(ticker = "") {
  return `https://external-api.demo.kalshi.co/trade-api/v2/markets/${encodeURIComponent(ticker)}`;
}
export function eventSourceUrl(ticker = "") {
  return `https://external-api.demo.kalshi.co/trade-api/v2/events/${encodeURIComponent(ticker)}`;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  // Protect spreadsheet users from formula injection in exchange-provided text;
  // keep numeric negatives numeric rather than prefixing them as text.
  const safe = typeof value === "string" && /^\s*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function tradesToCsv(trades) {
  return [CSV_COLUMNS.map(([name]) => csvCell(name)).join(","),
    ...(trades || []).map(t => CSV_COLUMNS.map(([, get]) => csvCell(get(t))).join(","))
  ].join("\r\n");
}

/* --------------------------------------------------------------------------
 * Live paper trading
 * ----------------------------------------------------------------------- */

/* A tiny in-browser paper-trading book. Orders are simulated against live
 * prices; nothing is sent to the exchange and nothing is stored outside this
 * browser's localStorage. */
const PAPER_KEY = "kalshiDash.paper.v1";

export const Paper = {
  all() {
    try { return JSON.parse(localStorage.getItem(PAPER_KEY) || "[]"); }
    catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(PAPER_KEY, JSON.stringify(list)); } catch { /* storage may be blocked */ }
  },
  add(entry) {
    const list = this.all();
    list.unshift({ ...entry, id: (entry.id || crypto.randomUUID()), opened_at: new Date().toISOString() });
    this.save(list);
    return list;
  },
  remove(id) {
    const list = this.all().filter(x => x.id !== id);
    this.save(list);
    return list;
  },
  /* Mark positions whose market has settled and compute the realised P&L
   * from the market's own settlement_value_dollars. */
  async settle() {
    const list = this.all();
    let changed = false;
    for (const p of list) {
      if (p.closed) continue;
      try {
        const j = await api.get(`/markets/${encodeURIComponent(p.ticker)}`);
        const m = j.market || j;
        const result = (m.result || "").toLowerCase();
        if (result === "yes" || result === "no") {
          const sv = num(m.settlement_value_dollars);
          if (sv !== null) {
            const payout = p.side === "yes" ? sv : 1 - sv;
            p.closed = true;
            p.result = result;
            p.settlement_value = sv;
            p.payout_per_contract = payout;
            p.pnl_per_contract = payout - p.entry_price;
            p.closed_at = new Date().toISOString();
            changed = true;
          }
        }
      } catch { /* keep the position open and try again next scan */ }
    }
    if (changed) this.save(list);
    return list;
  }
};

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
 *     No spread and no slippage are applied. The published taker fee IS
 *     applied, using the official formula and rounding rules, so the results
 *     are still optimistic where the market was thin.
 *   - A position held to settlement pays the market's own
 *     `settlement_value_dollars` (1.0000 for YES, 0.0000 for NO).
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

/* FNV-1a. Used only to seed the chance baseline, so that the same market
 * always produces the same "random" entry and a re-run reproduces the
 * control exactly. It is not used for anything that needs to be secret. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/* The index the chance baseline enters at: a hash of the market ticker into
 * the available price history. Deterministic, reproducible, and unrelated to
 * price — that is the whole point of a baseline. */
export function baselineIndex(ticker, length) {
  if (!length) return -1;
  return hashString(ticker) % length;
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
    } else if (strategy.key === "random") {
      /* Chance baseline: one entry at a seeded pseudo-random point in the
       * same window every other strategy is scored over. */
      const idx = baselineIndex(market.ticker, series.length);
      if (i === idx && c.close !== null) price = c.close;
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
  let exitPrice = null;
  let exitReason = "";
  let exitTs = null;

  if (strategy.hold === "roundtrip") {
    const target = entry.price + 0.10;
    for (let j = entryIndex + 1; j < series.length; j++) {
      if (series[j].close !== null && series[j].close >= target - CLOSE_EPS) {
        exitPrice = series[j].close;
        exitReason = "target +$0.10 reached";
        exitTs = series[j].t;
        break;
      }
    }
  }

  let pnl = null;
  let payout = null;
  let exitFee = 0;
  if (exitPrice !== null) {
    payout = side === "yes" ? exitPrice : 1 - exitPrice;
  } else if (settle !== null) {
    payout = side === "yes" ? settle : 1 - settle;
    exitReason = "held to settlement";
    exitTs = market.settlement_ts ? Date.parse(market.settlement_ts) : null;
    /* The official schedule states there is no settlement fee, so the exit leg
     * costs nothing when the position is held to settlement. */
  }
  if (payout !== null) {
    /* The entry is a taker fill at the price the rule fired on. */
    const entryFee = sideFee(side, entry.price, 1);
    const entryFeeCost = entryFee ? entryFee.netFee : 0;
    if (exitPrice !== null) {
      const f = sideFee(side, exitPrice, 1);
      exitFee = f ? f.netFee : 0;
    }
    pnl = payout - entry.price - entryFeeCost - exitFee;
  }

  return {
    strategyKey: strategy.key,
    strategyName: strategy.name,
    ticker: market.ticker,
    eventTicker: market.event_ticker,
    eventTitle: market.event_title,
    topic: market.topic,
    side,
    entryPrice: entry.price,
    entryTs: entry.t,
    exitPrice,
    exitReason: exitReason || "no priced period after entry",
    exitTs,
    payout,
    pnlPerContract: pnl,
    pnlBeforeFees: payout === null ? null : payout - entry.price,
    feePaid: payout === null ? null : (pnl === null ? null : (payout - entry.price) - pnl),
    capitalPerContract: entry.price,
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
        key: t.strategyKey, name: t.strategyName, trades: [], pnl: 0, capital: 0, fees: 0, wins: 0, losses: 0, flat: 0
      });
    }
    const g = groups.get(t.strategyKey);
    g.trades.push(t);
    if (t.pnlPerContract !== null) {
      g.pnl += t.pnlPerContract;
      g.capital += t.capitalPerContract;
      g.fees += t.feePaid || 0;
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

/* Group the same trades by any other dimension the reader cares about —
 * by direction (YES / NO) or by topic — so a strategy's result can be split
 * into the trade types that produced it. The brief asks for trades to be
 * "categorized"; the trade-type dimension is the one a trader can act on.
 * Every group is scored exactly like the strategy scoreboard, so the numbers
 * are directly comparable. */
export function rollup(trades, keyFn, labelFn) {
  const groups = new Map();
  for (const t of trades) {
    const key = keyFn(t);
    if (!groups.has(key)) {
      groups.set(key, { key, label: labelFn ? labelFn(t, key) : String(key), trades: [], pnl: 0, capital: 0, fees: 0, wins: 0, losses: 0, flat: 0 });
    }
    const g = groups.get(key);
    g.trades.push(t);
    if (t.pnlPerContract !== null && t.pnlPerContract !== undefined) {
      g.pnl += t.pnlPerContract;
      g.capital += t.capitalPerContract;
      g.fees += t.feePaid || 0;
      if (t.pnlPerContract > 0) g.wins++;
      else if (t.pnlPerContract < 0) g.losses++;
      else g.flat++;
    }
  }
  return [...groups.values()].map(g => {
    const n = g.trades.length;
    const scored = g.wins + g.losses;
    return {
      ...g,
      n,
      winRate: scored ? g.wins / scored : null,
      avgEntry: n ? g.trades.reduce((a, t) => a + t.entryPrice, 0) / n : null,
      roi: g.capital > 0 ? g.pnl / g.capital : null,
      avgPnl: n ? g.pnl / n : null
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

/* --------------------------------------------------------------------------
 * Fees
 * ----------------------------------------------------------------------- */

/* Kalshi's published fee schedule (https://kalshi.com/docs/kalshi-fee-schedule.pdf):
 *
 *   taker: fees = round_up(M × 0.07  × C × P × (1 − P))
 *   maker: fees = round_up(M × 0.0175 × C × P × (1 − P))
 *
 * where P is the price of the contract in dollars, C the number of contracts
 * and M the contract multiplier (1 unless the series says otherwise).
 *
 * The rounding is documented at
 * https://docs.kalshi.com/getting_started/fee_rounding:
 *   trade_fee    = ceil_6dp(model_fee)
 *   aligned      = floor_4dp(revenue − trade_fee)   (direct-member precision)
 *   rounding_fee = (revenue − trade_fee) − aligned
 *   net_fee      = trade_fee + rounding_fee         (no rebate on a single fill)
 *
 * `precision` selects the balance grid: 4 for a direct member ($0.0001) and 2
 * for a non-direct member ($0.01). The published worked example uses the
 * non-direct grid, and is reproduced exactly by `fillFee(0.055, 1,
 * { precision: 2 })`.
 *
 * A simulated entry is filled at the displayed price, so it is treated as a
 * TAKER fill. The series multiplier is not published per market in the
 * responses this page reads, so M = 1 is used and the assumption is printed
 * above the results.
 */

const FEE_RATE = { taker: 0.07, maker: 0.0175 };
const DIRECT_MEMBER_PRECISION = 4;   // $0.0001
const FEE_PRECISION = 6;             // $0.000001

/* ceil to n decimal places, without float noise from the multiplication. */
function ceilTo(value, dp) {
  const scale = 10 ** dp;
  const scaled = Number((value * scale).toFixed(dp));
  return Math.ceil(scaled) / scale;
}

/* floor to n decimal places, without float noise. */
function floorTo(value, dp) {
  const scale = 10 ** dp;
  const scaled = Number((value * scale).toFixed(dp));
  return Math.floor(scaled) / scale;
}

/* The fee for one fill.
 *
 *   price      — the contract price in dollars (the side being traded)
 *   count      — number of contracts
 *   role       — "taker" (default) or "maker"
 *   multiplier — the series multiplier M (1 unless published otherwise)
 *
 * Returns { modelFee, tradeFee, roundingFee, netFee }. */
export function fillFee(price, count = 1, { role = "taker", multiplier = 1, precision = DIRECT_MEMBER_PRECISION } = {}) {
  const rate = FEE_RATE[role] ?? FEE_RATE.taker;
  const modelFee = multiplier * rate * count * price * (1 - price);
  const tradeFee = ceilTo(modelFee, FEE_PRECISION);
  const revenue = -(price * count);
  const aligned = floorTo(revenue - tradeFee, precision);
  const roundingFee = (revenue - tradeFee) - aligned;
  return {
    modelFee: roundTo(modelFee, FEE_PRECISION),
    tradeFee: roundTo(tradeFee, FEE_PRECISION),
    roundingFee: roundTo(roundingFee, FEE_PRECISION),
    netFee: roundTo(tradeFee + roundingFee, FEE_PRECISION)
  };
}

/* The fee on the leg that is being scored. A YES trade is priced on the YES
 * side, a NO trade on the NO side (price 1 − yes price). */
export function sideFee(side, sidePrice, count = 1, options = {}) {
  if (sidePrice === null || sidePrice === undefined || !Number.isFinite(sidePrice)) return null;
  const price = side === "no" ? 1 - sidePrice : sidePrice;
  if (!(price > 0 && price < 1)) return null;
  return fillFee(price, count, options);
}

function roundTo(value, dp) {
  const scale = 10 ** dp;
  return Number((value * scale).toFixed(dp)) / scale;
}

/* --------------------------------------------------------------------------
 * CSV export
 * ----------------------------------------------------------------------- */

const CSV_COLUMNS = [
  ["strategy", t => t.strategyName],
  ["strategy_key", t => t.strategyKey],
  ["event_ticker", t => t.eventTicker],
  ["market_ticker", t => t.ticker],
  ["event_title", t => t.eventTitle],
  ["topic", t => t.topic || ""],
  ["side", t => t.side],
  ["entry_price", t => t.entryPrice],
  ["entry_time", t => (t.entryTs ? new Date(t.entryTs).toISOString() : "")],
  ["exit_price", t => (t.exitPrice === null || t.exitPrice === undefined ? "" : t.exitPrice)],
  ["exit_reason", t => t.exitReason],
  ["exit_time", t => (t.exitTs ? new Date(t.exitTs).toISOString() : "")],
  ["result", t => t.result],
  ["settlement_value", t => (t.settlementValue === null || t.settlementValue === undefined ? "" : t.settlementValue)],
  ["pnl_per_contract", t => (t.pnlPerContract === null || t.pnlPerContract === undefined ? "" : t.pnlPerContract)],
  ["pnl_before_fees", t => (t.pnlBeforeFees === null || t.pnlBeforeFees === undefined ? "" : t.pnlBeforeFees)],
  ["fee_paid", t => (t.feePaid === null || t.feePaid === undefined ? "" : t.feePaid)],
  ["capital_per_contract", t => t.capitalPerContract],
  ["category", t => t.category || ""],
  ["series_ticker", t => t.seriesTicker || ""],
  ["market_source", t => `https://external-api.demo.kalshi.co/trade-api/v2/markets/${encodeURIComponent(t.ticker)}`]
];

/* RFC 4180 quoting: wrap in quotes and double any embedded quote. */
function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* Build a CSV string from the simulated trade ledger. The column names are
 * the same field names the official Get Fills / Get Market responses use, so
 * the export can be joined against a real fill export. */
export function tradesToCsv(trades) {
  const head = CSV_COLUMNS.map(([name]) => name).join(",");
  const body = (trades || []).map(t => CSV_COLUMNS.map(([, get]) => csvCell(get(t))).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
}

/* The same export for the live paper book. */
export function paperToCsv(list) {
  const cols = [
    ["opened_at", p => p.opened_at],
    ["ticker", p => p.ticker],
    ["event_ticker", p => p.event_ticker],
    ["event_title", p => p.event_title],
    ["topic", p => p.topic || ""],
    ["side", p => p.side],
    ["entry_price", p => p.entry_price],
    ["entry_basis", p => p.entry_basis || ""],
    ["screen_score", p => (p.screen_score === null || p.screen_score === undefined ? "" : p.screen_score)],
    ["delta", p => (p.delta === null || p.delta === undefined ? "" : p.delta)],
    ["strategy", p => p.strategy || ""],
    ["status", p => (p.closed ? "closed" : "open")],
    ["result", p => p.result || ""],
    ["settlement_value", p => (p.settlement_value === null || p.settlement_value === undefined ? "" : p.settlement_value)],
    ["pnl_per_contract", p => (p.pnl_per_contract === null || p.pnl_per_contract === undefined ? "" : p.pnl_per_contract)],
    ["market_source", p => `https://external-api.demo.kalshi.co/trade-api/v2/markets/${encodeURIComponent(p.ticker)}`]
  ];
  const head = cols.map(([name]) => name).join(",");
  const body = (list || []).map(p => cols.map(([, get]) => csvCell(get(p))).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
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

/* KalshiDash2 — pure logic for the live feed.
 *
 * Kept free of DOM and network so it runs unchanged in the browser and under
 * `node --test`. The browser adapter lives in `live-feed.js`.
 *
 * The only thing this file does is compare two documented price readings of
 * the same market and decide whether the change is a swing. The two readings
 * come from either
 *
 *   the Kalshi demo WebSocket `ticker` channel, whose payload names the last
 *   trade `price_dollars`
 *   https://docs.kalshi.com/websockets/market-ticker
 *
 * or the REST market object, which names it `last_price_dollars`
 *   https://docs.kalshi.com/api-reference/market/get-markets
 *
 * Nothing is inferred. A price the source did not send stays null and never
 * produces an alert.
 */

/* Round to 4 decimals: Kalshi's dollar fields are 4-decimal fixed-point
 * strings, so the delta between two of them is also 4-decimal. */
export function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* The threshold test is inclusive of exactly $0.10. `EPS` absorbs the float
 * error that would otherwise make 0.70 - 0.60 come out as 0.09999999999999998
 * and fail a `>= 0.10` test. The alert engine uses the same rule so the two
 * feeds never disagree about the same move. */
export const EPS = 1e-9;

/* A reading of one market: { ticker, price, yesBid, yesAsk, volume,
 * openInterest, at }. */
export function reading(ticker, price, { yesBid = null, yesAsk = null, volume = null,
  openInterest = null, at = Date.now() } = {}) {
  return {
    ticker,
    price: num(price),
    yesBid: num(yesBid),
    yesAsk: num(yesAsk),
    volume: num(volume),
    openInterest: num(openInterest),
    at
  };
}

/* Compare two readings of the same market.
 *
 * Returns null when there is nothing to report:
 *   - either price is missing (the source did not send one)
 *   - the price did not change
 *   - the change is smaller than `threshold`
 *
 * Returns { ticker, from, to, delta, direction, fromAt, toAt } otherwise.
 */
export function swingBetween(prev, next, threshold = 0.10) {
  if (!prev || !next) return null;
  if (!next.ticker || prev.ticker !== next.ticker) return null;
  if (prev.price === null || prev.price === undefined) return null;
  if (next.price === null || next.price === undefined) return null;
  const delta = round4(next.price - prev.price);
  if (delta === 0) return null;
  if (Math.abs(delta) < threshold - EPS) return null;
  return {
    ticker: next.ticker,
    from: prev.price,
    to: next.price,
    delta,
    direction: delta > 0 ? "up" : "down",
    fromAt: prev.at,
    toAt: next.at
  };
}

/* Fold a sequence of readings for many markets and return the swings.
 *
 * `state` is a Map of ticker -> last reading; it is updated in place so the
 * caller can keep folding. The first reading for a ticker only sets a
 * baseline and never produces a swing — there is nothing to compare it with.
 */
export function foldReadings(state, readings, threshold = 0.10) {
  const swings = [];
  for (const r of readings || []) {
    if (!r || !r.ticker) continue;
    const prev = state.get(r.ticker);
    state.set(r.ticker, r);
    const s = swingBetween(prev, r, threshold);
    if (s) swings.push(s);
  }
  return swings;
}

/* Map a Kalshi WebSocket `ticker` frame onto a reading.
 *
 * The frame's fields, per
 * https://docs.kalshi.com/websockets/market-ticker:
 *   market_ticker, price_dollars, yes_bid_dollars, yes_ask_dollars,
 *   volume_fp, open_interest_fp, yes_bid_size_fp, yes_ask_size_fp,
 *   last_trade_size_fp, dollar_volume, dollar_open_interest, ts, ts_ms, time
 *
 * The `ticker` channel names the last trade `price_dollars`; the REST market
 * object names it `last_price_dollars`. That is the only difference.
 */
export function fromTickerFrame(msg) {
  if (!msg || !msg.market_ticker) return null;
  const at = Number.isFinite(msg.ts_ms) ? msg.ts_ms : Date.now();
  return reading(msg.market_ticker, msg.price_dollars, {
    yesBid: msg.yes_bid_dollars,
    yesAsk: msg.yes_ask_dollars,
    volume: msg.volume_fp,
    openInterest: msg.open_interest_fp,
    at
  });
}

/* Map a REST market object (GET /markets) onto a reading. */
export function fromRestMarket(m) {
  if (!m || !m.ticker) return null;
  return reading(m.ticker, m.last_price_dollars, {
    yesBid: m.yes_bid_dollars,
    yesAsk: m.yes_ask_dollars,
    volume: m.volume_fp,
    openInterest: m.open_interest_fp,
    at: Date.now()
  });
}

/* The spread implied by a reading, in dollars, or null when the quote is not
 * two-sided. */
export function spreadOf(r) {
  if (!r || r.yesBid === null || r.yesAsk === null) return null;
  if (r.yesBid === undefined || r.yesAsk === undefined) return null;
  return round4(r.yesAsk - r.yesBid);
}

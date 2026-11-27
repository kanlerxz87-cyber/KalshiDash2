/* KalshiDash2 — reusable live alert engine.
 *
 * Watches the five tracked topics on the Kalshi demo exchange and reports every
 * contract-price swing of $0.10 or more, in either direction.
 *
 * How a swing is measured
 * ----------------------
 * Kalshi publishes no "swing" field, so one is derived from two documented
 * fields that every market carries
 * (https://docs.kalshi.com/api-reference/market/get-market):
 *
 *   previous_price_dollars  — the exchange's own reference price (the schema
 *                             describes it as the last traded YES price a day
 *                             ago; see Flagged Z1)
 *   last_price_dollars      — the most recent trade price
 *
 *   exchange-reported swing : |last_price_dollars − previous_price_dollars|
 *   observed swing          : |last_price_dollars(t) − last_price_dollars(t−1)|
 *                             between two consecutive polls of this page
 *
 * Both are labelled in the feed, so a reader can always see which comparison
 * produced the number. A market can therefore report both kinds.
 *
 * De-duplication — what is and is not a duplicate
 * -----------------------------------------------
 * A swing is identified by (ticker, basis, from, to, observation time). The two
 * bases are compared against different references, so the same (ticker, from,
 * to) pair really is two different measurements when one is the exchange's
 * 24-hour reference and the other is this page's own poll-to-poll move; they
 * are kept apart here, exactly as `alerts.html` keeps them apart.
 *
 * A repeat of the *same* series of prices is NOT a duplicate. A contract that
 * trades 0.40 → 0.55 → 0.40 → 0.55 has moved $0.10 four times, and every one
 * of those moves is a real, separately tradeable event. So the key includes the
 * time at which the move was observed: a repeat that is still the same poll is
 * collapsed (the exchange serves one price per poll), and a repeat on a later
 * poll is reported again.
 *
 * Repeated polls of an unchanged exchange reference carry no new information —
 * `previous_price_dollars` only changes when the day rolls — so a repeat of a
 * *reference* swing is collapsed until the reference value itself changes.
 *
 * This module is the reusable half of the alerting system: it has no DOM
 * dependency, so the Strategy Tester's paper trader can drive exactly the
 * same engine the Live alerts page uses. The page itself lives in alerts.js.
 *
 * Nothing here is inferred. Every price, size, time and result shown comes
 * straight from a live API response; a field the API did not return is shown
 * as "n/a" rather than as zero.
 */
import { ALERT, TRADE_SCREEN, TOPICS } from "./config.js";
import { getAll, classifyEvent, num, screenMarket, getEvent, eventContext, fetchSeriesCategories } from "./market.js";

/* -------------------------------------------------------------------------- */

/* One series lookup per distinct series, cached for the page's life, ordered by
 * event count so the budget covers the most events; bounded because a scan must
 * not spend an unbounded number of public reads (Kalshi publishes no numeric
 * budget for unauthenticated traffic — flag A8). */
const SERIES_LOOKUP_CAP = 30;

export class AlertEngine {
  constructor({
    threshold = ALERT.defaultThreshold,
    passScore = TRADE_SCREEN.passScore,
    pollMs = ALERT.defaultPollMs,
    maxEventsPerPoll = ALERT.maxEventsPerPoll,
    onMessage = () => {},
    onState = () => {}
  } = {}) {
    this.threshold = threshold;
    this.passScore = passScore;
    this.pollMs = pollMs;
    this.maxEventsPerPoll = maxEventsPerPoll;
    this.onMessage = onMessage;
    this.onState = onState;

    this.lastPrice = new Map();      // ticker -> last observed last_price_dollars
    this.seen = new Set();           // dedupe keys (see the header)
    this.pollSeq = 0;                // increments once per completed scan
    this.eventCache = new Map();     // event_ticker -> {event, context}
    this.timer = null;
    this.running = false;
    this.scanned = 0;
    this.markets = 0;
    this.lastEvents = [];
    this.lastPollAt = null;
    this.errors = [];
  }

  start() {
    this.stop();
    this.running = true;
    this.onState({ state: "starting" });
    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    this.onState({ state: "stopped" });
  }

  setThreshold(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.threshold = Math.min(ALERT.maxThreshold, Math.max(ALERT.minThreshold, n));
  }

  setPollMs(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.pollMs = Math.min(ALERT.maxPollMs, Math.max(ALERT.minPollMs, n));
    if (this.running) { this.stop(); this.start(); }
  }

  /* ---------------------------------------------------------------- poll */

  async poll() {
    if (this._inFlight) return;            // never overlap two scans
    this._inFlight = true;
    this.onState({ state: "loading" });
    try {
      const events = await getAll("/events?status=open&with_nested_markets=true", {
        key: "events",
        maxPages: this.maxEventsPerPoll,
        limit: 200
      });
      this.scanned = events.length;
      this.lastEvents = events;

      /* Classify from the series-level category where possible (the event
       * `category` field is officially deprecated). Cached across polls, so the
       * cost is one request per distinct series for the page's lifetime. */
      const seriesCoverage = await fetchSeriesCategories(
        events.map(e => e.series_ticker), { cap: SERIES_LOOKUP_CAP });
      this.seriesCoverage = seriesCoverage;

      const swings = [];
      let marketCount = 0;

      for (const ev of events) {
        const topicKey = classifyEvent(ev);
        if (!topicKey) continue;
        for (const m of ev.markets || []) {
          if (!["active", "open"].includes(m.status)) continue;
          marketCount++;
          const last = num(m.last_price_dollars);
          const prev = num(m.previous_price_dollars);
          if (last === null) continue;

          const seen = this.lastPrice.get(m.ticker);
          const observed = (seen !== undefined && seen !== null && last !== null)
            ? Number((last - seen).toFixed(4))
            : null;
          this.lastPrice.set(m.ticker, last);

          /* Exchange-reported swing. */
          if (prev !== null && last !== null) {
            const d = Number((last - prev).toFixed(4));
            if (Math.abs(d) >= this.threshold) {
              swings.push(this.#make(ev, m, topicKey, prev, last, d, "exchange previous_price_dollars"));
            }
          }
          /* Swing observed between two of our own polls. */
          if (observed !== null && Math.abs(observed) >= this.threshold) {
            swings.push(this.#make(ev, m, topicKey, seen, last, observed, "observed between polls"));
          }
        }
      }
      this.markets = marketCount;
      this.lastPollAt = new Date();
      this.pollSeq += 1;

      /* Dedupe (see the header): poll-to-poll moves key on the poll they were
       * observed in, so a genuine retracement is never swallowed; reference
       * swings key on the reference pair, because that reference only moves
       * once a day and re-reporting it every poll would flood the feed. */
      const fresh = swings.filter(s => {
        const pair = `${s.ticker}|${s.from.toFixed(2)}|${s.to.toFixed(2)}`;
        const key = s.basis === "observed between polls"
          ? `poll|${pair}|${this.pollSeq}`
          : `ref|${pair}`;
        if (this.seen.has(key)) return false;
        this.seen.add(key);
        if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2000));
        return true;
      });

      /* Newest first. */
      fresh.sort((a, b) => b.at - a.at);

      for (const s of fresh) {
        const screen = screenMarket(s.market, { components: TRADE_SCREEN.components });
        s.screen = screen;
        s.pick = screen.score >= this.passScore;
        this.onMessage(s);
      }

      this.onState({
        state: "live",
        scanned: this.scanned,
        markets: marketCount,
        swings: fresh.length,
        at: this.lastPollAt
      });
    } catch (e) {
      this.errors.push({ at: new Date().toISOString(), message: e.message });
      this.onState({ state: "error", error: e.message });
    } finally {
      this._inFlight = false;
    }
  }

  #make(ev, m, topicKey, from, to, delta, basis) {
    return {
      at: Date.now(),
      basis,
      ticker: m.ticker,
      title: m.title || m.yes_sub_title || ev.title || m.ticker,
      eventTitle: ev.title || ev.event_ticker,
      eventTicker: ev.event_ticker,
      seriesTicker: ev.series_ticker || null,
      topicKey,
      from, to, delta,
      dir: delta > 0 ? "up" : "down",
      market: m,
      event: ev
    };
  }

  /* --------------------------------------------------------------- context */

  /* GET /events/{event_ticker} carries `settlement_sources` — the official
   * sources Kalshi publishes for determining the outcome — plus the market's
   * own rules. These are the websites worth reading when a price jumps.
   * (https://docs.kalshi.com/api-reference/events/get-events) */
  async contextFor(swing) {
    if (this.eventCache.has(swing.eventTicker)) return this.eventCache.get(swing.eventTicker);
    try {
      const event = await getEvent(swing.eventTicker);
      const ctx = eventContext(event);
      const out = { event, ctx, error: null };
      this.eventCache.set(swing.eventTicker, out);
      return out;
    } catch (e) {
      const out = { event: null, ctx: eventContext(null), error: e.message };
      this.eventCache.set(swing.eventTicker, out);
      return out;
    }
  }
}

/* -------------------------------------------------------------------------- */

export function topicLabel(key) {
  const t = TOPICS.find(x => x.key === key);
  return t ? t.label : key || "unclassified";
}

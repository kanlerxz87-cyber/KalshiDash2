/* KalshiDash2 — live feed client (browser adapter).
 *
 * The page has two possible sources of price updates, and it always says
 * which one is running:
 *
 *   1. LIVE  — the Kalshi demo WebSocket `ticker` channel, relayed to the
 *      browser as Server-Sent Events on /live/stream. The Kalshi socket
 *      itself cannot be opened by a page: its handshake requires the three
 *      KALSHI-ACCESS-* headers, and a browser's WebSocket constructor cannot
 *      set custom headers (it takes only a URL and an optional subprotocol
 *      list). scripts/relay.py opens the socket and re-publishes it, so the
 *      browser still gets the exchange's own per-second ticker flush.
 *      Official channel doc:
 *      https://docs.kalshi.com/websockets/market-ticker
 *      ("Changes are combined and sent on a flush scheduled every second")
 *
 *   2. POLL  — the documented REST read, GET /markets?tickers=…
 *      (https://docs.kalshi.com/api-reference/market/get-markets). This is the
 *      fallback when the relay is not running, and it is the only source
 *      available on a plain GitHub Pages deployment.
 *
 * Nothing here fabricates a price. The swing test and the field mapping live
 * in `live-core.js`, which is pure and unit-tested; this file only moves data.
 */
import {
  swingBetween, fromTickerFrame, fromRestMarket, spreadOf
} from "./live-core.js";

/* The four states the feed can be in. The page shows which one is running, so
 * a reader always knows whether the alerts came from the exchange's own
 * ticker stream or from the REST poll. */
export const FEED_STATE = {
  LIVE: "live",
  POLL: "poll",
  CONNECTING: "connecting",
  UNAVAILABLE: "unavailable"
};

export { swingBetween, fromTickerFrame, fromRestMarket, spreadOf };

/* ------------------------------------------------------------------------- *
 * Live feed (Server-Sent Events from the relay)
 * ------------------------------------------------------------------------- */

/* Opens /live/stream and calls onSwing for every ≥ threshold swing the
 * exchange publishes.
 *
 * `onSwing(swing, quote)` — quote is the frame the swing was measured on.
 * `onState(state, detail)` — state is one of FEED_STATE.
 *
 * The relay is optional: if it is not running the connection fails and the
 * caller falls back to polling. Nothing is faked in that case. */
export class LiveFeed {
  constructor({ url = "/live/stream", threshold = 0.10, onSwing = () => {}, onState = () => {} } = {}) {
    this.url = url;
    this.threshold = threshold;
    this.onSwing = onSwing;
    this.onState = onState;
    this.last = new Map();   // ticker -> last reading
    this.source = null;      // EventSource
    this.retryS = 1;
    this.closed = false;
    this.upstreamConnected = false;
    this.timer = null;
    this.frames = 0;
  }

  start() {
    this.closed = false;
    this._connect();
  }

  stop() {
    this.closed = true;
    this.upstreamConnected = false;
    this.last.clear();
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.source) { try { this.source.close(); } catch { /* already closed */ } this.source = null; }
  }

  _connect() {
    if (this.closed) return;
    this.onState(FEED_STATE.CONNECTING, "connecting to the relay stream");
    let es;
    try {
      es = new EventSource(this.url);
    } catch (e) {
      this.onState(FEED_STATE.UNAVAILABLE, e.message || String(e));
      this._scheduleRetry();
      return;
    }
    this.source = es;

    es.onopen = () => {
      this.retryS = 1;
      // SSE connectivity alone does not establish the upstream socket state.
      this.onState(FEED_STATE.CONNECTING, "connected to relay; waiting for WebSocket state");
    };

    es.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (!data) return;
      if (data.type === "hello" || data.type === "state") {
        const detail = `relay state: ${data.state || "unknown"}${data.detail ? " — " + data.detail : ""}`;
        if (data.state === "connected") {
          this.upstreamConnected = true;
          this.onState(FEED_STATE.LIVE, detail);
        } else {
          // Discard pre-disconnect quotes: compare fresh ticks only after recovery.
          // This also lets the caller resume REST alert detection for every ticker.
          this.upstreamConnected = false;
          this.last.clear();
          this.onState(FEED_STATE.UNAVAILABLE, detail);
        }
        return;
      }
      if (data.type !== "ticker" || !this.upstreamConnected) return;

      this.frames += 1;
      const quote = fromTickerFrame(data);
      if (!quote) return;
      const prev = this.last.get(quote.ticker);
      this.last.set(quote.ticker, quote);
      const swing = swingBetween(prev, quote, this.threshold);
      if (swing) this.onSwing(swing, quote);
    };

    es.onerror = () => {
      // EventSource retries on its own, but only while the page lives; the
      // state callback tells the page to show the polling fallback.
      if (this.closed) return;
      this.upstreamConnected = false;
      this.last.clear();
      this.onState(FEED_STATE.UNAVAILABLE, "the relay stream is not available");
      this._scheduleRetry();
    };
  }

  _scheduleRetry() {
    if (this.closed) return;
    if (this.source) { try { this.source.close(); } catch { /* ignore */ } this.source = null; }
    if (this.timer) return;
    const wait = Math.min(this.retryS, 30) * 1000;
    this.retryS = Math.min(this.retryS * 2, 30);
    this.timer = setTimeout(() => {
      this.timer = null;
      this._connect();
    }, wait);
  }
}

/* ------------------------------------------------------------------------- *
 * Relay capability probe
 * ------------------------------------------------------------------------- */

/* Ask the relay whether a live WebSocket source is configured.
 *
 * Returns { available, state, tickers } or null when the relay is not running
 * (the fetch fails), which is the normal case on a plain static deployment. */
export async function probeRelay(url = "/live/status") {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || typeof j.available !== "boolean") return null;
    return { available: j.available, state: j.state || "unknown", tickers: j.tickers || 0 };
  } catch {
    return null;
  }
}

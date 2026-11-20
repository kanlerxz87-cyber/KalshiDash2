/* KalshiDash2 — live alert engine.
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
 *   previous_price_dollars  — the price before the exchange's last change
 *   last_price_dollars      — the most recent trade price
 *
 *   exchange-reported swing : |last_price_dollars − previous_price_dollars|
 *   observed swing          : |last_price_dollars(t) − last_price_dollars(t−1)|
 *                             between two consecutive polls of this page
 *
 * Both are labelled in the feed, so a reader can always see which comparison
 * produced the number. A market can therefore report both kinds; duplicates
 * of the same (ticker, from, to) pair are suppressed.
 *
 * Nothing here is inferred. Every price, size, time and result shown comes
 * straight from a live API response; a field the API did not return is shown
 * as "n/a" rather than as zero.
 */
import { ALERT, TRADE_SCREEN, SOURCES, DEMO, TOPICS } from "./config.js";
import {
  api, getAll, classifyEvent, num, screenMarket, swingOf, getEvent, eventContext
} from "./market.js";

/* -------------------------------------------------------------------------- */

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
    this.seen = new Set();           // dedupe keys
    this.eventCache = new Map();     // event_ticker -> {event, context}
    this.timer = null;
    this.running = false;
    this.scanned = 0;
    this.markets = 0;
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

      /* Dedupe identical (ticker, from, to) triples. */
      const fresh = swings.filter(s => {
        const key = `${s.ticker}|${s.from.toFixed(2)}|${s.to.toFixed(2)}`;
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

/* -------------------------------------------------------------------------- *
 * Rendering helpers
 * -------------------------------------------------------------------------- */

export function topicLabel(key) {
  const t = TOPICS.find(x => x.key === key);
  return t ? t.label : key || "unclassified";
}

/* A source link for the exact API call that produced a number. */
export function apiLink(path, label) {
  return `<a class="src-link" href="${DEMO.rest}${path}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
}

/* Build the "context" block shown under a chat message.
 * `ctx` comes from engine.contextFor(); `sources` are Kalshi's own
 * settlement_sources for the event. */
export function contextHtml(swing, ctx) {
  if (!ctx) return "";
  const parts = [];
  if (ctx.ctx && ctx.ctx.sources && ctx.ctx.sources.length) {
    const links = ctx.ctx.sources
      .filter(s => s.url)
      .slice(0, 8)
      .map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name || s.url)} ↗</a>`)
      .join(" · ");
    parts.push(`<div class="ctx"><b>Kalshi's settlement sources for this event</b> — where the outcome is determined: ${links}</div>`);
  }
  if (ctx.ctx && ctx.ctx.rules) {
    parts.push(`<div class="ctx"><b>Rules</b> — ${escapeHtml(truncate(ctx.ctx.rules, 260))}</div>`);
  }
  if (ctx.error) {
    parts.push(`<div class="ctx"><b>Event context unavailable</b> — ${escapeHtml(ctx.error)}. The price figures above still come from the live API.</div>`);
  }
  return parts.join("");
}

export function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function truncate(s, n) {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/* One chat message. */
export function messageHtml(swing, { pick = false, ctx = null, breakdown = false } = {}) {
  const dirCls = swing.dir === "up" ? "up" : "down";
  const arrow = swing.dir === "up" ? "▲" : "▼";
  const score = swing.screen ? swing.screen.score : null;
  const max = swing.screen ? swing.screen.max : null;

  const rows = (breakdown && swing.screen)
    ? swing.screen.parts.map(p => `<tr>
        <td>${escapeHtml(p.label)}</td>
        <td class="small mono">${p.input === null || p.input === undefined
          ? `<span class="unv">n/a</span>` : escapeHtml(String(p.input))}</td>
        <td class="small">${escapeHtml(p.rule)}</td>
        <td class="num">${p.got} / ${p.max}</td>
      </tr>`).join("")
    : "";

  return `<div class="chat-msg ${dirCls}${pick ? " pick" : ""}" data-ticker="${escapeHtml(swing.ticker)}">
    <div class="who">${arrow} ${escapeHtml(truncate(swing.title, 70))}</div>
    <div class="meta">
      <span>${new Date(swing.at).toLocaleTimeString()}</span>
      <span class="tag">${escapeHtml(topicLabel(swing.topicKey))}</span>
      <span class="px ${dirCls}">${swing.from.toFixed(2)} → ${swing.to.toFixed(2)}</span>
      <span class="px ${dirCls}">${swing.delta > 0 ? "+" : ""}${swing.delta.toFixed(2)}</span>
      ${score !== null ? `<span class="score-chip ${pick ? "hit" : "miss"}">screen ${score}/${max}</span>` : ""}
    </div>
    <div class="meta">
      <span class="mono">${escapeHtml(swing.ticker)}</span>
      <span>basis: ${escapeHtml(swing.basis)}</span>
    </div>
    <div class="links">
      <a href="event.html?ticker=${encodeURIComponent(swing.eventTicker)}">event page →</a>
      ${apiLink(`/markets/${encodeURIComponent(swing.ticker)}`, "market JSON")}
      ${apiLink(`/events/${encodeURIComponent(swing.eventTicker)}`, "event JSON")}
      ${swing.seriesTicker ? apiLink(`/series/${encodeURIComponent(swing.seriesTicker)}`, "series JSON") : ""}
    </div>
    ${contextHtml(swing, ctx)}
    ${rows ? `<div class="table-wrap" style="margin-top:8px"><table>
        <thead><tr><th>Screen component</th><th>Value</th><th>Rule</th><th class="num">Points</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : ""}
  </div>`;
}

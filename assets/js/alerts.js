/* KalshiDash2 — live alerts page controller.
 *
 * Flow (every value is read from the Kalshi demo API; nothing is typed in):
 *   1. Universe: one scan of open events with nested markets (GET /events),
 *      classified into the five topics; the top 30 markets per topic by money
 *      traded are kept. Refreshed every 10 minutes.
 *   2. Poll: batch reads of the universe (GET /markets?tickers=…, 25 per call)
 *      plus every market that still holds an open simulated trade.
 *   3. Detect: a change of ≥ $0.10 in last_price_dollars between two polls is an alert.
 *   4. Simulate: each alert opens paper trades per strategy; open trades are
 *      marked at the best bid and settled only on the API's yes/no result.
 *   5. Render: two scrolling feeds, the strategy table and the trade table.
 *
 * The simulation is stored in this browser only (localStorage). Nothing is sent
 * anywhere except the read-only demo API calls above.
 */
import { mountChrome, esc, $, pill, int, src, emptyRow } from "./ui.js";
import { TOPICS, DEMO } from "./config.js";
import { api, getAll, classifyEvent } from "./market.js";
import {
  THRESHOLD, STRATEGIES, detectMoves, detectReferenceSwings, mergeAlerts,
  watchCheck, planTrades, updateTrade, summarize, pickUniverse, chunk, num
} from "./alerts-core.js";

const SIM_KEY = "kalshiDash.sim.v1";
const SIM_CAP = 500;
const FEED_CAP = 300;
const BATCH = 25;
const PER_TOPIC = 30;
const UNIVERSE_TTL_MS = 10 * 60 * 1000;
const MAX_BACKOFF_S = 300;
const LIVE_STATUSES = ["active", "open"];

mountChrome({ page: "alerts.html", title: "Live alerts" });
document.title = "Live alerts — KalshiDash2";

const S = {
  universe: [],
  universeAt: 0,
  universeInfo: null,
  meta: new Map(),        // ticker → { topic, eventTicker, title }
  prev: {},               // ticker → { price, at }
  alerts: [],             // newest last
  watch: new Map(),       // alert id → watchCheck result
  trades: loadTrades(),
  skipped: {},
  eventLinks: {},         // event ticker → { sources, category } | "loading" | "error"
  intervalS: 15,
  paused: false,
  backoffS: null,
  timer: null,
  inFlight: false,
  polls: 0,
  lastPollAt: null,
  lastError: null,
  topic: "all",
  watching: 0,
  refSeen: new Set()        // (ticker, from, to) already posted as a reference swing
};

const TOPIC_LABEL = Object.fromEntries(TOPICS.map(t => [t.key, t.label]));

/* ----------------------------------------------------------- formatting */

function px(v) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  const cents = Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
  return "$" + n.toFixed(cents ? 2 : 4);
}
function signedPx(v, dp = 2) {
  const n = num(v);
  if (n === null) return `<span class="unv">n/a</span>`;
  const cls = n > 0 ? "pos" : n < 0 ? "neg" : "";
  return `<span class="${cls}">${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(dp)}</span>`;
}
function pctOf(v) {
  const n = num(v);
  return n === null ? `<span class="unv">n/a</span>` : (n * 100).toFixed(1) + "%";
}
function hms(ms) {
  return new Date(ms).toISOString().slice(11, 19);
}
function nowMs() { return Date.now(); }

/* ---------------------------------------------------------- persistence */

function loadTrades() {
  try {
    const v = JSON.parse(localStorage.getItem(SIM_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function saveTrades() {
  try { localStorage.setItem(SIM_KEY, JSON.stringify(S.trades)); } catch { /* storage full or disabled */ }
}
function capTrades(list) {
  if (list.length <= SIM_CAP) return list;
  // Drop the oldest resolved trades first; open positions are never dropped.
  const out = [...list];
  let excess = out.length - SIM_CAP;
  for (let i = 0; i < out.length && excess > 0; i++) {
    if (out[i].status === "resolved") { out.splice(i, 1); i--; excess--; }
  }
  return out;
}

/* ------------------------------------------------------------- universe */

async function loadUniverse(onProgress) {
  const events = await getAll("/events?status=open&with_nested_markets=true", {
    key: "events", maxPages: 12, limit: 200,
    onPage: n => onProgress && onProgress(n)
  });
  const markets = [];
  let matched = 0;
  S.meta = new Map();
  for (const ev of events) {
    const topic = classifyEvent(ev);
    if (!topic) continue;
    matched++;
    for (const m of ev.markets || []) {
      if (!LIVE_STATUSES.includes(m.status)) continue;
      markets.push({
        ...m,
        _topic: topic,
        _event_ticker: ev.event_ticker,
        _event_title: ev.title,
        _category: ev.category,
        _series_ticker: ev.series_ticker
      });
    }
  }
  const keep = S.trades.filter(t => t.status === "open").map(t => t.ticker);
  S.universe = pickUniverse(markets, { perTopic: PER_TOPIC, keep });
  for (const m of S.universe) {
    S.meta.set(m.ticker, { topic: m._topic, eventTicker: m._event_ticker, title: m.title || m._event_title || "" });
  }
  S.universeAt = nowMs();
  S.universeInfo = {
    scanned: events.length,
    matchedEvents: matched,
    liveMarkets: markets.length,
    /* getAll() sets __capped when it stopped at its page budget with a
     * cursor still outstanding. A length check (events.length >= 12*200)
     * misses the case where the last page returned fewer than 200 rows. */
    capped: !!events.__capped
  };
  const perTopic = {};
  for (const m of S.universe) perTopic[m._topic] = (perTopic[m._topic] || 0) + 1;
  S.universeInfo.perTopic = perTopic;
}

/* ----------------------------------------------------------------- poll */

async function pollOnce() {
  const at = nowMs();
  const openTickers = S.trades.filter(t => t.status === "open").map(t => t.ticker);
  const tickers = [...new Set([...S.universe.map(m => m.ticker), ...openTickers])];
  const fresh = new Map();
  for (const batch of chunk(tickers, BATCH)) {
    const q = batch.map(t => encodeURIComponent(t)).join(",");
    const page = await api.get(`/markets?tickers=${q}&limit=1000`);
    for (const m of page.markets || []) {
      const meta = S.meta.get(m.ticker);
      const tr = S.trades.find(t => t.ticker === m.ticker);
      fresh.set(m.ticker, {
        ...m,
        _topic: meta?.topic || tr?.topic || null,
        _event_ticker: meta?.eventTicker || tr?.eventTicker || m.event_ticker
      });
    }
  }

  const { alerts, next } = detectMoves(S.prev, [...fresh.values()], { threshold: THRESHOLD, at });
  S.prev = next;

  /* Two independent comparisons produce a swing:
     (a) between two polls of this page, and
     (b) against the exchange's own previous_price_dollars, which is available
         on the first poll and is the exchange's reference rather than ours.
     Each alert records which comparison produced it. */
  const reference = detectReferenceSwings([...fresh.values()], { threshold: THRESHOLD, at })
    .filter(s => {
      const key = `${s.ticker}|${s.from}|${s.to}`;
      if (S.refSeen.has(key)) return false;
      S.refSeen.add(key);
      if (S.refSeen.size > 5000) S.refSeen = new Set([...S.refSeen].slice(-2000));
      return true;
    });
  const allAlerts = mergeAlerts(alerts, reference);

  S.polls += 1;
  S.lastPollAt = at;
  S.watching = tickers.length;

  for (const a of allAlerts) S.watch.set(a.id, watchCheck(a));
  const plan = planTrades(allAlerts, S.trades, { watch: S.watch, at });
  for (const [k, v] of Object.entries(plan.skipped)) S.skipped[k] = (S.skipped[k] || 0) + v;

  // Trades opened on this poll are marked with this poll's quotes straight away.
  const updated = S.trades.map(t => updateTrade(t, fresh.get(t.ticker), at));
  const created = plan.created.map(t => updateTrade(t, fresh.get(t.ticker), at));
  S.trades = capTrades([...updated, ...created]);
  saveTrades();

  S.alerts.push(...allAlerts);
  if (S.alerts.length > FEED_CAP) S.alerts = S.alerts.slice(-FEED_CAP);
  for (const a of allAlerts) ensureEventLinks(a.eventTicker);
}

/* Settlement sources for the event behind an alert, read once per event. */
async function ensureEventLinks(eventTicker) {
  if (!eventTicker || S.eventLinks[eventTicker]) return;
  S.eventLinks[eventTicker] = "loading";
  try {
    const j = await api.get(`/events/${encodeURIComponent(eventTicker)}`);
    const e = j.event || j;
    const sources = (Array.isArray(e.settlement_sources) ? e.settlement_sources : [])
      .filter(s => s && typeof s.url === "string" && /^https:\/\//.test(s.url));
    S.eventLinks[eventTicker] = { sources, category: e.category || null };
  } catch {
    S.eventLinks[eventTicker] = "error";
  }
  renderFeeds();
}

/* ------------------------------------------------------------ scheduling */

async function tick() {
  if (S.inFlight) return;
  S.inFlight = true;
  try {
    if (!S.universe.length || nowMs() - S.universeAt > UNIVERSE_TTL_MS) {
      pill($("#poll-status"), "warn", "scanning open events…");
      await loadUniverse();
    }
    await pollOnce();
    S.lastError = null;
    S.backoffS = null;
  } catch (e) {
    S.lastError = e.message || String(e);
    if (e.status === 429) S.backoffS = Math.min(MAX_BACKOFF_S, (S.backoffS || S.intervalS) * 2);
  } finally {
    S.inFlight = false;
  }
  renderAll();
  schedule();
}

function schedule() {
  clearTimeout(S.timer);
  if (S.paused) return;
  const s = S.backoffS || S.intervalS;
  S.timer = setTimeout(tick, s * 1000);
}

/* -------------------------------------------------------------- rendering */

function topicLabel(k) { return TOPIC_LABEL[k] || k || "—"; }

function feedItems(list) {
  return S.alerts.filter(a => (S.topic === "all" || a.topic === S.topic) && (!list || list(a)));
}

function msgHTML(a, watchFeed) {
  const up = a.direction === "up";
  const q = a.quote || {};
  const w = S.watch.get(a.id);
  const ev = S.eventLinks[a.eventTicker];
  let sources;
  if (ev && ev !== "loading" && ev !== "error") {
    sources = ev.sources.length
      ? ev.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name || "settlement source")} ↗</a>`).join(" · ")
      : `<span class="unv">none listed on the event record</span>`;
  } else if (ev === "error") {
    sources = `<span class="unv">event record could not be read</span>`;
  } else {
    sources = `<span class="unv">loading…</span>`;
  }
  const ruleLine = w
    ? `<div class="rule">High-ROI rule check: ${w.checks.every(c => c.ok)
        ? "passes all four rules"
        : "fails: " + esc(w.checks.filter(c => !c.ok).map(c => c.label).join("; "))}</div>`
    : "";
  const spread = q.spread !== null && q.spread !== undefined ? ` · spread $${q.spread.toFixed(2)}` : "";
  const vol = a.volume24h !== null && a.volume24h !== undefined ? ` · ${int(a.volume24h)} contracts (24h)` : "";
  return `
    <article class="msg ${up ? "up" : "down"}">
      <div class="meta">
        <time datetime="${new Date(a.at).toISOString()}">${hms(a.at)} UTC</time>
        <span class="tag">${esc(topicLabel(a.topic))}</span>
        ${watchFeed ? `<span class="tag watch">High-ROI watch</span>` : ""}
        <span class="tag ${up ? "yes" : "no"}">${up ? "▲ up" : "▼ down"}</span>
        <span class="tag">${esc(a.basis || "between two polls")}</span>
        ${a.screen ? `<span class="tag watch">screen ${a.screen.score}/${a.screen.max}</span>` : ""}
      </div>
      <div class="ttl">${esc(a.title || a.ticker)}</div>
      <div class="body">
        Last trade <strong>${px(a.from)} → ${px(a.to)}</strong>
        (<strong>${up ? "+" : "−"}$${Math.abs(a.delta).toFixed(2)}</strong>)
        · bid / ask ${px(q.yesBid)} / ${px(q.yesAsk)}${spread}${vol}
      </div>
      ${ruleLine}
      <div class="links">
        ${src(`${DEMO.rest}/markets/${a.ticker}`, "GET /markets/" + a.ticker)}
        · ${sources}
      </div>
    </article>`;
}

function renderFeed(el, items, watchFeed, emptyText) {
  if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  const first = !el.dataset.ready;
  if (!items.length) {
    el.innerHTML = `<div class="feed-empty">${esc(emptyText)}</div>`;
  } else {
    el.innerHTML = items.map(a => msgHTML(a, watchFeed)).join("");
  }
  if (first || atBottom) el.scrollTop = el.scrollHeight;
  el.dataset.ready = "1";
}

function renderFeeds() {
  const all = feedItems();
  const watch = feedItems(a => (S.watch.get(a.id) || {}).pass)
    .sort((a, b) => ((b.screen?.score ?? 0) - (a.screen?.score ?? 0)) || (b.at - a.at));
  const watching = S.watching ? `Watching ${S.watching} markets.` : "";
  renderFeed($("#feed-all"), all, false,
    S.polls ? `No move of $0.10 or more yet. ${watching}` : "Waiting for the first poll…");
  renderFeed($("#feed-watch"), watch, true,
    S.polls ? `No alert has passed the High-ROI rules yet. ${watching}` : "Waiting for the first poll…");
}

function renderStatus() {
  const el = $("#poll-status");
  if (S.paused) { pill(el, "idle", "paused — no polling"); return; }
  if (S.lastError) {
    const wait = S.backoffS || S.intervalS;
    pill(el, "err", `error: ${S.lastError} · retrying in ${wait}s`);
    return;
  }
  if (S.backoffS) { pill(el, "warn", `rate limited — backing off to ${S.backoffS}s`); return; }
  if (!S.polls) { pill(el, "warn", "starting…"); return; }
  pill(el, "live", `live · poll #${S.polls} at ${hms(S.lastPollAt)} UTC · every ${S.intervalS}s`);
}

function renderUniverseNote() {
  const u = S.universeInfo;
  const el = $("#universe-note");
  if (!el) return;
  if (!u) { el.textContent = "Scanning open events…"; return; }
  const per = TOPICS.map(t => `${t.label} ${u.perTopic[t.key] || 0}`).join(" · ");
  el.innerHTML = `Scanned ${int(u.scanned)} open events (${int(u.matchedEvents)} in the five topics; ${int(u.liveMarkets)} live markets). ` +
    `Watching ${int(S.watching)} markets: ${esc(per)}.${u.capped ? " Scan hit its page limit, so coverage may be partial." : ""}`;
}

/* The same swings as the feeds, as a table. Every row links the official API
 * response that produced the prices. */
function renderAlertTable() {
  const body = $("#alert-rows");
  if (!body) return;
  const list = [...S.alerts].reverse().slice(0, 120);
  if (!list.length) {
    body.innerHTML = emptyRow(9, "No swing of $0.10 or more recorded yet.");
    $("#alert-count").textContent = "0 rows";
    return;
  }
  $("#alert-count").textContent = `${list.length} of ${S.alerts.length} recorded`;
  body.innerHTML = list.map(a => {
    const w = S.watch.get(a.id) || {};
    const up = a.direction === "up";
    const srcs = [
      src(`${DEMO.rest}/markets/${a.ticker}`, "market"),
      src(`${DEMO.rest}/events/${a.eventTicker}`, "event")
    ];
    return `<tr>
      <td class="small nowrap">${hms(a.at)} UTC</td>
      <td><span class="tag">${esc(topicLabel(a.topic))}</span></td>
      <td class="small">${esc(a.title || a.ticker)}<div class="small muted mono">${esc(a.ticker)}</div></td>
      <td class="num">${px(a.from)}</td>
      <td class="num">${px(a.to)}</td>
      <td class="num ${up ? "pos" : "neg"}">${a.delta > 0 ? "+" : "\u2212"}$${Math.abs(a.delta).toFixed(2)}</td>
      <td class="small">${esc(a.basis || "between two polls")}</td>
      <td class="num">${a.screen ? `${a.screen.score}/${a.screen.max}` : `<span class="unv">n/a</span>`}</td>
      <td>${w.pass === undefined ? `<span class="unv">n/a</span>`
        : w.pass ? `<span class="tag watch">pass</span>`
        : `<span class="tag warn">fails ${esc((w.checks || []).filter(c => !c.ok).length)} rule(s)</span>`}</td>
      <td class="small nowrap">${srcs.join(" ")}</td>
    </tr>`;
  }).join("");
}

function renderSim() {
  const rows = summarize(S.trades);
  const body = $("#sim-body");
  body.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.label)}</td>
      <td><span class="tag ${r.scope === "watch" ? "watch" : ""}">${r.scope === "watch" ? "High-ROI watch" : "All alerts"}</span></td>
      <td class="num">${int(r.trades)}</td>
      <td class="num">${int(r.open)}</td>
      <td class="num">${int(r.resolved)}</td>
      <td class="num">${r.winRate === null ? `<span class="unv">n/a</span>` : pctOf(r.winRate)}</td>
      <td class="num">${signedPx(r.realized, 4)}</td>
      <td class="num">${pctOf(r.roi)}</td>
      <td class="num">${signedPx(r.unrealized, 4)}${r.marked ? ` <span class="small muted">(${r.marked} marked)</span>` : ""}</td>
    </tr>`).join("");
  const skips = Object.entries(S.skipped).sort((a, b) => b[1] - a[1]);
  $("#sim-skips").textContent = skips.length
    ? "Entries not taken: " + skips.map(([k, v]) => `${v} × ${k}`).join("; ")
    : "";
}

function renderTrades() {
  const body = $("#trade-body");
  const list = [...S.trades].sort((a, b) => b.openedAt - a.openedAt).slice(0, 100);
  if (!list.length) { body.innerHTML = emptyRow(9, "No simulated trades yet. Trades open automatically on each alert."); return; }
  const label = Object.fromEntries(STRATEGIES.map(s => [s.key, s.label]));
  body.innerHTML = list.map(t => {
    const resolved = t.status === "resolved";
    const statusTag = resolved
      ? `<span class="tag ${t.result === "yes" ? "yes" : "no"}">resolved ${esc(t.result)}</span>`
      : `<span class="tag">open</span>`;
    const markCell = resolved ? `payout $${t.payout.toFixed(2)}` : (t.mark === null || t.mark === undefined ? `<span class="unv">no bid</span>` : px(t.mark));
    const pnl = resolved ? t.pnl : t.unrealized;
    return `
      <tr>
        <td>${hms(t.openedAt)}</td>
        <td>${esc(topicLabel(t.topic))}</td>
        <td>${esc(t.title || t.ticker)}<div class="small muted">${src(`${DEMO.rest}/markets/${t.ticker}`, t.ticker)}</div></td>
        <td>${esc(label[t.strategy] || t.strategy)}</td>
        <td>${t.side.toUpperCase()}</td>
        <td class="num">${px(t.entry)}</td>
        <td>${statusTag}</td>
        <td class="num">${markCell}</td>
        <td class="num">${signedPx(pnl, 4)}${resolved ? "" : ` <span class="small muted">(open)</span>`}</td>
      </tr>`;
  }).join("");
}

function renderAll() {
  renderStatus();
  renderUniverseNote();
  renderFeeds();
  renderAlertTable();
  renderSim();
  renderTrades();
}

/* ---------------------------------------------------------------- controls */

$("#interval").addEventListener("change", e => {
  S.intervalS = Number(e.target.value);
  S.backoffS = null;
  if (!S.paused) schedule();
  renderStatus();
});

$("#pause").addEventListener("click", () => {
  S.paused = !S.paused;
  const btn = $("#pause");
  btn.textContent = S.paused ? "Resume" : "Pause";
  btn.setAttribute("aria-pressed", String(S.paused));
  if (S.paused) { clearTimeout(S.timer); renderStatus(); }
  else { tick(); }
});

$("#topic").addEventListener("change", e => {
  S.topic = e.target.value;
  renderFeeds();
});

$("#reset-sim").addEventListener("click", () => {
  if (!confirm("Delete all simulated trades stored in this browser? This cannot be undone.")) return;
  S.trades = [];
  S.skipped = {};
  saveTrades();
  renderSim();
  renderTrades();
});

renderAll();
tick();

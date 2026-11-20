/* KalshiDash2 — category page controller.
 *
 * One implementation drives all five topic pages; each page passes its topic key
 * in `data-topic` on <body>. Contains the live board, the price chart with the
 * requested time windows, and the liquidity (order-book depth) view.
 */
import { mountChrome, esc, money, money4, int, dt, pill, $, emptyRow, src, lineChart } from "./ui.js";
import { DEMO, TOPICS, WINDOWS, SOURCES, CANDLE } from "./config.js";
import {
  api, discoverTopic, rankEvents, num, getOrderbook, fetchCandles,
  bucketCandles, LiveSampler, Watchlist
} from "./market.js";
import { deriveQuote } from "./kalshi.js";
import { detectJumps, jumpMarkers } from "./jumps.js";

const topicKey = document.body.dataset.topic;
const topic = TOPICS.find(t => t.key === topicKey);
if (!topic) throw new Error("Unknown topic: " + topicKey);

/* Category pages live one level below the site root. */
const prefix = "../";

mountChrome({ page: `categories/${topicKey}.html`, title: topic.label, depth: 1 });
document.title = `${topic.label} — KalshiDash2`;

$("#topic-title").textContent = topic.label;
$("#topic-blurb").textContent = topic.blurb;
$("#topic-note").innerHTML = `${esc(topic.note)} ${src(SOURCES.events, "GET /events")} ${src(SOURCES.markets, "GET /markets")}`;
if (topic.caveat) {
  $("#topic-caveat").innerHTML = `<div class="callout warn"><h3>Coverage caveat</h3><p style="margin:0">${esc(topic.caveat)}</p></div>`;
}

const state = {
  events: [],
  markets: [],
  mode: "money",
  selected: null,
  candles: null,
  live: null,
  samplerTimer: null,
  lastJumps: []
};

/* ------------------------------------------------------------------ board */
async function loadBoard() {
  pill($("#board-status"), "warn", "loading…");
  try {
    const res = await discoverTopic(topicKey, { includeSettled: false });
    state.events = res.events;
    state.markets = res.markets;
    pill($("#board-status"), "live", `live · ${res.events.length} events / ${res.markets.length} markets`);
    renderBoard();
    renderStats(res);
    if (!state.selected && state.markets.length) selectMarket(preferredMarket(state.markets));
  } catch (e) {
    pill($("#board-status"), "err", e.message);
    $("#board-body").innerHTML = emptyRow(9, "Could not load events: " + e.message);
  }
}

/* Pick a default market to chart: the one with the most open interest, and a
 * trade price, so the chart has something real to draw. */
function preferredMarket(markets) {
  const scored = markets
    .filter(m => ["active", "open"].includes(m.status))
    .map(m => ({ m, oi: num(m.open_interest_fp) || 0, px: num(m.last_price_dollars) }));
  const withPrice = scored.filter(x => x.px !== null);
  const pool = withPrice.length ? withPrice : scored;
  pool.sort((a, b) => b.oi - a.oi);
  return (pool[0]?.m) || markets[0];
}

function renderStats(res) {
  const ranked = rankEvents(res.events, "money");
  const totalMoney = ranked.reduce((a, r) => a + (r.money || 0), 0);
  const oi = ranked.reduce((a, r) => a + r.oi, 0);
  const open = res.markets.filter(m => ["active", "open"].includes(m.status));
  const liq = open.reduce((a, m) => a + (num(m.yes_bid_size_fp) || 0) + (num(m.no_bid_size_fp) || 0), 0);
  $("#cat-stats").innerHTML = [
    { k: "Money traded", v: money(totalMoney), m: "Σ volume × last price" },
    { k: "Open events", v: int(res.events.length), m: "matching this topic" },
    { k: "Open interest", v: int(oi), m: "contracts across markets" },
    { k: "Resting size", v: int(liq), m: "best-level contract size" }
  ].map(s => `<div class="stat"><div class="k">${esc(s.k)}</div><div class="v">${s.v}</div><div class="m">${esc(s.m)}</div></div>`).join("");
}

function renderBoard() {
  const rows = state.events.map(ev => ({ ev, r: rankEvents([ev], state.mode)[0] }));
  const cmp = state.mode === "oi" ? (a, b) => b.r.oi - a.r.oi
    : state.mode === "volume" ? (a, b) => b.r.volume - a.r.volume
    : (a, b) => b.r.money - a.r.money;
  rows.sort(cmp);

  if (!rows.length) {
    $("#board-body").innerHTML = emptyRow(9,
      `The live API returned no ${topic.label} events in this scan. Nothing is invented to fill the table.`);
    return;
  }

  $("#board-body").innerHTML = rows.map(({ ev, r }) => {
    const top = [...(ev.markets || [])].sort((a, b) => (num(b.volume_fp) || 0) - (num(a.volume_fp) || 0))[0];
    const result = r.result;
    const tag = result === "yes" ? `<span class="tag yes">yes</span>`
      : result === "no" ? `<span class="tag no">no</span>`
      : result === "mixed" ? `<span class="tag warn">mixed</span>`
      : `<span class="muted small">open</span>`;
    return `<tr>
      <td><a href="../event.html?ticker=${encodeURIComponent(ev.event_ticker)}">${esc(ev.title || ev.event_ticker)}</a>
        <div class="mono muted small">${esc(ev.event_ticker)}</div></td>
      <td class="num">${int(r.marketCount)}</td>
      <td class="num">${money(r.money)}</td>
      <td class="num">${int(r.oi)}</td>
      <td class="num">${int(r.volume)}</td>
      <td class="nowrap small">${dt(r.closeTime)}</td>
      <td>${tag}</td>
      <td class="nowrap">
        <button class="secondary tiny" data-chart="${esc(top?.ticker || "")}">Chart</button>
        <button class="secondary tiny" data-watch="${esc(top?.ticker || "")}">Track</button>
      </td>
      <td><a href="${esc(`${DEMO.rest}/events/${encodeURIComponent(ev.event_ticker)}?with_nested_markets=true`)}" target="_blank" rel="noopener noreferrer">API response ↗</a></td>
    </tr>`;
  }).join("");
}

$("#board-body").addEventListener("click", async (e) => {
  const chartBtn = e.target.closest("[data-chart]");
  const watchBtn = e.target.closest("[data-watch]");
  if (chartBtn?.dataset.chart) {
    const m = state.markets.find(x => x.ticker === chartBtn.dataset.chart);
    if (m) { selectMarket(m); $("#chart-card").scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  if (watchBtn?.dataset.watch) {
    const m = state.markets.find(x => x.ticker === watchBtn.dataset.watch);
    if (m) { Watchlist.add(m, topicKey, m._event_title); watchBtn.textContent = "Tracked ✓"; }
  }
});

$("#board-mode").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  state.mode = b.dataset.mode;
  $("#board-mode").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  renderBoard();
});

/* ------------------------------------------------------------------ chart */
async function selectMarket(market) {
  state.selected = market;
  state.candles = null;
  stopLive();
  $("#chart-ticker").value = market.ticker;
  $("#chart-meta").innerHTML = `
    <strong>${esc(market.title || market.ticker)}</strong>
    <span class="mono muted">${esc(market.ticker)}</span>
    <span class="pill idle">${esc(market.status || "")}</span>`;
  await drawWindow();
  loadBook(market.ticker);
}

function currentWindow() {
  const key = $("#window").value;
  return WINDOWS.find(w => w.key === key) || WINDOWS[3];
}

async function drawWindow() {
  const market = state.selected;
  if (!market) return;
  const win = currentWindow();
  stopLive();
  pill($("#chart-status"), "warn", "loading…");

  if (win.granularity === "live" || (win.seconds <= 300)) {
    // Seconds-scale: accumulate live samples. No seconds-resolution history exists.
    startLive(win);
  } else {
    try {
      // 1-minute candles for windows up to 24h; 1-hour candles beyond.
      const interval = win.seconds > 86400 ? 60 : 1;
      const res = await fetchCandles(market, { seconds: win.seconds, interval });
      let pts = res.points;
      // Keep the drawn point count sane by bucketing coarse windows.
      let bucket = 0;
      if (pts.length > 900) bucket = Math.ceil(win.seconds / 900);
      if (interval === 1 && bucket > 60) pts = bucketCandles(pts, bucket);
      state.candles = res;
      renderChart([
        { key: "close", label: "Trade close price", color: "#0a6b45", kind: "candle", points: pts }
      ], win, res);
      const traded = pts.filter(p => p.y !== null).length;
      pill($("#chart-status"), "live", `${traded} priced periods`);
      $("#chart-src").innerHTML = `
        Official candlesticks · <code>period_interval=${interval}</code> minute(s) ·
        ${int(res.rawCount)} raw periods returned · series <code>${esc(res.series)}</code> ·
        ${src(res.source, "GET candlesticks")} ${src(SOURCES.candles, "endpoint docs")}`;
      if (!traded) {
        $("#chart-empty").innerHTML = `<div class="callout warn" style="margin:12px 0 0">
          <h3>No trades in this window</h3>
          <p style="margin:0">The API returned ${int(res.rawCount)} candle periods but none carried a trade
          price. Periods with no trades have a null price — they are gaps, not $0.00. Try a longer window or a
          market with resting orders.</p></div>`;
      } else {
        $("#chart-empty").innerHTML = "";
      }
    } catch (e) {
      pill($("#chart-status"), "err", e.message);
      $("#chart-src").innerHTML = `Candlestick request failed: ${esc(e.message)}. ${src(SOURCES.candles, "docs")}`;
    }
  }
}

let sampler = null;
function startLive(win) {
  const market = state.selected;
  sampler = new LiveSampler({
    ticker: market.ticker,
    intervalMs: 2000,
    maxAgeSeconds: 900,
    onPoint: () => {
      const pts = sampler.window(win.seconds);
      const since = sampler.points[0]?.t ? sampler.points[0].t : Date.now();
      renderChart([
        { key: "live", label: "Last trade (live samples)", color: "#0a6b45", kind: "live", points: pts }
      ], win, null, { xDomain: [since, Date.now()] });
    },
    onState: (st) => {
      if (st.mode === "poll") {
        pill($("#chart-status"), st.ok === false ? "err" : "live",
          st.ok === false ? st.error : `sampling every ${st.intervalMs}ms`);
      }
    }
  });
  sampler.start();
  $("#chart-src").innerHTML = `
    <strong>Accumulated live samples</strong> — Kalshi publishes no seconds-resolution history:
    the candlestick endpoint accepts only
    <code>period_interval</code> ${CANDLE.intervals.join(" / ")} minutes, and REST quotes are cached
    for a few seconds. Points are stamped when this page read them (every 2s), so the line starts empty
    and fills as the tab stays open. ${src(SOURCES.candles, "candlestick limits")} ${src(SOURCES.rateLimits, "rate limits")}`;
  $("#chart-empty").innerHTML = "";
}

function stopLive() {
  if (sampler) { sampler.stop(); sampler = null; }
}

function renderChart(series, win, res, extra = {}) {
  const canvas = $("#price-chart");
  /* Sharp moves (≥ $0.10 between plotted points) get chart markers and a
   * jump log with links. Detection is assets/js/jumps.js; the threshold is
   * the same $0.10 the live alert feeds use. */
  const jumps = detectJumps(series.flatMap(s => s.points).slice().sort((a, b) => a.t - b.t));
  lineChart(canvas, series, { emptyText: "Waiting for the first sample…", ...extra, markers: jumpMarkers(jumps) });
  const legend = series.map(s => `<span><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
  $("#chart-legend").innerHTML = legend + `<span class="muted">window: ${esc(win.label)} · ${esc(win.note)}</span>` +
    (jumps.length ? ` <span class="muted">· ▲▼ markers = moves ≥ $0.10</span>` : "");
  renderJumpLog(jumps);
}

/* ---------------- sharp-move (jump) log ----------------
 * One row per ≥ $0.10 move between plotted points, newest first, each row
 * linking: the event page, the exact API call behind the chart, the event's
 * settlement sources (the websites the market settles from — not asserted
 * causes), and a clearly-labelled coverage search link. */
const eventSourceCache = new Map(); // event ticker → "loading" | "error" | {sources, title}

async function loadEventSources(eventTicker) {
  if (!eventTicker || eventSourceCache.has(eventTicker)) return;
  eventSourceCache.set(eventTicker, "loading");
  try {
    const j = await api.get(`/events/${encodeURIComponent(eventTicker)}`);
    const e = j.event || j;
    const sources = (Array.isArray(e.settlement_sources) ? e.settlement_sources : [])
      .filter(s => s && typeof s.url === "string" && /^https:\/\//.test(s.url));
    eventSourceCache.set(eventTicker, { sources, title: e.title || "" });
    const cur = state.selected && (state.selected._event_ticker || state.selected.event_ticker);
    if (cur === eventTicker) renderJumpLog(state.lastJumps || []);
  } catch {
    eventSourceCache.set(eventTicker, "error");
  }
}

function renderJumpLog(jumps) {
  state.lastJumps = jumps;
  const el = $("#jump-log");
  if (!el) return;
  const m = state.selected;
  const ticker = m ? m.ticker : "";
  const eventTicker = m ? (m._event_ticker || m.event_ticker || "") : "";
  const head = `
    <h3 style="margin:14px 0 4px">Sharp moves ≥ $0.10 in this window</h3>
    <p class="sub" style="margin:0 0 8px">
      Every move of <strong>$0.10 or more</strong> per contract between two plotted points — the same
      threshold as the <a href="${prefix}alerts.html">live alert feeds</a>.
      Markers on the chart point at these rows. Links show the event, the API data behind the chart,
      and the sources the market settles from. A settlement source is <em>not</em> an attributed cause
      of the move; the search link is a search, not evidence.
    </p>`;
  if (!jumps.length) {
    el.innerHTML = head + `<p class="small muted" style="margin:0">No move of $0.10 or more between plotted points in this window.</p>`;
    return;
  }
  const ev = eventSourceCache.get(eventTicker);
  let sources;
  if (ev === "loading" || ev === undefined) {
    sources = `<span class="unv">loading settlement sources…</span>`;
    if (ev === undefined) loadEventSources(eventTicker);
  } else if (ev === "error") {
    sources = `<span class="unv">event record could not be read</span>`;
  } else {
    sources = ev.sources.length
      ? ev.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name || "settlement source")} ↗</a>`).join(" · ")
      : `<span class="unv">none listed on the event record</span>`;
  }
  const searchQ = encodeURIComponent((m && (m.title || m.ticker)) || ticker || "Kalshi");
  const rows = jumps.slice().reverse().map(j => {
    const up = j.direction === "up";
    return `<tr>
      <td class="nowrap small">${new Date(j.t).toISOString().slice(11, 19)} UTC</td>
      <td><span class="tag ${up ? "yes" : "no"}">${up ? "▲ up" : "▼ down"} ${up ? "+" : "−"}$${Math.abs(j.delta).toFixed(2)}</span></td>
      <td class="num">$${j.from.toFixed(2)} → $${j.to.toFixed(2)}</td>
      <td class="num">${j.volume === null ? `<span class="unv">n/a</span>` : esc(String(Math.round(j.volume)))}</td>
      <td class="num">${j.intraRange === null ? `<span class="unv">n/a</span>` : "$" + j.intraRange.toFixed(2)}</td>
      <td class="small">
        <a href="${prefix}event.html?ticker=${encodeURIComponent(eventTicker)}">event page</a>
        · <a href="${DEMO.rest}/markets/${encodeURIComponent(ticker)}" target="_blank" rel="noopener noreferrer">GET /markets/${esc(ticker)} ↗</a>
        · ${sources}
        · <a href="https://news.google.com/search?q=${searchQ}" target="_blank" rel="noopener noreferrer">search coverage ↗</a>
        <span class="muted">(search link — not an attributed cause)</span>
      </td>
    </tr>`;
  }).join("");
  el.innerHTML = head + `
    <div class="table-wrap"><table>
      <thead><tr><th>Time</th><th>Move</th><th class="num">From → to</th>
      <th class="num">Volume (period)</th><th class="num">High − low (period)</th><th>Links</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="table-note">Volume and high−low are the candlestick period's own fields
      (<a href="${SOURCES.candles}" target="_blank" rel="noopener noreferrer">Get Market Candlesticks ↗</a>);
      they read <span class="unv">n/a</span> on live-sample windows, which have no period aggregation.</div>
    </div>`;
}

$("#window").addEventListener("change", drawWindow);
$("#chart-refresh").addEventListener("click", drawWindow);
$("#chart-ticker-apply").addEventListener("click", async () => {
  const t = $("#chart-ticker").value.trim();
  if (!t) return;
  try {
    const j = await api.get(`/markets/${encodeURIComponent(t)}`);
    selectMarket(j.market || j);
  } catch (e) {
    pill($("#chart-status"), "err", e.message);
  }
});
window.addEventListener("resize", () => {
  if (state.selected) drawWindowDebounced();
});
let resizeT = null;
function drawWindowDebounced() {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    if (state.candles) {
      renderChart([{ key: "close", label: "Trade close price", color: "#0a6b45", kind: "candle", points: state.candles.points }],
        currentWindow(), state.candles);
    }
  }, 150);
}

/* ------------------------------------------------------------- liquidity */
async function loadBook(ticker) {
  if (!ticker) return;
  pill($("#book-status"), "warn", "loading…");
  try {
    const book = await getOrderbook(ticker, 20);
    const q = deriveQuote(book);
    const orderbookUrl = `${DEMO.rest}/markets/${encodeURIComponent(ticker)}/orderbook?depth=20`;
    const row = (l, kind) => `<tr><td class="num">${money4(l.p)}</td>
      <td class="num">${int(l.c)}</td>
      <td class="num">${money(l.p * l.c)}</td>
      <td><span class="tag ${kind === "yes" ? "yes" : "no"}">${kind === "yes" ? "YES bid" : "NO bid"}</span></td>
      <td><a href="${esc(orderbookUrl)}" target="_blank" rel="noopener noreferrer">API response ↗</a></td></tr>`;

    const yesRows = [...q.yes].sort((a, b) => b.p - a.p);
    const noRows = [...q.no].sort((a, b) => b.p - a.p);
    $("#yes-book").innerHTML = yesRows.length ? yesRows.map(l => row(l, "yes")).join("") : emptyRow(5, "No resting YES bids.");
    $("#no-book").innerHTML = noRows.length ? noRows.map(l => row(l, "no")).join("") : emptyRow(5, "No resting NO bids.");

    const yesDepth = yesRows.reduce((a, l) => a + l.c, 0);
    const yesNotional = yesRows.reduce((a, l) => a + l.p * l.c, 0);
    $("#book-summary").innerHTML = `
      <div class="grid cols-4">
        <div class="stat"><div class="k">Best YES bid</div><div class="v">${money4(q.bestYesBid)}</div><div class="m">highest resting YES bid</div></div>
        <div class="stat"><div class="k">Implied YES ask</div><div class="v">${money4(q.bestYesAsk)}</div><div class="m">1 − best NO bid</div></div>
        <div class="stat"><div class="k">YES spread</div><div class="v">${q.yesSpread === null ? `<span class="unv">n/a</span>` : (q.yesSpread * 100).toFixed(1) + "¢"}</div><div class="m">ask − bid</div></div>
        <div class="stat"><div class="k">Contracts for sale</div><div class="v">${int(yesDepth)}</div><div class="m">YES bid depth @ ${money(yesNotional)}</div></div>
      </div>`;
    pill($("#book-status"), "live", `live · ${yesRows.length + noRows.length} levels`);
    $("#book-src").innerHTML = `Order book returns <strong>bids only</strong>; a NO bid at <em>y</em> implies a
      YES ask at <em>1 − y</em>. ${src(SOURCES.orderbook, "order-book docs")}`;
  } catch (e) {
    pill($("#book-status"), "err", e.message);
    $("#yes-book").innerHTML = emptyRow(5, "Order book unavailable.");
    $("#no-book").innerHTML = emptyRow(5, "Order book unavailable.");
  }
}
$("#book-refresh").addEventListener("click", () => loadBook(state.selected?.ticker));

/* ------------------------------------------------------------------ init */
loadBoard();
setInterval(() => {
  if (document.visibilityState === "visible" && !document.hidden) {
    if (state.selected) loadBook(state.selected.ticker);
  }
}, 30000);

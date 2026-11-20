/* KalshiDash2 — category page controller.
 *
 * One implementation drives all five topic pages; each page passes its topic key
 * in `data-topic` on <body>. Contains the live board, the price chart with the
 * requested time windows, and the liquidity (order-book depth) view.
 */
import { mountChrome, esc, money, money4, int, dt, pill, $, emptyRow, src, lineChart } from "./ui.js";
import { TOPICS, WINDOWS, SOURCES, CANDLE } from "./config.js";
import {
  api, discoverTopic, rankEvents, num, getOrderbook, fetchCandles,
  bucketCandles, LiveSampler, Watchlist
} from "./market.js";
import { deriveQuote } from "./kalshi.js";

const topicKey = document.body.dataset.topic;
const topic = TOPICS.find(t => t.key === topicKey);
if (!topic) throw new Error("Unknown topic: " + topicKey);

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
  samplerTimer: null
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
    $("#board-body").innerHTML = emptyRow(8, "Could not load events: " + e.message);
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
    $("#board-body").innerHTML = emptyRow(8,
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
  lineChart(canvas, series, { emptyText: "Waiting for the first sample…", ...extra });
  const legend = series.map(s => `<span><span class="sw" style="background:${s.color}"></span>${esc(s.label)}</span>`).join("");
  $("#chart-legend").innerHTML = legend + `<span class="muted">window: ${esc(win.label)} · ${esc(win.note)}</span>`;
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
    const row = (l, kind) => `<tr><td class="num">${money4(l.p)}</td>
      <td class="num">${int(l.c)}</td>
      <td class="num">${money(l.p * l.c)}</td>
      <td><span class="tag ${kind === "yes" ? "yes" : "no"}">${kind === "yes" ? "YES bid" : "NO bid"}</span></td></tr>`;

    const yesRows = [...q.yes].sort((a, b) => b.p - a.p);
    const noRows = [...q.no].sort((a, b) => b.p - a.p);
    $("#yes-book").innerHTML = yesRows.length ? yesRows.map(l => row(l, "yes")).join("") : emptyRow(4, "No resting YES bids.");
    $("#no-book").innerHTML = noRows.length ? noRows.map(l => row(l, "no")).join("") : emptyRow(4, "No resting NO bids.");

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
    $("#yes-book").innerHTML = emptyRow(4, "Order book unavailable.");
    $("#no-book").innerHTML = emptyRow(4, "Order book unavailable.");
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

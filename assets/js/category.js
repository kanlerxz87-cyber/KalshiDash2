/* KalshiDash2 — category page controller.
 *
 * One implementation drives all five topic pages; each page passes its topic key
 * in `data-topic` on <body>. Contains the live board, the price chart with the
 * requested time windows, and the liquidity (order-book depth) view.
 */
import { mountChrome, esc, money, money4, int, dt, pill, $, emptyRow, src, lineChart } from "./ui.js";
import { DEMO, TOPICS, WINDOWS, SOURCES, CANDLE, ALERT } from "./config.js";
import {
  api, discoverTopic, rankEvents, num, getOrderbook, fetchCandles,
  bucketCandles, LiveSampler, Watchlist, getEvent, eventContext,
  detectJumps, jumpMarkers
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
  jumps: [],
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
    state.scan = res;
    pill($("#board-status"), "live", `live · ${res.events.length} events / ${res.markets.length} markets`);
    renderBoard();
    renderStats(res);
    renderCoverage(res);
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
  /* Resting size at the touch, summed over open markets.
   *
   * Only `yes_bid_size_fp` and `yes_ask_size_fp` exist on a market object.
   * An earlier version also added a `no_bid_size_fp` field that the demo API
   * does not return for any market (it is not in the Get Market schema either),
   * so that term was always 0 and the figure read low. A NO bid at y is an
   * implied YES ask at 1 − y, so the NO side's size at the touch is already
   * `yes_ask_size_fp`; the two documented fields are the complete measure.
   * (https://docs.kalshi.com/api-reference/market/get-market) */
  const touch = open.reduce((a, m) => a + (num(m.yes_bid_size_fp) || 0) + (num(m.yes_ask_size_fp) || 0), 0);
  $("#cat-stats").innerHTML = [
    { k: "Money traded", v: money(totalMoney), m: "Σ volume × last price" },
    { k: "Open events", v: int(res.events.length), m: "matching this topic" },
    { k: "Open interest", v: int(oi), m: "contracts across markets" },
    { k: "Resting size at touch", v: int(touch), m: "Σ yes_bid_size_fp + yes_ask_size_fp" }
  ].map(s => `<div class="stat"><div class="k">${esc(s.k)}</div><div class="v">${s.v}</div><div class="m">${esc(s.m)}</div></div>`).join("");
}

/* State the scan that was actually performed, so an empty board can never be
 * mistaken for "this topic has no markets". The counts come from this request,
 * not from a hard-coded number. */
function renderCoverage(res) {
  const el = $("#topic-caveat");
  if (!el) return;
  if (!res) { el.innerHTML = ""; return; }
  const total = res.perStatus.open ?? 0;
  const parts = Object.entries(res.perStatus || {})
    .map(([status, n]) => `${int(n)} ${esc(status)}`).join(" · ");
  const cut = Object.entries(res.capped || {}).filter(([, v]) => v).map(([k]) => esc(k));
  const trunc = cut.length
    ? `<p class="small" style="margin:6px 0 0">The <strong>${cut.join(", ")}</strong> list was longer than the page budget for this scan; events beyond it were not read. This is a scan limit, not an empty topic.</p>`
    : "";
  if (res.events.length) {
    el.innerHTML = `<p class="small muted" style="margin:0 0 6px">
      This scan read ${int(total)} open event(s) from <code>GET /events?status=open&amp;with_nested_markets=true</code>
      (${parts}) and matched ${int(res.events.length)} to ${esc(res.topic.label)}.</p>${trunc}`;
    return;
  }
  el.innerHTML = `<div class="callout warn"><h3>No ${esc(res.topic.label)} events in this scan</h3>
    <p style="margin:0 0 4px">The scan returned ${int(total)} open event(s) (${parts}) and none matched this topic's
    documented rule. That is a result of this scan, not a claim that the topic is empty on Kalshi —
    the topic may fill later in the day.</p>${trunc}</div>`;
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
    /* A multivariate ("combo") event is labelled as one and its topic is shown
     * with the legs it was derived from — the classification basis is not left
     * to the reader's imagination. */
    const combo = ev._combo && ev._mve
      ? `<span class="tag warn" title="Multivariate combo event — topic derived from its selected legs">combo</span>
         <div class="small muted">legs: ${ev._mve.bases.map(b => `${esc(b.topic)} (${esc(b.event_ticker)})`).join(" · ")}${ev._mve.mixed ? " — spans more than one topic" : ""}</div>`
      : "";
    return `<tr>
      <td><a href="../event.html?ticker=${encodeURIComponent(ev.event_ticker)}">${esc(ev.title || ev.event_ticker)}</a>
        <div class="mono muted small">${esc(ev.event_ticker)}</div>${combo}</td>
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
  const jEl = jumpContainer();
  if (jEl) jEl.innerHTML = `<p class="small muted" style="margin:10px 0 0">Loading…</p>`;

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
      // ≥ $0.10 swings inside the official candle series, marked on the chart.
      // jumpMarkers() converts to the {t, y, dir} shape ui.js lineChart draws;
      // passing the raw jumps (which carry `to`, not `y`) drew the vertical
      // line but never the dot.
      const jumps = detectJumps(pts, { threshold: ALERT.defaultThreshold });
      state.jumps = jumps;
      renderChart([
        { key: "close", label: "Trade close price", color: "#0a6b45", kind: "candle", points: pts }
      ], win, res, { markers: jumpMarkers(jumps) });
      const traded = pts.filter(p => p.y !== null).length;
      pill($("#chart-status"), "live", `${traded} priced periods`);
      $("#chart-src").innerHTML = `
        Official candlesticks · <code>period_interval=${interval}</code> minute(s) ·
        ${int(res.rawCount)} raw periods returned · series <code>${esc(res.series)}</code> ·
        ${src(res.source, "GET candlesticks")} ${src(SOURCES.candles, "endpoint docs")}`;
      renderJumps(market, jumps, res);
      if (!traded) {
        /* A market can legitimately have candles with no trade price (no trade
         * in the window). Rather than leave an empty chart, look for another
         * market in this topic that does have a priced candle series and offer
         * it — the board already ranks markets by money traded, so the reader
         * is pointed at one that is actually trading. */
        const alt = await pricedAlternative(market, state.markets);
        $("#chart-empty").innerHTML = `<div class="callout warn" style="margin:12px 0 0">
          <h3>No trades in this window on ${esc(market.ticker)}</h3>
          <p style="margin:0 0 6px">The API returned ${int(res.rawCount)} candle period(s) but none carried a trade
          price. Periods with no trades have a null price — they are gaps, not $0.00.</p>
          ${alt
            ? `<p style="margin:0"><button class="secondary tiny" id="chart-alt">Chart ${esc(alt.title || alt.ticker)} instead</button>
               <span class="small muted">— that market returned priced candles for this window.</span></p>`
            : `<p style="margin:0" class="small muted">No other ${esc(topic.label)} market in this scan returned priced candles for this window either.</p>`}</div>`;
        const btn = $("#chart-alt");
        if (btn && alt) btn.onclick = () => selectMarket(alt);
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
  const el = jumpContainer();
  if (el) {
    el.innerHTML = `<p class="small muted" style="margin:10px 0 0">
      Jump markers are drawn on official candle windows. This view is accumulated live samples, so there is
      no candle history to mark yet — switch to a 1-hour or longer window.</p>`;
  }
}

/* ------------------------------------------------------------------ jumps */
/* The ≥$0.10 moves found inside the official candle series, listed with the
 * event's own settlement sources so a reader can go straight to the websites
 * that decide the market. */
function jumpContainer() {
  let el = document.querySelector("#chart-jumps");
  if (el) return el;
  el = document.createElement("div");
  el.id = "chart-jumps";
  const anchor = $("#chart-empty");
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor.nextSibling);
  else $("#chart-card").appendChild(el);
  return el;
}

async function renderJumps(market, jumps, res) {
  const el = jumpContainer();
  if (!jumps || !jumps.length) {
    el.innerHTML = `<p class="small muted" style="margin:10px 0 0">
      No move of $${ALERT.defaultThreshold.toFixed(2)} or more inside this window. The dotted markers on the
      chart appear only when the official candle series contains one.</p>`;
    return;
  }
  const rows = jumps.slice().reverse().map(j => `<tr>
    <td class="small nowrap">${dt(new Date(j.t).toISOString())}</td>
    <td class="num">$${j.from.toFixed(2)}</td>
    <td class="num">$${j.to.toFixed(2)}</td>
    <td class="num" style="color:${j.dir === "up" ? "var(--ok)" : "var(--bad)"}">${j.delta > 0 ? "+" : ""}${j.delta.toFixed(2)}</td>
    <td class="small nowrap">
      <a class="src-link" href="https://external-api.demo.kalshi.co/trade-api/v2/markets/${encodeURIComponent(market.ticker)}" target="_blank" rel="noopener noreferrer">market ↗</a>
    </td>
  </tr>`).join("");

  el.innerHTML = `<div class="table-wrap" style="margin-top:10px">
    <table>
      <thead><tr><th>Time</th><th class="num">From</th><th class="num">To</th><th class="num">Δ</th><th>Official source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="table-note">
      ${int(jumps.length)} move(s) of $${ALERT.defaultThreshold.toFixed(2)} or more between consecutive
      official candle closes in this window. ${src(res.source, "candles ↗")}
      ${src(SOURCES.candles, "endpoint docs")}
    </div>
  </div>
  <div id="chart-sources" class="small muted" style="margin:8px 0 0">Loading settlement sources…</div>`;

  /* Settlement sources: the official websites Kalshi lists for determining
   * this market's outcome. */
  try {
    const event = await getEvent(market.event_ticker);
    const ctx = eventContext(event);
    const box = document.querySelector("#chart-sources");
    if (!box) return;
    if (!ctx.sources.length) {
      box.innerHTML = `This event returned no <code>settlement_sources</code> entry. ${src(SOURCES.events, "events API")}`;
      return;
    }
    box.innerHTML = `<strong>Where this market is decided</strong> — Kalshi's settlement sources for this event: ` +
      ctx.sources.slice(0, 10).map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.name || s.url)} ↗</a>`).join(" · ") +
      `. ${src(SOURCES.events, "events API")}`;
  } catch (e) {
    const box = document.querySelector("#chart-sources");
    if (box) box.innerHTML = `Settlement sources unavailable: ${esc(e.message)}.`;
  }
}

function stopLive() {
  if (sampler) { sampler.stop(); sampler = null; }
}

/* Find a market in the current topic whose official candles carry a trade
 * price, so an empty chart can offer a real alternative instead of a dead end.
 * Tries the highest-money markets first (state.markets arrives ranked) and
 * stops at the first hit; every miss is a real API call, so the list is capped. */
async function pricedAlternative(exclude, markets) {
  const candidates = (markets || [])
    .filter(m => m.ticker !== exclude.ticker)
    .filter(m => ["active", "open"].includes(m.status))
    .slice(0, 6);
  for (const m of candidates) {
    try {
      const res = await fetchCandles(m, { seconds: 3600, interval: 1 });
      if (res.points.some(p => p.y !== null && p.y !== undefined)) return m;
    } catch { /* try the next candidate */ }
  }
  return null;
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
        currentWindow(), state.candles, { markers: jumpMarkers(state.jumps || []) });
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

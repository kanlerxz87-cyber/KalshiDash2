/* KalshiDash2 — category page controller.
 *
 * One implementation drives all five topic pages; each page passes its topic key
 * in `data-topic` on <body>. Contains the live board, the price chart with the
 * requested time windows, and the liquidity (order-book depth) view.
 */
import { mountChrome, esc, money, money4, int, dec, dt, pill, $, emptyRow, src, lineChart } from "./ui.js";
import { DEMO, TOPICS, WINDOWS, SOURCES, CANDLE, ALERT } from "./config.js";
import {
  api, discoverTopic, rankEvents, num, getOrderbook, fetchCandles,
  bucketCandles, LiveSampler, Watchlist, getEvent, eventContext,
  detectJumps, jumpMarkers, seriesCategoriesFor
} from "./market.js";
import { deriveQuote, liquidityAtPrice } from "./kalshi.js";
import { rankByTradedDollars, LIMITS as TRADE_LIMITS, TRADES_SOURCE, TRADES_PATH as TRADE_PATH, missingNote } from "./dollar-volume.js";

/* Contract quantities (`count_fp`) are fixed-point strings with 0.01 granularity
 * (https://docs.kalshi.com/getting_started/fixed_point_migration). Keep whole
 * contract counts compact while preserving fractional hundredths without rounding. */
function qty(v) {
  const n = num(v);
  if (n === null) return int(null);
  return Math.abs(n - Math.round(n)) < 1e-9 ? int(Math.round(n)) : dec(n, 2);
}

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
  samplerTimer: null,
  quote: null,
  orderbookUrl: "",
  priceTouched: false
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
    { k: "Volume × price proxy", v: money(totalMoney), m: "Σ contracts × last YES price (proxy)" },
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
  const dupes = int(res.duplicateRows || 0);
  const dup = dupes && dupes !== "0"
    ? `<p class="small" style="margin:6px 0 0">${dupes} row(s) this scan had already read were counted once —
       the exchange re-sent a page, which its own reference says can happen when a cursor cannot be decoded
       (${src(SOURCES.markets, "Get Markets paging rules")}).</p>`
    : "";
  el.innerHTML = `${head(res, total, parts)}${trunc}${dup}${basisLine(res)}${sourcesLine(res)}`;
}

/* The scan sentence, kept apart from the additions below so each stays readable. */
function head(res, total, parts) {
  const lead = res.events.length
    ? `<p class="small muted" style="margin:0 0 6px">
      This scan read ${int(total)} open event(s) from <code>GET /events?status=open&amp;with_nested_markets=true</code>
      (${parts}) and matched ${int(res.events.length)} to ${esc(res.topic.label)}.</p>`
    : `<div class="callout warn"><h3>No ${esc(res.topic.label)} events in this scan</h3>
    <p style="margin:0 0 4px">The scan returned ${int(total)} open event(s) (${parts}) and none matched this topic's
    documented rule. That is a result of this scan, not a claim that the topic is empty on Kalshi —
    the topic may fill later in the day.</p></div>`;
  return lead;
}

/* Which field decided the topic, and how often the fallback had to be used.
 * Get Events marks the event object's own `category` deprecated in favour of
 * the series-level category, so a board that matched through the fallback has
 * to say so instead of implying series coverage it did not have. The counts are
 * this scan's, not a claim about the exchange. */
function basisLine(res) {
  const b = res.categoryBasis || {};
  const looked = (b.series || 0) + (b.event || 0) + (b.none || 0);
  if (!looked) return "";
  const cov = res.seriesCoverage || {};
  const capNote = cov.capped
    ? `, ${int(cov.capped)} series over the per-scan lookup cap (${int(cov.requested)} distinct series in this scan, ${int(cov.fetched)} looked up)`
    : cov.failed ? `, ${int(cov.failed)} series lookup(s) failed` : "";
  const fallback = b.event
    ? `${int(b.event)} from the <strong>deprecated event <code>category</code></strong>`
    : "none from the deprecated event field";
  const neither = b.none ? `, ${int(b.none)} with neither (excluded)` : "";
  return `<p class="small muted" style="margin:6px 0 0">Classification basis for this scan:
    ${int(b.series || 0)} event(s) matched on the <strong>series-level</strong> category, ${fallback}${neither}${capNote}.
    ${src(SOURCES.getSeries, "series-level category")} ${src(SOURCES.events, "deprecated event field")}</p>`;
}

/* The series record publishes the source its underlying number is read from
 * (GET /series/{ticker} → `settlement_sources`). That is where the figure comes
 * from — it is NOT presented as the cause of any price move, a claim the API
 * does not support (Flagged F14 / A4). */
function sourcesLine(res) {
  const seen = new Map();
  for (const ev of res.events || []) {
    const t = ev.series_ticker;
    if (!t || t.includes(",")) continue;
    const rec = seriesCategoriesFor(t);
    for (const s of (rec && rec.sources) || []) {
      if (!s.url || !/^https?:\/\//i.test(s.url)) continue;
      if (!seen.has(s.url)) seen.set(s.url, { ...s, series: t });
    }
  }
  if (!seen.size) return "";
  const list = [...seen.values()].slice(0, 6).map(s =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name || s.url)}</a>
     <span class="muted small">(${esc(s.series)})</span>`).join(" · ");
  return `<p class="small" style="margin:6px 0 0"><strong>Where this topic's underlying number is published</strong>
    — the <code>settlement_sources</code> Kalshi lists on the series record itself: ${list}.
    These are the reference sources for settlement, not a claimed cause of a price move.
    ${src(SOURCES.getSeries, "GET /series")}</p>`;
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
    /* `result` is the exchange's literal value (yes / no / scalar / blank).
     * A non-binary settlement is shown as itself — never coerced to "no" and
     * never hidden behind the "open" label. */
    const tag = result === "yes" ? `<span class="tag yes">yes</span>`
      : result === "no" ? `<span class="tag no">no</span>`
      : result === "mixed" ? `<span class="tag warn">mixed</span>`
      : result ? `<span class="tag warn" title="Settlement result reported by the exchange">${esc(result)}</span>`
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

/* ------------------------------------------------- official traded dollars */

/* On-demand measurement of the dollars that actually changed hands, from
 * GET /markets/trades. Deliberately not part of the poll: it costs one request
 * per market, so the reader chooses the window and the market budget, and the
 * page states both the count measured and the count skipped. */
async function measureTradedDollars() {
  if (!state.events.length) {
    pill($("#dollar-status"), "warn", "load the board first");
    return;
  }
  const seconds = Number($("#dollar-window")?.value) || 86400;
  const maxMarkets = Math.min(40, Math.max(1, Number($("#dollar-markets")?.value) || 12));
  pill($("#dollar-status"), "warn", "reading trades…");
  $("#dollar-run").disabled = true;
  try {
    const res = await rankByTradedDollars(path => api.get(path), state.events, {
      seconds,
      maxMarkets,
      limit: TRADE_LIMITS.maxLimit,
      onProgress: p => pill($("#dollar-status"), "warn", `reading trades… ${p.measured + p.failed}/${p.total} markets, ${p.requests} request(s)`)
    });
    renderTradedDollars(res);
    pill($("#dollar-status"), res.failed ? "warn" : "live",
      `${res.measured} measured · ${res.failed} unreadable · ${res.requests} request(s)`);
  } catch (e) {
    pill($("#dollar-status"), "err", e.message);
    $("#dollar-rows").innerHTML = emptyRow(6, "The trades endpoint could not be read: " + e.message);
    $("#dollar-kpis").innerHTML = "";
  } finally {
    $("#dollar-run").disabled = false;
  }
}

function renderTradedDollars(res) {
  /* Only complete rows are added up. A row whose pages could not all be read
   * contributes null, and `r.dollars || 0` would quietly turn that into "$0.00
   * measured" — presenting a partial sum as the topic's total, which is the one
   * thing this panel promises never to do. So the headline figure is withheld
   * (n/a) whenever any measured market was unreadable. */
  const completeRows = res.rows.filter(r => r.complete);
  const dollarsTotal = res.failed ? null : completeRows.reduce((a, r) => a + (r.dollars || 0), 0);
  const trades = completeRows.reduce((a, r) => a + (r.trades || 0), 0);
  const contracts = completeRows.reduce((a, r) => a + (r.contracts || 0), 0);
  const hrs = Math.round(res.window.seconds / 3600);
  const budget = `${res.measured + res.failed} of ${res.totalMarkets} open market(s), last ${hrs}h`;
  $("#dollar-kpis").innerHTML = [
    {
      k: "Traded dollars",
      v: res.failed
        ? `<span class="unv" title="At least one market's trade pages could not be read, so no total is shown">n/a</span>`
        : money(dollarsTotal, { dp: 2 }),
      m: res.failed ? `${res.failed} market(s) unreadable — no total shown` : `Σ over the measured markets (${budget})`
    },
    { k: "Trades read", v: int(trades), m: res.failed ? "completed transactions in rows read in full" : "completed transactions in the window" },
    { k: "Contracts read", v: int(contracts), m: "Σ count_fp, completed rows only" }
  ].map(s => `<div class="stat"><div class="k">${esc(s.k)}</div><div class="v">${s.v}</div><div class="m">${esc(s.m)}</div></div>`).join("");

  if (!res.rows.length) {
    $("#dollar-rows").innerHTML = emptyRow(6, "No open markets were available to measure in this scan.");
    return;
  }
  $("#dollar-rows").innerHTML = res.rows.map(r => {
    const ev = r.event;
    /* One link per market that was actually measured, each pointing at that
     * market's own trades response for this window. An earlier version linked
     * only the event's first market while the row summed several, so the link
     * could not substantiate the number beside it. */
    const links = (r.tickers || []).map(t => {
      const href = `${DEMO.rest}${TRADE_PATH}?ticker=${encodeURIComponent(t.ticker)}&min_ts=${res.window.min_ts}&max_ts=${res.window.max_ts}&limit=${TRADE_LIMITS.maxLimit}`;
      return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="trades response for ${esc(t.ticker)}${t.complete ? "" : " (incomplete read)"}">${esc(t.ticker)}${t.complete ? "" : " ⚠"} ↗</a>`;
    }).join('<span class="muted"> · </span>');
    const dollars = r.complete
      ? money(r.dollars)
      : `<span class="unv" title="At least one market's trade pages could not be read">n/a</span>`;
    return `<tr>
      <td><a href="../event.html?ticker=${encodeURIComponent(ev.event_ticker)}">${esc(ev.title || ev.event_ticker)}</a>
        <div class="mono muted small">${esc(ev.event_ticker)}</div></td>
      <td class="num">${int(r.markets)}</td>
      <td class="num">${int(r.trades)}</td>
      <td class="num">${int(r.contracts)}</td>
      <td class="num">${dollars}</td>
      <td class="small">${links || `<span class="unv">n/a</span>`}</td>
    </tr>`;
  }).join("");

  const excluded = missingNote({ missing: res.missingTrades || 0, unsided: res.unsidedTrades || 0 });
  const observed = res.observed?.oldest && res.observed?.newest
    ? ` Trades actually read span ${esc(res.observed.oldest)} – ${esc(res.observed.newest)} (<code>created_time</code> of the rows returned).`
    : " No trade rows were returned in this window.";
  const skipped = res.skippedMarkets
    ? ` ${int(res.skippedMarkets)} of ${int(res.totalMarkets)} open markets in this topic were outside the ${res.measured + res.failed}-market budget and are not measured.`
    : "";
  const failed = res.failed
    ? ` ${int(res.failed)} market(s) could not be read: their events show n/a and the topic's traded-dollar headline is withheld rather than shown as a partial sum.`
    : "";
  $("#dollar-note").innerHTML = `
    Σ(<code>count_fp</code> × <code>yes_price_dollars</code> for a YES taker, <code>no_price_dollars</code> for a NO taker), from
    <a href="${esc(TRADES_SOURCE)}" target="_blank" rel="noopener noreferrer">Get Trades ↗</a>,
    requested window ${esc(res.window.min_ts)}–${esc(res.window.max_ts)} (Unix seconds).${observed}${excluded ? " " + esc(excluded) : ""}${esc(skipped)}${esc(failed)}
    Each market measured has its own response link, so every dollar figure in the table can be checked against the trades it came from.
    A trade with no recorded taker side, or no price on that side, is excluded and counted here rather than valued by assumption.
    If any page of trades cannot be read the event shows <span class="unv">n/a</span>; a partial sum is never presented as a total.`;
}

$("#dollar-run")?.addEventListener("click", measureTradedDollars);

/* ------------------------------------------------------------------ chart */
async function selectMarket(market) {
  state.selected = market;
  state.candles = null;
  state.quote = null;
  state.priceTouched = false;
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
      /* Which official tier answered. The historical endpoint is the only place
       * archived settled markets publish candles, and it returns the same numbers
       * under different field names
       * (https://docs.kalshi.com/getting_started/historical_data). */
      const archived = res.via === "historical";
      $("#chart-src").innerHTML = `
        Official candlesticks${archived ? " <strong>(archived tier)</strong>" : ""} ·
        <code>period_interval=${interval}</code> minute(s) ·
        ${int(res.rawCount)} raw periods returned` +
        (res.series ? ` · series <code>${esc(res.series)}</code>` : "") + ` ·
        ${src(res.source, archived ? "GET historical candlesticks" : "GET candlesticks")} ` +
        `${src(archived ? SOURCES.historicalCandles : SOURCES.candles, "endpoint docs")}` +
        (res.historicalError
          ? ` <span class="unv">archived tier not read: ${esc(res.historicalError)}</span>`
          : "");
      renderJumps(market, jumps, res);
      if (!traded) {
        /* A market can legitimately have candles with no trade price (no trade
         * in the window). Rather than leave an empty chart, look for another
         * market in this topic that does have a priced candle series and offer
         * it — the board already ranks markets by volume × last YES-price proxy, so the reader
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
      $("#chart-src").innerHTML = `Candlestick request failed: ${esc(e.message)}. ` +
        `${src(SOURCES.candles, "live-tier docs")} ${src(SOURCES.historicalCandles, "archived-tier docs")}`;
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
      <a class="src-link" href="${esc(`${DEMO.rest}/markets/${encodeURIComponent(market.ticker)}`)}" target="_blank" rel="noopener noreferrer">market ↗</a>
    </td>
  </tr>`).join("");

  el.innerHTML = `<div class="table-wrap" style="margin-top:10px">
    <table>
      <thead><tr><th>Time</th><th class="num">From</th><th class="num">To</th><th class="num">Δ</th><th>Official source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="table-note">
      ${int(jumps.length)} move(s) of $${ALERT.defaultThreshold.toFixed(2)} or more inside official candles in this
      window (comparing each candle close against its <code>price.previous_dollars</code> when present, else the
      prior priced candle close). ${src(res.source, "candles ↗")}
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
      box.innerHTML = `This event returned no <code>settlement_sources</code> entry. ${src(SOURCES.getEvent, "event API")}`;
      return;
    }
    box.innerHTML = `<strong>Where this market is decided</strong> — Kalshi's settlement sources for this event: ` +
      ctx.sources.slice(0, 10).map(s => /^https?:\/\//i.test(s.url)
        ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name || s.url)} ↗</a>`
        : `<span>${esc(s.name || s.url)}</span>`).join(" · ") +
      `. ${src(SOURCES.getEvent, "event API")}`;
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
function renderLiquidityCheck() {
  const box = $("#book-check-result");
  if (!box) return;
  if (!state.quote) {
    box.innerHTML = "";
    return;
  }
  const side = $("#book-check-side")?.value === "no" ? "no" : "yes";
  const rawPrice = $("#book-check-price")?.value;
  const check = liquidityAtPrice(state.quote, { side, limitPrice: rawPrice });
  const sideLabel = side === "yes" ? "YES" : "NO";
  const oppLabel = side === "yes" ? "NO" : "YES";
  if (!check.valid) {
    box.innerHTML = `<div class="callout warn" style="margin:0"><p class="small" style="margin:0">${esc(check.reason)}</p></div>`;
    return;
  }
  const vwapNote = check.vwapDollars !== null ? ` · avg implied ask ${money4(check.vwapDollars)}` : "";
  const bestNote = check.bestAsk !== null
    ? `Best implied ${sideLabel} ask on this book: ${money4(check.bestAsk)}.`
    : `No resting ${oppLabel} bids on this book, so 0 ${sideLabel} contracts are currently offered.`;
  box.innerHTML = `<div class="callout info" style="margin:0">
    <p class="small" style="margin:0">
      <strong>At ${money4(check.limitPrice)} (${sideLabel} buyer):</strong>
      <strong>${qty(check.fillableContracts)}</strong> contract(s) immediately fillable at or below ${money4(check.limitPrice)}
      (${qty(check.exactContracts)} at exact ${money4(check.limitPrice)}; ${int(check.levelsMatched)}/${int(check.totalLevels)} resting ${oppLabel}-bid level(s);
      pre-fee resting notional ${money(check.totalCostDollars)}${vwapNote}).
      ${bestNote}
      <a href="${esc(state.orderbookUrl)}" target="_blank" rel="noopener noreferrer">Orderbook API ↗</a> ·
      ${src(SOURCES.orderbook, "Orderbook Responses")}
    </p>
  </div>`;
}

async function loadBook(ticker) {
  if (!ticker) return;
  pill($("#book-status"), "warn", "loading…");
  try {
    const book = await getOrderbook(ticker, 20);
    const q = deriveQuote(book);
    const orderbookUrl = `${DEMO.rest}/markets/${encodeURIComponent(ticker)}/orderbook?depth=20`;
    state.quote = q;
    state.orderbookUrl = orderbookUrl;
    /* A NO bid at y is a YES ask at 1 − y (official reciprocal rule), and that
     * ask is the price at which a buyer can actually take YES liquidity — which
     * is what the panel heading promises. The implied column is shown next to
     * the literal NO bid price, never instead of it, and is blank on YES-bid
     * rows because a YES bid is the other side of the book. */
    const row = (l, kind) => {
      const impliedYesAsk = kind === "no" ? Number((1 - l.p).toFixed(4)) : null;
      return `<tr><td class="num">${money4(l.p)}</td>
      <td class="num">${qty(l.c)}</td>
      <td class="num">${money(l.p * l.c)}</td>
      <td class="num">${impliedYesAsk === null ? `<span class="muted small">—</span>` : money4(impliedYesAsk)}</td>
      <td><span class="tag ${kind === "yes" ? "yes" : "no"}">${kind === "yes" ? "YES bid" : "NO bid"}</span></td>
      <td><a href="${esc(orderbookUrl)}" target="_blank" rel="noopener noreferrer">API response ↗</a></td></tr>`;
    };

    const yesRows = [...q.yes].sort((a, b) => b.p - a.p);
    const noRows = [...q.no].sort((a, b) => b.p - a.p);
    $("#yes-book").innerHTML = yesRows.length ? yesRows.map(l => row(l, "yes")).join("") : emptyRow(6, "No resting YES bids.");
    $("#no-book").innerHTML = noRows.length ? noRows.map(l => row(l, "no")).join("") : emptyRow(6, "No resting NO bids.");

    const yesDepth = yesRows.reduce((a, l) => a + l.c, 0);
    const yesNotional = yesRows.reduce((a, l) => a + l.p * l.c, 0);
    const noDepth = noRows.reduce((a, l) => a + l.c, 0);
    $("#book-summary").innerHTML = `
      <div class="grid cols-4">
        <div class="stat"><div class="k">Best YES bid</div><div class="v">${money4(q.bestYesBid)}</div><div class="m">highest resting YES bid</div></div>
        <div class="stat"><div class="k">Implied YES ask</div><div class="v">${money4(q.bestYesAsk)}</div><div class="m">1 − best NO bid</div></div>
        <div class="stat"><div class="k">YES spread</div><div class="v">${q.yesSpread === null ? `<span class="unv">n/a</span>` : (q.yesSpread * 100).toFixed(1) + "¢"}</div><div class="m">ask − bid</div></div>
        <div class="stat"><div class="k">YES bid depth (contracts)</div><div class="v">${qty(yesDepth)}</div><div class="m">resting YES bids @ ${money(yesNotional)} · ${qty(noDepth)} YES ask offered</div></div>
      </div>`;

    if (!state.priceTouched && $("#book-check-price")) {
      const side = $("#book-check-side")?.value === "no" ? "no" : "yes";
      const defaultAsk = side === "yes" ? q.bestYesAsk : q.bestNoAsk;
      if (defaultAsk !== null) $("#book-check-price").value = defaultAsk.toFixed(4).replace(/00$/, "");
    }
    renderLiquidityCheck();

    const emptyAmbiguity = (!yesRows.length && !noRows.length)
      ? ` Empty <code>yes_dollars</code> and <code>no_dollars</code> arrays are returned with HTTP 200 both when a market has no resting orders and when a ticker is unknown or archived; verify the market record via <a href="${esc(`${DEMO.rest}/markets/${encodeURIComponent(ticker)}`)}" target="_blank" rel="noopener noreferrer">GET /markets/${esc(ticker)} ↗</a>.`
      : "";
    pill($("#book-status"), "live", `live · ${yesRows.length + noRows.length} levels`);
    $("#book-src").innerHTML = `Order book returns <strong>bids only</strong>; a NO bid at <em>y</em> implies a
      YES ask at <em>1 − y</em> (and a YES bid at <em>x</em> implies a NO ask at <em>1 − x</em>) — the
      <strong>Implied YES ask</strong> column shows the price a YES buyer pays, and the lookup bar above sums
      resting opposite-side bids up to any chosen limit price. Contract counts preserve fixed-point
      <code>count_fp</code> fractional precision.${emptyAmbiguity} ${src(SOURCES.orderbook, "order-book docs")}`;
  } catch (e) {
    state.quote = null;
    pill($("#book-status"), "err", e.message);
    $("#book-summary").innerHTML = "";
    if ($("#book-check-result")) $("#book-check-result").innerHTML = "";
    $("#yes-book").innerHTML = emptyRow(6, "Order book unavailable.");
    $("#no-book").innerHTML = emptyRow(6, "Order book unavailable.");
  }
}
$("#book-refresh").addEventListener("click", () => loadBook(state.selected?.ticker));
$("#book-check-side")?.addEventListener("change", () => {
  if (!state.priceTouched && state.quote && $("#book-check-price")) {
    const side = $("#book-check-side").value === "no" ? "no" : "yes";
    const defaultAsk = side === "yes" ? state.quote.bestYesAsk : state.quote.bestNoAsk;
    if (defaultAsk !== null) $("#book-check-price").value = defaultAsk.toFixed(4).replace(/00$/, "");
  }
  renderLiquidityCheck();
});
$("#book-check-price")?.addEventListener("input", () => {
  state.priceTouched = true;
  renderLiquidityCheck();
});

/* ------------------------------------------------------------------ init */
loadBoard();
setInterval(() => {
  if (document.visibilityState === "visible" && !document.hidden) {
    if (state.selected) loadBook(state.selected.ticker);
  }
}, 30000);

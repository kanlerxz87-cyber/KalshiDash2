/* Evidence-first public demo dashboard. Never fabricate values when a source is unavailable. */
(() => {
  "use strict";

  const API_BASES = [
    "https://external-api.demo.kalshi.co/trade-api/v2",
    "https://demo-api.kalshi.co/trade-api/v2",
  ];
  const CATEGORY_RULES = {
    "Gas prices": /\b(gas|gasoline|petrol|fuel|crude|oil price|wti|brent)\b/i,
    Elections:
      /\b(election|president|presidential|senate|congress|governor|primary|vote|ballot|electoral)\b/i,
    Culture:
      /\b(culture|movie|film|music|album|artist|box office|celebrity|tv show|television|award|grammy|oscar|emmy|pop culture)\b/i,
    Crypto:
      /\b(bitcoin|btc|ethereum|ether|crypto|cryptocurrency|solana|dogecoin|token)\b/i,
    Golf: /\b(golf|pga|lpga|masters tournament|the open championship|us open golf|ryder cup)\b/i,
  };
  const state = {
    base: API_BASES[0],
    markets: [],
    settled: [],
    selected: null,
    category: "All topics",
    query: "",
    points: [],
    range: "1m",
    polling: null,
    refreshTimer: null,
    lastUpdated: null,
    loading: false,
    cursorNote: "",
    settledTruncated: false,
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const numeric = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const fmtNumber = (value) => {
    const n = numeric(value);
    return n === null
      ? "—"
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
          n,
        );
  };
  const fmtPrice = (value) => {
    const n = numeric(value);
    if (n === null) return "—";
    return `$${n.toFixed(2)}`;
  };
  function topicFor(market) {
    const text = `${market.title || ""} ${market.subtitle || ""} ${market.ticker || ""} ${market.event_ticker || ""}`;
    for (const [category, pattern] of Object.entries(CATEGORY_RULES))
      if (pattern.test(text)) return category;
    return null;
  }

  function marketPrice(market) {
    // The v2 market schema names the last-trade value in dollars. Do not
    // substitute bid/ask for last price or guess a legacy unit conversion.
    return numeric(market.last_price_dollars);
  }

  function apiMarketUrl(market) {
    return `${state.base}/markets/${encodeURIComponent(market.ticker)}`;
  }

  async function apiFetch(path, options = {}) {
    const failures = [];
    for (const base of [
      state.base,
      ...API_BASES.filter((item) => item !== state.base),
    ]) {
      try {
        const response = await fetch(`${base}${path}`, {
          method: "GET",
          signal: options.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        state.base = base;
        return json;
      } catch (error) {
        if (error.name === "AbortError") throw error;
        failures.push(`${base}: ${error.message || "request failed"}`);
      }
    }
    throw new Error(failures.join(" · "));
  }

  function setConnection(ok, message) {
    const label = $("#live-label");
    label.textContent = ok
      ? "Connected · public API"
      : "No verified connection";
    $("#connection-message").textContent = message;
    $("#connection-notice").classList.toggle("notice-amber", !ok);
    $("#connection-notice").classList.toggle("notice-blue", ok);
  }

  async function fetchPages(status, maxPages = 5) {
    const all = [];
    let cursor = "";
    let pageCount = 0;
    for (; pageCount < maxPages; pageCount++) {
      const params = new URLSearchParams({ status, limit: "1000" });
      if (cursor) params.set("cursor", cursor);
      const response = await apiFetch(`/markets?${params.toString()}`);
      const batch = Array.isArray(response.markets) ? response.markets : [];
      all.push(...batch);
      cursor = response.cursor || "";
      if (!cursor || !batch.length) {
        pageCount++;
        break;
      }
    }
    return { records: all, hasMore: Boolean(cursor), pageCount };
  }

  async function refreshData() {
    if (state.loading) return;
    state.loading = true;
    $("#live-label").textContent = "Refreshing";
    $("#table-summary").textContent =
      "Requesting current records from Kalshi demo API…";
    try {
      const [open, settled] = await Promise.all([
        fetchPages("open", 5),
        fetchPages("settled", 2),
      ]);
      state.markets = open.records;
      state.settled = settled.records;
      state.cursorNote = open.hasMore
        ? ` First ${open.records.length} open records loaded; additional pages are available.`
        : "";
      state.settledTruncated = settled.hasMore;
      state.lastUpdated = new Date();
      $("#clock").textContent =
        `Updated ${state.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      $("#metric-markets").textContent = fmtNumber(state.markets.length);
      const matches = state.markets.filter(topicFor).length;
      $("#metric-topics").textContent = fmtNumber(matches);
      $("#metric-priced").textContent = fmtNumber(
        state.markets.filter((market) => marketPrice(market) !== null).length,
      );
      $("#metric-markets-note").textContent =
        `Open status · ${open.pageCount} page${open.pageCount === 1 ? "" : "s"} loaded`;
      setConnection(
        true,
        `Market records received from the Kalshi demo API. Last checked ${state.lastUpdated.toLocaleTimeString()}.${state.cursorNote}`,
      );
      renderMarkets();
      renderSettled();
      if (state.selected) {
        const latest = state.markets.find(
          (item) => item.ticker === state.selected.ticker,
        );
        if (latest) {
          state.selected = latest;
          await inspectSelected(latest, false);
        }
      }
    } catch (error) {
      setConnection(
        false,
        `No source data could be verified from either demo endpoint. ${error.message || "Request failed"}. Check browser network/CORS access; values remain blank.`,
      );
      $("#metric-markets").textContent = "—";
      $("#metric-topics").textContent = "—";
      $("#metric-priced").textContent = "—";
      $("#metric-markets-note").textContent = "No verified source response";
      $("#market-rows").innerHTML =
        '<tr><td colspan="7" class="empty-cell">No verified data returned. Check the public demo endpoint and browser network/CORS access. No sample values are displayed. <a class="source-link" href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener">Official API schema ↗</a></td></tr>';
      $("#table-summary").textContent = "0 verified records · API unavailable";
      $("#resolved-rows").innerHTML =
        '<tr><td colspan="5" class="empty-cell">No settled records could be verified. <a class="source-link" href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener">Official API schema ↗</a></td></tr>';
      $("#resolved-summary").textContent =
        "API unavailable; no result values shown.";
    } finally {
      state.loading = false;
    }
  }

  function filteredMarkets() {
    const search = state.query.toLowerCase();
    return state.markets
      .filter((market) => {
        const topic = topicFor(market);
        if (!topic) return false;
        if (state.category !== "All topics" && state.category !== topic)
          return false;
        if (
          search &&
          !`${market.title || ""} ${market.ticker || ""} ${market.event_ticker || ""}`
            .toLowerCase()
            .includes(search)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          (numeric(b.volume_24h_fp) ?? -1) - (numeric(a.volume_24h_fp) ?? -1),
      );
  }

  function renderMarkets() {
    const records = filteredMarkets();
    $("#metric-topics").textContent = fmtNumber(
      state.markets.filter(topicFor).length,
    );
    const tbody = $("#market-rows");
    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-cell">${state.markets.length ? "No returned market matched these keyword filters." : "No verified market records are currently loaded."} <a class="source-link" href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener">Official API schema ↗</a></td></tr>`;
    } else {
      tbody.innerHTML = records
        .map((market) => {
          const topic = topicFor(market);
          const price = marketPrice(market);
          const volume = market.volume_24h_fp ?? null;
          const interest = market.open_interest_fp ?? null;
          const url = apiMarketUrl(market);
          return `<tr><td><button class="market-select" data-ticker="${escapeHtml(market.ticker)}" aria-label="Inspect ${escapeHtml(market.title || market.ticker)}"><span class="market-title">${escapeHtml(market.title || "Untitled market")}</span><span class="market-ticker">${escapeHtml(market.ticker || "")}${market.event_ticker ? ` · ${escapeHtml(market.event_ticker)}` : ""}</span></button></td><td><span class="topic-badge">${escapeHtml(topic)}</span><span class="topic-unverified">Keyword match · verify rules</span></td><td><span class="status-pill ${market.status === "open" ? "status-open" : "status-unknown"}">${escapeHtml(market.status || "—")}</span></td><td class="price-cell">${price === null ? "—" : fmtPrice(price)}</td><td>${volume === null ? "—" : fmtNumber(volume)}</td><td>${interest === null ? "—" : fmtNumber(interest)}</td><td><a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">API record ↗</a></td></tr>`;
        })
        .join("");
    }
    $("#table-summary").textContent =
      `${records.length} topic match${records.length === 1 ? "" : "es"} shown · ${state.markets.length} open records loaded${state.cursorNote}`;
    $$(".market-select", tbody).forEach((button) =>
      button.addEventListener("click", () => {
        const market = state.markets.find(
          (record) => record.ticker === button.dataset.ticker,
        );
        if (market) inspectSelected(market, true);
      }),
    );
  }

  function renderSettled() {
    const outcomes = state.settled.filter(
      (market) => market.result === "yes" || market.result === "no",
    );
    if (!outcomes.length) {
      $("#resolved-rows").innerHTML =
        '<tr><td colspan="5" class="empty-cell">No official YES/NO result found in the loaded settled market records. <a class="source-link" href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener">Official API schema ↗</a></td></tr>';
      $("#resolved-summary").textContent =
        `${state.settled.length} settled records checked · no confirmed result in loaded records${state.settledTruncated ? " · additional settled pages not loaded" : ""}.`;
      return;
    }
    $("#resolved-rows").innerHTML =
      outcomes
        .filter(topicFor)
        .map((market) => {
          const result = market.result;
          const url = apiMarketUrl(market);
          const when = market.settlement_ts || market.settlement_time || "";
          const rules = market.rules_primary || "";
          return `<tr><td><span class="market-title">${escapeHtml(market.title || "Untitled market")}</span><span class="market-ticker">${escapeHtml(market.ticker || "")} · ${escapeHtml(topicFor(market) || "")} keyword match</span></td><td><span class="status-pill status-unknown">${escapeHtml(market.status || "settled")}</span></td><td><strong>${result.toUpperCase()}</strong></td><td>${when ? escapeHtml(new Date(when).toLocaleString()) : "—"}</td><td><a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">API record ↗</a>${rules ? `<details class="rules-detail"><summary>Read listed rules</summary><p>${escapeHtml(rules)}</p></details>` : '<span class="topic-unverified">Rules not returned</span>'}</td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="5" class="empty-cell">No resolved markets in the five keyword-matched topics were found in the loaded records. <a class="source-link" href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener">Official API schema ↗</a></td></tr>';
    $("#resolved-summary").textContent =
      `${outcomes.filter(topicFor).length} topic-matched markets with official API result yes/no${state.settledTruncated ? " · additional settled pages not loaded" : ""}. Results not inferred.`;
  }

  async function inspectSelected(market, clearPoints) {
    state.selected = market;
    if (clearPoints) state.points = [];
    $("#selected-market-title").textContent =
      market.title || market.ticker || "Selected market";
    $("#open-market-source").disabled = false;
    $("#open-market-source").onclick = () =>
      window.open(apiMarketUrl(market), "_blank", "noopener");
    $("#chart-empty").style.display = "none";
    const cachedPrice = marketPrice(market);
    if (cachedPrice !== null) addPoint(cachedPrice, Date.now());
    drawChart();
    await loadSelected();
    if (state.polling) clearInterval(state.polling);
    state.polling = setInterval(loadSelected, 15000);
  }

  async function loadSelected() {
    if (!state.selected) return;
    const ticker = state.selected.ticker;
    try {
      const [detail, book] = await Promise.all([
        apiFetch(`/markets/${encodeURIComponent(ticker)}`),
        apiFetch(`/markets/${encodeURIComponent(ticker)}/orderbook?depth=8`),
      ]);
      const market = detail.market || detail;
      const price = marketPrice(market);
      if (price !== null) addPoint(price, Date.now());
      $("#chart-price").textContent =
        `YES ${price === null ? "—" : fmtPrice(price)}`;
      if (market.title) $("#selected-market-title").textContent = market.title;
      renderOrderbook(book.orderbook_fp || book.orderbook || null);
      $("#orderbook-updated").textContent =
        `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      drawChart();
    } catch (error) {
      $("#orderbook-updated").textContent = "Not verified";
      if (!state.points.length) $("#chart-empty").style.display = "grid";
    }
  }

  function addPoint(price, timestamp) {
    if (!Number.isFinite(price)) return;
    const last = state.points[state.points.length - 1];
    if (last && timestamp - last.time < 9000)
      state.points[state.points.length - 1] = { time: timestamp, price };
    else state.points.push({ time: timestamp, price });
    const maxAge =
      state.range === "1m"
        ? 60_000
        : state.range === "1h"
          ? 3_600_000
          : 86_400_000;
    state.points = state.points
      .filter((point) => timestamp - point.time <= maxAge)
      .slice(-1000);
  }

  function renderOrderbook(orderbook) {
    const target = $("#orderbook-levels");
    if (!orderbook) {
      target.innerHTML =
        '<p class="empty-inline">No order-book payload was returned.</p>';
      return;
    }
    const yes = Array.isArray(orderbook.yes_dollars)
      ? orderbook.yes_dollars
      : [];
    const no = Array.isArray(orderbook.no_dollars) ? orderbook.no_dollars : [];
    const count = Math.max(yes.length, no.length, 1);
    target.innerHTML = Array.from(
      { length: Math.min(count, 8) },
      (_, index) => {
        const y = yes[index];
        const n = no[index];
        return `<div class="book-level"><span class="yes-book-price">${y && y[0] !== undefined ? fmtPrice(y[0]) : "—"}</span><span>${y && y[1] !== undefined ? fmtNumber(y[1]) : "—"}</span><span class="no-book-price">${n && n[0] !== undefined ? fmtPrice(n[0]) : "—"}</span><span>${n && n[1] !== undefined ? fmtNumber(n[1]) : "—"}</span></div>`;
      },
    ).join("");
  }

  function drawChart() {
    const canvas = $("#price-chart");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    const w = rect.width,
      h = rect.height;
    const pad = { top: 12, right: 12, bottom: 25, left: 38 };
    const now = Date.now();
    const span =
      state.range === "1m"
        ? 60_000
        : state.range === "1h"
          ? 3_600_000
          : 86_400_000;
    const points = state.points.filter((point) => now - point.time <= span);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "9px DM Sans, sans-serif";
    ctx.lineWidth = 1;
    const labels = 4;
    for (let i = 0; i <= labels; i++) {
      const y = pad.top + ((h - pad.top - pad.bottom) * i) / labels;
      ctx.strokeStyle = "#edf1f4";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      if (points.length) {
        const min = Math.min(...points.map((p) => p.price));
        const max = Math.max(...points.map((p) => p.price));
        const value = max === min ? max : max - ((max - min) * i) / labels;
        ctx.fillStyle = "#96a1ac";
        ctx.textAlign = "right";
        ctx.fillText(`$${value.toFixed(2)}`, pad.left - 6, y + 3);
      }
    }
    for (let i = 0; i <= 4; i++) {
      const x = pad.left + ((w - pad.left - pad.right) * i) / 4;
      ctx.strokeStyle = "#f3f5f7";
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, h - pad.bottom);
      ctx.stroke();
      let label = "";
      if (i === 4) label = "now";
      else if (state.range === "1m") label = `-${Math.round((4 - i) * 15)}s`;
      else if (state.range === "1h") label = `-${Math.round((4 - i) * 15)}m`;
      else label = `-${Math.round((4 - i) * 6)}h`;
      ctx.fillStyle = "#9aa5af";
      ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
      ctx.fillText(label, x, h - 7);
    }
    if (points.length === 1) {
      const x = w - pad.right;
      const y = pad.top + (h - pad.top - pad.bottom) / 2;
      ctx.fillStyle = "#4e82d1";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (points.length < 2) return;
    const min = Math.min(...points.map((p) => p.price));
    const max = Math.max(...points.map((p) => p.price));
    const low = min === max ? min - 0.01 : min;
    const high = min === max ? max + 0.01 : max;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x =
        pad.left +
        (w - pad.left - pad.right) *
          Math.max(0, (point.time - (now - span)) / span);
      const y =
        pad.top +
        (h - pad.top - pad.bottom) * (1 - (point.price - low) / (high - low));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#4e82d1";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function navigate() {
    const hash = location.hash.slice(1) || "dashboard";
    const topicRoutes = {
      gas: "Gas prices",
      elections: "Elections",
      culture: "Culture",
      crypto: "Crypto",
      golf: "Golf",
    };
    const topic = topicRoutes[hash] || null;
    const page = topic ? "dashboard" : hash;
    if (page === "dashboard" && !topic) {
      state.category = "All topics";
      $$(".chip").forEach((chip) =>
        chip.classList.toggle("selected", chip.dataset.chip === state.category),
      );
      renderMarkets();
    }
    $$(".page").forEach((section) =>
      section.classList.toggle("active", section.id === `page-${page}`),
    );
    $$(".nav-link").forEach((link) => {
      const isTopic = link.dataset.topic === topic;
      const isPage = (link.dataset.page || "") === page && !topic;
      link.classList.toggle("active", isTopic || isPage);
    });
    $("#breadcrumb-current").textContent =
      topic ||
      {
        dashboard: "Overview",
        resolved: "Resolved markets",
        portfolio: "Portfolio",
        strategies: "Trade analysis",
        questions: "Decision checklist",
        suggestions: "Suggestions",
        review: "Flagged for review",
      }[page] ||
      "Overview";
    if (topic) {
      state.category = topic;
      $$(".chip").forEach((chip) =>
        chip.classList.toggle("selected", chip.dataset.chip === topic),
      );
      renderMarkets();
    }
    $(".sidebar").classList.remove("open");
    requestAnimationFrame(drawChart);
  }

  function initControls() {
    $$(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        state.category = chip.dataset.chip;
        $$(".chip").forEach((item) =>
          item.classList.toggle("selected", item === chip),
        );
        renderMarkets();
      }),
    );
    $("#market-search").addEventListener("input", (event) => {
      state.query = event.target.value.trim();
      renderMarkets();
    });
    $$("[data-refresh]").forEach((button) =>
      button.addEventListener("click", refreshData),
    );
    $("#refresh-button").addEventListener("click", refreshData);
    $("#refresh-top").addEventListener("click", refreshData);
    $$(".range-button").forEach((button) =>
      button.addEventListener("click", () => {
        state.range = button.dataset.range;
        $$(".range-button").forEach((item) =>
          item.classList.toggle("selected", item === button),
        );
        drawChart();
      }),
    );
    $("#mobile-menu").addEventListener("click", () =>
      $(".sidebar").classList.toggle("open"),
    );
    window.addEventListener("hashchange", navigate);
    window.addEventListener("resize", drawChart);
    const labels = {
      liquidity: "liquidity",
      backend: "backend",
      topics: "topics",
      history: "history",
    };
    Object.entries(labels).forEach(([key, label]) => {
      const stateEl = $(`[data-state="${key}"]`);
      const stored = localStorage.getItem(`kalshi-review-${key}`);
      if (stored && stateEl)
        stateEl.textContent =
          stored === "recommended"
            ? "Recommended for review · saved locally"
            : "Deferred · saved locally";
      const button = $(`[data-vote="${key}"]`);
      if (button)
        button.addEventListener("click", () => {
          const current = localStorage.getItem(`kalshi-review-${key}`);
          const value = current === "recommended" ? "deferred" : "recommended";
          localStorage.setItem(`kalshi-review-${key}`, value);
          if (stateEl)
            stateEl.textContent =
              value === "recommended"
                ? "Recommended for review · saved locally"
                : "Deferred · saved locally";
          button.textContent =
            value === "recommended" ? "Mark deferred" : "Review / recommend";
        });
    });
  }

  initControls();
  navigate();
  refreshData();
  state.refreshTimer = setInterval(() => {
    if (!document.hidden) refreshData();
  }, 60_000);
})();

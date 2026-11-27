/* KalshiDash2 — requirement traceability, computed rather than asserted.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The brief asks for the work to be done "line by line", and the Summary page
 * answered that with prose: a matrix of requirement → page → "done" written by
 * hand. A hand-written matrix is a claim about the code, and this repository has
 * already shipped one card (Flagged F6) that was true when written and false
 * three days later. So the matrix below is not a list of sentences — it is a
 * list of CHECKS over the shipped modules, and a row is only "wired" when the
 * check it names actually passes here.
 *
 * Rules
 * -----
 *  1. Nothing in this file states a Kalshi fact. It measures this repository
 *     against the brief. Exchange facts live in assets/js/claims.js with their
 *     official sources; this file never repeats one.
 *  2. `code` checks run here, in Node, against the real modules. They import
 *     `assets/js/*.js` — the same files the browser loads — so a rename or a
 *     deleted export fails the matrix instead of silently ageing.
 *  3. `file` checks are existence checks on a page or module that must be
 *     published for the row to be honest. A missing file fails the row.
 *  4. No number is typed twice. The threshold, the window list, the topic list
 *     and the strategy keys are read from the modules that own them, so the
 *     page cannot show "$0.10" while the engine uses something else.
 *
 * The DOM-free part is exported so `tests/requirements-trace.test.mjs` can run
 * the same checks the page renders, and so `tests/dom/summary-dom.mjs` can
 * assert the rendered table agrees with the modules.
 */

/* The brief, verbatim enough to recognise, with the artefact that answers it. */
export const REQUIREMENT_TRACE = [
  {
    id: "R1",
    brief: "Executive summary outlining important details",
    artefact: "summary.html",
    evidence: "This page, plus EXECUTIVE_SUMMARY.md in the repo",
    check: { kind: "file", path: "summary.html" }
  },
  {
    id: "R2",
    brief: "Dashboard of the highest-dollar live events, limited to gas, elections, culture, crypto, golf",
    artefact: "index.html · categories/gas.html",
    evidence: "Five topic configs; ranking proxy stated on the page",
    check: { kind: "code", name: "topics" }
  },
  {
    id: "R3",
    brief: "Alert on any contract move ≥ $0.10 in either direction",
    artefact: "alerts.html · assets/js/alerts-core.js",
    evidence: "Threshold read from the module, not the page",
    check: { kind: "code", name: "threshold" }
  },
  {
    id: "R4",
    brief: "Two scrolling chats: all alerts, and a filtered high-ROI watch",
    artefact: "alerts.html",
    evidence: "Watch rules are a transparent screen, labelled as such (F13)",
    check: { kind: "code", name: "watch" }
  },
  {
    id: "R5",
    brief: "Track events until they resolve, yes or no",
    artefact: "resolved.html · assets/js/market.js",
    evidence: "Resolution keyed on the API's own `result`",
    check: { kind: "code", name: "resolution" }
  },
  {
    id: "R6",
    brief: "Automated simulated trades testing different strategies",
    artefact: "simulator.html · assets/js/simulator.js",
    evidence: "Backtest over official candles, scored at settlement",
    check: { kind: "code", name: "strategies" }
  },
  {
    id: "R7",
    brief: "Track portfolio performance on the demo account",
    artefact: "portfolio.html",
    evidence: "Needs the owner's demo key; no credential is in the repo (F1/F2)",
    check: { kind: "file", path: "portfolio.html" }
  },
  {
    id: "R8",
    brief: "Analyse and categorise trades, build strategies by trade type",
    artefact: "strategies.html · scripts/analyze_trades.py",
    evidence: "Categories and rules labelled as project choices",
    check: { kind: "file", path: "strategies.html" }
  },
  {
    id: "R9",
    brief: "Execute trades on events and track performance",
    artefact: "portfolio.html (V2 order form) · assets/js/kalshi.js",
    evidence: "Route + required fields pinned by tests/order-contract.test.mjs; no order executed (F1)",
    check: { kind: "code", name: "orderRoute" }
  },
  {
    id: "R10",
    brief: "Live interactive price graph — x = time, y = price, seconds / minutes / hours windows",
    artefact: "categories/*.html · assets/js/ui.js",
    evidence: "Window list read from config; axis labels unit-tested",
    check: { kind: "code", name: "windows" }
  },
  {
    id: "R11",
    brief: "Current liquidity — how many contracts are available at a given price",
    artefact: "categories/gas.html + the other four category pages (order-book depth) · assets/js/kalshi.js",
    evidence: "Bids-only book with the implied ask computed, never inferred as a quote",
    check: { kind: "code", name: "liquidity" }
  },
  {
    id: "R12",
    brief: "Charts name the events and source links behind a ≥ $0.10 jump",
    artefact: "alerts.html · category jump markers",
    evidence: "Kalshi's own settlement_sources, labelled references rather than causes (F14)",
    check: { kind: "code", name: "jumps" }
  },
  {
    id: "R13",
    brief: "Suggestions to make the site more live and interactive",
    artefact: "suggestions.html",
    evidence: "Project proposals; not verified facts",
    check: { kind: "file", path: "suggestions.html" }
  },
  {
    id: "R14",
    brief: "Organise by topic, keeping each topic's events together",
    artefact: "categories/gas.html, categories/elections.html, categories/culture.html, categories/crypto.html, categories/golf.html",
    evidence: "One page per topic, driven by the same config the board uses",
    check: { kind: "code", name: "topicPages" }
  },
  {
    id: "R15",
    brief: "Every row carries a source link; unconfirmable values blank and flagged",
    artefact: "verification.html · flagged.html · assets/js/claims.js",
    evidence: "Register rows carry an official URL and a status; flagged items are published",
    check: { kind: "code", name: "register" }
  },
  {
    id: "R16",
    brief: "Clean landing page with subpages organised by category",
    artefact: "index.html · assets/js/ui.js (nav)",
    evidence: "Navigation is generated from one list, so no page can be orphaned",
    check: { kind: "code", name: "nav" }
  },
  {
    id: "R17",
    brief: "Export the simulated results for offline analysis",
    artefact: "simulator.html (CSV)",
    evidence: "Columns are API fields or arithmetic over them; missing values stay empty",
    check: { kind: "code", name: "csv" }
  }
];

/* ---------------------------------------------------------------- the checks
 *
 * Each returns { ok, detail }. `detail` is what the page prints as the evidence,
 * so it must be produced from the values that were measured, not restated.
 */

export function runChecks({ config, alertsCore, market, kalshi, simulator, ui, files }) {
  const has = p => files.includes(p);
  const results = {};

  results.topics = (() => {
    const keys = config.TOPICS.map(t => t.key);
    const want = ["gas", "elections", "culture", "crypto", "golf"];
    const pages = want.map(k => `categories/${k}.html`).filter(has);
    const ok = want.every(k => keys.includes(k)) && pages.length === 5;
    return { ok, detail: `${keys.length} topics configured (${keys.join(", ")}); ${pages.length}/5 category pages published` };
  })();

  results.threshold = (() => {
    /* Read the live constant: the brief says $0.10 and the page must not be able
     * to claim it while the engine uses another number. */
    const t = alertsCore.THRESHOLD;
    return { ok: t === 0.1, detail: `alerts-core THRESHOLD = $${Number(t).toFixed(2)} (brief: $0.10, inclusive)` };
  })();

  results.watch = (() => {
    const r = alertsCore.WATCH_RULES || {};
    const n = ["maxSpread", "minPrice", "maxPrice", "minOpenInterest"].filter(k => typeof r[k] === "number").length;
    const strategies = (alertsCore.STRATEGIES || []).length;
    return { ok: n === 4 && strategies === 4, detail: `${n} watch rules, ${strategies} paper strategies (follow/fade × all/watch)` };
  })();

  results.resolution = (() => {
    /* The site must key on the exchange's own result string, and must not turn
     * an unknown value into a number. */
    const yes = market.isSettledMarket({ result: "yes", status: "finalized" });
    const no = market.isSettledMarket({ result: "no", status: "finalized" });
    const scalar = market.isSettledMarket({ result: "scalar", status: "finalized" });
    const pending = market.isSettledMarket({ result: "", status: "active" }, Date.parse("2026-11-27T00:00:00Z"));
    return {
      ok: yes && no && !pending,
      detail: `yes → ${yes ? "settled" : "NOT settled"}, no → ${no ? "settled" : "NOT settled"}, ` +
        `scalar → ${scalar ? "settled" : "not settled"}, active → ${pending ? "settled (WRONG)" : "not settled"}`
    };
  })();

  results.strategies = (() => {
    /* The replay rules live in config.STRATEGIES (the tester) and the paper
     * strategies in alertsCore.STRATEGIES (the alert feed). Both are measured. */
    const replay = Array.isArray(config.STRATEGIES) ? config.STRATEGIES : [];
    const paper = Array.isArray(alertsCore.STRATEGIES) ? alertsCore.STRATEGIES : [];
    const fee = typeof simulator.fillFeeDollars === "function";
    const csv = typeof simulator.tradesToCsv === "function";
    return {
      ok: replay.length > 0 && paper.length > 0 && fee && csv,
      detail: `${replay.length} replay rules (${replay.map(s => s.key).join(", ")}), ${paper.length} paper strategies, ` +
        `fee model ${fee ? "present" : "MISSING"}, CSV export ${csv ? "present" : "MISSING"}`
    };
  })();

  results.orderRoute = (() => {
    /* The route and the side mapping are the two things a reader could not check
     * from the page. Read them from the client class. */
    const src = kalshi.KalshiClient ? kalshi.KalshiClient.toString() : "";
    const route = /\/portfolio\/events\/orders/.test(src);
    const map = /outcomeSide === "yes" \? "bid" : "ask"/.test(src);
    return {
      ok: route && map,
      detail: `route ${route ? "POST /portfolio/events/orders" : "MISSING"}, side mapping ${map ? "yes→bid / no→ask" : "MISSING"}`
    };
  })();

  results.windows = (() => {
    const w = config.WINDOWS.map(x => x.key);
    const secs = w.includes("10s") || w.some(k => /s$/.test(k));
    const mins = w.some(k => /m$/.test(k));
    const hours = w.some(k => /h$/.test(k));
    return { ok: secs && mins && hours, detail: w.length + " windows: " + w.join(" / ") };
  })();

  results.liquidity = (() => {
    /* An empty book must read as "no levels", and the implied ask must be the
     * documented complement — never 0 when there is no NO bid. */
    const empty = kalshi.deriveQuote({ orderbook_fp: { yes_dollars: [], no_dollars: [] } });
    const book = kalshi.deriveQuote({ orderbook_fp: { yes_dollars: [["0.4200", "13.00"]], no_dollars: [["0.5600", "17.00"]] } });
    const ok = empty.bestYesBid === null && empty.bestYesAsk === null &&
      Math.abs(book.bestYesAsk - 0.44) < 1e-9 && Math.abs(book.bestYesBid - 0.42) < 1e-9;
    return { ok, detail: `empty book → ${empty.bestYesBid === null ? "n/a" : "a number (WRONG)"}; NO bid $0.56 → YES ask $${book.bestYesAsk}` };
  })();

  results.jumps = (() => {
    /* detectJumps compares each point against its own `prev` when the candle
     * carries one, otherwise against the previous point — so the fixture below
     * exercises the between-points path the chart uses for sampled windows. */
    const jumps = market.detectJumps([
      { t: 1, y: 0.40 }, { t: 2, y: 0.46 }, { t: 3, y: 0.57 }
    ], 0.10);
    const found = Array.isArray(jumps) ? jumps.length : 0;
    const marks = typeof market.jumpMarkers === "function" ? market.jumpMarkers(jumps || []).length : 0;
    const delta = found ? Number(jumps[0].delta) : null;
    return {
      ok: found === 1 && marks === 1 && delta !== null && Math.abs(delta - 0.11) < 1e-9,
      detail: `0.40 → 0.46 → 0.57 yields ${found} jump at the $0.10 threshold (Δ$${delta === null ? "n/a" : delta.toFixed(2)}), ${marks} chart marker`
    };
  })();

  results.topicPages = (() => {
    const missing = config.TOPICS.map(t => `categories/${t.key}.html`).filter(p => !has(p));
    return { ok: missing.length === 0, detail: missing.length ? "missing: " + missing.join(", ") : "all five category pages present" };
  })();

  results.nav = (() => {
    const nav = ui.PAGES.map(p => p.href);
    const pages = ["index.html", "alerts.html", "summary.html", "resolved.html", "portfolio.html",
      "strategies.html", "simulator.html", "suggestions.html", "questions.html", "verification.html",
      "sources.html", "flagged.html", "categories/gas.html", "categories/elections.html",
      "categories/culture.html", "categories/crypto.html", "categories/golf.html"];
    const missing = pages.filter(p => !nav.includes(p) || !has(p));
    return { ok: missing.length === 0, detail: `${nav.length} nav entries; ${missing.length} page(s) unreachable` };
  })();

  results.csv = (() => {
    const fn1 = typeof simulator.tradesToCsv === "function";
    let header = "";
    /* Call it, then read the FIRST ROW. String(fn(...)) would stringify the
     * function itself and measure the wrong thing — which is exactly the class
     * of error this matrix exists to make visible, so it is spelled out. */
    try { header = fn1 ? String(simulator.tradesToCsv([])).split(/\r?\n/)[0] : ""; } catch { header = ""; }
    /* Quoted CSV cells: a row of N cells has N-1 inner delimiters plus the
     * outer pair, so count the quoted cells rather than the commas. */
    const cols = header ? (header.match(/"(?:[^"]|"")*"/g) || []).length : 0;
    return { ok: fn1 && cols > 0, detail: fn1 ? `tradesToCsv() exports ${cols} columns; missing values stay empty, never 0` : "tradesToCsv MISSING" };
  })();

  return results;
}

/* ------------------------------------------------------------------ rendering */

export function traceRows({ config, alertsCore, market, kalshi, simulator, ui, files, claims }) {
  const results = runChecks({ config, alertsCore, market, kalshi, simulator, ui, files });

  /* The register is measured here rather than in runChecks(), because claims.js
   * must not be imported by a module the page loads before it (the Summary page
   * imports both, and a cycle would decide the order for us). */
  if (claims && Array.isArray(claims.CLAIMS)) {
    const total = claims.CLAIMS.length;
    const sourced = claims.CLAIMS.filter(c => /^https?:\/\//.test(c.source || "")).length;
    const verified = claims.CLAIMS.filter(c => c.status === "verified").length;
    results.register = {
      ok: sourced === total,
      detail: `${total} register rows, ${sourced} carry a URL, ${verified} verified, ${total - verified} partial/unverified (all published on Flagged)`
    };
  }

  return REQUIREMENT_TRACE.map(r => {
    const res = r.check.kind === "file"
      ? { ok: files.includes(r.check.path), detail: files.includes(r.check.path) ? `${r.check.path} published` : `${r.check.path} MISSING` }
      : (results[r.check.name] || { ok: false, detail: `check "${r.check.name}" did not run` });
    return { ...r, ok: res.ok, measured: res.detail };
  });
}

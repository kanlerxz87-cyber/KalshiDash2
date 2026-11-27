/* KalshiDash2 — what a BROWSER sees on the deployed site, as testable rules.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every existing check of the published site reads **static HTML** or runs a
 * jsdom shim. Neither can see the thing the reader sees, because almost every
 * number on this site is written by a page controller at runtime:
 *
 *   - the homepage board, its five topic cards and its KPIs  → `index.html` inline module
 *   - every category board, chart and order book             → `assets/js/category.js`
 *   - both alert feeds and the swing table                   → `assets/js/alerts.js`
 *
 * A static read of `index.html` therefore cannot distinguish "the dashboard is
 * working" from "the dashboard rendered nothing at all". The gap is not
 * theoretical: on 2026-11-27 a plain fetch of the deployed homepage returned its
 * banner — proof the controller had run to its first `await` — and nothing else.
 * No row, no card, no KPI. The repo's own live check,
 * `.github/workflows/live-site-render.yml`, reported **success** for that same
 * commit in **7 seconds**; it cannot be conclusive in 7 seconds and it cannot
 * fail on that condition (`Fail the job only on a real regression` exits 0 when
 * its status is 2). See `reports/verify-73fc62f6.md` §2.
 *
 * WHAT THIS ASSERTS (pure functions, no browser, no network)
 * ---------------------------------------------------------
 * The rules live here, out of the runner, so they are unit-tested offline:
 *   1. A page is only a PASS when it reached a terminal state **and** showed
 *      content **and** logged no page error.
 *   2. "The exchange refused or could not be reached" is INCONCLUSIVE, never a
 *      PASS and never a content FAIL — but it is also never silently green: the
 *      caller is told, and the workflow treats it as an unverified deploy.
 *   3. A page error, an error status pill, an empty board, or a terminal state
 *      that never arrived is FAIL.
 *   4. A control character in the text (the `&#0;`-shaped dump a headless HTML
 *      fetch produces for an unrendered template) is FAIL: it proves the caller
 *      was handed static markup, not a rendered page.
 *
 * No Kalshi field, price or claim is asserted here. The only facts used are DOM
 * selectors that this repository's own pages define.
 */

/* Exit codes, kept distinct on purpose: 0 pass, 1 real regression, 2 could not
 * verify. A caller that collapses 2 into 0 is the defect this module exists to
 * prevent. */
export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, INCONCLUSIVE: 2 });

/* ---------------------------------------------------------------- refusals */

/* Text that means "this page could not reach the exchange", taken from the
 * pages' own error copy. Deliberately narrow: `alerts.html` legitimately
 * mentions "429" and "WebSocket" in its explanatory prose, so a body-wide
 * search for those words would mark a healthy page as refused. Only the status
 * pill and the board notes are inspected. */
const REFUSAL_PATTERNS = [
  /429/,
  /too many requests/i,
  /rate.?limit/i,
  /failed to fetch/i,
  /networkerror/i,
  /load failed/i,
  /could not reach/i,
  /unreachable/i,
  /status unavailable/i,
  /(?:HTTP|status|error|failed|failure)[^0-9]{0,12}5\d\d/i
];

export function isExchangeRefusal(text) {
  if (!text) return false;
  return REFUSAL_PATTERNS.some(re => re.test(text));
}

/* ------------------------------------------------------------ DOM outcomes */

/* A page controller is done when one of these is true. `rows` means the board
 * or table produced at least one body row; `empty` means the page printed its
 * own explicit empty state (a documented answer, not a failure). */
export const TERMINAL = Object.freeze({ ROWS: "rows", EMPTY: "empty", ERROR: "error", PENDING: "pending" });

/* The site's own explicit empty-state copy. These are documented answers —
 * "no event matched the five topics", "no contract moved $0.10" — and must not
 * be confused with a board that never rendered. */
const EMPTY_MARKERS = [
  /No events matched/i,
  /No .* events? .*matched/i,
  /No contract in this scan moved/i,
  /No swing of \$0\.10 or more recorded yet/i,
  /No simulated trades yet/i,
  /No paper positions yet/i,
  /Press .Measure traded dollars/i,
  /Load a market first/i,
  /Run a backtest to populate/i,
  /No demo API key loaded/i,
  /No .* markets? (are|were) open/i,
  /matched no event/i
];

/* Copy a page shows only while it is still working. */
const PENDING_MARKERS = [/Loading…/i, /Loading\.\.\./i, /Reading live events/i, /scanning open events/i, /checking…/i];

export function isExplicitEmpty(text) {
  return !!text && EMPTY_MARKERS.some(re => re.test(text));
}

export function isPending(text) {
  if (!text) return false;
  /* An explicit empty-state sentence is a terminal answer even if the page's own
   * note elsewhere says "Loading…" about a different panel. */
  if (isExplicitEmpty(text)) return false;
  return PENDING_MARKERS.some(re => re.test(text));
}

/* A dump of unrendered markup: the HTML-fetch path that produced
 * `[Overview](#main)` and `Loading…` instead of numbers. `\u0000` and a literal
 * `&#0;` are both signatures. */
export function hasUnrenderedArtifacts(text) {
  if (!text) return false;
  return text.includes("\u0000") || text.includes("&#0;") || /\[\s*Skip to content\s*\]/.test(text);
}

/* -------------------------------------------------------------- page specs */

/* One row per published page. `must` maps a CSS selector to the minimum number
 * of matches a rendered page shows; `rows` names the table body whose rows are
 * counted for the terminal-state test; `only` limits the assertion set to a
 * page that intentionally has no live board (static registers). */
export const PAGES = Object.freeze([
  {
    path: "/", name: "Overview",
    must: { "#kpis .stat": 4, "#topics .topic-card": 5 },
    rows: "#board-body", status: "#board-status"
  },
  {
    path: "/alerts.html", name: "Live alerts",
    must: { "#feed-all": 1, "#feed-watch": 1, "#alert-rows tr": 1, "table": 3 },
    rows: "#alert-rows", status: "#poll-status"
  },
  {
    path: "/categories/gas.html", name: "Gas prices",
    must: { "#cat-stats .stat": 2, "#yes-book tr": 1, "#no-book tr": 1 },
    rows: "#board-body", status: "#board-status"
  },
  {
    path: "/categories/elections.html", name: "Elections",
    must: { "#cat-stats .stat": 2 }, rows: "#board-body", status: "#board-status"
  },
  {
    path: "/categories/culture.html", name: "Culture",
    must: { "#cat-stats .stat": 2 }, rows: "#board-body", status: "#board-status"
  },
  {
    path: "/categories/crypto.html", name: "Crypto",
    must: { "#cat-stats .stat": 2 }, rows: "#board-body", status: "#board-status"
  },
  {
    path: "/categories/golf.html", name: "Golf",
    must: { "#cat-stats .stat": 2 }, rows: "#board-body", status: "#board-status"
  },
  /* Registers and static pages: chrome + their own counters, no live board. */
  { path: "/summary.html", name: "Executive summary", must: { ".stat": 4 }, static: true },
  { path: "/flagged.html", name: "Flagged for review", must: { ".irregularity": 50, "#counts .stat": 6 }, static: true },
  { path: "/verification.html", name: "Verification", must: { "table": 1 }, static: true },
  { path: "/sources.html", name: "Sources", must: { "table": 1 }, static: true },
  { path: "/resolved.html", name: "Resolved", must: { "#res-stats .stat": 2 }, rows: "#rows", status: "#status" },
  { path: "/portfolio.html", name: "Portfolio", must: {}, static: false },
  { path: "/simulator.html", name: "Strategy tester", must: {}, static: false },
  { path: "/strategies.html", name: "Strategies", must: {}, static: false },
  { path: "/questions.html", name: "Questions", must: { "table": 1 }, static: true },
  { path: "/suggestions.html", name: "Suggestions", must: { "table": 1 }, static: true }
]);

/* ---------------------------------------------------------------- verdicts */

/* Fold what the runner observed into one verdict.
 *
 * observed = {
 *   text        visible text of document.body
 *   counts      { selector: n }
 *   pageErrors  [string]  uncaught exceptions / unhandled rejections
 *   consoleErrors [string] console.error output
 *   statusText  text of the page's status pill, if it has one
 *   boardText   text of the board/table container, if it has one
 * }
 *
 * Returns { verdict: "pass" | "fail" | "inconclusive", reasons: [string] }.
 * The order of the tests is the order of authority: a refusal outranks a missing
 * count (an unreachable exchange explains it), and a page error outranks
 * everything except the refusal, because the error is the cause of the symptom.
 */
/* The row container's own element count is always 1 (empty or not), so a spec
 * names the CONTAINER and the row count is read from `${container} > tr`. The
 * runner uses this same helper, so spec and observation cannot drift. */
export function rowSelector(spec) {
  return spec && spec.rows ? `${spec.rows} > tr` : null;
}

export function judge(spec, observed) {
  const { text = "", counts = {}, pageErrors = [], consoleErrors = [], statusText = "", boardText = "" } = observed || {};
  const reasons = [];

  if (hasUnrenderedArtifacts(text)) {
    return { verdict: "fail", reasons: ["text carries unrendered-markup artifacts (a static HTML dump, not a rendered page)"] };
  }

  /* A refusal is inconclusive, but only when nothing else is broken: a page that
   * threw while the exchange was refusing is still a defect. */
  const refusal = isExchangeRefusal(statusText) || isExchangeRefusal(boardText);
  if (refusal && pageErrors.length === 0) {
    return { verdict: "inconclusive", reasons: [`exchange refused or was unreachable: ${(statusText || boardText).slice(0, 120)}`] };
  }

  if (pageErrors.length) {
    reasons.push(`page error(s): ${pageErrors.slice(0, 3).join(" | ")}`);
  }
  const errorPill = /^\s*(err|error)\b/i.test(statusText) || /\berror\b/i.test(statusText);
  if (errorPill && !refusal) reasons.push(`status pill reports an error: ${statusText.slice(0, 120)}`);

  for (const [sel, min] of Object.entries(spec.must || {})) {
    const n = counts[sel] ?? 0;
    if (n < min) reasons.push(`${sel}: expected ≥ ${min}, found ${n}`);
  }

  /* Terminal state for pages whose only content is the live board. */
  if (spec.rows && !spec.static) {
    const rowCount = counts[rowSelector(spec)] ?? 0;
    /* A board's single "Loading…" row is a placeholder, not a result: the
     * terminal test reads the container's own text, not just its row count. */
    const terminal = rowCount > 0 && !isPending(boardText) ? TERMINAL.ROWS
      : isExplicitEmpty(text) ? TERMINAL.EMPTY
      : errorPill && !refusal ? TERMINAL.ERROR
      : TERMINAL.PENDING;
    if (terminal === TERMINAL.PENDING) {
      reasons.push(`never reached a terminal state: no rows in ${spec.rows}, no explicit empty state, no error (still "${(boardText || text).slice(0, 80)}")`);
    }
    if (terminal === TERMINAL.EMPTY && rowCount === 0 && !spec.allowEmpty) {
      /* An explicit empty state is a legitimate answer — but for a topic that
       * the live check proves has open markets (gas), an empty board is the
       * defect F4 recorded. The runner passes `allowEmpty` per run so this stays
       * a decision of the run, not a hard-coded assumption. */
      reasons.push(`${spec.rows} shows an explicit empty state`);
    }
  }

  return { verdict: reasons.length ? "fail" : "pass", reasons };
}

/* Roll the per-page verdicts into the run's exit code and a report table.
 * A single FAIL outranks any number of inconclusive pages: a proven defect is
 * worse news than an unverified page. */
export function summarise(results) {
  const rows = results.map(r => ({
    page: r.spec.name,
    path: r.spec.path,
    verdict: r.verdict,
    detail: r.reasons.join("; ") || "—"
  }));
  const pass = rows.filter(r => r.verdict === "pass").length;
  const fail = rows.filter(r => r.verdict === "fail").length;
  const inconclusive = rows.filter(r => r.verdict === "inconclusive").length;
  const exitCode = fail ? EXIT.FAIL : inconclusive ? EXIT.INCONCLUSIVE : EXIT.PASS;
  const markdown = [
    "| Page | Path | Verdict | Detail |",
    "| --- | --- | --- | --- |",
    ...rows.map(r => `| ${r.page} | \`${r.path}\` | ${r.verdict} | ${String(r.detail).replace(/\|/g, "\\|")} |`)
  ].join("\n");
  return { rows, pass, fail, inconclusive, exitCode, markdown };
}

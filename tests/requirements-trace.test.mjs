/* KalshiDash2 — requirement traceability, pinned in CI.
 *
 * Why this exists
 * ---------------
 * `summary.html` §8 renders a matrix of the brief's requirements and the evidence
 * that each one is wired. That matrix is produced by running the shipped modules
 * (assets/js/trace.js), not by describing them — so the only way it can lie is if
 * nothing checks the result. This file is that check, and it runs in CI:
 *
 *   1. every requirement row must be `ok` against the CURRENT modules, so a
 *      renamed export, a changed threshold or a deleted page fails the build;
 *   2. the threshold row must read the same value the alert engine uses (the
 *      brief says "$0.10", and the page prints the constant, not the string);
 *   3. the values the rows print must be measurements, not prose: they are
 *      recomputed here from `config.js`, `alerts-core.js` and `market.js`;
 *   4. a deliberately broken input must turn a row red — a matrix that cannot
 *      fail is decoration, so the failure path is itself tested.
 *
 * It asserts nothing about Kalshi. Exchange facts live in assets/js/claims.js
 * with their official sources and are counted on the Verification page.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import * as config from "../assets/js/config.js";
import * as alertsCore from "../assets/js/alerts-core.js";
import * as market from "../assets/js/market.js";
import * as kalshi from "../assets/js/kalshi.js";
import * as simulator from "../assets/js/simulator.js";
import * as ui from "../assets/js/ui.js";
import { CLAIMS } from "../assets/js/claims.js";
import { REQUIREMENT_TRACE, runChecks, traceRows } from "../assets/js/trace.js";

const root = process.cwd();
const read = p => readFileSync(join(root, p), "utf8");

/* The published pages, taken from the navigation list (the site's own idea of
 * what exists) plus the five category pages, which the nav also carries. */
const files = [...new Set([
  ...ui.PAGES.map(p => p.href),
  "categories/gas.html", "categories/elections.html", "categories/culture.html",
  "categories/crypto.html", "categories/golf.html"
])];

const deps = { config, alertsCore, market, kalshi, simulator, ui, files };

test("every requirement row is wired to a passing check in this build", () => {
  const rows = traceRows({ ...deps, claims: { CLAIMS } });
  const gaps = rows.filter(r => !r.ok).map(r => `${r.id}: ${r.measured}`);
  assert.deepEqual(gaps, [], "requirement rows that are not wired");
  assert.equal(rows.length, REQUIREMENT_TRACE.length);
  assert.ok(rows.length >= 17, "the brief has at least 17 traced requirements");
});

test("every traced artefact exists in the repository", () => {
  /* The matrix names a page or module per row. A name that does not exist is a
   * broken promise, and is exactly how Flagged F6 ended up citing `site/`. */
  for (const row of REQUIREMENT_TRACE) {
    const named = row.artefact.match(/[A-Za-z0-9_./-]+\.(?:html|js|py)/g) || [];
    assert.ok(named.length > 0, `${row.id} should name at least one file`);
    for (const p of named) {
      assert.ok(existsSync(join(root, p)), `${row.id} names ${p}, which does not exist`);
    }
  }
});

test("the threshold row reports the value the alert engine actually uses", () => {
  const results = runChecks(deps);
  assert.equal(alertsCore.THRESHOLD, 0.1);
  assert.match(results.threshold.detail, /\$0\.10/);
  /* A changed constant must change the row, not pass silently. */
  const mutated = runChecks({ ...deps, alertsCore: { ...alertsCore, THRESHOLD: 0.25, WATCH_RULES: alertsCore.WATCH_RULES, STRATEGIES: alertsCore.STRATEGIES } });
  assert.equal(mutated.threshold.ok, false, "a non-$0.10 threshold must fail the row");
});

test("the window row reflects the windows the chart offers", () => {
  const results = runChecks(deps);
  const keys = config.WINDOWS.map(w => w.key);
  for (const k of keys) assert.ok(results.windows.detail.includes(k), `window ${k} is not reported`);
  assert.equal(results.windows.ok, true);
  /* The brief asks for seconds / minutes / hours; the config must keep one of each. */
  assert.ok(keys.some(k => k.endsWith("s")) && keys.some(k => k.endsWith("m")) && keys.some(k => k.endsWith("h")));
});

test("the liquidity row is computed from the reciprocal rule, and an empty book is n/a", () => {
  const results = runChecks(deps);
  const q = kalshi.deriveQuote({ orderbook_fp: { yes_dollars: [["0.4200", "13.00"]], no_dollars: [["0.5600", "17.00"]] } });
  assert.equal(q.bestYesAsk, 0.44, "1 − best NO bid");
  assert.equal(q.bestYesBid, 0.42);
  assert.match(results.liquidity.detail, /0\.44/);
  const empty = kalshi.deriveQuote({ orderbook_fp: { yes_dollars: [], no_dollars: [] } });
  assert.equal(empty.bestYesBid, null, "an empty book is n/a, never 0.00");
});

test("the resolution row refuses to call an active market settled", () => {
  const results = runChecks(deps);
  assert.equal(results.resolution.ok, true);
  assert.match(results.resolution.detail, /active → not settled/);
  /* scalar is a documented result value; it must not be coerced to yes/no. */
  assert.equal(market.isSettledMarket({ result: "scalar", status: "finalized" }), true);
  assert.equal(market.isSettledMarket({ result: "yes", status: "active" }), true, "a result is authoritative");
  assert.equal(market.isSettledMarket({ result: "", status: "active" }, Date.parse("2020-01-01T00:00:00Z")), false);
});

test("the CSV row counts the columns the exporter actually writes", () => {
  const results = runChecks(deps);
  const header = String(simulator.tradesToCsv([])).split(/\r?\n/)[0];
  const cells = (header.match(/"(?:[^"]|"")*"/g) || []).length;
  assert.ok(cells > 10, "the export should carry a full trade row");
  assert.match(results.csv.detail, new RegExp(`${cells} columns`));
});

test("the traceability table is rendered on the summary page", () => {
  const html = read("summary.html");
  assert.match(html, /id="trace-body"/, "summary must carry the trace table body");
  assert.match(html, /from "\.\/assets\/js\/trace\.js"/, "summary must import the trace module");
  assert.match(html, /traceRows\(/, "summary must call traceRows(), not a copied list");
});

test("a broken dependency turns a row red — the matrix can fail", () => {
  const broken = traceRows({
    ...deps,
    alertsCore: { ...alertsCore, THRESHOLD: 0.5 },
    files: files.filter(f => f !== "categories/golf.html")
  });
  const failed = broken.filter(r => !r.ok).map(r => r.id);
  assert.ok(failed.includes("R3"), "a wrong threshold must fail R3");
  assert.ok(failed.includes("R14"), "a missing category page must fail R14");
  assert.ok(failed.length >= 2);
});

test("no requirement row asserts an exchange fact of its own", () => {
  /* The rule that keeps this file honest: facts belong in claims.js, with a
   * URL. A brief/evidence line here that contains a docs URL would be a second
   * register, and the two would drift. */
  for (const row of REQUIREMENT_TRACE) {
    const text = `${row.brief} ${row.evidence} ${row.artefact}`;
    assert.doesNotMatch(text, /https?:\/\//, `${row.id} must not cite an external URL`);
  }
  /* And every register row still carries a source URL. */
  for (const c of CLAIMS) {
    assert.match(String(c.source || ""), /^https?:\/\//, `claim without a source URL: ${c.claim}`);
  }
});

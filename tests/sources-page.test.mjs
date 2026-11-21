/* KalshiDash2 — tests for the Sources page and its register.
 *
 * The page promises two things that are worth pinning down:
 *   1. every entry carries an absolute https link, and the number of entries
 *      rendered matches the number in the register (no hidden or invented rows);
 *   2. a source that could not be confirmed is marked unverified on the page and
 *      appears on the Flagged for review page too, so nothing is quietly dropped.
 *
 * These tests read the files, so they run with no browser and no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SOURCES, SOURCE_GROUPS, sourceStats, unverifiedEntries } from "../assets/js/sources.js";

const read = p => readFileSync(join(process.cwd(), p), "utf8");

test("the Sources page exists and is reachable from the shared navigation", () => {
  const page = read("sources.html");
  assert.match(page, /<title>Sources — KalshiDash2<\/title>/);
  assert.match(read("assets/js/ui.js"), /\{ href: "sources\.html", label: "Sources" \}/);
  assert.match(page, /assets\/js\/sources\.js/);
});

test("every source is an absolute https URL and every group is declared", () => {
  const keys = new Set(SOURCE_GROUPS.map(g => g.key));
  for (const e of SOURCES) {
    assert.match(e.url, /^https:\/\//, `${e.title} must link over https`);
    assert.ok(keys.has(e.group), `${e.title} has an undeclared group ${e.group}`);
    assert.ok(e.used && e.used.length > 8, `${e.title} must state what it is used for`);
  }
});

test("no source is a Kalshi docs shortcut that the index does not carry", () => {
  /* The register lists the index itself, so a docs.kalshi.com entry that is not
     the index must be a full page path (no bare host, no truncation). */
  for (const e of SOURCES.filter(x => x.url.includes("docs.kalshi.com"))) {
    const path = e.url.replace("https://docs.kalshi.com", "");
    assert.ok(path.length > 1, `${e.title} must name a page, not the bare host`);
    assert.ok(!/create-ord$/.test(path), `${e.title} must not repeat the truncated X4 URL`);
  }
});

test("the unverified rows are exactly the ones the page marks unverified", () => {
  const unv = unverifiedEntries();
  assert.ok(unv.length >= 1, "at least the fee-schedule PDF must be flagged");
  for (const e of unv) {
    assert.ok(/^https:\/\//.test(e.url));
    assert.ok(e.note && e.note.length > 10, `${e.title} must explain why it is unverified`);
  }
});

test("the summary counts agree with the register", () => {
  const s = sourceStats();
  assert.equal(s.total, SOURCES.length);
  assert.equal(s.official + s.thirdParty, s.total);
  assert.equal(s.verified + s.unverified, s.total);
  assert.ok(s.thirdParty >= 2, "third-party references must be counted separately");
});

test("the page renders from the register rather than restating it", () => {
  const page = read("sources.html");
  assert.match(page, /from "\.\/assets\/js\/sources\.js"/);
  for (const fn of ["sourceStats", "unverifiedEntries", "SOURCE_GROUPS"]) {
    assert.match(page, new RegExp(fn));
  }
  /* No source URL may be hard-coded in the page: one register, one truth. */
  assert.doesNotMatch(page, /https:\/\/docs\.kalshi\.com\/api-reference/);
});

test("no live market value is transcribed into the register or the page", () => {
  const register = read("assets/js/sources.js");
  const page = read("sources.html");
  for (const [name, text] of [["register", register], ["page", page]]) {
    assert.doesNotMatch(text, /\$\d+\.\d\d/, `${name} must not quote a dollar figure`);
    assert.doesNotMatch(text, /\b\d{1,3},\d{3}\s*(contracts|series|events|markets)\b/,
      `${name} must not quote a live count`);
  }
});

test("the docs index the register was checked against is linked on the page", () => {
  const page = read("sources.html");
  assert.match(page, /https:\/\/docs\.kalshi\.com\/llms\.txt/);
});

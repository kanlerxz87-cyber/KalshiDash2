import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const read = path => readFileSync(join(process.cwd(), path), "utf8");

const rootPages = [
  "index.html", "alerts.html", "event.html",
  "categories/gas.html", "categories/elections.html", "categories/culture.html",
  "categories/crypto.html", "categories/golf.html"
];

test("root market-activity displays call the volume-price figure a proxy", () => {
  for (const path of rootPages) {
    const html = read(path);
    assert.doesNotMatch(html, /money traded/i, `${path} must not label the proxy as money traded`);
  }
  for (const path of ["index.html", "alerts.html", ...rootPages.filter(p => p.startsWith("categories/"))]) {
    assert.match(read(path), /proxy/i, `${path} should identify the ranking limitation`);
  }
});

test("proxy and snapshot limitations link to official market/trade schemas", () => {
  const flagged = read("flagged.html");
  assert.match(flagged, /id="A11"[\s\S]*?https:\/\/docs\.kalshi\.com\/api-reference\/market\/get-market/);
  assert.match(flagged, /id="A11"[\s\S]*?https:\/\/docs\.kalshi\.com\/api-reference\/market\/get-trades/);
  assert.match(flagged, /id="A12"[\s\S]*?https:\/\/docs\.kalshi\.com\/api-reference\/market\/get-trades/);
  assert.match(read("assets/js/claims.js"), /flag: "A11"/);
});

test("captured trade arithmetic is not named or described as exact dollar notional", () => {
  const snapshot = JSON.parse(read("data/snapshot.json"));
  const notes = snapshot._meta.derivation_notes;

  // The disclosure text has exactly one source: scripts/collect.py. Read it from
  // the generator itself (no network) so rewording the generator cannot break
  // this test, and a snapshot that drifts from the generator cannot pass it.
  const generated = JSON.parse(execFileSync(
    "python3", ["scripts/collect.py", "--print-notes"], { encoding: "utf8", cwd: process.cwd() }
  ));
  assert.deepEqual(notes, generated, "committed snapshot notes must equal the generator's notes");

  const sample = generated.sampled_yes_price_times_contracts;
  assert.match(sample, /No min_ts time bound/);
  assert.match(sample, /not asserted as actual all-side cash turnover/);
  assert.match(generated.contract_volume, /fixed-point contract counts/);
  assert.match(generated.contract_volume, /not traded-dollar volume/);
  assert.ok(!Object.hasOwn(notes, "traded_notional_dollars"));
  const marketRows = Object.values(snapshot.topics).flatMap(topic => topic.markets || []);
  assert.ok(marketRows.every(row => !Object.hasOwn(row, "_traded_notional_dollars")));
  assert.ok(marketRows.every(row => Object.hasOwn(row, "_sampled_yes_price_times_contracts")));
  assert.doesNotMatch(read("scripts/collect.py"), /Exact traded notional/);
});

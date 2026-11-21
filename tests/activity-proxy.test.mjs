import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert.ok(notes.sampled_yes_price_times_contracts.includes("No min_ts time bound"));
  assert.ok(notes.sampled_yes_price_times_contracts.includes("not asserted as actual all-side cash turnover"));
  assert.ok(!Object.hasOwn(notes, "traded_notional_dollars"));
  const marketRows = Object.values(snapshot.topics).flatMap(topic => topic.markets || []);
  assert.ok(marketRows.every(row => !Object.hasOwn(row, "_traded_notional_dollars")));
  assert.ok(marketRows.every(row => Object.hasOwn(row, "_sampled_yes_price_times_contracts")));
  assert.doesNotMatch(read("scripts/collect.py"), /Exact traded notional/);
});

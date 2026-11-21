// Offline proof of the Gas-page rule used by the live render probe.
//
// The live probe cannot be run in this sandbox (no TLS to the exchange), so the
// assertion that kept failing is pinned here against the page's real rendered
// markup. If someone narrows or widens the rule, these cases fail.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gasBoardState } from "./gas-assertion.mjs";

// The callout the Gas page renders when a scan matches nothing. Taken from
// assets/js/category.js so a wording change there is noticed here.
const callout = (topic = "gas prices") =>
  `<div class="callout warn"><h3>No ${topic} events in this scan</h3>` +
  `<p>The scan returned 1,000 open event(s) and none matched this topic's documented rule.` +
  `That is a result of this scan, not a claim that the topic is empty on Kalshi.</p></div>`;

test("the page still renders the no-match callout this rule looks for", () => {
  const category = readFileSync("assets/js/category.js", "utf8");
  assert.match(category, /No \$\{esc\(res\.topic\.label\)\} events in this scan/,
    "category.js must still emit the no-match heading the probe matches");
  assert.equal(gasBoardState({ caveat: callout() }).ok, true);
});

test("a live gas market renders and passes", () => {
  const verdict = gasBoardState({ board: "KXAAAGASM-26JAN · $3.10 · 1,204 contracts" });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.noMatch, false);
});

test("the page's explicit no-match state passes", () => {
  const verdict = gasBoardState({ board: "", caveat: callout(), statusClass: "pill warn" });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.noMatch, true);
  assert.match(verdict.reason, /no matching open gas market/);
});

test("an empty board with no explanation still fails", () => {
  const verdict = gasBoardState({ board: "", caveat: "", statusClass: "pill warn" });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /neither a gas market nor the page's no-match callout/);
});

test("a no-match callout alongside a page error fails", () => {
  const verdict = gasBoardState({
    board: "", caveat: callout(), statusClass: "pill warn", errors: ["TypeError: x is undefined"],
  });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /also reported a failure/);
});

test("a no-match callout alongside an error-state status pill fails", () => {
  const verdict = gasBoardState({ board: "", caveat: callout(), statusClass: "pill err" });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /also reported a failure/);
});

test("a different topic's callout does not satisfy the gas rule for an empty board", () => {
  // The rule is about the shape of the page's own message; a golf callout passed
  // in place of a board is still a gas page that rendered nothing.
  const verdict = gasBoardState({ board: "", caveat: "", statusClass: "pill live" });
  assert.equal(verdict.ok, false);
});

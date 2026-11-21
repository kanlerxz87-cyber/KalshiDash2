// Guards against re-publishing a wording correction that was wrong.
//
// 2026-11-21: the claims register and Flagged card A9 stated that the Get
// Markets `status` filter advertises five values including `paused`. The Get
// Markets reference lists four (unopened, open, closed, settled); the five-value
// table with `paused` -> `inactive` is on the Market Lifecycle page. Both pages
// are official and they disagree, so the site must attribute each wording to its
// own page instead of merging them into one claim.
//
// Sources:
//   https://docs.kalshi.com/api-reference/market/get-markets
//   https://docs.kalshi.com/getting_started/market_lifecycle
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = path => readFileSync(join(process.cwd(), path), "utf8");

const GET_MARKETS = "https://docs.kalshi.com/api-reference/market/get-markets";
const LIFECYCLE = "https://docs.kalshi.com/getting_started/market_lifecycle";

test("the status claim attributes each vocabulary to its own official page", () => {
  const claims = read("assets/js/claims.js");
  const at = claims.indexOf('claim: "Market status filter values"');
  assert.ok(at > 0, "the status claim must still exist in the register");

  // The register entries live inside one array literal and interpolate `${D}`,
  // so brace-balanced matching is unreliable here; a window is enough to prove
  // the attribution, since the assertion is about which links the entry cites.
  const block = claims.slice(Math.max(0, at - 200), at + 900);
  assert.match(block, /\/api-reference\/market\/get-markets/,
    "the claim must cite the Get Markets reference, where the four-value list lives");
  assert.match(block, /Market Lifecycle/,
    "the claim must name the Market Lifecycle page as the source of the paused mapping");
  assert.match(block, /disagree/,
    "the claim must state that the two official pages disagree");
  assert.match(block, /unopened, open, closed, settled/,
    "the claim must quote the four Get Markets filter values verbatim");
});

test("the wrong merged statement is gone from every published page", () => {
  // The exact sentence that was published and had to be retracted.
  const wrong = /Get Markets <code>status<\/code> filter lists <code>unopened<\/code>, <code>open<\/code>, <code>paused<\/code>/;
  for (const page of ["flagged.html", "verification.html", "docs/verification.html", "docs/sources.html"]) {
    assert.doesNotMatch(read(page), wrong, `${page} must not attribute the paused value to Get Markets`);
  }
});

test("A9 cites both official pages and keeps the unresolved part explicit", () => {
  const flagged = read("flagged.html");
  const card = flagged.match(/id="A9"[\s\S]*?<\/div>\s*\n\s*<div class="irregularity"/);
  assert.ok(card, "Flagged card A9 must exist");
  assert.match(card[0], new RegExp(GET_MARKETS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(card[0], new RegExp(LIFECYCLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(card[0], /Still unverified/, "the unknown must be labelled, not filled in");
  assert.match(card[0], /Correction/, "the retraction must be visible on the card");
});

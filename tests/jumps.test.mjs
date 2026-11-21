// Unit tests for the canonical chart jump detection in assets/js/market.js.
// Run: node --test tests/jumps.test.mjs
//
// The threshold is the brief's $0.10, inclusive, float-safe — the same rule
// the live alert feeds use (assets/js/alerts-core.js THRESHOLD).
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectJumps, jumpMarkers, JUMP_THRESHOLD } from "../assets/js/market.js";

test("threshold constant is the brief's $0.10", () => {
  assert.equal(JUMP_THRESHOLD, 0.10);
});

test("a move of exactly $0.10 up is a jump (float-safe)", () => {
  const jumps = detectJumps(
    [{ t: 1000, y: 0.45 }, { t: 2000, y: 0.55 }],
    { threshold: 0.10 }
  );
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].delta, 0.1);
  assert.equal(jumps[0].direction, "up");
  assert.equal(jumps[0].dir, "up");
  assert.equal(jumps[0].from, 0.45);
  assert.equal(jumps[0].to, 0.55);
});

test("a $0.09 move is not a jump; a $0.12 move down is", () => {
  assert.equal(detectJumps([{ t: 1, y: 0.45 }, { t: 2, y: 0.54 }]).length, 0);
  const down = detectJumps([{ t: 1, y: 0.45 }, { t: 2, y: 0.33 }]);
  assert.equal(down.length, 1);
  assert.equal(down[0].direction, "down");
  assert.equal(down[0].delta, -0.12);
});

test("null-y gaps are skipped and the comparison crosses the gap", () => {
  const jumps = detectJumps([
    { t: 1000, y: 0.50 },
    { t: 2000, y: null },
    { t: 3000, y: 0.62 }
  ]);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].from, 0.50);
  assert.equal(jumps[0].to, 0.62);
});

test("a candle's own prev (previous_dollars) is the comparison when present", () => {
  const jumps = detectJumps([
    { t: 1000, y: 0.40, prev: 0.40 },
    { t: 2000, y: 0.55, prev: 0.40 }
  ]);
  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].from, 0.40);
  assert.equal(jumps[0].delta, 0.15);
});

test("jumpMarkers returns the {t, y, dir} shape ui.js lineChart draws", () => {
  const jumps = detectJumps([{ t: 1000, y: 0.45 }, { t: 2000, y: 0.55 }]);
  const markers = jumpMarkers(jumps);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].t, 2000);
  assert.equal(markers[0].y, 0.55);
  assert.equal(markers[0].dir, "up");
  assert.equal(markers[0].delta, 0.1);
});

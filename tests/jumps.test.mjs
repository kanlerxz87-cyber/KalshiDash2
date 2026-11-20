/* Tests for assets/js/jumps.js — chart sharp-move detection.
 * Run: node --test tests/jumps.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import { detectJumps, jumpMarkers, JUMP_THRESHOLD } from "../assets/js/jumps.js";

test("threshold constant matches the alert engine ($0.10)", () => {
  assert.equal(JUMP_THRESHOLD, 0.10);
});

test("exact $0.10 move counts as a jump (float-safe)", () => {
  const j = detectJumps([{ t: 1, y: 0.20 }, { t: 2, y: 0.30 }]);
  assert.equal(j.length, 1);
  assert.equal(j[0].delta, 0.10);
  assert.equal(j[0].direction, "up");
});

test("exact −$0.10 move counts as a jump", () => {
  const j = detectJumps([{ t: 1, y: 0.30 }, { t: 2, y: 0.20 }]);
  assert.equal(j.length, 1);
  assert.equal(j[0].direction, "down");
});

test("$0.0999 move does not alert", () => {
  const j = detectJumps([{ t: 1, y: 0.20 }, { t: 2, y: 0.2999 }]);
  assert.equal(j.length, 0);
});

test("zero delta does not alert", () => {
  const j = detectJumps([{ t: 1, y: 0.50 }, { t: 2, y: 0.50 }]);
  assert.equal(j.length, 0);
});

test("null price points are gaps: comparison crosses them like the plotted line", () => {
  const j = detectJumps([
    { t: 1, y: 0.10 }, { t: 2, y: null }, { t: 3, y: 0.25 }
  ]);
  assert.equal(j.length, 1);
  assert.equal(j[0].from, 0.10);
  assert.equal(j[0].to, 0.25);
});

test("first priced point sets a baseline and cannot jump", () => {
  const j = detectJumps([{ t: 1, y: null }, { t: 2, y: 0.90 }]);
  assert.equal(j.length, 0);
});

test("single point and empty series produce no jumps", () => {
  assert.equal(detectJumps([{ t: 1, y: 0.5 }]).length, 0);
  assert.equal(detectJumps([]).length, 0);
  assert.equal(detectJumps(null).length, 0);
});

test("multiple jumps are all recorded with both endpoints", () => {
  const j = detectJumps([
    { t: 1, y: 0.10 }, { t: 2, y: 0.35 }, { t: 3, y: 0.30 }, { t: 4, y: 0.05 }
  ]);
  // +$0.25 (1→2) and −$0.25 (3→4) are jumps; the −$0.05 step (2→3) is not.
  assert.equal(j.length, 2);
  assert.deepEqual(j.map(x => x.delta), [0.25, -0.25]);
  assert.equal(j[1].fromT, 3);
  assert.equal(j[1].from, 0.30);
});

test("candles record intra-period range; live points leave it null", () => {
  const j = detectJumps([
    { t: 1, y: 0.20, high: 0.20, low: 0.20 },
    { t: 2, y: 0.35, high: 0.40, low: 0.32, volume: 123 }
  ]);
  assert.equal(j.length, 1);
  assert.equal(j[0].intraRange, 0.08);
  assert.equal(j[0].volume, 123);
  const k = detectJumps([{ t: 1, y: 0.20 }, { t: 2, y: 0.35 }]);
  assert.equal(k[0].intraRange, null);
  assert.equal(k[0].volume, null);
});

test("custom threshold is honoured", () => {
  const pts = [{ t: 1, y: 0.10 }, { t: 2, y: 0.15 }];
  assert.equal(detectJumps(pts, { threshold: 0.05 }).length, 1);
  assert.equal(detectJumps(pts, { threshold: 0.10 }).length, 0);
});

test("jumpMarkers maps to chart marker shape", () => {
  const j = detectJumps([{ t: 1, y: 0.20 }, { t: 2, y: 0.30 }]);
  assert.deepEqual(jumpMarkers(j), [{ t: 2, y: 0.30, up: true, delta: 0.10 }]);
});

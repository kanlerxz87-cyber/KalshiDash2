// X-axis tick labels for the price chart.
// Run: node --test tests/chart-axis.test.mjs
//
// The brief asks for a chart whose X axis is time and whose length is
// selectable in seconds, minutes or hours. A label that shows only the clock
// time is wrong for the long windows: on the 24-hour and 7-day windows the same
// "03:30" would repeat with no date, so two points days apart look identical.
// `timeTickLabel()` (assets/js/ui.js) is the single place that format is chosen;
// these cases pin it. Locale and time zone are passed explicitly so the test
// does not depend on the runner's settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { timeTickLabel } from "../assets/js/ui.js";

const T = Date.UTC(2026, 10, 21, 15, 30, 0); // 2026-11-21 15:30:00 UTC
const opts = { locale: "en-US", timeZone: "UTC" };
const label = spanMs => timeTickLabel(T, spanMs, opts);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

test("a 10-second window labels ticks to the second", () => {
  assert.equal(label(10 * SECOND), "03:30:00 PM");
});

test("a 1-minute window still labels to the second", () => {
  assert.equal(label(1 * MINUTE), "03:30:00 PM");
});

test("a 5-minute window still labels to the second", () => {
  assert.equal(label(5 * MINUTE), "03:30:00 PM");
});

test("the 10-minute boundary still labels to the second", () => {
  assert.equal(label(10 * MINUTE), "03:30:00 PM");
});

test("an 11-minute window labels to the minute", () => {
  assert.equal(label(11 * MINUTE), "03:30 PM");
});

test("the 1-hour, 6-hour and 12-hour windows label clock time only", () => {
  assert.equal(label(1 * HOUR), "03:30 PM");
  assert.equal(label(6 * HOUR), "03:30 PM");
  assert.equal(label(12 * HOUR), "03:30 PM");
});

test("the 24-hour window carries the calendar date", () => {
  const out = label(24 * HOUR);
  assert.match(out, /Nov 21/, "the date is present, so midnight is distinguishable");
  assert.match(out, /03:30 PM/, "the clock time is still present");
});

test("the 7-day window carries the calendar date", () => {
  const out = label(7 * 24 * HOUR);
  assert.match(out, /Nov 21/);
  assert.match(out, /03:30 PM/);
});

test("a date-qualified label differs from a time-only label at the same instant", () => {
  assert.notEqual(label(7 * 24 * HOUR), label(1 * HOUR));
});

test("the same instant in a different time zone is labelled in that zone", () => {
  const ny = timeTickLabel(T, 7 * 24 * HOUR, { locale: "en-US", timeZone: "America/New_York" });
  assert.match(ny, /Nov 21/);
  assert.match(ny, /10:30 AM/, "15:30 UTC is 10:30 in New York on 2026-11-21");
});

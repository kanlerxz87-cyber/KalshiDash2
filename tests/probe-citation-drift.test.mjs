/* Dated citations must match the pinned capture, not the scheduled rolling probe. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = p => readFileSync(join(root, p), "utf8");

const probe = JSON.parse(read("data/probe/api_surface_2026-11-24.json"));
const snapshot = JSON.parse(read("data/snapshot.json"));
const flagged = read("flagged.html");
const claims = read("assets/js/claims.js");

const fmt = n => Number(n).toLocaleString("en-US"); // 5430 -> "5,430"

test("the probe figures the site publishes are the ones the pinned probe file holds", () => {
  assert.ok(flagged.includes("data/probe/api_surface_2026-11-24.json"));
  const cases = [
    { label: "Elections", value: probe.categories.Elections },
    { label: "Sports", value: probe.categories.Sports },
    { label: "Entertainment", value: probe.categories.Entertainment }
  ];
  for (const { label, value } of cases) {
    assert.ok(Number.isFinite(value), `probe file must carry a ${label} count`);
    assert.ok(
      flagged.includes(`${label} ${fmt(value)}`),
      `flagged.html must publish ${label} ${fmt(value)} (the pinned probe value)`
    );
  }
  assert.ok(
    flagged.includes(`${fmt(probe.series_rows_in_single_response)} rows`),
    "flagged.html must publish the committed series_rows_in_single_response"
  );
});

test("a probe figure is never published in claims.js without its capture time", () => {
  /* claims.js quotes the probe vocabulary in three rows. Each must name the
   * artifact AND a capture stamp, otherwise the number is an undated claim about
   * a file that changes under it. */
  const rows = claims.split("\n").filter(l => l.includes("api_surface_2026-11-24.json"));
  assert.ok(rows.length >= 3, "claims.js should still cite the probe artifact");
  for (const row of rows) {
    assert.match(
      row,
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z/,
      `every probe citation needs a capture stamp: ${row.slice(0, 90)}`
    );
  }
});

test("the retired topic series_count key must not return to the snapshot", () => {
  for (const [topic, body] of Object.entries(snapshot.topics)) {
    assert.ok(
      !("series_count" in body),
      `${topic} must not carry series_count again — it is not a catalogue size (Flagged C1)`
    );
    assert.ok(
      Number.isInteger(body.series_rows_kept_for_topic),
      `${topic} must keep series_rows_kept_for_topic as an integer`
    );
    assert.ok(
      body.series_rows_kept_for_topic >= (body.series || []).length,
      `${topic}: rows kept cannot be fewer than the rows emitted`
    );
  }
});

test("the collector writes the renamed field, not the retired one", () => {
  const py = read("scripts/collect.py");
  assert.ok(py.includes('"series_rows_kept_for_topic": len(tk_series)'));
  assert.ok(
    !/"series_count":/.test(py),
    "scripts/collect.py must not write the retired series_count key"
  );
});

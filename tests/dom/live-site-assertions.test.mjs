/* Offline regression tests for the live-render verifier's parsing helpers.
 * No jsdom, no esbuild, no network: runs in the normal `node --test` step. */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseScanCount, formatCount, refusalReason, boardOutcome, EXIT
} from "./live-site-assertions.mjs";

test("scan count parses comma-formatted thousands (the bug that broke live-site-render)", () => {
  const note = `Ranked by Volume × price proxy — formula. Top 25 shown. Scanned ${formatCount(1234)} events at 7:31:00 PM (1,180 open · 54 closed).`;
  assert.equal(parseScanCount(note), 1234);
  // The old assertion could not match this string; prove it here.
  assert.equal(/Scanned \d+ events/.test(note), false);
});

test("scan count parses small values and rejects absent text", () => {
  assert.equal(parseScanCount("Scanned 42 events at 9:00:00 AM"), 42);
  assert.equal(parseScanCount("Scanned 0 events"), 0);
  assert.equal(parseScanCount("Scanned 1,000,000 events"), 1000000);
  assert.equal(parseScanCount("no scan note"), null);
  assert.equal(parseScanCount(""), null);
  assert.equal(parseScanCount(undefined), null);
});

test("formatCount matches assets/js/ui.js int() output", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1234), "1,234");
});

test("rate limiting and transport failures are classified as refusals", () => {
  assert.equal(refusalReason("429 rate_limited on /events?status=open"), "HTTP 429");
  assert.equal(refusalReason("503 Service Unavailable on /events"), "HTTP 503");
  assert.equal(refusalReason("TypeError: Failed to fetch"), "transport");
  assert.equal(refusalReason("getaddrinfo EAI_AGAIN"), "transport");
});

test("a 4xx that is not rate limiting stays a real failure", () => {
  assert.equal(refusalReason("400 bad_request on /events"), null);
  assert.equal(refusalReason("404 not_found on /markets/X"), null);
  assert.equal(refusalReason("no error here"), null);
});

test("a populated board is populated regardless of pill text", () => {
  assert.equal(boardOutcome({ boardText: "KXAAAGAS-25DEC yes 0.42", statusClass: "pill live" }).outcome, "populated");
});

test("an explained empty scan is a result, not a defect", () => {
  const r = boardOutcome({
    boardText: "The live API returned no Gas events in this scan.",
    caveatText: "The scan returned 1,180 open event(s) (1,180 open) and none matched this topic's documented rule.",
    statusClass: "pill live", statusText: "live · 0 events / 0 markets"
  });
  assert.equal(r.outcome, "no-match");
});

test("an unexplained empty board is a defect", () => {
  const r = boardOutcome({ boardText: "", caveatText: "", statusClass: "pill warn", statusText: "loading…" });
  assert.equal(r.outcome, "empty");
});

test("a refused request is not reported as a content regression", () => {
  const r = boardOutcome({
    boardText: "Could not load events: 429 rate_limited on /events?status=open",
    statusClass: "pill err", statusText: "429 rate_limited on /events?status=open"
  });
  assert.equal(r.outcome, "refused");
  assert.equal(r.reason, "HTTP 429");
});


test("static page prose is never mistaken for a transport failure", () => {
  // Regression: a bare /socket/ pattern matched the page's own "WebSocket" copy,
  // which marked a healthy page as refused and turned a real run inconclusive.
  const prose = "Build. REST base external-api.demo.kalshi.co/trade-api/v2 WebSocket "
    + "external-api-ws.demo.kalshi.co Exchange status check in progress. Rate limits apply. "
    + "The scanner waits a timeout before refreshing.";
  assert.equal(refusalReason(prose), null);
});

test("explicit transport failures still classify", () => {
  assert.equal(refusalReason("TypeError: Failed to fetch"), "transport");
  assert.equal(refusalReason("socket disconnected before secure TLS connection"), "transport");
  assert.equal(refusalReason("getaddrinfo EAI_AGAIN"), "transport");
});

test("a non-refusal error pill is a failure, not inconclusive", () => {
  const r = boardOutcome({
    boardText: "Could not load events: 400 bad_request on /events",
    statusClass: "pill err", statusText: "400 bad_request on /events"
  });
  assert.equal(r.outcome, "error");
});

test("an error pill with no code at all is still a failure", () => {
  const r = boardOutcome({ boardText: "", statusClass: "pill err", statusText: "something went wrong" });
  assert.equal(r.outcome, "error");
});

test("exit codes keep inconclusive distinct from pass and fail", () => {
  assert.equal(EXIT.PASS, 0);
  assert.equal(EXIT.FAIL, 1);
  assert.equal(EXIT.INCONCLUSIVE, 2);
  assert.notEqual(EXIT.INCONCLUSIVE, EXIT.PASS);
});

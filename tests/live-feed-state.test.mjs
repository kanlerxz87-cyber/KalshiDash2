import test from "node:test";
import assert from "node:assert/strict";
import { LiveFeed, FEED_STATE } from "../assets/js/live-feed.js";

class FakeEventSource {
  static latest;
  constructor() { FakeEventSource.latest = this; }
  close() {}
  message(data) { this.onmessage({ data: JSON.stringify(data) }); }
}

test("relay status gates LIVE, falls back on disconnect and resets tick baselines", () => {
  const original = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  const states = [];
  const swings = [];
  const feed = new LiveFeed({ onState: state => states.push(state), onSwing: swing => swings.push(swing) });
  try {
    feed.start();
    const es = FakeEventSource.latest;
    es.onopen();
    assert.equal(states.at(-1), FEED_STATE.CONNECTING);
    es.message({ type: "hello", state: "error" });
    assert.equal(states.at(-1), FEED_STATE.UNAVAILABLE);
    es.message({ type: "ticker", market_ticker: "M1", price_dollars: "0.20" });
    assert.equal(feed.last.size, 0);
    es.message({ type: "state", state: "connected" });
    assert.equal(states.at(-1), FEED_STATE.LIVE);
    es.message({ type: "ticker", market_ticker: "M1", price_dollars: "0.20" });
    assert.equal(feed.last.size, 1);
    es.message({ type: "state", state: "closed", detail: "reconnecting" });
    assert.equal(states.at(-1), FEED_STATE.UNAVAILABLE);
    assert.equal(feed.last.size, 0);
    es.message({ type: "ticker", market_ticker: "M1", price_dollars: "0.40" });
    assert.equal(feed.last.size, 0);
    es.message({ type: "state", state: "connected" });
    es.message({ type: "ticker", market_ticker: "M1", price_dollars: "0.40" });
    assert.equal(swings.length, 0, "first tick after reconnection is a new baseline");
    es.message({ type: "ticker", market_ticker: "M1", price_dollars: "0.50" });
    assert.equal(swings.length, 1);
    es.onerror();
    assert.equal(states.at(-1), FEED_STATE.UNAVAILABLE);
    assert.equal(feed.last.size, 0);
  } finally {
    feed.stop();
    globalThis.EventSource = original;
  }
});

test("unknown and unauthorized relay states are not live", () => {
  const original = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  const states = [];
  const feed = new LiveFeed({ onState: state => states.push(state) });
  try {
    feed.start();
    const es = FakeEventSource.latest;
    for (const state of ["idle", "connecting", "unauthorized", "error", "closed", undefined]) {
      es.message({ type: "state", state });
      assert.equal(states.at(-1), FEED_STATE.UNAVAILABLE);
    }
  } finally {
    feed.stop();
    globalThis.EventSource = original;
  }
});

// Unit tests for the topic taxonomy and the multivariate ("combo") classifier.
// Run: node --test tests/
//
// Every case here is drawn from a real shape observed on the Kalshi demo API or
// from the documented schemas, so a regression shows up as a failing case rather
// than as a silently mis-filed event on the published site.
//
// Sources:
//   GET /events                      https://docs.kalshi.com/api-reference/events/get-events
//   GET /events/multivariate         https://docs.kalshi.com/api-reference/events/get-multivariate-events
//   Get Market (price/size fields)   https://docs.kalshi.com/api-reference/market/get-market
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyEvent, classifyMultivariate, classifyMultivariateList,
  classifyEventWithBasis, fetchSeriesCategories, primeSeriesCategories,
  clearSeriesCategoryCache, seriesCategoriesFor
} from "../assets/js/market.js";
import { TOPICS } from "../assets/js/config.js";

const ev = (over = {}) => ({ event_ticker: "EV", title: "t", category: "", series_ticker: "", ...over });

test("category topics classify by their documented category", () => {
  assert.equal(classifyEvent(ev({ category: "Elections" })), "elections");
  assert.equal(classifyEvent(ev({ category: "Crypto" })), "crypto");
  assert.equal(classifyEvent(ev({ category: "Culture" })), "culture");
  assert.equal(classifyEvent(ev({ category: "Entertainment" })), "culture");
  assert.equal(classifyEvent(ev({ category: "Social" })), "culture");
});

test("gas matches the KXAAAGAS* series and never crude/natgas/diesel/Vegas", () => {
  assert.equal(classifyEvent(ev({
    series_ticker: "KXAAAGASW", category: "Economics",
    title: "US gas prices this week", sub_title: "On Nov 23, 2026"
  })), "gas");
  for (const bad of [
    { series_ticker: "KXNATGASW", title: "Natural gas price" },
    { series_ticker: "KXWTI", title: "WTI crude oil price" },
    { series_ticker: "KXDIESEL", title: "Diesel price" },
    { series_ticker: "KXVEGAS", title: "Las Vegas gas price" }
  ]) {
    assert.equal(classifyEvent(ev({ category: "Economics", ...bad })), null, JSON.stringify(bad));
  }
});

/* KXGAS is a real retail-gasoline series whose official settlement source is the
 * EIA weekly US retail gasoline price, but it carries NO tags and its title
 * ("Gas weekly") matches no earlier pattern, so both the site and the collector
 * missed it. Verified live 2026-11-21:
 *   https://external-api.demo.kalshi.co/trade-api/v2/series/KXGAS
 *   -> title "Gas weekly", category Economics, tags null,
 *      settlement_sources[0].url = https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm
 * (EIA "Weekly U.S. Regular All Formulations Retail Gasoline Prices").
 * Source for the series schema: https://docs.kalshi.com/api-reference/market/get-series
 */
test("gas also matches the KXGAS retail-gasoline series (no tags, EIA settlement source)", () => {
  assert.equal(classifyEvent(ev({
    series_ticker: "KXGAS", category: "Economics", title: "Gas weekly"
  })), "gas");
  /* The bare /gas/i catch-all must stay banned: these must still be rejected. */
  for (const bad of [
    { series_ticker: "KXNATGAS", title: "Natural gas price this week" },
    { series_ticker: "KXVEGASGP", title: "Las Vegas gas price" },
    { series_ticker: "KXGASOLINEISH", title: "Something oil related" }
  ]) {
    assert.equal(classifyEvent(ev(bad)), null, JSON.stringify(bad));
  }
});

test("golf is Sports narrowed to golf terms, not all sports", () => {
  assert.equal(classifyEvent(ev({ category: "Sports", series_ticker: "KXPGA", title: "PGA Championship" })), "golf");
  assert.equal(classifyEvent(ev({ category: "Sports", series_ticker: "KXNFLGAME", title: "Chiefs vs Bills" })), null);
});

test("out-of-scope categories are not forced into a topic", () => {
  for (const c of ["Economics", "Weather", "Financials", "Exotics"]) {
    assert.equal(classifyEvent(ev({ category: c, title: "something else" })), null, c);
  }
});

test("combos are classified from mve_selected_legs, not from their generic title", () => {
  const combo = {
    event_ticker: "KXMVECROSSCATEGORY-SHARD1-X",
    title: "yes Republican party,no Democratic party",
    category: "Exotics",
    markets: [{
      status: "active",
      mve_selected_legs: [
        { event_ticker: "CONTROLH-2028", side: "yes" },
        { event_ticker: "GOVPARTYFL-26", side: "no" }
      ]
    }]
  };
  // Without a look-up it must stay unclassified rather than guess.
  assert.equal(classifyEvent(combo), null);
  return classifyMultivariate(combo, async t => (
    t === "CONTROLH-2028" ? ev({ event_ticker: t, category: "Elections" }) : null
  )).then(res => {
    assert.equal(res.topic, "elections");
    assert.equal(res.mixed, false);
    assert.deepEqual(res.bases, [{ event_ticker: "CONTROLH-2028", topic: "elections" }]);
  });
});

test("a combo spanning topics reports the majority topic and mixed=true", () => {
  const combo = {
    event_ticker: "MVE-1",
    markets: [{ mve_selected_legs: [
      { event_ticker: "E1" }, { event_ticker: "E2" }, { event_ticker: "C1" }
    ] }]
  };
  const cats = { E1: "Elections", E2: "Elections", C1: "Crypto" };
  return classifyMultivariate(combo, async t => ev({ event_ticker: t, category: cats[t] || "" }))
    .then(res => {
      assert.equal(res.topic, "elections");
      assert.equal(res.mixed, true);
      assert.deepEqual(res.counts, [{ topic: "elections", legs: 2 }, { topic: "crypto", legs: 1 }]);
    });
});

test("a combo whose legs are all out of scope is not classified", () => {
  const combo = { event_ticker: "MVE-2", markets: [{ mve_selected_legs: [{ event_ticker: "W1" }] }] };
  return classifyMultivariate(combo, async t => ev({ event_ticker: t, category: "Weather" }))
    .then(res => assert.equal(res, null));
});

test("classifyMultivariateList drops unclassifiable combos and caches leg look-ups", async () => {
  let calls = 0;
  const lookupSource = [
    { event_ticker: "MVE-A", markets: [{ mve_selected_legs: [{ event_ticker: "E1" }] }] },
    { event_ticker: "MVE-B", markets: [{ mve_selected_legs: [{ event_ticker: "W1" }] }] },
    { event_ticker: "MVE-C", markets: [{ mve_selected_legs: [{ event_ticker: "E1" }] }] }
  ];
  const realApi = (await import("../assets/js/market.js")).api;
  const original = realApi.get;
  realApi.get = async (path) => {
    calls += 1;
    // Only E1 exists for the classifier; every other leg 404s, as a missing
    // event does on the real API.
    if (String(path).includes("E1")) return { event: ev({ event_ticker: "E1", category: "Elections" }) };
    throw new Error("404 not_found");
  };
  try {
    const out = await classifyMultivariateList(lookupSource);
    // MVE-A and MVE-C share leg E1 (Elections) so both classify; MVE-B's only
    // leg cannot be read, so it is dropped rather than filed in a topic.
    assert.deepEqual(out.map(e => e.event_ticker), ["MVE-A", "MVE-C"]);
    // Two distinct legs are looked up (E1, W1); the repeated E1 is cached,
    // including the failed W1 look-up (cached as null, never retried).
    assert.equal(calls, 2, "each distinct leg is fetched at most once");
  } finally {
    realApi.get = original;
  }
});

test("every topic key the site links to exists in TOPICS", () => {
  const keys = TOPICS.map(t => t.key).sort();
  assert.deepEqual(keys, ["crypto", "culture", "elections", "gas", "golf"]);
  for (const t of TOPICS) {
    assert.ok(t.label && t.blurb, `${t.key} needs a label and blurb`);
    assert.ok(Array.isArray(t.sources) && t.sources.length, `${t.key} must cite its source pages`);
  }
});

test("no topic matches on an undocumented per-market size field", async () => {
  // no_bid_size_fp was removed: it is absent from the Get Market schema and from
  // every live market object, so including it silently understated liquidity.
  const fs = await import("node:fs/promises");
  for (const file of ["../assets/js/category.js", "../assets/js/config.js", "../assets/js/alerts-core.js"]) {
    const src = await fs.readFile(new URL(file, import.meta.url), "utf8");
    // Executable references only — a comment that names the removed field is fine.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    assert.equal(/no_bid_size_fp/.test(code), false, `${file} still reads no_bid_size_fp`);
  }
});

/* ---------------------------------------------------------------------------
 * Series-level category.
 *
 * Why: the official Get Events schema marks the *event* `category` field
 * `deprecated: true` — "Event category (deprecated, use series-level category
 * instead)" — https://docs.kalshi.com/api-reference/events/get-events .
 * The replacement is the series record's `categories[]` / `category`
 * (https://docs.kalshi.com/api-reference/market/get-series-list), and the
 * `category` query filter is documented to match any entry in that list.
 * These cases pin the precedence so a future edit cannot quietly fall back to
 * the deprecated field as the primary basis.
 * ------------------------------------------------------------------------- */

test("the series-level category decides, even when the deprecated event field disagrees", () => {
  clearSeriesCategoryCache();
  primeSeriesCategories({ KXTESTSERIES: ["Crypto"] });
  const e = ev({ category: "Elections", series_ticker: "KXTESTSERIES" });
  assert.equal(classifyEvent(e), "crypto");
  const v = classifyEventWithBasis(e);
  assert.equal(v.topic, "crypto");
  assert.equal(v.basis, "series");
  assert.deepEqual(v.categories, ["Crypto"]);
});

test("a series with several discovery categories matches any of them", () => {
  clearSeriesCategoryCache();
  // Live shape: KXDIESELMONAK returns categories ["Economics"] plus a primary
  // category, so the union must be searched rather than the primary alone.
  primeSeriesCategories({ KXMULTI: { cats: ["Economics", "World"], primary: "Economics" } });
  assert.equal(classifyEvent(ev({ category: "", series_ticker: "KXMULTI" })), null,
    "a non-topic category must not be forced into a topic");
  primeSeriesCategories({ KXMULTI2: { cats: ["Economics", "Entertainment"], primary: "Economics" } });
  assert.equal(classifyEvent(ev({ category: "", series_ticker: "KXMULTI2" })), "culture",
    "the discovery list, not just the primary category, must be searched");
});

test("the deprecated event category is only a fallback, and the basis says so", () => {
  clearSeriesCategoryCache();
  const e = ev({ category: "Crypto", series_ticker: "KXUNKNOWN" });
  const v = classifyEventWithBasis(e);
  assert.equal(v.topic, "crypto");
  assert.equal(v.basis, "event");
  // An event with neither basis classifies to nothing rather than to a guess.
  const none = classifyEventWithBasis(ev({ category: "", series_ticker: "" }));
  assert.equal(none.topic, null);
  assert.equal(none.basis, "none");
});

test("series lookups are deduplicated, cached, capped and failure-tolerant", async () => {
  clearSeriesCategoryCache();
  const seen = [];
  const fetcher = async (path) => {
    seen.push(path);
    const ticker = decodeURIComponent(path.split("/series/")[1]);
    if (ticker === "KXBOOM") throw new Error("500");
    return { series: { ticker, category: "Economics", categories: ["Economics", "Elections"] } };
  };
  const first = await fetchSeriesCategories(["A", "A", "B", "KXBOOM"], { fetcher, cap: 10 });
  assert.deepEqual(seen.sort(), ["/series/A", "/series/B", "/series/KXBOOM"]);
  assert.equal(first.requested, 3);
  assert.equal(first.fetched, 2);
  assert.equal(first.failed, 1);
  assert.deepEqual(seriesCategoriesFor("A").cats, ["Economics", "Elections"]);
  // A failed lookup caches as empty: the fallback applies and no retry storm.
  assert.equal(seriesCategoriesFor("KXBOOM").failed, true);
  const second = await fetchSeriesCategories(["A", "B", "KXBOOM"], { fetcher, cap: 10 });
  assert.equal(second.cached, 3);
  assert.equal(second.fetched, 0);
  assert.equal(seen.length, 3, "no ticker is fetched twice");

  clearSeriesCategoryCache();
  const cappedRun = await fetchSeriesCategories(["C", "D", "E"], { fetcher, cap: 2 });
  assert.equal(cappedRun.fetched, 2);
  assert.equal(cappedRun.capped, 1, "the per-scan cap is reported, never silently dropped");
});

test("gas exclusions still apply when the category comes from the series record", () => {
  clearSeriesCategoryCache();
  // Live shape: crude / natural-gas / diesel series carry an Economics category,
  // so a category match alone must never file them under pump-price gas.
  primeSeriesCategories({
    KXWTI: ["Economics"], KXNATGASW: ["Economics"], KXAAAGASW: ["Economics"]
  });
  assert.equal(classifyEvent(ev({ category: "", series_ticker: "KXWTI", title: "WTI crude oil price" })), null);
  assert.equal(classifyEvent(ev({ category: "", series_ticker: "KXNATGASW", title: "Natural gas price" })), null);
  assert.equal(classifyEvent(ev({
    category: "", series_ticker: "KXAAAGASW", title: "US gas prices this week"
  })), "gas");
});

test("the lookup budget is spent on the series carrying the most events", async () => {
  clearSeriesCategoryCache();
  const seen = [];
  const fetcher = async (path) => {
    const ticker = decodeURIComponent(path.split("/series/")[1]);
    seen.push(ticker);
    return { series: { ticker, category: "Economics", categories: ["Economics"] } };
  };
  // "RARE" appears once, "BUSY" appears four times, "MID" twice.
  const tickers = ["RARE", "MID", "BUSY", "BUSY", "MID", "BUSY", "BUSY"];
  const out = await fetchSeriesCategories(tickers, { fetcher, cap: 2 });
  assert.deepEqual(seen, ["BUSY", "MID"], "only the two highest-frequency series are fetched");
  assert.equal(out.requested, 3);
  assert.equal(out.fetched, 2);
  assert.equal(out.capped, 1);
  // The one that did not fit still falls back and is never guessed at.
  assert.equal(seriesCategoriesFor("RARE"), null);
  assert.equal(classifyEvent(ev({ category: "Crypto", series_ticker: "RARE" })), "crypto");
});

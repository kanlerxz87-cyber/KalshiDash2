/* KalshiDash2 — offline proofs for the rendered-page rules.
 *
 * These run in CI with no browser and no network. They exist because the whole
 * point of `rendered-page-assertions.mjs` is that a check which cannot fail is
 * worthless: each test below feeds it a shape that HAS occurred or COULD occur
 * on the deployed site and asserts the verdict it must reach.
 *
 * The shapes are not invented. §2 of reports/verify-73fc62f6.md records the
 * first one as observed live on 2026-11-27.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EXIT, PAGES, judge, summarise, rowSelector, isExchangeRefusal, isExplicitEmpty, hasUnrenderedArtifacts
} from "./rendered-page-assertions.mjs";

const rowKey = spec => rowSelector(spec);

const overview = PAGES.find(p => p.path === "/");

/* The observed production shape: banner rendered, controller ran to its first
 * await, and nothing else ever arrived. */
const BANNER_ONLY = {
  text: "Live market activity, tracked to resolution Connected to the Kalshi demo API Trading on the demo exchange is active.",
  counts: { "#kpis .stat": 0, "#topics .topic-card": 0, "#board-body > tr": 0 },
  statusText: "", boardText: ""
};

test("a page that rendered only its banner is a FAIL, not a pass", () => {
  const v = judge(overview, BANNER_ONLY);
  assert.equal(v.verdict, "fail");
  assert.ok(v.reasons.some(r => r.includes("never reached a terminal state")), v.reasons.join(";"));
  assert.ok(v.reasons.some(r => r.includes("#kpis .stat")), "the missing KPIs must be named");
  assert.ok(v.reasons.some(r => r.includes("#topics .topic-card")), "the missing topic cards must be named");
  assert.ok(v.reasons.some(r => r.includes("still \"\"") || r.includes("terminal")), "the pending state must be named");
});

test("an unrendered static HTML dump is a FAIL even when the counts happen to match", () => {
  const dump = { ...BANNER_ONLY, text: "[Skip to content](#main) Loading…", counts: { "#kpis .stat": 4, "#topics .topic-card": 5, "#board-body > tr": 2 } };
  const v = judge(overview, dump);
  assert.equal(v.verdict, "fail");
  assert.match(v.reasons[0], /unrendered-markup/);
});

test("a fully rendered board passes", () => {
  const v = judge(overview, {
    text: "Live market activity 4 events in scope",
    counts: { "#kpis .stat": 4, "#topics .topic-card": 5, "#board-body > tr": 26 },
    statusText: "live · 812 events scanned", boardText: "Top 25 shown"
  });
  assert.equal(v.verdict, "pass", v.reasons.join("; "));
});

test("the exchange refusing is INCONCLUSIVE — not a pass and not a content fail", () => {
  for (const status of ["429 Too Many Requests", "status unavailable", "Fetch failed: 503"]) {
    const v = judge(overview, { ...BANNER_ONLY, statusText: status });
    assert.equal(v.verdict, "inconclusive", `${status} must be inconclusive`);
  }
});

test("a refusal does not excuse a page that threw", () => {
  const v = judge(overview, { ...BANNER_ONLY, statusText: "429 Too Many Requests", pageErrors: ["TypeError: x is undefined"] });
  assert.equal(v.verdict, "fail");
});

test("a page error alone fails the page", () => {
  const v = judge(overview, {
    text: "Live market activity",
    counts: { "#kpis .stat": 4, "#topics .topic-card": 5, "#board-body > tr": 3 },
    pageErrors: ["ReferenceError: repeated is not defined"]
  });
  assert.equal(v.verdict, "fail");
  assert.match(v.reasons.join(" "), /repeated is not defined/);
});

test("an explicit empty state is terminal, and the runner decides whether it passes", () => {
  const empty = {
    text: "Live board No events matched the five topics in this scan.",
    counts: { "#kpis .stat": 4, "#topics .topic-card": 5, "#board-body > tr": 0 },
    statusText: "live · 0 events scanned"
  };
  const strict = judge(overview, empty);
  assert.equal(strict.verdict, "fail", "without allowEmpty, an empty board is reported");
  const allowed = judge({ ...overview, allowEmpty: true }, empty);
  assert.equal(allowed.verdict, "pass", allowed.reasons.join("; "));
});

test("a single Loading… placeholder row is not a result", () => {
  const v = judge({ path: "/categories/golf.html", name: "Golf", must: {}, rows: "#board-body" },
    { text: "Golf Prices", counts: { "#board-body > tr": 1 }, boardText: "Loading…" });
  assert.equal(v.verdict, "fail", "a placeholder row must not satisfy the terminal test");
  assert.match(v.reasons.join(" "), /never reached a terminal state/);
  assert.equal(rowSelector({ rows: "#board-body" }), "#board-body > tr",
    "the row count is read from the container's own rows");
});

test("refusal detection ignores pages that merely discuss rate limits", () => {
  assert.equal(isExchangeRefusal("Price alerts · the API mentions 429 in its own prose"), true,
    "the pill text is the only input, so prose is never scanned — this asserts the pattern is narrow enough to be safe");
  assert.equal(isExchangeRefusal("live · 812 events scanned"), false);
  assert.equal(isExchangeRefusal("idle"), false);
});

test("the site's own empty-state copy is recognised", () => {
  for (const s of [
    "No events matched the five topics in this scan.",
    "No contract in this scan moved $0.10 or more against its previous price.",
    "No swing of $0.10 or more recorded yet.",
    "Load a market first.",
    "Press “Measure traded dollars” to read the exchange's own trade records for this topic."
  ]) assert.ok(isExplicitEmpty(s), `must recognise: ${s}`);
  assert.equal(isExplicitEmpty("Loading…"), false);
});

test("unrendered artifacts are detected", () => {
  assert.ok(hasUnrenderedArtifacts("[Skip to content](#main)"));
  assert.ok(hasUnrenderedArtifacts("a&#0;b"));
  assert.ok(hasUnrenderedArtifacts("a\u0000b"));
  assert.equal(hasUnrenderedArtifacts("normal rendered text"), false);
});

test("one FAIL outranks any number of inconclusive pages", () => {
  const s = summarise([
    { spec: { name: "A", path: "/a" }, verdict: "inconclusive", reasons: ["exchange refused"] },
    { spec: { name: "B", path: "/b" }, verdict: "fail", reasons: ["no rows"] },
    { spec: { name: "C", path: "/c" }, verdict: "pass", reasons: [] }
  ]);
  assert.equal(s.exitCode, EXIT.FAIL);
  assert.equal(s.fail, 1);
  assert.equal(s.inconclusive, 1);
  assert.match(s.markdown, /\| B \| `\/b` \| fail \| no rows \|/);
});

test("inconclusive pages never exit 0", () => {
  const s = summarise([{ spec: { name: "A", path: "/a" }, verdict: "inconclusive", reasons: ["exchange refused"] }]);
  assert.equal(s.exitCode, EXIT.INCONCLUSIVE);
  assert.notEqual(s.exitCode, EXIT.PASS);
});

test("every page spec names selectors this repository's pages actually define", async () => {
  /* A spec that points at a selector no page has would fail every run for the
   * wrong reason. Pinning it here keeps the audit honest as pages change.
   *
   * The root is derived from THIS FILE's location, never from `process.cwd()`:
   * this suite runs from `tests/dom` in CI (`cd tests/dom && node --test ...`)
   * and from the repository root locally, and the first CI run of the
   * `render-audit` workflow failed on exactly that difference. A path that
   * depends on the caller's working directory is a defect, not a convention. */
  const { readFileSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  for (const spec of PAGES) {
    const file = spec.path === "/" ? "index.html" : spec.path.replace(/^\//, "");
    const html = readFileSync(join(root, file), "utf8");
    for (const sel of Object.keys(spec.must)) {
      const id = (sel.match(/#([A-Za-z0-9_-]+)/) || [])[1];
      if (!id) continue;
      assert.ok(html.includes(`id="${id}"`), `${file} must define #${id} (spec ${spec.name} names it)`);
    }
    if (spec.rows) {
      const id = spec.rows.match(/#([A-Za-z0-9_-]+)/)[1];
      assert.ok(html.includes(`id="${id}"`), `${file} must define the rows container #${id}`);
    }
    if (spec.status) {
      const id = spec.status.match(/#([A-Za-z0-9_-]+)/)[1];
      assert.ok(html.includes(`id="${id}"`), `${file} must define the status pill #${id}`);
    }
  }
});

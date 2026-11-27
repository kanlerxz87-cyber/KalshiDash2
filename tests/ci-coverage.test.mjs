/* KalshiDash2 — every committed guard must be able to fail a build.
 *
 * Why this exists
 * ---------------
 * On 2026-11-27 `main` at `bb4ede5` was red — `node --test tests/*.test.mjs`
 * gave 237 pass / 1 fail — while every GitHub Actions build on that commit
 * showed green. The failing test was `tests/probe-citation-drift.test.mjs`,
 * written by session `74b579c8` specifically to catch the scheduled probe bot
 * rewriting `data/probe/api_surface.json` out from under the figures the site
 * publishes. It did its job and nobody heard it: no file in
 * `.github/workflows/` mentioned it.
 *
 * It was not the only orphan. `tests/page-identifiers.test.mjs` — the guard
 * PR #129 shipped after `ReferenceError: repeated is not defined` replaced the
 * homepage board with an error message in production, and which PR #129's own
 * board record promised would stop that class from shipping again — was also
 * unreferenced. A guard that no pipeline runs is a comment with a `.mjs`
 * extension.
 *
 * What this asserts
 * -----------------
 *  1. Every `tests/*.test.mjs` file is named by at least one workflow, so a
 *     newly added guard cannot be dead on arrival.
 *  2. `site-check.yml` runs the whole `tests/*.test.mjs` glob, not a hand-list,
 *     so the next test file is covered without anyone remembering to add it.
 *  3. Every file a workflow names actually exists — the inverse failure, where
 *     a renamed test leaves a workflow step matching nothing.
 *
 * What this does NOT assert: that a given workflow is enabled, scheduled or
 * passing on GitHub. That is run history, not the tree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workflowsDir = join(root, ".github/workflows");
const read = p => readFileSync(join(root, p), "utf8");

const workflowFiles = readdirSync(workflowsDir).filter(f => /\.ya?ml$/.test(f));
const workflowText = Object.fromEntries(
  workflowFiles.map(f => [f, readFileSync(join(workflowsDir, f), "utf8")])
);
const allWorkflowText = Object.values(workflowText).join("\n");

const testFiles = readdirSync(join(root, "tests"))
  .filter(f => f.endsWith(".test.mjs"))
  .sort();

test("every test file in tests/ is named by at least one workflow", () => {
  assert.ok(testFiles.length > 20, `expected the guard suite to exist, saw ${testFiles.length}`);
  const orphans = testFiles.filter(f => !allWorkflowText.includes(f));
  assert.deepEqual(
    orphans,
    [],
    `these guards no workflow runs, so they can never fail a build:\n  ${orphans.join("\n  ")}`
  );
});

test("site-check.yml runs the whole tests/*.test.mjs glob", () => {
  /* A hand-maintained list of 30 test files is how two got dropped. The glob
   * means a new file is covered the moment it is committed. */
  const siteCheck = workflowText["site-check.yml"];
  assert.ok(siteCheck, "site-check.yml must exist — it is the only push-triggered test job");
  assert.match(
    siteCheck,
    /node --test\s+tests\/\*\.test\.mjs/,
    "site-check.yml must run `node --test tests/*.test.mjs` so no guard can be orphaned"
  );
});

test("every test file a workflow names exists", () => {
  const missing = [];
  for (const [file, text] of Object.entries(workflowText)) {
    const named = text.match(/tests\/[A-Za-z0-9_/*-]+\.test\.mjs/g) || [];
    for (const ref of new Set(named)) {
      if (ref.includes("*")) continue; // globs are resolved by the runner itself
      if (!existsSync(join(root, ref))) missing.push(`${file} → ${ref}`);
    }
  }
  assert.deepEqual(missing, [], `workflows reference test files that do not exist:\n  ${missing.join("\n  ")}`);
});

test("the two guards whose absence left main red are covered by name and by glob", () => {
  /* Belt and braces: the glob keeps them green even if someone trims a step, but
   * naming them here makes the intent explicit in the failure text. */
  for (const guard of ["tests/probe-citation-drift.test.mjs", "tests/page-identifiers.test.mjs"]) {
    assert.ok(existsSync(join(root, guard)), `${guard} must exist`);
    assert.ok(allWorkflowText.includes(guard), `${guard} must be named by a workflow`);
  }
});

test("the pinned probe capture carries a date and does not change under the site", () => {
  /* Session bacbd8a9 (PR #131) fixed the citation drift properly: the published
   * figures cite `data/probe/api_surface_2026-11-24.json`, a dated copy, instead
   * of the rolling artifact the schedule rewrites. That only holds if (a) the
   * pinned file still exists and (b) it is not the same path the bot writes. */
  const pinned = "data/probe/api_surface_2026-11-24.json";
  assert.ok(existsSync(join(root, pinned)), `${pinned} must exist — the site cites it by path`);

  const probeWorkflow = workflowText["probe.yml"];
  assert.ok(probeWorkflow, "probe.yml must exist");
  /* Check the write target, not every mention: the step's own comment explains why
   * the pinned file is left alone, and naming it there must not trip the guard. */
  const writeTargets = probeWorkflow.match(/open\("([^"]+\.json)"\s*,\s*"w"\)/g) || [];
  assert.ok(writeTargets.length > 0, "probe.yml should write its artifact somewhere");
  for (const target of writeTargets) {
    assert.ok(
      !target.includes("api_surface_2026-11-24"),
      `probe.yml must never open the pinned capture for writing (${target})`
    );
  }

  const body = JSON.parse(read(pinned));
  assert.ok(
    typeof body.captured_at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(body.captured_at),
    `${pinned} must carry a capture date so a reader can date the figures without the repo log`
  );
});

test("the Flagged page does not claim a source link that some card lacks", () => {
  /* The page's "How to read this page" panel used to say *every* item carries an
   * official source link. Five cards (A2, R2, Y9, Y10, Y11) are process findings
   * about this repository — no official Kalshi page can confirm or deny them — so
   * they carry repository evidence instead. The sentence was simply false for
   * them, which is the kind of overclaim this repository's verification rule
   * exists to prevent. Fixed 2026-11-27 (session 858d4941); this pins it.
   *
   * The assertion is deliberately narrow: it checks the absolute wording, not the
   * existence of links, because a card about a deleted file cannot have one. */
  const flagged = read("flagged.html");
  const panel = flagged.slice(flagged.indexOf("How to read this page"), flagged.indexOf("How to read this page") + 3000);
  assert.ok(
    !/Every item has an ID, the evidence that produced it, and an official source link/.test(panel),
    "the panel must not claim every item has an official source link — some are repository process findings"
  );
  assert.match(
    panel,
    /Five items \(A2, R2, Y9, Y10, Y11\) are process findings/,
    "the panel must name the repository-only items so the exception is visible, not silent"
  );
  for (const id of ["A2", "R2", "Y9", "Y10", "Y11"]) {
    assert.ok(
      flagged.includes(`id="${id}"`),
      `card ${id} must still exist — the disclosure names it`
    );
  }
});

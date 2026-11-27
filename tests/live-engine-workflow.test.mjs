/* KalshiDash2 — a workflow must keep the promise its own header makes.
 *
 * Why this exists
 * ---------------
 * `.github/workflows/live-engine-check.yml` says, at the top:
 *
 *   "The report is committed even when the check fails, so a red run still
 *    leaves evidence behind."
 *
 * It did not. The `Commit the report` step had no `if: always()`, so GitHub
 * skips it whenever the preceding step fails. On 2026-11-27 two runs failed
 * (46079257668, 46079375710) and both left **no** report, while the job's logs
 * were unreadable from the build sandbox (`blob.core.windows.net` is not on its
 * allowlist) — so the failure produced neither evidence nor a log to read.
 *
 * A workflow comment is a claim about behaviour, exactly like text on a page.
 * This guard checks the claim and the behaviour agree, rather than trusting the
 * comment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const raw = readFileSync(join(root, ".github/workflows/live-engine-check.yml"), "utf8");

test("the live engine check commits its report on a failed run, as its header promises", () => {
  assert.match(
    raw,
    /report is committed even when the check fails/,
    "the header states the promise; if it is ever removed, this guard should be revisited"
  );
  /* Find the commit step and assert it carries `if: always()`. Parsed loosely on
   * purpose: the repository deliberately avoids pinning a YAML library into the
   * Node test suite (ci-coverage.test.mjs reasons over workflow text the same way). */
  const stepStart = raw.indexOf("- name: Commit the report");
  assert.ok(stepStart > 0, "the commit step exists");
  const stepBlock = raw.slice(stepStart, raw.indexOf("\n      - ", stepStart + 10) === -1
    ? undefined
    : raw.indexOf("\n      - ", stepStart + 10));
  assert.match(
    stepBlock,
    /^\s*if:\s*always\(\)\s*$/m,
    "`Commit the report` must carry `if: always()`, or a red run leaves no evidence " +
      "and the header comment is false"
  );
});

test("the check step itself has no `if:` that would make it report success after an API outage", () => {
  /* The opposite failure: a step that always runs and always succeeds would make
   * the report look healthy when the exchange was unreachable. The script exits
   * non-zero on an unreachable API (engine.errors → process.exit(1)), so the
   * workflow must not neutralise that with `continue-on-error`. */
  assert.doesNotMatch(
    raw,
    /continue-on-error:\s*true/,
    "a failed live check must fail the job; the commit step runs alongside it, not instead of it"
  );
});

/* KalshiDash2 — template-interpolation guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * `index.html` shipped (in PR #126) a template literal interpolating
 * `${repeated}` while the variable declared next to it was `repeats`:
 *
 *     const repeats = (state.duplicateRows || 0) > 0 ? ` … ` : "";
 *     … ${partial}${repeated} …        // ReferenceError: repeated is not defined
 *
 * The throw happened inside `loadBoard()`'s try block, so the homepage's board
 * was replaced by "Could not load events: repeated is not defined" on every
 * load. It reached `main` because no gate could see it: `page-runtime-check`
 * only proves each page *evaluates* (the error needs `render()` to run), the
 * DOM suites use fixtures rather than index.html, and the only check that
 * executes the real page code against the live exchange — `live-site-render` —
 * runs after merge.
 *
 * THE RULE
 * --------
 * For every script in every published page and every runtime module: each
 * identifier interpolated as a bare `${name}` must appear at least once
 * somewhere else in the same file. A name that appears ONLY inside
 * interpolations is either undeclared (the shipped bug) or a phantom — either
 * way it must be written correctly before it can render.
 *
 * Scope of the rule (deliberate): it is token counting, not scope analysis.
 * - Declared names always pass (the declaration itself is an outside
 *   occurrence), so there are no false failures from declarations — that is
 *   why this beats the naive "find undeclared identifiers" approach, which
 *   mis-flagged `noPrice` and `status` while trying to parse declarations.
 * - It will NOT catch `${x}` where `x` is genuinely used elsewhere in the file
 *   but out of scope at that point. Catching that needs real execution — that
 *   is what live-site-render is for. This guard exists to make the common typo
 *   class impossible to ship silently, in milliseconds, offline.
 * - A future literal `${name}` inside a comment or plain string would be read
 *   as an interpolation; if that is ever wanted, add the name to ALLOWED with
 *   a reason rather than weakening the rule.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

/* Names exempted from the rule, with a reason recorded at the call site.
 * Empty today. */
const ALLOWED = new Set();

/* Published pages (root *.html + categories/*.html) and runtime modules
 * (assets/js/*.js). `docs/` is excluded: it is the retired generation
 * (Flagged Y10), not what the site's navigation serves. */
function scanTargets(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "docs" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scanTargets(p, out);
    else if (name.endsWith(".html") || (p.includes("/assets/js/") && name.endsWith(".js"))) {
      out.push(relative(ROOT, p));
    }
  }
  return out;
}

/* Interpolations are code, so only look inside <script> bodies of a page. An
 * external script (`<script src=…>`) has no body to scan; its file is scanned
 * as a target of its own. */
function codeBodies(file, text) {
  if (!file.endsWith(".html")) return [text];
  const bodies = [];
  for (const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    bodies.push(m[2]);
  }
  return bodies;
}

const bareInterp = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

function interpNames(bodies) {
  const names = new Set();
  for (const body of bodies) for (const m of body.matchAll(bareInterp)) names.add(m[1]);
  return names;
}

/* Evidence rule: `\bname\b` occurs somewhere in the file outside of a bare
 * `${name}` interpolation of that same name. */
function hasOutsideEvidence(fileText, name) {
  const total = [...fileText.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
  const inside = [...fileText.matchAll(new RegExp(`\\$\\{\\s*${name}\\s*\\}`, "g"))].length;
  return total - inside > 0;
}

function violations(fileText, bodies) {
  const out = [];
  for (const name of interpNames(bodies)) {
    if (ALLOWED.has(name)) continue;
    if (!hasOutsideEvidence(fileText, name)) out.push(name);
  }
  return out.sort();
}

/* ---- self-tests: the rule must keep deciding these cases correctly ---- */

test("rule self-test: the shipped bug pattern is flagged, valid code is not", () => {
  /* Verbatim shape of index.html @ 9204bea (PR #126). */
  const shipped = [
    "  const partial = (state.capped || []).length ? ` partial` : \"\";",
    "  const repeats = (state.duplicateRows || 0) > 0",
    "    ? ` <strong>Repeats:</strong> ${int(state.duplicateRows)} rows`",
    "    : \"\";",
    "  note.innerHTML = `${partial}${repeated} ${src(SOURCES.events)}`;"
  ].join("\n");
  assert.deepEqual(violations(shipped, [shipped]), ["repeated"],
    "the typo that broke the homepage must be caught");

  /* Declared via multi-declarator list, for-of binding, destructuring, params:
   * every one of these names appears outside its interpolation, so the rule is
   * indifferent to how it was declared — no declaration parsing needed. */
  const fine = [
    "let volume = 0, oi = 0, volumePriceProxy = 0, noPrice = 0;",
    "const m = `${noPrice} market(s) without a price`;",
    "for (const status of [\"open\", \"closed\"]) {",
    "  const s = `${status} (${rows.__pages} pages)`;",
    "}",
    "const fmt = (n) => `${int(n)}`;",
    "const { withHistory } = lastRun;",
    "pill(`${withHistory}/${scoped.length} markets`);"
  ].join("\n");
  assert.deepEqual(violations(fine, [fine]), [],
    "valid declarations and uses must not be flagged");

  /* Expressions are out of scope by design; only bare `${name}` is checked. */
  const expressions = "note = `${esc(x)} ${a.b} ${f(y)} ${z ? 1 : 2}`;";
  assert.deepEqual(violations(expressions, [expressions]), [],
    "non-bare interpolations are not checked");

  /* Phantom name used only inside interpolations — flagged even though the
   * template itself "renders" (to a ReferenceError). */
  const phantom = "a = `${ghost}`; b = `${ghost} again`;";
  assert.deepEqual(violations(phantom, [phantom]), ["ghost"]);
});

/* ---- the real pages and modules ---- */

test("every bare `${name}` in every published page and module has a real source", () => {
  const targets = scanTargets();
  assert.ok(targets.length >= 25,
    `expected the published pages plus assets/js modules, found ${targets.length}`);
  const bad = [];
  for (const file of targets) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const name of violations(text, codeBodies(file, text))) {
      bad.push(`${file}: \${${name}} is interpolated but appears nowhere else in the file`);
    }
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

/* Pin the fix: the board note must interpolate the variable it declares. A
 * rename must update both sites, and this assertion names the failure. */
test("index.html renders its `repeats` note (regression pin for PR #126 breakage)", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(html, /const\s+repeats\s*=/);
  assert.match(html, /\$\{partial\}\$\{repeats\}/);
  assert.ok(!/\$\{\s*repeated\s*\}/.test(html),
    "index.html must not interpolate ${repeated} — the variable is `repeats`");
});

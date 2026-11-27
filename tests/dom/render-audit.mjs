/* KalshiDash2 — render the DEPLOYED site in a real browser and report what a
 * reader actually sees.
 *
 * Run locally (needs Playwright + a Chromium build):
 *   cd tests/dom && npm ci && npx playwright install --with-deps chromium
 *   node render-audit.mjs                       # defaults to the Pages URL
 *   BASE_URL=http://localhost:8000 node render-audit.mjs
 *
 * Exit codes: 0 every page passed · 1 a page is defective · 2 nothing failed but
 * at least one page could not be verified (the exchange refused, or a page never
 * finished rendering). Exit 2 is NOT green — see the workflow, which fails the
 * job on it, because "we could not tell" is not "the dashboard works".
 *
 * What it does NOT do: assert any Kalshi value. Prices, volumes and results are
 * whatever the exchange returns at run time. The audit only asks whether the
 * page rendered them.
 */
import { chromium } from "playwright";
import { PAGES, judge, summarise, EXIT, rowSelector } from "./rendered-page-assertions.mjs";
import { writeFileSync } from "node:fs";

const BASE = (process.env.BASE_URL || "https://kanlerxz87-cyber.github.io/KalshiDash2").replace(/\/$/, "");
const DEADLINE_MS = Number(process.env.RENDER_DEADLINE_MS || 75000);
const NAV_TIMEOUT_MS = Number(process.env.NAV_TIMEOUT_MS || 45000);

/* Pages that legitimately have no live board may exhaust the deadline without
 * failing on a pending state, but they must still satisfy their `must` counts. */
const browser = await chromium.launch();

async function auditPage(spec) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", e => pageErrors.push(String(e && e.message ? e.message : e)));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  /* A 4xx/5xx on one of the site's OWN files is a defect; a refusal from the API
   * is handled by the judge as inconclusive. */
  page.on("response", r => {
    const u = r.url();
    if (u.startsWith(BASE) && r.status() >= 400) pageErrors.push(`site asset ${r.status()}: ${u}`);
  });

  let navigated = false;
  try {
    await page.goto(BASE + spec.path, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    navigated = true;
  } catch (e) {
    pageErrors.push(`navigation failed: ${e.message}`);
  }

  const counts = {};
  const deadline = Date.now() + DEADLINE_MS;
  if (navigated) {
    /* Poll until every structural selector is present and, for a live-board
     * page, the board has reached a terminal state. Keeps the audit from
     * reporting "still loading" as a defect on a slow but healthy run. */
    while (Date.now() < deadline) {
      for (const sel of [...Object.keys(spec.must || {}), ...(spec.rows ? [rowSelector(spec)] : [])]) {
        counts[sel] = await page.locator(sel).count();
      }
      const structuralOk = Object.entries(spec.must || {}).every(([sel, min]) => (counts[sel] ?? 0) >= min);
      const boardTextEarly = spec.rows ? await page.locator(spec.rows).innerText().catch(() => "") : "";
      const rowsOk = !spec.rows || spec.static || (counts[rowSelector(spec)] ?? 0) > 1 || !/loading/i.test(boardTextEarly);
      if (structuralOk && rowsOk) break;
      if (pageErrors.length) break;      // a thrown page will not recover
      await page.waitForTimeout(1000);
    }
  }

  const text = navigated ? await page.evaluate(() => document.body.innerText).catch(() => "") : "";
  const statusText = spec.status ? await page.locator(spec.status).innerText().catch(() => "") : "";
  const boardText = spec.rows ? await page.locator(spec.rows).innerText().catch(() => "") : "";

  for (const sel of Object.keys(spec.must || {})) counts[sel] = await page.locator(sel).count().catch(() => 0);
  if (spec.rows) counts[rowSelector(spec)] = await page.locator(rowSelector(spec)).count().catch(() => 0);

  await page.screenshot({ path: `render-audit/${spec.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, fullPage: false }).catch(() => {});
  await context.close();

  /* `allowEmpty` is decided here, per run, from evidence: a page whose board is
   * empty AND whose status pill reports a successful scan of zero events is
   * allowed to be empty only when the audit is run with RENDER_ALLOW_EMPTY=1.
   * The default is strict, so an unexplained empty board fails. */
  const verdict = judge(spec, { text, counts, pageErrors, consoleErrors, statusText, boardText });
  return { spec, ...verdict, observed: { counts, statusText: statusText.slice(0, 160), pageErrors } };
}

const results = [];
for (const spec of PAGES) {
  const r = await auditPage(spec);
  results.push(r);
  console.log(`${r.verdict.toUpperCase().padEnd(13)} ${spec.name.padEnd(20)} ${spec.path}`);
  for (const reason of r.reasons) console.log(`   - ${reason}`);
}
await browser.close();

const summary = summarise(results);
console.log(`\n${summary.pass} passed, ${summary.fail} failed, ${summary.inconclusive} could not be verified`);

/* Emit the verdict table as annotations, so a failing run is diagnosable from
 * the API without downloading an artifact (the artifact blob host is not
 * reachable from every environment that reviews these runs). */
for (const r of results) {
  const line = `${r.spec.path} → ${r.verdict}: ${r.reasons.join("; ") || "ok"}`;
  if (r.verdict === "fail") console.log(`::error title=render-audit ${r.spec.name}::${line.replace(/\n/g, " ")}`);
  else if (r.verdict === "inconclusive") console.log(`::warning title=render-audit ${r.spec.name}::${line.replace(/\n/g, " ")}`);
}

const report = [
  "# Rendered-page audit — the deployed site in a real browser",
  "",
  `- Base: \`${BASE}\``,
  `- Started: ${new Date().toISOString()}`,
  `- Browser: Chromium via Playwright ${process.env.PLAYWRIGHT_VERSION || ""} on Node ${process.version}`,
  `- Exit: \`${summary.exitCode}\` (0 pass · 1 defect · 2 could not verify)`,
  "",
  summary.markdown,
  "",
  "## What each verdict means",
  "",
  "| Verdict | Meaning |",
  "| --- | --- |",
  "| pass | the page reached a terminal state, showed every structural element its spec requires, and logged no page error |",
  "| fail | a page error, an error status pill, an empty board with no explicit empty state, a missing structural element, or a board still showing its placeholder |",
  "| inconclusive | the status pill or board note says the exchange refused or was unreachable, so the content assertions could not be made — this is not a pass |",
  "",
  "No Kalshi price, volume, size or result is asserted or recorded here; only whether the page rendered them.",
  ""
].join("\n");
try { writeFileSync("render-audit-report.md", report); } catch { /* the workflow collects stdout too */ }
console.log("\n" + report);
/* `process.exit()` can truncate buffered stdout, which is exactly how the first
 * version of this script lost its per-page annotations. Set the code and let
 * Node flush. */
process.exitCode = summary.exitCode === EXIT.PASS ? 0 : summary.exitCode === EXIT.FAIL ? 1 : 2;

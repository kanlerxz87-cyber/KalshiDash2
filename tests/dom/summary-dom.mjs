// DOM regression test for the executive-summary register counts and source matrix.
// It executes the actual inline module with jsdom and the real Verification/Flagged
// data, so incorrect array interpolation or an F-only flag count fails the test.
import { JSDOM, VirtualConsole } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const summaryHtml = await fs.readFile(path.join(REPO, "summary.html"), "utf8");
const flaggedHtml = await fs.readFile(path.join(REPO, "flagged.html"), "utf8");
const inline = [...summaryHtml.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert.equal(inline.length, 1, "summary page has one inline module");

const built = await esbuild.build({
  stdin: { contents: inline[0], resolveDir: REPO, sourcefile: "summary-inline.js", loader: "js" },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  write: false
});

const virtualConsole = new VirtualConsole();
const pageErrors = [];
virtualConsole.on("jsdomError", error => pageErrors.push(error.message));
const dom = new JSDOM(summaryHtml, {
  url: "https://kanlerxz87-cyber.github.io/KalshiDash2/summary.html",
  runScripts: "outside-only",
  virtualConsole
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.DOMParser = window.DOMParser;
globalThis.localStorage = window.localStorage;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
globalThis.fetch = async url => {
  assert.equal(String(url), "flagged.html", "summary reads the Flagged page for its counts");
  return { ok: true, status: 200, text: async () => flaggedHtml };
};

await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);

const { CLAIMS } = await import(pathToFileURL(path.join(REPO, "assets/js/claims.js")).href);
const requirementRows = [...window.document.querySelectorAll("#requirement-matrix tr")];
const requirements = requirementRows.length;
const sourceRows = [
  ...requirementRows,
  ...window.document.querySelectorAll("#defect-matrix tbody tr"),
  ...window.document.querySelectorAll("#decision-matrix tbody tr")
];
const verified = CLAIMS.filter(claim => claim.status === "verified").length;
const partial = CLAIMS.filter(claim => claim.status === "partially verified").length;
const unverified = CLAIMS.filter(claim => claim.status === "unverified").length;
const flagDoc = new JSDOM(flaggedHtml).window.document;
const cards = [...flagDoc.querySelectorAll(".irregularity")];
const open = cards.filter(card => card.querySelector(".tag.warn")).length;
const mitigated = cards.filter(card => card.querySelector(".tag.yes")).length;

const stats = [...window.document.querySelectorAll("#headline .stat")];
const stat = name => {
  const row = stats.find(item => item.querySelector(".k")?.textContent === name);
  assert.ok(row, `headline contains ${name}`);
  return {
    value: row.querySelector(".v").textContent,
    detail: row.querySelector(".m").textContent
  };
};

assert.ok(requirements > 0, "requirement matrix has rows");
assert.equal(stat("Requirement areas").value, String(requirements));
assert.equal(sourceRows.length, requirementRows.length + 6 + 5,
  "requirement, defect, and decision matrices are included in the source audit");
for (const row of sourceRows) {
  const evidence = row.cells[row.cells.length - 1];
  assert.ok(evidence?.textContent.trim(), "each summary row has evidence text");
  const hasOfficialSource = evidence.querySelector('a[href^="https://docs.kalshi.com"], a[href^="https://kalshi.com"]');
  assert.ok(hasOfficialSource || /project/i.test(evidence.textContent),
    `each row has an official source or is labelled as a project decision: ${row.cells[0].textContent}`);
}
assert.equal(stat("Claims verified").value, `${verified} / ${CLAIMS.length}`);
assert.equal(stat("Claims verified").detail, `${partial} partial · ${unverified} unverified`);
assert.equal(stat("Open flags").value, String(open));
assert.equal(stat("Open flags").detail, `${cards.length} items · ${mitigated} mitigated`);
assert.ok(!window.document.querySelector("#headline").textContent.includes("[object Object]"));
assert.deepEqual(pageErrors, [], "summary module runs without jsdom errors");

console.log(`PASS  requirement areas = ${requirements}`);
console.log(`PASS  claim counts = ${verified}/${CLAIMS.length} verified; ${partial} partial; ${unverified} unverified`);
console.log(`PASS  flag counts = ${open} open; ${mitigated} mitigated; ${cards.length} total`);
console.log(`PASS  sourced/project-labelled summary rows = ${sourceRows.length}`);
console.log("PASS  no object interpolation or page errors");

dom.window.close();

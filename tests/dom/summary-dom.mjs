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
/* Status comes from the card's own heading. Reading any tag in the card made a
 * nested card's status count for its parent: Z3 was left unclosed, SC1/SC2
 * rendered inside it, and the page totalled 88 statuses for 87 items (Z8). */
/* Counts are taken from the WORD in each card's own heading, which is what the
 * Summary now prints. Counting the tag's class instead reported "66 mitigated"
 * for 28 mitigated, 37 fixed and 1 corrected card (Flagged DR4). */
const FLAG_STATUSES = ["open", "mitigated", "fixed", "corrected"];
const statusOf = card => (card.querySelector("h3 .tag")?.textContent || "").trim().toLowerCase();
const byStatus = Object.fromEntries(
  FLAG_STATUSES.map(status => [status, cards.filter(card => statusOf(card) === status).length])
);
const open = byStatus.open;
const closed = cards.length - open;
const expectedFlagDetail = [
  `${cards.length} items`,
  ...FLAG_STATUSES.filter(status => status !== "open").map(status => `${byStatus[status]} ${status}`)
].join(" \u00b7 ");

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

/* §8 is produced by executing assets/js/trace.js against the shipped modules.
 * This harness already runs the real page, so it is the only place that can see
 * whether the table actually rendered — a module that throws would leave the
 * "Measuring…" placeholder in place and every other assertion would still pass. */
const traceRows = [...window.document.querySelectorAll("#trace-body tr")];
assert.ok(traceRows.length >= 17, `trace matrix must render every requirement (got ${traceRows.length})`);
assert.ok(!window.document.querySelector("#trace-body .empty"),
  "trace matrix must replace its placeholder, not leave it");
for (const row of traceRows) {
  assert.equal(row.cells.length, 5, "each trace row states id, requirement, artefact, state and measured evidence");
  const state = row.cells[3].textContent.trim();
  assert.ok(["wired", "gap"].includes(state), `trace state must be wired or gap, got "${state}"`);
}
const gaps = traceRows.filter(r => r.cells[3].textContent.trim() === "gap");
assert.equal(gaps.length, 0, `no requirement may render as a gap in a shipped build: ${gaps.map(g => g.cells[0].textContent).join(", ")}`);
assert.match(window.document.querySelector("#trace-note").textContent, /of 17 requirements are wired|requirements are wired/);
assert.equal(stat("Requirement areas").value, String(requirements));
assert.equal(sourceRows.length, requirementRows.length + 3 + 5,
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
assert.equal(flagDoc.querySelectorAll(".irregularity .irregularity").length, 0,
  "no card may nest another card (a missing closing tag once did: Z8)");
for (const card of cards) {
  assert.equal(card.querySelectorAll("h3 .tag").length, 1,
    `every card states exactly one status in its own heading: ${card.id}`);
}
for (const card of cards) {
  assert.ok(FLAG_STATUSES.includes(statusOf(card)),
    `every card states one of the published status words (${card.id} says "${statusOf(card)}")`);
}
assert.equal(open + closed, cards.length,
  `open + closed must equal the item count: ${open} + ${closed} vs ${cards.length}`);
assert.equal(
  byStatus.open + byStatus.mitigated + byStatus.fixed + byStatus.corrected,
  cards.length,
  "the per-status breakdown must account for every card, with none unlabelled"
);
assert.equal(stat("Open flags").value, String(open));
assert.equal(stat("Open flags").detail, expectedFlagDetail,
  "the headline names each closed status by the number of cards that state it");
assert.ok(!window.document.querySelector("#headline").textContent.includes("[object Object]"));
assert.deepEqual(pageErrors, [], "summary module runs without jsdom errors");

console.log(`PASS  requirement areas = ${requirements}`);
console.log(`PASS  claim counts = ${verified}/${CLAIMS.length} verified; ${partial} partial; ${unverified} unverified`);
console.log(`PASS  flag counts = ${open} open; ${byStatus.mitigated} mitigated; ${byStatus.fixed} fixed; ${byStatus.corrected} corrected; ${cards.length} total`);
console.log(`PASS  sourced/project-labelled summary rows = ${sourceRows.length}`);
console.log("PASS  no object interpolation or page errors");

dom.window.close();

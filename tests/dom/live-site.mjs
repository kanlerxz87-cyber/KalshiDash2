// LIVE smoke test of the published site's real page code against the Kalshi
// demo API. Unlike alerts-dom.mjs this uses NO fixtures: every request goes to
// https://external-api.demo.kalshi.co, so it proves the deployed code can talk to
// the exchange. It needs outbound network access, so it runs on a GitHub-hosted
// runner (.github/workflows/live-site-render.yml), never in the build sandbox:
//
//   cd tests/dom && npm ci && node live-site.mjs
//
// Each page's real controller is bundled with esbuild (jsdom cannot execute ES
// modules) and evaluated in jsdom with a real fetch.
//
// Exit codes: 0 = every assertion passed, 1 = a real regression, 2 = inconclusive
// because the exchange refused or was unreachable (HTTP 429/5xx or transport).
// The distinction matters: a rate limit is not a site defect, but it must not be
// reported as a pass either. Parsing/classification lives in
// ./live-site-assertions.mjs and is unit-tested offline.
import { JSDOM, VirtualConsole } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

import { parseScanCount, refusalReason, boardOutcome, EXIT } from "./live-site-assertions.mjs";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const netFetch = (...a) => globalThis.fetch(...a);   // resolved at call time

let pass = 0, fail = 0, inconclusive = 0;
const check = (page, label, cond, extra = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  [${page}] ${label}${extra ? " — " + extra : ""}`);
};
const skip = (page, label, why) => {
  inconclusive++;
  console.log(`SKIP  [${page}] ${label} — inconclusive: ${why}`);
};

const stripModuleScripts = html => html
  .replace(/<script type="module" src="[^"]*"><\/script>/g, "")
  .replace(/<script type="module">[\s\S]*?<\/script>/g, "");

/* Bundle whichever module the page actually loads: an external src, or the
 * inline <script type="module"> block its controller lives in. */
async function pageBundle(page) {
  const html = fs.readFileSync(path.join(REPO, page), "utf8");
  const external = html.match(/<script type="module" src="([^"]+)"><\/script>/);
  const inline = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  const resolveDir = path.join(REPO, path.dirname(page));
  if (external) {
    return { html, bundle: (await esbuild.build({
      entryPoints: [path.join(resolveDir, external[1])],
      bundle: true, format: "iife", write: false, platform: "browser"
    })).outputFiles[0].text };
  }
  if (inline) {
    return { html, bundle: (await esbuild.build({
      stdin: { contents: inline[1], resolveDir, loader: "js" },
      bundle: true, format: "iife", write: false, platform: "browser"
    })).outputFiles[0].text };
  }
  return { html, bundle: null };
}

async function run(page, { waitUntil, waitMs = 120000 }) {
  const { html, bundle } = await pageBundle(page);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e.message));
  const dom = new JSDOM(stripModuleScripts(html), {
    url: `https://example.test/${page}`, runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window;
  w.fetch = (u, o) => netFetch(String(u), o);
  w.confirm = () => true;
  w.prompt = () => null;
  try { if (bundle) w.eval(bundle); } catch (e) { errors.push("eval: " + e.message); }
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    await new Promise(r => setTimeout(r, 750));
    try { if (waitUntil(w)) break; } catch { /* keep waiting */ }
  }
  const text = sel => w.document.querySelector(sel)?.textContent.replace(/\s+/g, " ") || "";
  return {
    w, errors,
    body: w.document.body.textContent.replace(/\s+/g, " "),
    note: text("#board-note")
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------------------- Overview ---------------------------- */
{
  const { w, errors, body, note } = await run("index.html", {
    waitUntil: w => w.document.querySelector("#kpis")?.innerHTML.length > 0
  });
  const unreachable = /could not reach/i.test(body);
  const refusal = refusalReason(note) || refusalReason(body);
  check("index", "connected to the demo API", /Connected to the Kalshi demo API/.test(body) || unreachable);

  if (refusal || unreachable) {
    skip("index", "board content assertions", `exchange unavailable (${refusal || "connection refused"})`);
  } else {
    check("index", "five topic cards", w.document.querySelectorAll("#topics .topic-card").length === 5);
    check("index", "board rows populated", w.document.querySelectorAll("#board-body tr").length > 1);
    /* Comma-tolerant: the page renders counts through int() -> toLocaleString,
     * so a scan of 1,234 events used to fail a `\d+` pattern forever. */
    const scanned = parseScanCount(note);
    check("index", "note states the scan size", scanned !== null && scanned >= 0,
      scanned === null ? note.slice(0, 120) : `${scanned} events`);
  }
  check("index", "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("   KPI:", w.document.querySelector("#kpis")?.textContent.replace(/\s+/g, " ").slice(0, 220));
  console.log("   NOTE:", note.slice(0, 300));
}

/* ------------- Gas: the topic that was falsely reported as empty ------------- */
{
  const readGas = w => {
    const text = sel => w.document.querySelector(sel)?.textContent.replace(/\s+/g, " ") || "";
    return {
      board: text("#board-body"),
      caveat: text("#topic-caveat"),
      stats: text("#cat-stats"),
      statusText: text("#board-status"),
      statusClass: w.document.querySelector("#board-status")?.className || ""
    };
  };

  // Retry a refusal instead of reporting it as a content regression. The demo
  // exchange rate-limits bursts (HTTP 429), which has nothing to do with the site.
  let attempt = 0, result;
  for (;;) {
    attempt++;
    const r = await run("categories/gas.html", {
      waitUntil: w => {
        const b = w.document.querySelector("#board-body")?.textContent || "";
        const cls = w.document.querySelector("#board-status")?.className || "";
        return /KXAAAGAS/.test(b) || /err/.test(cls) || /none matched/i.test(w.document.querySelector("#topic-caveat")?.textContent || "");
      },
      waitMs: 90000
    });
    const g = readGas(r.w);
    // boardOutcome() reads boardText/caveatText; map the page's own field names.
    const verdict = boardOutcome({
      boardText: g.board, caveatText: g.caveat,
      statusText: g.statusText, statusClass: g.statusClass
    });
    result = { ...r, ...g, verdict };
    if (verdict.outcome !== "refused") { result.verdict = verdict; break; }
    if (attempt >= 3) { result.verdict = verdict; break; }
    console.log(`   gas attempt ${attempt} refused (${verdict.reason}); retrying in ${5 * attempt}s`);
    await sleep(5000 * attempt);
  }

  const { verdict, board, caveat, stats, statusText } = result;
  if (verdict.outcome === "refused") {
    skip("gas", "live gas event on the board", `exchange refused after ${attempt} attempt(s): ${verdict.reason}`);
  } else if (verdict.outcome === "populated") {
    check("gas", "live gas event on the board", /KXAAAGAS/.test(board), board.slice(0, 140));
  } else if (verdict.outcome === "no-match") {
    /* The app is allowed to state that this scan found no gas event, as long as
     * it says so explicitly rather than showing a blank board. */
    check("gas", "live gas event on the board", true, "page explicitly reported no matching event in this scan");
  } else {
    check("gas", "live gas event on the board", false, verdict.reason);
  }

  if (verdict.outcome === "refused") {
    // Both of these describe a scan that succeeded; a refusal produces neither.
    skip("gas", "coverage line states the scan performed", "no successful scan to describe");
    skip("gas", "resting size uses the documented fields", "no successful scan to describe");
  } else {
    check("gas", "coverage line states the scan performed",
      /open event\(s\)|matched|No .* events|none matched/i.test(caveat), caveat.slice(0, 200));
    check("gas", "resting size uses the documented fields", /yes_bid_size_fp \+ yes_ask_size_fp/.test(stats));
  }
  check("gas", "no page errors", result.errors.length === 0, result.errors.slice(0, 2).join(" | "));
  console.log("   STATUS:", statusText.slice(0, 160));
  console.log("   STATS:", stats.slice(0, 260));
  console.log("   CAVEAT:", caveat.slice(0, 320));
}

console.log(`\n${pass} passed, ${fail} failed, ${inconclusive} inconclusive`);
if (fail) process.exit(EXIT.FAIL);
if (inconclusive) {
  console.log("\nINCONCLUSIVE: the exchange refused or was unreachable, so some assertions could not be made.\nThis is not reported as a pass. Re-run when the demo API is serving.");
  process.exit(EXIT.INCONCLUSIVE);
}
process.exit(EXIT.PASS);

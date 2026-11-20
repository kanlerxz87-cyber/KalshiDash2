// LIVE smoke test of the published site's real page code against the Kalshi
// demo API. Unlike alerts-dom.mjs this uses NO fixtures: every request goes to
// https://external-api.demo.kalshi.co, so it proves the deployed code can talk to
// the exchange. It needs outbound network access, so it is not part of CI; run:
//
//   cd tests/dom && npm ci && node live-site.mjs
//
// Each page's real controller is bundled with esbuild (jsdom cannot execute ES
// modules) and evaluated in jsdom with a real fetch.
import { JSDOM, VirtualConsole } from "jsdom";
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const netFetch = (...a) => globalThis.fetch(...a);   // resolved at call time

let pass = 0, fail = 0;
const check = (page, label, cond, extra = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  [${page}] ${label}${extra ? " — " + extra : ""}`);
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
  return { w, errors };
}

/* ---------------------------- Overview ---------------------------- */
{
  const { w, errors } = await run("index.html", {
    waitUntil: w => w.document.querySelector("#kpis")?.innerHTML.length > 0
  });
  const txt = w.document.body.textContent.replace(/\s+/g, " ");
  const note = w.document.querySelector("#board-note")?.textContent.replace(/\s+/g, " ") || "";
  check("index", "connected to the demo API", /Connected to the Kalshi demo API/.test(txt) || /could not reach/.test(txt));
  check("index", "five topic cards", w.document.querySelectorAll("#topics .topic-card").length === 5);
  check("index", "board rows populated", w.document.querySelectorAll("#board-body tr").length > 1);
  check("index", "note states the scan size", /Scanned \d+ events/.test(note));
  check("index", "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("   KPI:", w.document.querySelector("#kpis")?.textContent.replace(/\s+/g, " ").slice(0, 220));
  console.log("   NOTE:", note.slice(0, 300));
}

/* ------------- Gas: the topic falsely reported as empty ------------- */
{
  const { w, errors } = await run("categories/gas.html", {
    waitUntil: w => {
      const b = w.document.querySelector("#board-body")?.textContent || "";
      return /KXAAAGAS/.test(b) || (w.document.querySelector("#board-status")?.className || "").includes("err");
    }
  });
  const board = w.document.querySelector("#board-body")?.textContent.replace(/\s+/g, " ") || "";
  const cov = w.document.querySelector("#topic-caveat")?.textContent.replace(/\s+/g, " ") || "";
  const stats = w.document.querySelector("#cat-stats")?.textContent.replace(/\s+/g, " ") || "";
  check("gas", "live gas event on the board", /KXAAAGAS/.test(board), board.slice(0, 140));
  check("gas", "coverage line states the scan performed", /open event\(s\)|matched|No .* events/.test(cov), cov.slice(0, 200));
  check("gas", "resting size uses the documented fields", /yes_bid_size_fp \+ yes_ask_size_fp/.test(stats));
  check("gas", "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("   STATS:", stats.slice(0, 260));
  console.log("   CAVEAT:", cov.slice(0, 320));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

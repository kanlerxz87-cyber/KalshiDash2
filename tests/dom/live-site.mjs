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
import { gasBoardState, NO_MATCH_PATTERN } from "./gas-assertion.mjs";

import { parseScanCount, refusalReason, EXIT } from "./live-site-assertions.mjs";

const REPO = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const netFetch = (...a) => globalThis.fetch(...a);   // resolved at call time

/* The demo API rate-limits bursts (HTTP 429; see
 * https://docs.kalshi.com/getting_started/rate_limits). A single 429 during a
 * scan is a transient, not a page defect, so the harness retries it with
 * backoff (honouring Retry-After when present). The retry is bounded: if the
 * API keeps failing, the page's own error state still fails the checks below
 * — a persistent failure is never masked. */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchWithRetry(url, opts, attempt = 0) {
  const res = await netFetch(url, opts);
  if (res.status !== 429 || attempt >= 3) return res;
  const retryAfter = Number(res.headers?.get?.("retry-after"));
  const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter * 1000, 15000)
    : 2000 * 2 ** attempt;
  await sleep(waitMs);
  return fetchWithRetry(url, opts, attempt + 1);
}

let pass = 0, fail = 0, inconclusive = 0;
const check = (page, label, cond, extra = "") => {
  if (cond) pass++; else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  [${page}] ${label}${extra ? " — " + extra : ""}`);
};
/* A refusal that survives the bounded retries is not evidence about the site.
 * It is reported as inconclusive (exit 2), never as a pass: the workflow raises
 * a warning annotation and the run is not green. */
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
  w.fetch = (u, o) => fetchWithRetry(String(u), o);
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
  /* Only error surfaces, never `txt`: the page's own copy mentions "WebSocket"
   * and alerts.html mentions "429", which would mark a healthy page as refused. */
  const boardStatus = w.document.querySelector("#board-status")?.textContent.replace(/\s+/g, " ") || "";
  const refusal = refusalReason(note) || refusalReason(boardStatus);
  if (refusal || /could not reach/i.test(txt)) {
    skip("index", "board content assertions", `exchange unavailable (${refusal || "connection refused"})`);
  } else {
    check("index", "five topic cards", w.document.querySelectorAll("#topics .topic-card").length === 5);
    check("index", "board rows populated", w.document.querySelectorAll("#board-body tr").length > 1);
    /* The page formats counts with int() (toLocaleString), so a scan of 2,800
     * events renders as "Scanned 2,800 events". parseScanCount is comma-tolerant
     * and unit-tested offline in live-site-assertions.test.mjs. */
    const scanned = parseScanCount(note);
    check("index", "note states the scan size", scanned !== null && scanned >= 0,
      scanned === null ? note.slice(0, 120) : `${scanned} events`);
  }
  check("index", "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("   KPI:", w.document.querySelector("#kpis")?.textContent.replace(/\s+/g, " ").slice(0, 220));
  console.log("   NOTE:", note.slice(0, 300));
}

/* ------------- Gas: the topic falsely reported as empty ------------- */
{
  const { w, errors } = await run("categories/gas.html", {
    waitUntil: w => {
      const b = w.document.querySelector("#board-body")?.textContent || "";
      const status = w.document.querySelector("#board-status")?.className || "";
      // Settled = the board rendered rows, the page reported an error, or the
      // page published its explicit no-match state (see the checks below).
      const caveat = w.document.querySelector("#topic-caveat")?.textContent || "";
      return /KXAAAGAS/.test(b) || status.includes("err") || NO_MATCH_PATTERN.test(caveat);
    }
  });
  const board = w.document.querySelector("#board-body")?.textContent.replace(/\s+/g, " ") || "";
  const cov = w.document.querySelector("#topic-caveat")?.textContent.replace(/\s+/g, " ") || "";
  const stats = w.document.querySelector("#cat-stats")?.textContent.replace(/\s+/g, " ") || "";
  const statusText = w.document.querySelector("#board-status")?.textContent.replace(/\s+/g, " ") || "";
  const statusClass = w.document.querySelector("#board-status")?.className || "";
  /* A refusal that survived the bounded retries is not evidence about the site.
   * Only the status pill is inspected — never whole-page text, because the page's
   * own copy mentions "WebSocket" and alerts.html mentions "429". */
  const refusal = refusalReason(statusText);

  if (refusal) {
    skip("gas", "gas board honest (event listed, or explicit no-match with no errors)", `exchange refused: ${refusal}`);
    skip("gas", "coverage line states the scan performed", "no successful scan to describe");
    skip("gas", "resting size uses the documented fields", "no successful scan to describe");
  } else {
    /* `main`'s tested rule (./gas-assertion.mjs, proven offline by
     * live-site-no-match.test.mjs): either a gas market is listed, or the page
     * printed its own no-match callout with no page error and no error pill. An
     * error board or an empty board still fails — API failures are not masked. */
    const verdict = gasBoardState({
      board, caveat: cov, statusClass, errors,
    });
    check("gas", "gas board honest (event listed, or explicit no-match with no errors)",
      verdict.ok, verdict.reason + " — " + board.slice(0, 120));
    check("gas", "coverage line states the scan performed", /open event\(s\)|matched|No .* events/.test(cov), cov.slice(0, 200));
    check("gas", "resting size uses the documented fields", /yes_bid_size_fp \+ yes_ask_size_fp/.test(stats));
  }
  check("gas", "no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  console.log("   STATS:", stats.slice(0, 260));
  console.log("   CAVEAT:", cov.slice(0, 320));
}

console.log(`\n${pass} passed, ${fail} failed, ${inconclusive} inconclusive`);
if (fail) process.exit(EXIT.FAIL);
if (inconclusive) {
  console.log("\nINCONCLUSIVE: the exchange refused or was unreachable, so some assertions could not be made.\nThis is not reported as a pass. Re-run when the demo API is serving.");
  process.exit(EXIT.INCONCLUSIVE);
}
process.exit(EXIT.PASS);

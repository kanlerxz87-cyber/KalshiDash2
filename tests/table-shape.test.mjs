/* KalshiDash2 — table empty-state shape regression.
 *
 * Every published table renders an "empty" row while it loads or when the API
 * returns nothing. That row must span the table's full width (`colspan` = the
 * number of `<th>` cells), or the empty-state box is visibly narrower than the
 * table. This test reads the published HTML and fails on a mismatch.
 *
 * Ids are scoped per page (the same id, e.g. `rows`, legitimately appears on
 * several pages with different widths; each document is separate).
 *
 * Scope: the root site (`*.html` + `categories/*.html`) — the generation GitHub
 * Pages serves. `docs/` is the earlier, non-canonical generation and is
 * excluded. Empty states rendered by external JS modules (`assets/js/*.js`) are
 * not covered here; they are checked by the page-runtime harness and logged in
 * COORDINATION.md when found.
 *
 * No network, no DOM: pure text parsing, so it runs anywhere `node --test` does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function publishedPages() {
  const pages = [];
  for (const f of readdirSync(root)) if (f.endsWith(".html")) pages.push(f);
  const catDir = join(root, "categories");
  for (const f of readdirSync(catDir)) if (f.endsWith(".html")) pages.push("categories/" + f);
  return pages.sort();
}

/* Map each element id inside a table to that table's `<th>` count. Header-less
 * tables (0 `<th>`) are layout tables and are skipped. */
function tableWidths(html) {
  const ids = new Map();
  for (const m of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const tbl = m[0];
    const thCount = (tbl.match(/<th\b/gi) || []).length;
    if (!thCount) continue;
    for (const idm of tbl.matchAll(/\bid="([^"]+)"/gi)) {
      ids.set(idm[1], thCount);
    }
  }
  return ids;
}

function checkPage(rel, html) {
  const problems = [];
  const widths = tableWidths(html);

  const staticRe = /<tbody\b[^>]*\bid="([^"]+)"[^>]*>\s*<tr>\s*<td\b[^>]*\bcolspan="(\d+)"/gi;
  for (const m of html.matchAll(staticRe)) {
    const [, id, cols] = m;
    if (!widths.has(id)) problems.push(`${rel}: static empty row for #${id} (colspan ${cols}) has no header table`);
    else if (Number(cols) !== widths.get(id)) {
      problems.push(`${rel}: #${id} static empty row colspan=${cols} but the table has ${widths.get(id)} columns`);
    }
  }

  const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1]).join("\n");
  const inlineRe = /\$\("#([\w-]+)"\)\.innerHTML\s*=\s*emptyRow\((\d+)/g;
  for (const m of inline.matchAll(inlineRe)) {
    const [, id, cols] = m;
    if (!widths.has(id)) problems.push(`${rel}: inline emptyRow for #${id} (colspan ${cols}) has no header table`);
    else if (Number(cols) !== widths.get(id)) {
      problems.push(`${rel}: #${id} inline emptyRow colspan=${cols} but the table has ${widths.get(id)} columns`);
    }
  }
  return problems;
}

test("every published table's empty-state row spans its full width", () => {
  const pages = publishedPages();
  assert.ok(pages.length >= 15, `expected the published pages to be found, got ${pages.length}`);
  const problems = [];
  for (const rel of pages) {
    problems.push(...checkPage(rel, readFileSync(join(root, rel), "utf8")));
  }
  assert.deepEqual(problems, [], "table empty-state mismatches:\n" + problems.join("\n"));
});

test("the five category pages each carry the chart, book and traded-dollar tables", () => {
  /* Guards the brief's chart + liquidity + dollar-volume requirements: if a
   * category page loses one of these tables, the empty-state test above would
   * still pass, so assert the tables exist by id. */
  for (const topic of ["gas", "elections", "culture", "crypto", "golf"]) {
    const html = readFileSync(join(root, "categories", `${topic}.html`), "utf8");
    for (const id of ["board-body", "price-chart", "yes-book", "no-book", "dollar-rows"]) {
      assert.match(html, new RegExp(`id="${id}"`), `categories/${topic}.html is missing #${id}`);
    }
  }
});

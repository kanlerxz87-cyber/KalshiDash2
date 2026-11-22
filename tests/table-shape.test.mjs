/* Offline markup regression for the canonical root + categories site.
 * Checks static placeholders and explicit inline `.innerHTML = ... emptyRow(N)`
 * assignments, including ternaries. The alerts controller's local `body` aliases
 * are checked separately. This is not a general JavaScript/HTML parser and does
 * not claim coverage of all external controllers (category-book error rows are
 * logged to their owner). The page-runtime harness checks execution, not widths.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = rel => readFileSync(join(root, rel), "utf8");
function publishedPages() {
  return [...readdirSync(root).filter(f => f.endsWith(".html")),
    ...readdirSync(join(root, "categories")).filter(f => f.endsWith(".html")).map(f => "categories/" + f)].sort();
}

function tableWidths(html) {
  const widths = new Map();
  for (const match of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const table = match[0];
    const count = (table.match(/<th\b/gi) || []).length;
    if (!count) continue;
    for (const id of table.matchAll(/\bid="([^"]+)"/gi)) widths.set(id[1], count);
  }
  return widths;
}

// Blank quoted strings, templates and comments, preserving source offsets.
// In particular, a semicolon in <td> text must NOT terminate the assignment.
function codeMask(code) {
  // Preserve UTF-16 offsets even when a page contains emoji.
  const masked = code.split("");
  function commentEnd(i) {
    if (code[i + 1] === "/") { const end = code.indexOf("\n", i + 2); return end < 0 ? code.length : end; }
    if (code[i + 1] === "*") { const end = code.indexOf("*/", i + 2); return end < 0 ? code.length : end + 2; }
    return i;
  }
  function interpolationEnd(i) {
    let depth = 1;
    while (i < code.length && depth) {
      if ("'\"`".includes(code[i])) { i = quoteEnd(i); continue; }
      if (code[i] === "/") { const end = commentEnd(i); if (end > i) { i = end; continue; } }
      if (code[i] === "{") depth++;
      if (code[i] === "}") depth--;
      i++;
    }
    return i;
  }
  function quoteEnd(i) {
    const quote = code[i++];
    while (i < code.length) {
      if (code[i] === "\\") { i += 2; continue; }
      if (code[i] === quote) return i + 1;
      if (quote === "`" && code[i] === "$" && code[i + 1] === "{") {
        i = interpolationEnd(i + 2); continue;
      }
      i++;
    }
    return i;
  }
  for (let i = 0; i < code.length;) {
    let end = i;
    if ("'\"`".includes(code[i])) end = quoteEnd(i);
    else if (code[i] === "/") end = commentEnd(i);
    if (end > i) {
      for (let j = i; j < end; j++) if (!/\s/.test(masked[j])) masked[j] = " ";
      i = end;
    } else i++;
  }
  return masked.join("");
}

function expressionEnd(mask, start) {
  let depth = 0;
  for (let i = start; i < mask.length; i++) {
    if ("([{".includes(mask[i])) depth++;
    if (")]}".includes(mask[i])) {
      if (!depth) return i;
      depth--;
    }
    if (mask[i] === ";" && depth === 0) return i;
  }
  return mask.length;
}

function checkCode(rel, code, widths) {
  const problems = [];
  const mask = codeMask(code);
  const targets = /(?:\$\(\s*["']#([\w-]+)["']\s*\)|([\w$]+))\.innerHTML\s*=/g;
  for (const match of code.matchAll(targets)) {
    if (/\s/.test(mask[match.index])) continue;
    let id = match[1];
    if (!id) {
      const alias = match[2];
      const declarations = [...code.slice(0, match.index).matchAll(
        new RegExp(`\\b(?:const|let)\\s+${alias}\\s*=\\s*\\$\\(\\s*["']#([\\w-]+)["']\\s*\\)`, "g"))]
        .filter(m => !/\s/.test(mask[m.index]));
      id = declarations.at(-1)?.[1];
    }
    const start = match.index + match[0].length;
    const end = expressionEnd(mask, start);
    for (const empty of mask.slice(start, end).matchAll(/\bemptyRow\(\s*(\d+)/g)) {
      if (!id || !widths.has(id)) problems.push(`${rel}: emptyRow(${empty[1]}) has no known target table`);
      else if (Number(empty[1]) !== widths.get(id)) {
        problems.push(`${rel}: #${id} emptyRow=${empty[1]}, headers=${widths.get(id)}`);
      }
    }
  }
  return problems;
}

function checkPage(rel, html) {
  const problems = [];
  const widths = tableWidths(html);
  for (const m of html.matchAll(/<tbody\b[^>]*\bid="([^"]+)"[^>]*>\s*<tr>\s*<td\b[^>]*\bcolspan="(\d+)"/gi)) {
    if (Number(m[2]) !== widths.get(m[1])) {
      problems.push(`${rel}: #${m[1]} static colspan=${m[2]}, headers=${widths.get(m[1])}`);
    }
  }
  for (const script of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    problems.push(...checkCode(rel, script[1], widths));
  }
  return problems;
}

test("published HTML placeholders and inline empty rows span their headers", () => {
  const pages = publishedPages();
  assert.ok(pages.length >= 15);
  assert.deepEqual(pages.flatMap(rel => checkPage(rel, read(rel))), []);
});

test("table IDs are scoped to each document, not shared between pages", () => {
  for (const width of [4, 9]) {
    const html = `<table><thead><tr>${"<th>X</th>".repeat(width)}</tr></thead><tbody id="rows"><tr><td colspan="${width}">None</td></tr></tbody></table>`;
    assert.deepEqual(checkPage("fixture", html), []);
  }
});

test("a ternary mismatch after a callback and quoted semicolons is detected", () => {
  const code = '$("#rows").innerHTML = list.length ? list.map(x => { const note = "a;b"; return `<tr>${`<td>${note}</td>`}</tr>`; }).join("") : emptyRow(3, "none");';
  assert.equal(checkCode("fixture", code, new Map([["rows", 4]])).length, 1);
  assert.deepEqual(checkCode("fixture", code.replace("emptyRow(3", "emptyRow(4"), new Map([["rows", 4]])), []);
});

test("quoted examples and comments are not mistaken for table updates", () => {
  const code = '// $("#missing").innerHTML = emptyRow(1, "comment");\nconst example = `$("#missing").innerHTML = emptyRow(2, "text");`;';
  assert.deepEqual(checkCode("fixture", code, new Map()), []);
});

test("alert and paper-trade controller aliases use the table's actual width", () => {
  const code = read("assets/js/alerts.js");
  const widths = tableWidths(read("alerts.html"));
  assert.deepEqual(checkCode("assets/js/alerts.js", code, widths), []);
  const mutant = code.replace('emptyRow(10, "No swing', 'emptyRow(9, "No swing');
  assert.ok(checkCode("mutant", mutant, widths).some(p => p.includes("#alert-rows")),
    "the regression guard must fail when the original nine-column defect is restored");
});

test("the five category pages retain chart, book and traded-dollar targets", () => {
  for (const topic of ["gas", "elections", "culture", "crypto", "golf"]) {
    const html = read(`categories/${topic}.html`);
    for (const id of ["board-body", "price-chart", "yes-book", "no-book", "dollar-rows"]) {
      assert.match(html, new RegExp(`id="${id}"`), `${topic}: missing #${id}`);
    }
  }
});

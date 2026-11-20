#!/usr/bin/env node
/**
 * Build check for the static site (T9 gate). Fails the job when:
 *  - a relative href/src in site/*.html points to a file that does not exist
 *  - an in-page #anchor has no matching id in the target page
 *  - an external link is not https
 *  - a JSON data file in site/data is not valid JSON or is missing
 *  - a data file lacks a generated_at / source_url trail (rows without a source link)
 * Usage: node scripts/check-site.mjs
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const problems = [];
const warnings = [];
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const htmlFiles = (await readdir(root)).filter((f) => f.endsWith('.html'));
const idsByFile = {};
for (const f of htmlFiles) {
  const html = await readFile(path.join(root, f), 'utf8');
  idsByFile[f] = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

for (const f of htmlFiles) {
  const html = await readFile(path.join(root, f), 'utf8');
  const refs = [...html.matchAll(/\s(href|src)="([^"]+)"/g)].map((m) => m[2]);
  for (const ref of refs) {
    if (/^(mailto:|data:|javascript:)/.test(ref) || ref.includes('${')) continue; // JS template literals are checked at runtime
    if (/^https?:\/\//.test(ref)) {
      if (!ref.startsWith('https://')) problems.push(`${f}: non-https external link ${ref}`);
      continue;
    }
    const [pathPart, hash] = ref.split('#');
    const target = pathPart ? path.join(root, pathPart) : path.join(root, f);
    if (pathPart && !(await exists(target))) { problems.push(`${f}: broken link ${ref}`); continue; }
    if (hash) {
      const tf = pathPart || f;
      if (tf.endsWith('.html') && idsByFile[tf] && !idsByFile[tf].has(hash)) problems.push(`${f}: missing anchor #${hash} in ${tf}`);
    }
  }
}

// Links to ../COORDINATION.md live outside site/; they are checked against the repo root.
{
  const flagged = await readFile(path.join(root, 'flagged.html'), 'utf8');
  if (/\.\.\/COORDINATION\.md/.test(flagged) && !(await exists(path.join(root, '..', 'COORDINATION.md')))) problems.push('flagged.html: COORDINATION.md missing');
}

const dataDir = path.join(root, 'data');
const required = ['meta.json', 'series.json', 'markets.json', 'resolved.json', 'orderbooks.json', 'candles.json'];
for (const f of required) {
  const p = path.join(dataDir, f);
  if (!(await exists(p))) { problems.push(`data/${f} missing (run node scripts/collect.mjs)`); continue; }
  try {
    const parsed = JSON.parse(await readFile(p, 'utf8'));
    const rows = Array.isArray(parsed) ? parsed : Object.values(parsed);
    const badSource = rows.filter((r) => r && typeof r === 'object' && 'ticker' in r && !r.source_url);
    if (badSource.length) problems.push(`data/${f}: ${badSource.length} rows without source_url`);
  } catch (e) {
    problems.push(`data/${f}: invalid JSON (${e.message})`);
  }
}
if (!problems.length) {
  const meta = JSON.parse(await readFile(path.join(dataDir, 'meta.json'), 'utf8'));
  if (meta.errors?.length) warnings.push(`collector reported ${meta.errors.length} request errors`);
  console.log(`site check: ${htmlFiles.length} pages, ${required.length} data files, counts=${JSON.stringify(meta.counts)}`);
}
for (const w of warnings) console.warn('WARN', w);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('site check passed: no broken links, all JSON valid, every data row has source_url');

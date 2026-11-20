#!/usr/bin/env node
// Integration checks (no dependencies). Run after build.js:  node scripts/check.js
// 1. snapshot.json parses; every data row has a source_url on an allowed official host.
// 2. every flag id referenced by a row exists; every flag has a source_url.
// 3. every internal href/src in the built HTML resolves to an existing file (and #anchor if present).
// 4. live.js parses (syntax check via node's parser).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let errors = 0;
const fail = (msg) => { errors++; console.error('FAIL: ' + msg); };
const ok = (msg) => console.log('ok:   ' + msg);

const ALLOWED_HOSTS = new Set([
  'external-api.kalshi.com', 'api.elections.kalshi.com', 'external-api.demo.kalshi.co', 'demo-api.kalshi.co',
  'docs.kalshi.com', 'assets.kalshi.com', 'kalshi.com', 'www.eia.gov', 'github.com', 'api.github.com',
  'www.youtube.com', 'youtube.com', 'gop.com', 'democrats.org', 'congress.gov', 'www.congress.gov',
  'saanich.ca', 'www.saanich.ca', 'www.pgatour.com', 'pgatour.com', 'europeantour.com', 'www.europeantour.com',
  'www.foxsports.com', 'foxsports.com', 'www.espn.com', 'espn.com', 'golfchannel.com', 'www.nbcsports.com', 'nbcsports.com', 'www.wsj.com',
  'apnews.com', 'www.cfbenchmarks.com', 'cfbenchmarks.com', 'www.coinmarketcap.com', 'coinmarketcap.com', 'www.coingecko.com', 'coingecko.com',
]);

// 1 + 2: data
let snap;
try { snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'snapshot.json'), 'utf8')); ok('snapshot.json parses'); }
catch (e) { fail('snapshot.json: ' + e.message); process.exit(1); }

const flagIds = new Set(snap.flags.map((f) => f.id));
const hostOf = (u) => { try { return new URL(u).host; } catch (e) { return null; } };
const checkUrl = (label, u) => {
  if (!u) return fail(label + ' has no source_url (unverified rows must be blank and flagged, not unsourced)');
  const h = hostOf(u);
  if (!h) return fail(label + ' source_url is not a valid URL: ' + u);
  if (!ALLOWED_HOSTS.has(h)) return fail(label + ' source host not on allow-list: ' + h);
};
for (const s of snap.series) { checkUrl(s.id, s.source_url); (s.flags || []).forEach((f) => { if (!flagIds.has(f)) fail(s.id + ' references missing flag ' + f); }); }
for (const m of snap.markets) { checkUrl(m.id, m.source_url); (m.flags || []).forEach((f) => { if (!flagIds.has(f)) fail(m.id + ' references missing flag ' + f); }); }
for (const r of snap.reference_prices) { checkUrl(r.id, r.source_url); }
for (const f of snap.flags) { checkUrl(f.id, f.source_url); }
ok(`${snap.series.length} series, ${snap.markets.length} markets, ${snap.reference_prices.length} reference prices, ${snap.flags.length} flags checked for source links`);

// market sanity: finalized rows must carry a result; active rows must not
for (const m of snap.markets) {
  if (m.status === 'finalized' && !['yes', 'no'].includes(m.result)) fail(m.id + ' finalized without yes/no result');
  if (m.status === 'active' && m.result) fail(m.id + ' active market has a result');
}
ok('finalized markets have yes/no results');

// 3: internal links in built HTML
const htmlFiles = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || ['node_modules', 'data', 'scripts', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(p, r);
    else if (e.name.endsWith('.html')) htmlFiles.push(r);
  }
})(ROOT, '');

const anchorCache = {};
const anchorsIn = (file) => {
  if (!anchorCache[file]) {
    const txt = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const set = new Set();
    for (const m of txt.matchAll(/\sid="([^"]+)"/g)) set.add(m[1]);
    anchorCache[file] = set;
  }
  return anchorCache[file];
};
let linkCount = 0;
for (const f of htmlFiles) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of txt.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = m[1];
    if (/^(https?:|mailto:|data:)/.test(link)) continue;
    linkCount++;
    const [pathPart, hash] = link.split('#');
    const target = pathPart ? path.normalize(path.join(path.dirname(f), pathPart)) : f;
    const abs = path.join(ROOT, target);
    if (!fs.existsSync(abs)) { fail(`${f}: broken link ${link}`); continue; }
    if (hash && fs.statSync(abs).isFile() && target.endsWith('.html') && !anchorsIn(target).has(hash)) fail(`${f}: missing anchor #${hash} in ${target}`);
  }
}
ok(`${htmlFiles.length} HTML pages, ${linkCount} internal links resolve`);

// 4: JS syntax
for (const js of ['assets/live.js']) {
  try { new vm.Script(fs.readFileSync(path.join(ROOT, js), 'utf8'), { filename: js }); ok(js + ' parses'); }
  catch (e) { fail(js + ': ' + e.message); }
}

if (errors) { console.error(`\n${errors} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');

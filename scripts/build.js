#!/usr/bin/env node
// Builds the static site from data/snapshot.json.
// Run: node scripts/build.js   (no dependencies)
// Outputs: index.html, live.html, pages/*.html  (all relative links, works on GitHub Pages project sites)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'snapshot.json'), 'utf8'));
const CAPTURED = snap.captured_on;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sevBadge = (sev) => {
  const cls = { High: 'b-high', Medium: 'b-med', Low: 'b-low' }[sev] || 'b-low';
  return `<span class="badge ${cls}">${esc(sev)}</span>`;
};
const flagLinks = (ids) => (ids || []).length
  ? ids.map((id) => `<a href="__ROOT__pages/flagged.html#${esc(id)}">${esc(id)}</a>`).join(' ')
  : '<span class="muted">—</span>';
const srcLink = (url, label = 'Source') => url
  ? `<a href="${esc(url)}" rel="noopener">${esc(label)}</a>`
  : '<span class="badge b-unv">Unverified</span>';
const numOrBlank = (v) => (v === '' || v == null) ? '<span class="muted">—</span>' : esc(v);
const fmtNum = (v) => {
  if (v === '' || v == null) return '<span class="muted">—</span>';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : esc(v);
};
const fmtPrice = (v) => (v === '' || v == null) ? '<span class="muted">—</span>' : `$${Number(v).toFixed(4)}`;

function table(headers, rows, opts = {}) {
  const head = headers.map((h) => `<th${h.num ? ' class="num"' : ''}>${esc(h.label || h)}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c, i) => `<td${headers[i] && headers[i].num ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="muted">${esc(opts.empty || 'No rows.')}</td></tr>`;
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const NAV = [
  ['index.html', 'Home'], ['live.html', 'Live dashboard'], ['pages/gas.html', 'Gas'], ['pages/elections.html', 'Elections'],
  ['pages/culture.html', 'Culture'], ['pages/crypto.html', 'Crypto'], ['pages/golf.html', 'Golf'],
  ['pages/resolved.html', 'Resolved'], ['pages/analysis.html', 'Analysis'], ['pages/portfolio.html', 'Portfolio'],
  ['pages/questions.html', 'Questions'], ['pages/suggestions.html', 'Suggestions'], ['pages/flagged.html', 'Flagged for Review'],
  ['pages/sources.html', 'Sources'],
];

function layout({ title, active, body, root, script }) {
  const nav = NAV.map(([href, label]) => `<a href="${root}${href}"${href === active ? ' class="on"' : ''}>${esc(label)}</a>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Kalshi Dashboard</title>
<meta name="description" content="Sourced, flagged Kalshi market data for gas prices, elections, culture, crypto, and golf. Data captured ${CAPTURED}.">
<link rel="stylesheet" href="${root}assets/style.css"></head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="${root}index.html">Kalshi Dashboard</a>
  <nav>${nav}</nav>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer><div class="wrap">
  Informational only, not investment advice. Kalshi values are as captured on ${CAPTURED} from official Kalshi API responses and can change. Rows with no confirmed value are left blank and flagged.
  Flagged items and unverified rows are published on <a href="${root}pages/flagged.html">Flagged for Review</a>.
</div></footer>
${script ? `<script src="${root}${script}"></script>` : ''}
</body></html>`;
}

// ---------- helpers that read the snapshot ----------
const seriesFor = (topic) => snap.series.filter((s) => s.topic === topic);
const marketsFor = (topic) => snap.markets.filter((m) => m.topic === topic);
const refsFor = (topic) => snap.reference_prices.filter((r) => r.topic === topic);
const flagsFor = (topic) => snap.flags.filter((f) => f.topic === topic || f.topic === 'all' || f.topic === 'repo');

function seriesTable(topic) {
  const rows = seriesFor(topic).map((s) => [
    `<code>${esc(s.ticker)}</code>`,
    esc(s.title),
    `${esc(s.category)}${s.tags ? ` · <span class="muted">${esc(s.tags)}</span>` : ''}`,
    esc(s.frequency),
    esc(s.settlement_sources),
    flagLinks(s.flags),
    srcLink(s.source_url),
  ]);
  return table(['Ticker', 'Title', 'Category · tags', 'Frequency', 'Settlement sources (per API)', 'Flags', 'Source'], rows, { empty: 'No series in this snapshot.' });
}

function marketsTable(topic, { resolvedOnly = false } = {}) {
  const list = marketsFor(topic).filter((m) => resolvedOnly ? m.status === 'finalized' : true);
  const rows = list.map((m) => resolvedOnly
    ? [`<code>${esc(m.ticker)}</code>`, esc(m.title), `<b>${esc(m.result).toUpperCase()}</b>`, esc(m.settled_at || ''), fmtNum(m.volume_contracts), fmtNum(m.open_interest_contracts), flagLinks(m.flags), srcLink(m.source_url)]
    : [`<code>${esc(m.ticker)}</code>`, esc(m.title), `<span class="badge">${esc(m.status)}</span>`, fmtPrice(m.last_price), fmtPrice(m.yes_bid), fmtPrice(m.yes_ask), fmtNum(m.volume_contracts), fmtNum(m.volume_24h_contracts), fmtNum(m.open_interest_contracts), esc(m.close_time), flagLinks(m.flags), srcLink(m.source_url)]);
  const headers = resolvedOnly
    ? [{ label: 'Ticker' }, { label: 'Title' }, { label: 'Result (yes / no)' }, { label: 'Settled (UTC)' }, { label: 'Volume (contracts)', num: true }, { label: 'Open interest (contracts)', num: true }, { label: 'Flags' }, { label: 'Source' }]
    : [{ label: 'Ticker' }, { label: 'Title' }, { label: 'Status (as returned)' }, { label: 'Last', num: true }, { label: 'Yes bid', num: true }, { label: 'Yes ask', num: true }, { label: 'Volume (contracts)', num: true }, { label: '24h volume (contracts)', num: true }, { label: 'Open interest (contracts)', num: true }, { label: 'Close time (UTC)' }, { label: 'Flags' }, { label: 'Source' }];
  return table(headers, rows, { empty: resolvedOnly ? 'No finalized markets in this topic’s sample.' : 'No market rows captured for this topic (see flags).' });
}

function refsTable(topic) {
  const rows = refsFor(topic).map((r) => [
    esc(r.name), `<b>${esc(r.value)}</b>`, esc(r.unit), esc(r.date), esc(r.comparison || ''), esc(r.note || ''), srcLink(r.source_url, 'EIA'),
  ]);
  return table([{ label: 'Series (EIA)' }, { label: 'Value', num: true }, { label: 'Unit' }, { label: 'Date' }, { label: 'Comparison' }, { label: 'Note' }, { label: 'Source' }], rows, { empty: 'No reference prices.' });
}

function flagsTable(list) {
  const rows = list.map((f) => [`<a id="${esc(f.id)}"></a><b>${esc(f.id)}</b>`, esc(f.subject), esc(f.issue), sevBadge(f.severity), srcLink(f.source_url)]);
  return table([{ label: 'ID' }, { label: 'Subject' }, { label: 'Issue' }, { label: 'Severity' }, { label: 'Source' }], rows, { empty: 'No flags.' });
}

const cnt = { series: snap.series.length, markets: snap.markets.length, refs: snap.reference_prices.length, flags: snap.flags.length, resolved: snap.markets.filter((m) => m.status === 'finalized').length };

// ---------- page bodies ----------
const pages = {};

pages['index.html'] = (root) => `
<h1>Kalshi dashboard: sourced, flagged, and sample-based</h1>
<p class="lede">Topics: gas prices, elections, culture, crypto, golf. Data captured ${CAPTURED} from official Kalshi API responses and EIA tables. Every row links to its source.</p>

<div class="banner bad"><b>Trading and portfolio are blocked.</b> No Kalshi demo API key was available, and the build sandbox cannot reach Kalshi directly. No trades were placed and no portfolio data was pulled. See <a href="${root}pages/portfolio.html">Portfolio</a>.</div>

<h2>Executive summary</h2>
<div class="card">
<ul class="tight">
  <li><b>What was collected.</b> ${cnt.series} Kalshi series, ${cnt.markets} captured markets (${cnt.resolved} finalized), ${cnt.refs} EIA reference prices, and ${cnt.flags} flagged items. Each row has a source link.</li>
  <li><b>Gas.</b> The two Kalshi diesel series (DIESEL, DIESELM) returned no open markets. The DIESEL contract terms name a different EIA table from the one the API lists as its settlement source (F-02). No retail gasoline series was found in the tag query (F-03). EIA's latest U.S. retail diesel is $5.937/gal (week of 11/16/26).</li>
  <li><b>Crypto.</b> The two most recent finalized monthly Bitcoin above-$100k markets in the sample settled <b>NO</b>. The open November and December markets show last prices of $0.01 and $0.02. The November market's data may be stale (F-09).</li>
  <li><b>Golf.</b> Three 2nd-round PGA 3-ball markets show two-sided quotes but zero volume (F-13). One golf series' only settlement source is a participant's own YouTube channel (F-15).</li>
  <li><b>Elections.</b> Two NATO Secretary General markets (Kallas, Iohannis) were captured with low volume. One election series has placeholder text as its title (F-05). Another is titled only "LAR" (F-06).</li>
  <li><b>Culture.</b> Both culture series returned no markets. Their settlement lists include placeholder text and Google search URLs (F-07, F-08). Treat these as unverified.</li>
  <li><b>Measure.</b> The API reports contract counts, not dollar volume (F-17). Rankings here use contract counts. Dollar-amount ranking needs a decision (see Suggestions).</li>
  <li><b>Live.</b> The live dashboard fetches the public Kalshi API in the browser. Whether that works from GitHub Pages is unverified (F-18).</li>
</ul>
</div>

<h2>Sections</h2>
<div class="grid">
  <div class="card tile"><a href="${root}live.html"><b>Live dashboard</b><span>Category market table, price chart (seconds / minutes / hours), and order-book liquidity.</span></a></div>
  <div class="card tile"><a href="${root}pages/gas.html"><b>Gas prices</b><span>Diesel contracts, EIA retail and spot reference prices.</span></a></div>
  <div class="card tile"><a href="${root}pages/elections.html"><b>Elections</b><span>Election series and captured NATO markets.</span></a></div>
  <div class="card tile"><a href="${root}pages/culture.html"><b>Culture</b><span>Culture series. No markets returned.</span></a></div>
  <div class="card tile"><a href="${root}pages/crypto.html"><b>Crypto</b><span>Crypto series and the Bitcoin $100k ladder.</span></a></div>
  <div class="card tile"><a href="${root}pages/golf.html"><b>Golf</b><span>Golf series and 2nd-round PGA 3-ball markets.</span></a></div>
  <div class="card tile"><a href="${root}pages/resolved.html"><b>Resolved</b><span>Finalized markets and their yes/no results.</span></a></div>
  <div class="card tile"><a href="${root}pages/analysis.html"><b>Analysis</b><span>Findings from the captured data, and calculations shown.</span></a></div>
  <div class="card tile"><a href="${root}pages/portfolio.html"><b>Portfolio</b><span>Blocked: needs a demo API key.</span></a></div>
  <div class="card tile"><a href="${root}pages/questions.html"><b>Questions &amp; gaps</b><span>What is known, what is missing, and how to find it.</span></a></div>
  <div class="card tile"><a href="${root}pages/suggestions.html"><b>Suggestions</b><span>Proposed improvements. Nothing is implemented until you choose.</span></a></div>
  <div class="card tile"><a href="${root}pages/flagged.html"><b>Flagged for Review</b><span>Irregularities and unverified items, with links.</span></a></div>
  <div class="card tile"><a href="${root}pages/sources.html"><b>Sources</b><span>Every official source used, and what it was used for.</span></a></div>
</div>

<p class="note">Sample scope: the build sandbox could only fetch selected Kalshi responses, so this is not a full market list. The live dashboard shows the full open-market list for each topic when the browser can reach the API.</p>`;

pages['live.html'] = (root) => `
<h1>Live dashboard</h1>
<p class="lede">Reads the public Kalshi market-data API from your browser (no login). Choose a topic, click a market, and watch its price and order book. Ranked by reported contract volume.</p>
<div class="banner" id="status">Loading…</div>

<div class="controls">
  <label>Topic <select id="topic">
    <option value="gas">Gas prices (tag Gas)</option>
    <option value="elections">Elections</option>
    <option value="culture">Culture</option>
    <option value="crypto">Crypto</option>
    <option value="golf">Golf (tag Golf)</option>
  </select></label>
  <button id="tabOpen" class="on">Open markets</button>
  <button id="tabRes">Recently resolved</button>
  <label>Chart <select id="range">
    <option value="live">Live: every 5 s since page opened</option>
    <option value="1m">Last 60 min, 1-minute candles</option>
    <option value="24h">Last 24 h, 1-hour candles</option>
  </select></label>
  <button id="refresh">Refresh now</button>
</div>

<h2>Markets <span class="note" id="count"></span></h2>
<div class="table-wrap"><table id="mkts"><thead><tr>
  <th>Market</th><th>Series</th><th>Status</th><th class="num">Last</th><th class="num">Yes bid</th><th class="num">Yes ask</th><th class="num">Volume (contracts)</th><th class="num">24h (contracts)</th><th class="num">Open interest</th><th>Close (UTC)</th><th>Source</th>
</tr></thead><tbody id="mkts-body"><tr><td colspan="11" class="muted">Loading…</td></tr></tbody></table></div>

<h2>Price chart <span class="note" id="chartTitle"></span></h2>
<p class="note">X axis: time. Y axis: contract price in dollars (YES side, 0 to 1). Samples are stored only in this browser tab.</p>
<svg id="chart" viewBox="0 0 900 340" role="img" aria-label="Price chart"></svg>

<h2>Liquidity: contracts available at each price</h2>
<div class="two">
  <div><h3>YES bids (buy YES)</h3><div class="table-wrap"><table><thead><tr><th class="num">Price</th><th class="num">Contracts</th><th class="num">Cumulative</th></tr></thead><tbody id="yesBids"></tbody></table></div></div>
  <div><h3>Implied YES asks (from NO bids: ask = 1 − NO price)</h3><div class="table-wrap"><table><thead><tr><th class="num">Implied YES ask</th><th class="num">Contracts</th><th class="num">Cumulative</th></tr></thead><tbody id="yesAsks"></tbody></table></div></div>
</div>
<div class="controls">
  <label>Look up price (cents, 1–99) <input id="lookup" type="number" min="1" max="99" step="1" style="width:90px"></label>
  <span id="lookupOut" class="note">Enter a price to see contracts resting at that price.</span>
</div>
<p class="note" id="bookNote"></p>
<script src="${root}assets/live.js"></script>`;

// topic pages
const topicMeta = snap.topics;
const topicIntro = (k) => topicMeta[k].intro;

function topicPage(k, extra) {
  return (root) => `
<h1>${esc(topicMeta[k].label)}</h1>
<p class="lede">${esc(topicIntro(k))}</p>
<p class="note">Kalshi filter used: <code>${esc(topicMeta[k].kalshi_filter)}</code>. Captured ${CAPTURED}.</p>
${extra && extra.banner ? `<div class="banner">${extra.banner}</div>` : ''}
<h2>Series</h2>
${seriesTable(k)}
<h2>Markets</h2>
${marketsTable(k)}
${k === 'gas' ? `<h2>EIA reference prices</h2>
<p class="note">Official EIA values as captured. These are reference prices, not Kalshi prices.</p>
${refsTable('gas')}` : ''}
${extra && extra.findings ? `<h2>Findings</h2><div class="card"><ul class="tight">${extra.findings.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : ''}
<h2>Flags for this topic</h2>
${flagsTable(flagsFor(k).filter((f) => f.topic === k))}
<p class="note">Cross-topic flags are on the <a href="${root}pages/flagged.html">Flagged for Review</a> page.</p>`;
}

pages['pages/gas.html'] = topicPage('gas', {
  banner: 'Diesel contracts: no open markets were returned. The API and the contract terms name different EIA tables (F-02). Read the contract before trusting any settlement.',
  findings: [
    'The DIESEL contract terms name the U.S. weekly retail diesel price (EIA table PET_PRI_GND_DCUS_NUS_W), "Diesel (On Highway) - All Types". The API lists EIA spot table PET_PRI_SPT_S1_D instead (F-02).',
    'EIA weekly retail U.S. diesel (all types) fell from $6.127 (week of 11/09/26) to $5.937 (11/16/26): −$0.190, or −3.1%. Calculated from the two EIA values.',
    'EIA spot NY Harbor ULSD fell from $4.345 (11/13/26) to $3.999 (11/18/26): −$0.346, or −8.0%. Calculated from the two EIA values.',
    'No retail gasoline series or local (California / San Francisco) series was found in this snapshot (F-03, F-04).',
  ],
});
pages['pages/elections.html'] = topicPage('elections', {
  banner: 'One election series (KXSNAPELECTION) has placeholder-looking title text and is excluded from analysis (F-05).',
  findings: [
    'Captured NATO Secretary General markets: Kaja Kallas last $0.13 (bid $0.12, ask $0.19), volume 1,962.46 contracts. Klaus Iohannis last $0.04, volume 383.36 contracts. Both close 2099-01-08 UTC.',
    'Both captured NATO markets are long-dated and low-volume in this sample. Their order books were not captured.',
  ],
});
pages['pages/culture.html'] = topicPage('culture', {
  banner: 'Both culture series returned no markets, and their settlement lists contain placeholder text and non-publisher links (F-07, F-08). No culture values are shown.',
  findings: [
    'Both series are listed in the Culture category, but no markets were returned for either. No prices or volumes are captured for this topic.',
  ],
});
pages['pages/crypto.html'] = topicPage('crypto', {
  findings: [
    'Finalized: KXBTCMAX100-26-SEP (Oct 1, 2026 threshold) settled <b>NO</b>, with settlement value $0.0000 on 2026-10-03. KXBTCMAX100-26-OCT (Nov 1, 2026 threshold) settled <b>NO</b> on 2026-11-01.',
    'Open: KXBTCMAX100-26-NOV last $0.01 (bid $0.00, ask $0.01). KXBTCMAX100-26-DEC last $0.02 (bid $0.02, ask $0.03). Both show updated_time 2026-09-08 (F-09).',
    'Crypto series include a title that does not describe the measure (KXFDVFOOTBALLFUN, F-12) and an unexpected settlement link (KXAIRDROPHYPE, F-10).',
  ],
});
pages['pages/golf.html'] = topicPage('golf', {
  banner: 'Golf quotes in this snapshot have zero volume. Treat them as quotes, not traded prices (F-13).',
  findings: [
    'Captured 2nd-round PGA 3-ball markets (RSM Classic, created 2026-11-19): Hoshino yes bid $0.34 / ask $0.37; Atkins $0.29 / $0.31; Paul $0.34 / $0.37. All last $0.00, volume 0, open interest 0.',
    'The only settlement source for KXBRYSONCOURSERECORDS is a YouTube channel named after a participant (F-15).',
    'KXDPWORLDTOUR returned no open markets (F-14).',
  ],
});

pages['pages/resolved.html'] = (root) => `
<h1>Resolved markets</h1>
<p class="lede">Finalized markets from the sample, with the result as the API reports it (yes or no). Sample only: the API returned ${cnt.resolved} finalized markets for the Bitcoin series queried.</p>
<h2>Finalized</h2>
${marketsTable('crypto', { resolvedOnly: true })}
<p class="note">Only the crypto series was queried for finalized outcomes. Other topics had no finalized markets in the sample. A full resolved list needs a larger query (see Suggestions).</p>
<h2>Result key</h2>
<div class="card"><ul class="tight">
<li><b>NO</b>: the market's result field is "no". The contract's rule (CF Benchmarks BRTI, trimmed mean, threshold $100,000) is quoted in each market's rules_primary field on the Kalshi API.</li>
<li>settlement_value_dollars is shown as the API reports it ($0.0000 for both finalized rows).</li>
</ul></div>`;

pages['pages/analysis.html'] = (root) => `
<h1>Analysis</h1>
<p class="lede">What the captured data shows, with the arithmetic written out. This is not trading advice, and no trades or strategies have been tested.</p>

<h2>Findings from the captured data</h2>
<div class="card"><ol class="tight">
  <li><b>Bitcoin $100k ladder.</b> In the sample, both finalized monthly markets (Oct and Nov 2026 thresholds) resolved NO. The open Nov and Dec markets last traded at $0.01 and $0.02. Sample size is 2, so this is not a rate estimate. Source: <a href="${root}pages/crypto.html">Crypto</a>.</li>
  <li><b>Gas (EIA).</b> U.S. retail diesel fell 3.1% in the week of 11/16 versus 11/09. NY Harbor ULSD spot fell 8.0% from 11/13 to 11/18. These are EIA values, calculated here. The Kalshi diesel contracts had no captured markets, so no price comparison is possible yet (F-01).</li>
  <li><b>Golf quotes.</b> 2nd-round 3-ball quotes show bid/ask spreads of $0.03 (Hoshino and Paul: $0.34 / $0.37) and $0.02 (Atkins: $0.29 / $0.31). All have zero volume, so the quotes are not validated by trades (F-13).</li>
  <li><b>Liquidity visibility.</b> Order books are available per market through the public API. The live dashboard reads them. No order-book snapshots are stored in this repo.</li>
</ol></div>

<h2>Calculations (shown)</h2>
${table([{ label: 'Calculation' }, { label: 'Inputs (official)' }, { label: 'Result', num: true }], [
  ['U.S. retail diesel change, 11/09 → 11/16/26', '6.127 → 5.937 $/gal (EIA)', '−0.190 (−3.1%)'],
  ['U.S. retail gasoline (all grades) change, 11/09 → 11/16/26', '4.134 → 3.945 $/gal (EIA)', '−0.189 (−4.6%)'],
  ['NY Harbor ULSD spot change, 11/13 → 11/18/26', '4.345 → 3.999 $/gal (EIA)', '−0.346 (−8.0%)'],
  ['Golf 3-ball bid/ask spread (Hoshino)', 'ask 0.37 − bid 0.34 (Kalshi)', '0.03'],
], {})}
<p class="note">Percentages are rounded to one decimal. Source values are listed on <a href="${root}pages/gas.html">Gas</a> and <a href="${root}pages/golf.html">Golf</a>.</p>

<h2>Trade categories (framework only: zero trades so far)</h2>
<div class="card"><p>Once trades exist, each one would be tagged by topic, contract type (threshold, binary matchup, long-dated), entry price band, time to close, side (YES/NO), and outcome. Strategy tests come after enough trades. With no trades yet, no category has any results.</p></div>

<h2>What the analysis cannot yet say</h2>
<ul class="tight">
  <li>Whether any trade or strategy beats the market (no trades, no portfolio).</li>
  <li>How "highest dollar amount" should be ranked (no dollar volume field, F-17).</li>
  <li>Whether the diesel contracts follow the EIA retail or spot table (F-02).</li>
</ul>`;

pages['pages/portfolio.html'] = (root) => `
<h1>Portfolio &amp; trading</h1>
<div class="banner bad"><b>Blocked.</b> The build sandbox has no Kalshi demo API key. Kalshi's API signs every trading and portfolio request with a key pair from the account page (<a href="https://docs.kalshi.com/getting_started/api_keys" rel="noopener">API keys docs</a>). The demo environment uses separate credentials from production (<a href="https://docs.kalshi.com/getting_started/api_environments" rel="noopener">API environments</a>).</div>

<h2>Status</h2>
${table([{ label: 'Item' }, { label: 'Status' }, { label: 'Notes' }], [
  ['Demo account funds, positions, fills', '<span class="badge b-block">Blocked</span>', 'Needs a demo API key. Nothing was pulled.'],
  ['Trades placed', '<span class="badge b-block">None</span>', 'No orders were placed.'],
  ['Trade categorization and strategy tests', '<span class="badge b-block">Blocked</span>', 'Depends on the trades above.'],
  ['Live trade log', '<span class="badge">Empty</span>', 'Will be filled after trades exist.'],
], {})}

<h2>What is needed to unblock</h2>
<div class="card"><ol class="tight">
  <li>A Kalshi demo account, created as described in <a href="https://docs.kalshi.com/getting_started/demo_env" rel="noopener">Test in the demo environment</a>.</li>
  <li>A demo API key created on the account profile page (<a href="https://kalshi.com/account/profile" rel="noopener">kalshi.com/account/profile</a>), with its key ID and private key. Keep the private key out of this repo.</li>
  <li>A decision on order size, topics allowed, and daily limits. These are safety settings for the demo account.</li>
</ol>
<p class="note">Sources: <a href="https://docs.kalshi.com/getting_started/demo_env" rel="noopener">Demo environment</a> · <a href="https://docs.kalshi.com/getting_started/api_keys" rel="noopener">API keys</a> · <a href="https://docs.kalshi.com/getting_started/rate_limits" rel="noopener">Rate limits</a></p></div>`;

pages['pages/questions.html'] = (root) => `
<h1>Questions, information, and gaps</h1>
<p class="lede">What must be answered before any decision can reasonably be made, based on what is and is not in hand now. Each open question names a way to find the answer.</p>
${table([
  { label: 'Question' }, { label: 'What we have' }, { label: 'What we are missing' }, { label: 'Answer status' }, { label: 'How to find it' },
], [
  ['Which Kalshi contracts count as "gas prices"?', 'Two diesel series (tag Gas).', 'Retail gasoline contracts; local (CA/SF) contracts.', '<span class="badge b-unv">Open</span>', 'Series query with more tags; check Kalshi category pages (kalshi.com). Source: <a href="https://external-api.kalshi.com/trade-api/v2/series?tags=Gas&limit=5">series?tags=Gas</a>'],
  ['Which EIA table settles DIESEL?', 'Contract PDF (retail) and API (spot) disagree.', 'Confirmation from Kalshi\'s rules or support.', '<span class="badge b-unv">Open</span>', 'Read <a href="https://assets.kalshi.com/contract_terms/DIESEL.pdf">DIESEL contract terms</a>; ask Kalshi support.'],
  ['Why do the diesel series show no open markets?', 'Empty markets responses.', 'Listing status and timing.', '<span class="badge b-unv">Open</span>', 'Re-query <a href="https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=DIESEL&status=open&limit=20">markets?series_ticker=DIESEL</a> on a schedule.'],
  ['What is "highest dollar amount"?', 'Contract-count volume fields.', 'A dollar-volume definition or field.', '<span class="badge b-unv">Open</span>', 'Decide a definition (see Suggestions). Docs: <a href="https://docs.kalshi.com/api-reference/market/get-markets">get-markets</a>.'],
  ['Is the Bitcoin "NOV" market data current?', 'updated_time 2026-09-08 with status active.', 'A current read.', '<span class="badge b-unv">Open</span>', 'Compare with <a href="https://external-api.kalshi.com/trade-api/v2/markets/KXBTCMAX100-26-NOV">markets/KXBTCMAX100-26-NOV</a> on a schedule.'],
  ['Does the live dashboard work from GitHub Pages?', 'Code written; not tested in a browser here.', 'Test result from a real browser.', '<span class="badge b-unv">Open</span>', 'Open the live page after publish. Check the status banner.'],
  ['What is the demo account balance and positions?', 'Nothing.', 'Demo API key.', '<span class="badge b-block">Blocked</span>', 'See Portfolio.'],
  ['Which strategies to test?', 'Nothing yet.', 'Trade history.', '<span class="badge b-block">Blocked</span>', 'Needs trades first.'],
  ['What are the fees?', 'Series list gives fee_type (quadratic) and fee_multiplier, not the fee amounts.', 'Fee formula from official docs.', '<span class="badge b-unv">Open</span>', 'Read the Kalshi fee documentation (not fetched in this session).'],
  ['Which golf quotes are real trades?', 'Quotes with zero volume.', 'Trade history.', '<span class="badge b-unv">Open</span>', 'Query trades endpoint for the market (<a href="https://docs.kalshi.com/api-reference/market/get-trades">get-trades</a>).'],
  ['Are the culture markets tradable?', 'Series listed; no markets returned.', 'Market listing.', '<span class="badge b-unv">Open</span>', 'Re-query by series after Kalshi lists markets.'],
], {})}

<h2>Information we already have (summary)</h2>
<div class="card"><ul class="tight">
  <li>21 Kalshi series with category, tags, frequency, and settlement sources (from the Kalshi API).</li>
  <li>9 captured Kalshi markets, 2 of them finalized (both NO).</li>
  <li>8 EIA reference prices (retail and spot), dated 11/16 to 11/18/26.</li>
  <li>The Kalshi API endpoints needed for markets, order books, candlesticks, and series (<a href="https://docs.kalshi.com/llms.txt">docs index</a>).</li>
</ul></div>`;

pages['pages/suggestions.html'] = (root) => `
<h1>Suggestions for review</h1>
<p class="lede">Proposed improvements. <b>None of these has been implemented.</b> Pick the ones you want and the rest stay as proposals. Each lists what it needs, so you can judge it before any change.</p>
${table([
  { label: 'ID' }, { label: 'Suggestion' }, { label: 'Why it helps decisions' }, { label: 'Needs' }, { label: 'Status' },
], [
  ['S1', 'Get a Kalshi demo API key and build the portfolio page on it.', 'Shows real positions and fills, which trade analysis depends on.', 'You create the demo key (see Portfolio).', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S2', 'Rank by dollar volume, computed from the trades endpoint, and label it clearly.', 'Matches the "highest dollar amount" request. The API has no dollar field.', 'Your definition of dollar volume.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S3', 'Store price and order-book snapshots on a schedule (GitHub Actions) to build history beyond one browser tab.', 'Charts and resolution history survive closing the page.', 'Approval to add a workflow; storage in the repo or a data branch.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S4', 'Add a data-freshness check: flag any market whose updated_time is old.', 'Catches stale rows like F-09.', 'Your freshness threshold.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S5', 'Search for retail gasoline and local (CA/SF) gas series, with more tags.', 'Closes the gas coverage gap (F-03, F-04).', 'Confirmation of the search scope.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S6', 'Hide or label placeholder series (for example KXSNAPELECTION) in the dashboard.', 'Keeps test-like data out of rankings (F-05).', 'Your policy: hide or label.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S7', 'Add a pre-trade checklist per market: spread, depth at target price, time to close, settlement source, last trade time.', 'Puts the liquidity questions in one place before any order.', 'Nothing beyond the current data.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S8', 'Add a resolution tracker that shows each market\'s result once finalized.', 'Directly supports the requirement to track yes/no outcomes.', 'Polling of finalized markets.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S9', 'Enforce demo-only order limits (size, daily count, topics) before any order code runs.', 'Limits the damage from a bad order during testing.', 'Your limits.', '<span class="badge b-unv">Awaiting your choice</span>'],
  ['S10', 'Add a LICENSE, a .gitignore, and a README describing the data and sources.', 'Basic repo hygiene (F-20).', 'Your choice of license.', '<span class="badge b-unv">Awaiting your choice</span>'],
], {})}
<p class="note">Reply with the IDs you want (for example "S2, S4, S6"). Only the chosen items will be built.</p>`;

pages['pages/flagged.html'] = (root) => `
<h1>Flagged for Review</h1>
<p class="lede">Irregularities and unverified items, with links. These do not block the site from going live. Review them and request changes. Each item links to its source.</p>
<div class="card"><p><b>Unverified rows.</b> Values that could not be confirmed were left blank. Rows marked "Unverified" have no confirmed source. Current unverified areas: live dashboard browser access (F-18), diesel settlement table (F-02), and any fee amounts (not in the data).</p></div>
<h2>All flags</h2>
${flagsTable(snap.flags)}
<h2>Repo review notes</h2>
<div class="card"><ul class="tight">
  <li>The repo had one commit ("Initial commit") and a README containing only the title. No LICENSE, .gitignore, tests, or CI (F-20).</li>
  <li>GitHub Pages was enabled from <code>main</code>, path <code>/</code>, legacy build (F-21).</li>
  <li><a href="https://github.com/kanlerxz87-cyber/KalshiDash2">Repository</a> · <a href="https://api.github.com/repos/kanlerxz87-cyber/KalshiDash2/pages">Pages API</a></li>
</ul></div>`;

pages['pages/sources.html'] = (root) => `
<h1>Sources</h1>
<p class="lede">Every official source used. Live Kalshi endpoints change; re-check before relying on a value. Captured ${CAPTURED}.</p>
${table([{ label: 'Source' }, { label: 'URL' }, { label: 'Used for' }], [
  ['Kalshi API docs: welcome / index', '<a href="https://docs.kalshi.com/welcome">docs.kalshi.com/welcome</a>', 'Overview; docs index'],
  ['Kalshi API docs: index (llms.txt)', '<a href="https://docs.kalshi.com/llms.txt">docs.kalshi.com/llms.txt</a>', 'List of endpoints and pages'],
  ['Kalshi API environments', '<a href="https://docs.kalshi.com/getting_started/api_environments">api_environments</a>', 'Production and demo hosts'],
  ['Kalshi demo environment', '<a href="https://docs.kalshi.com/getting_started/demo_env">demo_env</a>', 'Demo account and host'],
  ['Kalshi API keys', '<a href="https://docs.kalshi.com/getting_started/api_keys">api_keys</a>', 'Auth needed for trading'],
  ['Kalshi rate limits', '<a href="https://docs.kalshi.com/getting_started/rate_limits">rate_limits</a>', 'Limits and 429 handling'],
  ['Kalshi order books', '<a href="https://docs.kalshi.com/getting_started/orderbook_responses">orderbook_responses</a>', 'Order-book structure; bids only'],
  ['Get markets', '<a href="https://docs.kalshi.com/api-reference/market/get-markets">get-markets</a>', 'Market fields; status filter values'],
  ['Get market', '<a href="https://docs.kalshi.com/api-reference/market/get-market">get-market</a>', 'Single market endpoint'],
  ['Get market candlesticks', '<a href="https://docs.kalshi.com/api-reference/market/get-market-candlesticks">get-market-candlesticks</a>', 'Chart candles (1, 60, 1440 min)'],
  ['Get series list', '<a href="https://docs.kalshi.com/api-reference/market/get-series-list">get-series-list</a>', 'Category/tag filters; include_volume'],
  ['Kalshi API: series by category/tag (captured)', '<a href="https://external-api.kalshi.com/trade-api/v2/series?category=Crypto&limit=5">series?category=Crypto</a>, <a href="https://external-api.kalshi.com/trade-api/v2/series?tags=Golf&limit=5">series?tags=Golf</a>, <a href="https://external-api.kalshi.com/trade-api/v2/series?tags=Gas&limit=5">series?tags=Gas</a>', 'Series rows'],
  ['Kalshi API: markets (captured)', '<a href="https://external-api.kalshi.com/trade-api/v2/markets/KXBTCMAX100-26-DEC">markets/KXBTCMAX100-26-DEC</a>, <a href="https://external-api.kalshi.com/trade-api/v2/markets?series_ticker=KXPGA3BALL&status=open&limit=20">KXPGA3BALL markets</a>', 'Market rows'],
  ['Kalshi contract terms: DIESEL', '<a href="https://assets.kalshi.com/contract_terms/DIESEL.pdf">DIESEL.pdf</a>', 'Settlement table for diesel'],
  ['EIA: weekly retail gasoline and diesel', '<a href="https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm">PET_PRI_GND_DCUS_NUS_W</a>', 'U.S. retail reference prices'],
  ['EIA: daily spot prices', '<a href="https://www.eia.gov/petroleum/prices/table.php?show_by=12_series&period=D&table_key=PET_PRI_SPT_S1_D">PET_PRI_SPT_S1_D</a>', 'Spot reference prices'],
  ['GitHub Pages config (API)', '<a href="https://api.github.com/repos/kanlerxz87-cyber/KalshiDash2/pages">repos/…/pages</a>', 'Pages source and URL'],
], {})}`;

// ---------- write files ----------
function write(rel, html) {
  const out = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

const TITLES = {
  'index.html': 'Home', 'live.html': 'Live dashboard', 'pages/gas.html': 'Gas prices', 'pages/elections.html': 'Elections',
  'pages/culture.html': 'Culture', 'pages/crypto.html': 'Crypto', 'pages/golf.html': 'Golf', 'pages/resolved.html': 'Resolved',
  'pages/analysis.html': 'Analysis', 'pages/portfolio.html': 'Portfolio', 'pages/questions.html': 'Questions & gaps',
  'pages/suggestions.html': 'Suggestions', 'pages/flagged.html': 'Flagged for Review', 'pages/sources.html': 'Sources',
};

for (const [rel, fn] of Object.entries(pages)) {
  const depth = rel.includes('/') ? 1 : 0;
  const root = depth ? '../' : '';
  const body = fn(root).replace(/__ROOT__/g, root);
  write(rel, layout({ title: TITLES[rel], active: rel, body, root, script: rel === 'live.html' ? null : null }));
}

write('.nojekyll', '');
console.log(`built ${Object.keys(pages).length} pages from data/snapshot.json (captured ${CAPTURED})`);

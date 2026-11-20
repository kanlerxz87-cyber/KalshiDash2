#!/usr/bin/env node
/**
 * Kalshi public market-data collector (T3).
 *
 * Reads ONLY unauthenticated, public GET endpoints of the Kalshi Trade API
 * (documented at https://docs.kalshi.com/api-reference) for two environments:
 *   - demo        https://external-api.demo.kalshi.co/trade-api/v2   (recommended demo host)
 *   - production  https://external-api.kalshi.com/trade-api/v2       (real markets, read-only)
 *
 * No orders are placed and no credentials are used. Every stored value keeps the
 * official API URL it came from (`source_url`) and the fetch time (`fetched_at`).
 * Fields that the API does not return are stored as null and listed in `flags`
 * so the site can show them as UNVERIFIED instead of filling them in.
 *
 * Output: site/data/{meta,series,markets,resolved,orderbooks,candles}.json
 * Runtime: Node >= 18 (global fetch). Run: node scripts/collect.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', 'site', 'data');

const ENVS = [
  { name: 'demo', base: 'https://external-api.demo.kalshi.co/trade-api/v2', web: 'https://demo.kalshi.co' },
  { name: 'production', base: 'https://external-api.kalshi.com/trade-api/v2', web: 'https://kalshi.com' },
];

// Topic -> how a series is matched. Official `category` values come from the
// Kalshi tags_by_categories endpoint; the title regex is a documented heuristic.
const TOPICS = {
  // Retail gasoline only (AAA national average series). Crude oil and natural-gas futures are excluded on purpose.
  gas_prices: { categories: ['Economics'], tags: [], title: /\bgas price|gasoline|\bAAA\b/i, tickerPrefix: 'KXAAAGAS' },
  elections: { categories: ['Elections'], tags: [], title: null },
  culture: { categories: ['Entertainment'], tags: [], title: null },
  crypto: { categories: ['Crypto'], tags: [], title: null },
  golf: { categories: ['Sports'], tags: ['Golf'], title: /\bgolf\b|\bPGA\b|\bmasters\b|\bLIV\b|ryder cup/i },
};

const MAX_SERIES_PER_TOPIC = Number(process.env.MAX_SERIES_PER_TOPIC || 40);
const MAX_TRADE_PAGES = Number(process.env.MAX_TRADE_PAGES || 5);
const TOP_N_TRADES = Number(process.env.TOP_N_TRADES || 25);
const TOP_N_BOOK = Number(process.env.TOP_N_BOOK || 10);
const TOP_N_CANDLES = Number(process.env.TOP_N_CANDLES || 6);
const SLEEP_MS = Number(process.env.SLEEP_MS || 120);

const PAGES_ORIGIN = process.env.PAGES_ORIGIN || 'https://kanlerxz87-cyber.github.io';
const fetchedAt = new Date().toISOString();
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

async function getJSON(url, { optional = false } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(SLEEP_MS);
    let res;
    try {
      res = await fetch(url, { headers: { accept: 'application/json' } });
    } catch (e) {
      if (attempt === 4) { errors.push({ url, error: String(e) }); return null; }
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      if (!optional) errors.push({ url, status: res.status });
      return null;
    }
    return res.json();
  }
  errors.push({ url, error: 'retries exhausted' });
  return null;
}

async function listAll(url, key, maxPages = 50) {
  const out = [];
  let cursor = '';
  for (let i = 0; i < maxPages; i++) {
    const sep = url.includes('?') ? '&' : '?';
    const page = await getJSON(`${url}${sep}${cursor ? `cursor=${encodeURIComponent(cursor)}` : ''}`);
    if (!page) break;
    out.push(...(page[key] || []));
    cursor = page.cursor || '';
    if (!cursor) break;
  }
  return out;
}

function matchesTopic(series, topic) {
  const def = TOPICS[topic];
  const cats = new Set([...(series.categories || []), series.category].filter(Boolean));
  const tags = series.tags || [];
  if (def.tickerPrefix && (series.ticker || '').startsWith(def.tickerPrefix)) return true;
  const byCat = def.categories.some((c) => cats.has(c));
  const byTag = def.tags.length && def.tags.some((t) => tags.includes(t));
  const byTitle = def.title ? def.title.test(series.title || '') : false;
  if (def.tags.length) return byTag || (byTitle && byCat);
  if (def.title) return byTitle && byCat;
  return byCat;
}

function matchedBy(series, topic) {
  const def = TOPICS[topic];
  const why = [];
  const cats = new Set([...(series.categories || []), series.category].filter(Boolean));
  if (def.categories.some((c) => cats.has(c))) why.push(`category:${def.categories.find((c) => cats.has(c))}`);
  const hit = def.tags.filter((t) => (series.tags || []).includes(t));
  if (hit.length) why.push(`tag:${hit.join('|')}`);
  if (def.title && def.title.test(series.title || '')) why.push('title-keyword');
  if (def.tickerPrefix && (series.ticker || '').startsWith(def.tickerPrefix)) why.push(`ticker-prefix:${def.tickerPrefix}`);
  return why.join(', ');
}

function marketRow(env, topic, series, m) {
  const flags = [];
  const row = {
    env: env.name,
    topic,
    series_ticker: series.ticker,
    event_ticker: m.event_ticker ?? null,
    ticker: m.ticker,
    title: m.title ?? null,
    yes_subtitle: m.yes_sub_title ?? null,
    status: m.status ?? null,
    result: m.result ?? null,
    close_time: m.close_time ?? null,
    yes_bid: num(m.yes_bid_dollars),
    yes_ask: num(m.yes_ask_dollars),
    last_price: num(m.last_price_dollars),
    volume_contracts: num(m.volume_fp),
    volume_24h_contracts: num(m.volume_24h_fp),
    open_interest_contracts: num(m.open_interest_fp),
    dollar_volume_sample: null,
    trades_sampled: null,
    trades_complete: null,
    source_url: `${env.base}/markets/${m.ticker}`,
    fetched_at: fetchedAt,
    flags,
  };
  if (/DEMO/i.test(m.ticker || '')) flags.push('demo-only-ticker');
  if (row.yes_bid === null && row.yes_ask === null) flags.push('no-quotes-returned');
  if (row.volume_contracts === 0) flags.push('zero-volume');
  if (!row.title) flags.push('title-missing');
  return row;
}

async function tradeSample(env, ticker) {
  let sum = 0;
  let count = 0;
  let pages = 0;
  let cursor = '';
  let complete = false;
  while (pages < MAX_TRADE_PAGES) {
    const url = `${env.base}/markets/trades?ticker=${encodeURIComponent(ticker)}&limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page = await getJSON(url);
    if (!page) break;
    pages++;
    for (const t of page.trades || []) {
      const c = num(t.count_fp);
      const p = num(t.yes_price_dollars);
      if (c !== null && p !== null) { sum += c * p; count++; }
    }
    cursor = page.cursor || '';
    if (!cursor) { complete = true; break; }
  }
  return { dollar: count ? Number(sum.toFixed(2)) : null, trades: count, complete };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const meta = { generated_at: fetchedAt, environments: {}, topics: {}, notes: [], errors };
  const seriesOut = [];
  const markets = [];
  const resolved = [];
  const orderbooks = {};
  const candles = {};

  for (const env of ENVS) {
    const status = await getJSON(`${env.base}/exchange/status`);
    meta.environments[env.name] = { base: env.base, web: env.web, exchange_status: status, status_url: `${env.base}/exchange/status` };
    // Browser-side live refresh only works if the API allows cross-origin reads. Record what it returns.
    try {
      const probe = await fetch(`${env.base}/exchange/status`, { headers: { Origin: PAGES_ORIGIN } });
      meta.environments[env.name].cors_allow_origin_header = probe.headers.get('access-control-allow-origin');
    } catch (e) {
      meta.environments[env.name].cors_allow_origin_header = `error: ${e}`;
    }

    // Full series catalogue with per-series volume (official include_volume flag).
    const allSeries = [];
    for (const category of new Set(Object.values(TOPICS).flatMap((t) => t.categories))) {
      const res = await getJSON(`${env.base}/series?category=${encodeURIComponent(category)}&include_volume=true`);
      for (const s of res?.series || []) allSeries.push({ ...s, __cat: category });
    }
    const uniq = new Map(allSeries.map((s) => [s.ticker, s]));
    meta.environments[env.name].series_catalogue_size = uniq.size;

    for (const topic of Object.keys(TOPICS)) {
      const matched = [...uniq.values()]
        .filter((s) => matchesTopic(s, topic))
        .sort((a, b) => Number(b.volume_fp ?? b.volume ?? 0) - Number(a.volume_fp ?? a.volume ?? 0))
        .slice(0, MAX_SERIES_PER_TOPIC);
      meta.topics[topic] ||= { definition: TOPICS[topic] && { categories: TOPICS[topic].categories, tags: TOPICS[topic].tags, title_regex: TOPICS[topic].title ? String(TOPICS[topic].title) : null } };
      meta.topics[topic][env.name] = { series_matched: matched.length };

      for (const s of matched) {
        seriesOut.push({
          env: env.name,
          topic,
          ticker: s.ticker,
          title: s.title ?? null,
          category: s.category ?? null,
          categories: s.categories ?? [],
          tags: s.tags ?? [],
          frequency: s.frequency ?? null,
          volume_fp: num(s.volume_fp ?? s.volume),
          matched_by: matchedBy(s, topic),
          contract_terms_url: s.contract_terms_url ?? null,
          settlement_sources: (s.settlement_sources || []).map((x) => ({ name: x.name, url: x.url })),
          source_url: `${env.base}/series/${s.ticker}`,
          fetched_at: fetchedAt,
        });

        const open = await listAll(`${env.base}/markets?series_ticker=${encodeURIComponent(s.ticker)}&status=open&limit=1000`, 'markets', 5);
        for (const m of open) markets.push(marketRow(env, topic, s, m));

        const settled = await getJSON(`${env.base}/markets?series_ticker=${encodeURIComponent(s.ticker)}&status=settled&limit=50`, { optional: true });
        for (const m of settled?.markets || []) {
          const row = marketRow(env, topic, s, m);
          row.settled_time = m.settlement_ts ?? m.settled_time ?? null;
          row.close_time_ms = m.close_time ? Date.parse(m.close_time) : 0;
          row.source_url = `${env.base}/markets/${m.ticker}`;
          resolved.push(row);
        }
      }
    }
  }

  // Enrich top-N open markets per environment/topic with trade-derived dollar volume,
  // order books and candlesticks. All computed values are labelled as samples.
  for (const env of ENVS) {
    for (const topic of Object.keys(TOPICS)) {
      const list = markets
        .filter((r) => r.env === env.name && r.topic === topic)
        .sort((a, b) => (b.volume_contracts ?? 0) - (a.volume_contracts ?? 0));
      for (const [i, row] of list.entries()) {
        if (i >= TOP_N_TRADES) break;
        const t = await tradeSample(env, row.ticker);
        row.dollar_volume_sample = t.dollar;
        row.trades_sampled = t.trades;
        row.trades_complete = t.complete;
        row.trades_source_url = `${env.base}/markets/trades?ticker=${row.ticker}&limit=1000`;
      }
      for (const [i, row] of list.entries()) {
        if (i >= TOP_N_BOOK) break;
        const key = `${env.name}:${row.ticker}`;
        orderbooks[key] = {
          env: env.name, ticker: row.ticker, topic,
          source_url: `${env.base}/markets/${row.ticker}/orderbook`,
          fetched_at: fetchedAt,
          orderbook: await getJSON(`${env.base}/markets/${row.ticker}/orderbook`, { optional: true }),
        };
      }
      for (const [i, row] of list.entries()) {
        if (i >= TOP_N_CANDLES) break;
        const end = Math.floor(Date.now() / 1000);
        const start = end - 7 * 86400;
        const url = `${env.base}/series/${row.series_ticker}/markets/${row.ticker}/candlesticks?start_ts=${start}&end_ts=${end}&period_interval=60`;
        const res = await getJSON(url, { optional: true });
        candles[`${env.name}:${row.ticker}`] = {
          env: env.name, ticker: row.ticker, topic, period_minutes: 60,
          source_url: url, fetched_at: fetchedAt,
          candlesticks: res?.candlesticks ?? null,
        };
      }
    }
  }

  // Re-verify every top-N market row against the single-market endpoint (line-by-line check).
  let reverified = 0;
  let mismatched = 0;
  for (const row of markets.filter((r) => r.trades_complete !== null)) {
    const env = ENVS.find((e) => e.name === row.env);
    const one = await getJSON(`${env.base}/markets/${row.ticker}`, { optional: true });
    if (!one?.market) { row.flags.push('reverify-failed'); continue; }
    reverified++;
    const same = num(one.market.yes_bid_dollars) === row.yes_bid && num(one.market.volume_fp) === row.volume_contracts;
    row.reverified_at = fetchedAt;
    row.reverify_match = same;
    if (!same) { mismatched++; row.flags.push('changed-during-collection'); }
  }

  // Keep the browser payload small: top open markets per topic/env by contract volume,
  // and the most recent resolved markets per topic/env. Full counts stay in meta.counts.
  const OPEN_KEEP = Number(process.env.OPEN_KEEP || 300);
  const RESOLVED_KEEP = Number(process.env.RESOLVED_KEEP || 100);
  const keepTop = (rows, key, n) => {
    const out = [];
    for (const env of ENVS) for (const topic of Object.keys(TOPICS)) {
      out.push(...rows.filter((r) => r.env === env.name && r.topic === topic).sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n));
    }
    return out;
  };
  const openTotal = markets.length;
  const resolvedTotal = resolved.length;
  const openKept = keepTop(markets, 'volume_contracts', OPEN_KEEP);
  const resolvedKept = keepTop(resolved, 'close_time_ms', RESOLVED_KEEP);

  meta.counts = { series: seriesOut.length, open_markets_total: openTotal, open_markets_published: openKept.length, resolved_markets_total: resolvedTotal, resolved_markets_published: resolvedKept.length, orderbooks: Object.keys(orderbooks).length, candle_sets: Object.keys(candles).length, reverified, reverify_mismatch: mismatched };
  meta.notes.push('Open markets are read with status=open; the API returns row status "active" for tradable markets (see flags in meta).');
  meta.notes.push('dollar_volume_sample = sum(count_fp x yes_price_dollars) over the most recent trades returned by /markets/trades (up to MAX_TRADE_PAGES x 1000). trades_complete=false means older trades were not sampled.');

  const write = (name, data) => writeFile(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  await write('meta.json', meta);
  await write('series.json', seriesOut);
  await write('markets.json', openKept);
  await write('resolved.json', resolvedKept);
  await write('orderbooks.json', orderbooks);
  await write('candles.json', candles);
  console.log(JSON.stringify(meta.counts), 'errors:', errors.length);
}

main().catch((e) => { console.error(e); process.exit(1); });

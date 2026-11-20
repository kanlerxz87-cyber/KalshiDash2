/* Shared template for the five category pages. Reads window.KD_TOPIC (set in each HTML page). */
(async () => {
  const topic = window.KD_TOPIC;
  const T = KD.TOPICS[topic];
  KD.renderNav(T.page);
  const main = document.getElementById('content');
  const [meta, markets, resolved, series] = await Promise.all([
    KD.load('meta'), KD.load('markets'), KD.load('resolved'), KD.load('series'),
  ]).catch((e) => { KD.showError('Data not available: ' + e.message); return [null, [], [], []]; });
  if (!meta) return;
  const state = { env: 'demo' };
  const snap = meta.generated_at ? new Date(meta.generated_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown';
  const def = meta.topics?.[topic]?.definition || {};

  const open = () => markets.filter((m) => m.topic === topic && m.env === state.env).sort((a, b) => (b.volume_contracts ?? 0) - (a.volume_contracts ?? 0));
  const res = () => resolved.filter((m) => m.topic === topic && m.env === state.env).sort((a, b) => (b.close_time_ms ?? 0) - (a.close_time_ms ?? 0));
  const spread = (m) => (KD.isNil(m.yes_ask) || KD.isNil(m.yes_bid) ? null : m.yes_ask - m.yes_bid);

  function findings() {
    const o = open(), r = res();
    const zero = o.filter((m) => m.volume_contracts === 0).length;
    const sp = KD.median(o.map(spread));
    const yes = r.filter((m) => m.result === 'yes').length, no = r.filter((m) => m.result === 'no').length;
    const yesRate = yes + no ? (yes / (yes + no)) * 100 : null;
    const flagged = o.filter((m) => (m.flags || []).length).length;
    return { o, r, zero, sp, yes, no, yesRate, flagged };
  }

  function render() {
    const f = findings();
    const cards = [
      ['Open rows published', f.o.length.toLocaleString('en-US'), 'top by contracts traded'],
      ['Open rows with zero volume', f.o.length ? `${((f.zero / f.o.length) * 100).toFixed(0)}%` : null, `${f.zero} of ${f.o.length}`],
      ['Median YES spread (ask − bid)', KD.cell(f.sp, (x) => `${(x * 100).toFixed(1)}¢`), 'rows with both quotes'],
      ['Resolved YES share', KD.cell(f.yesRate, (x) => `${x.toFixed(0)}%`), `${f.yes} yes · ${f.no} no published`],
    ];
    document.getElementById('kpis').innerHTML = cards.map(([k, v, s]) =>
      `<div class="card"><div class="k">${KD.esc(k)}</div><div class="v">${v}</div><div class="small muted">${KD.esc(s)}</div></div>`).join('');

    document.getElementById('open').innerHTML = KD.table(f.o, [
      { label: 'Market', html: (m) => `<div>${KD.esc(m.title ?? '')}</div><div class="ticker">${KD.esc(m.ticker)}</div>${KD.badge(m.flags)}`, value: (m) => m.title ?? '', cls: 'title' },
      { label: 'Series', html: (m) => `<span class="ticker">${KD.esc(m.series_ticker)}</span>`, value: (m) => m.series_ticker },
      { label: 'Yes bid', num: true, html: (m) => KD.cents(m.yes_bid), value: (m) => m.yes_bid ?? -1 },
      { label: 'Yes ask', num: true, html: (m) => KD.cents(m.yes_ask), value: (m) => m.yes_ask ?? -1 },
      { label: 'Spread', num: true, html: (m) => KD.cents(spread(m)), value: (m) => spread(m) ?? -1 },
      { label: 'Last', num: true, html: (m) => KD.cents(m.last_price), value: (m) => m.last_price ?? -1 },
      { label: 'Contracts traded', num: true, html: (m) => KD.count(m.volume_contracts), value: (m) => m.volume_contracts ?? -1 },
      { label: 'Open interest', num: true, html: (m) => KD.count(m.open_interest_contracts), value: (m) => m.open_interest_contracts ?? -1 },
      { label: 'Dollar vol (sample)', num: true, html: (m) => KD.sampled(m.dollar_volume_sample), value: (m) => m.dollar_volume_sample ?? -1 },
      { label: 'Closes', html: (m) => KD.when(m.close_time), value: (m) => m.close_time ?? '' },
      { label: 'Source', noSort: true, html: (m) => KD.link(m.source_url) },
    ]);

    document.getElementById('resolved').innerHTML = KD.table(f.r, [
      { label: 'Market', html: (m) => `<div>${KD.esc(m.title ?? '')}</div><div class="ticker">${KD.esc(m.ticker)}</div>`, value: (m) => m.title ?? '', cls: 'title' },
      { label: 'Result', html: (m) => KD.cell(m.result, (x) => `<span class="tag ${x === 'yes' || x === 'no' ? x : 'todo'}">${KD.esc(String(x).toUpperCase())}</span>`), value: (m) => m.result ?? '' },
      { label: 'Status', html: (m) => KD.cell(m.status, KD.esc), value: (m) => m.status ?? '' },
      { label: 'Closed', html: (m) => KD.when(m.close_time), value: (m) => m.close_time ?? '' },
      { label: 'Last price', num: true, html: (m) => KD.cents(m.last_price), value: (m) => m.last_price ?? -1 },
      { label: 'Contracts traded', num: true, html: (m) => KD.count(m.volume_contracts), value: (m) => m.volume_contracts ?? -1 },
      { label: 'Source', noSort: true, html: (m) => KD.link(m.source_url) },
    ]);

    const sers = series.filter((s) => s.topic === topic && s.env === state.env);
    document.getElementById('series').innerHTML = KD.table(sers, [
      { label: 'Series', html: (s) => `<span class="ticker">${KD.esc(s.ticker)}</span><div>${KD.esc(s.title ?? '')}</div>`, value: (s) => s.title ?? '', cls: 'title' },
      { label: 'Category', html: (s) => KD.cell(s.category, KD.esc), value: (s) => s.category ?? '' },
      { label: 'Tags', html: (s) => (s.tags || []).map((t) => `<span class="tag">${KD.esc(t)}</span>`).join('') || KD.cell(null), value: (s) => (s.tags || []).join(',') },
      { label: 'Matched by', html: (s) => `<span class="small">${KD.esc(s.matched_by)}</span>`, value: (s) => s.matched_by ?? '' },
      { label: 'Series volume', num: true, html: (s) => KD.count(s.volume_fp), value: (s) => s.volume_fp ?? -1 },
      { label: 'Settlement sources (as listed)', noSort: true, html: (s) => (s.settlement_sources || []).slice(0, 6).map((x) => `<a href="${KD.esc(x.url)}" target="_blank" rel="noopener">${KD.esc(x.name)}</a>`).join('<br>') || KD.cell(null) },
      { label: 'Contract terms', noSort: true, html: (s) => KD.link(s.contract_terms_url, 'terms ↗') },
      { label: 'Source', noSort: true, html: (s) => KD.link(s.source_url) },
    ]);

    document.getElementById('findings').innerHTML = `<ul class="clean">
      <li>${f.o.length.toLocaleString('en-US')} open rows are published for <b>${KD.esc(state.env)}</b> (top by contracts traded). ${f.zero} of them show zero contracts traded — those rows carry no price discovery.</li>
      <li>Median YES spread across rows with both quotes: ${KD.cell(f.sp, (x) => (x * 100).toFixed(1) + '¢')}. Spread = yes ask − yes bid, both from the market endpoint.</li>
      <li>Resolved rows published: ${f.r.length}. Official results: ${f.yes} YES, ${f.no} NO${f.yesRate === null ? '' : ` (YES share ${f.yesRate.toFixed(0)}%)`}. Rows with a result other than yes/no are shown as-is.</li>
      <li>${f.flagged} open rows carry at least one flag (see the Flags badges and <a href="flagged.html">Flagged for Review</a>).</li>
      <li class="small muted">Computed from the snapshot taken ${KD.esc(snap)}. Nothing here is a forecast or a recommendation.</li>
    </ul>`;
  }

  main.innerHTML = `
    <h1>${KD.esc(T.label)}</h1>
    <p class="lead">Matching rule: ${KD.esc(T.rule)}. Snapshot ${KD.esc(snap)}.</p>
    <div class="banner warn">${KD.esc(T.caveat)}</div>
    <div class="toolbar"><label>Environment
      <select id="env"><option value="demo">Demo (mock funds)</option><option value="production">Production (read-only)</option></select></label>
      <input id="q" type="search" placeholder="Filter rows…" aria-label="filter"></div>
    <div class="grid" id="kpis"></div>
    <h2>Findings</h2><div class="card" id="findings"></div>
    <h2>Open markets — live, highest contracts traded first</h2><div class="table-wrap" id="open"></div>
    <h2>Resolved markets — official yes / no result</h2><div class="table-wrap" id="resolved"></div>
    <h2>Series in this topic</h2><div class="table-wrap" id="series"></div>
    <p class="small muted">Category definition used: categories ${KD.esc((def.categories || []).join(', ') || '—')} · tags ${KD.esc((def.tags || []).join(', ') || '—')} · title keyword ${KD.esc(def.title_regex || '—')}.</p>`;

  document.getElementById('env').addEventListener('change', (e) => { state.env = e.target.value; render(); document.getElementById('q').dispatchEvent(new Event('input')); });
  render();
  // Simple filter across the three tables.
  document.getElementById('q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.table-wrap table tbody tr').forEach((tr) => {
      tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
})();

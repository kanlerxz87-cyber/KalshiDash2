/* Kalshi Dash — shared front-end helpers (static, no build step).
 * All numbers shown on the site come from site/data/*.json, which is written by
 * scripts/collect.mjs from public Kalshi Trade API GET endpoints. Nothing is typed in by hand.
 * A null value is rendered as UNVERIFIED (blank) — it is never estimated or filled in.
 */
(function () {
  const NAV = [
    ['index.html', 'Home'],
    ['dashboard.html', 'Live dashboard'],
    ['gas.html', 'Gas prices'],
    ['elections.html', 'Elections'],
    ['culture.html', 'Culture'],
    ['crypto.html', 'Crypto'],
    ['golf.html', 'Golf'],
    ['analysis.html', 'Analysis & strategy'],
    ['portfolio.html', 'Portfolio & trades'],
    ['suggestions.html', 'Suggestions'],
    ['questions.html', 'Questions & gaps'],
    ['flagged.html', 'Flagged for Review'],
  ];
  const TOPICS = {
    gas_prices: { label: 'Gas prices', page: 'gas.html',
      rule: 'series whose title mentions gas price, gasoline or AAA, plus tickers starting KXAAAGAS (AAA national-average gasoline series). Crude oil and natural-gas futures are excluded',
      caveat: 'Gas-price series are matched by keyword and ticker prefix, not by an official Kalshi category. Confirm the list on the Questions & gaps page.' },
    elections: { label: 'Elections', page: 'elections.html',
      rule: 'official Kalshi category "Elections" (all series in that category, ranked by series volume)',
      caveat: 'Election markets include primaries and international races. Resolution depends on each series settlement source (listed on each row).' },
    culture: { label: 'Culture', page: 'culture.html',
      rule: 'official Kalshi category "Entertainment" (music, awards, TV, film, online culture). "Culture" itself is not a Kalshi category name',
      caveat: '"Culture" is our label. The Kalshi category used is "Entertainment", which also includes sports-adjacent events such as Super Bowl halftime markets.' },
    crypto: { label: 'Crypto', page: 'crypto.html',
      rule: 'official Kalshi category "Crypto" (15-minute, hourly and daily price series)',
      caveat: 'Many crypto series are very short-dated (15 minutes). Price movement and volume can change within a single snapshot.' },
    golf: { label: 'Golf', page: 'golf.html',
      rule: 'official Kalshi category "Sports" restricted to series tagged "Golf" (plus series whose title names a golf event)',
      caveat: 'Golf series include tournament winners, round leaders and finisher markets. Event timing varies, so many rows close far in the future.' },
  };
  const ENV_LABEL = { demo: 'Demo (mock funds)', production: 'Production (real markets, read-only)' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UNV = '<span class="unv" title="Not returned by the official API — left blank, not estimated">UNVERIFIED</span>';
  const isNil = (v) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
  const cell = (v, f) => (isNil(v) ? UNV : f(v));
  const cents = (v) => cell(v, (x) => `${(x * 100).toFixed(1)}¢`);
  const usd = (v) => cell(v, (x) => `$${Number(x).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`);
  const sampled = (v) => (isNil(v) ? '<span class="muted small" title="Not requested for this row (only the top rows are trade-sampled)">not sampled</span>' : usd(v));
  const count = (v) => cell(v, (x) => Number(x).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const when = (iso) => cell(iso, (x) => {
    const d = new Date(x);
    return isNaN(d) ? esc(x) : d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  });
  const link = (url, label = 'API ↗') => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : UNV);

  function renderNav(active) {
    const el = document.getElementById('nav');
    if (!el) return;
    el.innerHTML = `<header class="top"><span class="brand">Kalshi Dash</span>` +
      NAV.map(([href, label]) => `<a href="${href}" class="${href === active ? 'active' : ''}">${esc(label)}</a>`).join('') +
      `</header>`;
  }

  const cache = {};
  async function load(name) {
    if (!(name in cache)) {
      cache[name] = fetch(`data/${name}.json`, { cache: 'no-store' }).then((r) => {
        if (!r.ok) throw new Error(`${name}.json HTTP ${r.status}`);
        return r.json();
      });
    }
    return cache[name];
  }

  function showError(msg) {
    const main = document.querySelector('main') || document.body;
    const d = document.createElement('div');
    d.className = 'banner bad';
    d.textContent = msg;
    main.prepend(d);
  }

  /* Generic sortable, filterable table. cols: [{key, label, html(row), value(row), num?}] */
  function table(rows, cols, opts = {}) {
    const id = 't' + Math.random().toString(36).slice(2, 8);
    const head = cols.map((c, i) => `<th class="${c.num ? 'num' : ''} ${c.noSort ? 'noSort' : ''}" data-i="${i}">${esc(c.label)}</th>`).join('');
    const body = rows.map((r, ri) => `<tr data-ri="${ri}" class="${opts.onRowClick ? 'clickable' : ''}">` +
      cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.html(r)}</td>`).join('') + '</tr>').join('');
    const html = `<div class="table-wrap"><table id="${id}"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="muted">No rows.</td></tr>`}</tbody></table></div>`;
    queueMicrotask(() => {
      const t = document.getElementById(id);
      if (!t) return;
      const tb = t.tBodies[0];
      t.tHead.querySelectorAll('th').forEach((th) => {
        if (th.classList.contains('noSort')) return;
        th.addEventListener('click', () => {
          const i = Number(th.dataset.i);
          const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
          t.tHead.querySelectorAll('th').forEach((x) => delete x.dataset.dir);
          th.dataset.dir = dir;
          const get = (tr) => { const v = cols[i].value ? cols[i].value(rows[Number(tr.dataset.ri)]) : ''; return v; };
          const trs = [...tb.rows].sort((a, b) => {
            const va = get(a), vb = get(b);
            const na = typeof va === 'number', nb = typeof vb === 'number';
            if (na && nb) return dir === 'asc' ? va - vb : vb - va;
            return dir === 'asc' ? String(va ?? '').localeCompare(String(vb ?? '')) : String(vb ?? '').localeCompare(String(va ?? ''));
          });
          trs.forEach((tr) => tb.appendChild(tr));
        });
      });
      if (opts.onRowClick) {
        tb.addEventListener('click', (e) => {
          const tr = e.target.closest('tr[data-ri]');
          if (!tr || e.target.closest('a')) return;
          tb.querySelectorAll('tr.sel').forEach((x) => x.classList.remove('sel'));
          tr.classList.add('sel');
          opts.onRowClick(rows[Number(tr.dataset.ri)]);
        });
      }
    });
    return html;
  }

  /* Search box that hides table rows whose text matches. */
  function bindSearch(inputId, tableId) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      document.querySelectorAll(`#${tableId} tbody tr`).forEach((tr) => {
        tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  /* Minimal SVG line chart. series: [{name, color, points:[{x (ms), y (0..1|null)}]}] */
  function lineChart(el, seriesList, { xFmt, yLabel }) {
    const W = 900, H = 300, pad = { l: 52, r: 14, t: 12, b: 28 };
    const pts = seriesList.flatMap((s) => s.points).filter((p) => p.y !== null && p.y !== undefined);
    if (!pts.length) { el.innerHTML = `<div class="banner warn">No price points returned by the API for this window. Nothing has been estimated.</div>`; return; }
    const xs = pts.map((p) => p.x);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
    const X = (x) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
    const Y = (y) => pad.t + (1 - y) * (H - pad.t - pad.b);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = i / 4;
      g += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${(v * 100).toFixed(0)}¢</text>`;
    }
    for (let i = 0; i <= 4; i++) {
      const t = x0 + ((x1 - x0) * i) / 4;
      g += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle">${esc(xFmt(t))}</text>`;
    }
    const paths = seriesList.map((s) => {
      let d = '', pen = false;
      for (const p of s.points) {
        if (p.y === null || p.y === undefined) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)} `;
        pen = true;
      }
      return d ? `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.8"/>` : '';
    }).join('');
    el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(yLabel)}">` +
      `<rect x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="none" stroke="#d0d7de"/>${g}${paths}</svg>` +
      `<div class="legend">${seriesList.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  }

  function median(arr) {
    const a = arr.filter((x) => typeof x === 'number' && !Number.isNaN(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  const tsFmt = (ms, gran) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    if (gran === 1) return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
    if (gran === 60) return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}h`;
    return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
  };

  function badge(flags) {
    return (flags || []).map((f) => `<span class="tag todo">${esc(f)}</span>`).join('');
  }

  window.KD = { NAV, TOPICS, ENV_LABEL, esc, UNV, isNil, cell, cents, usd, sampled, count, when, link, renderNav, load, showError, table, bindSearch, lineChart, median, tsFmt, badge };
})();

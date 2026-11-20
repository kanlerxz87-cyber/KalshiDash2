/* Live dashboard. Reads the public Kalshi market-data API from the browser (no auth).
   Endpoints (documented at docs.kalshi.com):
     GET /series?category=…|tags=…&include_volume=true
     GET /markets?series_ticker=…&status=open|settled&limit=…&cursor=…
     GET /markets/{ticker}
     GET /markets/{ticker}/orderbook
     GET /series/{series}/markets/{ticker}/candlesticks?start_ts&end_ts&period_interval=1|60
*/
(function () {
  'use strict';
  var API = 'https://external-api.kalshi.com/trade-api/v2';
  var TOPICS = {
    gas: { tags: 'Gas' },
    elections: { category: 'Elections' },
    culture: { category: 'Culture' },
    crypto: { category: 'Crypto' },
    golf: { tags: 'Golf' }
  };
  var MAX_SERIES = 25;          // top series by reported volume
  var POLL_MS = 5000;           // selected market refresh
  var LIST_MS = 60000;          // table refresh

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    topic: 'gas', tab: 'open', rows: [], selected: null, seriesOf: {},
    samples: [], candles: [], range: 'live', pollTimer: null, listTimer: null, loadId: 0
  };

  function setStatus(msg, cls) {
    var el = $('status');
    el.className = 'banner' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function qs(params) {
    return Object.keys(params).filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  }

  // GET JSON with retry on 429 / 5xx. Throws on other errors.
  function getJSON(path, params, attempt) {
    attempt = attempt || 0;
    var url = API + path + (params && Object.keys(params).length ? '?' + qs(params) : '');
    return fetch(url, { headers: { Accept: 'application/json' } }).then(function (res) {
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        return sleep(1500 * (attempt + 1)).then(function () { return getJSON(path, params, attempt + 1); });
      }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
      return res.json();
    });
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function money(v) { var n = num(v); return n === null ? '—' : '$' + n.toFixed(4); }
  function count(v) { var n = num(v); return n === null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Run an async mapper over items with limited concurrency.
  function pool(items, limit, fn) {
    var i = 0, out = [];
    function worker() {
      if (i >= items.length) return Promise.resolve();
      var idx = i++;
      return Promise.resolve(fn(items[idx], idx)).then(function (v) { out[idx] = v; return worker(); });
    }
    var ws = []; for (var k = 0; k < Math.min(limit, items.length); k++) ws.push(worker());
    return Promise.all(ws).then(function () { return out; });
  }

  function listSeries(topic) {
    var f = TOPICS[topic];
    return getJSON('/series', Object.assign({ include_volume: 'true' }, f)).then(function (d) {
      var list = (d.series || []).slice();
      list.sort(function (a, b) { return (num(b.volume_fp) || 0) - (num(a.volume_fp) || 0); });
      return list.slice(0, MAX_SERIES);
    });
  }

  function listMarkets(series, status) {
    var all = [], cursor = '';
    function page(n) {
      var p = { series_ticker: series.ticker, status: status, limit: 200 };
      if (cursor) p.cursor = cursor;
      return getJSON('/markets', p).then(function (d) {
        (d.markets || []).forEach(function (m) { all.push(m); state.seriesOf[m.ticker] = series.ticker; });
        cursor = d.cursor || '';
        if (cursor && n < 2) return page(n + 1);
      });
    }
    return page(0).then(function () { return all; });
  }

  function loadTopic() {
    var id = ++state.loadId;
    var topic = state.topic;
    var status = state.tab === 'open' ? 'open' : 'settled';
    setStatus('Loading ' + topic + ' from the Kalshi API…');
    $('mkts-body').innerHTML = '<tr><td colspan="11" class="muted">Loading…</td></tr>';
    return listSeries(topic).then(function (series) {
      if (id !== state.loadId) return;
      if (!series.length) { setStatus('No series returned for this topic.', 'bad'); state.rows = []; render(); return; }
      return pool(series, 5, function (s) {
        return listMarkets(s, status).catch(function () { return []; });
      }).then(function (lists) {
        if (id !== state.loadId) return;
        var rows = [].concat.apply([], lists);
        rows.sort(function (a, b) { return (num(b.volume_fp) || 0) - (num(a.volume_fp) || 0); });
        state.rows = rows;
        setStatus('Loaded ' + rows.length + ' ' + (status === 'open' ? 'open' : 'resolved') + ' markets from ' + series.length + ' series. Updated ' + new Date().toLocaleTimeString() + '.', 'ok');
        render();
      });
    }).catch(function (err) {
      if (id !== state.loadId) return;
      setStatus('Could not reach the Kalshi API from this browser (' + err.message + '). Possible causes: browser CORS policy, network, or rate limit. The captured snapshot pages still work. See Flagged for Review (F-18).', 'bad');
      state.rows = []; render();
    });
  }

  function render() {
    var body = $('mkts-body');
    if (!state.rows.length) {
      body.innerHTML = '<tr><td colspan="11" class="muted">No markets to show.</td></tr>';
    } else {
      body.innerHTML = state.rows.map(function (m) {
        var sel = state.selected === m.ticker ? ' sel' : '';
        var src = API + '/markets/' + encodeURIComponent(m.ticker);
        return '<tr class="click' + sel + '" data-t="' + esc(m.ticker) + '">' +
          '<td>' + esc(m.title) + '<br><code>' + esc(m.ticker) + '</code></td>' +
          '<td>' + esc(state.seriesOf[m.ticker] || '') + '</td>' +
          '<td>' + esc(m.status) + (m.result ? ' · <b>' + esc(m.result).toUpperCase() + '</b>' : '') + '</td>' +
          '<td class="num">' + money(m.last_price_dollars) + '</td>' +
          '<td class="num">' + money(m.yes_bid_dollars) + '</td>' +
          '<td class="num">' + money(m.yes_ask_dollars) + '</td>' +
          '<td class="num">' + count(m.volume_fp) + '</td>' +
          '<td class="num">' + count(m.volume_24h_fp) + '</td>' +
          '<td class="num">' + count(m.open_interest_fp) + '</td>' +
          '<td>' + esc(m.close_time || '') + '</td>' +
          '<td><a href="' + src + '" target="_blank" rel="noopener">JSON</a></td></tr>';
      }).join('');
      Array.prototype.forEach.call(body.querySelectorAll('tr.click'), function (tr) {
        tr.addEventListener('click', function () { selectMarket(tr.getAttribute('data-t')); });
      });
    }
    $('count').textContent = state.rows.length ? '(' + state.rows.length + ' shown, sorted by volume)' : '';
  }

  function selectMarket(ticker) {
    state.selected = ticker;
    state.samples = [];
    state.candles = [];
    render();
    loadCandles();
    pollSelected();
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(pollSelected, POLL_MS);
  }

  function pollSelected() {
    var t = state.selected;
    if (!t) return;
    var series = state.seriesOf[t];
    getJSON('/markets/' + encodeURIComponent(t), {}).then(function (d) {
      if (state.selected !== t) return;
      var m = d.market || {};
      state.samples.push({ t: Date.now(), last: num(m.last_price_dollars), bid: num(m.yes_bid_dollars), ask: num(m.yes_ask_dollars) });
      if (state.samples.length > 1000) state.samples.shift();
      $('chartTitle').textContent = '— ' + (m.title || t) + ' (' + t + ')';
      drawChart();
    }).catch(function () { /* keep last good sample */ });
    getJSON('/markets/' + encodeURIComponent(t) + '/orderbook', {}).then(function (d) {
      if (state.selected !== t) return;
      renderBook(d.orderbook_fp || {});
    }).catch(function () { $('bookNote').textContent = 'Order book unavailable right now.'; });
    void series;
  }

  function loadCandles() {
    var t = state.selected;
    var mode = $('range').value;
    state.range = mode;
    if (mode === 'live') { drawChart(); return; }
    var series = state.seriesOf[t];
    if (!series) return;
    var now = Math.floor(Date.now() / 1000);
    var period = mode === '1m' ? 1 : 60;
    var start = mode === '1m' ? now - 3600 : now - 86400;
    getJSON('/series/' + encodeURIComponent(series) + '/markets/' + encodeURIComponent(t) + '/candlesticks',
      { start_ts: start, end_ts: now, period_interval: period }).then(function (d) {
      if (state.selected !== t || state.range !== mode) return;
      state.candles = (d.candlesticks || []).map(function (c) {
        var p = c.price || {};
        return { t: c.end_period_ts * 1000, last: num(p.close_dollars), bid: num((c.yes_bid || {}).close_dollars), ask: num((c.yes_ask || {}).close_dollars) };
      }).filter(function (c) { return c.last !== null; });
      drawChart();
    }).catch(function () { state.candles = []; drawChart(); setStatus('Candlestick data unavailable for this market right now.', 'bad'); });
  }

  function drawChart() {
    var svg = $('chart');
    var pts = state.range === 'live' ? state.samples.filter(function (s) { return s.last !== null; })
      .map(function (s) { return { t: s.t, y: s.last }; }) : state.candles.map(function (c) { return { t: c.t, y: c.last }; });
    var W = 900, H = 340, L = 60, R = 16, T = 14, B = 42;
    var axes = '';
    if (!state.selected) {
      svg.innerHTML = '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" fill="#5b6575">Click a market above to start the chart.</text>';
      return;
    }
    if (pts.length < 2) {
      svg.innerHTML = '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" fill="#5b6575">' +
        (state.range === 'live' ? 'Collecting samples… (one every 5 seconds)' : 'Not enough candles returned for this window.') + '</text>';
      return;
    }
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    if (t1 === t0) t1 = t0 + 1000;
    var ys = pts.map(function (p) { return p.y; });
    var lo = Math.max(0, Math.min.apply(null, ys) - 0.02), hi = Math.min(1, Math.max.apply(null, ys) + 0.02);
    if (hi - lo < 0.05) { var mid = (hi + lo) / 2; lo = Math.max(0, mid - 0.025); hi = Math.min(1, mid + 0.025); }
    var X = function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); };
    var Y = function (y) { return T + (1 - (y - lo) / (hi - lo)) * (H - T - B); };
    var span = t1 - t0;
    var fmt = span < 120000 ? function (d) { return d.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }); }
      : span < 7200000 ? function (d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      : function (d) { return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' }); };
    for (var i = 0; i <= 4; i++) {
      var yv = lo + (hi - lo) * i / 4, yy = Y(yv);
      axes += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#e2e6ee"/>';
      axes += '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="12" fill="#5b6575">$' + yv.toFixed(2) + '</text>';
    }
    for (var j = 0; j <= 4; j++) {
      var tt = t0 + span * j / 4, xx = X(tt);
      axes += '<text x="' + xx + '" y="' + (H - 18) + '" text-anchor="middle" font-size="12" fill="#5b6575">' + esc(fmt(new Date(tt))) + '</text>';
    }
    axes += '<text x="' + (W / 2) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="12" fill="#5b6575">Time (x axis)</text>';
    axes += '<text transform="translate(14,' + (H / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" fill="#5b6575">Contract price, $ (y axis)</text>';
    var path = pts.map(function (p, k) { return (k ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    svg.innerHTML = axes +
      '<path d="' + path + '" fill="none" stroke="#00875a" stroke-width="2"/>' +
      '<circle cx="' + X(last.t) + '" cy="' + Y(last.y) + '" r="4" fill="#00875a"/>' +
      '<text x="' + (X(last.t) - 6) + '" y="' + (Y(last.y) - 8) + '" text-anchor="end" font-size="12" fill="#1d2430">$' + last.y.toFixed(4) + '</text>';
  }

  function renderBook(ob) {
    var yes = (ob.yes_dollars || []).map(function (l) { return { p: num(l[0]), c: num(l[1]) }; }).filter(function (l) { return l.p !== null; });
    var no = (ob.no_dollars || []).map(function (l) { return { p: num(l[0]), c: num(l[1]) }; }).filter(function (l) { return l.p !== null; });
    // YES bids: highest first; cumulative from best bid.
    var yb = yes.slice().sort(function (a, b) { return b.p - a.p; });
    var cum = 0;
    $('yesBids').innerHTML = yb.length ? yb.map(function (l) { cum += l.c; return '<tr><td class="num">$' + l.p.toFixed(2) + '</td><td class="num">' + count(l.c) + '</td><td class="num">' + count(cum) + '</td></tr>'; }).join('')
      : '<tr><td colspan="3" class="muted">No resting YES bids.</td></tr>';
    // Implied YES asks: from NO bids, ask = 1 − NO bid price; lowest first.
    var ya = no.map(function (l) { return { p: Math.round((1 - l.p) * 10000) / 10000, c: l.c }; }).sort(function (a, b) { return a.p - b.p; });
    cum = 0;
    $('yesAsks').innerHTML = ya.length ? ya.map(function (l) { cum += l.c; return '<tr><td class="num">$' + l.p.toFixed(2) + '</td><td class="num">' + count(l.c) + '</td><td class="num">' + count(cum) + '</td></tr>'; }).join('')
      : '<tr><td colspan="3" class="muted">No resting NO bids (no implied YES asks).</td></tr>';
    state.book = { yes: yb, no: ya };
    lookup();
    $('bookNote').textContent = 'Order book updated ' + new Date().toLocaleTimeString() + '. Prices are $ per contract (1 contract pays $1 if it resolves in its favour). Only bids are returned by the API; asks are implied from the opposite side.';
  }

  function lookup() {
    var v = parseInt($('lookup').value, 10);
    var out = $('lookupOut');
    if (!state.book || !isFinite(v) || v < 1 || v > 99) { out.textContent = 'Enter a price in cents (1–99).'; return; }
    var p = v / 100;
    var bid = state.book.yes.filter(function (l) { return Math.abs(l.p - p) < 1e-6; })[0];
    var ask = state.book.no.filter(function (l) { return Math.abs(l.p - p) < 1e-6; })[0];
    out.textContent = 'At $' + p.toFixed(2) + ': ' + (bid ? count(bid.c) : '0') + ' YES contracts bid (buy YES); ' +
      (ask ? count(ask.c) : '0') + ' YES contracts offered (via NO bids at $' + (1 - p).toFixed(2) + ').';
  }

  // wiring
  document.addEventListener('DOMContentLoaded', function () {
    $('topic').addEventListener('change', function () { state.topic = this.value; state.selected = null; state.samples = []; loadTopic(); });
    $('tabOpen').addEventListener('click', function () { state.tab = 'open'; this.className = 'on'; $('tabRes').className = ''; loadTopic(); });
    $('tabRes').addEventListener('click', function () { state.tab = 'resolved'; this.className = 'on'; $('tabOpen').className = ''; loadTopic(); });
    $('range').addEventListener('change', loadCandles);
    $('refresh').addEventListener('click', loadTopic);
    $('lookup').addEventListener('input', lookup);
    $('chartTitle').textContent = '';
    drawChart();
    loadTopic();
    state.listTimer = setInterval(loadTopic, LIST_MS);
  });
})();

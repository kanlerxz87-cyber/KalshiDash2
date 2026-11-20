/* ==========================================================================
   chart.js — dependency-free time-series price chart (canvas).

   X axis : time. The caller chooses the TIMESTAMP FORMAT (seconds / minutes /
            hours) and the GRAPH LENGTH (window in ms). Both are independent.
   Y axis : contract price in USD ($0.00 – $1.00 on a binary market).

   Data sources (official):
     - live ticks  : GET /markets/{ticker}                (polled)
     - history     : GET /series/{series}/markets/{ticker}/candlesticks
                     with period_interval 1 | 60 | 1440 minutes
                     (the API caps one request at 5,000 periods)

   No chart library is used, so the site has no third-party runtime
   dependency and cannot break because of a CDN outage.
   ========================================================================== */

import { timeLabel, unitLabel, num } from './format.js';

const COLORS = {
  grid:   'rgba(255,255,255,.07)',
  axis:   'rgba(255,255,255,.28)',
  text:   '#9fb0c0',
  faint:  '#6b7d8f',
  line:   '#2f81f7',
  area:   'rgba(47,129,247,.16)',
  bid:    '#3fb950',
  ask:    '#f85149',
  cross:  'rgba(255,255,255,.35)',
};

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export class PriceChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   *   unit       's' | 'm' | 'h'  -> x-axis timestamp format
   *   windowMs   visible x range in ms
   *   label      title drawn top-left
   */
  constructor(canvas, { unit = 'm', windowMs = 3600e3, label = '', onHover } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.unit = unit;
    this.windowMs = windowMs;
    this.label = label;
    this.onHover = onHover;
    this.points = [];          // [{ t: ms, y: number, bid?, ask? }]
    this.hover = null;
    this.pinnedEnd = true;     // follow the newest point
    this._resize = () => this.render();

    this._onMove = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      this.hover = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      this.render();
    };
    this._onLeave = () => { this.hover = null; this.render(); };
    this._onClick = () => { this.pinnedEnd = !this.pinnedEnd; this.render(); };

    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mouseleave', this._onLeave);
    this.canvas.addEventListener('click', this._onClick);

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.canvas);
    } else {
      window.addEventListener('resize', this._resize);
    }
  }

  destroy() {
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mouseleave', this._onLeave);
    this.canvas.removeEventListener('click', this._onClick);
    if (this._ro) this._ro.disconnect(); else window.removeEventListener('resize', this._resize);
  }

  setUnit(unit) { this.unit = unit; this.render(); }
  setWindow(ms) { this.windowMs = ms; this.render(); }
  setLabel(text) { this.label = text; this.render(); }

  /** Replace all points. `points` = [{ t: epochMs, y: number }] */
  setData(points) {
    this.points = (points || [])
      .filter((p) => p && typeof p.t === 'number' && Number.isFinite(p.y))
      .sort((a, b) => a.t - b.t);
    this.render();
  }

  /** Append or replace the newest point (live tick). */
  pushPoint(point) {
    if (!point || !Number.isFinite(point.y)) return;
    const last = this.points[this.points.length - 1];
    if (last && Math.abs(last.t - point.t) < 400) this.points[this.points.length - 1] = point;
    else this.points.push(point);
    if (this.points.length > 6000) this.points = this.points.slice(-4000);
    this.render();
  }

  visible() {
    const now = Date.now();
    const end = this.pinnedEnd ? now : (this.points.length ? this.points[this.points.length - 1].t : now);
    const start = end - this.windowMs;
    return this.points.filter((p) => p.t >= start && p.t <= end + 1000);
  }

  render() {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600;
    const cssH = canvas.clientHeight || 340;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const pad = { l: 62, r: 14, t: 18, b: 32 };
    const W = cssW - pad.l - pad.r;
    const H = cssH - pad.t - pad.b;

    const pts = this.visible();
    if (!pts.length) {
      ctx.fillStyle = COLORS.faint;
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('No price points in this window yet.', pad.l, pad.t + H / 2);
      this._drawAxesEmpty(ctx, pad, cssW, cssH);
      return;
    }

    const xs = pts.map((p) => p.t);
    const ys = pts.map((p) => p.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x1 - x0 < 1000) { x1 = x0 + 1000; }
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = y1 - y0;
    if (span < 0.02) { const c = (y0 + y1) / 2; y0 = c - 0.01; y1 = c + 0.01; }
    else { const p = span * 0.12; y0 -= p; y1 += p; }
    if (y0 < 0) y0 = 0;
    if (y1 > 1) y1 = 1;

    const X = (t) => pad.l + ((t - x0) / (x1 - x0)) * W;
    const Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * H;

    // ---- grid + y axis (contract price) ----
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const v = y0 + ((y1 - y0) * i) / yTicks;
      const y = Y(v);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + W, y); ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'right';
      ctx.fillText('$' + v.toFixed(2), pad.l - 8, y);
    }

    // ---- x axis (time) ----
    const xTicks = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const t = x0 + ((x1 - x0) * i) / xTicks;
      const x = X(t);
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + H); ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.fillText(timeLabel(t, this.unit), x, pad.t + H + 7);
    }

    // ---- axis titles ----
    ctx.fillStyle = COLORS.faint;
    ctx.textAlign = 'left';
    ctx.font = '10.5px system-ui, sans-serif';
    ctx.fillText(unitLabel(this.unit), pad.l, 2);
    ctx.textAlign = 'right';
    ctx.fillText('Price (USD)', cssW - pad.r, 2);

    // ---- bid/ask band (only when the ticks carry them) ----
    const withBook = pts.filter((p) => Number.isFinite(p.bid) && Number.isFinite(p.ask));
    if (withBook.length > 1) {
      ctx.beginPath();
      ctx.moveTo(X(withBook[0].t), Y(withBook[0].ask));
      for (const p of withBook) ctx.lineTo(X(p.t), Y(p.ask));
      for (let i = withBook.length - 1; i >= 0; i--) ctx.lineTo(X(withBook[i].t), Y(withBook[i].bid));
      ctx.closePath();
      ctx.fillStyle = 'rgba(128,128,128,.14)';
      ctx.fill();
    }

    // ---- price line ----
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.y)) : ctx.moveTo(X(p.t), Y(p.y))));
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // ---- last point marker + label ----
    const last = pts[pts.length - 1];
    const lx = X(last.t), ly = Y(last.y);
    ctx.fillStyle = COLORS.line;
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();

    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = lx > pad.l + W - 60 ? 'right' : 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = cssVar('--text', '#e6edf3');
    ctx.fillText('$' + last.y.toFixed(4), lx + (ctx.textAlign === 'right' ? -8 : 8), ly - 5);

    // ---- crosshair + tooltip ----
    if (this.hover && this.hover.x > pad.l && this.hover.x < pad.l + W) {
      const tAt = x0 + ((this.hover.x - pad.l) / W) * (x1 - x0);
      let best = pts[0], bd = Infinity;
      for (const p of pts) {
        const d = Math.abs(p.t - tAt);
        if (d < bd) { bd = d; best = p; }
      }
      const hx = X(best.t), hy = Y(best.y);
      ctx.strokeStyle = COLORS.cross;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, pad.t + H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.line;
      ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
      this.onHover?.(best, { x: hx, y: hy, plot: { pad, W, H } });
    } else {
      this.onHover?.(null);
    }
  }

  _drawAxesEmpty(ctx, pad, cssW, cssH) {
    ctx.font = '10.5px system-ui, sans-serif';
    ctx.fillStyle = COLORS.faint;
    ctx.textAlign = 'left';
    ctx.fillText(unitLabel(this.unit), pad.l, 2);
    ctx.textAlign = 'right';
    ctx.fillText('Price (USD)', cssW - pad.r, 2);
  }
}

/* -------------------------------------------------------------------------
   Candlestick helpers.
   The official response nests OHLC values, e.g. price.close_dollars.
   Source: https://docs.kalshi.com/api-reference/market/get-market-candlesticks
   ---------------------------------------------------------------------- */
export function candleToPoint(c) {
  const close = num(c?.price?.close_dollars);
  if (close === null) return null;
  return {
    t: (num(c.end_period_ts) ?? 0) * 1000,
    y: close,
    open: num(c?.price?.open_dollars),
    high: num(c?.price?.high_dollars),
    low: num(c?.price?.low_dollars),
    bid: num(c?.yes_bid?.close_dollars),
    ask: num(c?.yes_ask?.close_dollars),
    volume: num(c?.volume_fp),
  };
}

export function candlesToPoints(candles) {
  return (candles || []).map(candleToPoint).filter(Boolean);
}

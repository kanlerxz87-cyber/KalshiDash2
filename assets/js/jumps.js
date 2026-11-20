/* KalshiDash2 — sharp-move ("jump") detection for chart series.
 *
 * Pure logic: no DOM, no network. Used by the category charts to mark every
 * move of at least $0.10 per contract between two plotted points, and to build
 * the jump log under the chart. The threshold matches the live alert feeds
 * (assets/js/alerts-core.js) so the chart and the feeds agree.
 *
 * Every input is a chart point already produced from official API fields
 * (candlesticks or live samples); nothing here talks to the API.
 */

export const JUMP_THRESHOLD = 0.10;

const EPS = 1e-9;

function round4(x) {
  return Math.round(x * 1e4) / 1e4;
}

function finite(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

/*
 * Detect jumps in a plotted series.
 *
 * `points` is [{ t, y, volume?, high?, low? }, …] sorted by time where `y` is
 * the plotted price (candle close, or a live sample's last trade). Points with
 * a null `y` are gaps: they are skipped and the comparison crosses the gap,
 * exactly like the plotted line does.
 *
 * A jump is a change of at least `threshold` dollars between consecutive
 * priced points (inclusive of exactly $0.10 — the same float-safe rule the
 * alert engine uses). Each jump records both endpoints so the UI can show
 * from → to and link the row.
 */
export function detectJumps(points, { threshold = JUMP_THRESHOLD } = {}) {
  const jumps = [];
  let prev = null;
  for (const p of points || []) {
    if (!p || !finite(p.y)) continue;
    const y = Number(p.y);
    if (prev) {
      const delta = round4(y - prev.y);
      if (Math.abs(delta) >= threshold - EPS && delta !== 0) {
        jumps.push({
          t: p.t,
          fromT: prev.t,
          from: prev.y,
          to: y,
          delta,
          direction: delta > 0 ? "up" : "down",
          volume: finite(p.volume) ? Number(p.volume) : null,
          /* Intra-period range (candles only): high − low within one period. */
          intraRange: finite(p.high) && finite(p.low) ? round4(Number(p.high) - Number(p.low)) : null
        });
      }
    }
    prev = { t: p.t, y };
  }
  return jumps;
}

/* Chart markers in the shape assets/js/ui.js `lineChart` expects:
 * [{ t, y, up, delta }]. */
export function jumpMarkers(jumps) {
  return (jumps || []).map(j => ({ t: j.t, y: j.to, up: j.direction === "up", delta: j.delta }));
}

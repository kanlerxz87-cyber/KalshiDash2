/* KalshiDash2 — the cursor-pagination guard.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Kalshi's own Get Markets reference states, under "Paging and ordering"
 * (https://docs.kalshi.com/api-reference/market/get-markets, read 2026-11-22):
 *
 *   "A `cursor` that cannot be decoded is ignored and the first page is
 *    returned, with no error."
 *
 * So a page can come back TWICE without the API reporting anything wrong, and a
 * client that simply appends every page it receives would count those rows twice
 * and keep asking for pages it already has. That touches every cursor-paged read
 * this project makes — the event board, the traded-dollar measurement, and the
 * repository collector — and the one it hurts most is the dollar total, where a
 * repeated page would silently double the figure while still looking complete.
 *
 * WHAT IT DOES
 * ------------
 * `createPageGuard()` keeps two small memories:
 *
 *   1. the natural key of every row already accepted, so a repeated row is
 *      dropped instead of counted twice;
 *   2. every cursor already sent, so a cursor the exchange hands back a second
 *      time ends the walk and is reported (`repeatedCursor`).
 *
 * The natural key is a documented identifier the row itself carries
 * (`trade_id`, `event_ticker`, `ticker`). A row that carries none of them is
 * kept as-is — the guard never drops a row for a reason it cannot name, and it
 * never invents a key to justify dropping one.
 *
 * No DOM, no network: the same module runs in the browser and under `node --test`
 * (tests/paging-guard.test.mjs).
 */

/* The documented identifier fields, in the order the endpoints use them. */
export const KEY_FIELDS = Object.freeze(["trade_id", "event_ticker", "ticker"]);

export function rowKey(row) {
  if (!row || typeof row !== "object") return null;
  for (const f of KEY_FIELDS) {
    const v = row[f];
    if (typeof v === "string" && v !== "") return `${f}:${v}`;
  }
  return null;
}

export function createPageGuard() {
  const keys = new Set();
  const cursors = new Set();
  const state = { accepted: 0, dropped: 0, unkeyed: 0, repeatedCursor: false };

  return {
    state,

    /* Filter one page down to rows never seen before. Returns the rows to keep;
     * `state.dropped` counts the repeats so a caller can disclose them. */
    accept(rows) {
      const fresh = [];
      for (const row of rows || []) {
        const key = rowKey(row);
        if (key === null) {
          state.unkeyed += 1;
          fresh.push(row);
          continue;
        }
        if (keys.has(key)) {
          state.dropped += 1;
          continue;
        }
        keys.add(key);
        fresh.push(row);
      }
      state.accepted += fresh.length;
      return fresh;
    },

    /* Record the cursor about to be sent. Returns false when the exchange has
     * already handed this cursor back once — the list has restarted. */
    remember(cursor) {
      const c = typeof cursor === "string" ? cursor : "";
      if (!c) return true;
      if (cursors.has(c)) {
        state.repeatedCursor = true;
        return false;
      }
      cursors.add(c);
      return true;
    }
  };
}

/* KalshiDash2 — per-shard exchange status, kept pure so it can be unit-tested.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Flagged card F18 recorded that the Overview read only the two top-level
 * flags of GET /exchange/status and then printed one sentence — "trading
 * active" — for the whole exchange, while the response carries a per-shard
 * breakdown the site did not read.
 *
 * The official reference states, verbatim:
 *
 *   "The top-level fields describe the default exchange index (0). Read the
 *    flags only from a 200 response. [...]"
 *   "In `exchange_index_statuses` on a 200 response, an index other than 0
 *    whose status request failed or timed out is reported with all of its
 *    flags `false`. Read the status again before treating a single `false`
 *    reading for one index as a pause."
 *   https://docs.kalshi.com/api-reference/exchange/get-exchange-status
 *
 *   "exchange_index_statuses [...] Status of each exchange index. The
 *    top-level fields above reflect the default exchange index (0). Absent
 *    when the per-index breakdown is unavailable."
 *   (same page, ExchangeStatus schema)
 *
 * So two rules follow, and this module implements exactly those two:
 *
 *   1. A `false` flag on a non-default index is NOT a pause. It is reported as
 *      "re-read required" — the reference says to read the status again — and
 *      the next successful read upgrades it. A single reading never turns into
 *      a halt claim on the page.
 *   2. The top-level fields are the default index (0). A shard row for index 0
 *      must therefore agree with them; when it does not, the page says so
 *      instead of choosing one.
 *
 * Nothing is inferred. A response without `exchange_index_statuses` (the
 * schema says the field is absent when the breakdown is unavailable) yields
 * zero rows and `breakdown: false`; the page then says the breakdown was not
 * provided rather than inventing shards.
 *
 * Source: https://docs.kalshi.com/api-reference/exchange/get-exchange-status
 * Related: https://docs.kalshi.com/getting_started/exchange_sharding
 */

const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isBool = v => typeof v === "boolean";

/* Read one shard row. Returns null when the row is not a usable record, so a
 * malformed entry is skipped rather than rendered as a status. */
export function parseShard(row) {
  if (!isObj(row)) return null;
  if (!Number.isInteger(row.exchange_index) || row.exchange_index < 0) return null;
  if (!isBool(row.exchange_active) || !isBool(row.trading_active)) return null;
  let transfers = null;
  if (isBool(row.intra_exchange_transfers_active)) transfers = row.intra_exchange_transfers_active;
  else if ("intra_exchange_transfers_active" in row && row.intra_exchange_transfers_active === null) transfers = null;
  return {
    index: row.exchange_index,
    description: typeof row.description === "string" ? row.description : "",
    exchangeActive: row.exchange_active,
    tradingActive: row.trading_active,
    transfersActive: transfers
  };
}

/* Parse a 200 ExchangeStatus body into the shape the page renders.
 *
 * `previouslyConfirmed` is the set of shard indexes whose trading flag was
 * already read as `true` on an earlier successful poll in this tab. It is how
 * rule 1 is applied: a shard that was confirmed trading and now reads `false`
 * is still not called paused — it is called "re-read required", because the
 * reference says a lone `false` may be a failed or timed-out status request.
 *
 * Returns:
 *   present        — the response was an object (a non-object is not a status)
 *   exchangeActive — top-level flag, default index (0), or null when absent
 *   tradingActive  — top-level flag, default index (0), or null when absent
 *   breakdown      — whether exchange_index_statuses was supplied as an array
 *   shards         — parsed shard rows, in response order
 *   skipped        — count of array entries that were not usable records
 *   conflicts      — indexes whose shard row disagrees with the top-level flags
 */
export function readStatus(body, previouslyConfirmed = new Set()) {
  if (!isObj(body)) {
    return { present: false, exchangeActive: null, tradingActive: null,
      breakdown: false, shards: [], skipped: 0, conflicts: [] };
  }
  const exchangeActive = isBool(body.exchange_active) ? body.exchange_active : null;
  const tradingActive = isBool(body.trading_active) ? body.trading_active : null;

  const raw = body.exchange_index_statuses;
  const breakdown = Array.isArray(raw);
  const shards = [];
  let skipped = 0;
  if (breakdown) {
    for (const row of raw) {
      const parsed = parseShard(row);
      if (parsed) shards.push(parsed);
      else skipped += 1;
    }
  }

  const seen = new Set();
  const conflicts = [];
  for (const s of shards) {
    if (seen.has(s.index)) continue; // first record for an index wins
    seen.add(s.index);
  }

  /* Rule 2: index 0 is the default index the top-level fields describe. */
  const zero = shards.find(s => s.index === 0);
  if (zero) {
    if (exchangeActive !== null && zero.exchangeActive !== exchangeActive) conflicts.push(0);
    else if (tradingActive !== null && zero.tradingActive !== tradingActive) conflicts.push(0);
  }

  return { present: true, exchangeActive, tradingActive, breakdown, shards, skipped, conflicts };
}

/* The label for one shard row, applying rule 1.
 *
 *   trading  — trading_active is true
 *   re-read  — trading_active is false AND this index was confirmed trading on
 *              an earlier read: the reference says read again before treating a
 *              single false as a pause, so the page says exactly that
 *   down     — trading_active is false and it was never confirmed trading here
 *
 * `previouslyConfirmed` is a Set of indexes.
 */
export function shardState(shard, previouslyConfirmed = new Set()) {
  if (!shard || !isBool(shard.tradingActive)) return "unknown";
  if (shard.tradingActive) return "trading";
  return previouslyConfirmed.has(shard.index) ? "re-read" : "down";
}

/* Indexes whose trading flag this read saw as true — the input to the next
 * poll's `previouslyConfirmed`. */
export function confirmedTrading(status) {
  const out = new Set();
  if (!status || !Array.isArray(status.shards)) return out;
  for (const s of status.shards) if (s.tradingActive === true) out.add(s.index);
  return out;
}

/* One line of plain text for the environment-facts strip. Short on purpose:
 * the strip is a <dd>. The per-shard table carries the detail. */
export function summaryLine(status) {
  if (!status || !status.present) return null;
  const t = status.tradingActive;
  if (t === null) return "flags absent from a 200 response — not read as a pause";
  if (!status.breakdown) {
    return t ? "trading active (default index; per-shard breakdown not provided)"
      : "not trading (default index; no per-shard breakdown to check)";
  }
  const n = status.shards.length;
  if (n === 0) {
    return t ? "trading active (default index; breakdown supplied but empty)"
      : "not trading (default index; breakdown supplied but empty)";
  }
  const down = status.shards.filter(s => s.tradingActive === false).length;
  const base = t ? "trading active on the default index" : "not trading on the default index";
  const tail = down === 0 ? `${n} shard${n === 1 ? "" : "s"} all reporting trading`
    : `${down} of ${n} shards report false — re-read, not treated as a pause`;
  return `${base} · ${tail}`;
}

/* Ordered rows for the detail table: shard 0 first, then ascending index. */
export function shardRows(status, previouslyConfirmed = new Set()) {
  if (!status || !status.breakdown) return [];
  return [...status.shards]
    .sort((a, b) => a.index - b.index)
    .map(s => ({
      index: s.index,
      description: s.description,
      exchangeActive: s.exchangeActive,
      tradingActive: s.tradingActive,
      transfersActive: s.transfersActive,
      state: shardState(s, previouslyConfirmed),
      conflictsTopLevel: status.conflicts.includes(s.index)
    }));
}

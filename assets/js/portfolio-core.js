/* Documented Get Positions values and bounded read coverage.
 * https://docs.kalshi.com/api-reference/portfolio/get-positions
 *
 * No credentials, storage, DOM or order writes here. The client is injected so
 * tests can exercise the real query builder without making a network call.
 */
export const POSITION_FIELDS = Object.freeze({
  realized: "realized_pnl_dollars",
  fees: "fees_paid_dollars",
  traded: "total_traded_dollars",
  exposure: "market_exposure_dollars"
});
const DOLLAR_FIELDS = new Set(Object.values(POSITION_FIELDS));

export function positionDollars(position, field) {
  if (!DOLLAR_FIELDS.has(field)) return null;
  const raw = position?.[field];
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/* A total is unknown if ANY row lacks its input, or paging is incomplete.
 * An explicit zero is still a verified value. Empty complete results sum to
 * zero; the page separately labels that as no returned unsettled records. */
export function summarizePositions(positions, { complete = true } = {}) {
  const sums = {};
  const missing = {};
  for (const [bucket, field] of Object.entries(POSITION_FIELDS)) {
    let subtotal = 0;
    let absent = 0;
    for (const position of positions) {
      const value = positionDollars(position, field);
      if (value === null) absent++;
      else subtotal += value;
    }
    sums[bucket] = complete && absent === 0 ? subtotal : null;
    missing[bucket] = absent;
  }
  return { sums, missing, n: positions.length, complete };
}

/* Only the current unsettled-position tier is requested. This is NOT lifetime
 * performance; settled/archived positions and returns history are not covered.
 * The API's `positions` method supplies '?', so pass a bare query string.
 * A cap is explicit, not a silent claim to have read every page. */
export async function loadPositions(client, { limit = 200, maxPages = 5 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("Position page limit must be an integer from 1 to 1000.");
  }
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error("Position page cap must be a positive integer.");
  }
  const positions = [];
  const seen = new Set();
  let cursor = "";
  for (let pages = 1; pages <= maxPages; pages++) {
    const query = new URLSearchParams({ limit: String(limit), settlement_status: "unsettled" });
    if (cursor) query.set("cursor", cursor);
    seen.add(cursor);
    const data = await client.positions(query.toString());
    if (!Array.isArray(data?.market_positions) || typeof data.cursor !== "string") {
      throw new Error("Positions response missing market_positions or cursor; coverage is unverified.");
    }
    if (data.cursor && seen.has(data.cursor)) {
      throw new Error("Positions paging repeated a cursor; coverage is unverified.");
    }
    positions.push(...data.market_positions);
    cursor = data.cursor;
    if (!cursor) return { positions, complete: true, pages, nextCursor: "" };
  }
  return { positions, complete: false, pages: maxPages, nextCursor: cursor };
}

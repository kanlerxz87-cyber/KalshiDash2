// The Gas-page assertion used by the live render probe, in one place.
//
// Why this is a module: the live probe (live-site.mjs) runs against the real
// exchange, and the offline test (live-site-no-match.test.mjs) proves the same
// rule with no network. Keeping one implementation means the two cannot drift
// apart, which is how the previous assertion silently became unpassable.
//
// Background (Flagged W5 / board item I2): the probe used to require the literal
// ticker KXAAAGAS on the Gas page. Whenever the demo exchange had no matching
// *open* gas market the page correctly rendered "No <topic> events in this
// scan", and the probe failed anyway. Accepting the no-match state must not
// mask a real failure, so it only counts when:
//   * the page rendered its own no-match callout (not an empty board), and
//   * no JavaScript error was raised, and
//   * the board status pill is not in its error state.
// A failed fetch, an empty board, or any page error still fails.

export const NO_MATCH_PATTERN = /No [A-Za-z ]*events in this scan/;
export const GAS_TICKER_PATTERN = /KXAAAGAS/;

/**
 * @param {{board?: string, caveat?: string, statusClass?: string, errors?: string[]}} state
 * @returns {{ok: boolean, noMatch: boolean, reason: string}}
 */
export function gasBoardState({ board = "", caveat = "", statusClass = "", errors = [] } = {}) {
  const noMatch = NO_MATCH_PATTERN.test(caveat);
  const hasTicker = GAS_TICKER_PATTERN.test(board);
  const failed = errors.length > 0 || statusClass.includes("err");

  if (hasTicker) {
    return { ok: true, noMatch: false, reason: "live gas event rendered on the board" };
  }
  if (noMatch && !failed) {
    return {
      ok: true,
      noMatch: true,
      reason: "no matching open gas market in this scan; the page said so and raised no error",
    };
  }
  if (noMatch && failed) {
    return {
      ok: false,
      noMatch: true,
      reason: "the page printed its no-match callout but also reported a failure: " +
        (errors[0] || "board status is in the error state"),
    };
  }
  return {
    ok: false,
    noMatch: false,
    reason: "the board rendered neither a gas market nor the page's no-match callout " +
      `(board ${board.length} chars, caveat ${caveat.length} chars)`,
  };
}

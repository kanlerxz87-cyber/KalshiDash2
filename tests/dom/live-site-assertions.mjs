/* Pure parsing helpers for tests/dom/live-site.mjs.
 *
 * These live in their own module so they can be unit-tested offline, with no
 * jsdom, no esbuild and no network. They exist because the live render check was
 * failing for two reasons that had nothing to do with the site:
 *
 *   1. The scan-size assertion was `/Scanned \d+ events/`, but the page renders
 *      the count with `int()`, which is `Number.prototype.toLocaleString`. Once
 *      the exchange scan passed 999 events the note read "Scanned 1,234 events"
 *      and the pattern could never match again. A verifier bug, not a site bug.
 *   2. The Gas page could be checked while the exchange was rate limiting
 *      (HTTP 429). The page then renders its error pill, the board is empty, and
 *      the "live gas event" assertion failed — reporting a content regression
 *      that was really a third-party refusal. Retrying is correct; silently
 *      passing would not be, so a refusal is reported as INCONCLUSIVE (exit 2)
 *      rather than as success.
 */

/* "Scanned 1,234 events at 7:31:00 PM" -> 1234. Returns null if absent. */
export function parseScanCount(text) {
  const m = String(text || "").match(/Scanned\s+([\d,]+)\s+events?\b/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/* Same value rendered the way assets/js/ui.js `int()` renders it. */
export function formatCount(n) {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/* Classify a message the page shows when a request did not succeed.
 * Returns null when the text is not an exchange/transport refusal, so callers
 * keep treating anything else as a real failure.
 *
 * ONLY pass it an error surface — a status pill, an error row, a note the page
 * writes after a failed request. Never pass a whole page's text: static copy on
 * alerts.html mentions "429" and index.html mentions "WebSocket", both of which
 * made healthy pages look refused during development. */
export function refusalReason(text) {
  const s = String(text || "");
  if (!s) return null;
  const http = s.match(/\b(4\d\d|5\d\d)\b/);
  if (http) {
    const code = Number(http[1]);
    // 429 = rate limited, 5xx = exchange-side. Both mean "ask again later".
    if (code === 429 || code >= 500) return `HTTP ${code}`;
    // Any other 4xx is a request the site got wrong: a real failure.
    return null;
  }
  /* Only explicit transport-failure strings qualify. A bare /socket/ matched the
   * word "WebSocket" in the page's own static copy (which made a healthy page
   * look refused), so the patterns below are failure phrases, not topic words. */
  if (/failed to fetch|fetch failed|networkerror|network error|load failed|econn[a-z]*|eai_again|getaddrinfo|socket disconnected|secure tls|tls connection/i.test(s)) {
    return "transport";
  }
  return null;
}

/* What does a topic page's board actually show?
 *   populated    — the topic's own tickers are on the board
 *   no-match     — the page explains that this scan found no matching event
 *   refused      — the exchange refused / was unreachable (inconclusive)
 *   empty        — an empty board with no explanation (a real defect)
 */
export function boardOutcome({ boardText = "", caveatText = "", statusText = "", statusClass = "" } = {}) {
  const board = String(boardText);
  const caveat = String(caveatText);
  const refused = refusalReason(statusText) || refusalReason(board);
  if (refused) return { outcome: "refused", reason: refused };
  const looksLikeErrorPill = /(^|\s)err(\s|$)/.test(String(statusClass));
  /* The board's empty state is itself a table row, so "non-empty text" does not
   * imply real data. Recognise the placeholders the page renders. */
  const placeholder =
    /Nothing is invented to fill the table|returned no .* events in this scan|Could not load events/i.test(board);
  if (board.trim().length > 0 && !placeholder) {
    return { outcome: "populated", reason: "" };
  }
  if (/none matched|No .* events in this scan|no matching|returned no .* events in this scan/i.test(`${caveat} ${board}`)) {
    return { outcome: "no-match", reason: "page stated the scan result" };
  }
  /* An error state that is not a refusal means the site made a request the
   * exchange rejected, or rendered an error for another reason: that is a
   * genuine failure and must not be downgraded to "inconclusive". */
  if (looksLikeErrorPill) return { outcome: "error", reason: statusText || "error pill" };
  return { outcome: "empty", reason: board.slice(0, 120) || "empty board, no caveat" };
}

/* Exit codes for the live render script. */
export const EXIT = { PASS: 0, FAIL: 1, INCONCLUSIVE: 2 };

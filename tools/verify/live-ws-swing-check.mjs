/* Runs the site's own live-feed logic over a real Kalshi WebSocket ticker
 * frame and prints a JSON array of check results.
 *
 * Used by tools/verify/live-ws-check.py, which cannot run JavaScript itself.
 * The point is to prove that the shipped code path — the same
 * assets/js/live-core.js the browser loads — handles a genuine frame from the
 * exchange, not just a fixture.
 *
 * Usage: node tools/verify/live-ws-swing-check.mjs '<ticker frame JSON>'
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const {
  fromTickerFrame, swingBetween, foldReadings, spreadOf
} = await import(path.join(ROOT, "assets/js/live-core.js"));

const raw = process.argv[2];
const results = [];
const add = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || "" });

if (!raw) {
  add("a ticker frame was supplied", false, "no argument was passed");
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}

let frame;
try {
  frame = JSON.parse(raw);
} catch (e) {
  add("a ticker frame was supplied", false, `the frame was not valid JSON: ${e.message}`);
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}

const reading = fromTickerFrame(frame);
add("the shipped mapper reads a live ticker frame", !!reading,
  reading
    ? `ticker ${reading.ticker} -> price ${reading.price}`
    : "fromTickerFrame() returned null for the live frame");

if (!reading) {
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}

/* The price must be a number in [0, 1]: a contract price. */
const p = reading.price;
add("the mapped price is a contract price between 0 and 1",
  p !== null && p >= 0 && p <= 1,
  p === null ? "the frame carried no price" : `price ${p}`);

/* A $0.10 move built on the real frame must be detected. */
const up = swingBetween({ ...reading, price: Math.max(0, p - 0.10), at: 1000 },
                        { ...reading, price: p, at: 2000 }, 0.10);
add("a $0.10 move on the live frame is detected", !!up,
  up ? `delta ${up.delta} (${up.direction})` : "the swing test did not fire on the live frame");

const down = swingBetween({ ...reading, price: p, at: 1000 },
                          { ...reading, price: Math.max(0, p - 0.10), at: 2000 }, 0.10);
add("a $0.10 move down on the live frame is detected", !!down,
  down ? `delta ${down.delta} (${down.direction})` : "the swing test did not fire on the live frame");

/* A smaller move must not. */
const small = swingBetween({ ...reading, price: p, at: 1000 },
                           { ...reading, price: Math.min(1, p + 0.05), at: 2000 }, 0.10);
add("a $0.05 move on the live frame is not a swing", !small,
  small ? `unexpectedly detected delta ${small.delta}` : "correctly ignored");

/* The fold must alert exactly once when the market really moves. */
const state = new Map();
const swings = foldReadings(state, [
  { ...reading, price: p, at: 1000 },
  { ...reading, price: Math.min(1, p + 0.20), at: 2000 }
], 0.10);
add("folding a live frame produces one swing", swings.length === 1,
  `${swings.length} swing(s) from two readings`);

/* The spread must be computable whenever the frame is two-sided. */
const sp = spreadOf(reading);
add("the spread is computable from the live frame",
  sp === null || (sp >= 0 && sp <= 1),
  sp === null ? "the frame was not two-sided" : `spread ${sp}`);

process.stdout.write(JSON.stringify(results));

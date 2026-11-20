/* KalshiDash2 — configuration.
 *
 * Every constant here is traceable to an official Kalshi source. The `source`
 * links are rendered on the Verification page; nothing is inferred.
 *
 * Configured for the Kalshi DEMO environment, as requested.
 */
export const DEMO = {
  rest: "https://external-api.demo.kalshi.co/trade-api/v2",
  ws: "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
  signPath: "/trade-api/v2",            // pre-sign WS text: ts + "GET" + "/trade-api/ws/v2"
  wsSignPath: "/trade-api/ws/v2"
};

/* Documented alternates, kept for the Sources page only (not used by the client). */
export const ALTERNATES = {
  rest: "https://demo-api.kalshi.co/trade-api/v2",
  ws: "wss://demo-api.kalshi.co/trade-api/ws/v2"
};

export const SOURCES = {
  demoEnv:        "https://docs.kalshi.com/getting_started/demo_env",
  envs:           "https://docs.kalshi.com/getting_started/api_environments",
  apiKeys:        "https://docs.kalshi.com/getting_started/api_keys",
  authQuickstart: "https://docs.kalshi.com/getting_started/quick_start_authenticated_requests",
  createOrder:    "https://docs.kalshi.com/getting_started/quick_start_create_order",
  createOrderV2:  "https://docs.kalshi.com/api-reference/orders/create-order-v2",
  orderDirection: "https://docs.kalshi.com/getting_started/order_direction",
  orderbook:      "https://docs.kalshi.com/getting_started/orderbook_responses",
  candles:        "https://docs.kalshi.com/api-reference/market/get-market-candlesticks",
  markets:        "https://docs.kalshi.com/api-reference/market/get-markets",
  events:         "https://docs.kalshi.com/api-reference/events/get-events",
  series:         "https://docs.kalshi.com/api-reference/market/get-series-list",
  balance:        "https://docs.kalshi.com/api-reference/portfolio/get-balance",
  fills:          "https://docs.kalshi.com/api-reference/portfolio/get-fills",
  positions:      "https://docs.kalshi.com/api-reference/portfolio/get-positions",
  orders:         "https://docs.kalshi.com/api-reference/portfolio/get-orders",
  rateLimits:     "https://docs.kalshi.com/getting_started/rate_limits",
  websockets:     "https://docs.kalshi.com/getting_started/quick_start_websockets",
  fixedPoint:     "https://docs.kalshi.com/getting_started/fixed_point_migration",
  marketSettlement: "https://docs.kalshi.com/getting_started/market_settlement",
  lifecycle:      "https://docs.kalshi.com/getting_started/market_lifecycle",
  historical:     "https://docs.kalshi.com/getting_started/historical_data",
  sharding:       "https://docs.kalshi.com/getting_started/exchange_sharding",
  feeRounding:    "https://docs.kalshi.com/getting_started/fee_rounding",
  terms:          "https://docs.kalshi.com/getting_started/terms"
};

/* ---------------------------------------------------------------------------
 * Topic taxonomy.
 *
 * The five required topics map onto Kalshi's own `category` / `series_ticker`
 * / `title` fields. Patterns are tested against those fields only; they are
 * never applied to prices or free text. Each topic records HOW it is matched so
 * the UI can show it and the reader can audit it.
 *
 * Verified against the live demo environment (see reports/verify-facts-v3.md):
 *   Elections -> category "Elections"
 *   Culture   -> category "Entertainment" / "Social"
 *   Crypto    -> category "Crypto"
 *   Golf      -> category "Sports" + golf-specific series/title terms
 *   Gas       -> NOT covered by any category; matched on gas-price series/titles
 * ------------------------------------------------------------------------- */
export const TOPICS = [
  {
    key: "gas",
    label: "Gas Prices",
    blurb: "Retail and wholesale gasoline price markets.",
    categoryPatterns: [],
    seriesPatterns: [/^KXA{3}GAS/i, /GAS/i],
    titlePatterns: [/gas price/i, /gasoline/i, /gas average/i, /AAA gas/i],
    note:
      "No Kalshi `category` value covers gasoline. Matched on gas-price series and titles.",
    verifiedCategory: null,
    caveat:
      "The demo environment returned 0 open gas-price events in the 1,000-event " +
      "scan on 2026-11-20, so this topic renders an explicit empty state rather " +
      "than placeholder rows.",
    sources: ["series", "events"]
  },
  {
    key: "elections",
    label: "Elections",
    blurb: "Ballot, primary, and office races.",
    categoryPatterns: [/^Elections$/i],
    seriesPatterns: [],
    titlePatterns: [],
    note: "Matched on Kalshi category `Elections` (740 of 1,000 live events scanned).",
    verifiedCategory: "Elections",
    sources: ["events"]
  },
  {
    key: "culture",
    label: "Culture",
    blurb: "Film, TV, music, awards, and social moments.",
    categoryPatterns: [/^Entertainment$/i, /^Social$/i],
    seriesPatterns: [],
    titlePatterns: [],
    note: "Matched on Kalshi categories `Entertainment` and `Social`.",
    verifiedCategory: "Entertainment",
    sources: ["events"]
  },
  {
    key: "crypto",
    label: "Crypto",
    blurb: "Bitcoin, Ethereum, and other digital-asset price markets.",
    categoryPatterns: [/^Crypto$/i],
    seriesPatterns: [],
    titlePatterns: [],
    note: "Matched on Kalshi category `Crypto` (only 2 live events in the demo scan).",
    verifiedCategory: "Crypto",
    sources: ["events"]
  },
  {
    key: "golf",
    label: "Golf",
    blurb: "PGA, major championships, and tournament markets.",
    categoryPatterns: [/^Sports$/i],
    seriesPatterns: [/GOLF/i, /^KXPGA/i, /^PGA/i, /RYDER/i, /MASTERS/i],
    titlePatterns: [/golf/i, /pga/i, /ryder cup/i, /the masters/i],
    note: "Kalshi category `Sports` narrowed to golf series and titles.",
    verifiedCategory: "Sports",
    sources: ["events", "series"]
  }
];

/* Chart window presets. `granularity` explains where the data really comes from:
 *   candles  -> official candlestick endpoint (only 1 / 60 / 1440 minute periods exist)
 *   live     -> rolling client-side samples taken while the page is open
 *   derived  -> candlesticks re-bucketed into a coarser view, or live samples
 */
export const WINDOWS = [
  { key: "10s",  label: "10 seconds", seconds: 10,    granularity: "live",
    note: "Live stream samples. Kalshi has no seconds-resolution candle API." },
  { key: "1m",   label: "1 minute",   seconds: 60,    granularity: "live",
    note: "Live stream samples. Kalshi has no seconds-resolution candle API." },
  { key: "5m",   label: "5 minutes",  seconds: 300,   granularity: "live",
    note: "Live stream samples, or 1-minute candles when the stream is unavailable." },
  { key: "1h",   label: "1 hour",     seconds: 3600,  granularity: "candles",
    note: "Official 1-minute candlesticks." },
  { key: "6h",   label: "6 hours",    seconds: 21600, granularity: "candles",
    note: "Official 1-minute candlesticks." },
  { key: "24h",  label: "24 hours",   seconds: 86400, granularity: "candles",
    note: "Official 1-minute candlesticks." },
  { key: "7d",   label: "7 days",     seconds: 604800, granularity: "candles",
    note: "Official 1-hour candlesticks (1-minute would exceed the 5,000-period cap)." }
];

/* Candlestick endpoint limits (official). */
export const CANDLE = {
  intervals: [1, 60, 1440],
  maxPeriodsPerRequest: 5000
};

export const RANKING_MODES = [
  { key: "money", label: "Most money traded (volume × price)",
    formula: "Σ over markets of volume_fp × last_price_dollars" },
  { key: "oi", label: "Most open interest (contracts)",
    formula: "Σ over markets of open_interest_fp" },
  { key: "volume", label: "Most contracts traded",
    formula: "Σ over markets of volume_fp" }
];

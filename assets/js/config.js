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
  getSeries:      "https://docs.kalshi.com/api-reference/market/get-series",
  exchangeStatus: "https://docs.kalshi.com/api-reference/exchange/get-exchange-status",
  marketSettlementFields: "https://docs.kalshi.com/api-reference/market/get-market",
  balance:        "https://docs.kalshi.com/api-reference/portfolio/get-balance",
  fills:          "https://docs.kalshi.com/api-reference/portfolio/get-fills",
  positions:      "https://docs.kalshi.com/api-reference/portfolio/get-positions",
  orders:         "https://docs.kalshi.com/api-reference/orders/get-orders",
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
    /* Only the documented retail-gasoline series families:
     *   KXAAAGAS*  — the AAA retail-gas family (see the official fee schedule)
     *   KXGAS      — "Gas weekly", settlement source EIA weekly US retail
     *                gasoline (verified live 2026-11-21:
     *                GET /series/KXGAS -> title "Gas weekly",
     *                settlement_sources EIA PET_PRI_GND_DCUS_NUS_W.htm).
     * The bare /GAS/i catch-all stays banned: it matched "…VEGAS" and
     * "…NATGAS" series (G1 on the Flagged page). */
    seriesPatterns: [/^KXA{3}GAS/i, /^KXGAS$/i],
    titlePatterns: [/gas(oline)? (price|average)/i, /\bAAA gas/i, /^gas (weekly|price)$/i],
    /* Never classify crude, natural-gas, diesel or Vegas-related rows as
     * pump-price gas, even when a title contains "gas price". */
    excludePatterns: [/natural\s*gas/i, /\bNATGAS\b/i, /\bWTI\b/i, /\bBRENT\b/i, /crude/i, /diesel/i, /\bVEGAS\b/i, /\bbarrels?\b/i, /\boil\b/i],
    note:
      "No Kalshi `category` value covers gasoline. Matched on the KXAAAGAS* (AAA retail) and " +
      "KXGAS (EIA weekly retail gasoline) series families plus gas-price titles, with " +
      "crude / natural-gas / diesel / Vegas rows excluded.",
    verifiedCategory: null,
    /* No coverage caveat is hard-coded any more. An earlier version claimed the
     * demo environment returned "0 open gas-price events"; that was true of one
     * 1,000-event scan but false when re-checked live on 2026-11-20 ~19:20 UTC,
     * when this exact query returned a live gas event:
     *   GET /events?status=open&series_ticker=KXAAAGASW
     *   -> KXAAAGASW-26NOV23 "US gas prices this week", category Economics,
     *      settlement source AAA (https://gasprices.aaa.com/), with markets
     *      carrying open interest up to 32,793.57 contracts.
     * A hard-coded count would go stale the same way, so the page reports the
     * scan it just performed instead. */
    caveat: null,
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
    /* `Culture` is a real category in the live demo vocabulary (4 series,
     * data/probe/api_surface.json) in addition to Entertainment and Social. */
    categoryPatterns: [/^Culture$/i, /^Entertainment$/i, /^Social$/i],
    seriesPatterns: [],
    titlePatterns: [],
    note: "Matched on Kalshi categories `Culture`, `Entertainment` and `Social`.",
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
  { key: "money", label: "Highest volume × last YES price proxy",
    formula: "Σ over markets of volume_fp (contracts) × last_price_dollars (last YES trade); proxy only, not traded-dollar volume" },
  { key: "oi", label: "Most open interest (contracts)",
    formula: "Σ over markets of open_interest_fp" },
  { key: "volume", label: "Most contracts traded",
    formula: "Σ over markets of volume_fp" }
];

/* ---------------------------------------------------------------------------
 * Live alert engine.
 *
 * The brief asks for alerts on "sudden swings in contract prices greater than
 * or equal to $0.10 in either direction". Kalshi publishes no "swing" field,
 * so the test is built from two documented fields on every market:
 *
 *   previous_price_dollars  — the exchange's own reference price (the schema
 *                             describes it as the last traded YES price a day
 *                             ago; see Flagged Z1)
 *   last_price_dollars      — the most recent trade price
 *
 * A "swing" is |last − previous| >= threshold. The same test is also applied
 * to the difference between two consecutive prices this page observed itself,
 * which catches moves the exchange's own reference has not yet rolled over.
 * Both variants are labelled in the feed so the reader always knows which
 * comparison produced the number.
 * (https://docs.kalshi.com/api-reference/market/get-market)
 * ------------------------------------------------------------------------- */
export const ALERT = {
  defaultThreshold: 0.10,
  minThreshold: 0.02,
  maxThreshold: 0.50,
  defaultPollMs: 15000,
  minPollMs: 5000,
  maxPollMs: 120000,
  maxMessages: 250,
  /* Maximum open events scanned per poll. The demo exchange exposes tens of
   * thousands of events; scanning all of them every few seconds would be
   * abusive against a public endpoint that has its own, unpublished budget
   * (https://docs.kalshi.com/getting_started/rate_limits). */
  maxEventsPerPoll: 6
};

/* ---------------------------------------------------------------------------
 * The "model" behind the selective chat.
 *
 * This is a TRADEABILITY + MOMENTUM SCREEN, not a probability model. It adds
 * up points from named components so a reader can see exactly why a market was
 * surfaced, and it deliberately makes no claim about expected return. The
 * screen is scored against settled demo markets on the Strategy Tester page,
 * where the measured hit rate is reported next to the market-implied price.
 *
 * Every input is a documented market field:
 *   open_interest_fp, yes_bid_dollars, yes_ask_dollars,
 *   yes_bid_size_fp, yes_ask_size_fp, volume_24h_fp, close_time, last_price_dollars
 * (https://docs.kalshi.com/api-reference/market/get-market)
 * ------------------------------------------------------------------------- */
export const TRADE_SCREEN = {
  passScore: 55,
  components: [
    {
      key: "liquidity",
      label: "Open interest (contracts outstanding)",
      max: 25,
      field: "open_interest_fp",
      rule: ">= 1,000 → 25 · >= 250 → 18 · >= 50 → 10 · else 0",
      score: v => v >= 1000 ? 25 : v >= 250 ? 18 : v >= 50 ? 10 : 0
    },
    {
      key: "spread",
      label: "Bid–ask spread (cost of getting in)",
      max: 20,
      field: "yes_ask_dollars − yes_bid_dollars",
      rule: "<= 0.02 → 20 · <= 0.05 → 12 · <= 0.10 → 5 · else 0",
      score: v => v <= 0.02 ? 20 : v <= 0.05 ? 12 : v <= 0.10 ? 5 : 0
    },
    {
      key: "depth",
      label: "Size resting at the touch (bid + ask size)",
      max: 15,
      field: "yes_bid_size_fp + yes_ask_size_fp",
      rule: ">= 100 → 15 · >= 20 → 8 · else 0",
      score: v => v >= 100 ? 15 : v >= 20 ? 8 : 0
    },
    {
      key: "price",
      label: "Price not at a lottery extreme",
      max: 15,
      field: "last_price_dollars",
      rule: "0.10 ≤ price ≤ 0.90 → 15 · else 0",
      score: v => v >= 0.10 && v <= 0.90 ? 15 : 0
    },
    {
      key: "time",
      label: "Time left before close",
      max: 15,
      field: "close_time",
      rule: ">= 6h → 15 · >= 1h → 8 · else 0",
      score: hours => hours >= 6 ? 15 : hours >= 1 ? 8 : 0
    },
    {
      key: "activity",
      label: "Traded volume in the last 24h",
      max: 10,
      field: "volume_24h_fp",
      rule: ">= 100 → 10 · >= 10 → 6 · > 0 → 3 · else 0",
      score: v => v >= 100 ? 10 : v >= 10 ? 6 : v > 0 ? 3 : 0
    }
  ]
};

/* ---------------------------------------------------------------------------
 * Simulated-trading strategies.
 *
 * Each one is a rule that can be replayed over official 1-minute candlesticks
 * and scored against the market's own settlement value
 * (https://docs.kalshi.com/api-reference/market/get-market). `signal` returns
 * the price at which the rule wants to take a position, or null.
 * ------------------------------------------------------------------------- */
export const STRATEGIES = [
  {
    key: "momentum",
    name: "Momentum continuation",
    rule: "Buy YES when the 1-minute close rises ≥ $0.10 versus the previous close",
    side: "yes",
    hold: "settlement",
    signal: (c, i) => (i > 0 && c.close !== null && c.prevClose !== null && c.close - c.prevClose >= 0.10) ? c.close : null
  },
  {
    key: "dip",
    name: "Buy the dip",
    rule: "Buy YES when the 1-minute close falls ≥ $0.10 versus the previous close",
    side: "yes",
    hold: "settlement",
    signal: (c, i) => (i > 0 && c.close !== null && c.prevClose !== null && c.prevClose - c.close >= 0.10) ? c.close : null
  },
  {
    key: "fade",
    name: "Fade the extreme",
    rule: "Buy NO when the 1-minute close is ≥ $0.90",
    side: "no",
    hold: "settlement",
    signal: c => (c.close !== null && c.close >= 0.90) ? c.close : null
  },
  {
    key: "confirm",
    name: "Breakout with volume confirmation",
    rule: "Buy YES on a ≥ $0.10 up-move whose period volume is above the market's median period volume",
    side: "yes",
    hold: "settlement",
    signal: null /* computed in simulator.js — needs the market's volume series */
  },
  {
    key: "scalp",
    name: "Round-trip scalper",
    rule: "Buy YES after a ≥ $0.10 up-move, sell back at entry + $0.10; otherwise hold to settlement",
    side: "yes",
    hold: "roundtrip",
    signal: (c, i) => (i > 0 && c.close !== null && c.prevClose !== null && c.close - c.prevClose >= 0.10) ? c.close : null
  },
  {
    key: "flat",
    name: "Never trade (control)",
    rule: "No position — a control row that must return zero trades and zero P&L",
    side: "yes",
    hold: "settlement",
    signal: () => null
  }
];

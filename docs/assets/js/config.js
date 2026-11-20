/* ==========================================================================
   config.js — endpoints, official vocabulary, topic taxonomy.
   Every value here is either an official Kalshi endpoint (verified against
   docs.kalshi.com) or a Kalshi-native category / tag string that was
   enumerated from the live API (see data/probe/api_surface.json).

   Sources:
     API environments : https://docs.kalshi.com/getting_started/api_environments
     Demo environment : https://docs.kalshi.com/getting_started/demo_env
     Series list      : https://docs.kalshi.com/api-reference/market/get-series-list
   ========================================================================== */

/* Demo base URLs. `external-api.demo.kalshi.co` is Kalshi's *recommended*
   demo host and is the only one that returns CORS headers for browser
   origins — verified live, see data/probe/api_surface.json.
   The shared host `demo-api.kalshi.co` is listed by Kalshi as "also
   supported" but returns NO Access-Control-Allow-Origin header, so a
   browser page cannot call it. Both are listed in the UI for transparency. */
export const HOSTS = {
  recommended: {
    label: 'external-api.demo.kalshi.co',
    base: 'https://external-api.demo.kalshi.co/trade-api/v2',
    ws: 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2',
    cors: true,
    source: 'https://docs.kalshi.com/getting_started/api_environments',
  },
  shared: {
    label: 'demo-api.kalshi.co',
    base: 'https://demo-api.kalshi.co/trade-api/v2',
    ws: 'wss://demo-api.kalshi.co/trade-api/ws/v2',
    cors: false,
    source: 'https://docs.kalshi.com/getting_started/api_environments',
  },
};

export const DEFAULT_HOST = 'recommended';

export const DOCS = 'https://docs.kalshi.com';

/* ---------------------------------------------------------------- topics --
   The five required topics are mapped onto Kalshi's OWN category / tag
   vocabulary (never free-text keyword matching on market titles, which
   produces false positives such as "Las Vegas" -> "gas").

   Official categories observed on the demo API (16,643 series):
     Sports, Elections, Entertainment, Politics, Financials, Economics,
     Climate and Weather, Mentions, Science and Technology, Crypto,
     Companies, Commodities, World, Health, Social, Transportation,
     Exotics, Culture, Business, Education, ...
   Official tags observed (relevant subset):
     Gas, Oil & Gas, Oil and energy, Golf, US Elections,
     International elections, Foreign Elections, Election Combos,
     Culture war, ...
   -------------------------------------------------------------------------- */
export const TOPICS = {
  gas: {
    key: 'gas',
    label: 'Gas Prices',
    blurb: 'Gasoline and oil-and-gas markets, selected by Kalshi’s own "Gas" / "Oil & Gas" tags.',
    category: null,
    tags: ['Gas', 'Oil & Gas'],
    source: 'https://docs.kalshi.com/api-reference/market/get-series-list',
  },
  elections: {
    key: 'elections',
    label: 'Elections',
    blurb: 'Election markets, selected by the official "Elections" category and election tags.',
    category: 'Elections',
    tags: ['US Elections', 'International elections', 'Foreign Elections', 'Election Combos'],
    source: 'https://docs.kalshi.com/api-reference/market/get-series-list',
  },
  culture: {
    key: 'culture',
    label: 'Culture',
    blurb: 'Culture markets, selected by the official "Culture" category.',
    category: 'Culture',
    tags: ['Culture war'],
    source: 'https://docs.kalshi.com/api-reference/market/get-series-list',
  },
  crypto: {
    key: 'crypto',
    label: 'Crypto',
    blurb: 'Crypto markets, selected by the official "Crypto" category.',
    category: 'Crypto',
    tags: [],
    source: 'https://docs.kalshi.com/api-reference/market/get-series-list',
  },
  golf: {
    key: 'golf',
    label: 'Golf',
    blurb: 'Golf markets, selected by Kalshi’s own "Golf" tag.',
    category: null,
    tags: ['Golf'],
    source: 'https://docs.kalshi.com/api-reference/market/get-series-list',
  },
};

export const TOPIC_ORDER = ['gas', 'elections', 'culture', 'crypto', 'golf'];

/* ------------------------------------------------------------- endpoints --
   Paths verified against the official API reference. */
export const ENDPOINTS = {
  series:     { path: '/series',                       doc: 'https://docs.kalshi.com/api-reference/market/get-series-list' },
  events:     { path: '/events',                       doc: 'https://docs.kalshi.com/api-reference/events/get-events' },
  event:      { path: '/events/{ticker}',             doc: 'https://docs.kalshi.com/api-reference/events/get-event' },
  markets:    { path: '/markets',                      doc: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  market:     { path: '/markets/{ticker}',             doc: 'https://docs.kalshi.com/api-reference/market/get-market' },
  orderbook:  { path: '/markets/{ticker}/orderbook',   doc: 'https://docs.kalshi.com/api-reference/market/get-market-orderbook' },
  candles:    { path: '/series/{series}/markets/{ticker}/candlesticks',
                                                   doc: 'https://docs.kalshi.com/api-reference/market/get-market-candlesticks' },
  trades:     { path: '/markets/trades',               doc: 'https://docs.kalshi.com/api-reference/market/get-trades' },
  balance:    { path: '/portfolio/balance',            doc: 'https://docs.kalshi.com/api-reference/portfolio/get-balance' },
  positions:  { path: '/portfolio/positions',          doc: 'https://docs.kalshi.com/api-reference/portfolio/get-positions' },
  orders:     { path: '/portfolio/events/orders',      doc: 'https://docs.kalshi.com/getting_started/quick_start_create_order' },
  fills:      { path: '/portfolio/fills',              doc: 'https://docs.kalshi.com/api-reference/portfolio/get-fills' },
};

export const SOURCE_LINKS = {
  home: 'https://docs.kalshi.com/',
  apiRef: 'https://docs.kalshi.com/api-reference',
  envs: 'https://docs.kalshi.com/getting_started/api_environments',
  demo: 'https://docs.kalshi.com/getting_started/demo_env',
  auth: 'https://docs.kalshi.com/getting_started/quick_start_authenticated_requests',
  keys: 'https://docs.kalshi.com/getting_started/api_keys',
  orders: 'https://docs.kalshi.com/getting_started/quick_start_create_order',
  marketData: 'https://docs.kalshi.com/getting_started/quick_start_market_data',
  ws: 'https://docs.kalshi.com/getting_started/quick_start_websockets',
  rateLimits: 'https://docs.kalshi.com/getting_started/rate_limits',
  orderbook: 'https://docs.kalshi.com/api-reference/market/get-market-orderbook',
  candles: 'https://docs.kalshi.com/api-reference/market/get-market-candlesticks',
  settlement: 'https://docs.kalshi.com/getting_started/market_settlement',
  lifecycle: 'https://docs.kalshi.com/getting_started/market_lifecycle',
  fees: 'https://kalshi.com/docs/kalshi-fee-schedule.pdf',
  developerAgreement: 'https://kalshi.com/developer-agreement',
};

/* How long a cached API response stays fresh, in ms. */
export const TTL = {
  series: 10 * 60 * 1000,
  events: 60 * 1000,
  markets: 30 * 1000,
  book: 5 * 1000,
  candle: 60 * 1000,
};

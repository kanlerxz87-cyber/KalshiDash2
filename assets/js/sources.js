/* KalshiDash2 — the source register.
 *
 * One place that records WHERE every factual claim on this site comes from, so
 * a reader can check it without trusting the page. This is the machine-readable
 * half; `sources.html` renders it, and `tests/sources-page.test.mjs` asserts
 * that the page and this file cannot drift apart.
 *
 * Rules this file follows
 * -----------------------
 *  1. `official` is true only for Kalshi's own documentation, its OpenAPI /
 *     AsyncAPI files, its own API hosts, or its own repository references.
 *     Anything else is `false` and is labelled as third-party by the page.
 *  2. `verified` records HOW the entry was checked: "index" means the URL was
 *     matched against the official documentation index at
 *     https://docs.kalshi.com/llms.txt, "fetched" means the page itself was
 *     read, and "unverified" means neither and the row must not be presented as
 *     confirmed.
 *  3. No price, volume, balance or resolution value appears here. Those are read
 *     live by the browser and are never transcribed into the repository, so a
 *     source entry may name an endpoint but never a figure.
 */

/* Every entry: { group, title, url, used, official, verified, note } */
export const SOURCE_GROUPS = [
  { key: "env", label: "Environment and endpoints" },
  { key: "auth", label: "Authentication and signing" },
  { key: "market", label: "Market data endpoints" },
  { key: "trading", label: "Trading and portfolio endpoints" },
  { key: "ws", label: "WebSocket" },
  { key: "rules", label: "Market mechanics, settlement and fees" },
  { key: "ops", label: "Limits, history and exchange operations" },
  { key: "third", label: "Third-party and non-Kalshi references" }
];

const D = "https://docs.kalshi.com";

export const SOURCES = [
  /* ---------------------------------------------------------------- env */
  { group: "env", title: "Test In The Demo Environment",
    url: `${D}/getting_started/demo_env`,
    used: "Demo REST root, demo WebSocket root, mock funds, separate credentials",
    official: true, verified: "fetched",
    note: "Names https://demo.kalshi.co/ as the demo site, the recommended roots and the alternates. Read 2026-11-21." },
  { group: "env", title: "API Environments and Endpoints",
    url: `${D}/getting_started/api_environments`,
    used: "The production/demo endpoint table the site's configuration is limited to",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms recommended demo REST/WS hosts (external-api.demo.kalshi.co / external-api-ws.demo.kalshi.co), supported alternates, and host-independent path signing; the site refuses to talk to any host other than the two demo roots." },
  { group: "env", title: "Making Your First Request",
    url: `${D}/getting_started/making_your_first_request`,
    used: "Background on the first unauthenticated call",
    official: true, verified: "index", note: "" },
  { group: "env", title: "Kalshi Glossary",
    url: `${D}/getting_started/terms`,
    used: "Vocabulary: contract, market, event, series, settlement",
    official: true, verified: "index", note: "" },

  /* --------------------------------------------------------------- auth */
  { group: "auth", title: "API Keys",
    url: `${D}/getting_started/api_keys`,
    used: "KALSHI-ACCESS-* headers, the pre-sign string, RSA-PSS and Ed25519 rules",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms Ed25519 and RSA-PSS/SHA-256 (salt length = digest length), 30-second timestamp tolerance, PEM header ambiguity between PKCS#8 RSA and Ed25519, and timestamp + method + path without query string (keeping /trade-api/v2)." },
  { group: "auth", title: "Quick Start: Authenticated Requests",
    url: `${D}/getting_started/quick_start_authenticated_requests`,
    used: "Worked signing example; balance units",
    official: true, verified: "index", note: "" },
  { group: "auth", title: "Order direction (outcome_side and book_side)",
    url: `${D}/getting_started/order_direction`,
    used: "bid ≡ yes and ask ≡ no; which field names the side on fills and trades",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms bid ≡ yes and ask ≡ no on Order/Fill/Trade, taker_outcome_side/taker_book_side on public trades, and matching at the same price p. The order form asks YES/NO and maps it to bid/ask internally." },

  /* ------------------------------------------------------------- market */
  { group: "market", title: "Get Events",
    url: `${D}/api-reference/events/get-events`,
    used: "Open-event discovery (page limit up to 200); stated to exclude multivariate events",
    official: true, verified: "fetched",
    note: "Read 2026-11-22: marks event.category deprecated in favour of series-level categories." },
  { group: "market", title: "Get Event",
    url: `${D}/api-reference/events/get-event`,
    used: "Event detail and the settlement_sources list shown beside an alert",
    official: true, verified: "fetched",
    note: "settlement_sources are cited as the source that decides a market, never as the cause of a price move. Read 2026-11-22." },
  { group: "market", title: "Get Multivariate Events",
    url: `${D}/api-reference/events/get-multivariate-events`,
    used: "Combo markets, classified by the events their selected legs belong to",
    official: true, verified: "index", note: "" },
  { group: "market", title: "Get Markets",
    url: `${D}/api-reference/market/get-markets`,
    used: "Market fields, status filter, and cursor pagination (limit 1 to 1000, default 100)",
    official: true, verified: "fetched",
    note: "Read 2026-11-22: MarketLimitQuery defaults to 100 with maximum 1000; 200 is the Get Events page cap. Confirmed live the same day: GET /markets?limit=1001 is rejected and limit=1000 succeeds, while GET /events?limit=201 is rejected and limit=200 succeeds (reports/verify-faf9fe08.md)." },
  { group: "market", title: "Get Market",
    url: `${D}/api-reference/market/get-market`,
    used: "last_price_dollars, previous_price_dollars, notional_value_dollars, price_ranges, result",
    official: true, verified: "fetched",
    note: "Read 2026-11-22: previous_price_dollars is the last traded YES price a day ago (Flag Z1); result enum is yes, no, scalar or empty." },
  { group: "market", title: "Get Trades",
    url: `${D}/api-reference/market/get-trades`,
    used: "Official traded-dollar volume: count_fp × the price of the side the taker bought",
    official: true, verified: "fetched",
    note: "limit 1–1000 with a cursor; min_ts/max_ts are Unix seconds. Read 2026-11-21; the arithmetic is covered by tests/dollar-volume.test.mjs." },
  { group: "market", title: "Get Market Orderbook",
    url: `${D}/api-reference/market/get-market-orderbook`,
    used: "Liquidity: how many contracts rest at each price",
    official: true, verified: "index", note: "" },
  { group: "market", title: "Orderbook Responses",
    url: `${D}/getting_started/orderbook_responses`,
    used: "Why only bids are returned, and why a NO bid at y is a YES ask at 1 − y",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms orderbook_fp yes_dollars and no_dollars return ascending bids only, reciprocal YES ask = 1 − NO bid, and unknown/empty tickers answer 200 with empty arrays rather than 404." },
  { group: "market", title: "Get Market Candlesticks",
    url: `${D}/api-reference/market/get-market-candlesticks`,
    used: "price-over-time chart; intervals of only 1, 60 or 1440 minutes; 5,000-period cap",
    official: true, verified: "fetched",
    note: "Read 2026-11-22: seconds-resolution history does not exist at this endpoint, so short windows are live samples the page accumulates and labels as such." },
  { group: "market", title: "Batch Get Market Candlesticks",
    url: `${D}/api-reference/market/batch-get-market-candlesticks`,
    used: "Chart history for several markets in one request",
    official: true, verified: "index", note: "" },
  { group: "market", title: "Get Series List",
    url: `${D}/api-reference/market/get-series-list`,
    used: "Series-level filters used for topic discovery",
    official: true, verified: "index",
    note: "Two things make a response size a floor, not a total. (1) A page size is not honoured on the demo host: GET /series?category=Crypto&limit=2 returns 8 series, so `limit` is ignored and a full category can come back in one reply. (2) Ask for a category the host has no series for and the payload is {\"series\": null} rather than an empty list, so callers must not read .data.length. Both measured 2026-11-22 (reports/verify-faf9fe08.md, Flag F5 / NF4). The documented `tags` filter does work on the demo host: GET /series?category=Sports&tags=Golf returned only Golf-tagged rows on 2026-11-27, which is how Flag F19 was measured." },
  { group: "market", title: "Get Series",
    url: `${D}/api-reference/market/get-series`,
    used: "Series record: primary category, discovery categories[], tags[], and contract_url / contract_terms_url filings",
    official: true, verified: "fetched",
    note: "Read 2026-11-22; re-read 2026-11-27, when GET /series/KXDPWORLDTOURR2LEAD returned category Sports, categories [\"Sports\"] and tags [\"Golf\"] — a golf series the topic filter's title patterns do not match (Flag F19)." },
  { group: "market", title: "Fixed-Point Representation",
    url: `${D}/getting_started/fixed_point_migration`,
    used: "Meaning of *_fp contract counts and *_dollars price strings; the price grid",
    official: true, verified: "index", note: "" },

  /* ------------------------------------------------------------ trading */
  { group: "trading", title: "Quick Start: Create your first order",
    url: `${D}/getting_started/quick_start_create_order`,
    used: "Order lifecycle walkthrough",
    official: true, verified: "index", note: "" },
  { group: "trading", title: "Create Order (V2)",
    url: `${D}/api-reference/orders/create-order-v2`,
    used: "POST /portfolio/events/orders; documented required fields; legacy routes return 410",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms required fields (ticker, side bid/ask, count, price, time_in_force, self_trade_prevention_type), YES-leg request quoting ('Selling YES is economically equivalent to buying NO at 1 - price'), 410 deprecated_v1_order_endpoint on legacy /portfolio/orders, and 201 meaning accepted rather than filled (check remaining_count)." },
  { group: "trading", title: "Cancel Order (V2)",
    url: `${D}/api-reference/orders/cancel-order-v2`,
    used: "Cancel route used by the portfolio page",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: DELETE /portfolio/events/orders/{order_id} requires market_ticker for auto-routing when exchange_index is omitted or -1; wrong-shard cancels return 404 while leaving the order resting." },
  { group: "trading", title: "Get Orders",
    url: `${D}/api-reference/orders/get-orders`,
    used: "Resting and historical orders",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: limit 1–1000 (default 100), status resting/canceled/executed; completed/canceled orders older than orders_updated_ts move to GET /historical/orders while resting orders remain live." },
  { group: "trading", title: "Order Errors",
    url: `${D}/getting_started/order_errors`,
    used: "Status codes and error codes the order form reports verbatim",
    official: true, verified: "index", note: "" },
  { group: "trading", title: "Get Balance",
    url: `${D}/api-reference/portfolio/get-balance`,
    used: "Demo-account balance and portfolio value",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: returns balance (cents), balance_dollars (fixed-point string), portfolio_value (cents), updated_ts, and optional balance_breakdown across shards; dedicated rate bucket (1/s Basic/Advanced, 5/s higher)." },
  { group: "trading", title: "Get Positions",
    url: `${D}/api-reference/portfolio/get-positions`,
    used: "Open positions used for performance tracking",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: limit 1–1000 (default 100), settlement_status defaults to unsettled (settled/all available); archived settled positions move to GET /historical/positions after whole-event handoff." },
  { group: "trading", title: "Get Fills",
    url: `${D}/api-reference/portfolio/get-fills`,
    used: "Fill ledger, categorised by topic, side and maker/taker role",
    official: true, verified: "fetched", note: "Read 2026-11-22 and re-verified 2026-11-27 (limit 1–1000, default 100; pre-cutoff fills on GET /historical/fills)." },
  { group: "trading", title: "Get Settlements",
    url: `${D}/api-reference/portfolio/get-settlements`,
    used: "Settled positions, which close the performance loop",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: returns live-tier settlement records only (limit 1–1000; market_result enum yes/no/scalar/blank; revenue in cents; fee_cost in dollars); does not return archived records." },

  /* ----------------------------------------------------------------- ws */
  { group: "ws", title: "Quick Start: WebSockets",
    url: `${D}/getting_started/quick_start_websockets`,
    used: "Connection URLs and the authenticated handshake",
    official: true, verified: "index",
    note: "A browser's WebSocket constructor cannot set the handshake headers, which is why the optional relay exists." },
  { group: "ws", title: "WebSocket connection",
    url: `${D}/websockets/websocket-connection`,
    used: "Channel subscription and command frames",
    official: true, verified: "index", note: "" },
  { group: "ws", title: "Market Ticker channel",
    url: `${D}/websockets/market-ticker`,
    used: "The ticker frame fields the live feed maps (price_dollars, yes_bid_dollars, …)",
    official: true, verified: "index", note: "" },
  { group: "ws", title: "AsyncAPI schema",
    url: `${D}/asyncapi.yaml`,
    used: "Machine-readable channel and payload definitions",
    official: true, verified: "index", note: "" },

  /* -------------------------------------------------------------- rules */
  { group: "rules", title: "Market Lifecycle",
    url: `${D}/getting_started/market_lifecycle`,
    used: "Status transitions from creation to settlement",
    official: true, verified: "index", note: "" },
  { group: "rules", title: "Market Settlement",
    url: `${D}/getting_started/market_settlement`,
    used: "Yes pays $1 to YES holders, No $1 to NO holders",
    official: true, verified: "fetched", note: "Read 2026-11-22." },
  { group: "rules", title: "Fee Rounding",
    url: `${D}/getting_started/fee_rounding`,
    used: "How the simulated strategy tester rounds fees",
    official: true, verified: "index", note: "" },
  { group: "rules", title: "Kalshi fee schedule (PDF)",
    url: "https://kalshi.com/docs/kalshi-fee-schedule.pdf",
    used: "The fee rate the simulator models",
    official: true, verified: "fetched",
    note: "Read in full 2026-11-27 (title: \"Fee Schedule for July 2026 – 7.7.26 Update\"; \"Last updated and effective: July 7, 2026\"). Taker fee round_up(M × 0.07 × C × P × (1−P)); maker round_up(M × 0.0175 × C × P × (1−P)) with maker multiplier default 0; \"There is no settlement fee.\" The Non-Standard Fees table lists the ten multiplier-0 series the simulator special-cases. Earlier sessions recorded this PDF as unreadable from the build sandbox; that limit no longer applies (reports/verify-54220d3d.md §2)." },

  /* ---------------------------------------------------------------- ops */
  { group: "ops", title: "Rate Limits and Tiers",
    url: `${D}/getting_started/rate_limits`,
    used: "Token buckets; 429 handling; why the pages back off instead of retrying in a loop",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms separate Read, Write (per-shard for nonzero shards), Balance, and Transfer token buckets; 429 carries X-RateLimit-* headers without Retry-After; unauthenticated public limits are separate and unpublished (Flag F3)." },
  { group: "ops", title: "Historical Data",
    url: `${D}/getting_started/historical_data`,
    used: "Why some settled markets must be read from /historical routes",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms live vs historical tier partitioning for markets, candlesticks, trades, orders, and positions via GET /historical/cutoff; events and series stay on their original endpoints." },
  { group: "ops", title: "Get Historical Markets",
    url: `${D}/api-reference/historical/get-historical-markets`,
    used: "Archived settled markets included in the Strategy Tester universe",
    official: true, verified: "fetched",
    note: "Read 2026-11-22 and re-verified 2026-11-27: the endpoint states 'Filters are mutually exclusive', so the site queries /historical/markets by page size/cursor only and archived candles by ticker, never combining filters." },
  { group: "ops", title: "Get Historical Market Candlesticks",
    url: `${D}/api-reference/historical/get-historical-market-candlesticks`,
    used: "Archived candlesticks fallback when a settled market has aged out of the live tier",
    official: true, verified: "fetched",
    note: "Read 2026-11-22 and confirmed live on the demo host; candle fields omit the _dollars and _fp suffixes." },
  { group: "ops", title: "Get Historical Cutoff Timestamps",
    url: `${D}/api-reference/historical/get-historical-cutoff-timestamps`,
    used: "Cutoff timestamps partitioning live and historical endpoints",
    official: true, verified: "fetched",
    note: "Read 2026-11-27 and confirmed live on GET /historical/cutoff on the demo host: publishes market_settled_ts, trades_created_ts, orders_updated_ts, and market_positions_last_updated_ts." },
  { group: "ops", title: "Exchange Sharding",
    url: `${D}/getting_started/exchange_sharding`,
    used: "Background on exchange_index in order routing",
    official: true, verified: "fetched",
    note: "Read 2026-11-27: confirms shard assignments (0 default, 1 Exotics/Combos, 2 Crypto/Commodities, 3 Sports tags), market_ticker requirement for auto-routed cancels, and wrong-shard 404 rejection." },
  { group: "ops", title: "Get Exchange Status",
    url: `${D}/api-reference/exchange/get-exchange-status`,
    used: "The exchange-status field shown on the Overview",
    official: true, verified: "fetched",
    note: "Read 2026-11-27 and confirmed live on the demo host: top-level flags cover default shard 0 only; exchange_index_statuses reports per-shard flags; read flags only from HTTP 200 and re-read before treating a single non-0 false as a pause (Flag F18)." },
  { group: "ops", title: "Documentation index (llms.txt)",
    url: `${D}/llms.txt`,
    used: "The official index this register was checked against",
    official: true, verified: "fetched",
    note: "Every docs.kalshi.com URL above was matched against this index on 2026-11-21." },
  { group: "ops", title: "Live demo API host (the site's own requests)",
    url: "https://external-api.demo.kalshi.co/trade-api/v2",
    used: "Every live figure on the site is a response from this host, fetched by the visitor's browser",
    official: true, verified: "index",
    note: "Open endpoints answer without a key; portfolio and order routes need the visitor's own demo key." },

  /* -------------------------------------------------------------- third */
  { group: "third", title: "Web Crypto API (W3C)",
    url: "https://www.w3.org/TR/WebCryptoAPI/",
    used: "Why in-browser signing is possible at all",
    official: false, verified: "index",
    note: "Not a Kalshi source. Browser support for each algorithm was not re-tested in this build." },
  { group: "third", title: "AAA daily gas prices",
    url: "https://gasprices.aaa.com/",
    used: "The public page a retail-gasoline contract is settled against, offered as a place to check the number",
    official: false, verified: "index",
    note: "Not a Kalshi source. Linked as context for gas markets only; never asserted as the cause of a price move." },
  { group: "third", title: "GitHub advisory GHSA-67mh-4wv8-2f99",
    url: "https://github.com/advisories/GHSA-67mh-4wv8-2f99",
    used: "The esbuild advisory that affects a test-only dependency",
    official: false, verified: "index",
    note: "GitHub's advisory database, not Kalshi. The affected package is used only by the DOM test harness, not by the published site." }
];

/* Rows that must be visibly unconfirmed on the page. */
export function unverifiedEntries(list = SOURCES) {
  return list.filter(e => e.verified === "unverified");
}

/* Counts for the summary tiles. */
export function sourceStats(list = SOURCES) {
  return {
    total: list.length,
    official: list.filter(e => e.official).length,
    thirdParty: list.filter(e => !e.official).length,
    verified: list.filter(e => e.verified !== "unverified").length,
    unverified: unverifiedEntries(list).length,
    fetched: list.filter(e => e.verified === "fetched").length
  };
}

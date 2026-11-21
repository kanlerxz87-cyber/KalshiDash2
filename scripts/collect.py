#!/usr/bin/env python3
"""Collect a verified snapshot of Kalshi DEMO market data.

Source of truth (official):
  REST base : https://external-api.demo.kalshi.co/trade-api/v2
  Docs      : https://docs.kalshi.com/api-reference
  Env table : https://docs.kalshi.com/getting_started/api_environments

The script uses only the Python standard library so it runs anywhere (CI, laptop).

Raw market, event, and series fields written to the snapshot are copied from
official API responses. Derived fields are computed separately and explicitly
labelled with their formula and collection limits in the output; capped samples
are not represented as complete exchange totals.

Usage:
    python3 scripts/collect.py [--out data/snapshot.json] [--top-series 40]
                                [--top-book 20] [--sleep 0.25]
                                [--max-events-per-series 10]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

BASE = "https://external-api.demo.kalshi.co/trade-api/v2"
DOCS = "https://docs.kalshi.com"
EVENTS_PAGE_MAX = 200  # Official GET /events maximum: 1 <= limit <= 200.
TRADE_SAMPLE_PAGE_LIMIT = 1000
TRADE_SAMPLE_MAX_PAGES = 3

# Canonical disclosure strings for derived snapshot content.
#
# These MUST stay identical to what `data/snapshot.json` carries: the scheduled
# collector rewrites that file every six hours, and
# `tools/test_collect.py::SnapshotMetadataTests` compares the two exactly so a
# wording change cannot silently land on `main` (see Session e2718295 on
# COORDINATION.md). Field semantics are the official ones:
#   GET /markets  -> volume_fp / volume_24h_fp "market volume in contracts",
#                    open_interest_fp "number of contracts bought on this market
#                    disconsidering netting", notional_value_dollars "The total
#                    value of a single contract at settlement in dollars".
#   GET /markets/trades -> paginated (limit 1-1000), min_ts/max_ts in seconds.
DERIVATION_NOTES = {
    "contract_volume": (
        "volume_fp, volume_24h_fp, and open_interest_fp are contract-count fields "
        "(fixed-point contract counts), not traded-dollar volume. "
        "notional_value_dollars is the value of a single contract at settlement, "
        "not cumulative turnover."
    ),
    "sampled_yes_price_times_contracts": (
        "Computed arithmetic: SUM(yes_price_dollars * count_fp) over valid rows "
        "returned by GET /markets/trades (up to 3 pages x limit 1000). No min_ts "
        "time bound is passed; pagination is capped. Missing/invalid prices or "
        "counts are skipped. This sample product is not asserted as actual "
        "all-side cash turnover, gross cash exchanged, full-history activity, or "
        "a complete 24-hour total; only tickers with valid returned rows receive "
        "a value."
    ),
    "sampled_trade_contracts_fp": (
        "SUM(count_fp) for valid rows in the market's returned trade sample; not complete volume."
    ),
    "sampled_trade_count": (
        "Number of valid returned trade records for the market; not contract quantity or complete history."
    ),
    "sampled_last_trade_time": (
        "Latest created_time among valid trade rows returned for the market; "
        "not necessarily the latest market trade."
    ),
    "ranking": (
        "events/markets sorted by volume_24h_fp desc, then volume_fp desc "
        "(contract volume, not dollar volume)."
    ),
    "topic_rules": (
        "Discovery uses only official Kalshi `category` / `tags` filters. Where no "
        "category covers a topic (retail gasoline), the same explicit series-family "
        "+ title rule and exclusions as the dashboard (assets/js/config.js) are "
        "applied locally; they can only narrow the official candidate list, never "
        "add to it."
    ),
}


def non_negative_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be non-negative")
    return parsed


# ---------------------------------------------------------------------------
# Topic taxonomy.
#
# The mapping uses Kalshi's OWN official category / tag vocabulary, which was
# enumerated from GET /series?include_volume=true (see data/probe/api_surface.json).
# Categories seen: Sports, Elections, Entertainment, Politics, Financials,
# Economics, Climate and Weather, Mentions, Science and Technology, Crypto,
# Companies, Commodities, World, Health, Social, Transportation, Exotics,
# Culture, Business, Education, ...
# Tags seen (relevant): Gas, Oil & Gas, Oil and energy, Golf, US Elections,
# International elections, Foreign Elections, Election Combos, Culture war, ...
# ---------------------------------------------------------------------------
TOPICS = {
    "gas": {
        "label": "Gas Prices",
        # No Kalshi category covers retail gasoline, so the official category
        # filter is used only to discover candidates (Economics/Commodities) and
        # the SAME explicit rule as the dashboard's config.js is then applied:
        # the AAA retail-gas series family (KXAAAGAS* / AAAGAS*) or a gas-price
        # title, never crude / natural gas / diesel / Vegas rows. The previous
        # tag-only rule (Gas, Oil & Gas, Oil and energy) pulled WTI, Brent,
        # natural gas, diesel and ERCOT power into a topic labelled "Gas Prices".
        "series_filter": {"categories": ["Economics", "Commodities"]},
        # Local narrowing only (never sent to the API): identical to the
        # dashboard rule in assets/js/config.js.
        # GET /series/{ticker} (documented) is used for the one retail-gasoline
        # series that carries no tag and is not guaranteed to appear under a
        # discovery category: KXGAS, "Gas weekly", settlement source EIA weekly
        # US retail gasoline (verified 2026-11-21 by session 32b15793 and now
        # also matched by the dashboard's config.js).
        "direct_series": ["KXGAS"],
        "local_rule": {
            "series_patterns": [r"^(?:KX)?A{3}GAS", r"^KXGAS$"],
            "title_patterns": [
                r"gas(oline)? (price|average)", r"\bAAA gas", r"^gas (weekly|price)$",
            ],
            "exclude_patterns": [
                r"natural\s*gas", r"\bNATGAS\b", r"\bWTI\b", r"\bBRENT\b",
                r"crude", r"diesel", r"\bVEGAS\b", r"\bbarrels?\b", r"\boil\b",
            ],
        },
        "note": (
            "Selected from the official categories Economics / Commodities plus the "
            "directly fetched KXGAS series, then restricted to the retail-gasoline "
            "series families (KXAAAGAS*, AAAGAS*, KXGAS) and gas-price titles, with "
            "crude / natural-gas / diesel / Vegas rows excluded - the same rule the "
            "dashboard applies."
        ),
        "source": f"{DOCS}/api-reference/market/get-series-list",
    },
    "elections": {
        "label": "Elections",
        # Official Kalshi category for election markets.
        "series_filter": {"category": "Elections"},
        "note": "Selected by the official Kalshi category 'Elections'.",
        "source": f"{DOCS}/api-reference/market/get-series-list",
    },
    "culture": {
        "label": "Culture",
        # The dashboard maps Culture to three official categories (Culture,
        # Entertainment, Social); matching only 'Culture' left the topic empty
        # in the 2026-11-21 snapshot (2 series, 0 open events).
        "series_filter": {"categories": ["Culture", "Social", "Entertainment"]},
        "note": (
            "Selected by the official Kalshi categories 'Culture', 'Social' and "
            "'Entertainment' - the same three categories the dashboard maps to Culture."
        ),
        "source": f"{DOCS}/api-reference/market/get-series-list",
    },
    "crypto": {
        "label": "Crypto",
        "series_filter": {"category": "Crypto"},
        "note": "Selected by the official Kalshi category 'Crypto'.",
        "source": f"{DOCS}/api-reference/market/get-series-list",
    },
    "golf": {
        "label": "Golf",
        "series_filter": {"tags": ["Golf"]},
        "note": (
            "Selected with the server-side `tags` parameter (Golf). The Get Series "
            "List spec does not describe how `tags` matching works, so this is the "
            "filter the request applied, not a documented taxonomy."
        ),
        "source": f"{DOCS}/api-reference/market/get-series-list",
    },
}

# Fields copied verbatim from the API for a series.
SERIES_FIELDS = (
    "ticker", "title", "category", "categories", "tags", "frequency",
    "volume_fp", "fee_type", "fee_multiplier", "last_updated_ts",
    "contract_url", "contract_terms_url", "exchange_index",
)

# Fields copied verbatim from the API for a market.
MARKET_FIELDS = (
    "ticker", "event_ticker", "title", "yes_sub_title", "no_sub_title",
    "status", "result", "market_type", "yes_bid_dollars", "yes_ask_dollars",
    "yes_bid_size_fp", "yes_ask_size_fp", "no_bid_dollars", "no_ask_dollars",
    "last_price_dollars", "previous_price_dollars", "volume_fp",
    "volume_24h_fp", "open_interest_fp", "notional_value_dollars",
    "open_time", "close_time", "expected_expiration_time",
    "latest_expiration_time", "updated_time", "created_time",
    "price_level_structure", "price_ranges", "can_close_early",
    "settlement_timer_seconds", "early_close_condition", "rules_primary",
)

# Fields copied verbatim from the API for an event.
EVENT_FIELDS = (
    "event_ticker", "series_ticker", "title", "sub_title", "category",
    "strike_date", "strike_period", "mutually_exclusive",
    "collateral_return_type", "last_updated_ts",
)


class Client:
    """Minimal throttled REST client with retry-on-429."""

    def __init__(self, base: str = BASE, sleep: float = 0.25, retries: int = 5):
        self.base = base.rstrip("/")
        self.sleep = sleep
        self.retries = retries
        self.calls = 0
        self.last_call = 0.0
        self.errors: list[str] = []

    def _throttle(self):
        now = time.monotonic()
        wait = self.sleep - (now - self.last_call)
        if wait > 0:
            time.sleep(wait)
        self.last_call = time.monotonic()

    def get(self, path: str, params: dict | None = None) -> tuple[str, dict]:
        url = self.base + path
        if params:
            clean = {k: v for k, v in params.items() if v not in (None, "", [])}
            if clean:
                url += "?" + urllib.parse.urlencode(clean, doseq=True)
        delay = 1.0
        for attempt in range(self.retries):
            self._throttle()
            self.calls += 1
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    body = resp.read().decode("utf-8")
                    return url, json.loads(body)
            except urllib.error.HTTPError as exc:
                payload = exc.read().decode("utf-8", "replace")[:300]
                if exc.code == 429:
                    time.sleep(delay)
                    delay = min(delay * 2, 30)
                    continue
                self.errors.append(f"{exc.code} {url} :: {payload}")
                raise
            except Exception as exc:  # noqa: BLE001
                self.errors.append(f"ERR {url} :: {exc}")
                time.sleep(delay)
                delay = min(delay * 2, 30)
        raise RuntimeError(f"giving up on {url}")

    def paginate(self, path: str, key: str, params: dict | None = None,
                 max_pages: int = 25) -> tuple[list, list[str]]:
        """Follow the Kalshi cursor pagination until the cursor is empty."""
        items: list = []
        urls: list[str] = []
        cursor = ""
        pages = 0
        p = dict(params or {})
        while pages < max_pages:
            if cursor:
                p["cursor"] = cursor
            url, data = self.get(path, p)
            urls.append(url)
            items.extend(data.get(key) or [])
            cursor = data.get("cursor") or ""
            pages += 1
            if not cursor:
                break
        return items, urls


def pick(d: dict, fields) -> dict:
    return {k: d[k] for k in fields if k in d}


def collect_events_for_series(client: Client, series_ticker: str,
                              max_events: int) -> tuple[list, list[str]]:
    """Fetch at most ``max_events`` open events for one series.

    GET /events supports a maximum page size of 200. For larger caps, request
    enough cursor pages to reach the cap; always slice locally too, so an API
    response that exceeds the requested limit cannot leak extra rows. A zero
    cap avoids the request entirely. Selection is the API-returned page order,
    not a dollar-volume ranking.
    """
    cap = int(max_events)
    if cap < 0:
        raise ValueError("max_events must be non-negative")
    if cap == 0:
        return [], []

    limit = min(cap, EVENTS_PAGE_MAX)
    max_pages = (cap + limit - 1) // limit
    rows, urls = client.paginate(
        "/events", "events",
        {
            "series_ticker": series_ticker,
            "status": "open",
            "with_nested_markets": True,
            "limit": limit,
        },
        max_pages=max_pages,
    )
    return rows[:cap], urls


def _decimal_value(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return parsed if parsed.is_finite() else None


def aggregate_yes_price_weighted_trade_sample(trades: list[dict]) -> dict[str, dict]:
    """Aggregate only the explicit YES-price-weighted value in returned rows.

    This is *not* gross dollar volume or total cash exchanged. It is
    SUM(yes_price_dollars * count_fp) over the sampled records returned by
    GET /markets/trades. Missing or invalid prices/counts are skipped rather
    than silently treated as zero.
    """
    totals: dict[str, dict] = {}
    for trade in trades or []:
        if not isinstance(trade, dict):
            continue
        ticker = trade.get("ticker")
        price = _decimal_value(trade.get("yes_price_dollars"))
        count = _decimal_value(trade.get("count_fp"))
        if not ticker or price is None or count is None or count <= 0:
            continue

        row = totals.setdefault(str(ticker), {
            "yes_price_weighted_value_dollars": Decimal("0"),
            "contracts_fp": Decimal("0"),
            "trades": 0,
            "last_trade_time": None,
        })
        row["yes_price_weighted_value_dollars"] += price * count
        row["contracts_fp"] += count
        row["trades"] += 1
        created = trade.get("created_time")
        if created and (row["last_trade_time"] is None or str(created) > row["last_trade_time"]):
            row["last_trade_time"] = str(created)

    return {
        ticker: {
            "yes_price_weighted_value_dollars": float(row["yes_price_weighted_value_dollars"]),
            "contracts_fp": float(row["contracts_fp"]),
            "trades": row["trades"],
            "last_trade_time": row["last_trade_time"],
        }
        for ticker, row in totals.items()
    }


def order_series(rows: list[dict]) -> list[dict]:
    """Order series for the per-topic cap.

    Descending by the official ``volume_fp`` (a contract count, used only for
    selection), except that explicitly pinned series — those fetched by ticker
    because normal discovery cannot return them — always come first, so the cap
    cannot truncate them away.
    """
    ordered = sorted(rows, key=lambda s: float(s.get("volume_fp") or 0), reverse=True)
    return [s for s in ordered if s.get("_pinned")] + [s for s in ordered if not s.get("_pinned")]


def collect_series(client: Client, topic: str, spec: dict) -> tuple[list, list[str]]:
    """Fetch the series that belong to a topic.

    Discovery uses only official server-side filters. ``GET /series`` documents
    ``category``, ``tags``, ``include_product_metadata``, ``include_volume`` and
    ``min_updated_ts`` (https://docs.kalshi.com/api-reference/market/get-series-list);
    there is no ticker-prefix parameter, so any series-family rule is applied
    locally after the official query. The local rule is the same one the
    dashboard applies in ``assets/js/config.js``, so the snapshot and the live
    pages classify a topic identically.
    """
    flt = spec["series_filter"]
    got: dict[str, dict] = {}
    urls: list[str] = []
    single = flt.get("category")
    categories = list(flt.get("categories") or ([single] if single else []))
    tags = flt.get("tags") or []
    # The official filters are `category` (exact, case-sensitive, matches any
    # entry in a series' `categories` list) and `tags`.
    queries: list[dict] = [{"category": c} for c in categories]
    queries += [{"tags": t} for t in tags]
    for q in queries:
        series, u = client.paginate("/series", "series", {**q, "include_volume": True}, max_pages=5)
        urls += u
        for s in series:
            got.setdefault(s["ticker"], s)
    # Apply the remaining official tag filters locally so the rule is explicit
    # and reproducible (the API `tags` filter is exact + case-sensitive).
    if tags:
        want = {t.lower() for t in tags}
        if not categories:
            got = {
                k: v for k, v in got.items()
                if want & {str(t).lower() for t in (v.get("tags") or [])}
            }

    # Direct series lookups (GET /series/{series_ticker}, documented). Used only
    # for series that the official discovery filters cannot reliably return.
    for ticker in spec.get("direct_series") or []:
        url, data = client.get(f"/series/{urllib.parse.quote(ticker)}",
                               {"include_volume": True})
        urls.append(url)
        row = (data or {}).get("series") or {}
        if row.get("ticker"):
            row = dict(row)
            # Pinned: kept ahead of the volume-ordered cap, otherwise a
            # low-volume series fetched on purpose can be truncated away again.
            row["_pinned"] = True
            got.setdefault(row["ticker"], row)

    # Documented series-family / title rule, applied after discovery. This never
    # adds rows: it can only narrow the officially selected candidates.
    rule = spec.get("local_rule") or {}
    series_pats = [re.compile(p, re.I) for p in rule.get("series_patterns") or []]
    title_pats = [re.compile(p, re.I) for p in rule.get("title_patterns") or []]
    excl_pats = [re.compile(p, re.I) for p in rule.get("exclude_patterns") or []]
    if series_pats or title_pats:
        def keep(row: dict) -> bool:
            ticker = str(row.get("ticker") or "")
            title = str(row.get("title") or "")
            if any(p.search(ticker) or p.search(title) for p in excl_pats):
                return False
            return any(p.search(ticker) for p in series_pats) or \
                any(p.search(title) for p in title_pats)
        got = {k: v for k, v in got.items() if keep(v)}
    return list(got.values()), urls


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/snapshot.json")
    ap.add_argument("--top-series", type=int, default=40)
    ap.add_argument("--top-book", type=int, default=20)
    ap.add_argument("--sleep", type=float, default=0.25)
    ap.add_argument("--max-events-per-series", type=non_negative_int, default=10)
    args = ap.parse_args()

    client = Client(sleep=args.sleep)
    started = datetime.now(timezone.utc)

    # ---------------------------------------------------------------- topics
    topics: dict[str, dict] = {}
    series_by_topic: dict[str, list[dict]] = {}
    series_urls: dict[str, list[str]] = {}

    for key, spec in TOPICS.items():
        raw, urls = collect_series(client, key, spec)
        series_urls[key] = sorted(set(urls))
        # Official volume_fp is a fixed-point contract count. Use it only for
        # preliminary series selection; it is not traded-dollar volume. The
        # live dashboard's separate volume × current-price ranking is itself a
        # proxy, not an exchange-reported notional (see flagged.html#A11).
        raw = order_series(raw)
        series_by_topic[key] = raw
        topics[key] = {
            "label": spec["label"],
            "rule": spec["note"],
            "source": spec["source"],
            "series_matched": len(raw),
            "series_total_volume_fp": sum(float(s.get("volume_fp") or 0) for s in raw),
        }
        print(f"[{key}] {len(raw)} series matched", file=sys.stderr)

    # ---------------------------------------------------------------- events
    events: dict[str, dict] = {}
    markets: dict[str, dict] = {}
    event_urls: list[str] = []

    for key, raw in series_by_topic.items():
        for s in raw[: args.top_series]:
            evs, urls = collect_events_for_series(
                client, s["ticker"], args.max_events_per_series
            )
            event_urls += urls
            for ev in evs:
                et = ev.get("event_ticker")
                if not et:
                    continue
                e = events.setdefault(et, pick(ev, EVENT_FIELDS))
                e["_topics"] = sorted(set(e.get("_topics", []) + [key]))
                e["_series_ticker"] = s["ticker"]
                e["_series_title"] = s.get("title", "")
                e["_source"] = f"{BASE}/events?series_ticker={s['ticker']}&status=open&with_nested_markets=true"
                for m in ev.get("markets") or []:
                    mm = markets.setdefault(m["ticker"], pick(m, MARKET_FIELDS))
                    mm["_topics"] = sorted(set(mm.get("_topics", []) + [key]))
                    mm["_series_ticker"] = s["ticker"]
                    mm["_event_ticker"] = et
                    mm["_event_title"] = ev.get("title", "")
                    mm["_source"] = f"{BASE}/markets/{m['ticker']}"

    # ---------------------------------------------- sampled trade diagnostics
    # Explicit arithmetic only: SUM(yes_price_dollars * count_fp) over valid
    # rows returned by this capped request. There is no min_ts time bound; the
    # fetch is limited to three pages x 1000 rows. This is not actual all-side
    # cash turnover or complete volume (see flagged.html#A12).
    trades, trade_urls = client.paginate(
        "/markets/trades", "trades",
        {"limit": TRADE_SAMPLE_PAGE_LIMIT},
        max_pages=TRADE_SAMPLE_MAX_PAGES,
    )
    trade_sample = aggregate_yes_price_weighted_trade_sample(trades)

    # ------------------------------------------------------ order books
    books: dict[str, dict] = {}
    ranked = sorted(markets.values(), key=lambda m: float(m.get("volume_fp") or 0), reverse=True)
    for m in ranked[: args.top_book]:
        try:
            url, book = client.get(f"/markets/{m['ticker']}/orderbook", {"depth": 20})
        except Exception:  # noqa: BLE001
            continue
        books[m["ticker"]] = {"source": url, "orderbook_fp": book.get("orderbook_fp")}

    # ------------------------------------------------------- candlesticks
    candles: dict[str, dict] = {}
    now = int(time.time())
    for m in ranked[:8]:
        st = m.get("_series_ticker")
        tk = m.get("ticker")
        if not st or not tk:
            continue
        entry = {}
        for label, period, span in (("1m", 1, 60 * 60 * 24 * 3), ("60m", 60, 60 * 60 * 24 * 30)):
            try:
                url, c = client.get(
                    f"/series/{st}/markets/{tk}/candlesticks",
                    {"start_ts": now - span, "end_ts": now, "period_interval": period},
                )
            except Exception:  # noqa: BLE001
                continue
            cs = c.get("candlesticks") or []
            entry[label] = {"source": url, "candlesticks": cs[-400:]}
        if entry:
            candles[tk] = entry

    # ------------------------------------------------------------- assemble
    topic_payload = {}
    for key in TOPICS:
        tk_series = series_by_topic[key]
        ev_ids = [et for et, e in events.items() if key in e.get("_topics", [])]
        mk_ids = [t for t, m in markets.items() if key in m.get("_topics", [])]

        def money(m: dict, field: str) -> float:
            try:
                return float(m.get(field) or 0)
            except (TypeError, ValueError):
                return 0.0

        ev_rows = []
        for et in ev_ids:
            e = events[et]
            ms = [markets[t] for t in e.get("_market_tickers", [])] if e.get("_market_tickers") else \
                 [m for m in markets.values() if m.get("_event_ticker") == et]
            ev_rows.append({
                "event_ticker": et,
                "title": e.get("title"),
                "series_ticker": e.get("_series_ticker"),
                "series_title": e.get("_series_title"),
                "status": next((m.get("status") for m in ms if m.get("status")), None),
                "close_time": next((m.get("close_time") for m in ms if m.get("close_time")), None),
                "markets": len(ms),
                "volume_fp": round(sum(money(m, "volume_fp") for m in ms), 2),
                "volume_24h_fp": round(sum(money(m, "volume_24h_fp") for m in ms), 2),
                "open_interest_fp": round(sum(money(m, "open_interest_fp") for m in ms), 2),
                "source": e.get("_source"),
            })
        ev_rows.sort(key=lambda r: (r["volume_24h_fp"], r["volume_fp"]), reverse=True)

        mk_rows = []
        for t in mk_ids:
            m = dict(markets[t])
            sample = trade_sample.get(t)
            m["_sampled_yes_price_times_contracts"] = (
                round(sample["yes_price_weighted_value_dollars"], 2) if sample else None
            )
            m["_sampled_trade_contracts_fp"] = round(sample["contracts_fp"], 2) if sample else None
            m["_sampled_trade_count"] = sample["trades"] if sample else None
            m["_sampled_last_trade_time"] = sample["last_trade_time"] if sample else None
            m.pop("_topics", None)
            mk_rows.append(m)
        mk_rows.sort(key=lambda r: (float(r.get("volume_24h_fp") or 0), float(r.get("volume_fp") or 0)), reverse=True)

        topic_payload[key] = {
            "label": TOPICS[key]["label"],
            "rule": TOPICS[key]["note"],
            "source": TOPICS[key]["source"],
            "series_count": len(tk_series),
            "series": [pick(s, SERIES_FIELDS) for s in tk_series[: args.top_series]],
            "events": ev_rows[:100],
            "markets": mk_rows[:200],
        }

    event_page_limit = min(args.max_events_per_series, EVENTS_PAGE_MAX)
    max_event_pages_per_series = (
        (args.max_events_per_series + event_page_limit - 1) // event_page_limit
        if event_page_limit else 0
    )

    snapshot = {
        "_meta": {
            "generated_by": "scripts/collect.py",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "started_at": started.isoformat(),
            "base_url": BASE,
            "api_docs": DOCS,
            "environment": "Kalshi DEMO (mock funds)",
            "api_calls": client.calls,
            "errors": client.errors[:20],
            "derivation_notes": dict(DERIVATION_NOTES),
            "collection_scope": {
                "coverage": "sampled; no full-exchange completeness claim",
                "max_series_per_topic": args.top_series,
                "series_selection_order": "descending volume_fp (contract volume)",
                "max_events_per_series": args.max_events_per_series,
                "event_cap_enforced": True,
                "event_selection": "API-returned order up to the per-series cap",
                "event_page_limit": event_page_limit,
                "max_event_pages_per_series": max_event_pages_per_series,
                "max_events_per_topic_in_output": 100,
                "event_output_selection_order": "descending volume_24h_fp, then volume_fp (contract volume)",
                "max_markets_per_topic_in_output": 200,
                "market_output_selection_order": "descending volume_24h_fp, then volume_fp (contract volume)",
                "trade_sample_page_limit": TRADE_SAMPLE_PAGE_LIMIT,
                "trade_sample_max_pages": TRADE_SAMPLE_MAX_PAGES,
                "trade_sample_rows_returned": len(trades),
            },
            "source_urls": {
                "series": sorted({u for v in series_urls.values() for u in v}),
                "events": sorted(set(event_urls)),
                "trades": sorted(set(trade_urls)),
                "orderbook": [b["source"] for b in books.values()],
                "candlesticks": [c["source"] for c in candles.values() for c in c.values()],
            },
        },
        "topics": topic_payload,
        "orderbooks": books,
        "candles": candles,
    }

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, indent=1, sort_keys=False)
    print(f"wrote {args.out} ({os.path.getsize(args.out)} bytes, {client.calls} API calls)",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

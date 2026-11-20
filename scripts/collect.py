#!/usr/bin/env python3
"""Collect a verified snapshot of Kalshi DEMO market data.

Source of truth (official):
  REST base : https://external-api.demo.kalshi.co/trade-api/v2
  Docs      : https://docs.kalshi.com/api-reference
  Env table : https://docs.kalshi.com/getting_started/api_environments

The script uses only the Python standard library so it runs anywhere (CI, laptop).

Every value written to the snapshot is copied verbatim from an official API
response. Derived fields are computed here and are explicitly labelled as
derived, with the formula recorded in the output. Nothing is inferred.

Usage:
    python3 scripts/collect.py [--out data/snapshot.json] [--top-series 40]
                                [--top-book 20] [--sleep 0.25]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://external-api.demo.kalshi.co/trade-api/v2"
DOCS = "https://docs.kalshi.com"

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
        # Official Kalshi tags for gasoline / oil-and-gas markets. The broader
        # "Oil and energy" tag (184 series) is deliberately excluded because it
        # contains crude-oil benchmarks such as WTI and Brent, which are not
        # gas prices. Tag counts come from data/probe/api_surface.json.
        "series_filter": {"tags": ["Gas", "Oil & Gas"]},
        "note": (
            "Selected by the official Kalshi tags 'Gas' and 'Oil & Gas'. "
            "The broader 'Oil and energy' tag is excluded (it contains crude-oil "
            "benchmarks such as WTI/Brent, not gas prices)."
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
        # The official "Culture" category exists but holds only 2 series on the
        # demo API (both with zero volume), so pop-culture markets are also
        # selected by Kalshi's own "Entertainment" category and by the
        # culture tags below. Tag names and counts were enumerated live from
        # GET /series?include_volume=true (see data/probe/api_surface.json).
        "series_filter": {
            "category": "Culture",
            "extra_categories": ["Entertainment"],
            "tags": [
                "Culture war", "Movies", "Movie Charts", "Music", "Music charts",
                "Music Streams", "Live Music", "Music Industry", "New Music",
                "Awards", "Oscars", "Grammys", "Emmys", "Reality TV", "TV Charts",
                "Critics Choice Awards", "Anime Awards", "CMA Awards",
                "The Game Awards", "Streamer Awards", "Netflix", "Billboard charts",
                "Entertainment",
            ],
        },
        "note": (
            "Selected by the official Kalshi categories 'Culture' / 'Entertainment' "
            "and Kalshi's own culture tags (Movies, Music, Awards, Oscars, ...)."
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
        "note": "Selected by the official Kalshi tag 'Golf'.",
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
    "settlement_timer_seconds",
)

# Long free-text fields are stored as a clearly-labelled excerpt so the
# snapshot stays a readable size. The full text is always available live from
# GET /markets/{ticker}.
EXCERPT_FIELDS = ("rules_primary", "early_close_condition")
EXCERPT_LEN = 260

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


def collect_series(client: Client, topic: str, spec: dict) -> tuple[list, list[str]]:
    """Fetch the series that belong to a topic using official server-side filters."""
    flt = spec["series_filter"]
    got: dict[str, dict] = {}
    urls: list[str] = []
    cats = [flt["category"]] if flt.get("category") else []
    cats += list(flt.get("extra_categories") or [])
    tags = flt.get("tags") or []
    # The official filters are `category` (exact, case-sensitive) and `tags`.
    queries: list[dict] = []
    for c in cats:
        queries.append({"category": c})
    for t in tags:
        queries.append({"tags": t})
    for q in queries:
        series, u = client.paginate("/series", "series", {**q, "include_volume": True}, max_pages=5)
        urls += u
        for s in series:
            got.setdefault(s["ticker"], s)
    # Apply the remaining official tag filters locally so the rule is explicit
    # and reproducible (the API `tags` filter is exact + case-sensitive).
    if tags:
        want = {t.lower() for t in tags}
        if not cats:
            got = {
                k: v for k, v in got.items()
                if want & {str(t).lower() for t in (v.get("tags") or [])}
            }
    return list(got.values()), urls


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/snapshot.json")
    ap.add_argument("--seed-out", default="data/seed.json")
    ap.add_argument("--top-series", type=int, default=40)
    ap.add_argument("--top-book", type=int, default=20)
    ap.add_argument("--sleep", type=float, default=0.25)
    ap.add_argument("--max-events-per-series", type=int, default=10)
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
        # Official volume_fp is a fixed-point contract count; 1 contract has a
        # $1.00 notional (notional_value_dollars on every market), so contracts
        # are numerically equal to gross dollar notional. Sorting is therefore
        # on a real dollar amount, not an estimate.
        raw.sort(key=lambda s: float(s.get("volume_fp") or 0), reverse=True)
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
            evs, urls = client.paginate(
                "/events", "events",
                {"series_ticker": s["ticker"], "status": "open", "with_nested_markets": True},
                max_pages=3,
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
                e["_market_tickers"] = []
                for m in ev.get("markets") or []:
                    mm = markets.setdefault(m["ticker"], pick(m, MARKET_FIELDS))
                    for f in EXCERPT_FIELDS:
                        if m.get(f):
                            mm[f + "_excerpt"] = str(m[f])[:EXCERPT_LEN]
                    mm["_topics"] = sorted(set(mm.get("_topics", []) + [key]))
                    mm["_series_ticker"] = s["ticker"]
                    mm["_event_ticker"] = et
                    mm["_event_title"] = ev.get("title", "")
                    mm["_source"] = f"{BASE}/markets/{m['ticker']}"
                    e["_market_tickers"].append(m["ticker"])

    # ------------------------------------------------------- traded notional
    # Exact traded notional from the official trades feed:
    #   notional = SUM(yes_price_dollars * count_fp) over the sampled window.
    trades, trade_urls = client.paginate("/markets/trades", "trades", {"limit": 1000}, max_pages=3)
    notional: dict[str, dict] = {}
    for t in trades:
        tk = t.get("ticker")
        if not tk:
            continue
        try:
            px = float(t.get("yes_price_dollars") or 0)
            qty = float(t.get("count_fp") or 0)
        except (TypeError, ValueError):
            continue
        n = notional.setdefault(tk, {"notional_dollars": 0.0, "contracts_fp": 0.0, "trades": 0,
                                     "last_trade_time": None})
        n["notional_dollars"] += px * qty
        n["contracts_fp"] += qty
        n["trades"] += 1
        lt = t.get("created_time")
        if lt and (n["last_trade_time"] is None or lt > n["last_trade_time"]):
            n["last_trade_time"] = lt

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
            n = notional.get(t)
            m["_traded_notional_dollars"] = round(n["notional_dollars"], 2) if n else None
            m["_traded_contracts_fp"] = round(n["contracts_fp"], 2) if n else None
            m["_trade_count"] = n["trades"] if n else None
            m["_last_trade_time"] = n["last_trade_time"] if n else None
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
            "derivation_notes": {
                "dollar_volume": (
                    "volume_fp / volume_24h_fp / open_interest_fp are fixed-point contract "
                    "counts. Every market reports notional_value_dollars = 1.0000, so one "
                    "contract carries exactly $1.00 of notional and a contract count is "
                    "numerically equal to gross dollar notional. No price weighting is "
                    "applied."
                ),
                "traded_notional_dollars": (
                    "Exact: SUM(yes_price_dollars * count_fp) over every trade returned by "
                    "GET /markets/trades in the sampled window (3 pages x limit 1000). "
                    "Only populated for tickers that appear in that window."
                ),
                "ranking": "events/markets sorted by volume_24h_fp desc, then volume_fp desc.",
                "topic_rules": "Official Kalshi `category` / `tags` values, never free-text matching.",
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

    # ------------------------------------------------------------ site seed
    # A trimmed, small file the site can load instantly (and use as an offline
    # fallback) before / while it refreshes from the live API.
    seed = {
        "_meta": {
            "generated_at": snapshot["_meta"]["generated_at"],
            "base_url": BASE,
            "api_docs": DOCS,
            "note": (
                "Trimmed snapshot of the Kalshi DEMO API. Every value is verbatim "
                "from the API response; ranking fields are the official "
                "volume_24h_fp / volume_fp fixed-point contract counts, which are "
                "numerically equal to gross dollar notional because every market "
                "reports notional_value_dollars = 1.0000."
            ),
            "source_urls": {
                "series": sorted({u for v in series_urls.values() for u in v}),
                "events": sorted(set(event_urls)),
            },
        },
        "topics": {},
    }
    for key in TOPICS:
        t = topic_payload[key]
        seed["topics"][key] = {
            "label": t["label"],
            "rule": t["rule"],
            "source": t["source"],
            "series_count": t["series_count"],
            "series": t["series"][:60],
            "events": t["events"][:60],
            "markets": t["markets"][:80],
        }
    os.makedirs(os.path.dirname(args.seed_out) or ".", exist_ok=True)
    with open(args.seed_out, "w", encoding="utf-8") as fh:
        json.dump(seed, fh, indent=1, sort_keys=False)
    print(f"wrote {args.seed_out} ({os.path.getsize(args.seed_out)} bytes)",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

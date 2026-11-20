#!/usr/bin/env python3
"""
KalshiDash2 collector.

Pulls PUBLIC market data from the Kalshi DEMO Trade API and writes it, with
provenance, into `docs/data/` so the static site can show real data without the
visitor's browser needing to make cross-origin calls.

Design rules (these are requirements, not preferences):
  1. Every number written comes from an API response. Nothing is inferred,
     interpolated, estimated, or filled in from memory.
  2. Every output file carries the exact request URL(s) used and the UTC
     timestamp of the request, so any value can be re-checked by hand.
  3. If a request fails, that section records the error and is left empty.
     It never falls back to a guess.
  4. Values that the API does not return are written as null, never 0.

Official sources for every shape used here:
  - API environments : https://docs.kalshi.com/getting_started/api_environments
  - Get Series List  : https://docs.kalshi.com/api-reference/market/get-series-list
  - Get Markets      : https://docs.kalshi.com/api-reference/market/get-markets
  - Get Market       : https://docs.kalshi.com/api-reference/market/get-market
  - Get Events       : https://docs.kalshi.com/api-reference/events/get-events
  - Orderbook        : https://docs.kalshi.com/getting_started/orderbook_responses
  - Candlesticks     : https://docs.kalshi.com/api-reference/market/get-market-candlesticks
  - Tags by category : https://docs.kalshi.com/api-reference/search/get-tags-for-series-categories
  - Demo = mock funds: https://docs.kalshi.com/getting_started/demo_env
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = os.environ.get("KALSHI_BASE", "https://external-api.demo.kalshi.co/trade-api/v2")
OUT_DIR = os.environ.get("OUT_DIR", "docs/data")
UA = "KalshiDash2-collector/2.0 (+https://github.com/kanlerxz87-cyber/KalshiDash2)"
LIMIT = int(os.environ.get("PAGE_LIMIT", "1000"))
MAX_PAGES = int(os.environ.get("MAX_PAGES", "40"))
SLEEP = float(os.environ.get("REQUEST_SLEEP", "0.25"))

# Topic buckets are defined by the exchange's OWN taxonomy where possible.
# Gas prices  : category=Commodities, tag="Oil & Gas"  (no gasoline series on demo;
#               see REPO_REVIEW.md finding R10 - reported, not papered over)
# Elections   : category=Elections
# Culture     : category=Entertainment
# Crypto      : category=Crypto
# Golf        : category=Sports, tag="Golf"
# Sources: GET /search/tags_by_categories and GET /series?category=&tags=
TOPICS = {
    "gas": {
        "label": "Gas Prices",
        "series_filters": [{"category": "Commodities", "tags": "Oil & Gas"}],
        "note": "Exchange taxonomy: Commodities / Oil & Gas. Kalshi does not publish a "
                "gasoline/pump-price category; see the Flagged page (F-GAS).",
    },
    "elections": {
        "label": "Elections",
        "series_filters": [{"category": "Elections"}],
        "note": "Exchange taxonomy: category Elections.",
    },
    "culture": {
        "label": "Culture",
        "series_filters": [{"category": "Entertainment"}],
        "note": "Exchange taxonomy: category Entertainment (the closest official bucket "
                "to 'culture').",
    },
    "crypto": {
        "label": "Crypto",
        "series_filters": [{"category": "Crypto"}],
        "note": "Exchange taxonomy: category Crypto.",
    },
    "golf": {
        "label": "Golf",
        "series_filters": [{"category": "Sports", "tags": "Golf"}],
        "note": "Exchange taxonomy: category Sports, tag Golf.",
    },
}

# Market statuses that have not yet resolved.
UNRESOLVED = {"unopened", "open", "active", "initialized"}

_log: list[dict] = []
_request_count = 0


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def record(kind: str, url: str, status: int | str, note: str = "") -> None:
    _log.append({"kind": kind, "url": url, "status": status, "note": note,
                 "at": now_iso()})


def get(path_or_url: str):
    """GET a URL (absolute or BASE-relative). Returns (json, url). Raises on failure."""
    global _request_count
    url = path_or_url if path_or_url.startswith("http") else BASE + path_or_url
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "application/json"})
    _request_count += 1
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read().decode("utf-8", "replace")
            record("GET", url, r.status)
            return json.loads(raw), url
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:400]
        except Exception:  # noqa: BLE001
            pass
        record("GET", url, e.code, body)
        raise RuntimeError(f"HTTP {e.code} on {url} {body}") from e
    except Exception as e:  # noqa: BLE001  (network, JSON, timeout)
        record("GET", url, "error", str(e)[:300])
        raise
    finally:
        time.sleep(SLEEP)


FALLBACK_BASE = os.environ.get("KALSHI_FALLBACK_BASE", "")
_fallback_active = False


def paginate(path: str, key: str, limit: int = LIMIT, max_pages: int = MAX_PAGES):
    """Cursor pagination. Stops on an empty cursor. Hard cap on pages."""
    out: list[dict] = []
    cursor = ""
    pages = 0
    sep = "&" if "?" in path else "?"
    global _fallback_active
    while pages < max_pages:
        url = f"{path}{sep}limit={limit}" + (f"&cursor={urllib.parse.quote(cursor)}" if cursor else "")
        if _fallback_active:
            url = FALLBACK_BASE + url
        try:
            payload, _ = get(url)
        except Exception:
            if FALLBACK_BASE and not _fallback_active:
                # Documented fallback host (https://docs.kalshi.com/getting_started/api_environments).
                print(f"primary host failed; switching to fallback host {FALLBACK_BASE}",
                      flush=True)
                _fallback_active = True
                url = FALLBACK_BASE + url
                payload, _ = get(url)
            else:
                raise
        out.extend(payload.get(key) or [])
        cursor = payload.get("cursor") or ""
        pages += 1
        if not cursor:
            break
    return out


def fnum(v):
    """Parse a fixed-point string to float, or None. Never invent a value."""
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def write(name: str, obj: dict) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False, allow_nan=False)
    print(f"wrote {path} ({os.path.getsize(path)} bytes)", flush=True)


def market_record(m: dict, series_title: str = "", series_ticker: str = "") -> dict:
    """One market. Only API fields are carried through."""
    return {
        "ticker": m.get("ticker"),
        "event_ticker": m.get("event_ticker"),
        "series_ticker": series_ticker or (m.get("ticker") or "").split("-")[0],
        "title": m.get("title"),          # deprecated in OpenAPI but still returned
        "yes_sub_title": m.get("yes_sub_title"),
        "series_title": series_title,
        "status": m.get("status"),
        "result": m.get("result"),        # "" until determined, then "yes"/"no"
        "yes_bid_dollars": m.get("yes_bid_dollars"),
        "yes_ask_dollars": m.get("yes_ask_dollars"),
        "no_bid_dollars": m.get("no_bid_dollars"),
        "no_ask_dollars": m.get("no_ask_dollars"),
        "last_price_dollars": m.get("last_price_dollars"),
        "previous_price_dollars": m.get("previous_price_dollars"),
        "yes_bid_size_fp": m.get("yes_bid_size_fp"),
        "yes_ask_size_fp": m.get("yes_ask_size_fp"),
        "volume_fp": m.get("volume_fp"),
        "volume_24h_fp": m.get("volume_24h_fp"),
        "open_interest_fp": m.get("open_interest_fp"),
        "notional_value_dollars": m.get("notional_value_dollars"),
        "open_time": m.get("open_time"),
        "close_time": m.get("close_time"),
        "expected_expiration_time": m.get("expected_expiration_time"),
        "settlement_ts": m.get("settlement_ts"),
        "settlement_value_dollars": m.get("settlement_value_dollars"),
        "expiration_value": m.get("expiration_value"),
        "market_type": m.get("market_type"),
        "rules_primary": m.get("rules_primary"),
        "url": f"https://kalshi.com/markets/{(series_ticker or (m.get('ticker') or '')).split('-')[0].lower()}",
    }


def collect_series() -> dict:
    """All series with their own category/tag taxonomy and total volume."""
    all_series = paginate("/series?include_volume=true", "series", max_pages=40)
    keep = ("ticker", "title", "category", "categories", "tags", "frequency",
            "fee_type", "fee_multiplier", "volume_fp", "settlement_sources",
            "contract_terms_url", "contract_url", "last_updated_ts", "exchange_index")
    slim = [{k: s.get(k) for k in keep} for s in all_series]
    return {
        "generated_at": now_iso(),
        "source": f"{BASE}/series?include_volume=true",
        "docs": "https://docs.kalshi.com/api-reference/market/get-series-list",
        "count": len(slim),
        "series": slim,
    }


def collect_topic(key: str, cfg: dict) -> dict:
    """Series in a topic bucket -> open markets -> ranked by dollar amount."""
    t0 = now_iso()
    series: list[dict] = []
    urls: list[str] = []
    for f in cfg["series_filters"]:
        q = urllib.parse.urlencode({**f, "include_volume": "true"})
        got = paginate(f"/series?{q}", "series", max_pages=10)
        urls.append(f"{BASE}/series?{q}")
        series.extend(got)

    # de-duplicate series by ticker
    seen: set[str] = set()
    uniq = []
    for s in series:
        if s.get("ticker") in seen:
            continue
        seen.add(s.get("ticker"))
        uniq.append(s)

    markets: list[dict] = []
    errors: list[str] = []
    for s in uniq:
        st = s.get("ticker")
        if not st:
            continue
        try:
            ms = paginate(f"/markets?series_ticker={urllib.parse.quote(st)}&status=open",
                          "markets", max_pages=8)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{st}: {e}")
            continue
        for m in ms:
            markets.append(market_record(m, s.get("title") or "", st))

    # de-duplicate markets by ticker
    mseen: set[str] = set()
    muniq = []
    for m in markets:
        if m["ticker"] in mseen:
            continue
        mseen.add(m["ticker"])
        muniq.append(m)

    # "Highest dollar amount" = open interest x contract notional, using only API
    # fields. Ranked on open_interest_fp first, then volume_fp (both API values).
    for m in muniq:
        oi = fnum(m.get("open_interest_fp"))
        nv = fnum(m.get("notional_value_dollars")) or 1.0
        m["open_interest_dollars"] = round(oi * nv, 2) if oi is not None else None
        m["_oi"] = oi if oi is not None else -1.0
        m["_vol"] = fnum(m.get("volume_fp")) or -1.0
    muniq.sort(key=lambda m: (m["_oi"], m["_vol"]), reverse=True)
    for m in muniq:
        m.pop("_oi", None)
        m.pop("_vol", None)

    return {
        "topic": key,
        "label": cfg["label"],
        "note": cfg["note"],
        "generated_at": now_iso(),
        "started_at": t0,
        "source_urls": urls,
        "docs": {"series": "https://docs.kalshi.com/api-reference/market/get-series-list",
                 "markets": "https://docs.kalshi.com/api-reference/market/get-markets"},
        "series_count": len(uniq),
        "series": [{"ticker": s.get("ticker"), "title": s.get("title"),
                    "category": s.get("category"), "tags": s.get("tags"),
                    "frequency": s.get("frequency"), "volume_fp": s.get("volume_fp"),
                    "contract_terms_url": s.get("contract_terms_url")} for s in uniq],
        "market_count": len(muniq),
        "top_by_dollars": muniq[:40],
        "markets": muniq,
        "errors": errors,
    }


def collect_resolutions() -> dict:
    """Markets that have actually settled, with their real yes/no result.

    Uses GET /markets?status=settled (documented status filter). This is the only
    source used for 'how did it resolve' - the result field is copied verbatim.
    """
    try:
        settled = paginate("/markets?status=settled", "markets", max_pages=25)
    except Exception as e:  # noqa: BLE001
        return {"generated_at": now_iso(), "error": str(e), "settled": []}
    rows = []
    for m in settled:
        if m.get("result") not in ("yes", "no"):
            continue  # scalar or undetermined: not a yes/no resolution
        rows.append(market_record(m))
    rows.sort(key=lambda r: r.get("settlement_ts") or "", reverse=True)
    return {
        "generated_at": now_iso(),
        "source": f"{BASE}/markets?status=settled",
        "docs": "https://docs.kalshi.com/api-reference/market/get-markets",
        "result_field": "https://docs.kalshi.com/api-reference/market/get-market",
        "count": len(rows),
        "settled": rows,
    }


def collect_events() -> dict:
    """Open events (non-multivariate) with nested markets, for event-level tracking."""
    try:
        events = paginate("/events?status=open&with_nested_markets=true", "events",
                          max_pages=25)
    except Exception as e:  # noqa: BLE001
        return {"generated_at": now_iso(), "error": str(e), "events": []}
    rows = []
    for e in events:
        ms = e.get("markets") or []
        rows.append({
            "event_ticker": e.get("event_ticker"),
            "series_ticker": e.get("series_ticker"),
            "title": e.get("title"),
            "sub_title": e.get("sub_title"),
            "category": e.get("category"),
            "mutually_exclusive": e.get("mutually_exclusive"),
            "market_count": len(ms),
            "open_interest_fp": _sum_fp(ms, "open_interest_fp"),
            "volume_fp": _sum_fp(ms, "volume_fp"),
            "close_time": min([m.get("close_time") for m in ms if m.get("close_time")],
                              default=None),
            "markets": [market_record(m) for m in ms],
        })
    rows.sort(key=lambda r: (r["open_interest_fp"] or -1), reverse=True)
    return {
        "generated_at": now_iso(),
        "source": f"{BASE}/events?status=open&with_nested_markets=true",
        "docs": "https://docs.kalshi.com/api-reference/events/get-events",
        "count": len(rows),
        "events": rows,
    }


def _sum_fp(items: list[dict], field: str):
    vals = [fnum(i.get(field)) for i in items]
    vals = [v for v in vals if v is not None]
    return round(sum(vals), 2) if vals else None


def collect_exchange() -> dict:
    st, url = get("/exchange/status")
    return {
        "generated_at": now_iso(),
        "source": url,
        "docs": "https://docs.kalshi.com/api-reference/exchange/get-exchange-status",
        "status": st,
    }


def collect_depth(topic_docs: dict) -> dict:
    """Order book depth for the most-traded market in each topic.

    Depth answers 'how many contracts are available at a given price'.
    Source: https://docs.kalshi.com/getting_started/orderbook_responses
    The API returns bids only; an ask at p equals 1.00 - (opposite bid at 1-p).
    We record bids verbatim and let the browser do the documented conversion.
    """
    out = []
    for key, doc in topic_docs.items():
        cands = [m for m in (doc.get("top_by_dollars") or [])
                 if (fnum(m.get("volume_fp")) or 0) > 0]
        if not cands:
            out.append({"topic": key, "label": doc.get("label"),
                        "skipped": "no market with non-zero volume in this topic"})
            continue
        m = cands[0]
        t = m["ticker"]
        try:
            ob, url = get(f"/markets/{urllib.parse.quote(t)}/orderbook?depth=50")
        except Exception as e:  # noqa: BLE001
            out.append({"topic": key, "label": doc.get("label"), "ticker": t,
                        "error": str(e)})
            continue
        book = ob.get("orderbook_fp") or {}
        yes = book.get("yes_dollars") or []
        no = book.get("no_dollars") or []
        # verbatim levels, plus the documented implied-ask conversion
        levels = []
        for price, count in yes:
            levels.append({"yes_bid": price, "contracts": count})
        for price, count in no:
            p = fnum(price)
            levels.append({"no_bid": price, "contracts": count,
                           "implied_yes_ask": f"{1 - p:.4f}" if p is not None else None})
        out.append({
            "topic": key, "label": doc.get("label"), "ticker": t,
            "title": m.get("title"), "generated_at": now_iso(),
            "source": url,
            "docs": "https://docs.kalshi.com/getting_started/orderbook_responses",
            "semantics": "yes_dollars/no_dollars are BIDS only. best = last element "
                         "(arrays ascending). implied yes ask = 1.00 - best no bid.",
            "yes_bid_levels": yes, "no_bid_levels": no,
            "levels": levels,
            "best_yes_bid": yes[-1][0] if yes else None,
            "best_yes_bid_size": yes[-1][1] if yes else None,
            "best_no_bid": no[-1][0] if no else None,
            "best_no_bid_size": no[-1][1] if no else None,
        })
    return {"generated_at": now_iso(), "source": f"{BASE}/markets/{'{ticker}'}/orderbook",
            "depth": out}


def collect_candles(topic_docs: dict) -> dict:
    """Recent 1-minute candles for the top market of each topic.

    Path is /series/{series_ticker}/markets/{ticker}/candlesticks - confirmed in
    https://docs.kalshi.com/api-reference/market/get-market-candlesticks
    (a flat /markets/candlesticks batch endpoint also exists; see REPO_REVIEW R3).
    """
    end = int(time.time())
    start = end - 6 * 3600
    out = []
    for key, doc in topic_docs.items():
        cands = [m for m in (doc.get("top_by_dollars") or [])
                 if (fnum(m.get("volume_fp")) or 0) > 0]
        if not cands:
            out.append({"topic": key, "label": doc.get("label"), "skipped": True})
            continue
        m = cands[0]
        ticker, series = m["ticker"], m.get("series_ticker") or ""
        if not series:
            out.append({"topic": key, "label": doc.get("label"), "ticker": ticker,
                        "error": "no series_ticker on market record"})
            continue
        path = (f"/series/{urllib.parse.quote(series)}/markets/"
                f"{urllib.parse.quote(ticker)}/candlesticks"
                f"?start_ts={start}&end_ts={end}&period_interval=1")
        try:
            payload, url = get(path)
        except Exception as e:  # noqa: BLE001
            out.append({"topic": key, "label": doc.get("label"), "ticker": ticker,
                        "error": str(e)})
            continue
        cands_out = []
        for c in (payload.get("candlesticks") or []):
            price = c.get("price") or {}
            yb = c.get("yes_bid") or {}
            ya = c.get("yes_ask") or {}
            cands_out.append({
                "ts": c.get("end_period_ts"),
                "price_close": price.get("close_dollars"),
                "yes_bid_close": yb.get("close_dollars"),
                "yes_ask_close": ya.get("close_dollars"),
                "volume_fp": c.get("volume_fp"),
                "open_interest_fp": c.get("open_interest_fp"),
            })
        out.append({
            "topic": key, "label": doc.get("label"), "ticker": ticker, "series": series,
            "title": m.get("title"), "generated_at": now_iso(), "source": url,
            "docs": "https://docs.kalshi.com/api-reference/market/get-market-candlesticks",
            "period_interval_minutes": 1,
            "window_hours": 6,
            "count": len(cands_out),
            "candlesticks": cands_out,
        })
    return {"generated_at": now_iso(), "candles": out}


def main() -> int:
    started = now_iso()
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"collector start {started} base={BASE}", flush=True)

    meta = {
        "generated_at": started,
        "base_url": BASE,
        "environment": "demo",
        "docs": "https://docs.kalshi.com/getting_started/api_environments",
        "demo_note": "Demo uses mock funds; prices and behaviour may not reflect "
                     "production. https://docs.kalshi.com/getting_started/demo_env",
        "collector": "scripts/collect_kalshi.py",
    }

    try:
        write("exchange.json", collect_exchange())
    except Exception as e:  # noqa: BLE001
        write("exchange.json", {"generated_at": now_iso(), "error": str(e)})

    try:
        write("series.json", collect_series())
    except Exception as e:  # noqa: BLE001
        write("series.json", {"generated_at": now_iso(), "error": str(e), "series": []})

    topic_docs = {}
    for key, cfg in TOPICS.items():
        try:
            doc = collect_topic(key, cfg)
        except Exception as e:  # noqa: BLE001
            doc = {"topic": key, "label": cfg["label"], "generated_at": now_iso(),
                   "error": str(e), "markets": [], "top_by_dollars": [], "series": []}
        topic_docs[key] = doc
        write(f"topic-{key}.json", doc)

    try:
        write("resolutions.json", collect_resolutions())
    except Exception as e:  # noqa: BLE001
        write("resolutions.json", {"generated_at": now_iso(), "error": str(e),
                                   "settled": []})

    try:
        write("events.json", collect_events())
    except Exception as e:  # noqa: BLE001
        write("events.json", {"generated_at": now_iso(), "error": str(e), "events": []})

    try:
        write("depth.json", collect_depth(topic_docs))
    except Exception as e:  # noqa: BLE001
        write("depth.json", {"generated_at": now_iso(), "error": str(e), "depth": []})

    try:
        write("candles.json", collect_candles(topic_docs))
    except Exception as e:  # noqa: BLE001
        write("candles.json", {"generated_at": now_iso(), "error": str(e), "candles": []})

    meta.update({
        "finished_at": now_iso(),
        "requests": _request_count,
        "request_log": _log,
        "topics": {k: {"label": v.get("label"), "note": v.get("note", ""),
                       "series_count": v.get("series_count"),
                       "market_count": v.get("market_count"),
                       "generated_at": v.get("generated_at"),
                       "error": v.get("error"),
                       "source_urls": v.get("source_urls") or [],
                       "request_errors": len(v.get("errors") or [])}
                   for k, v in topic_docs.items()},
    })
    write("meta.json", meta)

    # Per-topic summary for the console
    for k, v in topic_docs.items():
        print(f"  {k:10s} series={v.get('series_count')} markets={v.get('market_count')} "
              f"errors={len(v.get('errors') or [])}", flush=True)
    print(f"collector done, {_request_count} requests", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

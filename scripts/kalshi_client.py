#!/usr/bin/env python3
"""Kalshi DEMO API client for KalshiDash2.

Every line of the signing/endpoint logic below was transcribed from the
official Kalshi docs and verified 2026-11-20:

- Environments (demo hosts, mock funds):
  https://docs.kalshi.com/getting_started/demo_env
- Auth (timestamp in milliseconds, message = timestamp + METHOD + full path
  from API root WITHOUT query string, RSA-PSS SHA-256 with salt length =
  digest length, or Ed25519 over the raw message; headers
  KALSHI-ACCESS-KEY / KALSHI-ACCESS-TIMESTAMP / KALSHI-ACCESS-SIGNATURE):
  https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
- Public market data needs no auth; orders use POST /portfolio/events/orders
  with body {ticker, side, count(str), price(dollars str), time_in_force,
  self_trade_prevention_type, client_order_id}; 201 + remaining_count:
  https://docs.kalshi.com/getting_started/quick_start_create_order
- Endpoints used: GET /markets, /markets/{t}, /markets/{t}/orderbook,
  /markets/candlesticks (batch), /portfolio/balance, /portfolio/positions,
  /portfolio/fills (https://docs.kalshi.com/api-reference/portfolio/get-fills)

This client is hard-locked to the DEMO host. It refuses to talk to production.
No keys are stored in this repo: pass --key-id and --private-key-file at runtime
(or set KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH).

Usage examples:
  python3 scripts/kalshi_client.py markets --status open --limit 5
  python3 scripts/kalshi_client.py market KXHIGHNY-26NOV20-74.5
  python3 scripts/kalshi_client.py orderbook KXHIGHNY-26NOV20-74.5
  python3 scripts/kalshi_client.py candlesticks KXHIGHNY-26NOV20-74.5 --minutes 60
  python3 scripts/kalshi_client.py balance --key-id ... --private-key-file key.pem
  python3 scripts/kalshi_client.py fills --key-id ... --private-key-file key.pem
  python3 scripts/kalshi_client.py place-order --ticker ... --side bid \
      --count 1 --price 0.50 --key-id ... --private-key-file key.pem \
      --confirm-demo-order
"""
import argparse
import base64
import csv
import datetime
import json
import math
import os
import re
import sys
import uuid
from urllib.parse import urlencode, urlparse

try:
    import requests
except ImportError:
    requests = None  # checked before making HTTP calls so offline tests can import helpers

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:
    serialization = None  # only needed for authenticated commands

DEMO_BASE = os.environ.get("KALSHI_DEMO_BASE", "https://external-api.demo.kalshi.co/trade-api/v2")
# Official demo REST Trade API hosts (https://docs.kalshi.com/getting_started/demo_env
# and https://docs.kalshi.com/getting_started/api_environments). Strict allowlist
# rather than a substring blocklist, so credentials and orders can never be sent
# to production or arbitrary hosts.
ALLOWED_DEMO_REST_HOSTS = frozenset({
    "external-api.demo.kalshi.co",
    "demo-api.kalshi.co",
})
FILL_CSV_COLUMNS = [
    "created_time",
    "ticker",
    "market_ticker",
    "outcome_side",
    "book_side",
    "count_fp",
    "yes_price_dollars",
    "no_price_dollars",
    "is_taker",
    "fee_cost",
]
_NUMERIC_CELL_RE = re.compile(r"^[+-]?\d+(?:\.\d+)?$")


def ensure_demo(base_url=None):
    target = (base_url if base_url is not None else DEMO_BASE).strip().rstrip("/")
    parsed = urlparse(target)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in ALLOWED_DEMO_REST_HOSTS
        or parsed.path != "/trade-api/v2"
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        sys.exit(
            f"Refusing to run against {target!r}: this client is locked to the official "
            "Kalshi DEMO REST roots (https://external-api.demo.kalshi.co/trade-api/v2 "
            "or https://demo-api.kalshi.co/trade-api/v2). Production and non-demo "
            "hosts are intentionally rejected."
        )
    return target


def _require_requests():
    if requests is None:
        sys.exit("This script needs the 'requests' package: pip install requests")


def load_private_key(path):
    if serialization is None:
        sys.exit("Authenticated commands need the 'cryptography' package: pip install cryptography")
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def sign_request(private_key, timestamp, method, path):
    """Exact algorithm from the official auth quick-start (see module docstring).
    Strips any query string; the signed path includes /trade-api/v2."""
    path_without_query = path.split("?")[0]
    message = f"{timestamp}{method}{path_without_query}".encode("utf-8")
    if isinstance(private_key, Ed25519PrivateKey):
        signature = private_key.sign(message)
    else:
        signature = private_key.sign(
            message,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()),
                        salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )
    return base64.b64encode(signature).decode("utf-8")


def auth_headers(private_key, key_id, method, path, base_url=None):
    base = ensure_demo(base_url)
    timestamp = str(int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000))  # milliseconds
    sign_path = urlparse(base + path).path  # full path from root, no query
    return {
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": sign_request(private_key, timestamp, method, sign_path),
    }


def get_public(path, params=None):
    _require_requests()
    base = ensure_demo()
    r = requests.get(base + path, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def get_auth(private_key, key_id, path, params=None):
    _require_requests()
    base = ensure_demo()
    qs = ("?" + urlencode(params)) if params else ""
    headers = auth_headers(private_key, key_id, "GET", path + qs, base_url=base)
    r = requests.get(base + path, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def post_auth(private_key, key_id, path, data):
    _require_requests()
    base = ensure_demo()
    headers = auth_headers(private_key, key_id, "POST", path, base_url=base)
    headers["Content-Type"] = "application/json"
    r = requests.post(base + path, headers=headers, json=data, timeout=30)
    if r.status_code != 201:
        sys.exit(f"Order not accepted: HTTP {r.status_code} {r.text}")
    return r.json()


def creds(args):
    key_id = args.key_id or os.environ.get("KALSHI_KEY_ID")
    key_path = args.private_key_file or os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if not key_id or not key_path:
        sys.exit("Authenticated command: pass --key-id and --private-key-file "
                 "(or set KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH). "
                 "Create demo keys at https://demo.kalshi.co (Account & security -> API Keys).")
    return key_id, load_private_key(key_path)


def sanitize_csv_cell(value):
    """Prevent spreadsheet formula injection while keeping numeric strings intact."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    text = str(value)
    if not text:
        return ""
    if text[0] in ("=", "+", "-", "@", "\t", "\r") and not _NUMERIC_CELL_RE.match(text):
        return "'" + text
    return text


def export_fills_csv(fills, out_path):
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FILL_CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for fill in fills:
            w.writerow({col: sanitize_csv_cell(fill.get(col, "")) for col in FILL_CSV_COLUMNS})


def build_v2_order(ticker, side, count, price, client_order_id=None):
    """Build and validate a CreateOrderV2Request body against the official schema:
    https://docs.kalshi.com/api-reference/orders/create-order-v2
    https://docs.kalshi.com/getting_started/fixed_point_migration
    """
    clean_ticker = (ticker or "").strip()
    if not clean_ticker:
        raise ValueError("ticker must be a non-empty string")
    if side not in ("bid", "ask"):
        raise ValueError("side must be 'bid' (buy YES) or 'ask' (sell YES / buy NO)")
    if isinstance(count, bool) or not isinstance(count, (int, float)) or not math.isfinite(count) or count < 0.01:
        raise ValueError("count must be at least 0.01 contracts")
    hundredths = round(count * 100)
    if abs(hundredths - count * 100) > 1e-6:
        raise ValueError("count supports at most 2 decimal places (0.01 contract granularity)")
    if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or not (0 < price < 1):
        raise ValueError("price must be in dollars strictly between 0.0000 and 1.0000 (e.g. 0.50)")
    return {
        "ticker": clean_ticker,
        "side": side,
        "count": f"{hundredths / 100:.2f}",
        "price": f"{price:.4f}",
        "time_in_force": "good_till_canceled",
        "self_trade_prevention_type": "taker_at_cross",
        "client_order_id": client_order_id or str(uuid.uuid4()),
    }


def _warn_if_truncated(payload, noun):
    if isinstance(payload, dict) and payload.get("cursor"):
        print(
            f"# truncated: {noun} response returned a non-empty cursor; "
            "additional pages exist beyond --limit "
            "(https://docs.kalshi.com/getting_started/pagination)",
            file=sys.stderr,
        )


def cmd_markets(args):
    params = {"status": args.status, "limit": args.limit}
    if args.series_ticker:
        params["series_ticker"] = args.series_ticker
    params = {k: v for k, v in params.items() if v is not None}
    out = get_public("/markets", params)
    _warn_if_truncated(out, "markets")
    print(json.dumps(out.get("markets", []), indent=2))


def cmd_market(args):
    print(json.dumps(get_public(f"/markets/{args.ticker}"), indent=2))


def cmd_orderbook(args):
    print(json.dumps(get_public(f"/markets/{args.ticker}/orderbook"), indent=2))


def cmd_candlesticks(args):
    end = int(datetime.datetime.now(datetime.timezone.utc).timestamp())
    start = end - args.window_seconds
    params = {"market_tickers": args.ticker, "start_ts": start, "end_ts": end,
              "period_interval": args.minutes}
    print(json.dumps(get_public("/markets/candlesticks", params), indent=2))


def cmd_balance(args):
    key_id, pk = creds(args)
    print(json.dumps(get_auth(pk, key_id, "/portfolio/balance"), indent=2))


def cmd_positions(args):
    key_id, pk = creds(args)
    out = get_auth(pk, key_id, "/portfolio/positions", {"limit": args.limit})
    _warn_if_truncated(out, "positions")
    print(json.dumps(out, indent=2))


def cmd_fills(args):
    key_id, pk = creds(args)
    out = get_auth(pk, key_id, "/portfolio/fills", {"limit": args.limit})
    _warn_if_truncated(out, "fills")
    fills = out.get("fills", [])
    print(json.dumps(fills, indent=2))
    if args.export_csv:
        export_fills_csv(fills, args.export_csv)
        print(f"# wrote {args.export_csv}", file=sys.stderr)


def cmd_place_order(args):
    if not args.confirm_demo_order:
        sys.exit("Refusing to place an order without --confirm-demo-order. "
                 "This trades DEMO (mock) funds on https://demo.kalshi.co only.")
    try:
        order = build_v2_order(args.ticker, args.side, args.count, args.price)
    except ValueError as exc:
        sys.exit(f"Invalid order parameters: {exc}")
    key_id, pk = creds(args)
    result = post_auth(pk, key_id, "/portfolio/events/orders", order)
    print(json.dumps(result, indent=2))
    print("# 201 = accepted, not filled: check remaining_count "
          "(https://docs.kalshi.com/getting_started/quick_start_create_order)", file=sys.stderr)


def main():
    ensure_demo()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("markets"); s.add_argument("--status", default="open"); s.add_argument("--limit", type=int, default=10)
    s.add_argument("--series-ticker"); s.set_defaults(fn=cmd_markets)
    s = sub.add_parser("market"); s.add_argument("ticker"); s.set_defaults(fn=cmd_market)
    s = sub.add_parser("orderbook"); s.add_argument("ticker"); s.set_defaults(fn=cmd_orderbook)
    s = sub.add_parser("candlesticks"); s.add_argument("ticker"); s.add_argument("--minutes", type=int, default=60)
    s.add_argument("--window-seconds", type=int, default=86400); s.set_defaults(fn=cmd_candlesticks)
    for name, fn, extra in (("balance", cmd_balance, None), ("positions", cmd_positions, "limit"),
                            ("fills", cmd_fills, "limit")):
        s = sub.add_parser(name)
        if extra: s.add_argument("--" + extra, type=int, default=100)
        if name == "fills": s.add_argument("--export-csv")
        s.set_defaults(fn=fn)
    s = sub.add_parser("place-order")
    s.add_argument("--ticker", required=True); s.add_argument("--side", choices=["bid", "ask"], required=True)
    s.add_argument("--count", type=float, required=True); s.add_argument("--price", type=float, required=True)
    s.add_argument("--confirm-demo-order", action="store_true")
    s.set_defaults(fn=cmd_place_order)

    for sp in sub.choices.values():
        sp.add_argument("--key-id"); sp.add_argument("--private-key-file")

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

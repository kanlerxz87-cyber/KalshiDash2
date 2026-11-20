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
import datetime
import json
import os
import sys
import uuid
from urllib.parse import urlparse

try:
    import requests
except ImportError:
    sys.exit("This script needs the 'requests' package: pip install requests")

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:
    serialization = None  # only needed for authenticated commands

DEMO_BASE = os.environ.get("KALSHI_DEMO_BASE", "https://external-api.demo.kalshi.co/trade-api/v2")
PRODUCTION_MARKERS = ("external-api.kalshi.com", "api.elections.kalshi.com", "kalshi.com/trade-api")


def ensure_demo():
    if any(m in DEMO_BASE for m in PRODUCTION_MARKERS):
        sys.exit("Refusing to run: this client is demo-only (mock funds). "
                 "Production hosts are intentionally not supported.")


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


def auth_headers(private_key, key_id, method, path):
    timestamp = str(int(datetime.datetime.now().timestamp() * 1000))  # milliseconds
    sign_path = urlparse(DEMO_BASE + path).path  # full path from root, no query
    return {
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": sign_request(private_key, timestamp, method, sign_path),
    }


def get_public(path, params=None):
    r = requests.get(DEMO_BASE + path, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def get_auth(private_key, key_id, path, params=None):
    qs = ("?" + "&".join(f"{k}={v}" for k, v in (params or {}).items())) if params else ""
    headers = auth_headers(private_key, key_id, "GET", path + qs)
    r = requests.get(DEMO_BASE + path, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def post_auth(private_key, key_id, path, data):
    headers = auth_headers(private_key, key_id, "POST", path)
    headers["Content-Type"] = "application/json"
    r = requests.post(DEMO_BASE + path, headers=headers, json=data, timeout=30)
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


def cmd_markets(args):
    params = {"status": args.status, "limit": args.limit}
    if args.series_ticker:
        params["series_ticker"] = args.series_ticker
    params = {k: v for k, v in params.items() if v is not None}
    out = get_public("/markets", params)
    print(json.dumps(out.get("markets", []), indent=2))


def cmd_market(args):
    print(json.dumps(get_public(f"/markets/{args.ticker}"), indent=2))


def cmd_orderbook(args):
    print(json.dumps(get_public(f"/markets/{args.ticker}/orderbook"), indent=2))


def cmd_candlesticks(args):
    end = int(datetime.datetime.now().timestamp())
    start = end - args.window_seconds
    params = {"market_tickers": args.ticker, "start_ts": start, "end_ts": end,
              "period_interval": args.minutes}
    print(json.dumps(get_public("/markets/candlesticks", params), indent=2))


def cmd_balance(args):
    key_id, pk = creds(args)
    print(json.dumps(get_auth(pk, key_id, "/portfolio/balance"), indent=2))


def cmd_positions(args):
    key_id, pk = creds(args)
    print(json.dumps(get_auth(pk, key_id, "/portfolio/positions", {"limit": args.limit}), indent=2))


def cmd_fills(args):
    key_id, pk = creds(args)
    out = get_auth(pk, key_id, "/portfolio/fills", {"limit": args.limit})
    print(json.dumps(out.get("fills", []), indent=2))
    if args.export_csv:
        import csv
        cols = ["created_time", "ticker", "market_ticker", "outcome_side", "book_side",
                "count_fp", "yes_price_dollars", "fee_cost"]
        with open(args.export_csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            for fill in out.get("fills", []):
                w.writerow(fill)
        print(f"# wrote {args.export_csv}", file=sys.stderr)


def cmd_place_order(args):
    if not args.confirm_demo_order:
        sys.exit("Refusing to place an order without --confirm-demo-order. "
                 "This trades DEMO (mock) funds on https://demo.kalshi.co only.")
    key_id, pk = creds(args)
    order = {
        "ticker": args.ticker,
        "side": args.side,
        "count": str(args.count),
        "price": f"{args.price:.4f}",
        "time_in_force": "good_till_canceled",
        "self_trade_prevention_type": "taker_at_cross",
        "client_order_id": str(uuid.uuid4()),
    }
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
    s.add_argument("--count", type=int, required=True); s.add_argument("--price", type=float, required=True)
    s.add_argument("--confirm-demo-order", action="store_true")
    s.set_defaults(fn=cmd_place_order)

    for sp in sub.choices.values():
        sp.add_argument("--key-id"); sp.add_argument("--private-key-file")

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

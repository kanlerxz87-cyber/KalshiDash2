#!/usr/bin/env python3
"""Kalshi DEMO WebSocket ticker client for KalshiDash2.

This is the server-side half of the site's live feed. It exists because the
Kalshi WebSocket handshake requires authentication headers, and a browser's
`WebSocket` constructor cannot set custom headers. A browser-only page therefore
cannot open a Kalshi socket directly; a process that CAN set headers has to do
it and relay the messages onward.

Every rule below was transcribed from the official Kalshi documentation and
verified 2026-11-21:

- Connection URL (demo):
  https://docs.kalshi.com/getting_started/quick_start_websockets
    "For the demo environment, use:
     wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
  The shared host wss://demo-api.kalshi.co/trade-api/ws/v2 remains supported and
  is available here as --ws-url.

- Authentication (same page):
    "WebSocket connections require authentication during the connection
     handshake."  Headers:
        KALSHI-ACCESS-KEY, KALSHI-ACCESS-SIGNATURE, KALSHI-ACCESS-TIMESTAMP
  Pre-sign text:
        timestamp + "GET" + "/trade-api/ws/v2"
  (the WebSocket path itself, NOT the REST /trade-api/v2 prefix, and with no
  query string).

- Subscribing:
    {"id": 1, "cmd": "subscribe",
     "params": {"channels": ["ticker"], "market_tickers": [...]}}
  (https://docs.kalshi.com/websockets/websocket-connection)

- The `ticker` channel payload (https://docs.kalshi.com/websockets/market-ticker):
    {"type": "ticker", "sid": N, "msg": {
       "market_ticker": "...", "price_dollars": "0.4800",
       "yes_bid_dollars": "0.4500", "yes_ask_dollars": "0.5300",
       "volume_fp": "...", "open_interest_fp": "...",
       "yes_bid_size_fp": "...", "yes_ask_size_fp": "...",
       "last_trade_size_fp": "...", "dollar_volume": N,
       "dollar_open_interest": N, "ts": N, "ts_ms": N, "time": "..."}}
  "Changes are combined and sent on a flush scheduled every second: each flush
   sends one message per changed market, carrying its current values."

- Disconnects (same page / https://docs.kalshi.com/asyncapi.yaml):
  "The server can close the connection at any time. Subscriptions and `sid`
   values do not carry over, so subscribe again after reconnecting."
  Reconnect with exponential backoff. Close code 1008 means the client was too
  slow to read; 1000 is a normal closure.

- Error codes (https://docs.kalshi.com/asyncapi.yaml):
    9  = authentication required / channel not entitled
    13 = unsupported action (e.g. changing a subscription that has no market
         filter)
    14 = market ticker required
    25 = subscription buffer overflow (terminal for that subscription)

This client is hard-locked to the DEMO host. It refuses to talk to production.
No keys are stored in this repo: pass --key-id and --private-key-file at
runtime (or set KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH).

Usage:
  # Stream every ticker (no market filter) and print JSON lines:
  python3 scripts/kalshi_ws.py --key-id ... --private-key-file key.pem

  # Stream a fixed set of markets:
  python3 scripts/kalshi_ws.py --ticker KXHIGHNY-26NOV20-T74.5 --ticker ...

  # Stream the markets named in a file (one ticker per line):
  python3 scripts/kalshi_ws.py --ticker-file tickers.txt
"""
import argparse
import base64
import datetime
import json
import os
import random
import ssl
import sys
import time

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
except ImportError:
    serialization = None  # only needed for authenticated commands

DEFAULT_WS_URL = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
# The WebSocket path that must be signed. From the official docs:
#   "Create the message to sign: timestamp + "GET" + "/trade-api/ws/v2""
WS_SIGN_PATH = "/trade-api/ws/v2"

PRODUCTION_MARKERS = (
    "external-api-ws.kalshi.com",
    "api.elections.kalshi.com",
    "kalshi.com/trade-api",
)


def ensure_demo(url):
    if any(m in url for m in PRODUCTION_MARKERS):
        sys.exit("Refusing to run: this client is demo-only (mock funds). "
                 "Production WebSocket hosts are intentionally not supported.")


def load_private_key(path):
    if serialization is None:
        sys.exit("Authenticated commands need the 'cryptography' package: "
                 "pip install cryptography")
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def sign_ws_request(private_key, timestamp, method, path):
    """Same signing algorithm as REST, applied to the WebSocket path.

    From https://docs.kalshi.com/getting_started/quick_start_websockets:
      "Create the message to sign: timestamp + "GET" + "/trade-api/ws/v2""
    Ed25519 signs the raw message; RSA uses RSA-PSS with SHA-256, MGF1-SHA256
    and a salt length equal to the digest length.
    """
    path_without_query = path.split("?")[0]
    message = f"{timestamp}{method}{path_without_query}".encode("utf-8")
    if isinstance(private_key, Ed25519PrivateKey):
        signature = private_key.sign(message)
    else:
        signature = private_key.sign(
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()),
                        salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
            message,
        )
    return base64.b64encode(signature).decode("utf-8")


def ws_auth_headers(private_key, key_id, url):
    """Build the three handshake headers for the WebSocket URL.

    The signed path is the URL's own path (the WebSocket path), with no query
    string — not the REST /trade-api/v2 prefix.
    """
    timestamp = str(int(datetime.datetime.now().timestamp() * 1000))  # milliseconds
    from urllib.parse import urlparse
    path = urlparse(url).path or WS_SIGN_PATH
    return {
        "KALSHI-ACCESS-KEY": key_id,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
        "KALSHI-ACCESS-SIGNATURE": sign_ws_request(private_key, timestamp, "GET", path),
    }


def subscribe_command(cmd_id, channels, market_tickers=None):
    """Build the documented `subscribe` command.

    https://docs.kalshi.com/websockets/websocket-connection
      {"id": 1, "cmd": "subscribe",
       "params": {"channels": ["ticker"], "market_tickers": [...]}}

    The `ticker` channel's market filter is optional. Omitting it subscribes to
    every market except those whose ticker starts with KXRFQ.
    """
    params = {"channels": list(channels)}
    if market_tickers:
        params["market_tickers"] = list(market_tickers)
    return {"id": cmd_id, "cmd": "subscribe", "params": params}


def handle_message(raw, out=sys.stdout):
    """Turn one socket frame into a normalized record, or None to ignore it.

    Only the documented `ticker` payload fields are read; nothing is inferred.
    A missing field stays missing (null) rather than becoming a number.
    """
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    mtype = data.get("type")
    if mtype == "ticker":
        m = data.get("msg") or {}
        return {
            "type": "ticker",
            "market_ticker": m.get("market_ticker"),
            "price_dollars": m.get("price_dollars"),
            "yes_bid_dollars": m.get("yes_bid_dollars"),
            "yes_ask_dollars": m.get("yes_ask_dollars"),
            "volume_fp": m.get("volume_fp"),
            "open_interest_fp": m.get("open_interest_fp"),
            "yes_bid_size_fp": m.get("yes_bid_size_fp"),
            "yes_ask_size_fp": m.get("yes_ask_size_fp"),
            "last_trade_size_fp": m.get("last_trade_size_fp"),
            "dollar_volume": m.get("dollar_volume"),
            "dollar_open_interest": m.get("dollar_open_interest"),
            "ts": m.get("ts"),
            "ts_ms": m.get("ts_ms"),
            "time": m.get("time"),
            "sid": data.get("sid"),
            "received_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
    if mtype in ("subscribed", "unsubscribed", "ok", "error"):
        return {"type": mtype, "raw": data}
    return None


def normalize_error(data):
    """Extract a readable message from a documented `error` frame."""
    msg = data.get("msg") or {}
    code = msg.get("code")
    text = msg.get("msg") or msg.get("message") or ""
    return code, text


async def run(args, key_id, private_key):
    # Imported here so the pure helpers above (subscribe_command,
    # handle_message, normalize_error) stay importable without the package.
    import websockets

    url = args.ws_url
    ensure_demo(url)

    headers = ws_auth_headers(private_key, key_id, url)
    market_tickers = list(args.ticker or [])
    if args.ticker_file:
        with open(args.ticker_file, "r", encoding="utf-8") as f:
            for line in f:
                t = line.strip()
                if t and not t.startswith("#"):
                    market_tickers.append(t)

    backoff = 1.0
    attempt = 0
    cmd_id = 1
    ssl_ctx = ssl.create_default_context()

    while True:
        try:
            async with websockets.connect(
                url,
                additional_headers=headers,
                ssl=ssl_ctx,
                ping_interval=20,
                ping_timeout=20,
                max_size=2 ** 20,
            ) as ws:
                attempt = 0
                backoff = 1.0
                print(json.dumps({"type": "connected", "url": url,
                                  "tickers": len(market_tickers)}), flush=True)
                cmd = subscribe_command(cmd_id, ["ticker"], market_tickers or None)
                cmd_id += 1
                await ws.send(json.dumps(cmd))

                async for raw in ws:
                    rec = handle_message(raw)
                    if rec is None:
                        continue
                    if rec.get("type") == "error":
                        code, text = normalize_error(rec["raw"])
                        print(json.dumps({"type": "error", "code": code, "msg": text}),
                              flush=True)
                        # Code 9 = not entitled / auth rejected. Retrying will not
                        # help until the key changes, so stop rather than spin.
                        if code == 9:
                            sys.exit(f"WebSocket rejected the key (error code 9): {text}")
                        continue
                    print(json.dumps(rec), flush=True)
                    if args.max_messages and args.max_messages <= 0:
                        return
        except websockets.exceptions.ConnectionClosed as e:
            print(json.dumps({"type": "closed", "code": e.code, "reason": e.reason}),
                  flush=True)
        except Exception as e:  # noqa: BLE001 - report and retry with backoff
            print(json.dumps({"type": "error", "msg": f"{type(e).__name__}: {e}"}),
                  flush=True)

        attempt += 1
        # Exponential backoff with jitter, capped, as the docs recommend.
        delay = min(backoff, 60.0) + random.uniform(0, 0.25)
        time.sleep(delay)
        backoff = min(backoff * 2, 60.0)


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    p.add_argument("--ws-url", default=os.environ.get("KALSHI_WS_URL", DEFAULT_WS_URL))
    p.add_argument("--key-id", default=os.environ.get("KALSHI_KEY_ID"))
    p.add_argument("--private-key-file", default=os.environ.get("KALSHI_PRIVATE_KEY_PATH"))
    p.add_argument("--ticker", action="append", default=[],
                   help="market ticker to subscribe to (repeatable)")
    p.add_argument("--ticker-file", default=os.environ.get("KALSHI_TICKER_FILE"),
                   help="file with one market ticker per line")
    p.add_argument("--max-messages", type=int, default=0,
                   help="stop after this many ticker messages (0 = run forever)")
    args = p.parse_args()

    if not args.key_id or not args.private_key_file:
        sys.exit("Pass --key-id and --private-key-file (or set KALSHI_KEY_ID / "
                 "KALSHI_PRIVATE_KEY_PATH). Create demo keys at "
                 "https://demo.kalshi.co (Account & security -> API Keys). "
                 "No key is stored in this repository.")
    if args.max_messages:
        # Count only ticker frames.
        global _COUNTER
        _COUNTER = args.max_messages

    ensure_demo(args.ws_url)
    key_id = args.key_id.strip()
    private_key = load_private_key(args.private_key_file)

    try:
        import asyncio
        asyncio.run(run(args, key_id, private_key))
    except KeyboardInterrupt:
        print(json.dumps({"type": "stopped"}), flush=True)


_COUNTER = 0


if __name__ == "__main__":
    main()

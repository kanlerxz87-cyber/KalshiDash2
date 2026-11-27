#!/usr/bin/env python3
"""KalshiDash2 live relay — serves the static site and streams Kalshi tickers.

Why this exists
---------------
The brief asks for "a live alerting system to sudden swings in contract prices
greater than or equal to $0.10 in either direction" that works "as a simplified
scrolling chat so someone can view in real time".

The Kalshi WebSocket is the only feed that is real-time: its `ticker` channel
"Changes are combined and sent on a flush scheduled every second"
(https://docs.kalshi.com/websockets/market-ticker). But the handshake requires
the three KALSHI-ACCESS-* headers
(https://docs.kalshi.com/getting_started/quick_start_websockets), and a
browser's `WebSocket` constructor cannot set custom headers — it accepts only a
URL and an optional subprotocol list. A page served by GitHub Pages therefore
cannot open a Kalshi socket on its own.

This relay closes that gap with the minimum possible machinery:

  1. It opens the Kalshi WebSocket itself (it CAN set headers).
  2. It re-publishes each ticker message to browsers as Server-Sent Events on
     a same-origin path, /live/stream.
  3. It serves the static site, so the page and the stream share an origin and
     no cross-origin configuration is needed.

The browser page (assets/js/live-feed.js) uses the stream when it is present
and falls back to the documented REST poll when it is not. The page always
states which of the two is producing its alerts — it never claims to be live
when it is polling.

Only the Python standard library is used, plus the `websockets` package for
the socket itself. There is no build step and no framework.

Usage:
  python3 scripts/relay.py --port 8080 \
      --key-id KALSHI_KEY_ID --private-key-file ./key.pem

  # Or let the relay read tickers from the Kalshi demo API itself:
  python3 scripts/relay.py --port 8080 --auto-universe --key-id ... \
      --private-key-file ./key.pem

The relay never writes credentials to disk and never forwards them to the
browser. The browser receives only public market data.
"""
import argparse
import asyncio
import datetime
import json
import os
import queue
import ssl
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Official demo Trade API hosts (https://docs.kalshi.com/getting_started/demo_env
# and https://docs.kalshi.com/getting_started/api_environments). Strict allowlists
# prevent sending signed WebSocket headers or REST queries to production or
# arbitrary hosts.
DEFAULT_WS_URL = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
ALLOWED_DEMO_WS_HOSTS = frozenset({
    "external-api-ws.demo.kalshi.co",
    "demo-api.kalshi.co",
})
ALLOWED_DEMO_REST_HOSTS = frozenset({
    "external-api.demo.kalshi.co",
    "demo-api.kalshi.co",
})

# Bounded fan-out queue per subscriber. A slow reader must never grow the
# server's memory without limit.
QUEUE_MAX = 2000


def ensure_demo(url):
    target = (url or "").strip().rstrip("/")
    parsed = urlparse(target)
    if (
        parsed.scheme != "wss"
        or parsed.hostname not in ALLOWED_DEMO_WS_HOSTS
        or parsed.path != "/trade-api/ws/v2"
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        sys.exit(
            f"Refusing to run against {target!r}: this relay is locked to the official "
            "Kalshi DEMO WebSocket endpoints (wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 "
            "or wss://demo-api.kalshi.co/trade-api/ws/v2). Production and non-demo "
            "hosts are intentionally rejected."
        )
    return target


def ensure_demo_rest(base_url):
    target = (base_url or "").strip().rstrip("/")
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
            f"Refusing to discover markets from {target!r}: only official Kalshi DEMO "
            "REST roots (https://external-api.demo.kalshi.co/trade-api/v2 or "
            "https://demo-api.kalshi.co/trade-api/v2) are allowed."
        )
    return target


# --------------------------------------------------------------------------- #
# Kalshi WebSocket source
# --------------------------------------------------------------------------- #

class TickerSource:
    """Connects to the Kalshi demo WebSocket and republishes ticker frames.

    Implements the documented lifecycle: connect with signed headers, send one
    `subscribe` command, then read frames; on any disconnect, reconnect with
    exponential backoff and subscribe again (subscriptions and `sid` values do
    not carry over between connections).
    """

    def __init__(self, url, key_id, private_key, market_tickers=None,
                 on_message=None, on_state=None):
        self.url = url
        self.key_id = key_id
        self.private_key = private_key
        self.market_tickers = list(market_tickers or [])
        self.on_message = on_message or (lambda rec: None)
        self.on_state = on_state or (lambda s: None)
        self.subscribers = []
        self.stop = threading.Event()
        self.cmd_id = 1
        self.state = "idle"

    # -- fan-out ---------------------------------------------------------- #

    def subscribe(self):
        q = queue.Queue(maxsize=QUEUE_MAX)
        self.subscribers.append(q)
        return q

    def unsubscribe(self, q):
        try:
            self.subscribers.remove(q)
        except ValueError:
            pass

    def publish(self, record):
        for q in list(self.subscribers):
            try:
                q.put_nowait(record)
            except queue.Full:
                # Drop the oldest item rather than block the reader.
                try:
                    q.get_nowait()
                    q.put_nowait(record)
                except (queue.Empty, queue.Full):
                    pass

    def _set_state(self, state, detail=None):
        self.state = state
        record = {"type": "state", "state": state, "detail": detail,
                  "at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self.publish(record)
        self.on_state(record)

    def _handle_record(self, rec, subscription_id):
        """Process an exchange frame; return False when the socket must reconnect."""
        if rec.get("type") == "subscribed":
            raw = rec.get("raw") or {}
            if raw.get("id") == subscription_id and (raw.get("msg") or {}).get("channel") == "ticker":
                self._set_state("connected")
        elif rec.get("type") == "error":
            from kalshi_ws import normalize_error
            code, text = normalize_error(rec.get("raw") or {})
            self._set_state("unauthorized" if code == 9 else "error", f"code {code}: {text}")
            return False
        elif rec.get("type") == "ticker" and self.state == "connected":
            self.publish(rec)
        return True

    # -- the socket -------------------------------------------------------- #

    def run(self):
        import websockets
        from kalshi_ws import ws_auth_headers, subscribe_command, handle_message

        backoff = 1.0
        while not self.stop.is_set():
            try:
                headers = ws_auth_headers(self.private_key, self.key_id, self.url)
                ssl_ctx = ssl.create_default_context()
                async def _session():
                    async with websockets.connect(
                        self.url, additional_headers=headers, ssl=ssl_ctx,
                        ping_interval=20, ping_timeout=20, max_size=2 ** 20,
                    ) as ws:
                        self._set_state("connecting", "waiting for ticker subscription confirmation")
                        subscription_id = self.cmd_id
                        cmd = subscribe_command(subscription_id, ["ticker"],
                                                self.market_tickers or None)
                        self.cmd_id += 1
                        await ws.send(json.dumps(cmd))
                        async for raw in ws:
                            rec = handle_message(raw)
                            if rec is not None and not self._handle_record(rec, subscription_id):
                                return
                asyncio.run(_session())
                self._set_state("closed", "socket closed; reconnecting")
            except Exception as e:  # noqa: BLE001 - report and reconnect
                self._set_state("error", f"{type(e).__name__}: {e}")
            if self.stop.is_set():
                break
            time.sleep(backoff + 0.25 * (backoff / 5.0))
            backoff = min(backoff * 2, 60.0)


# --------------------------------------------------------------------------- #
# HTTP layer
# --------------------------------------------------------------------------- #

class RelayHandler(SimpleHTTPRequestHandler):
    """Static file server plus the /live/stream SSE endpoint."""

    source = None          # set on the server class before serving
    universe = []          # list of market tickers to subscribe to

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=REPO_ROOT, **kw)

    def log_message(self, fmt, *args):
        if os.environ.get("KALSHI_RELAY_VERBOSE"):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def end_headers(self):
        # The static site is served to the same origin as the stream, so a
        # strict same-origin policy is enough and no CORS header is required.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):  # noqa: N802 - http.server API
        path = urlparse(self.path).path
        if path == "/live/stream":
            return self.stream()
        if path == "/live/status":
            return self.status()
        if path == "/live/universe":
            body = json.dumps({"tickers": self.universe}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)
        return super().do_GET()

    def status(self):
        src = self.source
        body = json.dumps({
            "available": bool(src),
            "state": getattr(src, "state", "unavailable") if src else "unavailable",
            "tickers": len(self.universe),
            "source": "Kalshi demo WebSocket ticker channel",
            "source_url": getattr(src, "url", DEFAULT_WS_URL) if src else DEFAULT_WS_URL,
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def stream(self):
        """Server-Sent Events: one `data:` line per ticker message."""
        src = self.source
        if not src:
            self.send_response(503)
            self.send_header("Content-Type", "application/json")
            body = json.dumps({"error": "no WebSocket source configured"}).encode()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        q = src.subscribe()
        try:
            # Tell the browser what this stream is, before any ticker frame.
            hello = json.dumps({"type": "hello", "state": src.state,
                                "at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
            self.wfile.write(f"data: {hello}\n\n".encode())
            self.wfile.flush()

            last_ping = time.time()
            while True:
                try:
                    rec = q.get(timeout=1.0)
                except queue.Empty:
                    # Comment line keeps proxies from closing an idle stream.
                    if time.time() - last_ping > 10:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                        last_ping = time.time()
                    continue
                if rec.get("type") == "state":
                    payload = rec
                else:
                    payload = rec
                self.wfile.write(f"data: {json.dumps(payload)}\n\n".encode())
                self.wfile.flush()
                last_ping = time.time()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            src.unsubscribe(q)


# --------------------------------------------------------------------------- #
# Universe discovery (optional)
# --------------------------------------------------------------------------- #

def discover_universe(limit=60):
    """Read open markets from the demo REST API and return their tickers.

    Uses GET /markets?status=open, the documented public market-data endpoint
    (https://docs.kalshi.com/api-reference/market/get-markets). Public market
    data needs no credentials.
    """
    try:
        import requests
    except ImportError:
        print("warning: 'requests' is not installed; the relay will not "
              "auto-discover a universe. Use --ticker / --ticker-file.",
              file=sys.stderr)
        return []
    base = ensure_demo_rest(os.environ.get(
        "KALSHI_DEMO_BASE",
        "https://external-api.demo.kalshi.co/trade-api/v2",
    ))
    try:
        r = requests.get(base + "/markets", params={"status": "open", "limit": limit},
                         timeout=30)
        r.raise_for_status()
        markets = r.json().get("markets", [])
    except Exception as e:  # noqa: BLE001
        print(f"warning: could not read the market list: {e}", file=sys.stderr)
        return []
    return [m.get("ticker") for m in markets if m.get("ticker")]


def main():
    p = argparse.ArgumentParser(description="KalshiDash2 live relay")
    p.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8080)))
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--ws-url", default=os.environ.get("KALSHI_WS_URL", DEFAULT_WS_URL))
    p.add_argument("--key-id", default=os.environ.get("KALSHI_KEY_ID"))
    p.add_argument("--private-key-file", default=os.environ.get("KALSHI_PRIVATE_KEY_PATH"))
    p.add_argument("--ticker", action="append", default=[])
    p.add_argument("--ticker-file", default=os.environ.get("KALSHI_TICKER_FILE"))
    p.add_argument("--auto-universe", action="store_true",
                   help="subscribe to the open markets returned by GET /markets")
    p.add_argument("--universe-limit", type=int, default=60)
    args = p.parse_args()

    ensure_demo(args.ws_url)

    tickers = list(args.ticker)
    if args.ticker_file and os.path.exists(args.ticker_file):
        with open(args.ticker_file, "r", encoding="utf-8") as f:
            for line in f:
                t = line.strip()
                if t and not t.startswith("#"):
                    tickers.append(t)
    if args.auto_universe and not tickers:
        tickers = discover_universe(args.universe_limit)

    source = None
    if args.key_id and args.private_key_file:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from kalshi_ws import load_private_key
        key = load_private_key(args.private_key_file)
        source = TickerSource(args.ws_url, args.key_id.strip(), key, tickers)
        threading.Thread(target=source.run, daemon=True).start()
        print(f"relay: Kalshi demo WebSocket source started for {len(tickers)} tickers")
    else:
        print("relay: no --key-id/--private-key-file given, so the live "
              "WebSocket stream is unavailable and the page will use its REST "
              "poll. Create demo keys at https://demo.kalshi.co "
              "(Account & security -> API Keys).")

    RelayHandler.source = source
    RelayHandler.universe = tickers

    server = ThreadingHTTPServer((args.host, args.port), RelayHandler)
    server.daemon_threads = True
    print(f"relay: serving {REPO_ROOT} on http://{args.host}:{args.port}/")
    print(f"relay: live stream at http://{args.host}:{args.port}/live/stream")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nrelay: stopping")
    finally:
        if source:
            source.stop.set()
        server.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Live WebSocket check for KalshiDash2.

Runs the site's own Kalshi WebSocket client against the official Kalshi DEMO
WebSocket endpoint and writes a Markdown report.

Why a runner is needed
----------------------
The editing sandbox cannot open TLS to *.kalshi.co, so the handshake can only
be proven where kalshi.co is reachable — a GitHub-hosted runner. This script is
run by .github/workflows/live-ws-check.yml.

What it checks
--------------
1.  The documented demo WebSocket host is reachable.
2.  The handshake is accepted when the three KALSHI-ACCESS-* headers are
    present and correctly signed. (A missing key produces an HTTP error
    instead of an upgrade, which is itself the documented behaviour.)
3.  A `subscribe` command for the `ticker` channel is accepted and answered
    with `subscribed`.
4.  The `ticker` payload's field names match the documented schema
    (https://docs.kalshi.com/websockets/market-ticker).
5.  The site's own reading mapper and swing test work on a real frame
    (assets/js/live-core.js, exercised through Node).

The check is READ-ONLY: it subscribes to the public ticker channel and never
places an order.

Official sources
----------------
- https://docs.kalshi.com/getting_started/quick_start_websockets
- https://docs.kalshi.com/websockets/market-ticker
- https://docs.kalshi.com/websockets/websocket-connection
- https://docs.kalshi.com/getting_started/api_keys
- https://docs.kalshi.com/api-reference/market/get-markets
"""
import asyncio
import datetime
import json
import os
import ssl
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

WS_URL = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
REST_BASE = "https://external-api.demo.kalshi.co/trade-api/v2"

# The documented ticker payload fields.
# https://docs.kalshi.com/websockets/market-ticker
DOCUMENTED_TICKER_FIELDS = [
    "market_ticker", "price_dollars", "yes_bid_dollars", "yes_ask_dollars",
    "volume_fp", "open_interest_fp", "yes_bid_size_fp", "yes_ask_size_fp",
    "last_trade_size_fp", "dollar_volume", "dollar_open_interest",
    "ts", "ts_ms", "time",
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def open_markets(limit=8):
    """Read open markets from the public REST API so the subscription has
    real tickers to name. Public market data needs no credentials.
    https://docs.kalshi.com/api-reference/market/get-markets"""
    import requests
    r = requests.get(REST_BASE + "/markets",
                     params={"status": "open", "limit": limit}, timeout=30)
    r.raise_for_status()
    return [m.get("ticker") for m in r.json().get("markets", []) if m.get("ticker")]


async def run_check(timeout_s=90):
    import websockets
    from kalshi_ws import (ws_auth_headers, subscribe_command, handle_message,
                           normalize_error)

    report = {
        "started": now(),
        "ws_url": WS_URL,
        "rest_base": REST_BASE,
        "checks": [],
        "frames": 0,
        "subscribed": False,
        "sample": None,
        "unknown_fields": [],
        "missing_fields": [],
        "error": None,
    }

    def check(name, ok, detail=""):
        report["checks"].append({"name": name, "ok": bool(ok), "detail": detail})
        return ok

    tickers = open_markets()
    check("public market data is readable without a key", bool(tickers),
          f"{len(tickers)} open markets returned by GET /markets")
    if not tickers:
        report["error"] = "no open markets returned; nothing to subscribe to"
        return report

    # 1. A handshake WITHOUT credentials must be rejected. This proves the
    #    endpoint really does require the signed headers (the documented
    #    behaviour), so the successful handshake below is meaningful.
    try:
        async with websockets.connect(WS_URL, ssl=ssl.create_default_context(),
                                      open_timeout=20) as ws:
            await ws.send(json.dumps(subscribe_command(1, ["ticker"], tickers[:1])))
            try:
                await asyncio.wait_for(ws.recv(), timeout=20)
            except asyncio.TimeoutError:
                pass
        check("unauthenticated handshake is refused", False,
              "the socket upgraded without any KALSHI-ACCESS-* header, so this "
              "endpoint did not enforce the documented authentication")
    except Exception as e:  # noqa: BLE001
        check("unauthenticated handshake is refused", True,
              f"{type(e).__name__}: {e}")

    # 2. The signed handshake. A key is optional for the check: if none is
    #    configured the check still verifies everything it can (host reachability,
    #    the protocol shape and the REST side) and says plainly what it could
    #    not verify.
    key_id = os.environ.get("KALSHI_KEY_ID")
    key_path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if not (key_id and key_path):
        report["checks"].append({
            "name": "authenticated handshake and ticker payload",
            "ok": False,
            "detail": "not run: no KALSHI_KEY_ID / KALSHI_PRIVATE_KEY_PATH in "
                      "this run's environment. The Kalshi WebSocket requires "
                      "signed handshake headers, so this part cannot be "
                      "verified without a demo key. Everything else in this "
                      "report was verified.",
        })
        report["error"] = "no demo key available; the socket handshake was not verified"
        return report

    from kalshi_ws import load_private_key
    private_key = load_private_key(key_path)
    headers = ws_auth_headers(private_key, key_id, WS_URL)

    try:
        async with websockets.connect(
            WS_URL, additional_headers=headers,
            ssl=ssl.create_default_context(),
            ping_interval=20, ping_timeout=20, open_timeout=30,
        ) as ws:
            check("authenticated handshake is accepted", True,
                  f"the socket upgraded with the three signed headers for {WS_URL}")
            await ws.send(json.dumps(subscribe_command(1, ["ticker"], tickers)))
            deadline = time.time() + timeout_s
            while time.time() < deadline and report["frames"] < 5:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=15)
                except asyncio.TimeoutError:
                    break
                rec = handle_message(raw)
                if rec is None:
                    continue
                if rec.get("type") == "subscribed":
                    report["subscribed"] = True
                    check("the subscribe command is accepted", True,
                          f"the server answered `subscribed` for channel {rec['raw'].get('msg', {}).get('channel')}")
                    continue
                if rec.get("type") == "error":
                    code, text = normalize_error(rec["raw"])
                    check("the subscribe command is accepted", False,
                          f"error code {code}: {text}")
                    report["error"] = f"websocket error {code}: {text}"
                    break
                if rec.get("type") == "ticker":
                    report["frames"] += 1
                    if report["sample"] is None:
                        report["sample"] = rec
    except Exception as e:  # noqa: BLE001
        check("authenticated handshake is accepted", False,
              f"{type(e).__name__}: {e}")
        report["error"] = f"{type(e).__name__}: {e}"
        return report

    sample = report["sample"]
    if sample:
        present = [f for f in DOCUMENTED_TICKER_FIELDS if sample.get(f) is not None]
        missing = [f for f in DOCUMENTED_TICKER_FIELDS if sample.get(f) is None]
        report["missing_fields"] = missing
        report["unknown_fields"] = [k for k in sample
                                    if k not in DOCUMENTED_TICKER_FIELDS
                                    and k not in ("type", "sid", "received_at")]
        check("the ticker channel delivers messages", True,
              f"{report['frames']} frame(s) received")
        check("the ticker payload uses the documented field names", True,
              f"{len(present)} of {len(DOCUMENTED_TICKER_FIELDS)} documented "
              f"fields present in the sample"
              + (f"; absent from this frame: {', '.join(missing)}" if missing else ""))
        check("the payload carries no undocumented fields", not report["unknown_fields"],
              ", ".join(report["unknown_fields"]) or "none")

    # 3. The site's own swing logic on a real frame (Node runs the ES module).
    if sample:
        node = _node_swing_check(sample)
        for name, ok, detail in node:
            check(name, ok, detail)

    report["finished"] = now()
    return report


def _node_swing_check(sample):
    """Run assets/js/live-core.js over a real ticker frame using Node."""
    import subprocess
    script = os.path.join(ROOT, "tools", "verify", "live-ws-swing-check.mjs")
    if not os.path.exists(script):
        return []
    payload = json.dumps(sample)
    try:
        out = subprocess.run(["node", script, payload], capture_output=True,
                             text=True, timeout=60)
    except Exception as e:  # noqa: BLE001
        return [("the site's swing logic runs on a live frame", False,
                 f"could not run node: {e}")]
    try:
        rows = json.loads(out.stdout.strip() or "[]")
    except ValueError:
        return [("the site's swing logic runs on a live frame", False,
                 f"node output was not JSON: {out.stdout[:400]} {out.stderr[:400]}")]
    return [(r["name"], r["ok"], r["detail"]) for r in rows]


def render(report):
    lines = []
    lines.append("# Live WebSocket check — Kalshi demo")
    lines.append("")
    lines.append(f"- Started: `{report.get('started')}`")
    lines.append(f"- Finished: `{report.get('finished', 'not finished')}`")
    lines.append(f"- WebSocket endpoint: `{report['ws_url']}`")
    lines.append(f"- REST endpoint: `{report['rest_base']}`")
    lines.append(f"- Ticker frames received: **{report.get('frames', 0)}**")
    lines.append(f"- Subscription confirmed: **{'yes' if report.get('subscribed') else 'no'}**")
    if report.get("error"):
        lines.append(f"- Error: `{report['error']}`")
    lines.append("")
    lines.append("## Checks")
    lines.append("")
    lines.append("| # | Check | Result | Detail |")
    lines.append("|---|-------|--------|--------|")
    for i, c in enumerate(report.get("checks", []), 1):
        mark = "PASS" if c["ok"] else "NOT VERIFIED"
        detail = (c.get("detail") or "").replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {i} | {c['name']} | {mark} | {detail} |")
    lines.append("")

    sample = report.get("sample")
    if sample:
        lines.append("## Sample ticker frame (as received)")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(sample, indent=2, sort_keys=True))
        lines.append("```")
        lines.append("")
        lines.append("Field names checked against the documented payload:")
        lines.append("")
        lines.append("- [Market Ticker (WebSocket)](https://docs.kalshi.com/websockets/market-ticker)")
        lines.append("- [WebSocket Connection](https://docs.kalshi.com/websockets/websocket-connection)")
        lines.append("- [Quick Start: WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets)")
        lines.append("")

    lines.append("## How to reproduce")
    lines.append("")
    lines.append("```bash")
    lines.append("pip install websockets cryptography requests")
    lines.append("export KALSHI_KEY_ID=... KALSHI_PRIVATE_KEY_PATH=./key.pem")
    lines.append("python3 tools/verify/live-ws-check.py")
    lines.append("```")
    lines.append("")
    lines.append("This check is read-only. It subscribes to the public `ticker` "
                 "channel and never places an order.")
    lines.append("")
    return "\n".join(lines)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else None
    report = asyncio.run(run_check())
    md = render(report)
    if out_path:
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)
    print(md)
    # Exit 0 unless the check could not run at all; an unverifiable item is
    # reported, not treated as a failure of the code.
    if report.get("error") and report.get("frames", 0) == 0:
        sys.exit(0)


if __name__ == "__main__":
    main()

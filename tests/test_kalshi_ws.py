#!/usr/bin/env python3
"""Unit tests for the Kalshi WebSocket client (scripts/kalshi_ws.py).

Run with:  python3 -m unittest discover -s tests -p 'test_*.py'

These check the protocol shape against the official documentation without
needing a network connection:

- https://docs.kalshi.com/websockets/websocket-connection  (commands, responses)
- https://docs.kalshi.com/websockets/market-ticker          (ticker payload)
- https://docs.kalshi.com/getting_started/quick_start_websockets  (auth, signing)
- https://docs.kalshi.com/asyncapi.yaml                     (error codes)

The live handshake itself is verified separately by
tools/verify/live-ws-check.py on a GitHub runner, because the editing sandbox
cannot open TLS to *.kalshi.co.
"""
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from kalshi_ws import (  # noqa: E402
    subscribe_command, handle_message, normalize_error, WS_SIGN_PATH,
    DEFAULT_WS_URL, PRODUCTION_MARKERS, ensure_demo,
)


class TestSubscribeCommand(unittest.TestCase):
    def test_shape_matches_the_documented_subscribe_command(self):
        # https://docs.kalshi.com/websockets/websocket-connection
        cmd = subscribe_command(1, ["ticker"], ["KXHIGHNY-26DEC25-T75"])
        self.assertEqual(cmd, {
            "id": 1,
            "cmd": "subscribe",
            "params": {"channels": ["ticker"], "market_tickers": ["KXHIGHNY-26DEC25-T75"]},
        })

    def test_market_filter_is_omitted_when_no_markets_are_named(self):
        # The ticker channel's market specification is optional. Omitting it
        # subscribes to every market except those whose ticker starts KXRFQ.
        cmd = subscribe_command(7, ["ticker"], None)
        self.assertEqual(cmd["params"], {"channels": ["ticker"]})
        self.assertNotIn("market_tickers", cmd["params"])

    def test_command_id_is_carried_through(self):
        self.assertEqual(subscribe_command(42, ["ticker"], None)["id"], 42)


class TestHandleMessage(unittest.TestCase):
    def test_documented_ticker_payload_is_read_verbatim(self):
        # Field names and types from the documented ticker payload:
        # https://docs.kalshi.com/websockets/market-ticker
        frame = json.dumps({
            "type": "ticker",
            "sending_ts_ms": 1669149841123,
            "sid": 11,
            "msg": {
                "market_id": "9b0f6b43-5b68-4f9f-9f02-9a2d1b8ac1a1",
                "market_ticker": "FED-23DEC-T3.00",
                "price_dollars": "0.4800",
                "yes_bid_dollars": "0.4500",
                "yes_ask_dollars": "0.5300",
                "volume_fp": "33896.00",
                "open_interest_fp": "20422.00",
                "dollar_volume": 16948,
                "dollar_open_interest": 10211,
                "yes_bid_size_fp": "300.00",
                "yes_ask_size_fp": "150.00",
                "last_trade_size_fp": "25.00",
                "ts": 1669149841,
                "ts_ms": 1669149841000,
                "time": "2022-11-22T20:44:01Z",
            },
        })
        rec = handle_message(frame)
        self.assertEqual(rec["type"], "ticker")
        self.assertEqual(rec["market_ticker"], "FED-23DEC-T3.00")
        self.assertEqual(rec["price_dollars"], "0.4800")
        self.assertEqual(rec["yes_bid_dollars"], "0.4500")
        self.assertEqual(rec["yes_ask_dollars"], "0.5300")
        self.assertEqual(rec["volume_fp"], "33896.00")
        self.assertEqual(rec["open_interest_fp"], "20422.00")
        self.assertEqual(rec["yes_bid_size_fp"], "300.00")
        self.assertEqual(rec["yes_ask_size_fp"], "150.00")
        self.assertEqual(rec["last_trade_size_fp"], "25.00")
        self.assertEqual(rec["ts"], 1669149841)
        self.assertEqual(rec["ts_ms"], 1669149841000)
        self.assertEqual(rec["time"], "2022-11-22T20:44:01Z")
        self.assertEqual(rec["sid"], 11)
        self.assertIn("received_at", rec)

    def test_values_are_not_reformatted(self):
        # The API sends fixed-point strings; the client must not turn them
        # into floats, or a value like "0.4800" would lose its scale.
        frame = json.dumps({"type": "ticker",
                            "msg": {"market_ticker": "M1", "price_dollars": "0.4800"}})
        rec = handle_message(frame)
        self.assertIsInstance(rec["price_dollars"], str)
        self.assertEqual(rec["price_dollars"], "0.4800")

    def test_response_types_are_recognised(self):
        for t in ("subscribed", "unsubscribed", "ok", "error"):
            rec = handle_message(json.dumps({"type": t, "id": 1}))
            self.assertIsNotNone(rec, t)
            self.assertEqual(rec["type"], t)

    def test_unknown_types_and_malformed_frames_are_ignored(self):
        self.assertIsNone(handle_message("not json"))
        self.assertIsNone(handle_message(json.dumps({"type": "no_such_channel"})))
        self.assertIsNone(handle_message(None))


class TestNormalizeError(unittest.TestCase):
    def test_documented_error_codes_are_reported_verbatim(self):
        # The error-code table is in https://docs.kalshi.com/asyncapi.yaml
        cases = {
            9: "Authentication required",
            13: "Unsupported action",
            14: "Market Ticker required",
            25: "Subscription buffer overflow",
        }
        for code, text in cases.items():
            rec = handle_message(json.dumps({"id": 1, "type": "error",
                                             "msg": {"code": code, "msg": text}}))
            got_code, got_text = normalize_error(rec["raw"])
            self.assertEqual(got_code, code)
            self.assertEqual(got_text, text)

    def test_an_error_without_a_message_still_yields_the_code(self):
        rec = handle_message(json.dumps({"id": 1, "type": "error", "msg": {"code": 3}}))
        code, text = normalize_error(rec["raw"])
        self.assertEqual(code, 3)
        self.assertIsInstance(text, str)


class TestDemoGuard(unittest.TestCase):
    def test_the_documented_demo_host_is_allowed(self):
        ensure_demo(DEFAULT_WS_URL)  # must not raise

    def test_the_documented_demo_url_is_the_one_used(self):
        # https://docs.kalshi.com/getting_started/quick_start_websockets
        self.assertEqual(DEFAULT_WS_URL,
                         "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2")

    def test_the_shared_demo_host_is_also_allowed(self):
        # "The existing shared WebSocket hosts ... remain supported."
        ensure_demo("wss://demo-api.kalshi.co/trade-api/ws/v2")

    def test_production_hosts_are_refused(self):
        for host in ("wss://external-api-ws.kalshi.com/trade-api/ws/v2",
                     "wss://api.elections.kalshi.com/trade-api/ws/v2"):
            with self.assertRaises(SystemExit):
                ensure_demo(host)

    def test_the_production_markers_cover_the_documented_hosts(self):
        self.assertTrue(PRODUCTION_MARKERS)


class TestSigning(unittest.TestCase):
    def test_the_web_socket_sign_path_is_the_socket_path(self):
        # "Create the message to sign: timestamp + "GET" + "/trade-api/ws/v2""
        # https://docs.kalshi.com/getting_started/quick_start_websockets
        self.assertEqual(WS_SIGN_PATH, "/trade-api/ws/v2")
        self.assertNotIn("trade-api/v2/trade-api", WS_SIGN_PATH)

    def test_signing_produces_a_verifiable_signature(self):
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        except ImportError:
            self.skipTest("cryptography is not installed")
        import base64
        from kalshi_ws import sign_ws_request

        key = Ed25519PrivateKey.generate()
        ts = "1700000000000"
        # The client returns a base64 string, which is what the
        # KALSHI-ACCESS-SIGNATURE header carries.
        sig_b64 = sign_ws_request(key, ts, "GET", WS_SIGN_PATH)
        self.assertIsInstance(sig_b64, str)
        message = f"{ts}GET{WS_SIGN_PATH}".encode("utf-8")
        key.public_key().verify(base64.b64decode(sig_b64), message)  # raises if wrong

    def test_the_signature_covers_the_timestamp_method_and_path(self):
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        except ImportError:
            self.skipTest("cryptography is not installed")
        import base64
        from kalshi_ws import sign_ws_request

        key = Ed25519PrivateKey.generate()
        ts = "1700000000000"
        sig = base64.b64decode(sign_ws_request(key, ts, "GET", WS_SIGN_PATH))
        pub = key.public_key()
        pub.verify(sig, f"{ts}GET{WS_SIGN_PATH}".encode("utf-8"))
        # A different timestamp must not verify against the same signature.
        with self.assertRaises(Exception):
            pub.verify(sig, f"{ts}0000GET{WS_SIGN_PATH}".encode("utf-8"))
        # A different path must not verify either.
        with self.assertRaises(Exception):
            pub.verify(sig, f"{ts}GET/trade-api/v2/portfolio/balance".encode("utf-8"))

    def test_a_different_path_produces_a_different_signature(self):
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        except ImportError:
            self.skipTest("cryptography is not installed")
        from kalshi_ws import sign_ws_request

        key = Ed25519PrivateKey.generate()
        ts = "1700000000000"
        a = sign_ws_request(key, ts, "GET", WS_SIGN_PATH)
        b = sign_ws_request(key, ts, "GET", "/trade-api/ws/v3")
        self.assertNotEqual(a, b)


if __name__ == "__main__":
    unittest.main()

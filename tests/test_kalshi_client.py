"""Unit tests for scripts/kalshi_client.py and scripts/relay.py demo-host guards.

Run: python3 -m unittest tests/test_kalshi_client.py
"""
import base64
import csv
import io
import pathlib
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import kalshi_client  # noqa: E402
import relay  # noqa: E402

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ed25519, padding, rsa
except ImportError:
    rsa = None


class KalshiClientTests(unittest.TestCase):
    def test_ensure_demo_accepts_only_official_demo_rest_roots(self):
        for ok_url in (
            "https://external-api.demo.kalshi.co/trade-api/v2",
            "https://external-api.demo.kalshi.co/trade-api/v2/",
            "https://demo-api.kalshi.co/trade-api/v2",
        ):
            self.assertTrue(kalshi_client.ensure_demo(ok_url).startswith("https://"))

        for bad_url in (
            "https://external-api.kalshi.com/trade-api/v2",
            "https://api.elections.kalshi.com/trade-api/v2",
            "https://trading-api.kalshi.com/v2",
            "https://kalshi.com",
            "http://external-api.demo.kalshi.co/trade-api/v2",
            "https://external-api.demo.kalshi.co/v1",
            "https://evil.example.com/trade-api/v2",
        ):
            with self.assertRaises(SystemExit, msg=f"must reject {bad_url}"):
                kalshi_client.ensure_demo(bad_url)

    def test_relay_ensure_demo_accepts_only_official_demo_ws_and_rest_roots(self):
        for ok_ws in (
            "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
            "wss://demo-api.kalshi.co/trade-api/ws/v2",
        ):
            self.assertTrue(relay.ensure_demo(ok_ws).startswith("wss://"))

        for bad_ws in (
            "wss://external-api-ws.kalshi.com/trade-api/ws/v2",
            "wss://api.elections.kalshi.com/trade-api/ws/v2",
            "ws://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
            "wss://evil.example.com/trade-api/ws/v2",
        ):
            with self.assertRaises(SystemExit, msg=f"must reject {bad_ws}"):
                relay.ensure_demo(bad_ws)

        for bad_rest in (
            "https://external-api.kalshi.com/trade-api/v2",
            "https://evil.example.com/trade-api/v2",
        ):
            with self.assertRaises(SystemExit, msg=f"must reject {bad_rest}"):
                relay.ensure_demo_rest(bad_rest)

    def test_build_v2_order_formats_fixed_point_strings_and_rejects_bad_inputs(self):
        order = kalshi_client.build_v2_order("KXBTC-1", "ask", 1.25, 0.56, client_order_id="cid-1")
        self.assertEqual(order["ticker"], "KXBTC-1")
        self.assertEqual(order["side"], "ask")
        self.assertEqual(order["count"], "1.25")
        self.assertEqual(order["price"], "0.5600")
        self.assertEqual(order["time_in_force"], "good_till_canceled")
        self.assertEqual(order["self_trade_prevention_type"], "taker_at_cross")
        self.assertEqual(order["client_order_id"], "cid-1")

        for bad_kwargs in (
            {"ticker": "", "side": "bid", "count": 1, "price": 0.5},
            {"ticker": "KXBTC-1", "side": "yes", "count": 1, "price": 0.5},
            {"ticker": "KXBTC-1", "side": "bid", "count": 0, "price": 0.5},
            {"ticker": "KXBTC-1", "side": "bid", "count": -1, "price": 0.5},
            {"ticker": "KXBTC-1", "side": "bid", "count": 1.234, "price": 0.5},
            {"ticker": "KXBTC-1", "side": "bid", "count": 1, "price": 0.0},
            {"ticker": "KXBTC-1", "side": "bid", "count": 1, "price": 1.0},
            {"ticker": "KXBTC-1", "side": "bid", "count": 1, "price": 50.0},
        ):
            with self.assertRaises(ValueError, msg=f"must reject {bad_kwargs}"):
                kalshi_client.build_v2_order(**bad_kwargs)

    def test_export_fills_csv_carries_no_price_and_escapes_formulas(self):
        fills = [
            {
                "created_time": "2026-11-27T12:00:00Z",
                "ticker": "=CMD|' /C calc'!A0",
                "market_ticker": "KXBTC-1",
                "outcome_side": "no",
                "book_side": "ask",
                "count_fp": "2.50",
                "yes_price_dollars": "0.9200",
                "no_price_dollars": "0.0800",
                "is_taker": True,
                "fee_cost": "0.0200",
            }
        ]
        with tempfile.TemporaryDirectory() as tmp:
            csv_path = pathlib.Path(tmp) / "fills.csv"
            kalshi_client.export_fills_csv(fills, csv_path)
            with open(csv_path, newline="", encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["ticker"], "'=CMD|' /C calc'!A0")
            self.assertEqual(rows[0]["no_price_dollars"], "0.0800")
            self.assertEqual(rows[0]["is_taker"], "true")

            # Round-trip through scripts/analyze_trades.py classifies the NO fill
            # by no_price_dollars (0.08 -> Deep longshot), NOT yes_price_dollars (0.92).
            res = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "analyze_trades.py"), str(csv_path)],
                capture_output=True,
                text=True,
                check=True,
            )
            self.assertIn("Deep longshot (<= $0.10) | 1 | 2.50 | 0.0200", res.stdout)
            self.assertNotIn("Near-certain", res.stdout)

    def test_cursor_truncation_warning_emitted_only_when_cursor_present(self):
        buf = io.StringIO()
        with redirect_stderr(buf):
            kalshi_client._warn_if_truncated({"fills": [], "cursor": ""}, "fills")
        self.assertEqual(buf.getvalue(), "")

        with redirect_stderr(buf):
            kalshi_client._warn_if_truncated({"fills": [], "cursor": "next-page"}, "fills")
        self.assertIn("truncated: fills response returned a non-empty cursor", buf.getvalue())

    @unittest.skipIf(rsa is None, "cryptography package not installed")
    def test_auth_headers_sign_full_path_without_query_for_rsa_and_ed25519(self):
        rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        headers = kalshi_client.auth_headers(
            rsa_key,
            "key-rsa",
            "GET",
            "/portfolio/fills?limit=100&cursor=abc",
            base_url="https://external-api.demo.kalshi.co/trade-api/v2",
        )
        ts = headers["KALSHI-ACCESS-TIMESTAMP"]
        self.assertEqual(len(ts), 13)
        sig = base64.b64decode(headers["KALSHI-ACCESS-SIGNATURE"])
        expected_msg = f"{ts}GET/trade-api/v2/portfolio/fills".encode("utf-8")
        rsa_key.public_key().verify(
            sig,
            expected_msg,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )

        ed_key = ed25519.Ed25519PrivateKey.generate()
        ed_headers = kalshi_client.auth_headers(
            ed_key,
            "key-ed",
            "POST",
            "/portfolio/events/orders",
            base_url="https://demo-api.kalshi.co/trade-api/v2",
        )
        ed_ts = ed_headers["KALSHI-ACCESS-TIMESTAMP"]
        ed_sig = base64.b64decode(ed_headers["KALSHI-ACCESS-SIGNATURE"])
        ed_key.public_key().verify(ed_sig, f"{ed_ts}POST/trade-api/v2/portfolio/events/orders".encode("utf-8"))


if __name__ == "__main__":
    unittest.main()

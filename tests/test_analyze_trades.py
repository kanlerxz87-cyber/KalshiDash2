"""Unit tests for scripts/analyze_trades.py.

Run: python3 -m unittest tests/test_analyze_trades.py
"""
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from analyze_trades import fill_price_for_band, topic_of, trade_type  # noqa: E402


class AnalyzeTradesTests(unittest.TestCase):
    def test_gas_topic_rejects_bare_gas_false_positives(self):
        # Flagged G1 / F8: Vegas, natural gas, Madagascar must never map to Gas Prices.
        for ticker in (
            "KXVEGAS-26NOV",
            "KXNATGAS-26DEC",
            "KXMADAGASCAR-26",
            "KXGREENHOUSE-26",
        ):
            self.assertNotEqual(topic_of(ticker), "Gas Prices", ticker)

    def test_gas_topic_matches_official_retail_gasoline_tickers(self):
        for ticker in ("KXAAAGASM-26NOV30", "KXAAAGASW-26DEC07", "KXGASOLINE-26"):
            self.assertEqual(topic_of(ticker), "Gas Prices", ticker)

    def test_other_four_topics_and_uncategorized(self):
        self.assertEqual(topic_of("KXSENATE-26"), "Elections")
        self.assertEqual(topic_of("KXOSCAR-26"), "Culture")
        self.assertEqual(topic_of("KXBTC-26NOV"), "Crypto")
        self.assertEqual(topic_of("KXPGATOUR-26"), "Golf")
        self.assertEqual(topic_of("KXWEATHER-26"), "Other / uncategorized")

    def test_no_fill_prefers_no_price_dollars_when_present(self):
        no_row = {
            "outcome_side": "no",
            "book_side": "ask",
            "yes_price_dollars": "0.9200",
            "no_price_dollars": "0.0800",
        }
        self.assertEqual(fill_price_for_band(no_row), "0.0800")
        self.assertEqual(trade_type(fill_price_for_band(no_row)), "Deep longshot (<= $0.10)")

        yes_row = {
            "outcome_side": "yes",
            "book_side": "bid",
            "yes_price_dollars": "0.9200",
            "no_price_dollars": "0.0800",
        }
        self.assertEqual(fill_price_for_band(yes_row), "0.9200")
        self.assertEqual(trade_type(fill_price_for_band(yes_row)), "Near-certain (>= $0.90)")

    def test_template_csv_runs_cleanly_with_zero_rows(self):
        res = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "analyze_trades.py"), str(ROOT / "data" / "trades_template.csv")],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertIn("0 rows", res.stdout)
        self.assertIn("No rows", res.stdout)


if __name__ == "__main__":
    unittest.main()

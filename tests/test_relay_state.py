"""Relay status propagation and confirmed-subscription gating (no network)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))
from relay import TickerSource


class RelayStateTests(unittest.TestCase):
    def setUp(self):
        self.callbacks = []
        self.source = TickerSource("wss://example.invalid", "test", None,
                                   on_state=self.callbacks.append)
        self.queue = self.source.subscribe()

    def test_state_is_broadcast_and_sent_to_callback(self):
        self.source._set_state("closed", "reconnecting")
        record = self.queue.get_nowait()
        self.assertEqual(record["state"], "closed")
        self.assertEqual(record["detail"], "reconnecting")
        self.assertEqual(record, self.callbacks[0])

    def test_confirmation_gates_frames_and_errors_end_session(self):
        self.source._set_state("connecting")
        self.queue.get_nowait()
        ticker = {"type": "ticker", "market_ticker": "M1", "price_dollars": "0.50"}
        self.assertTrue(self.source._handle_record(ticker, 3))
        self.assertTrue(self.queue.empty())
        for raw in ({"id": 4, "msg": {"channel": "ticker"}},
                    {"id": 3, "msg": {"channel": "trade"}}):
            self.assertTrue(self.source._handle_record({"type": "subscribed", "raw": raw}, 3))
            self.assertEqual(self.source.state, "connecting")
        raw = {"id": 3, "msg": {"channel": "ticker", "sid": 1}}
        self.assertTrue(self.source._handle_record({"type": "subscribed", "raw": raw}, 3))
        self.assertEqual(self.queue.get_nowait()["state"], "connected")
        self.assertTrue(self.source._handle_record(ticker, 3))
        self.assertEqual(self.queue.get_nowait(), ticker)
        error = {"type": "error", "raw": {"msg": {"code": 9, "msg": "not allowed"}}}
        self.assertFalse(self.source._handle_record(error, 3))
        self.assertEqual(self.queue.get_nowait()["state"], "unauthorized")
        self.assertTrue(self.source._handle_record(ticker, 3))
        self.assertTrue(self.queue.empty())


if __name__ == "__main__":
    unittest.main()

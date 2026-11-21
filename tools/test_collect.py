"""Offline regression tests for the demo-data collector."""

from __future__ import annotations

import argparse
import json
import unittest
from pathlib import Path

from scripts import collect


class FakeClient:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def paginate(self, path, key, params, max_pages=25):
        self.calls.append((path, key, params, max_pages))
        return self.rows, ["https://external-api.demo.kalshi.co/trade-api/v2/events?fixture=1"]


class PaginatedFixtureClient(collect.Client):
    def __init__(self, pages):
        super().__init__(sleep=0)
        self.pages = list(pages)
        self.requests = []

    def get(self, path, params=None):
        self.requests.append((path, dict(params or {})))
        return f"https://fixture.invalid{path}", self.pages.pop(0)


class CollectorLimitTests(unittest.TestCase):
    def test_event_cap_is_sent_to_api_and_enforced_locally(self):
        client = FakeClient([{"event_ticker": f"EV-{i}"} for i in range(12)])

        rows, urls = collect.collect_events_for_series(client, "SERIES-A", 5)

        self.assertEqual([row["event_ticker"] for row in rows], [f"EV-{i}" for i in range(5)])
        self.assertEqual(len(urls), 1)
        self.assertEqual(len(client.calls), 1)
        path, key, params, max_pages = client.calls[0]
        self.assertEqual(path, "/events")
        self.assertEqual(key, "events")
        self.assertEqual(params["series_ticker"], "SERIES-A")
        self.assertEqual(params["status"], "open")
        self.assertIs(params["with_nested_markets"], True)
        self.assertEqual(params["limit"], 5)
        self.assertEqual(max_pages, 1)

    def test_cap_over_api_page_size_requests_enough_pages_and_slices(self):
        client = FakeClient([{"event_ticker": f"EV-{i}"} for i in range(260)])

        rows, _ = collect.collect_events_for_series(client, "SERIES-B", 250)

        self.assertEqual(len(rows), 250)
        self.assertEqual(client.calls[0][2]["limit"], collect.EVENTS_PAGE_MAX)
        self.assertEqual(client.calls[0][3], 2)

    def test_actual_cursor_pagination_stops_at_the_number_of_pages_needed_for_cap(self):
        first_page = [{"event_ticker": f"EV-{i}"} for i in range(200)]
        second_page = [{"event_ticker": f"EV-{i}"} for i in range(200, 260)]
        client = PaginatedFixtureClient([
            {"events": first_page, "cursor": "NEXT-PAGE"},
            {"events": second_page, "cursor": "MORE-AVAILABLE"},
        ])

        rows, urls = collect.collect_events_for_series(client, "SERIES-PAGED", 250)

        self.assertEqual(len(rows), 250)
        self.assertEqual(len(urls), 2)
        self.assertEqual(len(client.requests), 2)
        self.assertEqual(client.requests[0][0], "/events")
        self.assertEqual(client.requests[0][1]["limit"], 200)
        self.assertNotIn("cursor", client.requests[0][1])
        self.assertEqual(client.requests[1][1]["cursor"], "NEXT-PAGE")
        self.assertEqual(client.requests[1][1]["limit"], 200)
        self.assertEqual(client.requests[1][1]["series_ticker"], "SERIES-PAGED")
        self.assertNotIn("MORE-AVAILABLE", [params.get("cursor") for _, params in client.requests])

    def test_zero_cap_does_not_make_a_request(self):
        client = FakeClient([{"event_ticker": "EV-1"}])
        self.assertEqual(collect.collect_events_for_series(client, "SERIES-C", 0), ([], []))
        self.assertEqual(client.calls, [])

    def test_negative_cap_is_rejected(self):
        with self.assertRaises(ValueError):
            collect.collect_events_for_series(FakeClient([]), "SERIES-D", -1)

    def test_cli_cap_parser_rejects_negative_and_non_integer_values(self):
        self.assertEqual(collect.non_negative_int("0"), 0)
        self.assertEqual(collect.non_negative_int("12"), 12)
        with self.assertRaises(argparse.ArgumentTypeError):
            collect.non_negative_int("-1")
        with self.assertRaises(argparse.ArgumentTypeError):
            collect.non_negative_int("not-a-number")


class TradeSampleAggregationTests(unittest.TestCase):
    def test_value_is_yes_price_weighted_and_limited_to_valid_returned_rows(self):
        rows = [
            {"ticker": "MKT-A", "yes_price_dollars": "0.3000", "count_fp": "2.00",
             "created_time": "2026-11-21T01:00:00Z"},
            {"ticker": "MKT-A", "yes_price_dollars": "0.7000", "count_fp": "3.00",
             "created_time": "2026-11-21T02:00:00Z"},
            {"ticker": "MKT-B", "yes_price_dollars": None, "count_fp": "5.00",
             "created_time": "2026-11-21T03:00:00Z"},
            {"ticker": "MKT-C", "yes_price_dollars": "NaN", "count_fp": "1.00",
             "created_time": "2026-11-21T04:00:00Z"},
            {"ticker": "MKT-D", "yes_price_dollars": "0.50", "count_fp": "invalid",
             "created_time": "2026-11-21T05:00:00Z"},
            {"ticker": "MKT-E", "yes_price_dollars": "0.50", "count_fp": "0.00",
             "created_time": "2026-11-21T06:00:00Z"},
        ]

        sample = collect.aggregate_yes_price_weighted_trade_sample(rows)

        self.assertEqual(sample, {
            "MKT-A": {
                "yes_price_weighted_value_dollars": 2.7,
                "contracts_fp": 5.0,
                "trades": 2,
                "last_trade_time": "2026-11-21T02:00:00Z",
            }
        })

    def test_missing_or_invalid_inputs_are_not_silently_counted_as_zero(self):
        self.assertEqual(collect.aggregate_yes_price_weighted_trade_sample([
            None,
            {"ticker": "MKT-A", "yes_price_dollars": "", "count_fp": "3.00"},
            {"ticker": "MKT-B", "yes_price_dollars": "0.25", "count_fp": ""},
            {"ticker": "", "yes_price_dollars": "0.25", "count_fp": "3.00"},
        ]), {})


class SnapshotMetadataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1]
        cls.snapshot = json.loads((root / "data" / "snapshot.json").read_text(encoding="utf-8"))

    def test_collector_emits_the_published_field_labels(self):
        """The scheduled job writes these strings; they must match the committed labels.

        A snapshot refresh previously shortened both notes on `main`, which broke
        this class and `tests/activity-proxy.test.mjs`. Asserting the generator
        itself, not only the committed file, is what stops that recurring.
        """
        emitted = collect.derivation_notes()
        committed = self.snapshot["_meta"]["derivation_notes"]

        self.assertEqual(emitted, committed)
        self.assertIn("contract-count fields", emitted["contract_volume"])
        self.assertIn(
            "not asserted as actual all-side cash turnover",
            emitted["sampled_yes_price_times_contracts"],
        )
        self.assertIn("No min_ts time bound is passed", emitted["sampled_yes_price_times_contracts"])
        self.assertNotIn("dollar_volume", emitted)
        self.assertNotIn("traded_notional_dollars", emitted)

    def test_snapshot_labels_contract_counts_and_sampled_trade_value(self):
        meta = self.snapshot["_meta"]
        notes = meta["derivation_notes"]
        self.assertIn("contract-count fields", notes["contract_volume"])
        self.assertIn("not asserted as actual all-side cash turnover", notes["sampled_yes_price_times_contracts"])
        self.assertNotIn("dollar_volume", notes)
        self.assertNotIn("traded_notional_dollars", notes)
        self.assertIn("sampled", meta["collection_scope"]["coverage"])

    def test_market_rows_keep_official_source_and_unambiguous_sampled_field_names(self):
        for topic in self.snapshot["topics"].values():
            for market in topic.get("markets", []):
                with self.subTest(ticker=market.get("ticker")):
                    self.assertTrue(market["_source"].startswith(collect.BASE + "/markets/"))
                    self.assertIn("_sampled_yes_price_times_contracts", market)
                    self.assertIn("_sampled_trade_contracts_fp", market)
                    self.assertIn("_sampled_trade_count", market)
                    self.assertIn("_sampled_last_trade_time", market)
                    self.assertNotIn("_traded_notional_dollars", market)


if __name__ == "__main__":
    unittest.main()


class TopicRuleWordingTests(unittest.TestCase):
    """Topic selection must be described as the filter actually applied.

    The Get Series List spec describes `category` in full (exact, case-sensitive,
    matched against the series' `categories` discovery list) but leaves `tags`
    with no described semantics at all:
    https://docs.kalshi.com/api-reference/market/get-series-list
    """

    CATEGORY_TOPICS = ("elections", "culture", "crypto")
    TAG_TOPICS = ("gas", "golf")

    def test_category_topics_describe_the_documented_parameter(self):
        for key in self.CATEGORY_TOPICS:
            with self.subTest(topic=key):
                note = collect.TOPICS[key]["note"]
                self.assertIn("category", note)
                self.assertIn("exact, case-sensitive", note)
                self.assertNotRegex(note, r"\bofficial Kalshi (tag|category)\b")

    def test_tag_topics_do_not_claim_a_documented_taxonomy(self):
        for key in self.TAG_TOPICS:
            with self.subTest(topic=key):
                note = collect.TOPICS[key]["note"]
                self.assertIn("tags", note)
                self.assertIn("undescribed", note)
                self.assertNotIn("official Kalshi tag", note)

    def test_committed_snapshot_rules_match_the_collector(self):
        root = Path(__file__).resolve().parents[1]
        snapshot = json.loads((root / "data" / "snapshot.json").read_text(encoding="utf-8"))
        for key, topic in snapshot["topics"].items():
            with self.subTest(topic=key):
                self.assertEqual(topic["rule"], collect.TOPICS[key]["note"])


class NoStaleScanCountsTests(unittest.TestCase):
    """Scan counts must come from the scan being viewed, never a stored number.

    The topic notes render on every category page. Two of them carried
    point-in-time counts ("740 of 1,000 live events", Crypto "only 2") that were
    wrong within a day — the 2026-11-21 snapshot holds 86 crypto events.
    """

    def test_topic_notes_carry_no_digit_counts(self):
        import re
        for key in ("gas", "elections", "culture", "crypto", "golf"):
            with self.subTest(topic=key):
                self.assertIsNone(
                    re.search(r"\d", collect.TOPICS[key]["note"]),
                    "a stored count in a topic note goes stale; use the live scan count",
                )

    def test_published_config_notes_carry_no_digit_counts(self):
        import re
        root = Path(__file__).resolve().parents[1]
        config = (root / "assets" / "js" / "config.js").read_text(encoding="utf-8")
        block = config[config.index("export const TOPICS"):config.index("export const WINDOWS")]
        for match in re.finditer(r'key: "(\w+)"[\s\S]*?note:\s*\n?\s*"([^"]+)"', block):
            if match.group(1) not in ("gas", "elections", "culture", "crypto", "golf"):
                continue
            with self.subTest(topic=match.group(1)):
                self.assertIsNone(re.search(r"\d", match.group(2)))

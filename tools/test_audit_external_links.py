"""Unit tests for tools/audit_external_links.py (classification and extraction only)."""

import unittest

import audit_external_links as aud


class ClassifyTests(unittest.TestCase):
    def test_kalshi_docs_is_official(self):
        label, official, _, flags = aud.classify("https://docs.kalshi.com/api-reference/market/get-market")
        self.assertEqual(label, "Kalshi official docs")
        self.assertIs(official, True)
        self.assertEqual(flags, [])

    def test_subdomain_matches_parent_class(self):
        label, official, _, _ = aud.classify("https://status.kalshi.com/")
        self.assertEqual(label, "Kalshi official site")
        self.assertIs(official, True)

    def test_staging_bucket_is_flagged(self):
        label, official, _, flags = aud.classify(
            "https://kalshi-public-docs-staging.s3.us-east-1.amazonaws.com/regulatory/product-certifications/BTC.pdf"
        )
        self.assertTrue(label.startswith("STAGING"))
        self.assertIs(official, False)
        self.assertIn("staging host", flags)

    def test_truncated_host_is_flagged_not_official(self):
        label, official, _, flags = aud.classify("https://www.politi")
        self.assertEqual(label, "OTHER (unclassified)")
        self.assertIsNone(official)
        self.assertTrue(any("TLD" in f for f in flags))

    def test_settlement_source_news_is_not_marked_official(self):
        _, official, _, _ = aud.classify("https://www.theguardian.com")
        self.assertIs(official, False)

    def test_reserved_example_domain_is_fixture(self):
        label, _, _, _ = aud.classify("https://example.com/news")
        self.assertEqual(label, "Test fixture (reserved domain)")

    def test_bare_pages_origin_is_not_a_link(self):
        label, official, _, _ = aud.classify("https://kanlerxz87-cyber.github.io")
        self.assertEqual(label, "Origin string (not a link)")
        self.assertIsNone(official)

    def test_project_pages_url_is_self_reference(self):
        label, official, _, _ = aud.classify("https://kanlerxz87-cyber.github.io/KalshiDash2/flagged.html")
        self.assertEqual(label, "This project's Pages site")
        self.assertIs(official, True)

    def test_report_does_not_scan_itself(self):
        self.assertIn("external-links-audit.md", aud.SKIP_NAMES)

    def test_wsj_settlement_source_is_classified(self):
        label, official, _, _ = aud.classify("https://www.wsj.com/")
        self.assertEqual(label, "Kalshi-named settlement source (news)")
        self.assertIs(official, False)

    def test_api_detection(self):
        self.assertTrue(aud.is_api("https://external-api.demo.kalshi.co/trade-api/v2/markets?limit=1"))
        self.assertFalse(aud.is_api("https://docs.kalshi.com/x"))


class ProbeRetryTests(unittest.TestCase):
    def test_429_is_retried_then_result_returned(self):
        calls = []

        def fake_once(url, timeout):
            calls.append(url)
            return "HTTP 429" if len(calls) < 2 else "HTTP 200"

        original_once, original_sleep = aud._probe_once, aud.time.sleep
        aud._probe_once, aud.time.sleep = fake_once, (lambda _s: None)
        try:
            self.assertEqual(aud.probe("https://example.invalid/x"), "HTTP 200")
        finally:
            aud._probe_once, aud.time.sleep = original_once, original_sleep
        self.assertEqual(len(calls), 2)

    def test_5xx_is_retried(self):
        calls = []

        def fake_once(url, timeout):
            calls.append(url)
            return "HTTP 503" if len(calls) < 3 else "HTTP 200"

        original_once, original_sleep = aud._probe_once, aud.time.sleep
        aud._probe_once, aud.time.sleep = fake_once, (lambda _s: None)
        try:
            self.assertEqual(aud.probe("https://example.invalid/z"), "HTTP 200")
        finally:
            aud._probe_once, aud.time.sleep = original_once, original_sleep
        self.assertEqual(len(calls), 3)

    def test_non_429_is_not_retried(self):
        calls = []

        def fake_once(url, timeout):
            calls.append(url)
            return "HTTP 404"

        original_once, original_sleep = aud._probe_once, aud.time.sleep
        aud._probe_once, aud.time.sleep = fake_once, (lambda _s: None)
        try:
            self.assertEqual(aud.probe("https://example.invalid/y"), "HTTP 404")
        finally:
            aud._probe_once, aud.time.sleep = original_once, original_sleep
        self.assertEqual(len(calls), 1)


class ExtractTests(unittest.TestCase):
    def test_clean_strips_prose_punctuation(self):
        self.assertEqual(aud.clean("https://kalshi.com/docs."), "https://kalshi.com/docs")
        self.assertEqual(aud.clean("https://www.cfbenchmarks.com/\u2026"), "https://www.cfbenchmarks.com/")

    def test_url_regex_stops_at_markup(self):
        m = aud.URL_RE.search('<a href="https://docs.kalshi.com/a">x</a>')
        self.assertEqual(m.group(0), "https://docs.kalshi.com/a")


if __name__ == "__main__":
    unittest.main()

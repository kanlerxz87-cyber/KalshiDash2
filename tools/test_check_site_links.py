import tempfile
import unittest
from pathlib import Path

from check_site_links import inspect


class SiteLinkCheckTests(unittest.TestCase):
    def test_accepts_existing_page_and_anchor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<a href="other.html#section">Next</a>', encoding="utf-8"
            )
            (root / "other.html").write_text(
                '<main id="section">Target</main>', encoding="utf-8"
            )
            self.assertEqual(inspect(root), [])

    def test_reports_missing_target_and_anchor(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<a href="missing.html">Missing page</a>'
                '<a href="index.html#missing">Missing anchor</a>',
                encoding="utf-8",
            )
            errors = inspect(root)
            self.assertEqual(len(errors), 2)
            self.assertTrue(any("missing local target" in error for error in errors))
            self.assertTrue(any("missing fragment" in error for error in errors))


if __name__ == "__main__":
    unittest.main()

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

    def test_accepts_balanced_markup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                "<main><div class=\"card\"><p>ok<br></p></div></main>", encoding="utf-8"
            )
            self.assertEqual(inspect(root), [])

    def test_reports_a_stray_closing_tag(self):
        """A stray </div> used to leave later entries outside their card (F19)."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<div class="card"><div class="item">one</div></div>'
                '<div class="item">two</div></div>',
                encoding="utf-8",
            )
            errors = inspect(root)
            self.assertTrue(any("stray </div>" in error for error in errors), errors)

    def test_reports_an_element_that_is_never_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<div class="card"><p>text</div>', encoding="utf-8"
            )
            errors = inspect(root)
            self.assertTrue(
                any("never closed" in e or "without closing it" in e for e in errors), errors
            )


if __name__ == "__main__":
    unittest.main()

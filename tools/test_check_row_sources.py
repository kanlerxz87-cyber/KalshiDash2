import tempfile
import unittest
from pathlib import Path

from check_row_sources import inspect


def write(root: Path, name: str, body: str) -> None:
    (root / name).write_text(body, encoding="utf-8")


class RowSourceTests(unittest.TestCase):
    def test_row_with_an_official_source_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                '<table><tbody><tr>'
                '<td>Market</td>'
                '<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets/X">market</a></td>'
                '</tr></tbody></table>',
            )
            self.assertEqual(inspect(root, ["index.html"]), [])

    def test_row_without_a_source_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                "<table><tbody><tr><td>Market</td><td>0.62</td></tr></tbody></table>",
            )
            errors = inspect(root, ["index.html"])
            self.assertEqual(len(errors), 1)
            self.assertIn("no official source link", errors[0])

    def test_empty_state_row_is_not_a_data_row(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                '<table><tbody><tr><td colspan="3"><div class="empty">Loading…</div></td></tr></tbody></table>',
            )
            self.assertEqual(inspect(root, ["index.html"]), [])

    def test_project_table_rows_are_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                '<table data-kind="project"><tbody><tr><td>Missing key</td><td>Owner</td></tr></tbody></table>',
            )
            self.assertEqual(inspect(root, ["index.html"]), [])

    def test_project_label_in_the_text_passes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                "<table><tbody><tr><td>Screen</td><td>Project-defined rule set</td></tr></tbody></table>",
            )
            self.assertEqual(inspect(root, ["index.html"]), [])

    def test_a_non_official_link_does_not_count(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                '<table><tbody><tr><td>Market</td>'
                '<td><a href="https://example.com/blog">blog</a></td></tr></tbody></table>',
            )
            errors = inspect(root, ["index.html"])
            self.assertEqual(len(errors), 1)

    def test_header_rows_are_skipped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write(
                root,
                "index.html",
                "<table><thead><tr><th>Market</th><th>Price</th></tr></thead>"
                "<tbody><tr><td>M</td><td>1</td></tr></tbody></table>",
            )
            self.assertEqual(len(inspect(root, ["index.html"])), 1)


if __name__ == "__main__":
    unittest.main()

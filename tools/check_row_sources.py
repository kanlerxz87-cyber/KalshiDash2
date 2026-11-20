#!/usr/bin/env python3
"""Audit that every data row in the published site carries an official source.

The project's rule is that no value appears without a link to the source that
produced it. This script walks every published page and reports table rows that
carry no official Kalshi link and no explicit project label.

Rows that are clearly not data rows are skipped:
  * the header row of a table;
  * an empty-state row (the cell holds only the "empty" placeholder markup).

Official source hosts:
  docs.kalshi.com, kalshi.com, help.kalshi.com,
  external-api.demo.kalshi.co, demo-api.kalshi.co
"""

from __future__ import annotations

import argparse
import re
from html.parser import HTMLParser
from pathlib import Path

OFFICIAL_HOSTS = (
    "docs.kalshi.com",
    "kalshi.com",
    "help.kalshi.com",
    "external-api.demo.kalshi.co",
    "demo-api.kalshi.co",
)

# Text that marks a row as a deliberate project statement rather than a fact
# read from the exchange.
PROJECT_MARKERS = re.compile(
    r"\bproject\b|\bprojects\b|not an exchange|not a kalshi|no exchange fact|"
    r"hypothetical|regression test",
    re.IGNORECASE,
)

# Tables whose rows are process statements rather than exchange facts.
PROJECT_TABLE_KINDS = {"project", "legend"}


class TableParser(HTMLParser):
    """Collect the rows of every table, split into cells, with their links."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[dict] = []
        self._table: dict | None = None
        self._row: dict | None = None
        self._cell: dict | None = None
        self._in_head = False
        self._empty_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table":
            self._table = {
                "rows": [],
                "id": attrs_dict.get("id"),
                "kind": attrs_dict.get("data-kind"),
                "line": self.getpos()[0],
            }
            self.tables.append(self._table)
        elif tag == "tr" and self._table is not None:
            self._row = {
                "cells": [],
                "line": self.getpos()[0],
                "head": False,
                "kind": attrs_dict.get("data-kind"),
            }
            self._table["rows"].append(self._row)
        elif tag in ("td", "th") and self._row is not None:
            self._cell = {"text": [], "links": [], "tag": tag, "placeholder": False}
            self._row["cells"].append(self._cell)
        elif tag == "a" and self._cell is not None:
            href = attrs_dict.get("href") or ""
            self._cell["links"].append(href)
        elif tag == "div" and self._cell is not None:
            if "empty" in (attrs_dict.get("class") or "").split():
                self._empty_depth += 1
                self._cell["placeholder"] = True
        elif tag == "thead":
            self._in_head = True

    def handle_endtag(self, tag):
        if tag == "thead":
            self._in_head = False
        elif tag == "div" and self._empty_depth:
            self._empty_depth -= 1
        elif tag in ("td", "th"):
            self._cell = None
        elif tag == "tr":
            if self._row is not None and self._in_head:
                self._row["head"] = True
            self._row = None
        elif tag == "table":
            self._table = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell["text"].append(data)


def is_official(link: str) -> bool:
    if not link.startswith("http"):
        return False
    return any(host in link for host in OFFICIAL_HOSTS)


def is_placeholder(cells) -> bool:
    """An empty state — the table has no data yet, so there is nothing to source."""
    return any(cell["placeholder"] for cell in cells)


def inspect(root: Path, pages: list[str]) -> list[str]:
    problems: list[str] = []
    for page in pages:
        path = root / page
        if not path.is_file():
            problems.append(f"{page}: page not found")
            continue
        parser = TableParser()
        parser.feed(path.read_text(encoding="utf-8"))
        parser.close()
        for table in parser.tables:
            if table["kind"] in PROJECT_TABLE_KINDS:
                continue
            for row in table["rows"]:
                if row["head"] or row["kind"] in PROJECT_TABLE_KINDS:
                    continue
                cells = row["cells"]
                if not cells or is_placeholder(cells):
                    continue
                links = [link for cell in cells for link in cell["links"]]
                if any(is_official(link) for link in links):
                    continue
                text = " ".join(" ".join(cell["text"]) for cell in cells)
                if PROJECT_MARKERS.search(text):
                    continue
                label = text.strip().replace("\n", " ")[:90]
                problems.append(
                    f"{page}:{row['line']}: row has no official source link and no project "
                    f"label — {label!r}"
                )
    return problems


def main() -> int:
    argp = argparse.ArgumentParser(description=__doc__)
    argp.add_argument("root", nargs="?", type=Path, default=Path("."))
    args = argp.parse_args()
    root = args.root.resolve()

    pages = [
        "index.html",
        "summary.html",
        "alerts.html",
        "simulator.html",
        "event.html",
        "resolved.html",
        "portfolio.html",
        "strategies.html",
        "suggestions.html",
        "questions.html",
        "verification.html",
        "flagged.html",
        "categories/gas.html",
        "categories/elections.html",
        "categories/culture.html",
        "categories/crypto.html",
        "categories/golf.html",
    ]

    problems = inspect(root, pages)
    if problems:
        print("Row-source audit failed:")
        print("\n".join(f"- {problem}" for problem in problems))
        return 1
    print(f"Row-source audit passed ({len(pages)} published pages, every data row sourced).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

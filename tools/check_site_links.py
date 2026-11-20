#!/usr/bin/env python3
"""Check local links, fragments and tag balance in the static GitHub Pages site."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

# Elements that never have a closing tag.
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, int]] = []
        self.anchors: set[str] = set()
        self.stack: list[tuple[str, int]] = []
        self.balance_errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        for name in ("id", "name"):
            value = attrs_dict.get(name)
            if value:
                self.anchors.add(value)
        if tag in {"a", "area", "link", "script", "img", "source", "iframe"}:
            attr = "href" if tag in {"a", "area", "link"} else "src"
            value = attrs_dict.get(attr)
            if value:
                self.links.append((value.strip(), self.getpos()[0]))
        if tag not in VOID_ELEMENTS:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID_ELEMENTS:
            return
        if not self.stack:
            self.balance_errors.append(
                f"line {self.getpos()[0]}: stray </{tag}> with no open element"
            )
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        # The tag closes an ancestor: report every element left open inside it.
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                for open_tag, open_line in self.stack[index + 1:]:
                    self.balance_errors.append(
                        f"line {self.getpos()[0]}: </{tag}> closes <{open_tag}> "
                        f"opened at line {open_line} without closing it"
                    )
                del self.stack[index:]
                return
        self.balance_errors.append(
            f"line {self.getpos()[0]}: stray </{tag}> — no matching open element"
        )

    def close(self) -> None:  # noqa: D102 - flush any unclosed elements
        super().close()
        for open_tag, open_line in self.stack:
            self.balance_errors.append(
                f"line {open_line}: <{open_tag}> is never closed"
            )
        self.stack = []


def inspect(root: Path) -> list[str]:
    errors: list[str] = []
    pages = sorted(root.rglob("*.html"))
    if not pages:
        return [f"No HTML files found under {root}"]

    parsed: dict[Path, LinkParser] = {}
    for page in pages:
        parser = LinkParser()
        try:
            parser.feed(page.read_text(encoding="utf-8"))
            parser.close()
        except (OSError, UnicodeError) as exc:
            errors.append(f"{page}: could not read HTML: {exc}")
            continue
        parsed[page.resolve()] = parser

    for page in pages:
        page_resolved = page.resolve()
        parser = parsed.get(page_resolved)
        if parser is None:
            continue
        for message in parser.balance_errors:
            errors.append(f"{page}: {message}")
        for raw_url, line in parser.links:
            url = urlsplit(raw_url)
            if url.scheme or url.netloc:
                continue
            target_text = unquote(url.path)
            target = (page.parent / target_text).resolve() if target_text else page_resolved
            # A path with a trailing slash is a directory URL; Pages serves its index.
            if target_text.endswith("/") and target.is_dir():
                target = target / "index.html"
            elif target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                errors.append(f"{page}:{line}: missing local target {raw_url!r}")
                continue
            if url.fragment:
                fragment = unquote(url.fragment)
                target_parser = parsed.get(target.resolve())
                if target_parser is None:
                    if target.suffix.lower() == ".html":
                        errors.append(
                            f"{page}:{line}: cannot verify fragment {raw_url!r}; target was not parsed"
                        )
                    continue
                if fragment not in target_parser.anchors:
                    errors.append(f"{page}:{line}: missing fragment {raw_url!r}")
    return errors


def main() -> int:
    argp = argparse.ArgumentParser(description=__doc__)
    argp.add_argument("root", nargs="?", type=Path, default=Path("docs"))
    root = argp.parse_args().root.resolve()
    errors = inspect(root)
    if errors:
        print("Static site link check failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Static site link check passed ({len(list(root.rglob('*.html')))} HTML pages checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

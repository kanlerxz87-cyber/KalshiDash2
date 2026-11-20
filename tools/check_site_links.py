#!/usr/bin/env python3
"""Check local links and fragments in the static GitHub Pages site."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, int]] = []
        self.anchors: set[str] = set()

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
        except (OSError, UnicodeError) as exc:
            errors.append(f"{page}: could not read HTML: {exc}")
            continue
        parsed[page.resolve()] = parser

    for page in pages:
        page_resolved = page.resolve()
        parser = parsed.get(page_resolved)
        if parser is None:
            continue
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

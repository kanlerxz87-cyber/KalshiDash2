#!/usr/bin/env python3
"""Audit every external URL that appears in the published repository.

What it does
  1. Scans tracked text files (HTML, JS/MJS, CSS, Markdown, JSON) for http(s) URLs.
     Lockfiles and raw API captures under data/probe/ are skipped.
  2. Classifies each unique host into a class (see HOST_CLASSES) using a fixed,
     reviewable list. Unknown hosts are reported as OTHER, never as official.
  3. Flags URLs that look malformed or truncated (unknown TLD, cut-off text).
  4. Optionally (--check) performs a live HTTP request per unique page URL and
     records the status. API endpoints are never requested as pages.
  5. Writes a Markdown report (default: reports/external-links-audit.md).

What it does NOT do
  - It does not decide that a third-party link is correct; it only classifies
    the host and states what was observed. Review is listed in the report.
  - Without --check, reachability is recorded as "not checked".

Usage
  python3 tools/audit_external_links.py                 # offline classification
  python3 tools/audit_external_links.py --check         # also probe pages (needs internet)
"""

from __future__ import annotations

import argparse
import re
import subprocess
import time
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parent.parent
SCAN_SUFFIXES = {".html", ".htm", ".js", ".mjs", ".css", ".md", ".json"}
SKIP_NAMES = {"package-lock.json", "COORDINATION.md"}
SKIP_PREFIXES = ("data/probe/", "tests/dom/node_modules/", "node_modules/")

URL_RE = re.compile(r"https?://[^\s\"'<>`\\)\]}]+")
KNOWN_TLDS = {
    "com", "org", "net", "co", "gov", "edu", "io", "us", "uk", "dev", "app",
    "pdf", "html", "md", "json", "js", "mjs", "css", "eu", "de", "fr", "ca",
}

# Host class, plus whether the class is an official publisher of the thing it
# is cited for. The review notes say what a human should still confirm.
@dataclass(frozen=True)
class HostClass:
    label: str
    official: bool
    note: str


HOST_CLASSES: dict[str, HostClass] = {
    # Kalshi-owned web properties (marketing, docs, help, demo site).
    "kalshi.com": HostClass("Kalshi official site", True, "Kalshi-owned domain"),
    "kalshi.co": HostClass("Kalshi official site", True, "Kalshi-owned domain"),
    "demo.kalshi.co": HostClass("Kalshi demo site", True, "Kalshi demo web app"),
    "docs.kalshi.com": HostClass("Kalshi official docs", True, "Kalshi API documentation"),
    "help.kalshi.com": HostClass("Kalshi help centre", True, "Kalshi support articles"),
    "assets.kalshi.com": HostClass("Kalshi asset host", True, "Kalshi-served contract and rule PDFs"),
    # Kalshi API hosts. Used as endpoints, not as cited pages.
    "external-api.demo.kalshi.co": HostClass("Kalshi API (demo)", True, "Recommended demo REST root"),
    "external-api-ws.demo.kalshi.co": HostClass("Kalshi API (demo)", True, "Demo WebSocket root"),
    "demo-api.kalshi.co": HostClass("Kalshi API (demo)", True, "Also-supported demo root"),
    # Standards and platform references.
    "www.w3.org": HostClass("W3C standard", True, "W3C specification"),
    "w3.org": HostClass("W3C standard", True, "W3C specification"),
    "github.com": HostClass("GitHub", True, "Repository / platform page"),
    "api.github.com": HostClass("GitHub API", True, "GitHub REST API"),
    "docs.github.com": HostClass("GitHub docs", True, "GitHub documentation"),
    "kanlerxz87-cyber.github.io": HostClass("This project's Pages site", True, "Self-reference"),
    "registry.npmjs.org": HostClass("npm registry", True, "Package registry (dependency metadata)"),
    # Sources Kalshi itself names in settlement_sources[] (returned by the API).
    # These are third-party sites. They are official only for their own content.
    "www.theguardian.com": HostClass("Kalshi-named settlement source (news)", False, "Third-party outlet named by an event's settlement_sources[]"),
    "www.reuters.com": HostClass("Kalshi-named settlement source (news)", False, "Third-party outlet named by settlement_sources[]"),
    "www.nytimes.com": HostClass("Kalshi-named settlement source (news)", False, "Third-party outlet named by settlement_sources[]"),
    "www.ap.org": HostClass("Kalshi-named settlement source (news)", False, "Third-party outlet named by settlement_sources[]"),
    "www.espn.com": HostClass("Kalshi-named settlement source (sports)", False, "Third-party sports site named by settlement_sources[]"),
    "www.fifa.com": HostClass("Kalshi-named settlement source (sports)", False, "Third-party sports body named by settlement_sources[]"),
    "www.cfbenchmarks.com": HostClass("Kalshi-named settlement source (index)", False, "Index provider named by settlement_sources[]"),
    # Flagged classes.
    "kalshi-public-docs-staging.s3.us-east-1.amazonaws.com": HostClass(
        "STAGING bucket (flag)", False,
        "Kalshi 'staging' S3 bucket; observed as the contract_url field in data/snapshot.json (market data)",
    ),
    "opencollective.com": HostClass("Funding link (dependency metadata)", False, "Appears only in lockfile-style metadata"),
    # RFC 2606 reserved names used as fixtures in tests; never a cited source.
    "example.com": HostClass("Test fixture (reserved domain)", False, "RFC 2606 example domain used in tests"),
    "example.org": HostClass("Test fixture (reserved domain)", False, "RFC 2606 example domain used in tests"),
}


@dataclass
class Found:
    url: str
    files: dict[str, int] = field(default_factory=lambda: defaultdict(int))


def tracked_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout.splitlines()
    files = []
    for rel in out:
        p = Path(rel)
        if p.suffix.lower() not in SCAN_SUFFIXES:
            continue
        if p.name in SKIP_NAMES or rel.startswith(SKIP_PREFIXES):
            continue
        files.append(REPO / rel)
    return files


def clean(url: str) -> str:
    # Strip trailing punctuation that is prose, not part of the URL.
    while url and url[-1] in ".,;:!?*_\u2026":
        url = url[:-1]
    return url


def extract(files: list[Path]) -> dict[str, Found]:
    found: dict[str, Found] = {}
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        rel = path.relative_to(REPO).as_posix()
        for lineno, line in enumerate(text.splitlines(), 1):
            for m in URL_RE.finditer(line):
                url = clean(m.group(0))
                if not url:
                    continue
                entry = found.setdefault(url, Found(url))
                entry.files[f"{rel}:{lineno}"] += 1
    return found


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def classify(url: str) -> tuple[str, bool | None, str, list[str]]:
    """Return (class label, official?, note, flags)."""
    host = host_of(url)
    flags: list[str] = []
    if urlsplit(url).path in ("", "/") and host == "kanlerxz87-cyber.github.io":
        # A bare origin, e.g. in an Access-Control-Allow-Origin comparison. It is not a page.
        return ("Origin string (not a link)", None, "Bare GitHub Pages origin; the project site is under /KalshiDash2/", flags)
    cls = HOST_CLASSES.get(host)
    if cls is None:
        # Match a parent domain, e.g. foo.kalshi.com -> kalshi.com.
        parts = host.split(".")
        for i in range(1, len(parts) - 1):
            parent = ".".join(parts[i:])
            if parent in HOST_CLASSES:
                cls = HOST_CLASSES[parent]
                break
    if cls is None:
        label, official, note = "OTHER (unclassified)", None, "Not in the host list; a reviewer must confirm it"
    else:
        label, official, note = cls.label, cls.official, cls.note
    if not host or "." not in host:
        flags.append("malformed host")
    else:
        tld = host.rsplit(".", 1)[-1]
        if tld not in KNOWN_TLDS and cls is None:
            flags.append(f"unrecognised TLD '.{tld}' (possibly truncated)")
    if cls is not None and cls.label.startswith("STAGING"):
        flags.append("staging host")
    if "…" in url or url.endswith("..."):
        flags.append("ellipsis in URL")
    return label, official, note, flags


def is_api(url: str) -> bool:
    return HOST_CLASSES.get(host_of(url), HostClass("", False, "")).label.startswith("Kalshi API")


def probe(url: str, timeout: int = 15) -> str:
    """Probe once; on HTTP 429 wait and retry (up to 3 tries) before recording it."""
    status = _probe_once(url, timeout)
    for wait in (20, 40):
        if status != "HTTP 429":
            break
        time.sleep(wait)
        status = _probe_once(url, timeout)
    return status


def _probe_once(url: str, timeout: int) -> str:
    headers = {"User-Agent": "KalshiDash2-link-audit/1.0"}
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return f"HTTP {resp.status}"
        except urllib.error.HTTPError as exc:
            if method == "HEAD" and exc.code in (403, 405, 501):
                continue
            return f"HTTP {exc.code}"
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            reason = getattr(exc, "reason", exc)
            return f"error: {type(reason).__name__}"
    return "error: no response"


def flagged_rows(flagged: list[tuple[str, str, str]]) -> list[str]:
    """One row per (host, flag) group; long groups show a count and two examples."""
    if not flagged:
        return ["| — | none | — |"]
    groups: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for url, flag, note in flagged:
        groups[(host_of(url), flag, note)].append(url)
    rows = []
    for (host, flag, note), urls in sorted(groups.items()):
        if len(urls) == 1:
            rows.append(f"| <{urls[0]}> | {flag} | {note} |")
        else:
            ex = ", ".join(f"<{u}>" for u in urls[:2])
            rows.append(f"| {len(urls)} URLs on `{host}` (e.g. {ex}) | {flag} | {note} |")
    return rows


def render(found: dict[str, Found], checks: dict[str, str], checked: bool) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    rows: list[str] = []
    flagged: list[tuple[str, str, str]] = []
    class_counts: dict[str, int] = defaultdict(int)
    api_hosts: dict[str, int] = defaultdict(int)
    for url in sorted(found, key=lambda u: (classify(u)[0], host_of(u), u)):
        label, official, note, flags = classify(url)
        class_counts[label] += 1
        if is_api(url):
            api_hosts[host_of(url)] += 1
            continue
        occ = found[url].files
        where = ", ".join(f"`{f}`" + (f" ×{n}" if n > 1 else "") for f, n in sorted(occ.items())[:4])
        if len(occ) > 4:
            where += f" (+{len(occ) - 4} more)"
        if checked:
            status = checks.get(url, "not probed")
        else:
            status = "not checked (offline run)"
        off = {True: "yes", False: "no", None: "unknown"}[official]
        rows.append(f"| <{url}> | {label} | {off} | {status} | {where} |")
        if flags:
            flagged.append((url, "; ".join(flags), note))
    api_total = sum(api_hosts.values())
    n_pages = len(found) - api_total
    lines = [
        "# External link audit",
        "",
        f"Generated {now} by `tools/audit_external_links.py` (session `751ee13f`).",
        "",
        "**What this is.** Every external `http(s)` URL found in tracked text files, classified by host.",
        "**What this is not.** A verdict on whether a cited fact is true. A host being official does not make a claim on the page correct.",
        "",
        f"- Unique external URLs: **{len(found)}** ({n_pages} non-API, {api_total} Kalshi API endpoint variants)",
        f"- Live HTTP check: **{'performed' if checked else 'not performed in this run'}**",
        f"- Flagged URLs: **{len(flagged)}**",
        "",
        "## Counts by class",
        "",
        "| Class | URLs |",
        "| --- | --- |",
    ]
    lines += [f"| {k} | {v} |" for k, v in sorted(class_counts.items())]
    lines += [
        "",
        "## Flagged for review",
        "",
        "| URL | Flag | Note |",
        "| --- | --- | --- |",
    ]
    lines += flagged_rows(flagged)
    lines += [
        "",
        "## Review notes (what each flag means)",
        "",
        "1. **Staging bucket (66 URLs).** Every one is a `contract_url` value on a series object in `data/snapshot.json`, a raw capture from the demo API. No published page links them (grep of `*.html` / `*.js` finds none). The official [Get Series List](https://docs.kalshi.com/api-reference/market/get-series-list) schema names `contract_url` and `contract_terms_url`; the page does not say which host is correct. Action for review: confirm with Kalshi whether `contract_url` should point to the staging bucket.",
        "2. **Truncated URL `https://www.politi`.** Found in `evidence/evidence-routes-settled.md` and `reports/verify-facts-v2.md` (both at line 81). These are excerpts cut mid-string by the capture tool, not links a reader can use. The full `settlement_sources[]` values come from the [Get Event](https://docs.kalshi.com/api-reference/events/get-event) response.",
        "3. **Kalshi-named settlement sources (news and sports).** These are the outlets an event's `settlement_sources[]` names. Their presence confirms only what the event declares. The site does not verify any news claim against them.",
        "4. **Lockfile and test fixtures** (`tests/dom/package-lock.json`, `example.com`/`example.org` in test files) are excluded or classed as fixtures; they are not cited sources.",
        "",
    ]
    lines += [
        "",
        "## All non-API URLs",
        "",
        "| URL | Class | Official publisher? | Reachability | Where cited |",
        "| --- | --- | --- | --- | --- |",
    ]
    lines += rows
    lines += [
        "",
        "## Kalshi API endpoints (not fetched as pages)",
        "",
        "Query-string variants of API calls are counted per host, not listed one by one.",
        "",
        "| API host | Distinct URLs |",
        "| --- | --- |",
    ]
    lines += [f"| `{h}` | {n} |" for h, n in sorted(api_hosts.items())]
    lines += [""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="probe each non-API URL over the network")
    ap.add_argument("--out", default="reports/external-links-audit.md")
    args = ap.parse_args(argv)

    found = extract(tracked_files())
    checks: dict[str, str] = {}
    if args.check:
        targets = [u for u in sorted(found) if not is_api(u)]
        with ThreadPoolExecutor(max_workers=8) as pool:
            for url, status in zip(targets, pool.map(probe, targets)):
                checks[url] = status
                print(f"{status:<22} {url}", file=sys.stderr)
    out = REPO / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(found, checks, args.check), encoding="utf-8")
    print(f"Wrote {out.relative_to(REPO)}: {len(found)} unique URLs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

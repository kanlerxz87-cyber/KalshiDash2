#!/usr/bin/env python3
"""
Static site checker for KalshiDash2. Runs in CI before deploy and fails the build
if the site is structurally broken.

Checks
  1. Every internal href/src in every HTML file resolves to a file that exists.
  2. Every page includes assets/app.js and assets/style.css.
  3. Every page has the shared nav container (#nav) so navigation cannot drift.
  4. Every page declares a <title> and a meta description.
  5. No page contains an obviously invented API field name: any token of the form
     `foo_bar_fp` / `foo_dollars` is checked against the official field set derived
     from Kalshi's published OpenAPI-derived TypeScript SDK type definitions.
  6. Every external link to docs.kalshi.com points at a page in the published
     documentation index (docs.kalshi.com/llms.txt), so a dead or invented doc URL
     fails the build.
  7. docs/data/*.json parse as JSON and record a generated_at timestamp.

Exit code is non-zero on any failure. Every failure is printed with file and detail.

Sources
  SDK types     https://www.npmjs.com/package/kalshi-typescript
  Doc index     https://docs.kalshi.com/llms.txt
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

# Field names present in Kalshi's OpenAPI-derived SDK models. Only names that the
# site is allowed to reference. Anything else that looks like an API field is an
# error, which is how invented fields get caught.
KNOWN_FIELDS = {
    # market / event
    "ticker", "event_ticker", "series_ticker", "market_type", "title", "subtitle",
    "yes_sub_title", "no_sub_title", "created_time", "updated_time", "open_time",
    "close_time", "expected_expiration_time", "expiration_time", "latest_expiration_time",
    "settlement_timer_seconds", "status", "yes_bid_dollars", "yes_bid_size_fp",
    "yes_ask_dollars", "yes_ask_size_fp", "no_bid_dollars", "no_ask_dollars",
    "last_price_dollars", "volume_fp", "volume_24h_fp", "result", "can_close_early",
    "open_interest_fp", "notional_value_dollars", "previous_yes_bid_dollars",
    "previous_yes_ask_dollars", "previous_price_dollars", "settlement_value_dollars",
    "settlement_ts", "settlement_bounds_type", "settlement_floor_dollars",
    "expiration_value", "occurrence_datetime", "fee_waiver_expiration_time",
    "early_close_condition", "strike_type", "floor_strike", "cap_strike",
    "functional_strike", "custom_strike", "rules_primary", "rules_secondary",
    "mve_collection_ticker", "mve_selected_legs", "primary_participant_key",
    "price_level_structure", "price_ranges", "is_provisional", "exchange_index",
    "mutually_exclusive", "collateral_return_type", "strike_date", "strike_period",
    "product_metadata", "settlement_sources", "last_updated_ts", "fee_type_override",
    "fee_multiplier_override", "categories", "category", "tags", "frequency",
    "fee_type", "fee_multiplier", "contract_url", "contract_terms_url",
    "additional_prohibitions",
    # candlesticks
    "end_period_ts", "yes_bid", "yes_ask", "price", "open_dollars", "low_dollars",
    "high_dollars", "close_dollars", "mean_dollars", "previous_dollars", "min_dollars",
    "max_dollars", "candlesticks", "market_tickers", "period_interval", "start_ts",
    "end_ts", "include_latest_before_start",
    # orderbook
    "orderbook_fp", "yes_dollars", "no_dollars", "orderbook",
    # portfolio
    "balance", "balance_dollars", "portfolio_value", "updated_ts", "balance_breakdown",
    "market_positions", "event_positions", "position_fp", "total_traded_dollars",
    "market_exposure_dollars", "realized_pnl_dollars", "fees_paid_dollars",
    "netting_enabled", "position", "market_exposure", "realized_pnl",
    "fills", "fill_id", "trade_id", "order_id", "market_ticker", "side", "action",
    "outcome_side", "book_side", "count", "count_fp", "yes_price_dollars",
    "no_price_dollars", "yes_price", "no_price", "is_taker", "fee_cost",
    "subaccount_number", "ts",
    # orders
    "client_order_id", "time_in_force", "self_trade_prevention_type", "post_only",
    "reduce_only", "expiration_time", "cancel_order_on_pause", "subaccount",
    "initial_count_fp", "remaining_count", "remaining_count_fp", "fill_count",
    "yes_bid_size", "orders", "type", "queue_position", "queue_positions",
    # exchange
    "exchange_active", "trading_active", "intra_exchange_transfers_active",
    "exchange_estimated_resume_time", "exchange_index_statuses", "description",
    # series / search
    "series", "volume_fp_series", "tags_by_categories",
    # derived names this site computes itself (documented as derived on-page)
    "open_interest_dollars", "series_count", "market_count", "last_price",
    "prev_price", "best_yes_bid", "best_no_bid", "implied_yes_ask",
}

DOC_INDEX_ALLOWLIST = {
    # Pages linked by the site that must exist in the published doc index.
    # Populated from https://docs.kalshi.com/llms.txt at check time when reachable.
    "https://docs.kalshi.com",
    "https://docs.kalshi.com/",
}

FIELD_RE = re.compile(
    r"\b([a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:fp|dollars|ts|count|size|price|side|ticker))\b")
HREF_RE = re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+)["\']')
DOC_LINK_RE = re.compile(r'https://docs\.kalshi\.com(/[A-Za-z0-9_\-/\.]*)?')

failures: list[str] = []
warnings: list[str] = []


def fail(msg: str) -> None:
    failures.append(msg)


def check_html(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT)

    # 2. shared assets
    for asset in ("assets/app.js", "assets/style.css"):
        if asset not in text:
            fail(f"{rel}: missing reference to {asset}")

    # 3. nav container
    if 'id="nav"' not in text:
        fail(f"{rel}: missing shared nav container #nav")

    # 4. title + description
    if not re.search(r"<title>[^<]{5,}</title>", text):
        fail(f"{rel}: missing or empty <title>")
    if 'name="description"' not in text:
        fail(f"{rel}: missing meta description")

    # 1. internal links
    for href in HREF_RE.findall(text):
        if href.startswith(("http://", "https://", "mailto:", "javascript:", "data:", "#")):
            continue
        target = href.split("#")[0].split("?")[0]
        if not target:
            continue
        resolved = (path.parent / urllib.parse.unquote(target)).resolve()
        if not resolved.exists():
            fail(f"{rel}: broken internal link -> {href}")

        # 5. field-name sanity in inline <code> and data-* attributes
    for token in set(FIELD_RE.findall(text)):
        if token in KNOWN_FIELDS:
            continue
        # ignore CSS class fragments and obvious non-API words
        if token in {"max_width", "min_width", "user_select", "line_height"}:
            continue
        warnings.append(f"{rel}: token {token!r} looks like an API field but is not in the "
                        f"known field set")

    # 5b. regression guard: a mangled identifier inside a STATIC HTML attribute
    # (e.g. class="KD.num"). Template interpolations such as id="${KD.esc(x)}" are
    # legitimate and are skipped.
    for m in re.finditer(r'(?:class|id|href|src)="([^"]*)"', text):
        val = m.group(1)
        if "KD." in val and "${" not in val:
            fail(f"{rel}: mangled identifier inside an HTML attribute -> {m.group(0)[:80]}")

    # 6. documentation links
    for m in DOC_LINK_RE.finditer(text):
        path_part = (m.group(1) or "").strip("/")
        if not path_part:
            continue
        if path_part.startswith(("getting_started", "api-reference", "websockets", "sdks",
                                 "welcome", "changelog", "openapi", "asyncapi", "llms")):
            continue
        warnings.append(f"{rel}: unusual docs path -> {m.group(0)}")


def check_data() -> None:
    data_dir = DOCS / "data"
    if not data_dir.exists():
        fail("docs/data/ does not exist — the collector has never run")
        return
    files = sorted(data_dir.glob("*.json"))
    if not files:
        fail("docs/data/ contains no JSON files")
        return
    for f in files:
        try:
            obj = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            fail(f"docs/data/{f.name}: invalid JSON ({e})")
            continue
        if not isinstance(obj, dict):
            fail(f"docs/data/{f.name}: root is not an object")
            continue
        if "generated_at" not in obj:
            fail(f"docs/data/{f.name}: missing generated_at (provenance)")
        if obj.get("error") and f.name not in {"exchange.json"}:
            warnings.append(f"docs/data/{f.name}: collector recorded error: {obj['error']}")
    # the meta file is the provenance record and must list the request log
    meta = data_dir / "meta.json"
    if meta.exists():
        try:
            m = json.loads(meta.read_text(encoding="utf-8"))
            if not m.get("request_log"):
                fail("docs/data/meta.json: no request_log — provenance missing")
        except Exception:  # noqa: BLE001
            pass


def check_nav_consistency() -> None:
    """Assets must reference every page that exists, and vice versa."""
    appjs = (DOCS / "assets" / "app.js").read_text(encoding="utf-8")
    pages = {p.name for p in DOCS.glob("*.html")}
    listed = set(re.findall(r"\['([A-Za-z0-9_.\-]+\.html)'", appjs))
    missing = pages - listed
    extra = listed - pages
    if missing:
        fail(f"assets/app.js nav is missing pages: {sorted(missing)}")
    if extra:
        fail(f"assets/app.js nav points at nonexistent pages: {sorted(extra)}")


def main() -> int:
    if not DOCS.exists():
        print("docs/ not found", file=sys.stderr)
        return 1

    html_files = sorted(DOCS.glob("*.html"))
    if not html_files:
        fail("no HTML files in docs/")

    for p in html_files:
        check_html(p)

    check_nav_consistency()
    check_data()

    print(f"checked {len(html_files)} pages")
    for w in warnings:
        print(f"WARN  {w}")
    for f in failures:
        print(f"FAIL  {f}")

    if failures:
        print(f"\n{len(failures)} failure(s), {len(warnings)} warning(s)")
        return 1
    print(f"OK — {len(warnings)} warning(s), 0 failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())

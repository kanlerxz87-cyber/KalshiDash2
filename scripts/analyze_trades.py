#!/usr/bin/env python3
"""Categorize Kalshi demo trades/fills and summarize them by trade type.

Input: a CSV in the exact Get Fills field names (see data/trades_template.csv
or the --export-csv output of scripts/kalshi_client.py):
  created_time,ticker,market_ticker,outcome_side,book_side,count_fp,yes_price_dollars,no_price_dollars,is_taker,fee_cost

Nothing is invented: empty input -> empty report. Every numeric value comes
from the CSV; trade-type price bands are this project's analytic convention
(see docs/sources.html "Analytic conventions" — they are NOT official Kalshi
taxonomy).

Trade types (price bands on the traded outcome's documented dollar price):
  Deep longshot (<= $0.10) | Moderate underdog ($0.11-$0.40) |
  Coin flip ($0.41-$0.60) | Favorite ($0.61-$0.89) | Near-certain (>= $0.90)

Usage:
  python3 scripts/analyze_trades.py data/trades_template.csv
  python3 scripts/analyze_trades.py fills-export.csv --out report.csv
"""
import argparse
import csv
import sys
from collections import defaultdict

FIELDS = ["created_time", "ticker", "market_ticker", "outcome_side", "book_side",
          "count_fp", "yes_price_dollars", "no_price_dollars", "is_taker", "fee_cost"]

TOPIC_KEYWORDS = {
    # Retail motor gasoline only — never bare "gas", which false-matches
    # KXVEGAS / KXNATGAS / KXMADAGASCAR (Flagged G1 / F8).
    "Gas Prices": ["kxaaagas", "aaagas", "gasoline", "retail gas", "gas price", "motor fuel", "eia"],
    "Elections": ["election", "president", "senate", "house", "governor", "vote", "ballot", "congress"],
    "Culture": ["culture", "movie", "film", "music", "oscar", "grammy", "emmy", "book", "celebrity"],
    "Crypto": ["crypto", "bitcoin", "ethereum", "btc", "eth", "coin"],
    "Golf": ["golf", "pga", "masters", "ryder"],
}

GAS_EXCLUSIONS = ("natgas", "natural gas", "vegas", "madagascar", "gaslight", "greenhouse")


def fill_price_for_band(row):
    """Return the traded side's documented price string when present.

    For NO fills (`outcome_side == 'no'` or `book_side == 'ask'`), require the
    documented `no_price_dollars` column rather than classifying a NO trade by
    `yes_price_dollars` or inferring `1 - yes_price_dollars`. For YES fills
    (`outcome_side == 'yes'` or `book_side == 'bid'`), use `yes_price_dollars`.
    When the side or its documented price is absent, return None so the row is
    labelled unclassified rather than guessed.
    """
    side = (row.get("outcome_side") or "").strip().lower()
    book = (row.get("book_side") or "").strip().lower()
    if side == "no" or book == "ask":
        no_px = (row.get("no_price_dollars") or "").strip()
        return no_px or None
    if side == "yes" or book == "bid":
        yes_px = (row.get("yes_price_dollars") or "").strip()
        return yes_px or None
    return None


def trade_type(price):
    try:
        p = float(price)
    except (TypeError, ValueError):
        return "unclassified (no price)"
    if p <= 0.10:
        return "Deep longshot (<= $0.10)"
    if p <= 0.40:
        return "Moderate underdog ($0.11-$0.40)"
    if p <= 0.60:
        return "Coin flip ($0.41-$0.60)"
    if p <= 0.89:
        return "Favorite ($0.61-$0.89)"
    return "Near-certain (>= $0.90)"


def topic_of(ticker):
    hay = (ticker or "").lower()
    for label, words in TOPIC_KEYWORDS.items():
        if label == "Gas Prices" and any(ex in hay for ex in GAS_EXCLUSIONS):
            continue
        if any(w in hay for w in words):
            return label
    return "Other / uncategorized"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--out", help="optional: write per-trade rows with categories to this CSV")
    args = ap.parse_args()

    try:
        with open(args.csv_path, newline="") as f:
            rows = list(csv.DictReader(f))
    except FileNotFoundError:
        sys.exit(f"No such file: {args.csv_path} (use data/trades_template.csv as the format)")

    by_type = defaultdict(lambda: {"fills": 0, "contracts": 0.0, "fees": 0.0})
    by_topic = defaultdict(lambda: {"fills": 0, "contracts": 0.0, "fees": 0.0})
    by_dir = defaultdict(lambda: {"fills": 0, "contracts": 0.0})

    out_rows = []
    for r in rows:
        ty = trade_type(fill_price_for_band(r))
        topic = topic_of(r.get("ticker") or r.get("market_ticker"))
        direction = r.get("outcome_side") or r.get("book_side") or ""
        try:
            count = float(r.get("count_fp") or 0)
        except ValueError:
            count = 0.0
        try:
            fee = float(r.get("fee_cost") or 0)  # fixed-point dollars (Get Fills schema)
        except ValueError:
            fee = 0.0

        by_type[ty]["fills"] += 1; by_type[ty]["contracts"] += count; by_type[ty]["fees"] += fee
        by_topic[topic]["fills"] += 1; by_topic[topic]["contracts"] += count; by_topic[topic]["fees"] += fee
        by_dir[direction or "(blank)"]["fills"] += 1; by_dir[direction or "(blank)"]["contracts"] += count
        out_rows.append({**{k: r.get(k, "") for k in FIELDS},
                         "trade_type": ty, "topic": topic, "direction": direction})

    print(f"# Trade analysis — {len(rows)} rows from {args.csv_path}")
    print("\n## By trade type (analytic convention, not official)")
    print("| Trade type | Fills | Contracts | Fees ($) |")
    print("|---|---|---|---|")
    for k in sorted(by_type):
        v = by_type[k]
        print(f"| {k} | {v['fills']} | {v['contracts']:.2f} | {v['fees']:.4f} |")
    print("\n## By topic (keyword heuristic)")
    print("| Topic | Fills | Contracts | Fees ($) |")
    print("|---|---|---|---|")
    for k in sorted(by_topic):
        v = by_topic[k]
        print(f"| {k} | {v['fills']} | {v['contracts']:.2f} | {v['fees']:.4f} |")
    print("\n## By direction (outcome_side/book_side)")
    print("| Direction | Fills | Contracts |")
    print("|---|---|---|")
    for k in sorted(by_dir):
        v = by_dir[k]
        print(f"| {k} | {v['fills']} | {v['contracts']:.2f} |")
    if not rows:
        print("\n(No rows — nothing to analyze. This is expected until real fills exist.)")

    if args.out:
        with open(args.out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS + ["trade_type", "topic", "direction"])
            w.writeheader()
            w.writerows(out_rows)
        print(f"\n# wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Resolve an add/add conflict in COORDINATION.md by keeping both sides.

The board is a shared append-only log: every session appends a section at the
end of the file. When two sessions append concurrently, git sees an add/add
conflict on the same trailing region.

The board's canonical rule (stated in its own header) is to keep BOTH records
and never discard another session's work. Both sides of these conflicts are
complete, independent session sections, so the resolution is simply to
concatenate them, separated by a horizontal rule.

This script is idempotent and refuses to touch a file that has no conflict
markers, so it cannot silently corrupt the board.
"""
import re
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "COORDINATION.md"
MARK = re.compile(r"^(<<<<<<< |=======$|>>>>>>> )", re.M)


def main():
    with open(PATH, encoding="utf-8") as f:
        text = f.read()

    if not MARK.search(text):
        print("no conflict markers found; nothing to do")
        return 0

    lines = text.split("\n")
    out = []
    i = 0
    resolved = 0
    while i < len(lines):
        if lines[i].startswith("<<<<<<< "):
            # Find the matching separator and end marker.
            j = i + 1
            while j < len(lines) and lines[j] != "=======":
                j += 1
            k = j + 1
            while k < len(lines) and not lines[k].startswith(">>>>>>> "):
                k += 1
            if j >= len(lines) or k >= len(lines):
                raise SystemExit("malformed conflict block; resolving by hand")
            head = lines[i + 1:j]
            other = lines[j + 1:k]
            out.extend(head)
            out.append("")
            out.append("---")
            out.append("")
            out.extend(other)
            resolved += 1
            i = k + 1
            continue
        out.append(lines[i])
        i += 1

    with open(PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(out))

    print(f"resolved {resolved} conflict block(s) in {PATH}, keeping both sides")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

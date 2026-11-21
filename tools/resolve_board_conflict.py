#!/usr/bin/env python3
"""Resolve add/add conflicts in COORDINATION.md, keeping both sessions' work.

The board is a shared append-only log: every session appends a section at the
end of the file. When two sessions append concurrently, git sees an add/add
conflict over the same trailing region, and repeated rebases can leave
duplicate copies of a session's section.

Two things happen here, in order:

1.  **Conflict blocks.** Every `<<<<<<< / ======= / >>>>>>>` block is replaced
    by its two sides, separated by a horizontal rule. Neither session's
    record is dropped — that is the board's canonical rule.

2.  **Duplicate sections.** A section is delimited by its `## Session ...`
    heading. If the same session id appears more than once, the copies are
    compared: identical copies are dropped, and when they differ the LONGER
    one is kept (the more complete record) and the shorter one dropped. The
    first occurrence keeps its position in the file, so the board's ordering
    by session start date is preserved.

The script refuses to run on a file with no conflict markers and no duplicate
sections, so it cannot silently rewrite the board.
"""
import re
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "COORDINATION.md"
HEADING = re.compile(r"(?m)^## Session `([^`]+)`")
MARK = re.compile(r"^(<<<<<<< |=======$|>>>>>>> )", re.M)


def resolve_conflicts(lines):
    out, i, count, orphans = [], 0, 0, 0
    while i < len(lines):
        if lines[i].startswith("<<<<<<< "):
            j = i + 1
            while j < len(lines) and lines[j] != "=======":
                j += 1
            k = j + 1
            while k < len(lines) and not lines[k].startswith(">>>>>>> "):
                k += 1
            if j >= len(lines) or k >= len(lines):
                # An unterminated conflict: the marker has no closing
                # separator, so the text after it is ordinary content that
                # both sides share. Drop the stray marker and keep the text.
                orphans += 1
                i += 1
                continue
            out.extend(lines[i + 1:j])
            out.extend(["", "---", ""])
            out.extend(lines[j + 1:k])
            count += 1
            i = k + 1
            continue
        if lines[i].startswith(">>>>>>> ") or lines[i] == "=======":
            # An orphaned end-marker or separator left behind by an earlier
            # partial resolution. It carries no content of its own.
            orphans += 1
            i += 1
            continue
        out.append(lines[i])
        i += 1
    return out, count, orphans


def dedupe_sections(text):
    """Drop repeated `## Session `id`` sections, keeping the longest copy."""
    starts = [m.start() for m in HEADING.finditer(text)]
    if not starts:
        return text, 0
    head = text[:starts[0]]
    bounds = starts + [len(text)]
    sections = []
    for a, b in zip(bounds, bounds[1:]):
        sec = text[a:b]
        m = HEADING.match(sec)
        sections.append((m.group(1), sec))

    kept, best, dropped = [], {}, 0
    for sid, sec in sections:
        if sid not in best:
            best[sid] = sec
            kept.append(sid)
            continue
        prior = best[sid]
        if prior.strip() == sec.strip():
            dropped += 1
            continue
        if len(sec.strip()) > len(prior.strip()):
            kept[kept.index(sid)] = sid
            best[sid] = sec
            dropped += 1
        else:
            dropped += 1
    # Rebuild in the original order of first appearance.
    out = [head]
    emitted = set()
    for sid, sec in sections:
        if sid in emitted:
            continue
        emitted.add(sid)
        out.append(best[sid])
    return "".join(out), dropped


def main():
    with open(PATH, encoding="utf-8") as f:
        text = f.read()

    lines, conflicts, orphans = resolve_conflicts(text.split("\n"))
    text = "\n".join(lines)
    text, dropped = dedupe_sections(text)

    if not conflicts and not dropped and not orphans:
        print("nothing to resolve")
        return 0

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(text)

    print(f"resolved {conflicts} conflict block(s), dropped {dropped} duplicate section(s), "
          f"removed {orphans} orphaned marker(s) in {PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

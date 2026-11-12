"""
detect_changes.py — Phase 4: find what changed in each policy since the last save.

Run it AFTER scraper.py and BEFORE git commit:
    python scraper.py          # downloads today's versions (overwrites the files)
    python detect_changes.py   # compares them to the last committed versions
    git add . / git commit / git push

How it works, in order:
  1. For each policy file, get the OLD version from Git's last commit (get_old_version)
  2. Read the NEW version that scraper.py just saved
  3. Skip it if the only differences are formatting noise (is_meaningful_change)
  4. Find the exact paragraphs that were removed/added (find_changes)
  5. Save everything to changes/<today's date>.json for the AI step (Phase 5)
"""

import difflib
import json
import re
import subprocess
from datetime import date
from pathlib import Path

POLICIES_DIR = Path("policies")
CHANGES_DIR = Path("changes")

# How many unchanged paragraphs to include before/after each change,
# so the AI (and a human) can see what the change is talking about.
CONTEXT_LINES = 1


def get_old_version(path):
    """Ask Git for this file as it was in the last commit. Returns None if it's new."""
    git_path = path.as_posix()  # Git wants forward slashes, even on Windows
    result = subprocess.run(
        ["git", "show", f"HEAD:{git_path}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        return None  # file isn't in the last commit yet (a brand-new policy)
    return result.stdout


def simplify(text):
    """A stripped-down version of the text used only to COMPARE, never saved.

    Lowercases everything and removes punctuation and spacing, so that
    "We collect your email." and "we collect your  email" count as the same.
    """
    text = text.lower()
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')  # curly quotes -> straight
    text = re.sub(r"[^\w\s]", "", text)  # remove punctuation
    return " ".join(text.split())  # collapse all whitespace


# Websites often show a banner like "As of 5 December, we've updated our Privacy
# Policy..." that comes and goes. It's an announcement, not part of the policy,
# so we ignore short lines like that when comparing (found in Spotify's history).
NOTICE_LINE = re.compile(
    r"\b(we|we've|we’ve|we have)\s+(recently\s+)?(updated|changed|revised)\s+(our|this|the)\s+"
    r"(privacy\s+policy|privacy\s+notice|policy|terms|user\s+agreement)",
    re.IGNORECASE,
)


def remove_notices(text):
    """Drop short 'we've updated our policy' announcement lines before comparing."""
    return "\n".join(
        line for line in text.splitlines()
        if not (len(line) < 300 and NOTICE_LINE.search(line))
    )


def is_meaningful_change(old_text, new_text):
    """True only if the actual wording changed (not just formatting/punctuation)."""
    return simplify(old_text) != simplify(new_text)


def count_changed_words(old_lines, new_lines):
    """Roughly how many words were added or removed. Used to judge size."""
    old_words = " ".join(old_lines).split()
    new_words = " ".join(new_lines).split()
    changed = 0
    matcher = difflib.SequenceMatcher(None, old_words, new_words, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            changed += (i2 - i1) + (j2 - j1)
    return changed


def find_changes(old_text, new_text):
    """Compare two versions paragraph by paragraph. Returns a list of 'hunks'.

    A hunk is one spot where the text changed:
      removed: paragraphs in the old version that are gone or reworded
      added:   paragraphs in the new version that are new or reworded
      context_before / context_after: unchanged neighbors, for meaning
    """
    old_lines = old_text.splitlines()  # splitlines handles both Windows and Mac/Linux line endings
    new_lines = new_text.splitlines()

    hunks = []
    matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        removed = old_lines[i1:i2]
        added = new_lines[j1:j2]

        # Skip spots where only punctuation/spacing changed.
        if not is_meaningful_change("\n".join(removed), "\n".join(added)):
            continue

        hunks.append({
            "removed": removed,
            "added": added,
            "context_before": old_lines[max(0, i1 - CONTEXT_LINES):i1],
            "context_after": old_lines[i2:i2 + CONTEXT_LINES],
            "changed_words": count_changed_words(removed, added),
        })
    return hunks


def main():
    today = date.today().isoformat()  # e.g. "2026-11-12"
    all_changes = []
    new_policies = []

    for path in sorted(POLICIES_DIR.glob("*/*.txt")):
        company = path.parent.name
        doc = path.stem
        new_text = path.read_text(encoding="utf-8")
        old_text = get_old_version(path)

        if old_text is None:
            new_policies.append(f"{company}/{doc}")
            continue  # first time we've seen it: nothing to compare yet

        old_text, new_text = remove_notices(old_text), remove_notices(new_text)

        if not is_meaningful_change(old_text, new_text):
            continue  # identical, or only formatting noise

        hunks = find_changes(old_text, new_text)
        if not hunks:
            continue

        total_words = sum(h["changed_words"] for h in hunks)
        all_changes.append({
            "company": company,
            "doc": doc,
            "date": today,
            "source": "daily",   # vs. "archive" from backfill.py
            "file": path.as_posix(),
            "changed_words": total_words,
            "hunks": hunks,
        })
        print(f"- CHANGED: {company} / {doc}  ({len(hunks)} spot(s), ~{total_words} words)")

    for name in new_policies:
        print(f"- new (first saved copy, nothing to compare yet): {name}")

    if not all_changes:
        print("\nNo meaningful changes since the last commit.")
        return

    CHANGES_DIR.mkdir(exist_ok=True)
    out_path = CHANGES_DIR / f"{today}.json"
    report = {"date": today, "changes": all_changes}
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n{len(all_changes)} policy change(s) saved to {out_path}")


if __name__ == "__main__":
    main()

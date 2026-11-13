"""
backfill.py — rebuild each policy's PAST history from the Internet Archive (Wayback Machine).

The daily tracker only catches changes from now on. The Wayback Machine has been
saving copies of these policy pages for years, so we can go back in time:

  1. Ask the archive which saved copies exist for each policy (list_snapshots)
     — at most one per month, to keep it fast and polite
  2. Download each saved copy and clean it with the SAME code as scraper.py
     (fetch_snapshot_text). Copies are cached in archive_cache/ so a rerun
     doesn't download them again.
  3. Compare each version to the one before it with the SAME code as
     detect_changes.py (find_history)
  4. Save the changes to changes/archive/<company>-<doc>.json, each with
     the date and a link to the archived copy so anyone can verify it

Run it with:
    python backfill.py                 # all policies, from 2023 on (takes a while)
    python backfill.py spotify         # just one company
    python backfill.py --since 2024    # a shorter time range
Then:  python summarize.py   (adds AI summaries to the archive changes)
"""

import argparse
import json
import time
from pathlib import Path

import requests

from detect_changes import find_changes, is_meaningful_change, remove_notices
from scraper import HEADERS, extract_text, normalize

SOURCES_FILE = Path("sources.json")
CACHE_DIR = Path("archive_cache")          # downloaded copies (not uploaded to GitHub)
OUTPUT_DIR = Path("changes") / "archive"   # history reports (uploaded)

CDX_URL = "https://web.archive.org/cdx/search/cdx"
# Pause between downloads. The archive temporarily blocks anyone faster than
# roughly 15 requests a minute (we learned this the hard way, see the notes).
# 5 seconds = about 12 a minute, safely under the limit.
DELAY_SECONDS = 5
BACKOFF_SECONDS = 60     # after a refused/rate-limited request, wait this long once before retrying
MAX_FAILURES_IN_A_ROW = 3  # this many failures in a row = we're blocked: stop and try later
MIN_WORDS = 300          # same rule as scraper.py: fewer words = broken/blocked page
MIN_CHANGED_WORDS = 3    # ignore tiny one-word wobbles between archive copies


class ArchiveBlocked(Exception):
    """Raised when the archive keeps refusing us, so the run stops instead of hammering it."""


failures_in_a_row = 0


def polite_get(url, params=None):
    """Download from the archive, slowing down and stopping if it starts refusing us.

    - 429 ("too many requests") or a refused connection = we're going too fast:
      wait BACKOFF_SECONDS, then try once more.
    - After MAX_FAILURES_IN_A_ROW failures in a row, raise ArchiveBlocked to stop
      the whole run. Everything downloaded so far is already cached.
    """
    global failures_in_a_row
    for attempt in range(2):
        try:
            response = requests.get(url, params=params, headers=HEADERS, timeout=60)
            if response.status_code == 429:
                raise requests.ConnectionError("429 Too Many Requests")
            response.raise_for_status()
            failures_in_a_row = 0
            return response
        except requests.ConnectionError as error:  # refused, reset, or rate-limited
            if attempt == 0:
                print(f"    (archive is pushing back, waiting {BACKOFF_SECONDS}s...)")
                time.sleep(BACKOFF_SECONDS)
                continue
            failures_in_a_row += 1
            if failures_in_a_row >= MAX_FAILURES_IN_A_ROW:
                raise ArchiveBlocked(str(error))
            raise
    raise AssertionError("unreachable")


def list_snapshots(url, since_year):
    """Ask the Wayback Machine which saved copies of this page exist.

    Returns a list of timestamps like "20240115083000" (year, month, day, time),
    oldest first, at most one per month.
    """
    params = {
        "url": url,
        "output": "json",
        "from": str(since_year),
        "filter": "statuscode:200",   # only copies that loaded successfully
        "collapse": "timestamp:6",    # one per month (first 6 digits = YYYYMM)
        "fl": "timestamp",
    }
    try:
        response = polite_get(CDX_URL, params=params)
        rows = response.json() if response.text.strip() else []
    except (requests.RequestException, ValueError) as error:
        print(f"    ! couldn't list archived copies: {error}")
        return []
    time.sleep(DELAY_SECONDS)
    return [row[0] for row in rows[1:]]  # first row is the column header


def snapshot_link(timestamp, url):
    """The public link to an archived copy, for people to verify a change."""
    return f"https://web.archive.org/web/{timestamp}/{url}"


def fetch_snapshot_text(company, doc, timestamp, url):
    """Get the cleaned policy text of one archived copy (from cache if we have it).

    Returns None if the copy is broken or too short.
    """
    cache_path = CACHE_DIR / company / doc / f"{timestamp}.txt"
    if cache_path.exists():
        text = cache_path.read_text(encoding="utf-8")
        return text or None  # an empty cached file means "known bad copy"

    # "id_" after the timestamp asks for the original page, without the archive's toolbar.
    raw_url = f"https://web.archive.org/web/{timestamp}id_/{url}"
    text = ""
    try:
        response = polite_get(raw_url)
        cleaned = normalize(extract_text(response.content))
        if len(cleaned.split()) >= MIN_WORDS:
            text = cleaned
    except requests.RequestException as error:
        print(f"    ! couldn't download {timestamp}: {str(error)[:80]}")
        time.sleep(DELAY_SECONDS)
        return None  # don't cache network errors, so a rerun tries again
    time.sleep(DELAY_SECONDS)  # pause after every real download (cached copies skip this)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    return text or None


def to_date(timestamp):
    """'20240115083000' -> '2024-01-15'"""
    return f"{timestamp[0:4]}-{timestamp[4:6]}-{timestamp[6:8]}"


def find_history(company, doc, url, versions):
    """Compare each archived version to the previous one.

    versions: list of (timestamp, text), oldest first.
    Returns a list of change entries, in the same shape detect_changes.py uses,
    plus a date and archive links.
    """
    changes = []
    previous = None
    for timestamp, text in versions:
        if text is None:
            continue  # skip broken copies; compare the next good one to the last good one
        text = remove_notices(text)  # ignore "we've updated our policy" banners
        if previous is not None and is_meaningful_change(previous[1], text):
            hunks = find_changes(previous[1], text)
            total = sum(h["changed_words"] for h in hunks)
            if hunks and total >= MIN_CHANGED_WORDS:
                changes.append({
                    "company": company,
                    "doc": doc,
                    "date": to_date(timestamp),
                    "source": "archive",
                    "changed_words": total,
                    "hunks": hunks,
                    # The change happened somewhere between these two archived copies:
                    "archive_before": snapshot_link(previous[0], url),
                    "archive_after": snapshot_link(timestamp, url),
                })
        previous = (timestamp, text)
    return changes


def save_report(company, doc, changes, versions=None):
    """Write one company/document's history, keeping any AI summaries already done.

    versions (optional): the date and word count of every usable archived copy,
    so the website can draw a "policy length over time" chart.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{company}-{doc}.json"

    # If we ran before and already paid for summaries, carry them over.
    if path.exists():
        old = json.loads(path.read_text(encoding="utf-8"))
        done = {c["archive_after"]: c["ai"] for c in old.get("changes", []) if "ai" in c}
        for change in changes:
            if change["archive_after"] in done:
                change["ai"] = done[change["archive_after"]]

    report = {"date": "archive", "company": company, "doc": doc, "changes": changes}
    if versions is not None:
        report["versions"] = versions
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser(description="Rebuild policy history from the Wayback Machine.")
    parser.add_argument("companies", nargs="*", help="only these companies (default: all)")
    parser.add_argument("--since", type=int, default=2023, help="first year to look at (default 2023)")
    args = parser.parse_args()

    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    if args.companies:
        sources = [s for s in sources if s["company"] in args.companies]

    for source in sources:
        company, doc, url = source["company"], source["doc"], source["url"]
        print(f"- {company} / {doc}")
        try:
            timestamps = list_snapshots(url, args.since)
            if not timestamps:
                print("    no archived copies found")
                continue
            print(f"    {len(timestamps)} monthly copies in the archive (cached ones are instant)...")

            versions = []
            for number, ts in enumerate(timestamps, start=1):
                versions.append((ts, fetch_snapshot_text(company, doc, ts, url)))
                if number % 10 == 0:
                    print(f"    {number}/{len(timestamps)}")
        except ArchiveBlocked:
            print("\nThe Internet Archive is temporarily blocking us (too many requests).")
            print("Everything downloaded so far is saved in archive_cache/.")
            print("Wait about an hour, then run the same command again. It will pick up where it left off.")
            return

        missing = sum(1 for _, text in versions if text is None)
        changes = find_history(company, doc, url, versions)
        lengths = [
            {"date": to_date(ts), "words": len(remove_notices(text).split()), "archive": snapshot_link(ts, url)}
            for ts, text in versions if text is not None
        ]
        path = save_report(company, doc, changes, lengths)
        print(f"    {len(versions) - missing} usable copies -> {len(changes)} change(s) found -> {path}")

    print("\nDone. Next: python summarize.py  (adds AI summaries)")


if __name__ == "__main__":
    main()

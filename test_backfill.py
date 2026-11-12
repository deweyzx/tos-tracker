"""
test_backfill.py — automatic checks for backfill.py, using a FAKE Wayback Machine.

Run it with:   python test_backfill.py

No internet needed: we replace the download function with one that returns
made-up archive data, then check that backfill finds the right history.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

import backfill as bf

passed = 0
failed = 0


def check(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


FILLER = " ".join(["Standard policy wording that stays the same."] * 60)  # ~420 words


def page(*paragraphs):
    body = "".join(f"<p>{p}</p>" for p in paragraphs)
    return f"<html><head><meta charset='utf-8'></head><body><nav>Menu</nav><main><h1>Privacy</h1><p>{FILLER}</p>{body}</main></body></html>".encode()


# A fake archive: 5 monthly copies of one policy.
SNAPSHOTS = {
    "20240115000000": page("We collect your email.", "We use data to run the service."),
    "20240215000000": page("We  collect your email", "We use data to run the service."),           # formatting only
    "20240315000000": page("We collect your email.", "We use data to run the service and to train AI models."),  # real change
    "20240415000000": b"<html><body>Please enable JavaScript</body></html>",                     # broken copy
    "20240515000000": page("We collect your email and phone number.", "We use data to run the service and to train AI models."),  # real change
}
downloads = []


def fake_get(url, params=None, headers=None, timeout=None):
    if url == bf.CDX_URL:
        rows = [["timestamp"]] + [[ts] for ts in SNAPSHOTS]
        return SimpleNamespace(status_code=200, text=json.dumps(rows), json=lambda: rows, raise_for_status=lambda: None)
    timestamp = url.split("/web/")[1].split("id_")[0]
    downloads.append(timestamp)
    return SimpleNamespace(status_code=200, content=SNAPSHOTS[timestamp], raise_for_status=lambda: None)


bf.requests.get = fake_get
bf.DELAY_SECONDS = 0
bf.BACKOFF_SECONDS = 0
sleeps = []
bf.time.sleep = lambda seconds: sleeps.append(seconds)  # don't actually wait during tests
URL = "https://example.com/privacy"

print("Talking to the archive:")
check("lists the archived copies, oldest first", bf.list_snapshots(URL, 2024) == list(SNAPSHOTS))
check("turns timestamps into dates", bf.to_date("20240315083000") == "2024-03-15")
check("builds a public link to an archived copy", bf.snapshot_link("20240315000000", URL) == "https://web.archive.org/web/20240315000000/https://example.com/privacy")

start_dir = os.getcwd()
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    os.chdir(tmp)
    try:
        versions = [(ts, bf.fetch_snapshot_text("acme", "privacy", ts, URL)) for ts in SNAPSHOTS]
        check("downloads each copy once", len(downloads) == 5)
        check("cleans copies with the scraper's code (menu removed)", "Menu" not in versions[0][1])
        check("marks the broken JavaScript copy as unusable", versions[3][1] is None)

        again = [bf.fetch_snapshot_text("acme", "privacy", ts, URL) for ts in SNAPSHOTS]
        check("second run uses the cache (no new downloads)", len(downloads) == 5)
        check("cached copies match", again == [text for _, text in versions])

        print("\nFinding the history:")
        changes = bf.find_history("acme", "privacy", URL, versions)
        check("finds exactly the 2 real changes", len(changes) == 2)
        check("ignores the formatting-only copy", all(c["date"] != "2024-02-15" for c in changes))
        check("first change dated when the archive first saw it", changes and changes[0]["date"] == "2024-03-15")
        check("first change includes the AI-training wording", changes and any("train AI models" in line for h in changes[0]["hunks"] for line in h["added"]))
        check("skips the broken copy and compares to the last good one", len(changes) == 2 and changes[1]["date"] == "2024-05-15")
        check("second change includes the phone-number wording", len(changes) == 2 and any("phone number" in line for h in changes[1]["hunks"] for line in h["added"]))
        check("links to the archived copies before and after", changes and changes[0]["archive_before"].endswith("20240215000000/" + URL))
        check("marked as coming from the archive", all(c["source"] == "archive" for c in changes))

        print("\nSaving:")
        path = bf.save_report("acme", "privacy", changes)
        saved = json.loads(path.read_text(encoding="utf-8"))
        check("writes changes/archive/acme-privacy.json", path.as_posix() == "changes/archive/acme-privacy.json" and len(saved["changes"]) == 2)

        saved["changes"][0]["ai"] = {"summary": "already paid for", "severity": "major"}
        path.write_text(json.dumps(saved), encoding="utf-8")
        fresh = bf.find_history("acme", "privacy", URL, versions)
        bf.save_report("acme", "privacy", fresh)
        resaved = json.loads(path.read_text(encoding="utf-8"))
        check("rerunning keeps AI summaries already paid for", resaved["changes"][0].get("ai", {}).get("summary") == "already paid for")
        print("\nBeing polite when the archive pushes back:")
        attempts = []

        def refusing_get(url, params=None, headers=None, timeout=None):
            attempts.append(url)
            raise bf.requests.ConnectionError("refused")

        bf.requests.get = refusing_get
        bf.failures_in_a_row = 0
        sleeps.clear()
        result = bf.fetch_snapshot_text("acme", "terms", "20240101000000", URL)
        check("a refused download is retried once after backing off", len(attempts) == 2 and bf.BACKOFF_SECONDS in sleeps)
        check("a refused download returns nothing (no crash)", result is None)
        check("a refused download is NOT cached, so a rerun retries it", not Path("archive_cache/acme/terms/20240101000000.txt").exists())

        blocked = False
        try:
            for ts in ["20240201000000", "20240301000000", "20240401000000"]:
                bf.fetch_snapshot_text("acme", "terms", ts, URL)
        except bf.ArchiveBlocked:
            blocked = True
        check("stops the whole run after 3 failures in a row", blocked)

        def rate_limited_get(url, params=None, headers=None, timeout=None):
            attempts.append(url)
            return SimpleNamespace(status_code=429, raise_for_status=lambda: None)

        bf.requests.get = rate_limited_get
        bf.failures_in_a_row = 0
        attempts.clear()
        bf.fetch_snapshot_text("acme", "terms", "20240501000000", URL)
        check("treats '429 Too Many Requests' the same way (back off + retry)", len(attempts) == 2)

        bf.requests.get = fake_get
        bf.failures_in_a_row = 2
        bf.fetch_snapshot_text("acme", "privacy", "20240115000000", URL)  # cached, no request
        downloads_before = len(downloads)
        Path("archive_cache/acme/privacy/20240315000000.txt").unlink()
        bf.fetch_snapshot_text("acme", "privacy", "20240315000000", URL)
        check("a successful download resets the failure count", bf.failures_in_a_row == 0 and len(downloads) == downloads_before + 1)
    finally:
        os.chdir(start_dir)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

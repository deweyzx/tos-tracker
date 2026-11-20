"""
test_scraper.py — automatic checks that scraper.py saves real policies and skips walls.

Run it with:   python test_scraper.py

Nothing is downloaded: plain pages and the browser are both faked, and everything
runs in a throwaway folder.
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import scraper

passed = 0
failed = 0


def check(name, condition):
    """Print PASS or FAIL for one test."""
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


POLICY = "We collect your email and use it to run the service. " * 80  # about 880 words
WALL = "Log in to continue. You must log in to see this page. " + "Facebook " * 400


def page(text):
    return f"<html><body><main><p>{text}</p></main></body></html>".encode()


print("Spotting walls and error pages:")
check("a real policy is not blocked", scraper.looks_blocked(POLICY) is None)
check("an almost empty page is blocked", scraper.looks_blocked("Loading...") is not None)
check("a short login wall is blocked", scraper.looks_blocked(WALL) is not None)
long_policy_mentioning_login = POLICY * 2 + " If you log in to continue using the service, we keep your session."
check("a long policy that mentions logging in is NOT blocked", scraper.looks_blocked(long_policy_mentioning_login) is None)
check("a copy under half the last one is blocked", scraper.looks_blocked(POLICY, last_words=5000) is not None)
check("a copy a bit shorter than the last one is fine", scraper.looks_blocked(POLICY, last_words=1000) is None)
check("no last copy yet is fine", scraper.looks_blocked(POLICY, last_words=None) is None)


class FakeBrowser:
    """Stands in for BrowserFetcher: returns set pages and remembers what it was asked for."""

    def __init__(self, pages):
        self.pages, self.asked, self.closed = pages, [], False

    def fetch(self, url):
        self.asked.append(url)
        return self.pages.get(url)

    def close(self):
        self.closed = True


print("\nA full run (fake downloads, temporary folder):")
start_dir = os.getcwd()
real_fetch, real_delay = scraper.fetch_page, scraper.DELAY_SECONDS
with tempfile.TemporaryDirectory() as tmp:
    os.chdir(tmp)
    try:
        Path("sources.json").write_text(json.dumps([
            {"company": "plainco", "doc": "privacy", "url": "https://plain.example/privacy"},
            {"company": "jsco", "doc": "privacy", "url": "https://js.example/privacy", "browser": True},
            {"company": "wallco", "doc": "terms", "url": "https://wall.example/terms", "browser": True},
        ]), encoding="utf-8")
        # wallco had a full copy before; today the browser only gets a login wall
        Path("policies/wallco").mkdir(parents=True)
        Path("policies/wallco/terms.txt").write_text(POLICY, encoding="utf-8")

        plain_asked = []
        scraper.fetch_page = lambda url: plain_asked.append(url) or page(POLICY)
        scraper.DELAY_SECONDS = 0
        browser = FakeBrowser({"https://js.example/privacy": page(POLICY), "https://wall.example/terms": page(WALL)})
        scraper.main(browser=browser)

        check("plain pages are downloaded without the browser", plain_asked == ["https://plain.example/privacy"])
        # the wall page is tried twice (one retry), then skipped
        check("browser pages go through the browser", browser.asked == ["https://js.example/privacy", "https://wall.example/terms", "https://wall.example/terms"])
        check("a page read in the browser is saved", Path("policies/jsco/privacy.txt").exists())
        check("a plain page is saved", Path("policies/plainco/privacy.txt").exists())
        check("a login wall does not replace the last good copy", Path("policies/wallco/terms.txt").read_text(encoding="utf-8") == POLICY)
        check("the browser is closed at the end", browser.closed)
    finally:
        scraper.fetch_page, scraper.DELAY_SECONDS = real_fetch, real_delay
        os.chdir(start_dir)

class FirstVisitFails(FakeBrowser):
    """Like Amazon: an empty page on the first visit, the real one on the next."""

    def fetch(self, url):
        self.asked.append(url)
        return page("Page Not Found") if len(self.asked) == 1 else page(POLICY)


print("\nA browser page that fails once:")
with tempfile.TemporaryDirectory() as tmp:
    os.chdir(tmp)
    try:
        Path("sources.json").write_text(json.dumps([
            {"company": "shopco", "doc": "privacy", "url": "https://shop.example/privacy", "browser": True},
        ]), encoding="utf-8")
        scraper.DELAY_SECONDS = 0
        browser = FirstVisitFails({})
        scraper.main(browser=browser)
        check("it is tried a second time", len(browser.asked) == 2)
        check("the real copy from the second try is saved", Path("policies/shopco/privacy.txt").exists())
    finally:
        scraper.DELAY_SECONDS = real_delay
        os.chdir(start_dir)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

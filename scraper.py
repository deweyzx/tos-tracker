"""
scraper.py — Phase 2: download each policy page and save its clean text.

What it does, in order:
  1. Reads the list of policy pages from sources.json
  2. Downloads each page (fetch_page), or, for pages marked "browser": true
     (sites that build their text with JavaScript, like Meta and Reddit),
     opens it in a hidden Chrome with Playwright (BrowserFetcher)
  3. Pulls out just the policy text, dropping menus/footers (extract_text)
  4. Cleans the text so tiny meaningless changes don't count (normalize)
  5. Saves it to policies/<company>/<doc>.txt (save_text)

Run it with:   python scraper.py
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SOURCES_FILE = Path("sources.json")
POLICIES_DIR = Path("policies")

# A User-Agent tells the website what kind of program is asking for the page.
# Some sites block requests that don't look like a normal browser.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tos-tracker/0.1"
}

# Wait this many seconds between sites so we're polite and don't hammer anyone.
DELAY_SECONDS = 2

# Fewer words than this means we didn't get the policy (an empty shell or an error page).
MIN_WORDS = 300

# A browser page that suddenly has under half the words of our last copy is far more
# likely a login wall, cookie wall or error page than a real rewrite, so it's skipped
# for the day (and printed, so a person can look) instead of saved as a change.
MIN_SHARE_OF_LAST_COPY = 0.5

# Words that mean a site showed a wall instead of the policy. Checked only on short
# pages, so a policy that mentions "log in" somewhere in 7,000 words is never skipped.
BLOCK_PHRASES = [
    "log in to continue", "log into facebook", "you must log in", "sign up to continue",
    "you've been blocked", "you have been blocked", "access denied", "unusual traffic",
    "verify you are human", "are you a robot", "complete the captcha", "enable javascript",
    "something went wrong", "this page isn't available", "too many requests",
]


def looks_blocked(text, last_words=None):
    """Return a reason if this text looks like a wall or error page, not the policy (else None)."""
    words = len(text.split())
    if words < MIN_WORDS:
        return f"only {words} words"
    lower = text.lower()
    if words < 1500:
        for phrase in BLOCK_PHRASES:
            if phrase in lower:
                return f'the page says "{phrase}"'
    if last_words and words < last_words * MIN_SHARE_OF_LAST_COPY:
        return f"{words} words, under half of the last copy ({last_words})"
    return None


class BrowserFetcher:
    """One hidden Chrome (Playwright) shared by every "browser": true page in a run.

    It only does what a person's browser does: loads the page, runs its JavaScript and
    waits for the text. It doesn't try to get around bot checks; if a site shows a wall,
    looks_blocked() catches it and the page is skipped for the day.
    """

    def __init__(self):
        self.playwright = self.browser = self.context = None

    def fetch(self, url):
        """Return the page's HTML after its JavaScript has run (or None if it failed)."""
        try:
            if self.browser is None:
                from playwright.sync_api import sync_playwright  # only needed for browser pages
                self.playwright = sync_playwright().start()
                self.browser = self.playwright.chromium.launch(headless=True)
                self.context = self.browser.new_context(locale="en-US", viewport={"width": 1280, "height": 900})
            page = self.context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                try:
                    page.wait_for_load_state("networkidle", timeout=15_000)  # let the text finish loading
                except Exception:
                    pass  # some pages never go quiet; what has loaded is usually enough
                return page.content()
            finally:
                page.close()
        except ImportError:
            print("  ! Playwright isn't installed (pip install playwright, then python -m playwright install chromium), skipping")
        except Exception as error:
            print(f"  ! the browser could not load the page: {error}")
        return None

    def close(self):
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()


def fetch_page(url):
    """Download a page and return its raw HTML as bytes (or None if it failed)."""
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()  # turns 404/500 errors into exceptions
        # Return raw bytes, not response.text. BeautifulSoup then reads the
        # page's own <meta charset> tag to decode it correctly. (Using .text
        # caused garbled characters like "â" on TikTok's page.)
        return response.content
    except requests.RequestException as error:
        print(f"  ! could not download: {error}")
        return None


# "Block" tags start a new paragraph/line. Everything else (like <a> links
# or <b> bold) is "inline" and should stay in the middle of its sentence.
BLOCK_TAGS = ["p", "div", "li", "br", "tr", "section", "h1", "h2", "h3", "h4", "h5", "h6", "dt", "dd", "blockquote"]


def extract_text(html):
    """Turn messy HTML into just the readable policy text."""
    soup = BeautifulSoup(html, "html.parser")

    # Throw away parts of the page that are never the policy itself.
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg"]):
        tag.decompose()

    # Put a line break after each block tag only, so links don't split sentences.
    for tag in soup.find_all(BLOCK_TAGS):
        tag.append("\n")

    # Prefer the <main> or <article> section if the site has one; else use the whole body.
    content = soup.find("main") or soup.find("article") or soup.body or soup
    return content.get_text()


# Lines like "Last updated: March 3, 2026" change even when nothing else does.
# We drop them so they don't trigger false alarms.
DATE_LINE = re.compile(r"^(last\s+(updated|modified|revised)|effective|published|updated)\b", re.IGNORECASE)


def normalize(text):
    """Clean text so only real wording changes show up as differences."""
    lines = []
    for line in text.splitlines():
        line = " ".join(line.split())  # collapse extra spaces/tabs
        if not line:
            continue  # skip blank lines
        if DATE_LINE.search(line) and len(line) < 80:
            continue  # skip short "last updated" lines
        lines.append(line)
    return "\n".join(lines) + "\n"


def save_text(company, doc, text):
    """Save the cleaned text to policies/<company>/<doc>.txt."""
    folder = POLICIES_DIR / company
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{doc}.txt"
    path.write_text(text, encoding="utf-8")
    return path


def last_copy_words(company, doc):
    """Word count of the copy we saved last time (None if there isn't one yet)."""
    path = POLICIES_DIR / company / f"{doc}.txt"
    return len(path.read_text(encoding="utf-8").split()) if path.exists() else None


def main(browser=None):
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    print(f"Checking {len(sources)} policy pages...\n")
    browser = browser or BrowserFetcher()

    try:
        for source in sources:
            uses_browser = source.get("browser", False)
            print(f"- {source['company']} / {source['doc']}" + ("  (in a browser)" if uses_browser else ""))
            html = browser.fetch(source["url"]) if uses_browser else fetch_page(source["url"])
            if html is None:
                continue

            text = normalize(extract_text(html))
            word_count = len(text.split())

            # Browser pages also get the wall check against our last copy; plain pages only
            # need enough words (a page that needs JavaScript comes back nearly empty).
            reason = looks_blocked(text, last_copy_words(source["company"], source["doc"]) if uses_browser else None)
            if reason:
                hint = "" if uses_browser else ' (if it needs JavaScript, add "browser": true in sources.json)'
                print(f"  ! {reason}: this doesn't look like the policy, skipping{hint}")
                continue

            path = save_text(source["company"], source["doc"], text)
            print(f"  saved {word_count} words -> {path}")
            time.sleep(DELAY_SECONDS)
    finally:
        browser.close()

    print("\nDone.")


if __name__ == "__main__":
    main()

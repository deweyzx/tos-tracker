"""
scraper.py — Phase 2: download each policy page and save its clean text.

What it does, in order:
  1. Reads the list of policy pages from sources.json
  2. Downloads each page (fetch_page)
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


def main():
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    print(f"Checking {len(sources)} policy pages...\n")

    for source in sources:
        print(f"- {source['company']} / {source['doc']}")
        html = fetch_page(source["url"])
        if html is None:
            continue

        text = normalize(extract_text(html))
        word_count = len(text.split())

        # If we got almost no words, the page probably needs JavaScript to load
        # (we'll handle those later with Playwright).
        if word_count < 300:
            print(f"  ! only {word_count} words — page may need a real browser, skipping")
            continue

        path = save_text(source["company"], source["doc"], text)
        print(f"  saved {word_count} words -> {path}")
        time.sleep(DELAY_SECONDS)

    print("\nDone.")


if __name__ == "__main__":
    main()

# ToS Tracker

**Tracks changes to the privacy policies and terms of service of popular apps, and explains in plain English what changed and why it matters.**

Companies update their policies all the time, often quietly, and the changes can be big, like starting to use your posts to train AI models. Almost nobody rereads a 10,000-word policy to find out. This project watches those policies automatically and flags what changed.

> 🚧 **Work in progress.** Data collection is working. Change detection, AI summaries, and a public website are next.

## What it tracks

17 policy pages across 12 companies, including Spotify, Discord, Reddit, OpenAI, Anthropic, Google, TikTok, Snapchat, Zoom, X, Meta, and Apple. The full list is in [`sources.json`](sources.json).

Every saved version lives in [`policies/`](policies/), and this repo's commit history is a timestamped record of every change.

## How it works

```
sources.json ──> scraper.py ──> policies/<company>/<doc>.txt ──> Git commit
 (what to watch)  (download +     (one clean text file             (dated version
                   clean text)      per policy)                      history)
```

1. **Collect:** `scraper.py` downloads each policy page, strips out menus, footers, and scripts, and keeps just the policy text.
2. **Clean:** text is normalized (whitespace, encoding, and "Last updated" date stamps), so only real wording changes count as changes.
3. **Version:** each policy is a plain text file tracked by Git. Git's history *is* the database. Every change is dated and diffable.
4. **Detect:** `detect_changes.py` compares each policy to its last committed version, ignores formatting-only differences (spacing, punctuation, capitalization), and saves the changed paragraphs with surrounding context to `changes/`.
5. **Explain:** `summarize.py` sends each change to Claude Haiku 5.5, which must fill in a fixed form: a plain-English summary, a severity (major / moderate / minor), topic categories, and an opt-out tip only if the policy itself mentions one. The prompt restricts the AI to the provided text to prevent made-up claims.
6. **Automate:** a [GitHub Actions workflow](.github/workflows/daily.yml) runs the whole pipeline every day: tests, then scrape, detect, summarize. It commits any new versions and change reports, so this repo updates itself.

### Design choices
- **Git as the database:** free version history and diffs, and a transparent public record.
- **Never overwrite good data with bad:** if a site returns a broken or empty page (bot checks, JavaScript-only pages), the scraper keeps the last good copy instead of recording a fake "policy deleted" change.
- **Polite scraping:** one request per page, a pause between sites, and daily checks at most.

## Roadmap

- [x] Policy scraper with text cleaning
- [x] Version history with Git
- [x] Change detection (meaningful edits only, ignoring formatting noise), with automated tests
- [x] AI summaries: plain-English explanation plus a severity rating (major / moderate / minor), using Claude Haiku 5.5 with structured output
- [x] Automatic daily runs with GitHub Actions (tests run first, results committed by a bot)
- [ ] Public website with a change feed, before/after views, and per-company history
- [ ] Email/RSS alerts
- [ ] Browser-based scraping for JavaScript-heavy sites (Reddit, Meta)

## Run it yourself

Requires Python 3.

```
pip install -r requirements.txt
python scraper.py           # download today's versions
python detect_changes.py    # find what changed since the last commit
python summarize.py         # AI summaries (needs an Anthropic API key in .env, see .env.example)
python test_detect_changes.py   # run the automated tests
python test_summarize.py
```

## About

Built by Owen Moran, a student at the University of Maryland, with Claude as an AI coding assistant. I designed the system and made the decisions; Claude helped write the code. [`PROJECT_NOTES.md`](PROJECT_NOTES.md) documents how every part works and why.

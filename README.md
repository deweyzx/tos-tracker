# ToS Tracker

**Tracks changes to the privacy policies and terms of service of popular apps, and explains in plain English what changed and why it matters.**

Companies update their policies all the time, often quietly, and the changes can be big, like starting to use your posts to train AI models. Almost nobody rereads a 10,000-word policy to find out. This project watches those policies automatically and flags what changed.

**Website: [deweyzx.github.io/tos-tracker](https://deweyzx.github.io/tos-tracker/)**, updated automatically every morning.

## What it tracks

75 policy pages across 38 companies: the big platforms (Google, Meta, Apple, Microsoft, Amazon, X, TikTok, Snapchat, Reddit, LinkedIn, Pinterest, Discord, Telegram), AI companies (OpenAI, Anthropic, Perplexity, Character.AI), shopping (Temu, Shein, eBay, Walmart), and everyday apps from Netflix and Spotify to Uber, Airbnb, Roblox and Duolingo. The full list is in [`sources.json`](sources.json).

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
6. **Backfill history:** `backfill.py` rebuilds each policy's past from the Internet Archive's Wayback Machine (one snapshot per month), cleaning and comparing archived copies with the same code as the live tracker. Every historical change links to the archived copies so it can be verified.
7. **Publish:** an [Astro](https://astro.build) website in [`site/`](site/) is built from the same files (`sources.json`, `policies/`, `changes/`) and published to GitHub Pages after every daily run. Each change gets its own page with the AI summary next to the exact before/after wording and links to the archived copies.
8. **Automate:** a [GitHub Actions workflow](.github/workflows/daily.yml) runs the whole pipeline every day: tests, then scrape, detect, summarize. It commits any new versions and change reports, so this repo updates itself.

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
- [x] Historical backfill from the Internet Archive's Wayback Machine (monthly snapshots since 2023, with archive links)
- [x] Public website with a change feed, before/after views, and policy history charts
- [x] Feeds: one Atom feed of every change (`/feed.xml`) and one per company (`/feed/<company>.xml`)
- [ ] Email alerts: built (`notify.py`, sends through Buttondown), switched on once a Buttondown account is connected (see below)
- [x] Browser-based scraping for JavaScript-heavy sites: Meta works (Playwright, `"browser": true` in `sources.json`); Reddit blocks automated browsers, so it stays archive-only

## Run it yourself

Requires Python 3.

```
pip install -r requirements.txt
python scraper.py           # download today's versions
python detect_changes.py    # find what changed since the last commit
python summarize.py         # AI summaries (needs an Anthropic API key in .env, see .env.example)
python test_detect_changes.py   # run the automated tests
python test_summarize.py
python test_backfill.py
python test_notify.py
python notify.py 2026-11-20 --dry-run   # show the alert email for a day, send nothing
python backfill.py          # rebuild past history from the Wayback Machine (slow; cached)

cd site && npm install && npm run dev   # preview the website locally (needs Node.js 22)
```

### Add a company

Nothing is hard-coded: the tracker and the website both read from [`sources.json`](sources.json).

1. Add one entry per page to `sources.json`:
   ```json
   { "company": "netflix", "doc": "privacy", "url": "https://help.netflix.com/legal/privacy" }
   ```
2. Check it scrapes cleanly: `python scraper.py` should save more than 300 words to `policies/netflix/privacy.txt`. (If a page only loads with JavaScript, add `"browser": true` to its entry in `sources.json` so it's read in a hidden browser, and run `pip install playwright` and `python -m playwright install chromium` once.)
3. Optional, to give it a history from day one: `python backfill.py netflix`, then `python summarize.py`.
4. Commit and push. The website rebuilds itself, and the daily check watches the new page from the next morning on.

The site turns the ID into a display name by capitalizing the first letter (`netflix` becomes "Netflix"). For names with unusual capitalization, add them to `NAMES` in [`site/src/lib/data.js`](site/src/lib/data.js).

### Switch on email alerts

The daily check emails subscribers on days a policy really changes (not for small edits). [Buttondown](https://buttondown.com) keeps the list, sends confirmations and handles unsubscribes; it's free up to 100 subscribers. Until both settings below exist, nothing is sent and the site shows only the feed link, never a sign-up form that doesn't work.

1. Make a Buttondown account and confirm your email address. Your username is in your newsletter's address (`buttondown.com/<username>`).
2. In Buttondown, copy your API key (Settings > API).
3. On GitHub: **Settings > Secrets and variables > Actions**.
   - **Secrets** tab > New repository secret: `BUTTONDOWN_API_KEY` = the key.
   - **Variables** tab > New repository variable: `BUTTONDOWN_USERNAME` = your username.
4. **Actions > Publish website > Run workflow.** The sign-up form appears under "How it works".
5. Sign up yourself to test it. The next day with a real change, the daily check sends the email (check the "Email subscribers" step in its log).

## About

Built by Owen Moran, a student at the University of Maryland, with Claude as an AI coding assistant. I designed the system and made the decisions; Claude helped write the code. [`PROJECT_NOTES.md`](PROJECT_NOTES.md) documents how every part works and why.

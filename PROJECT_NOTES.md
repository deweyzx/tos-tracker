# ToS Tracker — Project Notes

My study guide for this project. If an interviewer points at any file or asks "why did you do it this way?", the answer should be in here.

**One-line pitch:** A tool that watches companies' privacy policies and terms of service, detects when they change, and uses AI to explain in plain English what changed and how much you should care.

**Built with:** Python, with code written alongside Claude (AI coding assistant). I make the design decisions; Claude writes and explains the code.

---

## 1. How the whole thing works (big picture)

```
sources.json ──> scraper.py ──> policies/<company>/<doc>.txt ──> Git commit
 (what to watch)  (download +     (one clean text file           (saves a dated
                   clean text)      per policy)                     version)

        later phases:
Git history ──> change detection ──> AI summary ──> website + alerts
```

1. **sources.json** lists which pages to watch.
2. **scraper.py** downloads each page, strips out everything that isn't the policy, cleans the text, and saves it.
3. **Git** saves a new version every time a file changes, so we automatically get the full history.
4. *(Phase 4)* We compare the new version to the old one to find what changed.
5. *(Phase 5)* AI turns the change into a plain-English summary with a severity rating.
6. *(Phase 6–8)* It runs automatically every day, and results show up on a website.

---

## 2. File guide — what each file does and why

| File | What it does | Why it exists |
|---|---|---|
| `sources.json` | List of companies, document type (privacy/terms), and URL | Keeps the "what to watch" list separate from the code, so adding a company means editing one line, not changing code |
| `scraper.py` | Downloads each page, extracts and cleans the policy text, saves it | The core data-collection step |
| `policies/` | Folder holding one `.txt` file per policy, e.g. `policies/spotify/privacy.txt` | Plain text files are easy for Git to track and compare line by line |
| `requirements.txt` | List of Python libraries the project needs | Anyone can install everything with one command: `pip install -r requirements.txt` |
| `.gitignore` | Tells Git which files *not* to save (temporary files, secret keys) | Keeps junk and passwords out of the public repo |
| `PROJECT_NOTES.md` | This file | My study guide |
| `README.md` | The project's front page on GitHub: what it is, how it works, roadmap | First thing a recruiter sees |
| `detect_changes.py` | Compares each policy to its last committed version and saves what changed to `changes/<date>.json` | Turns a downloader into a *tracker*. Its output feeds the AI step |
| `test_detect_changes.py` | 22 automatic checks that change detection catches real edits and ignores formatting noise | Proves the code works, and catches it if a future edit breaks something |
| `changes/` | One JSON report per day that had changes, e.g. `changes/2026-11-20.json` | A permanent log of every change found. Later becomes the website's data |
| `summarize.py` | Sends each change to Claude Haiku 5.5 and saves back a summary, severity, categories, and "what you can do" | The AI part: turns a diff into something a normal person understands |
| `test_summarize.py` | 22 automatic checks using a *fake* AI client | Free and instant, no API key needed. Tests our code, not the AI |
| `examples/sample_change.json` | A made-up policy change for trying the AI | Lets you see real AI output before any real policy changes |
| `.env` | Holds the secret API key: `ANTHROPIC_API_KEY=sk-ant-...` | Keeps the key out of the code. **Never uploaded** (blocked by `.gitignore`) |
| `.env.example` | Same as `.env` but with a fake placeholder | Shows others what settings the project needs, without exposing my key |
| `backfill.py` | Rebuilds each policy's *past* history from the Internet Archive's Wayback Machine | Fills the website with real history from day one instead of an empty page |
| `test_backfill.py` | 26 checks using a *fake* Wayback Machine (including being refused and rate-limited, and saving word counts) | Tests the backfill with no internet and no waiting |
| `changes/archive/` | One history report per policy, e.g. `changes/archive/spotify-privacy.json` | The "Company history" tab's data for past years |
| `archive_cache/` | Every archived copy downloaded, as cleaned text | Reruns are fast and don't re-download. **Not uploaded** (in `.gitignore`) |
| `.github/workflows/daily.yml` | Instructions for GitHub Actions: every day, run tests → scrape → detect → summarize → commit results | Makes the tracker run itself, even with my laptop off |
| `site/` | The public website, built with **Astro**. It reads `sources.json`, `policies/` and `changes/` when it's built, so every number on it is real | The project's front door for recruiters and regular people |
| `site/src/lib/data.js` | Loads and shapes all the data: company list, statuses, changes, headlines, the quote on the featured card, chart data | The only place that knows the file formats. Pages just display what it returns |
| `site/src/pages/index.astro` | The main page with its four tabs (Overview, Latest, Companies, History) plus Alerts | Most of what people see |
| `site/src/pages/change/[id].astro` | One page per change: summary, "what you can do", stats, source links, and the exact wording before/after | "Read the change" goes here. Lets anyone check the AI against the real text |
| `site/src/layouts/Base.astro` | The frame every page shares: background, top bar, pinned bar, search | Write it once, use it everywhere |
| `site/src/scripts/app.js` | Everything interactive: tabs, pins, Ctrl+K search, filter menu, charts, animations | The page still shows all content without it |
| `site/src/styles/site.css` | All the styling, as CSS variables + components | Matches `DESIGN.md` |
| `DESIGN.md` | The design rules: colors and what each is for, font, glass panels, buttons, motion | Keeps every page consistent, and explains the look in an interview |
| `.github/workflows/pages.yml` | Builds the site and publishes it to GitHub Pages after every push and after each daily check | The site updates itself the same morning a change is found |

### Inside `daily.yml`

| Part | What it does |
|---|---|
| `on: schedule: cron: "23 11 * * *"` | Run every day at 11:23 UTC (6:23 AM Eastern in winter) |
| `on: workflow_dispatch` | Adds a "Run workflow" button for running it by hand |
| `permissions: contents: write` | Allows the job to push its commits back to the repo |
| `concurrency` | Never lets two runs overlap and fight over the same files |
| `Run tests` step | Runs both test files first. If anything is broken, the run stops before touching data |
| `Summarize` step | Gets the API key from GitHub's secret storage (`secrets.ANTHROPIC_API_KEY`) |
| `Save results` step | Commits only if something actually changed, as the `github-actions[bot]` user |

### Inside `summarize.py`

| Piece | What it does |
|---|---|
| `MODEL` | Which AI model to use. Changing this one line switches models |
| `SEVERITIES`, `CATEGORIES` | The only allowed answers. Keeps the data consistent for the website's colors and filters |
| `SUMMARY_TOOL` | A "form" the AI is forced to fill in, so we always get the same clean fields back |
| `INSTRUCTIONS` | The system prompt: rules the AI follows (only use the given text, plain English, not alarmist, never invent settings) |
| `format_change_for_ai(change)` | Turns a change into readable text: company, removed wording, added wording, context |
| `summarize_change(client, change)` | Sends one change to Claude and returns the filled-in form |
| `summarize_report(client, path)` | Does every change in a report, skips ones already done, saves after each one |
| `make_client()` | Loads the key from `.env` and connects to Anthropic |

### Inside `detect_changes.py`

| Function | What it does |
|---|---|
| `get_old_version(path)` | Asks Git for the file as it was in the last commit (`git show HEAD:<file>`). Returns nothing for a brand-new policy |
| `simplify(text)` | Makes a stripped-down copy (lowercase, no punctuation, single spaces) used *only for comparing*, never saved |
| `remove_notices(text)` | Drops short "we've updated our Privacy Policy" banner lines before comparing (decision #42) |
| `is_meaningful_change(old, new)` | True only if the simplified versions differ, meaning the actual words changed |
| `find_changes(old, new)` | Lines up the two versions paragraph by paragraph and returns each spot that changed (a "hunk"): removed paragraphs, added paragraphs, and 1 unchanged paragraph before and after for context |
| `count_changed_words(...)` | Roughly how many words were added or removed. Helps judge how big a change is |
| `main()` | Runs the steps above for every policy file and writes the day's report |

### Inside `backfill.py`

| Function | What it does |
|---|---|
| `list_snapshots(url, since_year)` | Asks the Wayback Machine's **CDX API** which saved copies exist, at most one per month |
| `polite_get(url)` | Every request to the archive goes through here. Backs off 60s when refused or rate-limited (429), and stops the run (`ArchiveBlocked`) after 3 failures in a row |
| `fetch_snapshot_text(...)` | Downloads one archived copy (the `id_` version, without the archive's toolbar) and cleans it with **the scraper's own** `extract_text` + `normalize`. Saves it to `archive_cache/` |
| `find_history(...)` | Compares each version to the previous good one with **the change detector's own** `find_changes`. Skips broken copies |
| `save_report(...)` | Writes `changes/archive/<company>-<doc>.json`, carrying over any AI summaries already paid for |
| `snapshot_link(...)` | Builds a public archive.org link so anyone can check the before/after themselves |

### What a change report looks like
```json
{
  "date": "2026-11-20",
  "changes": [{
    "company": "spotify", "doc": "privacy", "changed_words": 8,
    "hunks": [{
      "removed": ["We use your data to run the service."],
      "added":   ["We use your data to run the service and to train our AI models."],
      "context_before": ["We collect your email."],
      "context_after":  ["Contact us at privacy@spotify.com."]
    }]
  }]
}
```
| `.git/` (hidden) | Git's storage for every saved version | Created by `git init`; never edit it by hand |

### Inside `scraper.py`

| Function | What it does |
|---|---|
| `fetch_page(url)` | Downloads the page's HTML as raw bytes. Returns nothing if the site errors out, so one broken site doesn't crash the whole run |
| `extract_text(html)` | Removes menus, headers, footers, and scripts, adds line breaks only after paragraph-type tags, then keeps just the main content |
| `normalize(text)` | Collapses extra spaces, removes blank lines, and drops "Last updated" lines |
| `save_text(...)` | Writes the cleaned text to `policies/<company>/<doc>.txt` |
| `main()` | Runs the steps above for every page in `sources.json` |

---

## 3. Key terms

- **Web scraping:** having a program download web pages and pull data out of them automatically.
- **HTML:** the code that web pages are made of. It's the text plus tags like `<p>` (paragraph) and `<nav>` (menu).
- **requests:** a Python library for downloading web pages.
- **BeautifulSoup:** a Python library that reads HTML and lets you grab or delete specific parts.
- **User-Agent:** a label a program sends a website saying what it is. Some sites block requests without a normal-looking one.
- **JSON:** a simple text format for storing structured data (lists and labeled fields). Used for `sources.json`.
- **Normalization:** cleaning data into a consistent form so that meaningless differences (extra spaces, dates) don't count as changes.
- **False positive:** the system says something changed when nothing important did. Normalization is how we reduce these.
- **Git:** a version control system. It saves snapshots ("commits") of files over time so you can see exactly what changed and when.
- **Commit:** one saved snapshot in Git, with a timestamp and message.
- **Diff:** the list of differences between two versions of a file.
- **Repository (repo):** a project folder tracked by Git, usually stored on GitHub.
- **Diff algorithm / difflib:** Python's built-in tool for lining up two versions of a text and finding what was removed, added, or kept. We use its `SequenceMatcher`.
- **Hunk:** one spot in a diff where something changed, plus a little surrounding context.
- **`HEAD`:** Git's name for the most recent commit. `git show HEAD:file` means "this file as of my last save."
- **subprocess:** how a Python script runs another program (here, Git) and reads its output.
- **Automated test:** code that checks other code by feeding it known inputs and verifying the outputs. "18 passed, 0 failed" means every check matched.
- **End-to-end test:** a test of the whole process at once (here: builds a throwaway Git project, makes changes, runs the real script, checks the report), instead of one function at a time.
- **ISO date:** the `2026-11-12` (year-month-day) format. Files named this way sort in date order automatically.
- **API (Application Programming Interface):** a way for code to talk to another service. Our script talks to Anthropic's API to use Claude.
- **API key:** a secret password that identifies your account to an API, so usage gets billed to you. Anyone with it can spend your credits.
- **Environment variable / `.env`:** a setting stored outside the code. `python-dotenv` loads the `.env` file so the code can read the key without the key being written in the code.
- **LLM (large language model):** the kind of AI behind Claude and ChatGPT.
- **Model (e.g. Claude Haiku 5.5):** a specific version of an AI. Bigger models are smarter but cost more; Haiku is the small, cheap, fast one.
- **Token:** the unit AI usage is measured and billed in, roughly ¾ of a word. Haiku 5.5 costs about $0.10 per million input tokens and $0.50 per million output tokens.
- **System prompt:** standing instructions that shape how the AI responds (our `INSTRUCTIONS`).
- **Structured output / tool use:** making the AI answer by filling in a defined form (a JSON schema) instead of writing free text. Our code can rely on the answer having exactly the fields it expects.
- **JSON schema:** a description of what a piece of JSON must look like: which fields, what types, which values are allowed.
- **Enum:** a fixed list of allowed values, like `major` / `moderate` / `minor`.
- **Hallucination:** when an AI states something that isn't true or isn't in its source. Our prompt limits this by saying "only use the text provided" and "never invent settings."
- **Mock / fake object:** a stand-in used in tests that pretends to be the real thing (our `FakeClient` pretends to be Claude), so tests are free and predictable.
- **Idempotent:** safe to run twice. `summarize.py` skips changes it already summarized, so rerunning never double-charges.
- **GitHub Actions:** GitHub's free service for running code on its own computers, triggered by a schedule, a push, or a button.
- **Workflow:** one automated job defined in a `.yml` file inside `.github/workflows/`.
- **Runner:** the temporary computer GitHub spins up to run a workflow. It starts fresh every time and is deleted afterward.
- **YAML (.yml):** a settings-file format where indentation shows structure. Spaces matter, and tabs aren't allowed.
- **Cron:** a 5-part code for "when to run": minute, hour, day of month, month, day of week. `23 11 * * *` = 11:23 every day (`*` means "every").
- **UTC:** the world's reference time zone. Eastern is UTC−5 in winter and UTC−4 in summer.
- **GitHub secret:** an encrypted setting stored in the repo's settings. Workflows can use it, but nobody can view it again, and it's hidden in logs.
- **CI (continuous integration):** automatically running tests whenever code runs or changes. Our workflow runs the tests before every daily check.
- **Bot commit:** a commit made by automation (`github-actions[bot]`) instead of a person.
- **`git pull`:** downloads commits from GitHub that you don't have yet (like the bot's daily updates). Run it before making your own changes.
- **Wayback Machine / Internet Archive:** a nonprofit that has saved copies of websites since 1996 (archive.org).
- **Snapshot:** one saved copy of a web page at a moment in time, identified by a timestamp like `20240315083000` (year, month, day, hour, minute, second).
- **CDX API:** the Wayback Machine's search tool for listing which snapshots exist for a URL.
- **Backfill:** filling in historical data that existed before your system started collecting it.
- **Cache:** a saved local copy of something slow to get, so you don't fetch it again.
- **Code reuse:** using the same functions in more than one place. backfill.py *imports* the scraper's cleaning code and the detector's comparison code instead of copying them, so a fix in one place fixes both.
- **Rate limit:** the most requests a service allows in a time window. Go over it and you get slowed down or blocked.
- **HTTP 429 "Too Many Requests":** the status code a server sends when you've hit its rate limit.
- **Backoff:** waiting before retrying after a failure, so you don't make an overloaded service worse.
- **Command-line arguments:** extra words after a command, like `python backfill.py spotify --since 2024`. `argparse` reads them.
- **Git vs. GitHub:** Git is the program on your computer that saves versions. GitHub is the website you upload those versions to so others can see them.
- **`git init`:** turns a normal folder into a Git repo (creates a hidden `.git` folder where all history is kept).
- **`git add`:** picks which changed files go into the next save ("staging"). `git add .` means everything.
- **`git commit -m "message"`:** saves a snapshot of the staged files with a description. Each commit gets an ID like `8fd6f76`.
- **`git push`:** uploads your commits to GitHub.
- **Remote / origin:** a remote is a copy of the repo stored somewhere else; `origin` is the nickname for the GitHub one.
- **Branch / main:** a branch is a line of history. `main` is the default one.
- **Noreply email:** a private stand-in address GitHub provides so your real email isn't public on every commit.
- **README.md:** the file GitHub shows on the repo's front page. It's the project's first impression.
- **Markdown (.md):** a simple text format where `#` makes a heading and `**text**` makes bold. Used for README and these notes.
- **JavaScript-rendered page:** a page that loads its text *after* opening, using JavaScript. `requests` only sees the empty shell, so these need a real browser tool (Playwright).
- **Playwright:** a tool that controls a real browser from code. Used later for JavaScript-heavy sites.
- **Encoding (UTF-8):** the rule for turning a file's raw bytes into letters. Read it with the wrong rule and special characters turn into junk like `â` (this junk is called *mojibake*).
- **Block vs. inline tags:** in HTML, *block* tags (`<p>`, `<li>`, `<h2>`) start a new line or paragraph; *inline* tags (`<a>` links, `<b>` bold) sit in the middle of a sentence.
- **HTTP status codes:** the number a website sends back with every request. `200` = OK, `403` = Forbidden (the site refused us, often because it detected a bot), `404` = Not Found.
- **Command Prompt / terminal:** the text window where you type commands to the computer.
- **`cd` (change directory):** moves the terminal into a folder. Commands like `python scraper.py` only find files in the folder you're currently in, shown before the `>` on each line.
- **Rate limiting / politeness:** waiting between requests so we don't overload anyone's servers. We wait 2 seconds between sites and only check once a day.

*(More terms get added as we build: difflib, API, LLM, prompt, structured output, GitHub Actions, cron…)*

---

## 4. Design decisions (and why)

These are the "why did you do it this way?" answers.

1. **Git as the database.** Instead of a real database, each policy is a text file and Git keeps the history. Why: free version history, built-in diffs, and the public repo itself becomes a timestamped record of every policy change. Simple and transparent.
2. **Keep the watch list in `sources.json`, not in the code.** Why: separates *data* from *logic*. Adding a company never requires touching code.
3. **Strip "Last updated" lines.** Why: those dates change even when nothing else does, which would create false alarms. Only short lines (<80 characters) are removed, so a real sentence that mentions a date isn't lost.
4. **Skip pages with fewer than 300 words.** Why: if we only got a few words, the page probably needs JavaScript to load. Saving that would look like the policy was "deleted," which is a fake change.
5. **Don't crash on one bad site.** Why: if one company's site is down, the other 11 still get checked.
6. **Wait 2 seconds between sites.** Why: being polite to the websites, and less likely to get blocked.
7. **Pass raw bytes to BeautifulSoup instead of decoded text.** Why: on the first real run, TikTok's text came out garbled (`âServicesâ`). The `requests` library had guessed the wrong encoding. Giving BeautifulSoup the raw bytes lets it read the page's own `<meta charset>` tag and decode correctly.
8. **Only add line breaks after block tags.** Why: the first version broke a line at *every* tag, so links split sentences into 3 lines. That would make diffs noisy later. Now each paragraph stays on one line, so a changed paragraph shows up as one changed line.
9. **Date filter matches lines that *start* with a date word** ("Last updated", "Effective", "Published", "Updated"), but only if the line is short (under 80 characters). Why: catches all the date stamps sites use, while keeping real sentences like "These terms are effective when you sign up…".
10. **Flaky sites are expected.** A site can work one day and fail the next. The scraper never overwrites a good copy with a failed one, so a bad day just means "no update today," not fake data.
11. **Compare against Git's last commit, not a separate "old" folder.** Why: Git already stores the previous version, so we don't duplicate data. The rule is simple: whatever was last committed is "old," whatever the scraper just saved is "new."
12. **Compare paragraph by paragraph, not word by word.** Why: the scraper puts each paragraph on its own line (decision #8), so a reworded paragraph shows up as one clean "before vs. after" pair, which is easy for the AI and for people to read.
13. **Use a simplified copy only for comparing.** Why: lowercasing and removing punctuation means a fixed typo or a swapped quote mark doesn't count as a change. But the *saved* text and the *report* keep the real wording, so nothing is lost.
14. **Include one paragraph of context around each change.** Why: "We may share it with partners" means nothing unless you know what "it" is. Context lets the AI explain the change correctly.
15. **Don't report brand-new policies as changes.** Why: the first copy of a policy is the starting point (baseline), not a change.
16. **Write automated tests.** Why: checks 18 situations in about a second, including the tricky ones (Windows line endings, curly quotes). If a future edit breaks something, the tests catch it.
17. **Claude Haiku 5.5 for summaries.** Why: cheapest Anthropic model, more than smart enough for 1–2 sentence summaries. At this volume $5 of credit lasts a very long time. (Considered: OpenAI and Gemini. ChatGPT Plus doesn't include API credits.)
18. **Force structured output with a "tool."** Why: free-form AI text is unpredictable. Forcing a form with fixed fields and fixed severity choices means the website can always rely on `summary`, `severity`, `categories`, and `what_you_can_do` being there and valid.
19. **Prompt rules against hallucination.** Why: a tracker that invents claims about companies would be worse than useless. The AI may only use the provided text, must be neutral, and may only suggest an opt-out if the policy itself mentions one.
20. **Save summaries inside the change report, and skip ones already done.** Why: everything about a change stays in one place, and rerunning never pays for the same summary twice.
21. **Record which model wrote each summary.** Why: if we upgrade models later, we can tell old summaries from new ones.
22. **API key in `.env`, never in code.** Why: bots scan public GitHub repos for leaked keys within minutes. `.gitignore` blocks `.env`; `.env.example` shows the format without the secret.
23. **Key with no expiration, but auto-reload off.** Why: simpler to manage, and the worst case if it ever leaked is losing the $5 balance. If I stop using the project, delete the key in the Claude Console (Settings → API Keys). *Later idea: in Phase 6, switch to identity federation with GitHub Actions so there's no stored key at all.*
24. **Fake AI client in tests.** Why: tests run instantly, cost nothing, and don't need a key, and they can simulate errors (like a network failure) that are hard to trigger for real.
25. **AI training on users' content is always MAJOR, even with an opt-out.** *(My call, Nov 12.)* Why: the first live test rated it "moderate" because an opt-out existed. But most people never find opt-outs, and AI training is exactly what this tracker exists to catch. Added as a rule in the prompt and the severity description, plus a test.
26. **Proper company names in summaries.** Why: the first live test wrote "exampleapp" (the folder name). The prompt now tells the AI to capitalize names normally ("openai" → "OpenAI").
27. **GitHub Actions instead of my own computer.** Why: free for public repos, runs with my laptop off, and every run is logged publicly. It's the standard tool, so it's good to know for jobs.
28. **Run the tests before every daily check.** Why: if a code change broke something, the run stops *before* it can save bad data or send junk to the AI.
29. **Commit only when something changed.** Why: no empty daily commits cluttering the history. Each bot commit means a real policy change (or a newly fixed page).
30. **API key stored as a GitHub secret.** Why: the runner needs the key, but `.env` never leaves my PC. Secrets are encrypted, hidden in logs, and can't be viewed after saving.
31. **Odd time (11:23 UTC).** Why: GitHub's scheduled jobs pile up at the top of the hour and get delayed. An odd minute runs closer to on time.
32. **Known risks:**
    - *GitHub's computers may get blocked more often* than my home PC (sites distrust data-center traffic). That's safe, because the scraper keeps the last good copy (decision #4), but some pages may update less often.
    - *The first automatic run could flag "changes" that aren't real*, if a site shows slightly different text to a US data center than to my PC. Review the first run's report by hand.
    - *GitHub may pause scheduled workflows after 60 days with no repo activity.* If daily runs stop, re-enable them under Actions.
33. **Backfill history from the Wayback Machine.** *(My idea, Nov 12: a "Company history" tab.)* Why: without it, the site would be empty until companies happen to change their policies. With it, each company gets years of real history on launch day.
34. **One snapshot per month, starting in 2023.** Why: the archive may hold hundreds of copies of a page. Monthly is enough to catch policy changes and keeps a full run to minutes instead of hours. `--since` can go further back.
35. **Reuse the scraper's and detector's code.** Why: archived and live copies get cleaned and compared *exactly* the same way, so results are consistent.
36. **Date = when the archive first saw the new version.** Why: we can't know the exact day a company changed its policy, only that it happened between two snapshots. Both snapshot links are saved so anyone can verify it.
37. **Cache every download.** Why: the archive is slow and free, and if a run stops halfway, the rerun picks up where it left off. Bad copies are cached as empty files so they're skipped next time; network errors aren't cached, so they get retried.
38. **5-second pause between downloads** *(was 1.5s, see run log)*. Why: the Internet Archive is a nonprofit and temporarily blocks anyone going faster than roughly 15 requests a minute. 5 seconds is about 12 a minute, safely under.
39. **Cap what goes to the AI: the 15 biggest changed spots, with giant paragraphs trimmed.** Why: an old archive copy vs. a redesigned page can produce hundreds of changed spots. Haiku's price jumps 5x for any request over 100,000 tokens, and a huge prompt summarizes worse anyway. The AI is told when it's seeing only part of a large update.
40. **New prompt rule: a reorganized page is "minor."** Why: archived pages sometimes differ because of layout changes, not new rules. The AI should say so instead of inventing a big change.
41. **Back off and stop when the archive pushes back.** Why: the first real run kept firing requests after being refused, which makes a block worse. Now a refused or "429 Too Many Requests" response means wait 60s and retry once, and 3 failures in a row means stop the whole run with a message. Successful downloads are cached and failures aren't, so the rerun resumes exactly where it stopped.
42. **Ignore "we've updated our policy" banners.** Why: reviewing Spotify's real history showed 3 of 7 "changes" were just a website banner ("Your privacy is important. As of 5 December, we've updated our Privacy Policy...") appearing or disappearing. That's an announcement, not policy. Short lines (under 300 characters) like that are now dropped *before comparing*, in both the daily detector and the backfill. Saved files keep the full text. Tested on the real data: 7 changes became exactly the 4 real ones.
43. **Website built with Astro, as a static site.** Why: the data only changes once a day, so there's no need for a server or database. Astro builds plain HTML pages ahead of time, which are fast, free to host on GitHub Pages, and can't be hacked like a server can. It's also a well-known modern framework.
44. **The site reads the tracker's own files at build time.** Why: one source of truth. Adding a company to `sources.json` adds it to the site; a new change in `changes/` shows up on the next build. Nothing is typed in by hand.
45. **Rebuild the site right after the daily check.** Why: commits pushed by a GitHub Actions job don't trigger other workflows (GitHub prevents loops), so `pages.yml` listens for "Daily policy check finished" instead.
46. **A page for every change, with the exact wording.** Why: AI can be wrong. Showing the original before/after text and links to the archived copies lets anyone verify the summary. Credibility matters more than looks.
47. **Order the wording by relevance, not size.** Why: on Spotify's July 2024 change, the biggest "change" was a reordered statistics table. Ranking spots by how many words they share with the AI summary puts the age/advertising change first, which is what the summary is about.
48. **Featured quote picked automatically.** Why: policy "lines" are whole paragraphs, so the site compares *sentences*: a removed sentence vs. an added one in the same spot, preferring pairs that match the summary's topic and share some wording. It found the "Younger users may have tailored advertising turned off by default" line on its own.
49. **Backfill now saves each archived copy's word count** (`versions` in the archive report). Why: the History chart ("policy length over time") needs it, and `archive_cache/` isn't uploaded, so the build machine can't count words itself. 2 new tests.
50. **Design: dark navy glass, one blue accent, red only for "Major."** *(My call after ~17 rounds of mockups.)* Why: I wanted it to look like a real product, not AI-generated: macOS-style glass, Inter (the font Linear and Raycast use), no letter-tile logos, and one tab per job so a page never shows everything at once. Details in `DESIGN.md`.
51. **Pins are saved in the visitor's browser only.** Why: no accounts or database needed. Your pins stay on your device.
52. **The alerts form is honest about not working yet.** Why: a static site can't store emails. It says so instead of pretending, until Phase 8.

---

## 5. Run log (bugs found and what we learned)

**Run 1 (Nov 4, 2026):** 10 of 12 pages saved successfully.
- **Reddit privacy:** 0 words. The page loads its text with JavaScript, so `requests` only gets an empty shell. Plan: handle with Playwright later.
- **OpenAI terms:** `403 Forbidden`. OpenAI's site blocked the request as a bot. (Their privacy page worked.) Plan: try Playwright later; if it's still blocked, drop it or use an archived copy.
- **Bug:** garbled characters on TikTok → fixed (decision #7).
- **Bug:** sentences split at links → fixed (decision #8).

**Run 2 (Nov 4, 2026):** 10 of 12 saved again, but a different 10.
- **Both bug fixes confirmed.** TikTok's quotes are now correct ("Services"), and links stay inside their sentences.
- **OpenAI terms worked this time.** The 403 block from Run 1 was temporary. Sites sometimes block, sometimes don't.
- **Snapchat dropped to 27 words** (it worked in Run 1). The site probably served a different page this time, like a bot check or cookie screen. **The 300-word safety rule (decision #4) did its job:** it refused to overwrite the good Run 1 copy with a near-empty page, which would have looked like Snapchat deleted its whole policy.
- **Bug:** "Published: January 1, 2026" and "Effective: …" lines weren't being removed, because the filter only matched "effective date". Fixed (decision #9).

**Run 3 (Nov 12, 2026):** added X, Meta, and Apple. **14 of 17 pages saved.**
- **X and Apple worked.** Both files checked and contain real policy text. (Apple's starts with 2 language-menu lines, but they don't change, so they won't cause false alarms.)
- **Meta privacy and terms: 0 words.** Like Reddit, Facebook loads its text with JavaScript. Needs Playwright later.
- **Date fix confirmed:** word counts dropped slightly (e.g. OpenAI terms 3331 → 3321), since the "Published"/"Effective" lines are gone.
- **Gotcha:** `cd C:\Users\owen moran\...` failed without quotes. The space in "owen moran" makes Windows stop reading at `C:\Users\owen`. Paths with spaces need quotes: `cd "C:\Users\owen moran\Documents\tos-tracker"`.

**Still need a real browser (Playwright):** Reddit, Meta privacy, Meta terms.

**First backfill run (Nov 12, 2026):** `python backfill.py spotify`
- 47 monthly copies of Spotify's privacy policy found (Jan 2023 → now). The first ~20 downloaded fine at ~3 seconds each.
- Clue: the text drops from ~43,000 to ~36,000 characters in July 2023, so something big changed that month.
- **Then the archive started refusing connections** (`WinError 10061: actively refused`). We were going faster than its limit (~15 requests/min), so it temporarily blocked my connection. The script made it worse by moving straight to the next download with no pause after each refusal.
- Fix: 5s pause, back off 60s when refused, stop after 3 failures in a row (decisions #38, #41). 6 new tests.
- *Lesson:* free public services have limits. Respect them, and design for "being told no."
- **Reviewed the 7 changes it found (19 of 47 copies):** 4 real policy updates (Mar 2023, Jul 2023 rewrite with a new "Right to Opt-Out" of targeted ads, Jan 2024 data-retention criteria + tailored-ads age, Jul 2024 privacy-request statistics) and 3 fake ones caused by a "we've updated our policy" banner. Fixed (decision #42).
- *Lesson:* always look at real output by hand before trusting it. Tests only catch the problems you thought of.

**First automatic run on GitHub Actions (Nov 12, 2026):** ✅ succeeded in 47 seconds. "Nothing changed today."
- 12 of 17 pages saved from GitHub's computers.
- **OpenAI privacy + terms: 403 Forbidden.** OpenAI blocks data-center traffic but allows my home PC (predicted in decision #32). The saved copies stay safe; the robot just can't update them. Fix later: Playwright.
- Reddit + Meta still need a real browser (same as on my PC).
- **Proof the formatting filter works on real data:** Discord's word counts differed by 4 from my PC's copy (5670 vs 5674), but detect_changes correctly found no meaningful change.
- The API key secret wasn't used yet (no changes to summarize). First real use will be the first day a policy changes.
- Yellow warning: "Node.js 20 is deprecated" for `actions/checkout@v4` and `actions/setup-python@v5`. Harmless for now; bump to newer versions next time the workflow is edited.

**Still need a real browser (Playwright):** Reddit, Meta privacy, Meta terms, and (from GitHub only) OpenAI privacy + terms.

**First live AI test (Nov 12, 2026):** `python summarize.py examples\sample_change.json`
- Summary was accurate, and the opt-out tip was quoted from the policy, not invented. ✅
- Rated it MODERATE. I decided AI training should always be MAJOR → changed the rules (decision #25).
- Wrote "exampleapp" in lowercase → fixed (decision #26).

*Lesson:* real websites are messy. Testing on real data found two bugs that the fake test page didn't.

---

## 6. Progress

- [x] **Phase 1:** Pick companies and URLs (`sources.json`): 17 pages from 12 companies (added X, Meta, Apple)
- [x] **Phase 2:** Scraper working; 3 bugs fixed. Saved copies for 14 of 17 pages. *Later: Playwright for Reddit and Meta (need JavaScript) and for flaky sites (Snapchat, OpenAI).*
- [x] **Phase 3:** On GitHub at github.com/deweyzx/tos-tracker. Commit 1 (`8fd6f76`): scraper + 14 policies. Commit 2 (`ed0888b`): README.
- [x] **Phase 4:** Change detection: `detect_changes.py` + 18 passing tests. *Order matters: run it after the scraper and before committing.*
- [x] **Phase 5:** AI summaries with Claude Haiku 5.5: `summarize.py` + 17 passing tests. First live run worked; commit `8314a7e`. Verified `.env` (the key) was NOT uploaded.
- [x] **Phase 6:** Runs automatically every day at 11:23 UTC with GitHub Actions (`.github/workflows/daily.yml`, commit `59e9c92`). API key stored as a GitHub secret. First run ✅ in 47s. *Later: Playwright for OpenAI/Reddit/Meta. (Action versions bumped and `test_backfill.py` added to the test step on Nov 13.)*

### Everyday workflow (when I change code on my PC)
Once Phase 6 is on, a robot also commits to the repo every day, so **always pull first**:
```
cd "C:\Users\owen moran\Documents\tos-tracker"
git pull
(make changes / run things)
git add .
git commit -m "describe what changed"
git push
```
I no longer need to run the scraper myself. GitHub does it daily. To run it right now, go to the repo on GitHub, open **Actions → Daily policy check → Run workflow**.

### Adding a company (any time)
The scraper, the daily job and the website all read `sources.json`, so adding a company is a data change, not a code change.
1. `git pull`, then add one entry per page to `sources.json`: `{ "company": "netflix", "doc": "privacy", "url": "..." }`. The `company` ID is lowercase with no spaces, and `doc` is `privacy` or `terms`.
2. Run `python scraper.py` and open `policies/netflix/privacy.txt`. It needs **more than 300 words** of real policy text (the 300-word rule). If it's tiny or a bot-check page, the site needs JavaScript and has to wait for Playwright.
3. Optional history: `python backfill.py netflix`, then `python summarize.py` (costs a few cents).
4. Odd capitalization in the name (like "OpenAI" or "TikTok")? Add it to `NAMES` in `site/src/lib/data.js`. Otherwise the site just capitalizes the first letter.
5. Optional logo: `site/public/logos/` (see "Later" below).
6. `git add .`, commit, `git push`. **Publish website** rebuilds automatically, and the daily check picks it up the next morning.
7. Update "What it tracks" in `README.md` (the page/company counts).
- [x] **Phase 7:** Website, built Nov 12 with Astro in `site/` (decisions #43–52, design in `DESIGN.md`). Publishes to **https://deweyzx.github.io/tos-tracker/** via `.github/workflows/pages.yml`. *Original plan:*
    - **"Latest changes" tab:** newest changes across all companies, with severity badge, AI summary, date, and click-through to the before/after view. Data: `changes/*.json`.
    - **"Company history" tab:** pick a company and see a timeline of every change to its privacy policy and terms, newest first. Data: our own reports, plus older changes marked "from archive."
    - **Backfill history from the Wayback Machine (archive.org):** download past versions of each policy, run them through the same change detection + AI summaries. Gives each company years of history from day one, so the site isn't empty. *`backfill.py` + 18 tests written Nov 12. To do: run it on my PC, review results, summarize.*
    - Possibly add UI plugins/libraries to make it look especially good and clean.
- [ ] **Phase 8:** Alerts and launch

### Where we left off (Nov 12, 2026, handoff)
Built in a Claude chat; continuing in **Claude Code** on my PC. What's done and what's next:
1. **Done:** `site/` (the website), `DESIGN.md`, `.github/workflows/pages.yml`, updated `backfill.py` + `test_backfill.py` (word counts for the chart, 26 tests), `changes/archive/spotify-privacy.json` (now includes word counts), this file, `README.md`.
2. **Done (Nov 12, in Claude Code):** moved `setup/pages.yml` to `.github/workflows/pages.yml` and deleted `setup/`; all 26 backfill tests passed; committed and pushed (`3b9af3e`).
3. **Done (Nov 12):** Pages enabled and "Publish website" ran successfully (runs #1 and #2). **The site is live** at https://deweyzx.github.io/tos-tracker/. How it was set up: **Settings → Pages → Build and deployment → Source: GitHub Actions.** Then **Actions → Publish website → Run workflow** (or just push). Site: https://deweyzx.github.io/tos-tracker/
4. Test it locally anytime: `cd site`, `npm install`, `npm run dev`, open the address it prints. (Needs Node.js 22.)
5. **In progress (Nov 13, Claude Code):** `python backfill.py <company>` for the other 11 companies, one at a time (the archive rate-limits), plus Spotify again because its **terms** page was never backfilled (rerunning keeps the existing AI summaries). Then `python summarize.py`, commit, push. Each one fills in the History chart and the Latest tab.
   - Added "How to add a company" to `README.md` and to "Adding a company" above.
6. **Done (Nov 13):** added `python test_backfill.py` to `daily.yml`'s test step (it fakes the archive, so it's offline and instant). Updated the GitHub action versions in both workflows: checkout v4→v7, setup-python v5→v7, setup-node v4→v7, upload-pages-artifact v3→v5, deploy-pages v4→v5. Checked the release notes for breaking changes first: no breaking changes for us (they all now run on Node 24, which GitHub's servers support; upload-pages-artifact v4+ skips dotfiles, and the site has none). All 70 tests pass locally (22 + 22 + 26).
7. Later: Playwright for Reddit/Meta/OpenAI; an AI-written short `headline` field in `summarize.py` (the site currently uses the summary's first sentence); real email alerts (Phase 8); optional company logos from simpleicons.org in `site/public/logos/`.

---

## 7. Interview practice questions

- Tell me about a bug you hit. *(The TikTok encoding bug or the split-sentence bug: what you saw, the cause, and the fix.)*
- What does a 403 error mean, and what would you do about it?
- What happens if a site returns a broken or empty page one day? *(The 300-word rule keeps the last good copy, so there's no fake "policy deleted" alert.)*
- Why did you use Git instead of a database?
- How do you avoid false alarms when only a date changes?
- What happens if a website is down or blocks you?
- What's the difference between a normal page and a JavaScript-rendered page, and how do you handle each?
- How do you know a change is real and not just formatting? *(Compare a simplified copy: lowercase, no punctuation, single spaces. Only different words count.)*
- Why does the order "scraper → detect_changes → commit" matter? *(detect_changes compares to the last commit. If you commit first, old and new are the same and nothing is found.)*
- How do you know your code works? *(18 automated tests, including an end-to-end test with a real Git repo.)*
- How do you make sure the AI's output is reliable? *(Forced structured output with fixed allowed values, prompt rules against inventing things, and the original before/after text is always shown next to the summary so readers can check it.)*
- How do you keep your API key safe? *(In `.env`, blocked by `.gitignore`, never in code; no auto-reload so the worst case is $5.)*
- How much does it cost to run? *(Fractions of a cent per change with Haiku 5.5. Only changed paragraphs are sent, not whole policies.)*
- How does it run automatically? *(A GitHub Actions workflow on a daily cron schedule: tests → scrape → detect → summarize → commit only if something changed.)*
- How does the automated job get the API key without exposing it? *(It's stored as an encrypted GitHub secret and passed in as an environment variable. It's never in the code and hidden in logs.)*
- What happens if you push a bug? *(The workflow runs the tests first and stops before touching any data.)*
- Tell me about a time an external service limited you. *(The Internet Archive blocked my backfill for going too fast. I added a slower pace, backoff on refusals, a stop-after-3-failures rule, and caching so the run resumes where it left off.)*
- How did you get historical data? *(The Wayback Machine's CDX API: one snapshot a month since 2023, cleaned and compared with the same code as the live tracker, with archive links for verification.)*
- How do you know *when* a past change happened? *(Only that it happened between two snapshots. I date it by the first snapshot that shows it and link both.)*
- How do you keep AI costs predictable on a huge change? *(Cap it at the 15 biggest changed spots and trim giant paragraphs, which stays far below the 100K-token price cliff.)*
- Why a static site instead of a web app with a database? *(Data changes once a day; prebuilt HTML is faster, free to host, and has nothing to hack. The "database" is the Git repo.)*
- How does the website stay up to date? *(A second workflow rebuilds and republishes it whenever the daily check finishes.)*
- How can someone trust an AI summary? *(Every change has its own page with the exact removed/added wording and links to the archived copies, so you can check it yourself.)*
- How did you use AI tools while building this?
  - *Answer: I designed the system and made the decisions; I used Claude to write the code faster, and I kept notes on how every part works.*

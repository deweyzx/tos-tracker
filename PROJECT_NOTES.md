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
| `test_summarize.py` | 26 automatic checks using a *fake* AI client | Free and instant, no API key needed. Tests our code, not the AI |
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
53. **Design polish pass (Nov 17), using the frontend-design skill.** Why each change:
    - *AI-written headlines* (`headline` field in `summarize.py`, 4 new tests). The site was cutting the first sentence of the summary, which read like a robot ("Spotify's privacy policy update changes the list of data it collects") and repeated the summary right under it. Older summaries get only a headline added; their reviewed summary and severity are kept.
    - *Calendar → "Next check in 11h 34m".* The week calendar looked nice but told you nothing. Now the panel counts down to the next check and names what the tracker can't read yet and why.
    - *Four identical number cards → one totals strip.* Identical rounded cards in a row are the most common "AI template" look.
    - *Glow only on things that respond.* A hover effect on every panel is decoration; on two it means something.
    - *History tab got a timeline* under the chart: what happened at each dot, linking to each change.
    - *Companies list shows what's tracked* (Privacy Policy, Terms of Service) under each name.
    - *History shows one policy at a time* with a picker (17 charts stacked was too long), opening on the most recently changed one.
    - *Faster build:* the data is now read once per build instead of once per page (207 pages: 1.5 minutes → 2 seconds, 29 MB → 6 MB).
    - *Pinned bar starts with the 3 most recently changed companies* (with the full history, "every company with a change" was all 12 and overflowed).
    - *Change page:* the three number cards became one row inside the header, long changed spots (like an added table) fold after 8 lines, and link labels say what they open ("Archived version before" instead of "Copy before the change", which sounded like copy-to-clipboard).

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

**Full history backfill (Nov 13, 2026):** all 17 pages, about 3 hours (the archive asked us to slow down ~25 times; the 60s backoff handled it every time). First result: **256 changes**, but Google alone had 35, which was suspicious. Checked before paying for summaries and found two kinds of fake changes:
- **Wrong language.** The archive saves pages from computers around the world, so some copies were Czech or Turkish (Google, Meta, OpenAI terms, TikTok). Switching languages looked like the whole policy being rewritten (17,000 "changed" words). Fix: `looks_english()` counts common English words ("the", "you", ...). Every English copy scored 0.32 or higher and every foreign one under 0.08, so the cutoff is 0.2. Removed 21 fake changes.
- **Blips: a version that appears for a month and then disappears.** Europe's version of OpenAI's terms, Google's policy without its U.S. state law section, Apple's page with an extra children's section, a Reddit banner, a "Meta Ray-Ban" menu link. Each one made two fake changes (in and back out). Fix: `drop_blips()`. If 1–2 copies differ from the copies on both sides, and those two match, skip them. 3+ months in a row counts as real.
- **Google rotates three regional versions** (US ~10.1K words, US without the state-law section ~8.7K, EU ~14.2K) from 2025 on. Fix: an optional `"archive_must_contain"` setting in `sources.json`. Google's is "U.S. state law requirements", a heading only the US version has, so the backfill only uses US copies. (We track the US policies; the daily job runs from US servers.)
- Result: **256 → 206 changes** (Google 35 → 16). 15 new tests (41 in `test_backfill.py`). Rebuilding needed no re-downloads: the cache keeps every copy as downloaded, and the checks run when a copy is read.
- Meta's recent history is thin: since late 2025 the archive mostly saved non-English Meta pages (20 usable of 47).
- Interesting: Reddit and OpenAI need JavaScript (or block us) live, but the archive's copies have the text, so their history works anyway.

*Lesson:* look at the data before paying to process it. A quick check of the biggest number (Google's 35) found problems that affected 6 of 12 companies.

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
2. Run `python scraper.py` and open `policies/netflix/privacy.txt`. It needs **more than 300 words** of real policy text (the 300-word rule). If it's tiny, the page probably needs JavaScript: add `"browser": true` to its line in `sources.json` and try again. If it's a bot-check page even in the browser, the site blocks automated readers; it can still get history from the archive.
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
4. Test it locally anytime: `cd site`, `npm install`, `npm run dev`, open the address it prints (**http://localhost:4321/tos-tracker/**). (Needs Node.js 22+; works on my PC's Node 26.) In Claude Code, `.claude/launch.json` (added Nov 17) starts it in the app's browser pane.
   - `npm install` warns about "10 high severity vulnerabilities". They're all one library (`picomatch`, a slow-pattern bug) used by Astro's build tools to match file names. It never runs on the published site, which is plain HTML, so it's low risk. Don't run `npm audit fix --force`, which would install breaking Astro versions. It'll clear up when Astro updates.
5. **In progress (Nov 13, Claude Code):** `python backfill.py <company>` for the other 11 companies, one at a time (the archive rate-limits), plus Spotify again because its **terms** page was never backfilled (rerunning keeps the existing AI summaries). Then `python summarize.py`, commit, push. Each one fills in the History chart and the Latest tab.
   - **Backfill done (Nov 13):** 206 changes across 17 pages, after filtering out foreign-language copies, one-month blips and Google's EU version (see the Run log). **Next: `python summarize.py`** for 202 new changes (~$0.10 with Haiku 5.5: $0.10 / $0.50 per million tokens), then commit and push.
   - Added "How to add a company" to `README.md` and to "Adding a company" above.
6. **Done (Nov 13):** added `python test_backfill.py` to `daily.yml`'s test step (it fakes the archive, so it's offline and instant). Updated the GitHub action versions in both workflows: checkout v4→v7, setup-python v5→v7, setup-node v4→v7, upload-pages-artifact v3→v5, deploy-pages v4→v5. Checked the release notes for breaking changes first: no breaking changes for us (they all now run on Node 24, which GitHub's servers support; upload-pages-artifact v4+ skips dotfiles, and the site has none). All 70 tests pass locally (22 + 22 + 26). Pushed as `1b81a36`; **Publish website run #3 passed in 32s on the new versions.** The daily workflow gets its first test on the new versions at its next run.
7. **Polish pass (Nov 17, Claude chat):** see decision #53. `summarize.py` now also writes a short `headline` for each change, so **run `python summarize.py` now** (it covers the 202 new changes and adds headlines to the 4 older Spotify ones), then commit and push. The site falls back to "X changed its Privacy Policy" for anything not summarized yet.
8. **"No AI slop" design pass (Nov 17, Claude Code): committed as `5e077c5`, not pushed yet, so the live site still shows the old design.** The backfill code and data (`backfill.py`, `test_backfill.py`, `sources.json`, `changes/archive/`) and the `summarize.py` headline changes are still uncommitted, waiting for `python summarize.py`. I ran every design skill (web review, UI review, UI compare, accessibility review, UX copy, design critique, frontend design, UI polish) and compared with real sites: Open Terms Archive, ToS;DR, GitHub's changelog and Wikipedia's diff view. The old frosted-glass dashboard was the generic AI look, so I took it out. `DESIGN.md` is rewritten to match.
   - **Removed:** glowing background blobs, glass blur, gradient buttons with a shine sweep, the glowing orb logo, the circling light beam, glow on every dot and bar, the percentage ring, count-up numbers, fade-in on every panel (the page was blank until the animation ran), the "Next check in 11h 6m" countdown, the date next to the logo, decorative mini-charts in the totals.
   - **Removed because it wasn't real:** the "Get alerts" button and the email form (email alerts don't exist yet; Phase 8 can bring them back), and the 3 companies pinned by default (the bar now appears only after you pin something).
   - **Added:** a plain opening sentence saying what the site does; the companies' own wording set in a serif (system fonts, nothing downloaded) so you can tell their words from ours; the Latest feed grouped by month; for changes without a summary, how big the change was ("491 words changed in 35 places") instead of 200 copies of "summary hasn't been written"; a "How it works" panel; a "Skip to content" link.
   - **Fixed:** dates and hints were 4.11:1 contrast (now 5.0:1); white on the blue buttons was 3.24:1 (now 5.2:1 with a deeper blue); phone tap targets are 44px; the 4 tabs fit on a phone; the History chart's side axis has about 6 labels, not 13. All text on the overview passes 4.5:1.
   - Files: `site/src/styles/site.css` (rewritten), `site/src/pages/index.astro`, `site/src/layouts/Base.astro`, `site/src/pages/change/[id].astro`, `site/src/scripts/app.js`, `site/public/favicon.svg`, `DESIGN.md`. A copy of the old `site/src` and `DESIGN.md` from before this pass is in the Claude session's scratchpad folder (`site-backup-before-design-pass`), and git also still has the last committed version.
   - **Glow brought back with a rule ("afterglow"), same day, also local only.** I liked the glow from the first version, so it came back, but only where it means something: light comes from change. New wording in the redline gives off blue light; each change in the Latest feed and History timeline has a dot that's bright with a halo for the last month, plain for 3 months, dim for a year, then dark (red for Major); the chart line and recent chart points glow; this year's bar glows; the logo's red/blue lines are faintly lit; one still light behind the opening sentence; the main button and selected tab glow; the featured change's border lights up under the pointer. Checked with real sites first (Linear's changelog lights a dot on its newest entry; Raycast keeps glow to one object). All text passes 4.5:1, works on phones, build passes. Rules are in the "Glow" section of `DESIGN.md`.
   - **Circling light back (same day, local only):** the slow light that travels around the featured change's border (7s per loop) is back, by request. It's the only thing on the page that moves by itself (checked: exactly 1 running animation), and it's off for anyone with "reduce motion" on.
   - Noticed, not fixed: X's terms history still has 3 one-month spikes (7.8K → 15–19K words → back), and the newest X change shows 9,241 words. Probably another regional or logged-in version of the page that the blip filter didn't catch. Worth a look before summarizing.
9. **Impeccable installed (Nov 17):** the design skill from github.com/pbakaus/impeccable (v4.9.1), installed with `npx impeccable install` in **Command Prompt** (PowerShell blocks `npx` scripts; don't change that setting). Choices: Customize, only `claude`, project location, design hook **on**. It added `.claude/skills/impeccable/`, `.claude/agents/impeccable-*.md`, `.claude/settings.local.json` (the hook: a quick slop check after every edit, a deeper one when Claude finishes) and `.impeccable/` (local config, git-ignored). Not committed yet. Next: in a new Claude session, `/impeccable init` (writes `PRODUCT.md`); **skip `/impeccable document`** (it would rewrite `DESIGN.md`).
   - First scan of the running site (`impeccable detect http://localhost:4321/tos-tracker/`; scanning `site/dist` gives false "flat type" results because of the `/tos-tracker/` base path): 8 findings. 6 are the afterglow (glow shadows and the top light), which I chose on purpose, so it's my call whether to keep them. 2 are "card inside card" (the quote box inside the featured panel, the meter inside "How it works"), plus 1 "thick colored side border" in the source (the "What you can do" box on change pages). Those 3 are worth fixing.
   - Its telemetry is on by default (anonymous; it says it never sends project names or code). Turn off with `.claude\skills\impeccable\scripts\impeccable telemetry off` if I want.
10. **Impeccable pass (Nov 17, Claude Code): committed (with `PRODUCT.md` and `.impeccable/config.json`), not pushed yet.** The Impeccable program files (`.claude/skills/impeccable`, `.claude/agents/impeccable-*`) and my hook settings (`.claude/settings.local.json`) stay uncommitted on purpose; the backfill/summary work is still uncommitted too. Ran `/impeccable init` (wrote `PRODUCT.md`: everyday users, "see what changed recently" first, must keep the afterglow + circling light, exact wording + sources, honesty, WCAG AA), then `/impeccable critique` (two independent reviewers: design review + detector/browser) and `/impeccable audit`. **First scores: critique 25/40 (Acceptable), audit 14/20 (Good).** Reports in `.impeccable/critique/` and `.impeccable/audit/`. Then fixed everything (my choice: "everything", and "feature the newest change, light always on"):
   - **Feed shows what changed:** every row without a summary now shows one sentence of the company's changed wording in the serif (underlined = added, struck = removed). Changes where 80%+ of the page changed are labelled "mostly a page-layout or archive change". History rows say "491 words changed" instead of "X changed its Terms of Service" 200 times. New `site/src/components/ChangeRow.astro`.
   - **Featured change = newest significant change** (now Meta's Nov 2 AI wording change), so the circling light sits on something fresh. The old row of four big numbers is gone (it was the generic "hero metrics" look); its facts moved into "How it works" as plain text; "More recent changes" lists the next 5. The "Latest major change" label above the headline is gone (Impeccable bans those eyebrow labels).
   - **Screen readers:** removed/added wording is now real `<del>`/`<ins>` with hidden "Removed:"/"Added:" labels plus visible −/+ markers (`Hunk.astro`, overview quote, feed). "Latest 206" reads as "Latest, 206 changes". Chart dots are out of the tab order (the list under the chart links every change).
   - **Search & navigation:** Enter in "Find a company" opens that company's changes (it used to pin it); the circle pins. The filter has every company; topic filters hide until 10+ summaries. The filter stays in the address (`#latest/spotify`) and Back from a change page returns to the same list and scroll spot. Older months fold behind "Show 172 older changes" (Latest on a phone: 31,000px → 5,600px).
   - **Phones:** one 67px header row (was 127px), every control ≥44px, the wording comes before "Where this came from".
   - **Detector findings fixed:** no colored side stripe, no boxes inside boxes (the redline quote and the wording passages are now type between hairlines), reading width capped (~75 characters), every color a token, palette-colored text selection and scrollbars, search button no longer wraps at medium widths. Detector went from 8/10/5 findings (overview / two change pages) to only the intended glow.
   - **Glow exception recorded** in `.impeccable/config.json`: `dark-glow` and `radial-halo` ignored in `site/src/styles/site.css` only, reason "user confirmed". (Commit `.impeccable/config.json`, `PRODUCT.md`; `.impeccable/config.local.json` stays local.)
   - Checked: all text ≥4.5:1 on overview, Latest and a change page (344 elements); 1 visible `<h1>`; exactly 1 animation (the circling light); no sideways scroll at 375px; build passes.
   - **Re-ran the critique (two fresh reviewers): 25 → 26/40.** The detector now finds only the intended glow (source scan clean). The reviewer looked deeper and found new issues; I fixed the bugs and quick wins straight away: a bare "Latest" always shows all 206 (it used to keep the last filter), a "Showing Google only. Show all changes" note, focus lands on the list after a search, menus and search announce the highlighted option to screen readers, Companies-tab names link to that company's changes, the back link says "Back to Spotify changes", summaries are now the strongest text in a row while excerpts read as quotes with −/+ markers (not links), the severity tag sits next to the company, tabs fit at 375px. Snapshots in `.impeccable/critique/`.
   - **Word-level redlines (done, Nov 17):** I picked this next. New `site/src/lib/redline.js` pairs each removed sentence with the added sentence it became, diffs them word by word, and tidies the result so it reads like a person's markup ("if you ask ~~AI at Meta~~ Meta AI to write a joke"). Change pages show one merged sentence (±) instead of two near-identical paragraphs; on Meta's Nov 2 change 54 of 66 changed lines merge. A "Repeated throughout" list sums up edits made in many places ("Added 'our features that are part of' in 14 places"). Huge blocks (over ~600×600 words) fall back to whole lines. Checked: 371 text elements pass contrast, works at 375px, detector finds only the intended glow, build passes.
   - **Major-tag glow:** I chose to keep the red glow on every Major tag, even old ones (DESIGN.md records it as the one exception to "glow = fresh").
   - **Still open from the re-critique:** (2) a machine-written "what's different" line (e.g. "'AI at Meta' renamed to 'Meta AI' in 31 places") for changes with no AI summary; (3) a page per company.
11. **"Glossy, done right" (Nov 17, Claude Code + Impeccable + the frontend design skill), local only, not committed.** I felt the flat version looked a bit off and generic, and chose to go back to glossy but with discipline. Impeccable would flag glass and glow as AI tells, but "the brief wins": my choice is recorded and it helped do glossy well instead.
   - **The idea ("a pane of glass over the fine print"):** the featured change is a frosted glass lens floating over that policy's own wording, which shows sharp and faint around the lens and blurred inside it, so the redline is literally "brought into focus". Glass only on things that float (top bar, the lens, menus, search, pinned bar, tooltips); everything on the page stays solid. One light from above, the circling light on the lens, gloss = a bright top edge on the main button and selected tab. No shine sweeps, count-ups or entrance animations. People who turn on "reduce transparency" get solid surfaces and no fine print.
   - **Process:** direction contract in `.impeccable/surfaces/site-src-pages-index-astro.md` (pinned by me, so no random direction roll), built code-led, then Impeccable's independent **finish reviewer** checked it from screenshots: first verdict "fix" (8 fixes: the glass didn't read as glass yet, a label above the headline, big-number tiles on change pages, a "+" typed character as an icon, a box inside the Latest panel, contract wording, a stale comment). All 8 fixed; second verdict found 2 regressions (fine-print letters cut at the page edge, contract wording) → fixed → **verdict: ship** (covers those fixes, not a fresh full-site review). Then Impeccable's documenter merged `DESIGN.md` (my choice: merge) and wrote `.impeccable/design.json`.
   - **Checked:** lens text ≥4.5:1 even over a ghost letter, exactly 1 animation (the circling light), no sideways scroll at 390px or 1440px, source detector scan clean, build passes. The remaining detector notes are the deliberate glow and the decorative fine print (hidden from screen readers).
   - **Still open (my call):** self-hosting a serif font for the redline so it looks the same on every device (it currently uses whatever serif the device has: Cambria/Sitka on Windows, Iowan on Mac); a machine-written "what's different" headline for unsummarized changes; a page per company.
12. **"The corrections column" (Nov 17, Claude Code + Impeccable + frontend design skill), local only, not committed or pushed.** The glossy version didn't look good to me, and I let Claude override earlier requests if the result was better. It replaces the glossy world.
   - **The idea:** a newspaper corrections column, where wording changes are marked like an editor's proof. Newsprint background (#F4F5F2), ink (#16181D), a **red pencil** for removed words and Major changes (#C1121F) and a **blue pencil** for added words and links (#1D4ED8). No cards: each section starts with a heavy ink rule. The only box is the featured "correction". References: newspaper corrections boxes, editors' proof marks, Wikipedia's diff view, GitHub's changelog and Open Terms Archive. Impeccable's direction roll (seed `5b26a800bed02090`, layout option 7) is recorded in `.impeccable/surfaces/site-src-pages-index-astro.md`.
   - **My earlier requests, translated (not dropped):** the "afterglow" is now **fresh ink**. A change's dot is solid when it's new, then fades to a tint, then an outline, then a hairline over a year. The "circling light" is now **one red pencil stroke travelling around the featured correction's border** (7s per lap). It's the only thing that moves by itself and it turns off with "reduce motion". `PRODUCT.md` records this.
   - **Fonts (self-hosted now, so it looks the same on every device):** Archivo (condensed headlines, all of our own words) and Source Serif 4 (only for the companies' own wording). Added as `@fontsource-variable/archivo` and `@fontsource-variable/source-serif-4` in `site/package.json`.
   - **New things:**
     - word-level redlines (one struck word and one underlined word, not two near-identical paragraphs)
     - a "Repeated throughout" list on change pages (e.g. "share" became "disclose" in 10 places); bullet and punctuation-only entries are skipped
     - a "You were last here on …, everything above is new" line in Latest, saved in the visitor's browser
     - feed rows show a real sentence of the new wording
     - the masthead says "Checked today, 9:27 PM", and the daily run time is shown correctly through daylight saving
     - the featured change is the most important recent one (Meta, Nov 2)
   - **Removed:** the glass, glow and halos, plus the detector exceptions I had added for them (`.impeccable/config.json` now ignores nothing).
   - **Process:** Impeccable's finish reviewer checked it from screenshots. First verdict "fix", with 8 items:
     - the pencil should be a real stroke, not a sweep
     - no halos
     - remove the exceptions
     - our words in the sans-serif
     - a column rule and 8px spacing
     - keep the wordmark on phones
     - correct times and visitor-facing empty text
     - a cleaner chart

     All were fixed, plus a phone sideways-scroll bug, a too-wide summary line and the bullet entries. The second pass resolved them, and the last open items were shown fixed in fresh screenshots (`.impeccable/review/final-*.png`). Impeccable's documenter then rewrote `DESIGN.md` and `.impeccable/design.json` for this world. My earlier "merge" choice carried over, but most of the glossy system is replaced.
   - **Checked:** design detector 0 findings with no exceptions. All text passes the 4.5:1 contrast ratio (Overview, Latest, change pages). Exactly 1 animation. No sideways scroll at 375px. Build passes.
   - **Still open:** run `python summarize.py` (about $0.10) and commit the backfill work; X terms "spikes" in the data (mostly layout); a machine-written "what's different" headline; a page per company; commit + push the design when I'm happy with it.
13. **Final polish: "the editor marks it up" (Nov 18, Claude Code + Impeccable animate/delight/craft floor + frontend design skill), local only, not committed or pushed.** I loved the corrections-column style but felt it lacked uniqueness, and asked for special animations that aren't clunky or weird. The rule: **every motion is a pencil doing its job**, so nothing just floats or slides in.
   - **When the page opens:** the featured correction gets marked up. A red line strikes the removed words, then the blue pencil underlines the added words, then the pencil starts its lap. It takes about 1.5 seconds and runs once. Technical note: strikes and underlines are now painted backgrounds (a CSS `@property --d`), so the pencil draws them across wrapped lines in reading order.
   - **Change pages:** each changed spot further down is struck and underlined once, when you scroll to it. The words are always visible; only the marks wait. Printing shows everything.
   - **History:** the pen draws the chart line the first time it opens, and each change dot appears as the pen passes it.
   - **Smaller touches:**
     - the logo's red strike redraws when you point at it
     - clicking the featured change carries its headline into the change page (a browser "view transition"; Chrome and Edge, other browsers just load the page)
   - **Proofreader's marks:** the typed − / + / ± markers became hand-drawn proofreader's marks: a blue caret for added, a red "dele" loop for removed, and a slash plus caret for an edited sentence.
   - **"Reduce motion":** all marks show fully drawn and nothing moves. High-contrast (forced colors) mode falls back to real strike-through and underline.
   - **Cleanup:** removed leftover glossy colors and an unused glossy script, named the struck-text color (`--struck`), made changed-spot text lines shorter (36em, a detector finding) and made the "Show all changes" button 44px on phones.
   - **Process:** Impeccable's finish reviewer flagged 4 fixes:
     - the headline morphed into the wrong page when opening other changes (now it only happens for the featured change)
     - the caret looked like a "collapse" chevron (redrawn tall and narrow)
     - `DESIGN.md` and the direction contract still said "only one thing moves" (both updated to the new motion rules)
     - printing a change page before scrolling lost the marks (fixed)

     All 4 are fixed. A second round caught two more:
     - the print fix was in the wrong place in the CSS, so it lost to the animation rule (moved, and it now skips the animation)
     - a few leftover "one moving thing" lines in `DESIGN.md` and `.impeccable/design.json` (updated)

     Then a last note was fixed: the marks' drawings were added to the design record so its preview shows them. Detector: 0 findings on the overview and two change pages; no sideways scroll at 375px; build passes.
14. **Quick fixes after an honest review (Nov 18, Claude Code), local only, not committed or pushed.** I asked what an employer or a normal person would see as flaws; the biggest ones were content, not design. Fixed:
   - **Ran `python summarize.py`:** all 206 changes now have an AI headline and summary (0 failures): 55 Major, 33 Moderate, 115 Minor, plus headlines added to the 4 older Spotify summaries. The featured change is now a real Major story ("Meta broadens AI data use to cover all its AI features, not just one chat").
   - **Feed rows show the short AI headline** instead of the long summary cut off mid-sentence. The full summary is on each change page.
   - **Honest page description:** it said "Plain-English alerts…", but alerts don't exist. It now says what the site does.
   - **Link previews:** Open Graph and Twitter tags plus a canonical link, so links pasted into LinkedIn, Slack, iMessage or X show a title, description and image. The image is `site/public/og.png` (1200×630), drawn in the site's own fonts with a real redline from Meta's Nov 2 change.
   - **Worth a spot-check:** OpenAI's terms "remove mandatory arbitration" (Mar 2026) and then "add" it back (Jun 2026). That's probably the archive capturing different page versions, not two real changes. A few Minor ones are scraper noise (e.g. "(opens in a new window)" link labels).
   - **Note:** the local dev server reads the data once when it starts, so restart it (`npm run dev`) after running `summarize.py`.
   - **Still open:** hide or down-rank layout-only changes; an RSS feed; per-company pages; commit and push all of this.
15. **History chart redesign (Nov 18, Claude Code + dataviz skill + Impeccable), local only, not committed or pushed.** The blue line looked off, and X's chart was dominated by three huge fake spikes.
   - **Step line:** a policy's length only changes when a new version appears, so the line is flat ink between versions. Each jump is a pencil stroke: blue = grew, red = shrank.
   - **Spikes skipped:** X's archived page sometimes shows the old and the new terms together while a change is pending, so its length briefly doubles. A copy that jumps more than 40% and comes back within 25% the next month, with the jump flagged as layout, is left out of the line and shown as a faint dashed ring. Its tooltip explains why. X's chart now shows the real story: about 7k → 8.1k → 9.2k → 9.8k words.
   - **Labels:** the three biggest jumps get a direct label like "+1,170", placed only where it doesn't overlap a dot, the edge, another label or "Today".
   - **Dots and legend:** small solid ink dots; fresh = blue, Major = red. The legend now reads "Length in words / Grew / Shrank / Layout-only copy, skipped".
   - **Animation:** the pen still draws the line, and the jumps and labels appear as it passes.
   - **Checked:** X, OpenAI and Meta charts at desktop width and on a phone (375px, no sideways scroll); with reduce motion, nothing animates. The detector is clean and the build passes. `DESIGN.md` describes the chart.
16. **History chart, more unique (Nov 18): the policy as a column of type.** I asked for a more distinctive look.
   - **Column of type:** the area under the length line is filled with rows of "greeked" type (short dashes like lines of printed words), so a policy literally looks like a column of text, and a longer policy is a taller column. The axis now starts at 0 (a filled area has to, to be honest about size).
   - **Added and cut lines:** after each change, the lines that were added are set in blue type, and lines that were cut show as faint red type above the column, until the next change. It's the same red/blue pencil idea as the redlines.
   - **Cleaner scale:** no grid lines, just short ticks; the type rows give the scale its texture.
   - **Legend:** now shows small type swatches for "Lines added" and "Lines cut".
   - **Animation:** the column fills in behind the pen as it draws.
   - **Checked:** desktop and phone (no sideways scroll); the detector is clean; the build passes.
17. **Pushed and live (Nov 18).** All tests pass (41 + 22 + 26). Committed as:
   - `66c235c`: history for all 12 companies, plus all 206 AI summaries
   - `a69ea47`: the corrections-column redesign, the motion pass, the column-of-type chart, link previews and these notes

   Pushed together with the earlier unpushed design commits. The site rebuilt and is live at https://deweyzx.github.io/tos-tracker/ (checked: new featured change, og.png loads). The Impeccable program files (`.claude/skills`, `.claude/agents`) and my local `settings.local.json` stay uncommitted on purpose.
   - **Next ideas:** spot-check OpenAI's arbitration flip-flop; hide or down-rank layout-only changes in Latest; an RSS feed; a page per company.
18. **QA fixes and a keep-alive (Nov 18).** From a quick check of the live site:
   - **Repeats set aside:** the Internet Archive sometimes saves two versions of a page in turn (Meta's EU and US pages, X's "new terms coming" banner), so the same edit appeared 2–3 times. When two changes to a page touch nearly the same lines (80%+ overlap, either direction), only the **latest** is kept in the feed, counts and charts, because it matches the policy today. Example: OpenAI's terms dropped mandatory arbitration (Mar 2026) and brought it back (Jun 2026), and today's terms have it, so June is the one shown. Earlier repeats keep their page, with a note and a link to the latest one. 14 set aside, 193 changes shown.
   - **Search by product:** "ChatGPT", "Instagram", "Twitter", "Claude", "Gmail" and others now find the company ("covers Instagram").
   - **Overview shows what matters:** "More recent changes" lists Moderate and Major changes first. Minor edits (a heading word, a link label) stay in Latest.
   - **Custom 404 page** in the site's style, with links back, instead of GitHub's generic one.
   - **Keep-alive:** GitHub pauses scheduled jobs in public repos after 60 days without commits. The daily workflow now leaves an empty "Keep the daily check running" commit if the last commit is 50+ days old.
19. **Playwright for JavaScript pages (Nov 18).** Pages marked `"browser": true` in `sources.json` are now read in a hidden Chrome (Playwright). That's Meta privacy, Meta terms and Reddit. The scraper's `BrowserFetcher` opens one browser per run, loads the page, lets its JavaScript run and waits for the text. Everything after that (cleaning, comparing, summarizing) is unchanged.
   - **Wall check (`looks_blocked`):** a browser page is skipped for the day, keeping the last good copy, when:
     - it has under 300 words, or
     - it's a short page with wall wording ("log in to continue", "you've been blocked"...), or
     - it has under half the words of the last saved copy.

     The scraper doesn't try to get around bot checks.
   - **Results on my PC:** Meta privacy 7,456 words and Meta terms 5,289, matching the archive copies (7,405 / 5,424). **Reddit blocks automated browsers** ("You've been blocked by network security"), so it stays archive-only and the scraper notes that each day. Getting past it would mean disguising the bot, which I decided not to do. The site now says Reddit "blocks automated readers" instead of "needs a real browser".
   - **Daily workflow:** installs Chromium (`python -m playwright install --with-deps chromium`) and runs the new `test_scraper.py` (13 offline tests, fake browser). `playwright` is added to `requirements.txt`. All 102 tests pass.
   - **First run on GitHub:** Meta's first copies are saved as "new" (not reported as changes); from then on they're compared daily. Facebook may treat GitHub's servers differently from my PC. If so, the wall check skips it and the Actions log says why.
   - **Still open:** OpenAI blocks GitHub's servers (403), so its daily copies only update when I run the scraper on my PC.
20. **Small polish (Nov 18), pushed (`d5b6a27`).** Four leftovers from the QA list:
   - **Company dots mean something:** they were all the same blue. They now use the same afterglow as the change list, showing how recent each company's latest change is: solid for the last month, fading to an outline over a year, and red if that change was rated Major. Each company also shows "latest Nov 2", and a line under the list explains the dots. The same dots appear in search.
   - **Pin button:** it was a plain circle that looked like a radio button. It's now a pushpin with the word "Pin" (turns blue and says "Pinned").
   - **Honest dates for archive gaps:** the Internet Archive only saves a page now and then, so "found Nov 2" for Meta hid that the change happened sometime after June 1. When the copy before an archive change is over 45 days older, the site now says "changed sometime between June 1 and November 2, 2026" (`since` in `data.js`, wording from `whenFound()`).
   - **Change pages line up with the logo:** on wide screens the page sat centred, so its left edge floated between the logo and the middle. It now starts at the same left edge as the masthead.
21. **Apple's terms and 26 more companies (Nov 20).** Apple's terms update didn't show because only Apple's privacy policy was watched; added the Apple Media Services Terms (App Store, Music, TV+), and its archive history shows the October 2026 update (fixed-length subscriptions). Then:
   - **Checked every existing company:** six had no terms page, now added (Anthropic, Google, Reddit via redditinc.com, Snapchat, TikTok, Zoom). Reddit's privacy policy still blocks automated readers everywhere, so it alone stays archive-only.
   - **26 new companies:** Temu, Shein, Amazon, Microsoft, Netflix, LinkedIn, Pinterest, Uber, Airbnb, Roblox, Duolingo, Tinder, eBay, Dropbox, Slack, Steam, Lyft, Character.AI, Perplexity, Walmart (privacy only), Canva, Grammarly, Telegram, GitHub, Venmo, DoorDash. Now **38 companies, 75 pages**. Every page was read twice to make sure nothing on it changes between visits (that would make fake daily changes). Shein, Amazon, Uber, Airbnb privacy, Duolingo, Character.AI and Perplexity need the hidden browser.
   - **Left out:** PayPal, Twitch, Etsy and Epic Games block automated readers (Epic gives 403 on repeat visits); Walmart's terms show a "Robot or human?" check; Samsung's privacy page is mixed with shop promotions that would change.
   - **Scraper:** a browser page that looks wrong gets one more try (Amazon shows an empty "Page Not Found" on the first visit). 15 scraper tests.
   - **Site:** product names for search (Prime Video, Xbox, Copilot, Uber Eats, Valve...), proper names (eBay, GitHub, DoorDash, Character.AI), the description counts companies itself, the "blocks automated readers" note names the exact page ("Reddit's Privacy Policy"), and the filter menu scrolls now that it's long.
   - **Pushed before the history finished:** the archive history for the new pages loads slowly (the archive keeps asking us to wait), so the companies went live first and showed "History still loading". Today's copy of each new page is saved, so daily tracking starts with the next run.
   - **History done (Nov 20):** all 63 pages read from the archive (about 6 hours, many 60s waits). The feed now has **746 changes** (50 more folded away as repeats). DoorDash, Duolingo and Shein have no readable archive copies, so the Latest tab now says "No older history for DoorDash, Duolingo or Shein" instead of "still loading" forever (`noArchive` in `data.js`: an archive report exists but holds no copies). The run also dropped part of Google's committed privacy history; restored it with `git checkout`.
   - **Summary bug fixed:** now and then the AI returns the form half filled in, and `summarize.py` crashed on the missing `severity`. It now skips that change (retried next run) instead of saving a broken summary; an empty "what you can do" is still fine (it means the policy names no action). 2 new tests (29 in `test_summarize.py`). This also protects the daily GitHub run. 3 changes are still unsummarized and get retried by the next daily run.
   - **Anthropic's terms fixed (Nov 20):** the archive mixed Anthropic's US terms ("Anthropic, PBC") with its European terms ("Anthropic Ireland"), so the history flip-flopped between Irish and US law, and the repeat rule folded away the real Oct 2025 "will train its AI on your chats unless you opt out" change. Same fix as Google: `"archive_must_contain": "Anthropic, PBC"` in `sources.json`, history rebuilt from the 17 US copies (8 changes). The old summaries were kept by date but described the mixed-up comparisons, so all 8 were rewritten. *Lesson:* after changing which copies a history uses, delete that page's old summaries; `save_report` keeps them by date even when the change itself is different. Then checked the other pages with several repeats (Nov 20):
   - **Google terms: same problem, fixed.** The archive mixed the US page with Germany's, Canada's and the UK's (each copy says "Country version: ..."). False changes such as "Google adds EEA-specific rights" (Nov 2026) and "liability cap drops" (the Canadian page) were on the site. Now `"archive_must_contain": "Country version: United States"`; 32 US copies, 8 real changes, summaries rewritten. The rebuild again dropped part of `google-privacy.json`; restored with `git checkout` (rerunning `backfill.py google` does this every time, so always check `git status` after).
   - **Temu terms, Venmo terms, Canva privacy: fine.** Their repeats are menus and link lists switching back and forth, which the repeat rule is meant to hide. No region swap (word counts and region wording steady).
22. Later: real email alerts (Phase 8); optional company logos from simpleicons.org in `site/public/logos/`.

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

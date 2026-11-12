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
| `test_detect_changes.py` | 18 automatic checks that change detection catches real edits and ignores formatting noise | Proves the code works, and catches it if a future edit breaks something |
| `changes/` | One JSON report per day that had changes, e.g. `changes/2026-11-20.json` | A permanent log of every change found. Later becomes the website's data |
| `summarize.py` | Sends each change to Claude Haiku 5.5 and saves back a summary, severity, categories, and "what you can do" | The AI part: turns a diff into something a normal person understands |
| `test_summarize.py` | 17 automatic checks using a *fake* AI client | Free and instant, no API key needed. Tests our code, not the AI |
| `examples/sample_change.json` | A made-up policy change for trying the AI | Lets you see real AI output before any real policy changes |
| `.env` | Holds the secret API key: `ANTHROPIC_API_KEY=sk-ant-...` | Keeps the key out of the code. **Never uploaded** (blocked by `.gitignore`) |
| `.env.example` | Same as `.env` but with a fake placeholder | Shows others what settings the project needs, without exposing my key |

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
| `is_meaningful_change(old, new)` | True only if the simplified versions differ, meaning the actual words changed |
| `find_changes(old, new)` | Lines up the two versions paragraph by paragraph and returns each spot that changed (a "hunk"): removed paragraphs, added paragraphs, and 1 unchanged paragraph before and after for context |
| `count_changed_words(...)` | Roughly how many words were added or removed. Helps judge how big a change is |
| `main()` | Runs the steps above for every policy file and writes the day's report |

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

### Everyday workflow (after any change)
```
cd "C:\Users\owen moran\Documents\tos-tracker"
python scraper.py
python detect_changes.py
python summarize.py
git add .
git commit -m "describe what changed"
git push
```
- [x] **Phase 4:** Change detection: `detect_changes.py` + 18 passing tests. *Order matters: run it after the scraper and before committing.*
- [ ] **Phase 5:** AI summaries: `summarize.py` + 17 passing tests written. *To do: install new libraries, paste key into `.env`, try it on the example.*
- [ ] **Phase 6:** Run automatically every day (GitHub Actions)
- [ ] **Phase 7:** Website: feed of change cards (severity badge, AI summary, tags, before/after diff) plus a page per company. *Plan: possibly add UI plugins/libraries to make it look especially good and clean.*
- [ ] **Phase 8:** Alerts and launch

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
- How did you use AI tools while building this?
  - *Answer: I designed the system and made the decisions; I used Claude to write the code faster, and I kept notes on how every part works.*

"""
summarize.py — Phase 5: have AI explain each policy change in plain English.

Run it AFTER detect_changes.py:
    python scraper.py
    python detect_changes.py
    python summarize.py            # summarizes every report in changes/
    git add . / git commit / git push

Or try it on the built-in example (no real change needed):
    python summarize.py examples/sample_change.json

What it does, in order:
  1. Loads your API key from the .env file (never from the code)
  2. Opens each change report in changes/
  3. For each change that doesn't have a summary yet, sends it to Claude (summarize_change)
  4. Forces the answer into a fixed shape: summary, severity, categories, what_you_can_do
  5. Saves the summary back into the same report file
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

CHANGES_DIR = Path("changes")

# The AI model to use. Change this one line to switch models.
# Haiku is Anthropic's smallest, cheapest model — plenty for short summaries.
MODEL = "claude-haiku-5-5"

# The only allowed answers for severity and categories. Fixed lists keep the
# website's filters and colors consistent (no "Major!!" vs "major" vs "big").
SEVERITIES = ["major", "moderate", "minor"]
CATEGORIES = [
    "ai_training",       # using your data/content to train AI
    "data_collection",   # what they collect
    "data_sharing",      # who they share or sell it to
    "advertising",       # ads and tracking
    "your_rights",       # deleting data, opting out, access requests
    "legal",             # arbitration, lawsuits, liability
    "children",          # rules about minors
    "your_content",      # rights over what you post
    "account",           # bans, termination, account rules
    "other",
]

# This "tool" is a form the AI must fill in. Forcing the AI to use it
# guarantees we get back clean, predictable data instead of free-form text.
SUMMARY_TOOL = {
    "name": "record_policy_change",
    "description": "Record a plain-English analysis of a change to a company's policy.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "1-2 plain-English sentences a regular person understands: what changed and what it means for users. Start with the company name.",
            },
            "severity": {
                "type": "string",
                "enum": SEVERITIES,
                "description": "major = changes what happens to users' data, money, or legal rights in a way most people would care about. ALWAYS major: newly using users' data or content to train AI, even if an opt-out is offered (most people never find opt-outs). moderate = a real but limited change. minor = clarifications, rewording, contact details, formatting.",
            },
            "categories": {
                "type": "array",
                "items": {"type": "string", "enum": CATEGORIES},
                "description": "1-3 topics this change is about.",
            },
            "what_you_can_do": {
                "type": ["string", "null"],
                "description": "One concrete action a user can take (e.g. an opt-out setting) ONLY if the policy text itself says so. Otherwise null. Never invent settings.",
            },
        },
        "required": ["summary", "severity", "categories", "what_you_can_do"],
    },
}

INSTRUCTIONS = """You explain changes to company privacy policies and terms of service for regular people.

Rules:
- Base everything ONLY on the text provided. Do not guess about things the text doesn't say.
- "Removed" text is the old wording; "Added" text is the new wording. Compare them carefully.
- Plain English, no legal jargon. Be accurate and neutral, not alarmist.
- If the change is just rewording with the same meaning, say so and rate it minor.
- If the changes look like the page was reorganized (same content moved around, menus or headings changed) rather than new rules, say that and rate it minor.
- Any NEW use of users' data or content to train AI is always major, even if there's an opt-out.
- Write company names with normal capitalization (e.g. "spotify" -> "Spotify", "openai" -> "OpenAI", "x" -> "X")."""


# Safety limits on how much text goes to the AI in one request. A whole-policy
# rewrite can have hundreds of changed spots; sending all of them would be slow,
# and past 100,000 tokens Haiku's price jumps 5x for the whole request.
MAX_HUNKS_FOR_AI = 15     # send only the 15 biggest changed spots
MAX_CHARS_PER_SIDE = 2500 # trim any single huge "removed"/"added" block


def biggest_hunks(hunks, limit=MAX_HUNKS_FOR_AI):
    """The `limit` largest changed spots, kept in their original document order."""
    if len(hunks) <= limit:
        return hunks
    keep = sorted(range(len(hunks)), key=lambda i: hunks[i]["changed_words"], reverse=True)[:limit]
    return [hunks[i] for i in sorted(keep)]


def trim(text):
    return text if len(text) <= MAX_CHARS_PER_SIDE else text[:MAX_CHARS_PER_SIDE] + " [...]"


def format_change_for_ai(change):
    """Turn one change from the report into readable text for the AI."""
    parts = [f"Company: {change['company']}", f"Document: {change['doc']}"]
    hunks = biggest_hunks(change["hunks"])
    if len(hunks) < len(change["hunks"]):
        parts.append(f"(Large update: showing the {len(hunks)} biggest of {len(change['hunks'])} changed spots.)")
    parts.append("")
    for number, hunk in enumerate(hunks, start=1):
        parts.append(f"--- Change spot {number} ---")
        if hunk["context_before"]:
            parts.append("Context before: " + " ".join(hunk["context_before"]))
        parts.append("Removed: " + (trim(" ".join(hunk["removed"])) or "(nothing)"))
        parts.append("Added: " + (trim(" ".join(hunk["added"])) or "(nothing)"))
        if hunk["context_after"]:
            parts.append("Context after: " + " ".join(hunk["context_after"]))
        parts.append("")
    return "\n".join(parts)


def summarize_change(client, change):
    """Send one change to Claude and return its filled-in form as a dict."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=INSTRUCTIONS,
        tools=[SUMMARY_TOOL],
        tool_choice={"type": "tool", "name": SUMMARY_TOOL["name"]},  # must fill in the form
        messages=[{"role": "user", "content": format_change_for_ai(change)}],
    )
    for block in response.content:
        if block.type == "tool_use":
            result = dict(block.input)
            result["model"] = MODEL  # record which AI wrote it
            return result
    raise ValueError("The AI didn't return a summary.")


def summarize_report(client, report_path, save=True):
    """Summarize every un-summarized change in one report file. Returns how many were done.

    save=False just prints the summaries (used for the example file, so it stays unchanged).
    """
    report = json.loads(report_path.read_text(encoding="utf-8"))
    done = 0
    for change in report["changes"]:
        if "ai" in change:
            continue  # already summarized on an earlier run, don't pay twice
        name = f"{change['company']} / {change['doc']}"
        try:
            change["ai"] = summarize_change(client, change)
        except Exception as error:  # one failure shouldn't stop the rest
            print(f"  ! {name}: could not summarize ({error})")
            continue
        done += 1
        print(f"  [{change['ai']['severity'].upper()}] {name}: {change['ai']['summary']}")
        if save:
            # Save after each one, so nothing is lost if something fails midway.
            report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return done


def make_client():
    """Create the Anthropic client using the key from the .env file."""
    load_dotenv()  # reads .env and puts ANTHROPIC_API_KEY into the environment
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key or not key.startswith("sk-ant-"):
        sys.exit("No API key found. Open the .env file and paste your key after ANTHROPIC_API_KEY=")
    import anthropic  # imported here so the tests can run without it
    return anthropic.Anthropic(api_key=key)


def main():
    # Use the file(s) given on the command line, or every report in changes/.
    # rglob also looks in subfolders, like changes/archive/ from backfill.py.
    paths = [Path(p) for p in sys.argv[1:]] or sorted(CHANGES_DIR.rglob("*.json"))
    if not paths:
        print("No change reports to summarize. (Run detect_changes.py first.)")
        return

    client = make_client()
    total = 0
    for path in paths:
        is_example = path.parts[0] == "examples"  # try-it-out file: show results, don't save
        print(f"{path}:" + ("  (example, results not saved)" if is_example else ""))
        total += summarize_report(client, path, save=not is_example)
    if all(p.parts[0] == "examples" for p in paths):
        print(f"\nDone. {total} example summary(ies) shown (not saved).")
    else:
        print(f"\nDone. {total} new summary(ies) written.")


if __name__ == "__main__":
    main()

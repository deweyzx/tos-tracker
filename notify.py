"""
notify.py — Phase 8: email subscribers about the changes found today.

Runs at the end of the daily check, after the AI summaries are written. It reads
today's report (changes/<date>.json) and, if a policy really changed, sends one
email to everyone who signed up on the site. Buttondown (buttondown.com) keeps the
subscriber list, handles confirmations and unsubscribes, and delivers the email;
it's free for the first 100 subscribers.

    python notify.py                     # today's changes (needs BUTTONDOWN_API_KEY)
    python notify.py 2026-11-20          # another day's report
    python notify.py 2026-11-20 --dry-run  # just print the email, send nothing

Without a BUTTONDOWN_API_KEY it prints the email and sends nothing, so the daily
check works the same before email is set up.

When it sends:
  - Only on days with at least one change that isn't "minor" (or one the AI
    couldn't rate). Days with only small edits, like a new date or a renamed link,
    send nothing: daily emails about typo fixes would teach people to ignore them.
  - At most once per day: each email gets the address "changes-<date>" in
    Buttondown's archive, and Buttondown refuses a second email with the same one,
    so rerunning the daily check never sends a duplicate.
"""

import json
import os
import sys
from datetime import date
from pathlib import Path

import requests

SITE = "https://deweyzx.github.io/tos-tracker"
API_URL = "https://api.buttondown.com/v1/emails"
CHANGES_DIR = Path("changes")

DOC_NAMES = {"privacy": "Privacy Policy", "terms": "Terms of Service"}
ORDER = {"major": 0, "moderate": 1, None: 2, "minor": 3}  # None = the AI couldn't rate it


def load_changes(day):
    """The changes in changes/<day>.json, or [] if nothing changed that day."""
    path = CHANGES_DIR / f"{day}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("changes", [])


def change_link(change):
    """The change's own page on the site (same id the site uses for daily changes)."""
    return f"{SITE}/change/{change['company']}-{change['doc']}-{change['date']}-d/"


def severity(change):
    return (change.get("ai") or {}).get("severity")


def headline(change):
    ai = change.get("ai") or {}
    if ai.get("headline"):
        return ai["headline"]
    name = change["company"].capitalize()
    return f"{name} changed its {DOC_NAMES.get(change['doc'], change['doc'])}"


def worth_sending(changes):
    """True if at least one change is more than a small edit."""
    return any(severity(c) != "minor" for c in changes)


def nice_date(day):
    d = date.fromisoformat(day)
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def build_email(changes, day):
    """(subject, body in Markdown) for the day's changes, or None if not worth an email."""
    if not changes or not worth_sending(changes):
        return None
    changes = sorted(changes, key=lambda c: ORDER.get(severity(c), 2))
    big = [c for c in changes if severity(c) != "minor"]
    small = [c for c in changes if severity(c) == "minor"]

    # Subject: the most important change's headline, plus how many more.
    subject = headline(big[0])
    if len(changes) > 1:
        subject += f" (+{len(changes) - 1} more)"

    lines = [f"Policy changes found on {nice_date(day)}:", ""]
    for c in big:
        ai = c.get("ai") or {}
        label = (severity(c) or "not rated yet").capitalize()
        lines.append(f"### [{headline(c)}]({change_link(c)})")
        lines.append(f"**{label}** · {DOC_NAMES.get(c['doc'], c['doc'])}")
        lines.append("")
        if ai.get("summary"):
            lines += [ai["summary"], ""]
        if ai.get("what_you_can_do"):
            lines += [f"**What you can do:** {ai['what_you_can_do']}", ""]
    if small:
        lines += ["### Smaller edits", ""]
        lines += [f"- [{headline(c)}]({change_link(c)})" for c in small]
        lines.append("")
    lines += [
        "---",
        "",
        f"Each link shows the exact wording that changed. Summaries are written by AI from the policy text. "
        f"See every change at [ToS Tracker]({SITE}/).",
    ]
    return subject, "\n".join(lines)


def send(subject, body, day, api_key, post=None):
    """Send the email to every subscriber. Returns "sent" or "already sent"."""
    post = post or requests.post  # looked up now, so tests can swap in a fake
    response = post(
        API_URL,
        headers={
            "Authorization": f"Token {api_key}",
            # Buttondown asks for this header to confirm a key may send real emails
            # (not just save drafts); without it the first send is refused.
            "X-Buttondown-Live-Dangerously": "true",
        },
        json={
            "subject": subject,
            "body": body,
            "slug": f"changes-{day}",  # one per day: a second one is refused
            "status": "about_to_send",
        },
        timeout=30,
    )
    if response.status_code in (200, 201):
        return "sent"
    text = response.text
    if response.status_code in (400, 409) and ("slug" in text or "duplicate" in text):
        return "already sent"
    raise RuntimeError(f"Buttondown refused the email ({response.status_code}): {text[:300]}")


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    dry_run = "--dry-run" in args
    days = [a for a in args if not a.startswith("--")]
    day = days[0] if days else date.today().isoformat()

    email = build_email(load_changes(day), day)
    if email is None:
        print(f"No email for {day}: nothing changed, or only small edits.")
        return 0
    subject, body = email
    print(f"Subject: {subject}\n\n{body}\n")

    api_key = os.environ.get("BUTTONDOWN_API_KEY")
    if dry_run or not api_key:
        print("Not sent (" + ("dry run" if dry_run else "BUTTONDOWN_API_KEY isn't set") + ").")
        return 0
    print(f"Email {send(subject, body, day, api_key)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

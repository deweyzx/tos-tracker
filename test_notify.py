"""
test_notify.py — automatic checks for notify.py (the email alerts).

Run it with:   python test_notify.py

Nothing is sent: Buttondown is faked, and the reports live in a throwaway folder.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

import notify

passed = 0
failed = 0


def check(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


def change(company, doc, sev, headline=None, summary="Something changed.", action=None):
    ai = None if sev is None else {"headline": headline or f"{company} {sev} change", "summary": summary,
                                   "severity": sev, "categories": ["other"], "what_you_can_do": action}
    c = {"company": company, "doc": doc, "date": "2026-11-20", "source": "daily", "changed_words": 10, "hunks": []}
    if ai:
        c["ai"] = ai
    return c


print("When to send:")
check("no changes: no email", notify.build_email([], "2026-11-20") is None)
check("only small edits: no email", notify.build_email([change("snapchat", "privacy", "minor")], "2026-11-20") is None)
check("a moderate change: email", notify.build_email([change("meta", "terms", "moderate")], "2026-11-20") is not None)
check("a change the AI couldn't rate: email (it might matter)", notify.build_email([change("meta", "terms", None)], "2026-11-20") is not None)

print("\nWhat the email says:")
day_changes = [
    change("snapchat", "privacy", "minor", "Snapchat adds a heading"),
    change("meta", "privacy", "major", "Meta will train AI on your posts", "Meta now uses posts for AI.", "Opt out in Settings."),
    change("venmo", "terms", "moderate", "Venmo changes its dispute rules"),
]
subject, body = notify.build_email(day_changes, "2026-11-20")
check("the subject is the most important headline, plus a count", subject == "Meta will train AI on your posts (+2 more)")
check("the biggest change comes first", body.index("Meta will train") < body.index("Venmo changes"))
check("small edits are listed last, under their own heading", body.index("### Smaller edits") < body.index("Snapchat adds a heading"))
check("it links to the change's own page", f"{notify.SITE}/change/meta-privacy-2026-11-20-d/" in body)
check("it includes the summary and what you can do", "Meta now uses posts for AI." in body and "**What you can do:** Opt out in Settings." in body)
check("it gives the date in words", "November 20, 2026" in body)
check("it doesn't start with --- (Buttondown rejects that)", not body.startswith("---"))
_, one = notify.build_email([change("meta", "terms", "major", "Meta changes its terms")], "2026-11-20")
s1, _ = notify.build_email([change("meta", "terms", "major", "Meta changes its terms")], "2026-11-20")
check("one change: no '(+0 more)'", s1 == "Meta changes its terms")
s2, b2 = notify.build_email([change("openai", "terms", None)], "2026-11-20")
check("a change without a summary still gets a headline", s2 == "Openai changed its Terms of Service" and "Not rated yet" in b2)


class FakeButtondown:
    """Records what would be sent and answers like Buttondown."""

    def __init__(self, status=201, text="{}"):
        self.calls, self.status, self.text = [], status, text

    def __call__(self, url, headers, json, timeout):
        self.calls.append({"url": url, "headers": headers, "json": json})
        return SimpleNamespace(status_code=self.status, text=self.text)


print("\nSending:")
fake = FakeButtondown()
result = notify.send("Subject", "Body", "2026-11-20", "key123", post=fake)
sent = fake.calls[0]
check("it sends", result == "sent" and len(fake.calls) == 1)
check("it goes to Buttondown's email API", sent["url"] == "https://api.buttondown.com/v1/emails")
check("it signs in with the key", sent["headers"]["Authorization"] == "Token key123")
check("it confirms it's a real send", sent["headers"].get("X-Buttondown-Live-Dangerously") == "true")
check("it sends right away, not as a draft", sent["json"]["status"] == "about_to_send")
check("one email per day (fixed address)", sent["json"]["slug"] == "changes-2026-11-20")
dup = FakeButtondown(status=400, text='{"code": "slug_invalid", "detail": "slug already in use"}')
check("a rerun the same day isn't an error", notify.send("S", "B", "2026-11-20", "k", post=dup) == "already sent")
try:
    notify.send("S", "B", "2026-11-20", "k", post=FakeButtondown(status=401, text="bad key"))
    check("a wrong key is reported as an error", False)
except RuntimeError as error:
    check("a wrong key is reported as an error", "401" in str(error))

print("\nA full run (temporary folder):")
start_dir = os.getcwd()
real_post = notify.requests.post
with tempfile.TemporaryDirectory() as tmp:
    os.chdir(tmp)
    try:
        Path("changes").mkdir()
        Path("changes/2026-11-20.json").write_text(json.dumps({"date": "2026-11-20", "changes": day_changes}), encoding="utf-8")
        fake = FakeButtondown()
        notify.requests.post = fake
        os.environ.pop("BUTTONDOWN_API_KEY", None)
        check("without a key, nothing is sent", notify.main(["2026-11-20"]) == 0 and not fake.calls)
        os.environ["BUTTONDOWN_API_KEY"] = "key123"
        check("a dry run sends nothing", notify.main(["2026-11-20", "--dry-run"]) == 0 and not fake.calls)
        check("with a key, the day's email is sent", notify.main(["2026-11-20"]) == 0 and len(fake.calls) == 1)
        check("a day with no report sends nothing", notify.main(["2026-11-21"]) == 0 and len(fake.calls) == 1)
    finally:
        notify.requests.post = real_post
        os.environ.pop("BUTTONDOWN_API_KEY", None)
        os.chdir(start_dir)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

"""
test_detect_changes.py — automatic checks that detect_changes.py works.

Run it with:   python test_detect_changes.py

Each test feeds the code a made-up "old" and "new" policy and checks the answer.
The last test builds a tiny throwaway Git project to test the real thing end to end.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import detect_changes as dc

passed = 0
failed = 0


def check(name, condition):
    """Print PASS or FAIL for one test."""
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name}")


OLD = "Privacy Policy\nWe collect your email.\nWe use your data to run the service.\nContact us at privacy@example.com.\n"

print("Formatting noise should be IGNORED:")
check("extra spaces", not dc.is_meaningful_change(OLD, OLD.replace("collect your", "collect   your")))
check("changed capitalization", not dc.is_meaningful_change(OLD, OLD.replace("We collect", "WE COLLECT")))
check("added/removed punctuation", not dc.is_meaningful_change(OLD, OLD.replace("email.", "email")))
check("curly vs straight quotes", not dc.is_meaningful_change('the "Services"', "the “Services”"))
check("Windows vs Mac line endings", not dc.is_meaningful_change(OLD, OLD.replace("\n", "\r\n")))
check("identical text", not dc.is_meaningful_change(OLD, OLD))

print("\nReal wording changes should be CAUGHT:")
new = OLD.replace("to run the service.", "to run the service and to train our AI models.")
hunks = dc.find_changes(OLD, new)
check("reworded sentence is detected", len(hunks) == 1)
check("shows the old sentence", hunks and hunks[0]["removed"] == ["We use your data to run the service."])
check("shows the new sentence", hunks and "train our AI models" in hunks[0]["added"][0])
check("includes context before", hunks and hunks[0]["context_before"] == ["We collect your email."])
check("counts changed words", hunks and hunks[0]["changed_words"] >= 5)

added_para = OLD + "We may sell your data to partners.\n"
hunks = dc.find_changes(OLD, added_para)
check("brand-new paragraph is detected", len(hunks) == 1 and hunks[0]["removed"] == [] and "sell" in hunks[0]["added"][0])

removed_para = OLD.replace("We collect your email.\n", "")
hunks = dc.find_changes(OLD, removed_para)
check("deleted paragraph is detected", len(hunks) == 1 and hunks[0]["removed"] == ["We collect your email."] and hunks[0]["added"] == [])

mixed = OLD.replace("email.", "email").replace("Contact us", "Email us")
hunks = dc.find_changes(OLD, mixed)
check("real change kept, punctuation-only spot dropped", len(hunks) == 1 and "Email us" in hunks[0]["added"][0])

print("\n'We've updated our policy' banners should be IGNORED:")
banner_old = "Your privacy is important. As of 30 December, we've updated our Privacy Policy to make it easier to read.\n" + OLD
banner_new = "Your privacy is important. As of 5 December, we’ve updated our Privacy Policy to include additional detail.\n" + OLD
check("banner changing is not a change", not dc.is_meaningful_change(dc.remove_notices(banner_old), dc.remove_notices(banner_new)))
check("banner disappearing is not a change", not dc.is_meaningful_change(dc.remove_notices(banner_old), dc.remove_notices(OLD)))
long_rule = "We have updated this policy to explain that " + "we may share your data with partners for advertising " * 6
check("a long real paragraph mentioning an update is kept", long_rule in dc.remove_notices(long_rule + "\n" + OLD))
check("normal policy text is untouched", dc.remove_notices(OLD).splitlines() == OLD.splitlines())

print("\nEnd-to-end test with a real Git repo:")
start_dir = os.getcwd()
# ignore_cleanup_errors: on Windows, Git marks some files read-only, which can block
# deleting the throwaway folder afterward. That's harmless, so we don't let it crash.
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    os.chdir(tmp)
    try:
        git = lambda *args: subprocess.run(["git", *args], capture_output=True, check=True)
        git("init")
        git("config", "user.email", "test@example.com")
        git("config", "user.name", "Test")

        Path("policies/acme").mkdir(parents=True)
        Path("policies/acme/privacy.txt").write_text(OLD, encoding="utf-8")
        Path("policies/acme/terms.txt").write_text("Terms\nBe nice.\n", encoding="utf-8")
        git("add", ".")
        git("commit", "-m", "first")

        # Simulate a new scraper run: one real change, one formatting-only change, one new policy.
        Path("policies/acme/privacy.txt").write_text(new, encoding="utf-8")
        Path("policies/acme/terms.txt").write_text("Terms\nBe   nice\n", encoding="utf-8")
        Path("policies/newco").mkdir()
        Path("policies/newco/privacy.txt").write_text("Brand new policy.\n", encoding="utf-8")

        dc.main()
        reports = list(Path("changes").glob("*.json"))
        check("a changes report was written", len(reports) == 1)
        report = json.loads(reports[0].read_text(encoding="utf-8")) if reports else {"changes": []}
        names = [f"{c['company']}/{c['doc']}" for c in report["changes"]]
        check("real change reported (acme/privacy)", names == ["acme/privacy"])
        check("formatting-only change ignored (acme/terms)", "acme/terms" not in names)
        check("brand-new policy not reported as a change", "newco/privacy" not in names)
    finally:
        os.chdir(start_dir)

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

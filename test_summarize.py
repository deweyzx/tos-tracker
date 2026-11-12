"""
test_summarize.py — automatic checks for summarize.py.

Run it with:   python test_summarize.py

These tests use a FAKE AI client, so they're free, instant, and don't need an API key.
They check our code (what we send, how we save the answer), not the AI itself.
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace

import summarize as sm

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


class FakeClient:
    """Pretends to be the Anthropic client. Records what it was sent and returns a canned answer."""

    def __init__(self, answer=None, fail=False):
        self.calls = []
        self.fail = fail
        self.answer = answer or {
            "summary": "ExampleApp will now use your posts to train AI.",
            "severity": "major",
            "categories": ["ai_training", "your_content"],
            "what_you_can_do": "Opt out under Settings > Privacy > AI Data.",
        }
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError("simulated network error")
        block = SimpleNamespace(type="tool_use", input=self.answer)
        return SimpleNamespace(content=[block])


sample = json.loads(Path("examples/sample_change.json").read_text(encoding="utf-8"))
change = sample["changes"][0]

print("What we send to the AI:")
text = sm.format_change_for_ai(change)
check("includes the company name", "exampleapp" in text)
check("includes the old wording", "Removed: We use the content you post" in text)
check("includes the new wording", "train our artificial intelligence models" in text)
check("includes context", "Context after: We do not sell" in text)

client = FakeClient()
result = sm.summarize_change(client, change)
sent = client.calls[0]
check("uses the configured model", sent["model"] == sm.MODEL)
check("forces the AI to fill in the form", sent["tool_choice"]["name"] == "record_policy_change")
check("rule: AI training is always major", "train AI is always major" in sm.INSTRUCTIONS)
check("severity choices are limited to the fixed list", sm.SUMMARY_TOOL["input_schema"]["properties"]["severity"]["enum"] == ["major", "moderate", "minor"])

print("\nSize limits (protects against huge prompts):")
many = [{"removed": [f"old {i}"], "added": [f"new {i}"], "context_before": [], "context_after": [], "changed_words": i} for i in range(40)]
picked = sm.biggest_hunks(many)
check("sends at most 15 changed spots", len(picked) == 15)
check("keeps the 15 biggest", sorted(h["changed_words"] for h in picked) == list(range(25, 40)))
check("keeps them in document order", [h["changed_words"] for h in picked] == list(range(25, 40)))
big_text = sm.format_change_for_ai({"company": "acme", "doc": "terms", "hunks": many})
check("tells the AI it's seeing part of a large update", "showing the 15 biggest of 40" in big_text)
huge = {"company": "acme", "doc": "terms", "hunks": [{"removed": ["x " * 5000], "added": ["y"], "context_before": [], "context_after": [], "changed_words": 5000}]}
check("trims a giant paragraph", len(sm.format_change_for_ai(huge)) < 3500)

print("\nWhat we do with the answer:")
check("returns the summary", result["summary"].startswith("ExampleApp"))
check("returns the severity", result["severity"] == "major")
check("records which model wrote it", result["model"] == sm.MODEL)

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    report_path = Path(tmp) / "report.json"
    shutil.copy("examples/sample_change.json", report_path)

    client = FakeClient()
    count = sm.summarize_report(client, report_path)
    saved = json.loads(report_path.read_text(encoding="utf-8"))
    check("summary is saved into the report file", saved["changes"][0]["ai"]["severity"] == "major")
    check("original change data is kept", saved["changes"][0]["hunks"] == change["hunks"])
    check("reports 1 summary done", count == 1)

    client2 = FakeClient()
    count2 = sm.summarize_report(client2, report_path)
    check("already-summarized changes are skipped (no paying twice)", count2 == 0 and client2.calls == [])

    shutil.copy("examples/sample_change.json", report_path)
    failing = FakeClient(fail=True)
    count3 = sm.summarize_report(failing, report_path)
    saved3 = json.loads(report_path.read_text(encoding="utf-8"))
    check("an AI error doesn't crash the run", count3 == 0)
    check("a failed change is left unsummarized, to retry next time", "ai" not in saved3["changes"][0])

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)

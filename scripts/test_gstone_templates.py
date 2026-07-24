"""Batch smoke test for known GStone Clocktower Wiki reminder layouts.

Usage:
    python3 scripts/test_gstone_templates.py
    python3 scripts/test_gstone_templates.py 魔鬼代言人 雜技演員 洗衣婦 哲學家

This is read-only. It fetches official GStone Wiki pages and prints a compact
coverage report plus the parsed reminder payload for each role.
"""
from __future__ import annotations

import json
import sys
import time
from typing import Any

from gstone_wiki import fetch_role_reminders

DEFAULT_CASES = [
    {"title": "魔鬼代言人", "expected": "single_reminder"},
    {"title": "雜技演員", "expected": "multiple_reminders"},
    {"title": "洗衣婦", "expected": "none_or_missing_section"},
    {"title": "哲學家", "expected": "special_or_complex_text"},
    {"title": "瘋子", "expected": "special_or_complex_text"},
]


def classify(result: dict[str, Any]) -> str:
    if not result.get("found"):
        return "missing_section"
    reminders = result.get("reminders") or []
    if not reminders:
        return "no_reminders"
    if len(reminders) > 1:
        return "multiple_reminders"
    reminder = reminders[0]
    if reminder.get("special_notes"):
        return "single_with_special_notes"
    if all(reminder.get(field) for field in ("placement_timing", "placement_condition", "removal_timing")):
        return "single_complete"
    return "single_partial"


def compact(result: dict[str, Any]) -> dict[str, Any]:
    reminders = result.get("reminders") or []
    return {
        "title": result.get("title"),
        "http_status": result.get("http_status"),
        "found": bool(result.get("found")),
        "classification": classify(result),
        "reminder_count": len(reminders),
        "labels": [item.get("label") for item in reminders],
        "complete_fields": [
            {
                "label": item.get("label"),
                "placement_timing": bool(item.get("placement_timing")),
                "placement_condition": bool(item.get("placement_condition")),
                "removal_timing": bool(item.get("removal_timing")),
                "special_notes": bool(item.get("special_notes")),
            }
            for item in reminders
        ],
        "source_url": result.get("source_url"),
    }


def main() -> int:
    titles = sys.argv[1:]
    cases = [{"title": title, "expected": "custom"} for title in titles] if titles else DEFAULT_CASES
    reports = []
    failures = 0

    for index, case in enumerate(cases):
        title = case["title"]
        try:
            result = fetch_role_reminders(title)
            report = compact(result)
            report["expected_case"] = case["expected"]
            report["reminders"] = result.get("reminders") or []
        except Exception as exc:
            failures += 1
            report = {
                "title": title,
                "expected_case": case["expected"],
                "classification": "request_or_parser_error",
                "error": f"{type(exc).__name__}: {exc}",
            }
        reports.append(report)
        if index < len(cases) - 1:
            time.sleep(0.8)

    summary = {
        "tested": len(reports),
        "errors": failures,
        "classifications": {},
    }
    for report in reports:
        key = report.get("classification", "unknown")
        summary["classifications"][key] = summary["classifications"].get(key, 0) + 1

    print(json.dumps({"summary": summary, "results": reports}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

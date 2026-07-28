from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from typing import Iterable

from role_models import RoleReminder


PROTECTED_REMINDER_SOURCES = {"larplus", "manual"}
GSTONE_REMINDER_SOURCE = "gstone_official_wiki"
POCKET_REMINDER_SOURCE = "pocket_grimoire"


def normalize_reminder_label(value: str | None) -> str:
    """Return the identity used to compare reminder labels across sources."""
    normalized = unicodedata.normalize("NFKC", str(value or ""))
    normalized = re.sub(r"\s+", "", normalized)
    return normalized.casefold()


def normalized_source(value: str | None) -> str:
    return str(value or "").strip().lower()


def is_protected_reminder(reminder: RoleReminder) -> bool:
    return normalized_source(reminder.source) in PROTECTED_REMINDER_SOURCES


def reminder_source_priority(reminder: RoleReminder) -> tuple[int, int]:
    """Manual data wins display conflicts; GStone wins automated conflicts."""
    source = normalized_source(reminder.source)
    priority = {
        "larplus": 400,
        "manual": 390,
        GSTONE_REMINDER_SOURCE: 300,
        POCKET_REMINDER_SOURCE: 200,
    }.get(source, 100)
    return priority, int(reminder.id or 0)


def group_reminders(reminders: Iterable[RoleReminder]) -> dict[tuple[str, str], list[RoleReminder]]:
    groups: dict[tuple[str, str], list[RoleReminder]] = defaultdict(list)
    for reminder in reminders:
        key = (
            str(reminder.scope or "role").strip().lower(),
            normalize_reminder_label(reminder.label_zh_tw),
        )
        groups[key].append(reminder)
    return groups


def preferred_reminders(reminders: Iterable[RoleReminder]) -> list[RoleReminder]:
    """Return one visible reminder per scope/label without mutating the database."""
    selected = [
        max(group, key=reminder_source_priority)
        for group in group_reminders(reminders).values()
        if group
    ]
    return sorted(selected, key=lambda item: (item.scope or "role", item.sort_order, item.id or 0))


def automated_canonical(group: Iterable[RoleReminder]) -> RoleReminder | None:
    automated = [item for item in group if not is_protected_reminder(item)]
    return max(automated, key=reminder_source_priority) if automated else None


def redundant_automated_reminders(group: Iterable[RoleReminder]) -> list[RoleReminder]:
    """Find automated duplicates that can be removed without touching manual data."""
    automated = [item for item in group if not is_protected_reminder(item)]
    canonical = automated_canonical(automated)
    if canonical is None:
        return []
    return [item for item in automated if item is not canonical]


def find_matching_group(
    reminders: Iterable[RoleReminder],
    label: str,
    scope: str = "role",
) -> list[RoleReminder]:
    key = (str(scope or "role").strip().lower(), normalize_reminder_label(label))
    return group_reminders(reminders).get(key, [])

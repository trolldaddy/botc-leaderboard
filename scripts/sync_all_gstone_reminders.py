from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from gstone_wiki import fetch_role_reminders  # noqa: E402
from role_models import Role, RoleAlias, RoleContentBlock, RoleReminder  # noqa: E402
from role_reminder_merge import (  # noqa: E402
    GSTONE_REMINDER_SOURCE,
    PROTECTED_REMINDER_SOURCES,
    automated_canonical,
    find_matching_group,
    normalized_source,
    redundant_automated_reminders,
)

PROTECTED_SOURCES = PROTECTED_REMINDER_SOURCES
GStone_SOURCE = GSTONE_REMINDER_SOURCE


def role_aliases(role: Role) -> list[str]:
    values: list[str] = []
    for value in [role.name_en, role.canonical_key]:
        value = (value or "").strip()
        if value and value not in values:
            values.append(value)
    for alias in role.aliases or []:
        for value in [alias.external_name, alias.external_id]:
            value = (value or "").strip()
            if value and value not in values:
                values.append(value)
    return values


def sync(write: bool = False, delay: float = 0.15, limit: int | None = None) -> dict:
    db = SessionLocal()
    summary = {
        "mode": "write" if write else "preview",
        "roles_scanned": 0,
        "pages_found": 0,
        "pages_without_reminders": 0,
        "reminders_found": 0,
        "would_create": 0,
        "would_update": 0,
        "created": 0,
        "updated": 0,
        "protected": 0,
        "duplicates_merged": 0,
        "duplicate_blocks_disabled": 0,
        "failures": [],
        "roles": [],
    }
    try:
        query = db.query(Role).filter(Role.is_active == True).order_by(Role.id)  # noqa: E712
        roles = query.limit(limit).all() if limit else query.all()
        for role in roles:
            summary["roles_scanned"] += 1
            role_result = {
                "role_id": role.id,
                "role_key": role.canonical_key,
                "role_name": role.name_zh_tw,
                "status": "ok",
                "reminders": [],
            }
            try:
                result = fetch_role_reminders(role.name_zh_tw, aliases=role_aliases(role))
                summary["pages_found"] += 1
                reminders = result.get("reminders") or []
                role_result["source_url"] = result.get("source_url")
                role_result["resolved_title"] = result.get("resolved_title")
                role_result["resolution_method"] = result.get("resolution_method")
                if not reminders:
                    summary["pages_without_reminders"] += 1
                existing = db.query(RoleReminder).filter(
                    RoleReminder.role_id == role.id
                ).order_by(RoleReminder.id).all()
                for index, incoming in enumerate(reminders):
                    label = str(incoming.get("label") or incoming.get("label_zh_tw") or "").strip()
                    if not label:
                        continue
                    summary["reminders_found"] += 1
                    group = find_matching_group(existing, label, scope="role")
                    protected_items = [
                        item for item in group
                        if normalized_source(item.source) in PROTECTED_SOURCES
                    ]
                    item = automated_canonical(group)
                    action = "update" if item else "create"
                    if protected_items:
                        action = "protected"
                        summary["protected"] += 1
                    elif item:
                        summary["would_update"] += 1
                    else:
                        summary["would_create"] += 1

                    role_result["reminders"].append({"label": label, "action": action})
                    if not write or action == "protected":
                        continue
                    if not item:
                        item = RoleReminder(role_id=role.id, label_zh_tw=label, scope="role")
                        db.add(item)
                        existing.append(item)
                        summary["created"] += 1
                    else:
                        summary["updated"] += 1
                    for duplicate in redundant_automated_reminders(group):
                        db.delete(duplicate)
                        if duplicate in existing:
                            existing.remove(duplicate)
                        summary["duplicates_merged"] += 1
                    item.label_zh_tw = label
                    item.sort_order = index
                    item.placement_timing = incoming.get("placement_timing") or None
                    item.placement_condition = incoming.get("placement_condition") or None
                    item.removal_timing = incoming.get("removal_timing") or None
                    item.special_notes = incoming.get("special_notes") or None
                    item.source = GStone_SOURCE
                    item.source_url = result.get("source_url") or None
                    item.needs_review = True

                if write:
                    duplicate_blocks = db.query(RoleContentBlock).filter(
                        RoleContentBlock.role_id == role.id,
                        RoleContentBlock.block_type == "reminders",
                        RoleContentBlock.is_active == True,  # noqa: E712
                    ).all()
                    for block in duplicate_blocks:
                        if (block.source or "").strip().lower() in PROTECTED_SOURCES:
                            continue
                        block.is_active = False
                        summary["duplicate_blocks_disabled"] += 1
                    db.commit()
            except Exception as exc:
                db.rollback()
                role_result["status"] = "failed"
                role_result["error"] = f"{type(exc).__name__}: {exc}"
                summary["failures"].append({
                    "role_id": role.id,
                    "role_key": role.canonical_key,
                    "role_name": role.name_zh_tw,
                    "error": role_result["error"],
                })
            summary["roles"].append(role_result)
            if delay:
                time.sleep(delay)
        return summary
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Preview or write all GStone reminder tokens into RoleReminder.")
    parser.add_argument("--write", action="store_true", help="Write changes to the database.")
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between GStone requests.")
    parser.add_argument("--limit", type=int, default=None, help="Optional role limit for testing.")
    args = parser.parse_args()
    result = sync(write=args.write, delay=max(0, args.delay), limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

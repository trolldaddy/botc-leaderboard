from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from role_models import Role, RoleReminder  # noqa: E402
from role_reminder_merge import (  # noqa: E402
    GSTONE_REMINDER_SOURCE,
    POCKET_REMINDER_SOURCE,
    automated_canonical,
    group_reminders,
    normalized_source,
    redundant_automated_reminders,
)


def cleanup(write: bool = False) -> dict:
    db = SessionLocal()
    result = {
        "mode": "write" if write else "preview",
        "roles_scanned": 0,
        "duplicate_groups": 0,
        "would_delete": 0,
        "deleted": 0,
        "protected_rows_preserved": 0,
        "groups": [],
    }
    try:
        roles = db.query(Role).order_by(Role.id).all()
        for role in roles:
            result["roles_scanned"] += 1
            reminders = (
                db.query(RoleReminder)
                .filter(RoleReminder.role_id == role.id)
                .order_by(RoleReminder.id)
                .all()
            )
            for (scope, normalized_label), group in group_reminders(reminders).items():
                sources = [normalized_source(item.source) for item in group]
                pocket_rows = [
                    item for item in group
                    if normalized_source(item.source) == POCKET_REMINDER_SOURCE
                ]
                redundant = redundant_automated_reminders(group)
                if GSTONE_REMINDER_SOURCE not in sources:
                    redundant = list({item.id: item for item in [*redundant, *pocket_rows]}.values())
                if len(group) < 2 and not redundant:
                    continue
                protected = [
                    item for item in group
                    if normalized_source(item.source) in {"larplus", "manual"}
                ]
                canonical = automated_canonical(group)
                if canonical and normalized_source(canonical.source) == POCKET_REMINDER_SOURCE:
                    canonical = None
                result["duplicate_groups"] += 1
                result["protected_rows_preserved"] += len(protected)
                result["would_delete"] += len(redundant)
                result["groups"].append({
                    "role_id": role.id,
                    "role_key": role.canonical_key,
                    "role_name": role.name_zh_tw,
                    "scope": scope,
                    "normalized_label": normalized_label,
                    "kept_automated_id": canonical.id if canonical else None,
                    "kept_automated_source": canonical.source if canonical else None,
                    "protected_ids": [item.id for item in protected],
                    "deleted_ids": [item.id for item in redundant],
                    "sources": [item.source for item in group],
                })
                if write:
                    for item in redundant:
                        db.delete(item)
                        result["deleted"] += 1
        if write:
            db.commit()
        else:
            db.rollback()
        return result
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove Pocket reminders and duplicate automated rows; GStone is canonical."
    )
    parser.add_argument("--write", action="store_true", help="Commit cleanup changes.")
    args = parser.parse_args()
    print(json.dumps(cleanup(write=args.write), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

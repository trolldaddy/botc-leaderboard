"""Backfill Traditional Chinese, Simplified Chinese, and English role aliases.

Usage:
    python3 scripts/backfill_role_language_aliases.py

This script is idempotent. It only creates missing aliases and never overwrites
existing aliases that point to another role.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from opencc import OpenCC
from sqlalchemy.orm import Session

from database import SessionLocal
from role_models import Role, RoleAlias

TO_SIMPLIFIED = OpenCC("t2s")


def ensure_alias(db: Session, role: Role, source: str, external_id: str, external_name: str | None = None) -> str:
    value = (external_id or "").strip()
    if not value:
        return "empty"
    existing = db.query(RoleAlias).filter(
        RoleAlias.source == source,
        RoleAlias.external_id == value,
    ).first()
    if existing:
        return "exists_same" if existing.role_id == role.id else "conflict"
    db.add(RoleAlias(
        role_id=role.id,
        source=source,
        external_id=value,
        external_name=(external_name or value),
    ))
    return "created"


def main() -> int:
    db = SessionLocal()
    stats = {"created": 0, "exists_same": 0, "conflict": 0, "empty": 0}
    source_stats = {}
    try:
        roles = db.query(Role).order_by(Role.id.asc()).all()
        for role in roles:
            entries = [
                ("language_zh_tw", role.name_zh_tw, role.name_zh_tw),
                ("language_zh_cn", TO_SIMPLIFIED.convert(role.name_zh_tw or ""), TO_SIMPLIFIED.convert(role.name_zh_tw or "")),
                ("language_en", role.name_en or "", role.name_en or ""),
            ]
            for source, external_id, external_name in entries:
                result = ensure_alias(db, role, source, external_id, external_name)
                stats[result] += 1
                source_stats.setdefault(source, {"created": 0, "exists_same": 0, "conflict": 0, "empty": 0})
                source_stats[source][result] += 1
        db.commit()
        print({"roles": len(roles), "summary": stats, "sources": source_stats})
        return 0 if stats["conflict"] == 0 else 2
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

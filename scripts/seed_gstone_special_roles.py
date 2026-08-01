from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path

from sqlalchemy import func

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from gstone_wiki import fetch_role_information, to_traditional  # noqa: E402
from role_models import Role, RoleAlias  # noqa: E402

SPECIAL_ROLE_TITLES = {
    "fabled": [
        "小提琴手", "公爵夫人", "天使", "圣洁之魂", "失败的上帝", "末日预言者",
        "地狱藏书员", "灯神", "佛教徒", "玩具匠", "革命者", "哨兵", "赦令承旨",
        "骗人精", "摆渡人", "麒麟",
    ],
    "loric": [
        "印度教教徒", "异术士", "讷神", "园丁", "私货商人", "诡诈杰克",
        "首席律师", "教皇", "腹语师", "遗忘之门", "暴风捕手",
    ],
}
ROLE_TYPE_TO_TEAM = {"傳奇角色": "fabled", "传奇角色": "fabled", "奇遇角色": "loric"}
OVERVIEW_TITLES = {"傳奇角色", "传奇角色", "奇遇角色"}


def canonical_key(english_name: str, title: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", (english_name or "").lower()).strip("_")
    if key:
        return key
    digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:12]
    return f"gstone_special_{digest}"


def iter_special_roles():
    for expected_team, titles in SPECIAL_ROLE_TITLES.items():
        for title in titles:
            yield expected_team, title


def find_existing_role(db, title_tw: str, english_name: str, key: str):
    filters = [func.lower(Role.name_zh_tw) == title_tw.lower(), Role.canonical_key == key]
    if english_name:
        filters.append(func.lower(Role.name_en) == english_name.lower())
    for condition in filters:
        role = db.query(Role).filter(condition).first()
        if role:
            return role
    return None


def ensure_alias(db, role: Role, source_title: str, source_url: str) -> bool:
    external_id = source_url or source_title
    alias = db.query(RoleAlias).filter(
        RoleAlias.source == "gstone_wiki", RoleAlias.external_id == external_id,
    ).first()
    if alias:
        return False
    db.add(RoleAlias(
        role_id=role.id, source="gstone_wiki", external_id=external_id, external_name=source_title,
    ))
    return True


def run(write: bool = False, delay: float = 0.15) -> dict:
    db = SessionLocal()
    stats = {
        "mode": "write" if write else "preview", "source_policy": "gstone_only",
        "expected": {team: len(titles) for team, titles in SPECIAL_ROLE_TITLES.items()},
        "pages_checked": 0, "roles_would_create": 0, "roles_created": 0,
        "roles_reused": 0, "aliases_would_create": 0, "aliases_created": 0,
        "images_would_update": 0, "images_updated": 0,
        "type_mismatches": [], "failures": [], "roles": [],
    }
    try:
        for expected_team, source_title in iter_special_roles():
            row = {"source_title": source_title, "expected_team": expected_team}
            try:
                if to_traditional(source_title) in OVERVIEW_TITLES:
                    raise ValueError("role overview pages cannot be seeded as roles")
                info = fetch_role_information(source_title)
                stats["pages_checked"] += 1
                role_type = info.get("role_type") or ""
                actual_team = ROLE_TYPE_TO_TEAM.get(role_type)
                row.update({
                    "resolved_title": info.get("resolved_title"), "source_url": info.get("source_url"),
                    "role_type": role_type, "english_name": info.get("english_name") or "",
                    "image_url": info.get("image_url") or "",
                })
                if actual_team != expected_team:
                    row["status"] = "type_mismatch"
                    stats["type_mismatches"].append(row.copy())
                    stats["roles"].append(row)
                    continue

                name_tw = to_traditional(info.get("resolved_title") or source_title)
                english_name = info.get("english_name") or ""
                key = canonical_key(english_name, name_tw)
                role = find_existing_role(db, name_tw, english_name, key)
                if role:
                    stats["roles_reused"] += 1
                    row["status"] = "reused"
                    if info.get("image_url") and not role.image_url:
                        stats["images_would_update"] += 1
                        if write:
                            role.image_url = info["image_url"]
                            stats["images_updated"] += 1
                else:
                    stats["roles_would_create"] += 1
                    row["status"] = "would_create"
                    if write:
                        role = Role(
                            canonical_key=key, name_zh_tw=name_tw, name_en=english_name or None,
                            team=actual_team, ability_zh_tw=info.get("official_ability") or None,
                            source_type="official_wiki", source_name="GStone 鐘樓百科",
                            image_url=info.get("image_url") or None,
                            script_names_json=json.dumps(info.get("script_names") or [], ensure_ascii=False),
                            ability_tags_json=json.dumps(info.get("ability_tags") or [], ensure_ascii=False),
                            is_official=True, is_custom=False, is_active=True, needs_review=False,
                        )
                        db.add(role)
                        db.flush()
                        stats["roles_created"] += 1

                row.update({"name_zh_tw": name_tw, "canonical_key": key})
                external_id = info.get("source_url") or source_title
                alias_exists = db.query(RoleAlias.id).filter(
                    RoleAlias.source == "gstone_wiki", RoleAlias.external_id == external_id,
                ).first() is not None
                if not alias_exists:
                    stats["aliases_would_create"] += 1
                    if write and ensure_alias(db, role, source_title, info.get("source_url") or ""):
                        stats["aliases_created"] += 1
                stats["roles"].append(row)
                if write:
                    db.commit()
            except Exception as exc:
                db.rollback()
                row.update({"status": "failed", "error": f"{type(exc).__name__}: {exc}"})
                stats["failures"].append(row.copy())
                stats["roles"].append(row)
            if delay:
                time.sleep(delay)
        if not write:
            db.rollback()
        return stats
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed individual GStone Fabled and Loric roles; overview pages are excluded."
    )
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--delay", type=float, default=0.15)
    args = parser.parse_args()
    print(json.dumps(run(write=args.write, delay=max(0, args.delay)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

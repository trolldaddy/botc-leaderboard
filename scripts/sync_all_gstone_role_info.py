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
from gstone_wiki import fetch_role_information  # noqa: E402
from role_models import Role  # noqa: E402

TEAM_MAP = {"鎮民": "townsfolk", "外來者": "outsider", "爪牙": "minion", "惡魔": "demon", "旅行者": "traveller", "傳奇角色": "fabled"}


def encode_list(values: list[str]) -> str:
    return json.dumps(list(dict.fromkeys(value.strip() for value in values if value.strip())), ensure_ascii=False)


def decode_list(value: str | None) -> list[str]:
    try:
        data = json.loads(value or "[]")
        return data if isinstance(data, list) else []
    except (TypeError, ValueError):
        return []


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
        "ability_policy": "GStone 角色能力為正式來源；百科缺漏時保留現值",
        "roles_scanned": 0, "pages_found": 0, "role_info_found": 0,
        "abilities_found": 0, "abilities_would_update": 0, "abilities_updated": 0,
        "would_update": 0, "updated": 0, "unchanged": 0,
        "missing_role_info": [], "missing_official_ability": [], "failures": [], "roles": [],
    }
    try:
        query = db.query(Role).filter(Role.is_active == True).order_by(Role.id)  # noqa: E712
        roles = query.limit(limit).all() if limit else query.all()
        for role in roles:
            summary["roles_scanned"] += 1
            row = {"role_id": role.id, "role_key": role.canonical_key, "role_name": role.name_zh_tw, "status": "ok"}
            try:
                info = fetch_role_information(role.name_zh_tw, aliases=role_aliases(role))
                summary["pages_found"] += 1
                row["source_url"] = info.get("source_url")
                if not info.get("found"):
                    row["status"] = "missing_role_info"
                    summary["missing_role_info"].append(role.name_zh_tw)
                else:
                    summary["role_info_found"] += 1
                    official_ability = str(info.get("official_ability") or "").strip()
                    if official_ability:
                        summary["abilities_found"] += 1
                    else:
                        summary["missing_official_ability"].append(role.name_zh_tw)
                    proposed = {
                        "name_en": info.get("english_name") or role.name_en or "",
                        "script_names": info.get("script_names") or [],
                        "role_type": info.get("role_type") or "",
                        "team": TEAM_MAP.get(info.get("role_type") or "", role.team),
                        "ability_tags": info.get("ability_tags") or [],
                        "ability_zh_tw": official_ability or role.ability_zh_tw or "",
                    }
                    current = {
                        "name_en": role.name_en or "",
                        "script_names": decode_list(role.script_names_json),
                        "role_type": "",
                        "team": role.team,
                        "ability_tags": decode_list(role.ability_tags_json),
                        "ability_zh_tw": role.ability_zh_tw or "",
                    }
                    changed = any(current[key] != proposed[key] for key in ("name_en", "script_names", "team", "ability_tags", "ability_zh_tw"))
                    ability_changed = bool(official_ability and official_ability != current["ability_zh_tw"])
                    if ability_changed:
                        summary["abilities_would_update"] += 1
                    row.update({
                        "current": current,
                        "proposed": proposed,
                        "action": "update" if changed else "unchanged",
                        "ability_action": "update" if ability_changed else ("unchanged" if official_ability else "preserve_missing"),
                    })
                    if changed:
                        summary["would_update"] += 1
                        if write:
                            role.name_en = proposed["name_en"] or None
                            role.script_names_json = encode_list(proposed["script_names"])
                            role.ability_tags_json = encode_list(proposed["ability_tags"])
                            role.team = proposed["team"]
                            if official_ability:
                                role.ability_zh_tw = official_ability
                                if ability_changed:
                                    summary["abilities_updated"] += 1
                            summary["updated"] += 1
                    else:
                        summary["unchanged"] += 1
                if write:
                    db.commit()
            except Exception as exc:
                db.rollback()
                row["status"] = "failed"
                row["error"] = f"{type(exc).__name__}: {exc}"
                summary["failures"].append({"role_id": role.id, "role_key": role.canonical_key, "role_name": role.name_zh_tw, "error": row["error"]})
            summary["roles"].append(row)
            if delay:
                time.sleep(delay)
        return summary
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync structured role information from GStone role articles.")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--delay", type=float, default=0.15)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    print(json.dumps(sync(write=args.write, delay=max(0, args.delay), limit=args.limit), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

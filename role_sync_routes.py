import re
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, Depends, HTTPException
from opencc import OpenCC
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
from role_models import Role, RoleAlias

router = APIRouter(prefix="/role-sync", tags=["role-sync"])

PG_BASE = "https://raw.githubusercontent.com/Skateside/pocket-grimoire/main/assets/data"
PG_EN_URL = f"{PG_BASE}/characters.json"
PG_ZH_CN_URL = f"{PG_BASE}/characters/zh_CN.json"

BOTC_TERM_REPLACEMENTS = {
    "奴才": "爪牙",
    "好人": "善良陣營",
    "說書⼈": "說書人",
    "喝醉": "醉酒",
    "每個夜晚": "每晚",
    "每個白天": "每天",
    "遊戲限一次": "每局限一次",
}


def fetch_json(url: str) -> List[Dict[str, Any]]:
    try:
        response = requests.get(url, timeout=20, headers={"User-Agent": "Larplus-BOTC-Knowledge-Base/1.0"})
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"無法讀取 Pocket Grimoire：{exc}")
    if not isinstance(payload, list):
        raise HTTPException(status_code=502, detail="Pocket Grimoire 回傳格式不是角色陣列")
    return payload


def normalize_text(value: Any, converter: OpenCC) -> str:
    text = converter.convert(str(value or "").strip())
    for source, target in BOTC_TERM_REPLACEMENTS.items():
        text = text.replace(source, target)
    return text.strip()


def normalize_list(values: Any, converter: OpenCC) -> List[str]:
    if not isinstance(values, list):
        return []
    return [normalize_text(value, converter) for value in values if str(value or "").strip()]


def normalize_role_id(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").strip().lower())


def safe_order(value: Any) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def load_source() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]], OpenCC]:
    english_items = fetch_json(PG_EN_URL)
    zh_cn_items = fetch_json(PG_ZH_CN_URL)
    english_by_id = {str(item.get("id") or "").strip(): item for item in english_items if item.get("id")}
    zh_by_id = {str(item.get("id") or "").strip(): item for item in zh_cn_items if item.get("id")}
    return english_by_id, zh_by_id, OpenCC("s2twp")


def build_incoming(external_id: str, en_item: Dict[str, Any], zh_item: Dict[str, Any], converter: OpenCC) -> Dict[str, Any]:
    translated_name = normalize_text(zh_item.get("name"), converter)
    english_name = str(en_item.get("name") or "").strip()
    has_localized_name = bool(translated_name and normalize_role_id(translated_name) != normalize_role_id(english_name))
    return {
        "canonical_key": external_id,
        "name_zh_tw": translated_name,
        "has_localized_name": has_localized_name,
        "name_en": english_name,
        "team": str(en_item.get("team") or "").strip(),
        "ability_zh_tw": normalize_text(zh_item.get("ability"), converter),
        "first_night_order": safe_order(en_item.get("firstNight")),
        "other_night_order": safe_order(en_item.get("otherNight")),
        "first_night_reminder": normalize_text(zh_item.get("firstNightReminder"), converter),
        "other_night_reminder": normalize_text(zh_item.get("otherNightReminder"), converter),
        "reminders": normalize_list(zh_item.get("reminders"), converter),
        "reminders_global": normalize_list(zh_item.get("remindersGlobal"), converter),
        "setup": bool(en_item.get("setup")),
        "special": en_item.get("special") if isinstance(en_item.get("special"), list) else [],
    }


def role_indexes(db: Session):
    roles = db.query(Role).all()
    roles_by_key = {role.canonical_key: role for role in roles}
    roles_by_normalized_key = {}
    for role in roles:
        normalized = normalize_role_id(role.canonical_key)
        if normalized and normalized not in roles_by_normalized_key:
            roles_by_normalized_key[normalized] = role

    aliases = db.query(RoleAlias).filter(RoleAlias.source.in_(["master_role_db", "pocket_grimoire"])).all()
    alias_map = {}
    normalized_alias_map = {}
    for alias in aliases:
        role = alias.role if alias.role else None
        if not role:
            continue
        alias_map[alias.external_id] = role
        normalized = normalize_role_id(alias.external_id)
        if normalized and normalized not in normalized_alias_map:
            normalized_alias_map[normalized] = role
    return roles, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map


def find_role(external_id: str, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map) -> Tuple[Optional[Role], Optional[str]]:
    role = roles_by_key.get(external_id) or alias_map.get(external_id)
    if role:
        return role, "exact"
    normalized = normalize_role_id(external_id)
    role = roles_by_normalized_key.get(normalized) or normalized_alias_map.get(normalized)
    return (role, "normalized_id") if role else (None, None)


@router.post("/pocket-grimoire/compare")
def compare_pocket_grimoire(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    english_by_id, zh_by_id, converter = load_source()
    roles, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map = role_indexes(db)

    rows = []
    roles_with_ability = sum(1 for role in roles if str(role.ability_zh_tw or "").strip())
    summary = {
        "source_total": len(zh_by_id), "matched": 0, "matched_by_normalized_id": 0,
        "missing_in_database": 0, "database_only": 0, "same": 0, "different": 0,
        "missing_fields": 0, "database_roles_total": len(roles),
        "database_roles_with_ability": roles_with_ability,
        "database_roles_without_ability": len(roles) - roles_with_ability,
    }
    matched_role_ids = set()
    comparable_fields = [
        "name_en", "team", "ability_zh_tw", "first_night_order",
        "other_night_order", "first_night_reminder", "other_night_reminder",
    ]

    for external_id, zh_item in zh_by_id.items():
        incoming = build_incoming(external_id, english_by_id.get(external_id, {}), zh_item, converter)
        role, match_method = find_role(external_id, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map)
        if not role:
            summary["missing_in_database"] += 1
            rows.append({
                "external_id": external_id, "normalized_external_id": normalize_role_id(external_id),
                "match_method": None, "status": "missing_role", "current": None, "incoming": incoming,
                "diff_fields": comparable_fields, "missing_fields": comparable_fields,
            })
            continue
        if match_method == "normalized_id":
            summary["matched_by_normalized_id"] += 1
        matched_role_ids.add(role.id)
        summary["matched"] += 1
        current = {
            "id": role.id, "canonical_key": role.canonical_key, "name_zh_tw": role.name_zh_tw or "",
            "name_en": role.name_en or "", "team": role.team or "", "ability_zh_tw": role.ability_zh_tw or "",
            "first_night_order": role.first_night_order or 0, "other_night_order": role.other_night_order or 0,
            "first_night_reminder": role.first_night_reminder or "", "other_night_reminder": role.other_night_reminder or "",
            "image_url": role.image_url or "",
        }
        diff_fields = [field for field in comparable_fields if current.get(field) != incoming.get(field)]
        missing_fields = [field for field in comparable_fields if not current.get(field) and incoming.get(field)]
        if missing_fields:
            summary["missing_fields"] += 1
        status = "different" if diff_fields else "same"
        summary[status] += 1
        rows.append({
            "external_id": external_id, "normalized_external_id": normalize_role_id(external_id),
            "role_id": role.id, "match_method": match_method, "status": status,
            "current": current, "incoming": incoming, "diff_fields": diff_fields, "missing_fields": missing_fields,
        })

    database_only = [
        {"role_id": role.id, "canonical_key": role.canonical_key, "name_zh_tw": role.name_zh_tw}
        for role in roles if role.id not in matched_role_ids
    ]
    summary["database_only"] = len(database_only)
    rows.sort(key=lambda row: ({"different": 0, "missing_role": 1, "same": 2}.get(row["status"], 9), row.get("current", {}).get("name_zh_tw") if row.get("current") else row["external_id"]))
    return {
        "status": "success", "source": "Skateside/pocket-grimoire zh_CN + characters.json",
        "conversion": "OpenCC s2twp + BOTC terminology normalization",
        "image_policy": "local_database_only", "name_policy": "local_database_authoritative",
        "summary": summary, "rows": rows, "database_only": database_only,
    }


@router.post("/pocket-grimoire/fill-empty")
def fill_empty_from_pocket_grimoire(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    try:
        english_by_id, zh_by_id, converter = load_source()
        roles, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map = role_indexes(db)
        fillable_fields = [
            "name_en", "ability_zh_tw", "first_night_order", "other_night_order",
            "first_night_reminder", "other_night_reminder",
        ]
        counts = {field: 0 for field in fillable_fields}
        matched = skipped_existing = missing_roles = changed_roles = 0
        failed_role = None

        for external_id, zh_item in zh_by_id.items():
            failed_role = external_id
            role, _ = find_role(external_id, roles_by_key, roles_by_normalized_key, alias_map, normalized_alias_map)
            if not role:
                missing_roles += 1
                continue
            matched += 1
            incoming = build_incoming(external_id, english_by_id.get(external_id, {}), zh_item, converter)
            role_changed = False
            for field in fillable_fields:
                current = getattr(role, field, None)
                source_value = incoming.get(field)
                current_empty = current is None or current == "" or (field.endswith("_order") and current == 0)
                source_has_value = source_value is not None and source_value != "" and not (field.endswith("_order") and source_value == 0)
                if current_empty and source_has_value:
                    setattr(role, field, source_value)
                    counts[field] += 1
                    role_changed = True
                elif not current_empty and source_has_value:
                    skipped_existing += 1
            if role_changed:
                role.needs_review = True
                changed_roles += 1

        # Alias creation is deliberately excluded from this write transaction.
        # Filling role fields must remain reliable even when legacy alias data contains conflicts.
        db.commit()
        return {
            "status": "success", "policy": "fill_empty_only", "matched": matched,
            "changed_roles": changed_roles, "missing_roles": missing_roles,
            "skipped_existing_values": skipped_existing, "aliases_created": 0,
            "filled": counts, "untouched": ["name_zh_tw", "image_url", "team"],
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        print(f"Pocket Grimoire 補齊失敗，角色={failed_role}: {exc}")
        raise HTTPException(status_code=500, detail=f"補齊失敗於角色 {failed_role or '未知'}：{type(exc).__name__}: {exc}")

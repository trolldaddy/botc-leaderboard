import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import models
from account_binding_routes import require_admin_account
from database import get_db
from script_models import ScriptEntry, ScriptRole, ScriptSupplement
from script_import_service import create_script, museum_metadata
from scripts.import_bilibili_script import (
    TO_TRADITIONAL,
    find_catalog_role,
    find_role,
    normalized_entry_type,
    normalized_role_id,
    normalized_role_name,
    role_references_from_payload,
)

router = APIRouter(prefix="/scripts", tags=["script-admin"])
SCRIPT_CATEGORIES = {"\u5b98\u65b9\u5287\u672c", "\u5b98\u6df7\u5287\u672c", "\u90e8\u5206\u539f\u5275", "\u5b8c\u5168\u539f\u5275"}


def load_options():
    return [
        joinedload(ScriptEntry.images),
        joinedload(ScriptEntry.roles).joinedload(ScriptRole.role),
        joinedload(ScriptEntry.supplements),
    ]


def parse_tags(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return [item.strip() for item in str(value).replace("，", ",").split(",") if item.strip()]


def serialize_script(script, detail=False):
    data = {
        "id": script.id, "slug": script.slug, "name_zh_tw": script.name_zh_tw,
        "version": script.version, "category": script.category, "author_name": script.author_name,
        "tagline": script.tagline, "tags": parse_tags(script.tags), "source_url": script.source_url,
        "source_platform": script.source_platform, "source_external_id": script.source_external_id,
        "is_public": bool(script.is_public), "needs_review": bool(script.needs_review),
        "is_laplace_owned": bool(script.is_laplace_owned),
        "role_count": len(script.roles), "custom_role_count": len(script.supplements),
    }
    if detail:
        for field in (
            "introduction", "background_introduction", "gameplay_overview", "author_note",
            "production_updates", "player_guide", "storyteller_guide",
        ):
            data[field] = getattr(script, field) or ""
        data["images"] = [{
            "id": item.id, "url": item.image_url, "alt": item.alt_text or "",
            "sort_order": item.sort_order,
        } for item in sorted(script.images, key=lambda value: (value.sort_order, value.id))]
        data["roles"] = [{
            "id": item.id, "role_id": item.role_id, "sort_order": item.sort_order,
            "name_zh_tw": item.role.name_zh_tw if item.role else "",
            "team": item.role.team if item.role else "",
            "image_url": item.role.image_url if item.role else None,
        } for item in sorted(script.roles, key=lambda value: (value.sort_order, value.id))]
        data["custom_roles"] = [{
            "id": item.id, "external_id": item.external_id, "name_zh_tw": item.name_zh_tw,
            "team": item.entry_type, "image_url": item.image_url or "",
            "ability": item.ability or "", "sort_order": item.sort_order,
        } for item in sorted(script.supplements, key=lambda value: (value.sort_order, value.id))]
    return data


def match_role_payload(db, payload):
    references = role_references_from_payload(payload)
    official, supplements, missing, duplicates = [], [], [], []
    seen_official, seen_supplements = set(), set()
    for reference in references:
        role = find_role(db, reference)
        if role:
            identity = normalized_role_id(role.canonical_key) or f"db:{role.id}"
            if identity in seen_official:
                duplicates.append(reference)
                continue
            seen_official.add(identity)
            official.append(role)
            continue
        catalog_role = find_catalog_role(reference)
        if catalog_role:
            missing.append({**reference, "reason": "official_role_missing_from_database"})
            continue
        if reference.get("team"):
            identity = normalized_role_id(reference.get("id")) or normalized_role_name(reference.get("name"))
            if identity and identity in seen_supplements:
                duplicates.append(reference)
                continue
            if identity:
                seen_supplements.add(identity)
            supplements.append(reference)
        else:
            missing.append({**reference, "reason": "unmatched_entry"})
    return official, supplements, missing, duplicates


def role_json_report(official, supplements, missing, duplicates):
    return {
        "entries_found": len(official) + len(supplements) + len(missing) + len(duplicates),
        "roles_matched": len(official),
        "special_entries_preserved": len(supplements),
        "roles_missing": missing,
        "duplicate_entries_ignored": duplicates,
        "official_roles": [{"id": item.id, "name": item.name_zh_tw, "team": item.team} for item in official],
        "special_entries": supplements,
        "can_apply": not missing and len(official) + len(supplements) >= 5,
    }

def script_import_result(db, data):
    if data.get("category") not in SCRIPT_CATEGORIES:
        raise HTTPException(status_code=400, detail="\u8acb\u9078\u64c7\u6709\u6548\u7684\u5287\u672c\u5206\u985e")
    if len(data.get("images") or []) > 2:
        raise HTTPException(status_code=400, detail="正面與背面最多上傳兩張圖片")
    try:
        payload = json.loads(str(data.get("role_json") or ""))
        matched = match_role_payload(db, payload)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"無法讀取劇本 JSON：{exc}") from exc
    metadata = museum_metadata(str(data.get("source_url") or "").strip()) if data.get("source_url") else {}
    report = role_json_report(*matched)
    report["metadata"] = metadata
    report["uploaded_images"] = len(data.get("images") or [])
    report["remote_images"] = len(metadata.get("remote_images") or [])
    return report, matched, metadata


@router.post("/imports/preview")
def preview_script_import(data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    report, _, _ = script_import_result(db, data)
    return report


@router.post("/imports/apply")
def apply_script_import(data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    report, (official, supplements, missing, duplicates), metadata = script_import_result(db, data)
    if not report["can_apply"]:
        raise HTTPException(status_code=409, detail="JSON 仍有無法辨識的條目，已拒絕建立劇本")
    external_id = metadata.get("source_external_id")
    if external_id and db.query(ScriptEntry.id).filter(ScriptEntry.source_platform == "bilibili", ScriptEntry.source_external_id == external_id).first():
        raise HTTPException(status_code=409, detail="這篇鐘樓博物館文章已經匯入")
    script = create_script(db, data, official, supplements, metadata)
    return {"status": "success", "script": serialize_script(script, detail=True), **report}

@router.get("")
def list_scripts(
    q: str = Query(default="", max_length=120),
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    query = db.query(ScriptEntry).options(*load_options())
    keyword = q.strip()
    if keyword:
        query = query.filter(or_(
            ScriptEntry.name_zh_tw.ilike(f"%{keyword}%"),
            ScriptEntry.author_name.ilike(f"%{keyword}%"),
            ScriptEntry.slug.ilike(f"%{keyword}%"),
        ))
    items = query.order_by(ScriptEntry.updated_at.desc(), ScriptEntry.name_zh_tw).all()
    return {"items": [serialize_script(item) for item in items], "total": len(items)}


@router.get("/{script_id}")
def get_script(
    script_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    return serialize_script(script, detail=True)


@router.patch("/{script_id}")
def update_script(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    if "category" in data and data.get("category") not in SCRIPT_CATEGORIES:
        raise HTTPException(status_code=400, detail="\u8acb\u9078\u64c7\u6709\u6548\u7684\u5287\u672c\u5206\u985e")
    editable = (
        "name_zh_tw", "version", "category", "introduction", "author_name", "tagline",
        "background_introduction", "gameplay_overview", "author_note", "production_updates",
        "player_guide", "storyteller_guide", "source_url", "is_public", "needs_review", "is_laplace_owned",
    )
    for field in editable:
        if field in data:
            setattr(script, field, data[field])
    if "tags" in data:
        script.tags = json.dumps(data.get("tags") or [], ensure_ascii=False)
    if "custom_roles" in data:
        by_id = {item.id: item for item in script.supplements}
        retained_ids = set()
        for index, incoming in enumerate(data.get("custom_roles") or []):
            try:
                incoming_id = int(incoming.get("id")) if incoming.get("id") else None
            except (TypeError, ValueError):
                incoming_id = None
            item = by_id.get(incoming_id)
            if not item:
                item = ScriptSupplement(script_id=script.id, external_id=f"manual-{uuid.uuid4().hex}", name_zh_tw="???", entry_type="special", sort_order=index)
                db.add(item)
                db.flush()
            retained_ids.add(item.id)
            incoming["sort_order"] = index
            incoming["team"] = normalized_entry_type(incoming.get("team"))
            for field, target in (("name_zh_tw", "name_zh_tw"), ("team", "entry_type"), ("image_url", "image_url"), ("ability", "ability"), ("sort_order", "sort_order")):
                if field in incoming:
                    setattr(item, target, incoming[field])
        for existing_id, item in by_id.items():
            if existing_id not in retained_ids:
                db.delete(item)
    db.commit()
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    return {"status": "success", "script": serialize_script(script, detail=True)}
@router.post("/{script_id}/role-json/preview")
def preview_role_json(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    if not db.query(ScriptEntry.id).filter(ScriptEntry.id == script_id).first():
        raise HTTPException(status_code=404, detail="找不到劇本")
    try:
        payload = json.loads(str(data.get("content") or ""))
        result = match_role_payload(db, payload)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"無法讀取劇本 JSON：{exc}") from exc
    return {"filename": data.get("filename") or "", **role_json_report(*result)}


@router.post("/{script_id}/role-json/apply")
def apply_role_json(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    try:
        payload = json.loads(str(data.get("content") or ""))
        official, supplements, missing, duplicates = match_role_payload(db, payload)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"無法讀取劇本 JSON：{exc}") from exc
    report = role_json_report(official, supplements, missing, duplicates)
    if not report["can_apply"]:
        raise HTTPException(status_code=409, detail="JSON 仍有無法辨識的條目，已拒絕覆蓋角色構成")
    # Replace through the loaded relationships so the ORM identity map cannot
    # retain stale supplements (for example, a formerly custom Clockmaker).
    script.roles.clear()
    script.supplements.clear()
    db.flush()
    for index, role in enumerate(official):
        script.roles.append(ScriptRole(role_id=role.id, sort_order=index))
    for index, item in enumerate(supplements):
        script.supplements.append(ScriptSupplement(
            external_id=item["id"],
            name_zh_tw=TO_TRADITIONAL.convert(item.get("name") or item["id"]),
            entry_type=normalized_entry_type(item.get("team")),
            image_url=item.get("image") or None,
            ability=TO_TRADITIONAL.convert(item.get("ability") or "") or None,
            sort_order=index,
        ))
    script.needs_review = True
    db.commit()
    db.expire_all()
    refreshed = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    return {"status": "success", **report, "script": serialize_script(refreshed, detail=True)}

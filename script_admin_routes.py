import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import models
from account_binding_routes import require_admin_account
from database import get_db
from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement
from script_import_service import (
    create_script, existing_artwork_candidates, museum_metadata, remote_artwork_candidates,
    local_artwork_payload, persist_artwork, persist_artwork_bytes,
    save_artwork_slot, save_candidate_artwork,
    uploaded_artwork_candidates
)
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
            "kind": {0: "front", 1: "back", 100: "logo"}.get(item.sort_order),
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
    if len(data.get("images") or []) > 3:
        raise HTTPException(status_code=400, detail="正面、背面與 Logo 最多上傳三張圖片")
    try:
        payload = json.loads(str(data.get("role_json") or ""))
        matched = match_role_payload(db, payload)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"無法讀取劇本 JSON：{exc}") from exc
    metadata = museum_metadata(str(data.get("source_url") or "").strip()) if data.get("source_url") else {}
    report = role_json_report(*matched)
    report["metadata"] = metadata
    report["uploaded_images"] = len(data.get("images") or [])
    candidates = remote_artwork_candidates(metadata.get("remote_images") or [])
    report["remote_images"] = len(candidates)
    report["artwork_candidates"] = candidates
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
    if "artwork_selection" in data or "artwork_candidates" in data:
        apply_candidate_artwork(
            script,
            data.get("artwork_selection") or {},
            data.get("artwork_candidates") or [],
        )
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
                item = ScriptSupplement(script_id=script.id, external_id=f"manual-{uuid.uuid4().hex}", name_zh_tw="\u65b0\u689d\u76ee", entry_type="special", sort_order=index)
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


def apply_candidate_artwork(script, selection, candidates):
    by_slot = {item.sort_order: item for item in script.images if item.sort_order in (0, 1, 100)}
    by_id = {item.id: item for item in script.images}
    candidate_ids = [str(value) for value in (selection or {}).values() if value]
    if len(candidate_ids) != len(set(candidate_ids)):
        raise HTTPException(status_code=400, detail="同一張圖片不能同時指定成多個用途")
    fresh_selection = {}
    for kind, candidate_id in (selection or {}).items():
        if kind not in {"front", "back", "logo"} or not candidate_id:
            continue
        candidate_id = str(candidate_id)
        if not candidate_id.startswith("existing-"):
            fresh_selection[kind] = candidate_id
            continue
        try:
            source = by_id[int(candidate_id.removeprefix("existing-"))]
        except (KeyError, ValueError):
            raise HTTPException(status_code=400, detail=f"{kind} 圖片不在備選庫中")
        slot = {"front": 0, "back": 1, "logo": 100}[kind]
        image_data, content_type = source.image_data, source.content_type or "application/octet-stream"
        if image_data:
            import base64
            raw_data = base64.b64decode(image_data, validate=True)
        elif source.image_url.startswith("http"):
            import requests
            response = requests.get(source.image_url, timeout=30)
            response.raise_for_status()
            raw_data = response.content
            content_type = response.headers.get("Content-Type", content_type).split(";", 1)[0]
        else:
            encoded, content_type = local_artwork_payload(source.image_url)
            import base64
            raw_data = base64.b64decode(encoded, validate=True)
        image_url, image_data, content_type = persist_artwork_bytes(script, slot, raw_data, content_type)
        target = by_slot.get(slot)
        suffix = {"front": "正面", "back": "背面", "logo": " Logo"}[kind]
        if target:
            target.image_url = image_url
            target.image_data = image_data
            target.content_type = content_type
            target.alt_text = f"{script.name_zh_tw}{suffix}"
        else:
            target = ScriptImage(
                image_url=image_url, image_data=image_data,
                content_type=content_type, alt_text=f"{script.name_zh_tw}{suffix}", sort_order=slot,
            )
            script.images.append(target)
            by_slot[slot] = target
    saved = save_candidate_artwork(script, fresh_selection, candidates) if fresh_selection else []
    for slot, url, kind in saved:
        image_url, image_data, content_type = persist_artwork(script, slot, url)
        item = by_slot.get(slot)
        suffix = {"front": "正面", "back": "背面", "logo": " Logo"}[kind]
        if item:
            item.image_url = image_url
            item.image_data = image_data
            item.content_type = content_type
            item.alt_text = f"{script.name_zh_tw}{suffix}"
        else:
            item = ScriptImage(
                image_url=image_url, image_data=image_data,
                content_type=content_type, alt_text=f"{script.name_zh_tw}{suffix}", sort_order=slot,
            )
            script.images.append(item)
            by_slot[slot] = item
    return saved


@router.delete("/{script_id}")
def delete_script(
    script_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    deleted_name = script.name_zh_tw
    db.delete(script)
    db.commit()
    return {
        "status": "success",
        "deleted_id": script_id,
        "deleted_name": deleted_name,
    }


@router.post("/{script_id}/images")
def update_script_images(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    uploads = data.get("images") or []
    if not uploads or len(uploads) > 3:
        raise HTTPException(status_code=400, detail="請選擇一至三張正面、背面或 Logo 圖片")
    by_slot = {item.sort_order: item for item in script.images if item.sort_order in (0, 1, 100)}
    seen = set()
    for incoming in uploads:
        try:
            slot = int(incoming.get("slot"))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="劇本圖片位置不正確")
        if slot not in (0, 1, 100) or slot in seen:
            raise HTTPException(status_code=400, detail="劇本圖片位置不正確或重複")
        seen.add(slot)
        url = save_artwork_slot(script, incoming, slot)
        image_url, image_data, content_type = persist_artwork(script, slot, url)
        image = by_slot.get(slot)
        if image:
            image.image_url = image_url
            image.image_data = image_data
            image.content_type = content_type
            image.alt_text = f"{script.name_zh_tw}{ {0: '正面', 1: '背面', 100: ' Logo'}[slot] }"
        else:
            script.images.append(ScriptImage(
                image_url=image_url,
                image_data=image_data,
                content_type=content_type,
                alt_text=f"{script.name_zh_tw}{ {0: '正面', 1: '背面', 100: ' Logo'}[slot] }",
                sort_order=slot,
            ))
    db.commit()
    db.expire_all()
    refreshed = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    return {"status": "success", "script": serialize_script(refreshed, detail=True)}


@router.post("/{script_id}/artwork-candidates")
def list_artwork_candidates(
    script_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    metadata = museum_metadata(script.source_url) if script.source_url else {}
    existing = existing_artwork_candidates(script.images)
    imported = remote_artwork_candidates(metadata.get("remote_images") or [])
    return {"items": existing + imported}


@router.post("/{script_id}/artwork-candidates/uploads")
def upload_artwork_candidates(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    if not db.query(ScriptEntry.id).filter(ScriptEntry.id == script_id).first():
        raise HTTPException(status_code=404, detail="\u627e\u4e0d\u5230\u5287\u672c")
    images = data.get("images") or []
    if not isinstance(images, list) or not images or len(images) > 24:
        raise HTTPException(status_code=400, detail="\u8acb\u4e0a\u50b3 1 \u81f3 24 \u5f35\u5716\u7247")
    return {"items": uploaded_artwork_candidates(images)}


@router.post("/{script_id}/artwork-selection")
def apply_artwork_selection(
    script_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    apply_candidate_artwork(
        script, data.get("artwork_selection") or {}, data.get("artwork_candidates") or []
    )
    db.commit()
    db.expire_all()
    refreshed = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    return {"status": "success", "script": serialize_script(refreshed, detail=True)}

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

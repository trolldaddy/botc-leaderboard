import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import models
from account_binding_routes import require_admin_account
from database import get_db
from script_models import ScriptEntry, ScriptRole

router = APIRouter(prefix="/scripts", tags=["script-admin"])


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
    editable = (
        "name_zh_tw", "version", "category", "introduction", "author_name", "tagline",
        "background_introduction", "gameplay_overview", "author_note", "production_updates",
        "player_guide", "storyteller_guide", "source_url", "is_public", "needs_review",
    )
    for field in editable:
        if field in data:
            setattr(script, field, data[field])
    if "tags" in data:
        script.tags = json.dumps(data.get("tags") or [], ensure_ascii=False)
    by_id = {item.id: item for item in script.supplements}
    for incoming in data.get("custom_roles") or []:
        item = by_id.get(incoming.get("id"))
        if not item:
            continue
        for field, target in (("name_zh_tw", "name_zh_tw"), ("team", "entry_type"),
                              ("image_url", "image_url"), ("ability", "ability"),
                              ("sort_order", "sort_order")):
            if field in incoming:
                setattr(item, target, incoming[field])
    db.commit()
    script = db.query(ScriptEntry).options(*load_options()).filter(ScriptEntry.id == script_id).first()
    return {"status": "success", "script": serialize_script(script, detail=True)}

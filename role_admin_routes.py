from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

import models
from account_binding_routes import require_admin_account
from database import get_db
from role_models import Role, RoleAlias, RoleGuide

router = APIRouter(prefix="/roles", tags=["role-admin"])


def serialize_alias(alias: RoleAlias):
    return {
        "id": alias.id,
        "source": alias.source,
        "external_id": alias.external_id,
        "external_name": alias.external_name,
    }


def serialize_guide(guide: Optional[RoleGuide]):
    return {
        "beginner_summary": guide.beginner_summary if guide else "",
        "how_to_play": guide.how_to_play if guide else "",
        "first_day_advice": guide.first_day_advice if guide else "",
        "common_mistakes": guide.common_mistakes if guide else "",
        "advanced_tips": guide.advanced_tips if guide else "",
    }


def completeness(role: Role):
    missing = []
    if not role.name_zh_tw:
        missing.append("name")
    if not role.ability_zh_tw:
        missing.append("ability")
    if not role.image_url:
        missing.append("image")
    if not role.name_en:
        missing.append("english_name")
    return {"missing": missing, "score": max(0, 100 - len(missing) * 25)}


def serialize_role(role: Role, include_detail: bool = True):
    result = {
        "id": role.id,
        "canonical_key": role.canonical_key,
        "name_zh_tw": role.name_zh_tw,
        "name_en": role.name_en,
        "team": role.team,
        "image_url": role.image_url,
        "source_type": role.source_type,
        "source_name": role.source_name,
        "author": role.author,
        "is_official": bool(role.is_official),
        "is_custom": bool(role.is_custom),
        "is_active": bool(role.is_active),
        "needs_review": bool(role.needs_review),
        "completeness": completeness(role),
    }
    if include_detail:
        result.update({
            "ability_zh_tw": role.ability_zh_tw,
            "first_night_order": role.first_night_order,
            "other_night_order": role.other_night_order,
            "first_night_reminder": role.first_night_reminder,
            "other_night_reminder": role.other_night_reminder,
            "aliases": [serialize_alias(alias) for alias in role.aliases],
            "guide": serialize_guide(role.guide),
        })
    return result


@router.get("")
def list_roles(
    q: str = "",
    team: str = "",
    source_type: str = "",
    needs_review: Optional[bool] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    query = db.query(Role)
    keyword = (q or "").strip()
    if keyword:
        query = query.filter(or_(
            Role.name_zh_tw.ilike(f"%{keyword}%"),
            Role.name_en.ilike(f"%{keyword}%"),
            Role.canonical_key.ilike(f"%{keyword}%"),
        ))
    if team:
        query = query.filter(Role.team == team)
    if source_type:
        query = query.filter(Role.source_type == source_type)
    if needs_review is not None:
        query = query.filter(Role.needs_review == needs_review)
    roles = query.order_by(Role.team.asc(), Role.name_zh_tw.asc()).limit(max(1, min(limit, 2000))).all()
    return [serialize_role(role, include_detail=False) for role in roles]


@router.get("/{role_id}")
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    role = db.query(Role).options(joinedload(Role.aliases), joinedload(Role.guide)).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    return serialize_role(role)


@router.post("/import")
def import_master_roles(
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    items = data.get("roles") or []
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="roles 必須是陣列")

    created = 0
    updated = 0
    aliases_created = 0
    skipped = 0

    for item in items:
        external_id = str(item.get("id") or "").strip()
        name = str(item.get("name") or "").strip()
        team = str(item.get("team") or "").strip()
        if not external_id or not name or not team:
            skipped += 1
            continue

        role = db.query(Role).filter(Role.canonical_key == external_id).first()
        if not role:
            role = Role(
                canonical_key=external_id,
                name_zh_tw=name,
                team=team,
                source_type="unclassified",
                is_official=False,
                is_custom=False,
                needs_review=True,
            )
            db.add(role)
            db.flush()
            created += 1
        else:
            updated += 1

        role.name_zh_tw = name
        role.team = team
        role.first_night_order = int(item.get("firstNight") or 0)
        role.other_night_order = int(item.get("otherNight") or 0)
        role.first_night_reminder = item.get("firstNightReminder") or None
        role.other_night_reminder = item.get("otherNightReminder") or None
        role.image_url = item.get("image") or None
        if item.get("ability"):
            role.ability_zh_tw = item.get("ability")

        alias = db.query(RoleAlias).filter(
            RoleAlias.source == "master_role_db",
            RoleAlias.external_id == external_id,
        ).first()
        if not alias:
            db.add(RoleAlias(
                role_id=role.id,
                source="master_role_db",
                external_id=external_id,
                external_name=name,
            ))
            aliases_created += 1
        else:
            alias.role_id = role.id
            alias.external_name = name

    db.commit()
    total = db.query(Role).count()
    return {
        "status": "success",
        "created": created,
        "updated": updated,
        "aliases_created": aliases_created,
        "skipped": skipped,
        "total": total,
    }


@router.patch("/{role_id}")
def update_role(
    role_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    role = db.query(Role).options(joinedload(Role.aliases), joinedload(Role.guide)).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")

    editable = [
        "name_zh_tw", "name_en", "team", "ability_zh_tw", "first_night_order",
        "other_night_order", "first_night_reminder", "other_night_reminder",
        "image_url", "source_type", "source_name", "author", "is_official",
        "is_custom", "is_active", "needs_review",
    ]
    for field in editable:
        if field in data:
            setattr(role, field, data.get(field))

    guide_data = data.get("guide")
    if isinstance(guide_data, dict):
        guide = role.guide or RoleGuide(role_id=role.id)
        if not role.guide:
            db.add(guide)
        for field in ["beginner_summary", "how_to_play", "first_day_advice", "common_mistakes", "advanced_tips"]:
            if field in guide_data:
                setattr(guide, field, guide_data.get(field))

    db.commit()
    role = db.query(Role).options(joinedload(Role.aliases), joinedload(Role.guide)).filter(Role.id == role.id).first()
    return {"status": "success", "role": serialize_role(role)}


@router.post("/{role_id}/aliases")
def add_alias(
    role_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    source = str(data.get("source") or "manual").strip()
    external_id = str(data.get("external_id") or "").strip()
    if not external_id:
        raise HTTPException(status_code=400, detail="外部 ID 不可空白")
    duplicate = db.query(RoleAlias).filter(RoleAlias.source == source, RoleAlias.external_id == external_id).first()
    if duplicate:
        if duplicate.role_id != role.id:
            raise HTTPException(status_code=409, detail="此來源 ID 已指向其他角色")
        return {"status": "success", "alias": serialize_alias(duplicate)}
    alias = RoleAlias(
        role_id=role.id,
        source=source,
        external_id=external_id,
        external_name=(data.get("external_name") or None),
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return {"status": "success", "alias": serialize_alias(alias)}


@router.delete("/{role_id}/aliases/{alias_id}")
def delete_alias(
    role_id: int,
    alias_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    alias = db.query(RoleAlias).filter(RoleAlias.id == alias_id, RoleAlias.role_id == role_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="找不到別名")
    db.delete(alias)
    db.commit()
    return {"status": "success"}

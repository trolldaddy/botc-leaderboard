from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from role_models import Role, RoleAlias, RoleContentBlock, RoleGuide, RoleReminder

router = APIRouter(prefix="/api/roles", tags=["roles-public"])
VALID_VIEWS = {"player", "encyclopedia", "storyteller"}
VIEW_AUDIENCES = {
    "player": {"all", "player"},
    "encyclopedia": {"all", "player", "encyclopedia"},
    "storyteller": {"all", "player", "encyclopedia", "storyteller"},
}


def role_card(role: Role):
    return {
        "id": role.id,
        "canonical_key": role.canonical_key,
        "name_zh_tw": role.name_zh_tw,
        "name_en": role.name_en,
        "team": role.team,
        "ability_zh_tw": role.ability_zh_tw,
        "image_url": role.image_url,
        "is_official": bool(role.is_official),
        "is_custom": bool(role.is_custom),
    }


def serialize_block(block: RoleContentBlock):
    return {
        "id": block.id,
        "block_type": block.block_type,
        "title": block.title,
        "content_format": block.content_format,
        "content": block.content,
        "audience": block.audience,
        "source": block.source,
        "source_url": block.source_url,
        "sort_order": block.sort_order,
        "review_status": block.review_status,
    }


def serialize_reminder(reminder: RoleReminder):
    return {
        "id": reminder.id,
        "label_zh_tw": reminder.label_zh_tw,
        "scope": reminder.scope,
        "sort_order": reminder.sort_order,
        "placement_timing": reminder.placement_timing,
        "placement_condition": reminder.placement_condition,
        "removal_timing": reminder.removal_timing,
        "special_notes": reminder.special_notes,
        "source": reminder.source,
        "source_url": reminder.source_url,
        "needs_review": bool(reminder.needs_review),
    }


def find_role(db: Session, key: str):
    role = db.query(Role).filter(func.lower(Role.canonical_key) == key.lower()).first()
    if role:
        return role
    role = db.query(Role).filter(or_(
        func.lower(Role.name_zh_tw) == key.lower(),
        func.lower(Role.name_en) == key.lower(),
    )).first()
    if role:
        return role
    alias = db.query(RoleAlias).filter(or_(
        func.lower(RoleAlias.external_id) == key.lower(),
        func.lower(RoleAlias.external_name) == key.lower(),
    )).first()
    return db.query(Role).filter(Role.id == alias.role_id).first() if alias else None


@router.get("")
def search_roles(q: str = Query(default="", max_length=120), team: str = "", limit: int = Query(default=60, ge=1, le=500), db: Session = Depends(get_db)):
    query = db.query(Role).filter(Role.is_active == True)  # noqa: E712
    keyword = q.strip()
    if keyword:
        alias_ids = db.query(RoleAlias.role_id).filter(or_(
            RoleAlias.external_name.ilike(f"%{keyword}%"),
            RoleAlias.external_id.ilike(f"%{keyword}%"),
        ))
        query = query.filter(or_(
            Role.name_zh_tw.ilike(f"%{keyword}%"),
            Role.name_en.ilike(f"%{keyword}%"),
            Role.canonical_key.ilike(f"%{keyword}%"),
            Role.id.in_(alias_ids),
        ))
    if team:
        query = query.filter(Role.team == team)
    total = query.count()
    roles = query.order_by(Role.team, Role.name_zh_tw).limit(limit).all()
    return {"query": keyword, "total": total, "items": [role_card(role) for role in roles]}


@router.get("/{key}")
def get_role_view(key: str, view: str = Query(default="player"), db: Session = Depends(get_db)):
    if view not in VALID_VIEWS:
        raise HTTPException(status_code=400, detail="view 必須是 player、encyclopedia 或 storyteller")
    role = find_role(db, key)
    if not role or not role.is_active:
        raise HTTPException(status_code=404, detail="找不到角色")

    payload = role_card(role)
    payload["view"] = view
    payload["aliases"] = [{
        "source": alias.source,
        "external_id": alias.external_id,
        "external_name": alias.external_name,
    } for alias in db.query(RoleAlias).filter(RoleAlias.role_id == role.id).all()]

    blocks = db.query(RoleContentBlock).filter(
        RoleContentBlock.role_id == role.id,
        RoleContentBlock.is_active == True,  # noqa: E712
        RoleContentBlock.audience.in_(VIEW_AUDIENCES[view]),
    ).order_by(RoleContentBlock.sort_order, RoleContentBlock.id).all()
    payload["content_blocks"] = [serialize_block(block) for block in blocks]

    guide = db.query(RoleGuide).filter(RoleGuide.role_id == role.id).first()
    if guide:
        if view == "player":
            payload["guide"] = {
                "beginner_summary": guide.beginner_summary,
                "how_to_play": guide.how_to_play,
                "first_day_advice": guide.first_day_advice,
            }
        else:
            payload["guide"] = {
                "beginner_summary": guide.beginner_summary,
                "how_to_play": guide.how_to_play,
                "first_day_advice": guide.first_day_advice,
                "common_mistakes": guide.common_mistakes,
                "advanced_tips": guide.advanced_tips,
            }
    else:
        payload["guide"] = None

    if view == "storyteller":
        payload.update({
            "first_night_order": role.first_night_order,
            "other_night_order": role.other_night_order,
            "first_night_reminder": role.first_night_reminder,
            "other_night_reminder": role.other_night_reminder,
            "reminders": [serialize_reminder(item) for item in db.query(RoleReminder).filter(
                RoleReminder.role_id == role.id
            ).order_by(RoleReminder.sort_order, RoleReminder.id).all()],
        })
    return payload

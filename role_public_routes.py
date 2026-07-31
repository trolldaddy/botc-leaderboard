import json
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from knowledge_models import KnowledgeNode, KnowledgeSourceRecord
from role_display_settings import base_block_type, ensure_display_settings, setting_order, setting_visible
from role_models import Role, RoleAlias, RoleContentBlock, RoleDisplayOverride, RoleGuide, RoleKnowledgeLink, RoleReminder

router = APIRouter(prefix="/api/roles", tags=["roles-public"])
VALID_VIEWS = {"player", "encyclopedia", "storyteller"}
VIEW_AUDIENCES = {
    "player": {"all", "player"},
    "encyclopedia": {"all", "player", "encyclopedia"},
    "storyteller": {"all", "player", "encyclopedia", "storyteller"},
}


def role_card(role: Role, mention_aliases=None, knowledge_slug=None):
    def string_list(value):
        if not value:
            return []
        try:
            items = json.loads(value)
        except (TypeError, ValueError):
            items = str(value).split(",")
        return [str(item).strip() for item in items if str(item).strip()]

    return {
        "id": role.id,
        "canonical_key": role.canonical_key,
        "name_zh_tw": role.name_zh_tw,
        "name_en": role.name_en,
        "team": role.team,
        "ability_zh_tw": role.ability_zh_tw,
        "image_url": role.image_url,
        "script_names": string_list(role.script_names_json),
        "ability_tags": string_list(role.ability_tags_json),
        "mention_aliases": sorted({str(value).strip() for value in (mention_aliases or []) if value and str(value).strip() and str(value).strip() != role.name_zh_tw}),
        "knowledge_slug": knowledge_slug,
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


def serialize_content_groups(blocks: list[RoleContentBlock]):
    strategy_types = {"strategy_play", "strategy_bluff", "strategy_counter"}
    rules_types = {"rules_detail", "rules_interactions", "rules_jinx"}
    return {
        "strategy": [serialize_block(block) for block in blocks if re.sub(r"_\d+$", "", block.block_type or "") in strategy_types],
        "rules_detail": [serialize_block(block) for block in blocks if re.sub(r"_\d+$", "", block.block_type or "") in rules_types],
    }


def role_references(db: Session, role_id: int):
    links = db.query(RoleKnowledgeLink).filter(RoleKnowledgeLink.role_id == role_id).all()
    references = []
    for link in links:
        node = db.query(KnowledgeNode).filter(KnowledgeNode.id == link.knowledge_node_id).first()
        if not node:
            continue
        source_record = db.query(KnowledgeSourceRecord).filter(
            KnowledgeSourceRecord.node_id == node.id
        ).order_by(KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc()).first()
        if not source_record or not source_record.source_url:
            continue
        references.append({
            "type": "wiki",
            "label": "GStone 鐘樓百科",
            "url": source_record.source_url,
            "knowledge_slug": node.slug,
            "knowledge_name": node.canonical_name_zh_tw,
        })
    return references

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
    role_ids = [role.id for role in roles]
    aliases_by_role = {role_id: [] for role_id in role_ids}
    knowledge_slug_by_role = {}
    if role_ids:
        for alias in db.query(RoleAlias).filter(RoleAlias.role_id.in_(role_ids)).all():
            aliases_by_role.setdefault(alias.role_id, []).append(alias.external_name)
        for role_id, slug in db.query(RoleKnowledgeLink.role_id, KnowledgeNode.slug).join(
            KnowledgeNode, KnowledgeNode.id == RoleKnowledgeLink.knowledge_node_id
        ).filter(RoleKnowledgeLink.role_id.in_(role_ids)).order_by(RoleKnowledgeLink.id).all():
            knowledge_slug_by_role.setdefault(role_id, slug)
    return {"query": keyword, "total": total, "items": [role_card(role, aliases_by_role.get(role.id, []), knowledge_slug_by_role.get(role.id)) for role in roles]}


@router.get("/{key}")
def get_role_view(key: str, view: str = Query(default="player"), db: Session = Depends(get_db)):
    if view not in VALID_VIEWS:
        raise HTTPException(status_code=400, detail="view 必須是 player、encyclopedia 或 storyteller")
    role = find_role(db, key)
    if not role or not role.is_active:
        raise HTTPException(status_code=404, detail="找不到角色")

    settings = ensure_display_settings(db)
    settings_by_key = {item.item_key: item for item in settings}
    overrides_by_key = {item.item_key: item for item in db.query(RoleDisplayOverride).filter(RoleDisplayOverride.role_id == role.id).all()}

    def visible(setting, selected_view):
        override = overrides_by_key.get(setting.item_key)
        value = getattr(override, f"show_{selected_view}", None) if override else None
        return bool(value) if value is not None else setting_visible(setting, selected_view)

    def order(setting, selected_view):
        override = overrides_by_key.get(setting.item_key)
        value = getattr(override, f"sort_{selected_view}", None) if override else None
        return int(value) if value is not None else setting_order(setting, selected_view)
    role_aliases = db.query(RoleAlias).filter(RoleAlias.role_id == role.id).all()
    payload = role_card(role, [value for alias in role_aliases for value in (alias.external_name, alias.external_id)])
    payload["view"] = view
    payload["display_modules"] = {
        item.item_key.removeprefix("module."): visible(item, view)
        for item in settings if item.item_type == "module"
    }
    payload["display_order"] = {
        item.item_key: order(item, view) for item in settings
    }
    payload["aliases"] = [{
        "source": alias.source,
        "external_id": alias.external_id,
        "external_name": alias.external_name,
    } for alias in role_aliases]

    candidate_blocks = db.query(RoleContentBlock).filter(
        RoleContentBlock.role_id == role.id,
        RoleContentBlock.is_active == True,  # noqa: E712
    ).all()
    blocks = []
    for block in candidate_blocks:
        setting = settings_by_key.get(f"block.{base_block_type(block.block_type)}")
        if setting:
            if visible(setting, view):
                blocks.append(block)
        elif block.audience in VIEW_AUDIENCES[view]:
            blocks.append(block)
    blocks.sort(key=lambda block: (
        order(settings_by_key[f"block.{base_block_type(block.block_type)}"], view)
        if f"block.{base_block_type(block.block_type)}" in settings_by_key else block.sort_order,
        block.sort_order,
        block.id,
    ))
    payload["content_blocks"] = [serialize_block(block) for block in blocks]
    payload["content_groups"] = serialize_content_groups(blocks)
    payload["references"] = role_references(db, role.id)

    guide = db.query(RoleGuide).filter(RoleGuide.role_id == role.id).first()
    guide_fields = {
        "beginner_summary": "player_summary",
        "how_to_play": "how_to_play",
        "first_day_advice": "how_to_play",
        "common_mistakes": "common_mistakes",
        "advanced_tips": "advanced_tips",
        "ability_supplement": "ability_supplement",
        "storyteller_advice": "storyteller_advice",
    }
    if guide and payload["display_modules"].get("guide", True):
        payload["guide"] = {
            field: getattr(guide, field)
            for field, setting_key in guide_fields.items()
            if not settings_by_key.get(f"block.{setting_key}")
            or visible(settings_by_key[f"block.{setting_key}"], view)
        }
    else:
        payload["guide"] = None

    if payload["display_modules"].get("night_operation", False):
        payload.update({
            "first_night_order": role.first_night_order,
            "other_night_order": role.other_night_order,
            "first_night_reminder": role.first_night_reminder,
            "other_night_reminder": role.other_night_reminder,
        })
    if payload["display_modules"].get("reminders", False):
        payload["reminders"] = [serialize_reminder(item) for item in db.query(RoleReminder).filter(
            RoleReminder.role_id == role.id
        ).order_by(RoleReminder.sort_order, RoleReminder.id).all()]
    return payload

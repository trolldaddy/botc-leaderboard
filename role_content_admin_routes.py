from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
from knowledge_models import KnowledgeNode
from role_display_settings import ensure_display_settings
from role_models import Role, RoleContentBlock, RoleDisplayOverride, RoleKnowledgeLink

router = APIRouter(prefix="/roles", tags=["role-content-admin"])



def serialize_block(block: RoleContentBlock):
    return {
        "id": block.id,
        "role_id": block.role_id,
        "block_type": block.block_type,
        "title": block.title,
        "content_format": block.content_format,
        "content": block.content,
        "audience": block.audience,
        "source": block.source,
        "source_key": block.source_key,
        "source_url": block.source_url,
        "sort_order": block.sort_order,
        "review_status": block.review_status,
        "is_active": bool(block.is_active),
        "created_at": block.created_at.isoformat() if block.created_at else None,
        "updated_at": block.updated_at.isoformat() if block.updated_at else None,
    }


def serialize_link(link: RoleKnowledgeLink, node: KnowledgeNode | None):
    return {
        "id": link.id,
        "knowledge_node_id": link.knowledge_node_id,
        "knowledge_slug": node.slug if node else None,
        "knowledge_name": node.canonical_name_zh_tw if node else None,
        "knowledge_type": node.node_type if node else None,
        "match_method": link.match_method,
        "confidence": link.confidence,
        "review_status": link.review_status,
        "created_at": link.created_at.isoformat() if link.created_at else None,
        "updated_at": link.updated_at.isoformat() if link.updated_at else None,
    }


def require_role(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    return role


def serialize_role_display_settings(db: Session, role_id: int):
    settings = ensure_display_settings(db)
    overrides = {item.item_key: item for item in db.query(RoleDisplayOverride).filter(RoleDisplayOverride.role_id == role_id).all()}
    result = []
    for setting in settings:
        override = overrides.get(setting.item_key)
        item = {"item_key": setting.item_key, "item_type": setting.item_type, "label": setting.label, "is_overridden": bool(override)}
        for view in ("player", "encyclopedia", "storyteller"):
            show_field, sort_field = f"show_{view}", f"sort_{view}"
            show_value = getattr(override, show_field, None) if override else None
            sort_value = getattr(override, sort_field, None) if override else None
            item[show_field] = bool(show_value) if show_value is not None else bool(getattr(setting, show_field))
            item[sort_field] = int(sort_value) if sort_value is not None else int(getattr(setting, sort_field) or 0)
        result.append(item)
    return result


@router.get("/{role_id}/content")
def list_role_content(
    role_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    role = require_role(db, role_id)
    blocks = db.query(RoleContentBlock).filter(RoleContentBlock.role_id == role_id).order_by(
        RoleContentBlock.sort_order, RoleContentBlock.id
    ).all()
    links = db.query(RoleKnowledgeLink).filter(RoleKnowledgeLink.role_id == role_id).order_by(RoleKnowledgeLink.id).all()
    node_ids = [item.knowledge_node_id for item in links]
    nodes = {
        item.id: item
        for item in db.query(KnowledgeNode).filter(KnowledgeNode.id.in_(node_ids)).all()
    } if node_ids else {}
    return {
        "role": {"id": role.id, "canonical_key": role.canonical_key, "name_zh_tw": role.name_zh_tw},
        "content_blocks": [serialize_block(item) for item in blocks],
        "knowledge_links": [serialize_link(item, nodes.get(item.knowledge_node_id)) for item in links],
        "display_settings": serialize_role_display_settings(db, role_id),
    }


@router.put("/{role_id}/display-settings")
def update_role_display_settings(
    role_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    require_role(db, role_id)
    global_settings = {item.item_key: item for item in ensure_display_settings(db)}
    existing = {item.item_key: item for item in db.query(RoleDisplayOverride).filter(RoleDisplayOverride.role_id == role_id).all()}
    allowed = {"show_player", "show_encyclopedia", "show_storyteller", "sort_player", "sort_encyclopedia", "sort_storyteller"}
    for incoming in data.get("items") or []:
        item_key = str(incoming.get("item_key") or "")
        if item_key not in global_settings:
            continue
        override = existing.get(item_key)
        if override is None:
            override = RoleDisplayOverride(role_id=role_id, item_key=item_key)
            db.add(override)
            existing[item_key] = override
        for field in allowed:
            if field in incoming:
                value = bool(incoming[field]) if field.startswith("show_") else int(incoming[field] or 0)
                setattr(override, field, value)
    db.commit()
    return {"status": "success", "items": serialize_role_display_settings(db, role_id)}


@router.post("/{role_id}/content")
def create_role_content(
    role_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    require_role(db, role_id)
    block_type = str(data.get("block_type") or "custom_note").strip()
    content = str(data.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="內容不可空白")
    source = str(data.get("source") or "manual").strip()
    source_key = str(data.get("source_key") or f"manual:{block_type}").strip()
    duplicate = db.query(RoleContentBlock).filter(
        RoleContentBlock.role_id == role_id,
        RoleContentBlock.block_type == block_type,
        RoleContentBlock.source == source,
        RoleContentBlock.source_key == source_key,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="相同來源與類型的內容區塊已存在")
    block = RoleContentBlock(
        role_id=role_id,
        block_type=block_type,
        title=data.get("title") or None,
        content_format=data.get("content_format") or "html",
        content=content,
        audience=data.get("audience") or "storyteller",
        source=source,
        source_key=source_key,
        source_url=data.get("source_url") or None,
        sort_order=int(data.get("sort_order") or 0),
        review_status=data.get("review_status") or "confirmed",
        is_active=bool(data.get("is_active", True)),
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return {"status": "success", "block": serialize_block(block)}


@router.patch("/{role_id}/content/{block_id}")
def update_role_content(
    role_id: int,
    block_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    require_role(db, role_id)
    block = db.query(RoleContentBlock).filter(
        RoleContentBlock.id == block_id,
        RoleContentBlock.role_id == role_id,
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="找不到角色內容區塊")
    editable = [
        "block_type", "title", "content_format", "content", "audience", "source",
        "source_key", "source_url", "sort_order", "review_status", "is_active",
    ]
    for field in editable:
        if field in data:
            value = data.get(field)
            if field == "sort_order":
                value = int(value or 0)
            elif field == "is_active":
                value = bool(value)
            setattr(block, field, value)
    db.commit()
    db.refresh(block)
    return {"status": "success", "block": serialize_block(block)}


@router.delete("/{role_id}/content/{block_id}")
def delete_role_content(
    role_id: int,
    block_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    require_role(db, role_id)
    block = db.query(RoleContentBlock).filter(
        RoleContentBlock.id == block_id,
        RoleContentBlock.role_id == role_id,
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="找不到角色內容區塊")
    db.delete(block)
    db.commit()
    return {"status": "success"}


@router.patch("/{role_id}/knowledge-links/{link_id}")
def update_knowledge_link(
    role_id: int,
    link_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    require_role(db, role_id)
    link = db.query(RoleKnowledgeLink).filter(
        RoleKnowledgeLink.id == link_id,
        RoleKnowledgeLink.role_id == role_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="找不到百科對應")
    if "review_status" in data:
        link.review_status = str(data.get("review_status") or "needs_review")
    if "confidence" in data:
        link.confidence = float(data.get("confidence") or 0)
    db.commit()
    db.refresh(link)
    node = db.query(KnowledgeNode).filter(KnowledgeNode.id == link.knowledge_node_id).first()
    return {"status": "success", "link": serialize_link(link, node)}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
from role_models import Role, RoleContentBlock, RoleKnowledgeLink

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
    }


@router.get("/{role_id}/content")
def list_role_content(role_id: int, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    blocks = db.query(RoleContentBlock).filter(RoleContentBlock.role_id == role_id).order_by(
        RoleContentBlock.sort_order, RoleContentBlock.id
    ).all()
    links = db.query(RoleKnowledgeLink).filter(RoleKnowledgeLink.role_id == role_id).all()
    return {
        "role": {"id": role.id, "canonical_key": role.canonical_key, "name_zh_tw": role.name_zh_tw},
        "content_blocks": [serialize_block(item) for item in blocks],
        "knowledge_links": [{
            "id": item.id,
            "knowledge_node_id": item.knowledge_node_id,
            "match_method": item.match_method,
            "confidence": item.confidence,
            "review_status": item.review_status,
        } for item in links],
    }


@router.post("/{role_id}/content")
def create_role_content(role_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    block_type = str(data.get("block_type") or "custom_note").strip()
    content = str(data.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="內容不可空白")
    block = RoleContentBlock(
        role_id=role_id,
        block_type=block_type,
        title=data.get("title") or None,
        content_format=data.get("content_format") or "html",
        content=content,
        audience=data.get("audience") or "storyteller",
        source="manual",
        source_key=str(data.get("source_key") or f"manual:{block_type}"),
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
def update_role_content(role_id: int, block_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    block = db.query(RoleContentBlock).filter(RoleContentBlock.id == block_id, RoleContentBlock.role_id == role_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="找不到角色內容區塊")
    editable = ["block_type", "title", "content_format", "content", "audience", "source_url", "sort_order", "review_status", "is_active"]
    for field in editable:
        if field in data:
            setattr(block, field, data.get(field))
    db.commit()
    db.refresh(block)
    return {"status": "success", "block": serialize_block(block)}


@router.delete("/{role_id}/content/{block_id}")
def delete_role_content(role_id: int, block_id: int, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    block = db.query(RoleContentBlock).filter(RoleContentBlock.id == block_id, RoleContentBlock.role_id == role_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="找不到角色內容區塊")
    db.delete(block)
    db.commit()
    return {"status": "success"}

from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
from knowledge_presentation import PRESENTATION_TYPES
from knowledge_models import (
    CrawlRun,
    KnowledgeAlias,
    KnowledgeBlock,
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeSource,
    KnowledgeSourceRecord,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge-admin"])
ABILITY_CATEGORY_NAMES = [
    "拜訪說書人", "保護", "暴露角色", "持續檢測型能力", "處決", "額外死亡", "瘋狂", "復活",
    "更換選擇目標", "公開觸發能力", "獲得能力", "獲取資訊", "互動干擾", "回溯型能力",
    "進場能力", "角色變化", "鄰近", "免死", "能力效果干擾", "認知覆蓋", "設置調整",
    "死後能力保留", "死亡觸發能力", "特殊勝利失敗條件", "提名", "投票", "限次能力",
    "影響", "陣營轉變", "中毒", "醉酒",
]


def serialize_knowledge_block(block: KnowledgeBlock):
    return {
        "id": block.id, "block_type": block.block_type, "title": block.title,
        "content_format": block.content_format, "content": block.content,
        "sort_order": block.sort_order, "language": block.language, "layer": block.layer,
        "review_status": block.review_status, "visibility": block.visibility,
    }


@router.get("/summary")
def graph_summary(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    node_types = dict(
        db.query(KnowledgeNode.node_type, func.count(KnowledgeNode.id))
        .group_by(KnowledgeNode.node_type)
        .all()
    )
    review_states = dict(
        db.query(KnowledgeEdge.review_status, func.count(KnowledgeEdge.id))
        .group_by(KnowledgeEdge.review_status)
        .all()
    )
    latest_run = db.query(CrawlRun).order_by(CrawlRun.id.desc()).first()
    return {
        "nodes": db.query(KnowledgeNode).count(),
        "aliases": db.query(KnowledgeAlias).count(),
        "blocks": db.query(KnowledgeBlock).count(),
        "edges": db.query(KnowledgeEdge).count(),
        "source_records": db.query(KnowledgeSourceRecord).count(),
        "sources": db.query(KnowledgeSource).count(),
        "node_types": node_types,
        "edge_review_states": review_states,
        "latest_crawl": None if not latest_run else {
            "id": latest_run.id,
            "status": latest_run.status,
            "pages_fetched": latest_run.pages_fetched,
            "successful_pages": latest_run.successful_pages,
            "failed_pages": latest_run.failed_pages,
            "created_at": latest_run.created_at,
        },
    }


@router.get("/nodes")
def list_nodes(
    q: str = "",
    node_type: str = "",
    status: str = "",
    include_disabled: bool = False,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    query = db.query(KnowledgeNode)
    if not include_disabled:
        query = query.filter(
            ~KnowledgeNode.status.in_(["deleted", "archived", "disabled"]),
            or_(KnowledgeNode.presentation_type.is_(None), KnowledgeNode.presentation_type != "excluded"),
        )
    keyword = q.strip()
    if keyword:
        alias_node_ids = db.query(KnowledgeAlias.node_id).filter(KnowledgeAlias.alias.ilike(f"%{keyword}%"))
        query = query.filter(or_(
            KnowledgeNode.canonical_name_zh_tw.ilike(f"%{keyword}%"),
            KnowledgeNode.canonical_name_zh_cn.ilike(f"%{keyword}%"),
            KnowledgeNode.canonical_name_en.ilike(f"%{keyword}%"),
            KnowledgeNode.id.in_(alias_node_ids),
        ))
    if node_type:
        query = query.filter(KnowledgeNode.node_type == node_type)
    if status:
        query = query.filter(KnowledgeNode.status == status)
    total = query.count()
    nodes = query.order_by(KnowledgeNode.node_type, KnowledgeNode.canonical_name_zh_tw).offset(max(offset, 0)).limit(max(1, min(limit, 500))).all()
    return {
        "total": total,
        "items": [{
            "id": node.id,
            "node_type": node.node_type,
            "slug": node.slug,
            "name_zh_tw": node.canonical_name_zh_tw,
            "name_zh_cn": node.canonical_name_zh_cn,
            "name_en": node.canonical_name_en,
            "presentation_type": node.presentation_type,
            "classification_method": node.classification_method,
            "classification_confidence": node.classification_confidence,
            "classification_status": node.classification_status,
            "status": node.status,
            "visibility": node.visibility,
            "is_official": bool(node.is_official),
        } for node in nodes],
    }



@router.patch("/nodes/{node_id}")
def update_node(node_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    node = db.query(KnowledgeNode).filter(KnowledgeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")
    if "summary" in data:
        node.summary = str(data.get("summary") or "").strip() or None
    if "status" in data:
        status = str(data.get("status") or "").strip()
        if status not in {"discovered", "reviewed", "published", "disabled", "archived"}:
            raise HTTPException(status_code=400, detail="Unsupported article status")
        node.status = status
    if "visibility" in data:
        visibility = str(data.get("visibility") or "").strip()
        if visibility not in {"internal", "public", "published"}:
            raise HTTPException(status_code=400, detail="Unsupported article visibility")
        node.visibility = visibility
    db.commit()
    return {"status": "success", "id": node.id, "node_status": node.status, "visibility": node.visibility, "summary": node.summary}


@router.patch("/nodes/{node_id}/blocks/{block_id}")
def update_node_block(node_id: int, block_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    block = db.query(KnowledgeBlock).filter(KnowledgeBlock.id == block_id, KnowledgeBlock.node_id == node_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Article content block not found")
    for field in ("block_type", "title", "content", "sort_order", "content_format", "review_status", "visibility"):
        if field not in data:
            continue
        value = data.get(field)
        if field == "sort_order": value = int(value or 0)
        elif field == "content_format" and value not in {"text", "markdown", "html"}: raise HTTPException(status_code=400, detail="Unsupported content format")
        elif field == "review_status" and value not in {"needs_review", "confirmed", "rejected"}: raise HTTPException(status_code=400, detail="Unsupported review status")
        elif field == "visibility" and value not in {"internal", "public", "published"}: raise HTTPException(status_code=400, detail="Unsupported block visibility")
        elif field in {"block_type", "title", "content"}: value = str(value or "").strip() or (None if field == "title" else "")
        setattr(block, field, value)
    db.commit(); db.refresh(block)
    return {"status": "success", "block": serialize_knowledge_block(block)}



@router.get("/ability-types")
def list_ability_types(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    nodes = db.query(KnowledgeNode).filter(or_(
        KnowledgeNode.canonical_name_zh_tw.in_(ABILITY_CATEGORY_NAMES),
        KnowledgeNode.canonical_name_zh_cn.in_(ABILITY_CATEGORY_NAMES),
    )).all()
    by_name = {}
    for node in nodes:
        for name in (node.canonical_name_zh_tw, node.canonical_name_zh_cn):
            if name:
                by_name[name] = node
    items = []
    for name in ABILITY_CATEGORY_NAMES:
        node = by_name.get(name)
        slug = node.slug if node else name
        items.append({
            "id": node.id if node else None,
            "name_zh_tw": node.canonical_name_zh_tw if node else name,
            "name_zh_cn": node.canonical_name_zh_cn if node else None,
            "slug": slug,
            "node_type": node.node_type if node else "article",
            "knowledge_url": f"#knowledge/{quote(slug)}",
            "source_url": f"https://clocktower-wiki.gstonegames.com/index.php?title={quote(name)}",
            "is_linked": bool(node),
        })
    return {
        "source": "gstone_role_ability_category_overview",
        "source_url": "https://clocktower-wiki.gstonegames.com/index.php?title=%E8%A7%92%E8%89%B2%E8%83%BD%E5%8A%9B%E7%B1%BB%E5%88%AB%E6%80%BB%E8%A7%88",
        "total": len(items),
        "linked": sum(1 for item in items if item["is_linked"]),
        "items": items,
    }

@router.patch("/nodes/{node_id}/presentation")
def update_node_presentation(
    node_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    node = db.query(KnowledgeNode).filter(KnowledgeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="找不到知識節點")
    presentation_type = str(data.get("presentation_type") or "").strip()
    if presentation_type not in PRESENTATION_TYPES:
        raise HTTPException(status_code=400, detail="不支援的文章呈現模板")
    node.presentation_type = presentation_type
    node.classification_method = "manual"
    node.classification_confidence = 1.0
    node.classification_status = "confirmed"
    db.commit()
    return {
        "id": node.id,
        "presentation_type": node.presentation_type,
        "classification_method": node.classification_method,
        "classification_confidence": node.classification_confidence,
        "classification_status": node.classification_status,
    }


@router.get("/nodes/{node_id}")
def get_node(
    node_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    node = db.query(KnowledgeNode).filter(KnowledgeNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="找不到知識節點")
    outgoing = db.query(KnowledgeEdge).filter(KnowledgeEdge.from_node_id == node.id).limit(250).all()
    incoming = db.query(KnowledgeEdge).filter(KnowledgeEdge.to_node_id == node.id).limit(250).all()
    linked_ids = {edge.to_node_id for edge in outgoing} | {edge.from_node_id for edge in incoming}
    linked = {item.id: item for item in db.query(KnowledgeNode).filter(KnowledgeNode.id.in_(linked_ids)).all()} if linked_ids else {}

    def edge_data(edge, direction):
        linked_id = edge.to_node_id if direction == "outgoing" else edge.from_node_id
        target = linked.get(linked_id)
        return {
            "id": edge.id,
            "direction": direction,
            "edge_type": edge.edge_type,
            "confidence": edge.confidence,
            "review_status": edge.review_status,
            "node": None if not target else {
                "id": target.id,
                "node_type": target.node_type,
                "name_zh_tw": target.canonical_name_zh_tw,
                "slug": target.slug,
            },
        }

    return {
        "id": node.id,
        "node_type": node.node_type,
        "slug": node.slug,
        "name_zh_tw": node.canonical_name_zh_tw,
        "name_zh_cn": node.canonical_name_zh_cn,
        "name_en": node.canonical_name_en,
        "summary": node.summary,
        "presentation_type": node.presentation_type,
        "classification_method": node.classification_method,
        "classification_confidence": node.classification_confidence,
        "classification_status": node.classification_status,
        "status": node.status,
        "visibility": node.visibility,
        "aliases": [{
            "id": alias.id,
            "alias": alias.alias,
            "language": alias.language,
            "alias_type": alias.alias_type,
            "is_preferred": bool(alias.is_preferred),
        } for alias in node.aliases],
        "blocks": [serialize_knowledge_block(block) for block in sorted(node.blocks, key=lambda item: (item.sort_order, item.id))],
        "edges": [edge_data(edge, "outgoing") for edge in outgoing] + [edge_data(edge, "incoming") for edge in incoming],
    }

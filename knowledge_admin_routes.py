from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
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
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_account),
):
    query = db.query(KnowledgeNode)
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
            "status": node.status,
            "visibility": node.visibility,
            "is_official": bool(node.is_official),
        } for node in nodes],
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
        "status": node.status,
        "visibility": node.visibility,
        "aliases": [{
            "id": alias.id,
            "alias": alias.alias,
            "language": alias.language,
            "alias_type": alias.alias_type,
            "is_preferred": bool(alias.is_preferred),
        } for alias in node.aliases],
        "blocks": [{
            "id": block.id,
            "block_type": block.block_type,
            "title": block.title,
            "language": block.language,
            "layer": block.layer,
            "review_status": block.review_status,
            "visibility": block.visibility,
        } for block in node.blocks],
        "edges": [edge_data(edge, "outgoing") for edge in outgoing] + [edge_data(edge, "incoming") for edge in incoming],
    }

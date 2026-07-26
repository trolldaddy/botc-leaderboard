from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from knowledge_models import (
    KnowledgeAlias,
    KnowledgeBlock,
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeSource,
    KnowledgeSourceRecord,
)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge-public"])

PUBLIC_NODE_TYPES = {"role", "script", "guide", "mechanic", "article"}
HIDDEN_STATUSES = {"deleted", "archived", "disabled"}


def _node_query(db: Session):
    return db.query(KnowledgeNode).filter(
        KnowledgeNode.node_type.in_(PUBLIC_NODE_TYPES),
        ~KnowledgeNode.status.in_(HIDDEN_STATUSES),
    )


def _display_name(node: KnowledgeNode) -> str:
    return node.canonical_name_zh_tw or node.canonical_name_zh_cn or node.canonical_name_en or node.slug


def _node_card(node: KnowledgeNode):
    return {
        "id": node.id,
        "slug": node.slug,
        "node_type": node.node_type,
        "name": _display_name(node),
        "name_zh_tw": node.canonical_name_zh_tw,
        "name_zh_cn": node.canonical_name_zh_cn,
        "name_en": node.canonical_name_en,
        "summary": node.summary,
        "status": node.status,
        "is_official": bool(node.is_official),
    }


def _latest_source_record(db: Session, node_id: int):
    return (
        db.query(KnowledgeSourceRecord, KnowledgeSource)
        .outerjoin(KnowledgeSource, KnowledgeSource.id == KnowledgeSourceRecord.source_id)
        .filter(KnowledgeSourceRecord.node_id == node_id)
        .order_by(KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc())
        .first()
    )


def _serialize_source_record(row):
    if not row:
        return None
    record, source = row
    content = record.normalized_content or record.raw_content or ""
    return {
        "id": record.id,
        "title": record.source_title,
        "url": record.source_url,
        "language": record.source_language,
        "content": content,
        "fetched_at": record.fetched_at,
        "source": None if not source else {
            "id": source.id,
            "name": source.name,
            "publisher": source.publisher,
            "base_url": source.base_url,
            "is_official": bool(source.is_official),
        },
    }


@router.get("/types")
def list_types(db: Session = Depends(get_db)):
    rows = (
        _node_query(db)
        .with_entities(KnowledgeNode.node_type, func.count(KnowledgeNode.id))
        .group_by(KnowledgeNode.node_type)
        .order_by(KnowledgeNode.node_type)
        .all()
    )
    return {"items": [{"node_type": node_type, "count": count} for node_type, count in rows]}


@router.get("/search")
def search_knowledge(
    q: str = Query(default="", max_length=120),
    node_type: str = Query(default="", max_length=40),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = _node_query(db)
    keyword = q.strip()
    if keyword:
        alias_node_ids = db.query(KnowledgeAlias.node_id).filter(KnowledgeAlias.alias.ilike(f"%{keyword}%"))
        query = query.filter(or_(
            KnowledgeNode.canonical_name_zh_tw.ilike(f"%{keyword}%"),
            KnowledgeNode.canonical_name_zh_cn.ilike(f"%{keyword}%"),
            KnowledgeNode.canonical_name_en.ilike(f"%{keyword}%"),
            KnowledgeNode.slug.ilike(f"%{keyword}%"),
            KnowledgeNode.id.in_(alias_node_ids),
        ))
    if node_type:
        if node_type not in PUBLIC_NODE_TYPES:
            raise HTTPException(status_code=400, detail="不支援的知識類型")
        query = query.filter(KnowledgeNode.node_type == node_type)
    total = query.count()
    nodes = query.order_by(KnowledgeNode.node_type, KnowledgeNode.canonical_name_zh_tw).offset(offset).limit(limit).all()
    return {"query": keyword, "total": total, "items": [_node_card(node) for node in nodes]}


@router.get("/nodes/{slug}")
def get_public_node(slug: str, db: Session = Depends(get_db)):
    node = _node_query(db).filter(KnowledgeNode.slug == slug).first()
    if not node:
        alias = db.query(KnowledgeAlias).filter(func.lower(KnowledgeAlias.alias) == slug.lower()).first()
        if alias:
            node = _node_query(db).filter(KnowledgeNode.id == alias.node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="找不到知識條目")

    aliases = db.query(KnowledgeAlias).filter(KnowledgeAlias.node_id == node.id).order_by(KnowledgeAlias.is_preferred.desc(), KnowledgeAlias.language, KnowledgeAlias.alias).all()
    blocks = db.query(KnowledgeBlock).filter(
        KnowledgeBlock.node_id == node.id,
        KnowledgeBlock.visibility.in_(["public", "published"]),
    ).order_by(KnowledgeBlock.sort_order, KnowledgeBlock.id).all()

    outgoing = db.query(KnowledgeEdge).filter(KnowledgeEdge.from_node_id == node.id).limit(150).all()
    incoming = db.query(KnowledgeEdge).filter(KnowledgeEdge.to_node_id == node.id).limit(150).all()
    linked_ids = {edge.to_node_id for edge in outgoing} | {edge.from_node_id for edge in incoming}
    linked_nodes = {
        linked.id: linked
        for linked in _node_query(db).filter(KnowledgeNode.id.in_(linked_ids)).all()
    } if linked_ids else {}

    relations = []
    for edge, direction in [(edge, "outgoing") for edge in outgoing] + [(edge, "incoming") for edge in incoming]:
        linked_id = edge.to_node_id if direction == "outgoing" else edge.from_node_id
        target = linked_nodes.get(linked_id)
        if not target:
            continue
        relations.append({
            "id": edge.id,
            "direction": direction,
            "edge_type": edge.edge_type,
            "confidence": edge.confidence,
            "review_status": edge.review_status,
            "node": _node_card(target),
        })

    payload = _node_card(node)
    payload.update({
        "aliases": [{
            "alias": alias.alias,
            "language": alias.language,
            "alias_type": alias.alias_type,
            "is_preferred": bool(alias.is_preferred),
        } for alias in aliases],
        "blocks": [{
            "id": block.id,
            "block_type": block.block_type,
            "title": block.title,
            "content_format": block.content_format,
            "content": block.content,
            "language": block.language,
            "layer": block.layer,
            "review_status": block.review_status,
        } for block in blocks],
        "source_record": _serialize_source_record(_latest_source_record(db, node.id)),
        "relations": relations,
        "relation_count": len(relations),
    })
    return payload


@router.get("/nodes/{slug}/relations")
def get_public_relations(slug: str, limit: int = Query(default=100, ge=1, le=250), db: Session = Depends(get_db)):
    node = _node_query(db).filter(KnowledgeNode.slug == slug).first()
    if not node:
        raise HTTPException(status_code=404, detail="找不到知識條目")
    edges = db.query(KnowledgeEdge).filter(or_(KnowledgeEdge.from_node_id == node.id, KnowledgeEdge.to_node_id == node.id)).limit(limit).all()
    linked_ids = {(edge.to_node_id if edge.from_node_id == node.id else edge.from_node_id) for edge in edges}
    linked = {item.id: item for item in _node_query(db).filter(KnowledgeNode.id.in_(linked_ids)).all()} if linked_ids else {}
    items = []
    for edge in edges:
        outgoing = edge.from_node_id == node.id
        target = linked.get(edge.to_node_id if outgoing else edge.from_node_id)
        if target:
            items.append({"edge_type": edge.edge_type, "direction": "outgoing" if outgoing else "incoming", "node": _node_card(target)})
    return {"slug": node.slug, "total": len(items), "items": items}

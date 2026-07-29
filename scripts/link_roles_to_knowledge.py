import argparse
import os
import re
import sys
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from knowledge_models import KnowledgeAlias, KnowledgeBlock, KnowledgeNode, KnowledgeSourceRecord
from role_models import Role, RoleContentBlock, RoleKnowledgeLink

TARGET_NAMES = ["小惡魔", "洗腦師", "賭徒"]
SKIP_BLOCK_TYPES = {"ability", "reminders", "source_excerpt"}
AUDIENCE_BY_TYPE = {
    "background": "encyclopedia",
    "intro": "player",
    "overview": "encyclopedia",
    "how_it_works": "encyclopedia",
    "rules_detail": "encyclopedia",
    "examples": "encyclopedia",
    "strategy_play": "encyclopedia",
    "strategy_bluff": "encyclopedia",
    "strategy_counter": "encyclopedia",
    "rules_interactions": "encyclopedia",
    "rules_jinx": "encyclopedia",
    "common_mistakes": "storyteller",
    "storyteller_advice": "storyteller",
    "reminders": "storyteller",
}


def base_block_type(block_type: str) -> str:
    return re.sub(r"_\d+$", "", block_type or "")

def find_role(db: Session, name: str):
    role = db.query(Role).filter(func.lower(Role.name_zh_tw) == name.lower()).first()
    if role:
        return role, "name_zh_tw", 1.0
    role = db.query(Role).filter(func.lower(Role.name_en) == name.lower()).first()
    if role:
        return role, "name_en", 0.95
    return None, "none", 0.0


def find_node(db: Session, name: str):
    node = db.query(KnowledgeNode).filter(func.lower(KnowledgeNode.canonical_name_zh_tw) == name.lower()).first()
    if node:
        return node, "canonical_name_zh_tw", 1.0
    alias = db.query(KnowledgeAlias).filter(func.lower(KnowledgeAlias.alias) == name.lower()).first()
    if alias:
        node = db.query(KnowledgeNode).filter(KnowledgeNode.id == alias.node_id).first()
        if node:
            return node, "knowledge_alias", 0.9
    return None, "none", 0.0


def latest_source_url(db: Session, node_id: int):
    row = db.query(KnowledgeSourceRecord).filter(KnowledgeSourceRecord.node_id == node_id).order_by(
        KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc()
    ).first()
    return row.source_url if row else None


def run(write: bool):
    db: Session = SessionLocal()
    stats = {
        "mode": "write" if write else "preview",
        "targets": TARGET_NAMES,
        "links_created": 0,
        "links_updated": 0,
        "blocks_created": 0,
        "blocks_updated": 0,
        "blocks_skipped": 0,
        "blocks_deactivated": 0,
        "missing_roles": [],
        "missing_nodes": [],
        "matches": [],
    }
    try:
        for name in TARGET_NAMES:
            role, role_method, role_confidence = find_role(db, name)
            node, node_method, node_confidence = find_node(db, name)
            if not role:
                stats["missing_roles"].append(name)
                continue
            if not node:
                stats["missing_nodes"].append(name)
                continue

            match_method = f"{role_method}+{node_method}"
            confidence = min(role_confidence, node_confidence)
            stats["matches"].append({
                "name": name,
                "role_id": role.id,
                "role_key": role.canonical_key,
                "knowledge_node_id": node.id,
                "knowledge_slug": node.slug,
                "match_method": match_method,
                "confidence": confidence,
            })

            link = db.query(RoleKnowledgeLink).filter(
                RoleKnowledgeLink.role_id == role.id,
                RoleKnowledgeLink.knowledge_node_id == node.id,
            ).first()
            if not link:
                link = RoleKnowledgeLink(role_id=role.id, knowledge_node_id=node.id)
                db.add(link)
                stats["links_created"] += 1
            else:
                stats["links_updated"] += 1
            link.match_method = match_method
            link.confidence = confidence
            link.review_status = "confirmed" if confidence >= 0.99 else "needs_review"

            source_url = latest_source_url(db, node.id)
            blocks = db.query(KnowledgeBlock).filter(
                KnowledgeBlock.node_id == node.id,
                KnowledgeBlock.visibility.in_(["public", "published"]),
            ).order_by(KnowledgeBlock.sort_order, KnowledgeBlock.id).all()

            active_source_keys = set()
            for kb in blocks:
                base_type = base_block_type(kb.block_type)
                if base_type in SKIP_BLOCK_TYPES or not (kb.content or "").strip():
                    stats["blocks_skipped"] += 1
                    continue
                source_key = f"knowledge:{node.id}:{kb.block_type}"
                active_source_keys.add(source_key)
                target = db.query(RoleContentBlock).filter(
                    RoleContentBlock.role_id == role.id,
                    RoleContentBlock.source == "gstone_wiki",
                    RoleContentBlock.source_key == source_key,
                ).first()
                if not target:
                    target = RoleContentBlock(role_id=role.id, source="gstone_wiki", source_key=source_key)
                    db.add(target)
                    stats["blocks_created"] += 1
                else:
                    stats["blocks_updated"] += 1
                target.block_type = kb.block_type
                target.title = kb.title
                target.content_format = kb.content_format or "html"
                target.content = kb.content
                target.audience = AUDIENCE_BY_TYPE.get(base_type, "encyclopedia")
                target.source_url = source_url
                target.sort_order = kb.sort_order or 0
                target.review_status = kb.review_status or "needs_review"
                target.is_active = True
            stale_blocks = db.query(RoleContentBlock).filter(
                RoleContentBlock.role_id == role.id,
                RoleContentBlock.source == "gstone_wiki",
                RoleContentBlock.source_key.like(f"knowledge:{node.id}:%"),
            ).all()
            for stale in stale_blocks:
                if stale.source_key not in active_source_keys and stale.is_active:
                    stale.is_active = False
                    stats["blocks_deactivated"] += 1

        if write:
            db.commit()
        else:
            db.rollback()
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Link Role master data to Knowledge nodes and import supplemental content.")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    print(run(args.write))


if __name__ == "__main__":
    main()

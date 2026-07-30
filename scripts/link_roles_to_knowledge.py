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
from gstone_wiki import to_simplified
from knowledge_models import KnowledgeAlias, KnowledgeBlock, KnowledgeEdge, KnowledgeNode, KnowledgeSourceRecord
from role_models import Role, RoleContentBlock, RoleKnowledgeLink
from scripts.seed_archived_deleted_roles import ARCHIVED_ROLES, run as seed_archived_deleted_roles

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


def find_node(db: Session, name: str, aliases: list[str] | None = None):
    candidates = [name] + [value for value in (aliases or []) if value and value.lower() != name.lower()]
    for index, candidate in enumerate(candidates):
        node = db.query(KnowledgeNode).filter(
            func.lower(KnowledgeNode.canonical_name_zh_tw) == candidate.lower()
        ).first()
        if node:
            return node, "canonical_name_zh_tw" if index == 0 else "role_alias_to_canonical_zh_tw", 1.0 if index == 0 else 0.95
        node = db.query(KnowledgeNode).filter(
            func.lower(KnowledgeNode.canonical_name_en) == candidate.lower()
        ).first()
        if node:
            return node, "canonical_name_en", 0.95
        alias = db.query(KnowledgeAlias).filter(func.lower(KnowledgeAlias.alias) == candidate.lower()).first()
        if alias:
            node = db.query(KnowledgeNode).filter(KnowledgeNode.id == alias.node_id).first()
            if node:
                return node, "knowledge_alias", 0.9
    normalized_candidates = {to_simplified(value).lower() for value in candidates if value}
    for node in db.query(KnowledgeNode).filter(KnowledgeNode.node_type == "role").all():
        node_names = [node.canonical_name_zh_tw, node.canonical_name_zh_cn, node.canonical_name_en]
        if any(to_simplified(value).lower() in normalized_candidates for value in node_names if value):
            return node, "normalized_simplified_name", 0.9
    return None, "none", 0.0


def role_node_aliases(role: Role) -> list[str]:
    values = [role.name_en, role.canonical_key]
    for alias in role.aliases or []:
        values.extend([alias.external_name, alias.external_id])
    return list(dict.fromkeys(str(value).strip() for value in values if str(value or "").strip()))


def latest_source_url(db: Session, node_id: int):
    row = db.query(KnowledgeSourceRecord).filter(KnowledgeSourceRecord.node_id == node_id).order_by(
        KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc()
    ).first()
    return row.source_url if row else None


def irrelevant_contest_nodes(db: Session) -> list[KnowledgeNode]:
    root = db.query(KnowledgeNode).filter(
        KnowledgeNode.canonical_name_zh_tw == "第一屆華燈初上劇本創作大賽"
    ).first()
    if not root:
        return []

    target_ids = [row[0] for row in db.query(KnowledgeEdge.to_node_id).filter(
        KnowledgeEdge.from_node_id == root.id
    ).all()]
    candidates = db.query(KnowledgeNode).filter(
        KnowledgeNode.id.in_(target_ids),
        KnowledgeNode.node_type == "article",
    ).all() if target_ids else []
    disabled = [root]
    for node in candidates:
        has_role_link = db.query(RoleKnowledgeLink.id).filter(
            RoleKnowledgeLink.knowledge_node_id == node.id
        ).first() is not None
        has_other_incoming = db.query(KnowledgeEdge.id).filter(
            KnowledgeEdge.to_node_id == node.id,
            KnowledgeEdge.from_node_id != root.id,
        ).first() is not None
        if not has_role_link and not has_other_incoming:
            disabled.append(node)
    return disabled


def run(write: bool, all_roles: bool = True):
    db: Session = SessionLocal()
    stats = {
        "mode": "write" if write else "preview",
        "targets": "all_active_roles" if all_roles else TARGET_NAMES,
        "links_created": 0,
        "links_updated": 0,
        "blocks_created": 0,
        "blocks_updated": 0,
        "blocks_skipped": 0,
        "blocks_deactivated": 0,
        "missing_roles": [],
        "missing_nodes": [],
        "matches": [],
        "contest_nodes_would_disable": 0,
        "contest_nodes_disabled": 0,
        "contest_nodes": [],
    }
    try:
        target_names = (
            [role.name_zh_tw for role in db.query(Role).filter(Role.is_active == True).order_by(Role.id).all()]  # noqa: E712
            if all_roles else TARGET_NAMES
        )
        stats["roles_scanned"] = len(target_names)
        for name in target_names:
            role, role_method, role_confidence = find_role(db, name)
            node, node_method, node_confidence = find_node(db, name, aliases=role_node_aliases(role) if role else [])
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

        for node in irrelevant_contest_nodes(db):
            stats["contest_nodes"].append({"id": node.id, "name": node.canonical_name_zh_tw, "status": node.status})
            if node.status != "disabled":
                stats["contest_nodes_would_disable"] += 1
                if write:
                    node.status = "disabled"
                    stats["contest_nodes_disabled"] += 1

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
    parser.add_argument("--trial", action="store_true", help="Only process the original three trial roles.")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    archived_stats = seed_archived_deleted_roles(args.write)
    link_stats = run(args.write, all_roles=not args.trial)
    if not args.write:
        archived_names = {item["name_tw"] for item in ARCHIVED_ROLES}
        covered = [name for name in link_stats["missing_nodes"] if name in archived_names]
        link_stats["missing_nodes"] = [name for name in link_stats["missing_nodes"] if name not in archived_names]
        link_stats["resolved_by_archived_seed_preview"] = covered
    print({
        "archived_deleted_roles": archived_stats,
        "role_knowledge": link_stats,
    })


if __name__ == "__main__":
    main()

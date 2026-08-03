import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal, engine
from knowledge_models import KnowledgeEdge, KnowledgeNode, KnowledgeSourceRecord
from knowledge_presentation import classify_knowledge_node, excluded_classification

CONTEST_ENTRY_TITLES = {
    "凶宅魅影", "十三行", "司民", "寄夢他鄉", "愚者歡宴",
    "沸反盈天", "無何有之鄉", "移花接木", "金戈鐵馬V2.0", "隻手遮天",
}

def ensure_columns():
    inspector = inspect(engine)
    if "knowledge_nodes" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("knowledge_nodes")}
    dialect = engine.dialect.name
    definitions = {
        "presentation_type": "VARCHAR(50)",
        "classification_method": "VARCHAR(80)",
        "classification_confidence": "FLOAT",
        "classification_status": "VARCHAR(40) DEFAULT 'unclassified'",
    }
    with engine.begin() as connection:
        for name, definition in definitions.items():
            if name in existing:
                continue
            if dialect == "postgresql":
                connection.execute(text(f"ALTER TABLE knowledge_nodes ADD COLUMN IF NOT EXISTS {name} {definition}"))
            else:
                connection.execute(text(f"ALTER TABLE knowledge_nodes ADD COLUMN {name} {definition}"))


def irrelevant_contest_node_ids(db: Session) -> set[int]:
    roots = db.query(KnowledgeNode).filter(
        KnowledgeNode.canonical_name_zh_tw.in_([
            "第一屆華燈初上劇本創作大賽",
            "第一届华灯初上剧本创作大赛",
        ])
    ).all()
    excluded_ids = {node.id for node in roots}
    known_entries = db.query(KnowledgeNode).filter(KnowledgeNode.canonical_name_zh_tw.in_(CONTEST_ENTRY_TITLES)).all()
    excluded_ids.update(node.id for node in known_entries)
    for root in roots:
        target_ids = [row[0] for row in db.query(KnowledgeEdge.to_node_id).filter(
            KnowledgeEdge.from_node_id == root.id
        ).all()]
        candidates = db.query(KnowledgeNode).filter(
            KnowledgeNode.id.in_(target_ids),
            KnowledgeNode.node_type == "article",
        ).all() if target_ids else []
        for node in candidates:
            if classify_knowledge_node(node).presentation_type == "standard_article":
                excluded_ids.add(node.id)

    contest_markers = ("第一屆華燈初上劇本創作大賽", "第一届华灯初上剧本创作大赛")
    records = db.query(KnowledgeSourceRecord).filter(KnowledgeSourceRecord.node_id.isnot(None)).all()
    content_node_ids = {
        record.node_id
        for record in records
        if any(marker in f"{record.normalized_content or ''}\n{record.raw_content or ''}" for marker in contest_markers)
    }
    content_nodes = db.query(KnowledgeNode).filter(KnowledgeNode.id.in_(content_node_ids)).all() if content_node_ids else []
    for node in content_nodes:
        if classify_knowledge_node(node).presentation_type == "standard_article":
            excluded_ids.add(node.id)
    return excluded_ids


def run(write: bool):
    ensure_columns()
    db: Session = SessionLocal()
    rows = []
    type_counts = Counter()
    status_counts = Counter()
    changed = 0
    skipped_manual = 0
    try:
        nodes = db.query(KnowledgeNode).order_by(KnowledgeNode.node_type, KnowledgeNode.canonical_name_zh_tw).all()
        contest_excluded_ids = irrelevant_contest_node_ids(db)
        for node in nodes:
            if (node.canonical_name_zh_tw or node.canonical_name_zh_cn or "").strip() in {"重要細節", "重要细节"} and node.node_type == "role":
                node.node_type = "article"
            if node.classification_method == "manual" and node.presentation_type:
                type_counts[node.presentation_type] += 1
                status_counts[node.classification_status or "manual_confirmed"] += 1
                skipped_manual += 1
                continue
            result = (
                excluded_classification("第一屆華燈初上劇本創作大賽的無關子頁")
                if node.id in contest_excluded_ids
                else classify_knowledge_node(node)
            )
            type_counts[result.presentation_type] += 1
            status_counts[result.status] += 1
            is_changed = any([
                node.presentation_type != result.presentation_type,
                node.classification_method != result.method,
                node.classification_confidence != result.confidence,
                node.classification_status != result.status,
            ])
            if is_changed:
                changed += 1
            if write:
                node.presentation_type = result.presentation_type
                node.classification_method = result.method
                node.classification_confidence = result.confidence
                node.classification_status = result.status
            if result.status == "needs_review" or result.presentation_type == "excluded":
                rows.append({
                    "id": node.id,
                    "name": node.canonical_name_zh_tw,
                    "node_type": node.node_type,
                    "current_status": node.status,
                    **result.to_dict(),
                })
        if write:
            db.commit()
        else:
            db.rollback()
        report = {
            "mode": "write" if write else "preview",
            "nodes_scanned": len(nodes),
            "changed" if write else "would_change": changed,
            "presentation_types": dict(sorted(type_counts.items())),
            "classification_statuses": dict(sorted(status_counts.items())),
            "manual_overrides_preserved": skipped_manual,
            "contest_nodes_excluded": len(contest_excluded_ids),
            "review_or_excluded": rows,
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify Knowledge page presentation templates.")
    parser.add_argument("--write", action="store_true", help="Persist classifications. Default is preview only.")
    args = parser.parse_args()
    run(write=args.write)

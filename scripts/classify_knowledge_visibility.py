import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from knowledge_models import KnowledgeBlock, KnowledgeNode
from knowledge_visibility import HIDDEN_STATUSES, node_display_name, recommended_block_visibility, recommended_node_visibility

RESTORABLE_RULE_NAMES = {"規則調整提前公示", "规则调整提前公示"}


def run(write: bool):
    db: Session = SessionLocal()
    node_counts = Counter()
    block_counts = Counter()
    node_changes = 0
    block_changes = 0
    samples = []
    statuses_restored = 0
    try:
        nodes = db.query(KnowledgeNode).order_by(KnowledgeNode.id).all()
        for node in nodes:
            restore_status = node_display_name(node) in RESTORABLE_RULE_NAMES and (node.status or "").lower() in HIDDEN_STATUSES
            if restore_status:
                statuses_restored += 1
                node.status = "discovered"
            visibility = recommended_node_visibility(node)
            node_counts[visibility] += 1
            if node.visibility != visibility:
                node_changes += 1
                if len(samples) < 40:
                    samples.append({
                        "id": node.id,
                        "name": node.canonical_name_zh_tw,
                        "node_type": node.node_type,
                        "presentation_type": node.presentation_type,
                        "from": node.visibility,
                        "to": visibility,
                    })
                if write:
                    node.visibility = visibility

            blocks = db.query(KnowledgeBlock).filter(KnowledgeBlock.node_id == node.id).all()
            for block in blocks:
                block_visibility = recommended_block_visibility(block, visibility)
                block_counts[block_visibility] += 1
                if block.visibility != block_visibility:
                    block_changes += 1
                    if write:
                        block.visibility = block_visibility

        if write:
            db.commit()
        else:
            db.rollback()
        print(json.dumps({
            "mode": "write" if write else "preview",
            "nodes_scanned": len(nodes),
            "statuses_restored" if write else "statuses_would_restore": statuses_restored,
            "node_visibility": dict(sorted(node_counts.items())),
            "node_changes" if write else "node_would_change": node_changes,
            "block_visibility": dict(sorted(block_counts.items())),
            "block_changes" if write else "block_would_change": block_changes,
            "sample_node_changes": samples,
        }, ensure_ascii=False, indent=2))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify public/internal Knowledge visibility.")
    parser.add_argument("--write", action="store_true", help="Persist visibility. Default is preview only.")
    args = parser.parse_args()
    run(write=args.write)

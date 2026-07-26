import argparse
import os
import re
import sys
from pathlib import Path

# Running `python scripts/...py` puts the scripts directory on sys.path,
# not the repository root. Add the project root explicitly so shared
# modules such as database.py and knowledge_models.py can be imported.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy.orm import Session

from database import SessionLocal
from knowledge_models import KnowledgeBlock, KnowledgeNode, KnowledgeSourceRecord

TARGET_SLUGS = ["酒鬼", "小惡魔", "洗腦師"]


def clean_text(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def excerpt(value: str, limit: int = 1800) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit("\n", 1)[0].strip()
    return f"{clipped}\n\n（來源內容較長，此處先顯示節錄。）"


def seed(write: bool) -> dict:
    db: Session = SessionLocal()
    stats = {"created": 0, "updated": 0, "skipped": 0, "missing": []}
    try:
        for slug in TARGET_SLUGS:
            node = db.query(KnowledgeNode).filter(KnowledgeNode.slug == slug).first()
            if not node:
                stats["missing"].append(slug)
                continue

            source = (
                db.query(KnowledgeSourceRecord)
                .filter(KnowledgeSourceRecord.node_id == node.id)
                .order_by(KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc())
                .first()
            )
            content = excerpt((source.normalized_content if source else "") or (source.raw_content if source else "") or node.summary or "")
            if not content:
                stats["skipped"] += 1
                continue

            block = (
                db.query(KnowledgeBlock)
                .filter(
                    KnowledgeBlock.node_id == node.id,
                    KnowledgeBlock.block_type == "source_excerpt",
                    KnowledgeBlock.language == "zh-TW",
                )
                .first()
            )
            if block:
                block.title = "來源內容節錄"
                block.content = content
                block.content_format = "text"
                block.sort_order = 900
                block.layer = "source"
                block.review_status = "needs_review"
                block.visibility = "public"
                block.current_source_record_id = source.id if source else None
                stats["updated"] += 1
            else:
                db.add(KnowledgeBlock(
                    node_id=node.id,
                    block_type="source_excerpt",
                    title="來源內容節錄",
                    content_format="text",
                    content=content,
                    sort_order=900,
                    language="zh-TW",
                    layer="source",
                    review_status="needs_review",
                    visibility="public",
                    current_source_record_id=source.id if source else None,
                ))
                stats["created"] += 1

            if not node.summary:
                node.summary = excerpt(content, 240)

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
    parser = argparse.ArgumentParser(description="Seed public source excerpt blocks for initial role pages.")
    parser.add_argument("--write", action="store_true", help="Commit changes. Default is dry-run.")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    stats = seed(args.write)
    print({"mode": "write" if args.write else "dry-run", "targets": TARGET_SLUGS, "stats": stats})


if __name__ == "__main__":
    main()

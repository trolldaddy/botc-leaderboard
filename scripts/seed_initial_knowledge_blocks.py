import argparse
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from gstone_wiki import HEADERS, to_traditional
from knowledge_models import KnowledgeBlock, KnowledgeNode, KnowledgeSourceRecord

TARGET_SLUGS = ["酒鬼", "小惡魔", "洗腦師"]


def clean_text(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def excerpt(value: str, limit: int = 1800) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit("\n", 1)[0].strip() or text[:limit].strip()
    return f"{clipped}\n\n（來源內容較長，此處先顯示節錄。）"


def fetch_source_text(url: str) -> str:
    if not url:
        return ""
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one("#mw-content-text") or soup.select_one("main")
    if not root:
        return ""
    for node in root.select("script, style, noscript, nav, .mw-editsection, .navbox, .toc, table.infobox"):
        node.decompose()
    text = root.get_text("\n", strip=True)
    return clean_text(to_traditional(text))


def seed(write: bool) -> dict:
    db: Session = SessionLocal()
    stats = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "fetched": 0,
        "fetch_failed": [],
        "missing": [],
    }
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
            raw_source_content = (source.normalized_content if source else "") or (source.raw_content if source else "")
            if not clean_text(raw_source_content) and source and source.source_url:
                try:
                    fetched_content = fetch_source_text(source.source_url)
                    if fetched_content:
                        raw_source_content = fetched_content
                        source.normalized_content = fetched_content
                        stats["fetched"] += 1
                except Exception as exc:
                    stats["fetch_failed"].append({"slug": slug, "error": str(exc)})

            content = excerpt(raw_source_content or node.summary or "")
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

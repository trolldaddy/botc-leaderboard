import argparse
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from gstone_wiki import HEADERS, to_traditional
from knowledge_models import KnowledgeBlock, KnowledgeNode, KnowledgeSourceRecord

TARGET_SLUGS = ["酒鬼", "小惡魔", "洗腦師"]
SECTION_MAP = {
    "背景故事": ("background", "背景故事", 100),
    "角色能力": ("ability", "角色能力", 200),
    "能力": ("ability", "角色能力", 200),
    "運作方式": ("rules", "運作方式", 300),
    "規則": ("rules", "規則說明", 300),
    "規則說明": ("rules", "規則說明", 300),
    "提示標記": ("reminders", "提示標記", 400),
    "相剋規則": ("jinx", "相剋規則", 500),
    "角色互動": ("interactions", "角色互動", 550),
    "範例": ("examples", "範例", 600),
    "策略": ("strategy", "策略", 700),
}


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


def normalize_heading(value: str) -> str:
    text = clean_text(to_traditional(value)).replace("[編輯]", "").strip()
    return re.sub(r"[：:]$", "", text)


def extract_structured_sections(html: str) -> tuple[str, list[dict]]:
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one("#mw-content-text") or soup.select_one("main")
    if not root:
        return "", []

    for node in root.select("script, style, noscript, nav, .mw-editsection, .navbox, .toc, table.infobox"):
        node.decompose()

    full_text = clean_text(to_traditional(root.get_text("\n", strip=True)))
    sections = []
    headings = root.find_all(["h2", "h3", "h4"])
    for heading in headings:
        title = normalize_heading(heading.get_text(" ", strip=True))
        mapped = next((value for key, value in SECTION_MAP.items() if key in title), None)
        if not mapped:
            continue

        level = int(heading.name[1])
        pieces = []
        for sibling in heading.next_siblings:
            if isinstance(sibling, Tag) and sibling.name in {"h2", "h3", "h4"}:
                if int(sibling.name[1]) <= level:
                    break
            if isinstance(sibling, Tag):
                text = clean_text(to_traditional(sibling.get_text("\n", strip=True)))
                if text:
                    pieces.append(text)
        content = clean_text("\n\n".join(pieces))
        if content:
            block_type, display_title, sort_order = mapped
            sections.append({
                "block_type": block_type,
                "title": display_title,
                "sort_order": sort_order,
                "content": excerpt(content, 5000),
            })

    deduped = []
    seen = set()
    for section in sections:
        key = (section["block_type"], section["content"][:160])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(section)
    return full_text, deduped


def fetch_source_page(url: str) -> tuple[str, list[dict]]:
    if not url:
        return "", []
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    return extract_structured_sections(response.text)


def upsert_block(db: Session, node_id: int, source_id: int | None, spec: dict) -> str:
    block = db.query(KnowledgeBlock).filter(
        KnowledgeBlock.node_id == node_id,
        KnowledgeBlock.block_type == spec["block_type"],
        KnowledgeBlock.language == "zh-TW",
    ).first()
    if not block:
        block = KnowledgeBlock(node_id=node_id, block_type=spec["block_type"], language="zh-TW")
        db.add(block)
        action = "created"
    else:
        action = "updated"
    block.title = spec["title"]
    block.content_format = "text"
    block.content = spec["content"]
    block.sort_order = spec["sort_order"]
    block.layer = "source"
    block.review_status = "needs_review"
    block.visibility = "public"
    block.current_source_record_id = source_id
    return action


def seed(write: bool) -> dict:
    db: Session = SessionLocal()
    stats = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "fetched": 0,
        "structured_sections": 0,
        "fetch_failed": [],
        "missing": [],
    }
    try:
        for slug in TARGET_SLUGS:
            node = db.query(KnowledgeNode).filter(KnowledgeNode.slug == slug).first()
            if not node:
                stats["missing"].append(slug)
                continue

            source = db.query(KnowledgeSourceRecord).filter(
                KnowledgeSourceRecord.node_id == node.id
            ).order_by(KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc()).first()

            full_text = clean_text((source.normalized_content if source else "") or (source.raw_content if source else ""))
            sections = []
            if source and source.source_url:
                try:
                    fetched_text, sections = fetch_source_page(source.source_url)
                    if fetched_text:
                        full_text = fetched_text
                        source.normalized_content = fetched_text
                        stats["fetched"] += 1
                except Exception as exc:
                    stats["fetch_failed"].append({"slug": slug, "error": str(exc)})

            if not full_text:
                stats["skipped"] += 1
                continue

            if sections:
                stats["structured_sections"] += len(sections)
                for spec in sections:
                    stats[upsert_block(db, node.id, source.id if source else None, spec)] += 1

            reference_spec = {
                "block_type": "source_excerpt",
                "title": "原始來源節錄",
                "content": excerpt(full_text, 1800),
                "sort_order": 900,
            }
            stats[upsert_block(db, node.id, source.id if source else None, reference_spec)] += 1

            if not node.summary:
                preferred = next((s["content"] for s in sections if s["block_type"] in {"ability", "background"}), full_text)
                node.summary = excerpt(preferred, 240)

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
    parser = argparse.ArgumentParser(description="Seed structured public blocks for initial role pages.")
    parser.add_argument("--write", action="store_true", help="Commit changes. Default is dry-run.")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    stats = seed(args.write)
    print({"mode": "write" if args.write else "dry-run", "targets": TARGET_SLUGS, "stats": stats})


if __name__ == "__main__":
    main()

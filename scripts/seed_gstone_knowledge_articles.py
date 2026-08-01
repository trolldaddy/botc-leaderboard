"""Fetch and structure non-role articles from the GStone Clocktower Wiki.

Dry-run is the default. Pass --write to persist changes.
Only source records belonging to the configured GStone source and host are
eligible; no fallback source discovery is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from sqlalchemy import or_
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from gstone_wiki import BASE_URL, HEADERS, to_traditional
from knowledge_models import KnowledgeBlock, KnowledgeNode, KnowledgeSource, KnowledgeSourceRecord

GSTONE_SOURCE_NAME = "GStone Wiki"
GSTONE_HOST = urlparse(BASE_URL).netloc.lower()
ELIGIBLE_NODE_TYPES = {"article", "guide", "mechanic", "script", "jinx", "faq_topic"}
HIDDEN_STATUSES = {"deleted", "archived", "disabled"}


def clean_inline(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_text(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def normalize_heading(value: str) -> str:
    text = clean_inline(to_traditional(value))
    return re.sub(r"\[(?:編輯|编辑)\]\s*$", "", text).strip()


def text_of(node: Tag) -> str:
    return clean_inline(to_traditional(node.get_text(" ", strip=True)))


def render_list(node: Tag, depth: int = 0) -> list[str]:
    ordered = node.name == "ol"
    lines: list[str] = []
    for index, li in enumerate(node.find_all("li", recursive=False), start=1):
        chunks: list[str] = []
        nested: list[Tag] = []
        for child in li.children:
            if isinstance(child, NavigableString):
                value = clean_inline(to_traditional(str(child)))
                if value:
                    chunks.append(value)
            elif isinstance(child, Tag) and child.name in {"ul", "ol"}:
                nested.append(child)
            elif isinstance(child, Tag):
                value = text_of(child)
                if value:
                    chunks.append(value)
        item = clean_inline(" ".join(chunks))
        if item:
            marker = f"{index}. " if ordered else "- "
            lines.append(f"{'  ' * depth}{marker}{item}")
        for child_list in nested:
            lines.extend(render_list(child_list, depth + 1))
    return lines


def render_table(node: Tag) -> list[str]:
    rows: list[list[str]] = []
    for tr in node.find_all("tr"):
        cells = [text_of(cell).replace("|", "｜") for cell in tr.find_all(["th", "td"], recursive=False)]
        if any(cells):
            rows.append(cells)
    if not rows:
        return []
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    return [
        "| " + " | ".join(rows[0]) + " |",
        "| " + " | ".join(["---"] * width) + " |",
        *["| " + " | ".join(row) + " |" for row in rows[1:]],
    ]


def render_node(node: Tag, heading_base: int = 2) -> list[str]:
    if node.name in {"script", "style", "noscript"}:
        return []
    if node.name in {"h3", "h4", "h5", "h6"}:
        title = normalize_heading(node.get_text(" ", strip=True))
        level = max(3, min(6, int(node.name[1])))
        return [f"{'#' * level} {title}"] if title else []
    if node.name == "p":
        value = text_of(node)
        return [value] if value else []
    if node.name in {"ul", "ol"}:
        return render_list(node)
    if node.name == "blockquote":
        value = clean_text(to_traditional(node.get_text("\n", strip=True)))
        return [f"> {line}" for line in value.splitlines() if line.strip()]
    if node.name == "table":
        return render_table(node)
    if node.name == "dl":
        lines: list[str] = []
        term = ""
        for child in node.children:
            if not isinstance(child, Tag):
                continue
            if child.name == "dt":
                term = text_of(child)
            elif child.name == "dd":
                definition = text_of(child)
                if definition:
                    lines.append(f"- {term + '：' if term else ''}{definition}")
        return lines
    if node.name in {"div", "section"}:
        lines: list[str] = []
        for child in node.children:
            if isinstance(child, Tag):
                lines.extend(render_node(child, heading_base))
        return lines
    value = text_of(node)
    return [value] if value else []


def collect_until_heading(start: Tag | None, stop_level: int = 2) -> str:
    lines: list[str] = []
    siblings = start.next_siblings if start else []
    for sibling in siblings:
        if isinstance(sibling, Tag) and re.fullmatch(r"h[1-6]", sibling.name or ""):
            if int(sibling.name[1]) <= stop_level:
                break
        if isinstance(sibling, Tag):
            rendered = render_node(sibling, stop_level)
            if rendered:
                if lines:
                    lines.append("")
                lines.extend(rendered)
    return clean_text("\n".join(lines))


def extract_article_sections(html: str) -> tuple[str, list[dict]]:
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one("#mw-content-text")
    if not root:
        return "", []
    for node in root.select(
        "script, style, noscript, nav, .mw-editsection, .navbox, .toc, table.infobox, "
        ".printfooter, .catlinks, .mw-jump-link, sup.reference"
    ):
        node.decompose()

    blocks: list[dict] = []
    first_h2 = root.find("h2")
    intro_link = None
    intro_nodes = []
    for child in root.children:
        if child is first_h2:
            break
        if isinstance(child, Tag):
            intro_nodes.append(child)
    for child in intro_nodes:
        for anchor in child.select("a[href]"):
            href = urljoin(f"https://{GSTONE_HOST}/", anchor.get("href", ""))
            label = clean_text(anchor.get_text(" ", strip=True))
            if label and is_gstone_url(href):
                intro_link = (label, href)
                break
        if intro_link:
            break
    if intro_link:
        blocks.append({
            "block_type": "article_intro",
            "title": "上層分類",
            "content": f"[knowledge={intro_link[0]}]{intro_link[0]}[/knowledge]",
            "content_format": "structured_text",
            "sort_order": 100,
        })

    for index, heading in enumerate(root.find_all("h2"), start=1):
        title = normalize_heading(heading.get_text(" ", strip=True))
        if not title or title in {"參考資料", "參考文獻", "注釋", "註釋", "外部連結"}:
            continue
        content = collect_until_heading(heading, 2)
        if not content:
            continue
        blocks.append({
            "block_type": f"article_section_{index:03d}",
            "title": title,
            "content": content,
            "content_format": "structured_text",
            "sort_order": 100 + index * 10,
        })

    normalized = clean_text("\n\n".join(
        f"## {block['title']}\n\n{block['content']}" for block in blocks
    ))
    return normalized, blocks


def is_gstone_url(value: str) -> bool:
    parsed = urlparse(value or "")
    return parsed.scheme in {"http", "https"} and parsed.netloc.lower() == GSTONE_HOST


def latest_gstone_record(db: Session, node_id: int, source_id: int):
    return (
        db.query(KnowledgeSourceRecord)
        .filter(
            KnowledgeSourceRecord.node_id == node_id,
            KnowledgeSourceRecord.source_id == source_id,
            KnowledgeSourceRecord.parse_status == "parsed",
        )
        .order_by(KnowledgeSourceRecord.fetched_at.desc(), KnowledgeSourceRecord.id.desc())
        .first()
    )


def seed(write: bool, delay: float = 0.15, limit: int | None = None) -> dict:
    db: Session = SessionLocal()
    stats = Counter()
    failures: list[dict] = []
    try:
        source = db.query(KnowledgeSource).filter(KnowledgeSource.name == GSTONE_SOURCE_NAME).first()
        if not source:
            raise RuntimeError("找不到 GStone Wiki 資料來源，請先執行 GStone Knowledge Graph。")

        query = db.query(KnowledgeNode).filter(
            KnowledgeNode.node_type.in_(ELIGIBLE_NODE_TYPES),
            ~KnowledgeNode.status.in_(HIDDEN_STATUSES),
            or_(
                KnowledgeNode.presentation_type.is_(None),
                KnowledgeNode.presentation_type != "excluded",
            ),
        ).order_by(KnowledgeNode.id)
        nodes = query.limit(limit).all() if limit else query.all()
        stats["nodes_scanned"] = len(nodes)

        session = requests.Session()
        session.headers.update(HEADERS)
        for node in nodes:
            record = latest_gstone_record(db, node.id, source.id)
            if not record or not is_gstone_url(record.source_url):
                stats["missing_gstone_source"] += 1
                continue
            try:
                response = session.get(record.source_url, timeout=30)
                response.raise_for_status()
                normalized, specs = extract_article_sections(response.text)
            except Exception as exc:
                failures.append({"slug": node.slug, "error": str(exc)})
                stats["fetch_failed"] += 1
                continue
            finally:
                if delay:
                    time.sleep(delay)

            if not specs:
                stats["empty_articles"] += 1
                continue
            stats["pages_fetched"] += 1
            stats["sections_found"] += len(specs)
            active_types = {spec["block_type"] for spec in specs}
            for spec in specs:
                block = db.query(KnowledgeBlock).filter(
                    KnowledgeBlock.node_id == node.id,
                    KnowledgeBlock.block_type == spec["block_type"],
                    KnowledgeBlock.language == "zh-TW",
                    KnowledgeBlock.layer == "source",
                ).first()
                if not block:
                    block = KnowledgeBlock(
                        node_id=node.id,
                        block_type=spec["block_type"],
                        language="zh-TW",
                        layer="source",
                    )
                    db.add(block)
                    stats["blocks_created"] += 1
                else:
                    stats["blocks_updated"] += 1
                block.title = spec["title"]
                block.content = spec["content"]
                block.content_format = spec["content_format"]
                block.sort_order = spec["sort_order"]
                block.visibility = "public"
                block.review_status = "needs_review"
                block.current_source_record_id = record.id

            stale = db.query(KnowledgeBlock).filter(
                KnowledgeBlock.node_id == node.id,
                KnowledgeBlock.layer == "source",
                KnowledgeBlock.block_type.like("article_%"),
                ~KnowledgeBlock.block_type.in_(active_types),
            ).all()
            for block in stale:
                if block.visibility != "internal":
                    block.visibility = "internal"
                    stats["blocks_hidden"] += 1

            record.normalized_content = normalized
            record.content_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
            record.parser_version = "gstone-article-sections-v1"
            record.parse_status = "parsed"
            node.summary = clean_inline(specs[0]["content"])[:280]

        if write:
            db.commit()
        else:
            db.rollback()
        return {
            "mode": "write" if write else "preview",
            "source_policy": "gstone_only",
            "stats": dict(stats),
            "failures": failures,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--delay", type=float, default=0.15)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    print(seed(write=args.write, delay=max(0, args.delay), limit=args.limit))


if __name__ == "__main__":
    main()

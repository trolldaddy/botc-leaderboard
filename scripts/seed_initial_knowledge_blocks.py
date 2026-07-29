import argparse
import os
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from gstone_wiki import HEADERS, to_traditional
from knowledge_models import KnowledgeBlock, KnowledgeNode, KnowledgeSourceRecord

TARGET_SLUGS = ["賭徒", "小惡魔", "洗腦師"]
SECTION_MAP = {
    "背景故事": ("background", "背景故事", 100),
    "角色能力": ("ability", "角色能力", 200),
    "能力": ("ability", "角色能力", 200),
    "角色簡介": ("overview", "角色簡介", 250),
    "角色简介": ("overview", "角色簡介", 250),
    "運作方式": ("how_it_works", "運作方式", 300),
    "规则细节": ("rules_detail", "規則細節", 400),
    "規則細節": ("rules_detail", "規則細節", 400),
    "規則": ("rules_detail", "規則", 400),
    "提示標記": ("reminders", "提示標記", 400),
    "相剋規則": ("rules_jinx", "相剋規則", 420),
    "角色互動": ("rules_interactions", "角色互動", 410),
    "範例": ("examples", "範例", 600),
    "提示與技巧": ("strategy_play", "如何遊玩", 700),
    "提示与技巧": ("strategy_play", "如何遊玩", 700),
    "策略": ("strategy_play", "如何遊玩", 700),
    "說書人建議": ("storyteller_advice", "說書人建議", 750),
    "说书人建议": ("storyteller_advice", "說書人建議", 750),
}


def map_section(title: str):
    if title.startswith(("偽裝成", "伪装成")):
        return "strategy_bluff", title, 710
    if title.startswith(("對抗", "对抗")):
        return "strategy_counter", title, 720
    if title in {"角色資訊", "角色信息"}:
        return None
    return next((value for key, value in SECTION_MAP.items() if key == title or key in title), None)

def clean_inline(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clean_text(value: str) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def excerpt(value: str, limit: int = 2400) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit("\n", 1)[0].strip() or text[:limit].strip()
    return f"{clipped}\n\n（來源內容較長，此處先顯示節錄。）"


def normalize_heading(value: str) -> str:
    text = clean_inline(to_traditional(value)).replace("[編輯]", "").strip()
    return re.sub(r"[：:]$", "", text)


def text_of(node: Tag) -> str:
    return clean_inline(to_traditional(node.get_text(" ", strip=True)))


def render_list(node: Tag, depth: int = 0) -> list[str]:
    ordered = node.name == "ol"
    lines: list[str] = []
    counter = 1
    for li in node.find_all("li", recursive=False):
        chunks: list[str] = []
        nested_lists: list[Tag] = []
        for child in li.children:
            if isinstance(child, NavigableString):
                value = clean_inline(to_traditional(str(child)))
                if value:
                    chunks.append(value)
            elif isinstance(child, Tag) and child.name in {"ul", "ol"}:
                nested_lists.append(child)
            elif isinstance(child, Tag):
                value = text_of(child)
                if value:
                    chunks.append(value)
        prefix = f"{counter}. " if ordered else "- "
        indent = "  " * depth
        item_text = clean_inline(" ".join(chunks))
        if item_text:
            lines.append(f"{indent}{prefix}{item_text}")
        for nested in nested_lists:
            lines.extend(render_list(nested, depth + 1))
        counter += 1
    return lines


def render_table(node: Tag) -> list[str]:
    rows = []
    for tr in node.find_all("tr"):
        cells = [text_of(cell) for cell in tr.find_all(["th", "td"], recursive=False)]
        cells = [cell for cell in cells if cell]
        if cells:
            rows.append(cells)
    if not rows:
        return []
    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    output = ["| " + " | ".join(normalized[0]) + " |"]
    output.append("| " + " | ".join(["---"] * width) + " |")
    output.extend("| " + " | ".join(row) + " |" for row in normalized[1:])
    return output


def render_definition_list(node: Tag) -> list[str]:
    output: list[str] = []
    current_term = ""
    for child in node.children:
        if not isinstance(child, Tag):
            continue
        if child.name == "dt":
            current_term = text_of(child)
        elif child.name == "dd":
            definition = text_of(child)
            if current_term and definition:
                output.append(f"- **{current_term}**：{definition}")
            elif definition:
                output.append(f"- {definition}")
    return output


def render_node(node: Tag) -> list[str]:
    if node.name in {"script", "style", "noscript"}:
        return []
    if node.name in {"h3", "h4", "h5"}:
        title = normalize_heading(node.get_text(" ", strip=True))
        return [f"### {title}"] if title else []
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
        return render_definition_list(node)
    if node.name in {"div", "section"}:
        lines: list[str] = []
        for child in node.children:
            if isinstance(child, Tag):
                lines.extend(render_node(child))
        if lines:
            return lines
    value = text_of(node)
    return [value] if value else []


def collect_section_content(heading: Tag) -> str:
    level = int(heading.name[1])
    lines: list[str] = []
    for sibling in heading.next_siblings:
        if isinstance(sibling, Tag) and sibling.name in {"h2", "h3", "h4", "h5"}:
            sibling_level = int(sibling.name[1])
            if sibling_level <= level:
                break
        if isinstance(sibling, Tag):
            rendered = render_node(sibling)
            if rendered:
                if lines and lines[-1] != "":
                    lines.append("")
                lines.extend(rendered)
    return clean_text("\n".join(lines))


def extract_structured_sections(html: str) -> tuple[str, list[dict]]:
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("#mw-content-text .mw-parser-output") or soup.select_one("#mw-content-text") or soup.select_one("main")
    if not root:
        return "", []

    for node in root.select(
        "script, style, noscript, nav, .mw-editsection, .navbox, .toc, table.infobox, "
        ".printfooter, .catlinks, .mw-jump-link, .reference, sup.reference"
    ):
        node.decompose()

    sections: list[dict] = []
    used_types: dict[str, int] = {}
    headings = root.find_all(["h2", "h3"])
    for heading in headings:
        title = normalize_heading(heading.get_text(" ", strip=True))
        mapped = map_section(title)
        if not mapped:
            continue
        content = collect_section_content(heading)
        if not content:
            continue
        base_type, display_title, sort_order = mapped
        occurrence = used_types.get(base_type, 0)
        used_types[base_type] = occurrence + 1
        block_type = base_type if occurrence == 0 else f"{base_type}_{occurrence + 1}"
        sections.append({
            "block_type": block_type,
            "title": display_title if occurrence == 0 else f"{display_title}（續）",
            "sort_order": sort_order + occurrence,
            "content": excerpt(content, 9000),
            "content_format": "structured_text",
        })

    full_lines: list[str] = []
    for section in sections:
        full_lines.append(f"## {section['title']}")
        full_lines.append(section["content"])
    full_text = clean_text("\n\n".join(full_lines))
    return full_text, sections


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
    block.content_format = spec.get("content_format", "structured_text")
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
        "hidden_old_blocks": 0,
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

            full_text = ""
            sections: list[dict] = []
            if source and source.source_url:
                try:
                    full_text, sections = fetch_source_page(source.source_url)
                    if full_text:
                        source.normalized_content = full_text
                        stats["fetched"] += 1
                except Exception as exc:
                    stats["fetch_failed"].append({"slug": slug, "error": str(exc)})

            if not sections:
                stats["skipped"] += 1
                continue

            stats["structured_sections"] += len(sections)
            active_types = {spec["block_type"] for spec in sections}
            for spec in sections:
                stats[upsert_block(db, node.id, source.id if source else None, spec)] += 1

            old_blocks = db.query(KnowledgeBlock).filter(
                KnowledgeBlock.node_id == node.id,
                KnowledgeBlock.language == "zh-TW",
                KnowledgeBlock.layer == "source",
                ~KnowledgeBlock.block_type.in_(active_types),
            ).all()
            for old in old_blocks:
                if old.visibility != "internal":
                    old.visibility = "internal"
                    stats["hidden_old_blocks"] += 1

            preferred = next(
                (spec["content"] for spec in sections if spec["block_type"] in {"ability", "overview"}),
                sections[0]["content"],
            )
            node.summary = excerpt(preferred, 280)

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
    parser = argparse.ArgumentParser(description="Seed DOM-structured public blocks for initial role pages.")
    parser.add_argument("--write", action="store_true", help="Commit changes. Default is dry-run.")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    stats = seed(args.write)
    print({"mode": "write" if args.write else "dry-run", "targets": TARGET_SLUGS, "stats": stats})


if __name__ == "__main__":
    main()

"""Import a GStone crawl report into Knowledge Schema v1.

Dry-run is the default. Pass --write to commit records.
This importer deliberately marks every imported item as needs_review/internal.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlparse

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import models  # noqa: F401  registers all SQLAlchemy models
from database import Base, SessionLocal, engine
from gstone_wiki import BASE_URL, is_excluded_knowledge_title, to_traditional
from knowledge_models import (
    CrawlLink,
    CrawlPage,
    CrawlRun,
    KnowledgeAlias,
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeSource,
    KnowledgeSourceRecord,
)

TYPE_MAP = {
    "role": "role",
    "script": "script",
    "rule_or_mechanic": "mechanic",
    "jinx": "jinx",
    "faq": "faq_topic",
    "guide": "guide",
    "category": "keyword",
    "article": "article",
    "stub_or_navigation": "article",
    "unknown": "article",
}
ROLE_GROUP_TITLES = {
    "\u93ae\u6c11", "\u9547\u6c11", "\u5916\u4f86\u8005", "\u5916\u6765\u8005", "\u722a\u7259",
    "\u60e1\u9b54", "\u6076\u9b54", "\u65c5\u884c\u8005", "\u50b3\u5947\u89d2\u8272", "\u4f20\u5947\u89d2\u8272",
    "\u5947\u9047\u89d2\u8272", "\u5be6\u9a57\u6027\u89d2\u8272", "\u5b9e\u9a8c\u6027\u89d2\u8272",
}
GSTONE_HOST = urlparse(BASE_URL).netloc.lower()


def is_gstone_url(value: str) -> bool:
    parsed = urlparse((value or "").strip())
    return parsed.scheme in {"http", "https"} and parsed.netloc.lower() == GSTONE_HOST


def validate_report_source(report: dict) -> None:
    """Reject crawl input that could silently import a fallback wiki."""
    meta_url = str((report.get("meta") or {}).get("base_url") or "").strip()
    if meta_url and not is_gstone_url(meta_url):
        raise ValueError("Only GStone Clocktower Wiki crawl reports can be imported")
    for page in report.get("pages") or []:
        for key in ("requested_url", "final_url"):
            value = str(page.get(key) or "").strip()
            if value and not is_gstone_url(value):
                raise ValueError(f"Non-GStone source URL is not allowed: {value}")

def page_fetch_failed(page: dict) -> bool:
    status = int(page.get("status") or 0)
    return bool(page.get("error")) or status < 200 or status >= 400








def slugify(title: str) -> str:
    value = to_traditional(title or "").strip().lower()
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"[^0-9a-z\u4e00-\u9fff-]+", "", value)
    return value.strip("-") or "untitled"


def unique_slug(db, base: str) -> str:
    existing = db.query(KnowledgeNode).filter(KnowledgeNode.slug == base).first()
    if not existing:
        return base
    suffix = 2
    while db.query(KnowledgeNode).filter(KnowledgeNode.slug == f"{base}-{suffix}").first():
        suffix += 1
    return f"{base}-{suffix}"


def find_existing_node(db, title: str, title_tw: str):
    """Find an imported node before creating a new page or edge placeholder."""
    base_slug = slugify(title_tw)
    return db.query(KnowledgeNode).filter(
        (KnowledgeNode.canonical_name_zh_tw == title_tw)
        | (KnowledgeNode.canonical_name_zh_cn == title)
        | (KnowledgeNode.slug == base_slug)
    ).first()


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def get_or_create_source(db):
    source = db.query(KnowledgeSource).filter(KnowledgeSource.name == "GStone Wiki").first()
    if not source:
        source = KnowledgeSource(
            source_type="wiki",
            name="GStone Wiki",
            base_url=BASE_URL,
            publisher="GStone Games",
            license_status="unknown",
            trust_level="official_partner",
            default_language="zh-CN",
            is_official=True,
        )
        db.add(source)
        db.flush()
    return source


def load_report(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        report = json.load(handle)
    if not isinstance(report.get("pages"), list) or not isinstance(report.get("edges"), list):
        raise ValueError("Report must contain pages[] and edges[]")
    validate_report_source(report)
    return report


def import_report(report: dict, write: bool):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    stats = Counter()
    try:
        source = get_or_create_source(db)
        summary = report.get("summary") or {}
        run = CrawlRun(
            source_id=source.id,
            started_at=parse_dt(report.get("started_at")),
            finished_at=parse_dt(report.get("finished_at")),
            status="completed",
            parser_version=str(report.get("parser_version") or "gstone-crawler-v1"),
            pages_fetched=int(summary.get("pages_fetched") or len(report["pages"])),
            successful_pages=int(summary.get("successful_pages") or 0),
            failed_pages=int(summary.get("failed_pages") or 0),
            report_json=json.dumps(summary, ensure_ascii=False),
        )
        db.add(run)
        db.flush()

        nodes_by_title = {}
        crawl_pages_by_title = {}
        for page in report["pages"]:
            title = (page.get("resolved_title") or page.get("title") or "").strip()
            if not title:
                stats["pages_skipped"] += 1
                continue
            if is_excluded_knowledge_title(title):
                stats["pages_excluded"] += 1
                continue
            if page_fetch_failed(page):
                crawl_page = CrawlPage(
                    crawl_run_id=run.id,
                    url=page.get("final_url") or page.get("requested_url") or "",
                    requested_title=page.get("title"),
                    resolved_title=title,
                    http_status=int(page.get("status") or 0),
                    page_type_detected=page.get("page_type") or "unknown",
                    classification_reasons=json.dumps(
                        page.get("classification_reasons") or [], ensure_ascii=False
                    ),
                    content_hash=page.get("content_hash") or None,
                    parse_status="failed",
                    error_message=page.get("error") or None,
                    elapsed_ms=int(page.get("elapsed_ms") or 0),
                )
                db.add(crawl_page)
                db.flush()
                crawl_pages_by_title[title] = crawl_page
                stats["crawl_pages_created"] += 1
                stats["failed_pages_skipped"] += 1
                continue

            title_tw = to_traditional(title)
            node_type = TYPE_MAP.get(page.get("page_type"), "article")
            if title_tw in {to_traditional(value) for value in ROLE_GROUP_TITLES}:
                node_type = "article"
            node = find_existing_node(db, title, title_tw)
            if not node:
                node = KnowledgeNode(
                    node_type=node_type,
                    slug=unique_slug(db, slugify(title_tw)),
                    canonical_name_zh_tw=title_tw,
                    canonical_name_zh_cn=title,
                    status="discovered",
                    visibility="internal",
                    is_official=True,
                )
                db.add(node)
                db.flush()
                stats["nodes_created"] += 1
            else:
                stats["nodes_reused"] += 1
            nodes_by_title[title] = node
            nodes_by_title[title_tw] = node

            for alias_text, language, preferred in ((title_tw, "zh-TW", True), (title, "zh-CN", False)):
                alias = db.query(KnowledgeAlias).filter(
                    KnowledgeAlias.node_id == node.id,
                    KnowledgeAlias.alias == alias_text,
                    KnowledgeAlias.language == language,
                ).first()
                if not alias:
                    db.add(KnowledgeAlias(
                        node_id=node.id,
                        alias=alias_text,
                        language=language,
                        alias_type="source",
                        is_preferred=preferred,
                        source_id=source.id,
                    ))
                    stats["aliases_created"] += 1

            crawl_page = CrawlPage(
                crawl_run_id=run.id,
                url=page.get("final_url") or page.get("requested_url") or "",
                requested_title=page.get("title"),
                resolved_title=title,
                http_status=int(page.get("status") or 0),
                page_type_detected=page.get("page_type") or "unknown",
                classification_reasons=json.dumps(page.get("classification_reasons") or [], ensure_ascii=False),
                content_hash=page.get("content_hash") or None,
                parse_status="parsed",
                error_message=None,
                elapsed_ms=int(page.get("elapsed_ms") or 0),
            )
            db.add(crawl_page)
            db.flush()
            crawl_pages_by_title[title] = crawl_page
            stats["crawl_pages_created"] += 1

            source_url = page.get("final_url") or page.get("requested_url") or f"{BASE_URL}/index.php?title={quote(title)}"
            db.add(KnowledgeSourceRecord(
                source_id=source.id,
                node_id=node.id,
                source_url=source_url,
                source_title=title,
                source_language="zh-CN",
                content_hash=page.get("content_hash") or None,
                fetched_at=datetime.now(),
                parser_version=str(report.get("parser_version") or "gstone-crawler-v1"),
                parse_status="failed" if page.get("error") else "parsed",
                review_status="needs_review",
            ))
            stats["source_records_created"] += 1

        # Create placeholders for linked titles not reached by the crawler, then import links.
        for edge in report["edges"]:
            source_title = (edge.get("source") or "").strip()
            target_title = (edge.get("target") or "").strip()
            if not source_title or not target_title:
                stats["edges_skipped"] += 1
                continue
            if is_excluded_knowledge_title(source_title):
                stats["edges_excluded"] += 1
                continue
            from_node = nodes_by_title.get(source_title) or nodes_by_title.get(to_traditional(source_title))
            if not from_node:
                stats["edges_skipped"] += 1
                continue
            target_tw = to_traditional(target_title)
            to_node = nodes_by_title.get(target_title) or nodes_by_title.get(target_tw)
            if not to_node:
                to_node = find_existing_node(db, target_title, target_tw)
                if to_node:
                    nodes_by_title[target_title] = to_node
                    nodes_by_title[target_tw] = to_node
                    stats["placeholder_nodes_reused"] += 1
            if not to_node:
                to_node = KnowledgeNode(
                    node_type="article",
                    slug=unique_slug(db, slugify(target_tw)),
                    canonical_name_zh_tw=target_tw,
                    canonical_name_zh_cn=target_title,
                    status="discovered",
                    visibility="internal",
                    is_official=True,
                )
                db.add(to_node)
                db.flush()
                nodes_by_title[target_title] = to_node
                nodes_by_title[target_tw] = to_node
                stats["placeholder_nodes_created"] += 1

            graph_edge = db.query(KnowledgeEdge).filter(
                KnowledgeEdge.from_node_id == from_node.id,
                KnowledgeEdge.to_node_id == to_node.id,
                KnowledgeEdge.edge_type == "references",
                KnowledgeEdge.source_id == source.id,
            ).first()
            if not graph_edge:
                db.add(KnowledgeEdge(
                    from_node_id=from_node.id,
                    to_node_id=to_node.id,
                    edge_type="references",
                    direction="directed",
                    source_id=source.id,
                    confidence=0.45,
                    review_status="needs_review",
                ))
                stats["knowledge_edges_created"] += 1

            crawl_page = crawl_pages_by_title.get(source_title)
            if crawl_page:
                duplicate = db.query(CrawlLink).filter(
                    CrawlLink.crawl_page_id == crawl_page.id,
                    CrawlLink.target_title == target_title,
                ).first()
                if not duplicate:
                    db.add(CrawlLink(
                        crawl_page_id=crawl_page.id,
                        target_title=target_title,
                        target_url=f"{BASE_URL}/index.php?title={quote(target_title)}",
                    ))
                    stats["crawl_links_created"] += 1

        if write:
            db.commit()
        else:
            db.rollback()
        return dict(stats), run.id if write else None
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Import GStone crawl report into Knowledge Schema v1")
    parser.add_argument("report", type=Path, help="Path to gstone-crawl.json")
    parser.add_argument("--write", action="store_true", help="Commit changes; default is dry-run")
    args = parser.parse_args()

    report = load_report(args.report)
    stats, run_id = import_report(report, args.write)
    print(json.dumps({
        "mode": "write" if args.write else "dry-run",
        "crawl_run_id": run_id,
        "stats": stats,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

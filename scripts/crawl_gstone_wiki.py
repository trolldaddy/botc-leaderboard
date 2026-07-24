"""Crawl the public GStone Clocktower Wiki and generate a coverage report.

This script is intentionally read-only. It does not write to the application
DB. It discovers article pages, classifies their rough page type, records link
edges, and optionally runs the existing reminder parser on role-like pages.

Examples:
    python3 scripts/crawl_gstone_wiki.py
    python3 scripts/crawl_gstone_wiki.py --max-pages 500 --delay 0.8
    python3 scripts/crawl_gstone_wiki.py --seed "角色" --output reports/gstone-crawl.json

The default output is reports/gstone-crawl-YYYYMMDD-HHMMSS.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from collections import Counter, deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from gstone_wiki import BASE_URL, HEADERS, article_url, parse_reminders, to_traditional

DEFAULT_SEEDS = ["首頁", "角色", "剧本", "規則", "规则", "相克規則", "相克规则"]
ARTICLE_PATH = "/index.php"
SKIP_NAMESPACES = {
    "特殊", "Special", "討論", "Talk", "使用者", "User", "使用者討論", "User_talk",
    "檔案", "文件", "File", "Media", "MediaWiki", "模板", "Template", "模板討論",
    "Template_talk", "說明", "Help", "分類討論", "Category_talk",
}


@dataclass
class CrawlPage:
    requested_url: str
    final_url: str = ""
    title: str = ""
    resolved_title: str = ""
    status: int = 0
    page_type: str = "unknown"
    categories: list[str] = field(default_factory=list)
    headings: list[str] = field(default_factory=list)
    outgoing_titles: list[str] = field(default_factory=list)
    reminder_found: bool = False
    reminder_count: int = 0
    reminder_classification: str = "not_checked"
    content_hash: str = ""
    error: str = ""
    elapsed_ms: int = 0


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_title(value: str) -> str:
    return clean(unquote(value)).replace("_", " ")


def extract_article_title(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != urlparse(BASE_URL).netloc:
        return None
    if parsed.path == ARTICLE_PATH:
        title = parse_qs(parsed.query).get("title", [""])[0]
    elif parsed.path.startswith("/wiki/"):
        title = parsed.path[len("/wiki/"):]
    else:
        return None
    title = normalize_title(title)
    if not title or title.startswith("#"):
        return None
    namespace = title.split(":", 1)[0]
    if ":" in title and namespace in SKIP_NAMESPACES:
        return None
    return title


def canonical_article_url(title: str) -> str:
    return article_url(normalize_title(title))


def visible_content(soup: BeautifulSoup) -> Tag | BeautifulSoup:
    return soup.select_one("#mw-content-text") or soup.select_one("main") or soup.body or soup


def extract_categories(soup: BeautifulSoup) -> list[str]:
    values: list[str] = []
    for link in soup.select("#mw-normal-catlinks a, .mw-normal-catlinks a"):
        text = to_traditional(link.get_text(" ", strip=True))
        if text and text not in {"分類", "Category"} and text not in values:
            values.append(text)
    return values


def extract_headings(soup: BeautifulSoup) -> list[str]:
    values: list[str] = []
    for heading in visible_content(soup).find_all(["h1", "h2", "h3", "h4"]):
        text = to_traditional(heading.get_text(" ", strip=True)).replace("[編輯]", "").strip()
        if text and text not in values:
            values.append(text)
    return values


def extract_outgoing_titles(soup: BeautifulSoup, current_title: str) -> list[str]:
    values: list[str] = []
    content = visible_content(soup)
    for link in content.find_all("a", href=True):
        absolute = urljoin(BASE_URL, link["href"])
        title = extract_article_title(absolute)
        if not title or title == current_title or title in values:
            continue
        values.append(title)
    return values


def classify_page(title: str, categories: Iterable[str], headings: Iterable[str], soup: BeautifulSoup) -> str:
    title_t = to_traditional(title)
    category_text = " ".join(to_traditional(item) for item in categories)
    heading_text = " ".join(to_traditional(item) for item in headings)
    haystack = f"{title_t} {category_text} {heading_text}"

    if title_t.startswith("分類:"):
        return "category"
    if any(word in haystack for word in ("鎮民", "外來者", "爪牙", "惡魔", "旅行者")):
        role_markers = {"角色能力", "提示標記", "運作方式", "角色簡介", "背景故事"}
        if any(marker in heading_text for marker in role_markers):
            return "role"
    if any(word in haystack for word in ("劇本", "暗流湧動", "黯月初升", "紫羅蘭教派")):
        if any(word in heading_text for word in ("角色列表", "劇本資訊", "配置")):
            return "script"
    if any(word in haystack for word in ("相剋", "相克", "Jinx")):
        return "jinx"
    if any(word in haystack for word in ("常見問題", "FAQ", "問答")):
        return "faq"
    if any(word in haystack for word in ("規則", "规则", "提名", "處決", "死亡", "中毒", "醉酒")):
        return "rule_or_mechanic"
    if any(word in haystack for word in ("說書人", "主持人", "指南", "教學")):
        return "guide"

    content = clean(visible_content(soup).get_text(" ", strip=True))
    if len(content) < 80:
        return "stub_or_navigation"
    return "article"


def classify_reminders(parsed: dict[str, Any]) -> str:
    if not parsed.get("found"):
        return "missing_section"
    reminders = parsed.get("reminders") or []
    if not reminders:
        return "no_reminders"
    if len(reminders) > 1:
        return "multiple_reminders"
    item = reminders[0]
    required = ("placement_timing", "placement_condition", "removal_timing")
    if all(item.get(key) for key in required):
        return "single_complete"
    if item.get("special_notes"):
        return "single_with_special_notes"
    return "single_partial"


def fetch_page(session: requests.Session, url: str, timeout: float) -> tuple[requests.Response, int]:
    started = time.perf_counter()
    response = session.get(url, timeout=timeout, allow_redirects=True)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    return response, elapsed_ms


def crawl(args: argparse.Namespace) -> dict[str, Any]:
    session = requests.Session()
    session.headers.update(HEADERS)

    seeds = args.seed or DEFAULT_SEEDS
    queue: deque[str] = deque(normalize_title(seed) for seed in seeds)
    queued = set(queue)
    visited: set[str] = set()
    pages: list[CrawlPage] = []
    edges: list[dict[str, str]] = []

    while queue and len(pages) < args.max_pages:
        requested_title = queue.popleft()
        queued.discard(requested_title)
        if requested_title in visited:
            continue
        visited.add(requested_title)

        requested_url = canonical_article_url(requested_title)
        page = CrawlPage(requested_url=requested_url, title=requested_title)
        try:
            response, page.elapsed_ms = fetch_page(session, requested_url, args.timeout)
            page.status = response.status_code
            page.final_url = response.url
            page.resolved_title = extract_article_title(response.url) or requested_title
            if response.status_code >= 400:
                page.error = f"HTTP {response.status_code}"
                pages.append(page)
                if args.delay:
                    time.sleep(args.delay)
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            page.categories = extract_categories(soup)
            page.headings = extract_headings(soup)
            page.outgoing_titles = extract_outgoing_titles(soup, page.resolved_title)
            page.page_type = classify_page(page.resolved_title, page.categories, page.headings, soup)
            page.content_hash = hashlib.sha256(response.content).hexdigest()

            if page.page_type == "role" or args.parse_reminders_all:
                reminder_data = parse_reminders(response.text)
                page.reminder_found = bool(reminder_data.get("found"))
                page.reminder_count = len(reminder_data.get("reminders") or [])
                page.reminder_classification = classify_reminders(reminder_data)

            for target in page.outgoing_titles:
                edges.append({"source": page.resolved_title, "target": target})
                if target not in visited and target not in queued:
                    queue.append(target)
                    queued.add(target)

        except Exception as exc:
            page.error = f"{type(exc).__name__}: {exc}"
        pages.append(page)

        if args.progress_every and len(pages) % args.progress_every == 0:
            print(f"[crawl] pages={len(pages)} queue={len(queue)} errors={sum(bool(p.error) for p in pages)}", file=sys.stderr)
        if args.delay:
            time.sleep(args.delay)

    type_counts = Counter(page.page_type for page in pages)
    status_counts = Counter(str(page.status) for page in pages)
    reminder_counts = Counter(page.reminder_classification for page in pages if page.reminder_classification != "not_checked")
    category_counts = Counter(category for page in pages for category in page.categories)

    inbound = Counter(edge["target"] for edge in edges)
    outbound = Counter(edge["source"] for edge in edges)
    resolved_titles = {page.resolved_title for page in pages if page.resolved_title}
    isolated = sorted(title for title in resolved_titles if not inbound[title] and not outbound[title])

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "base_url": BASE_URL,
            "seeds": seeds,
            "max_pages": args.max_pages,
            "delay_seconds": args.delay,
            "timeout_seconds": args.timeout,
            "stopped_because": "max_pages" if queue and len(pages) >= args.max_pages else "queue_exhausted",
            "remaining_queue": len(queue),
        },
        "summary": {
            "pages_fetched": len(pages),
            "successful_pages": sum(1 for page in pages if 200 <= page.status < 400 and not page.error),
            "failed_pages": sum(1 for page in pages if page.error),
            "unique_edges": len({(edge["source"], edge["target"]) for edge in edges}),
            "page_types": dict(type_counts.most_common()),
            "http_statuses": dict(status_counts.most_common()),
            "reminder_coverage": dict(reminder_counts.most_common()),
            "top_categories": dict(category_counts.most_common(50)),
            "isolated_pages": len(isolated),
        },
        "isolated_titles": isolated,
        "failed": [asdict(page) for page in pages if page.error],
        "pages": [asdict(page) for page in pages],
        "edges": list({(edge["source"], edge["target"]): edge for edge in edges}.values()),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", action="append", help="Wiki article title to use as a seed. Repeatable.")
    parser.add_argument("--max-pages", type=int, default=5000, help="Safety cap for fetched pages.")
    parser.add_argument("--delay", type=float, default=0.7, help="Delay between requests in seconds.")
    parser.add_argument("--timeout", type=float, default=25.0, help="Per-request timeout in seconds.")
    parser.add_argument("--progress-every", type=int, default=25, help="Print progress every N pages; 0 disables.")
    parser.add_argument("--parse-reminders-all", action="store_true", help="Run reminder parser on every page.")
    parser.add_argument("--output", type=Path, help="JSON report path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.max_pages < 1:
        raise SystemExit("--max-pages must be at least 1")
    if args.delay < 0:
        raise SystemExit("--delay cannot be negative")

    report = crawl(args)
    output = args.output or Path("reports") / f"gstone-crawl-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    print(f"\nFull report: {output}")
    return 1 if report["summary"]["failed_pages"] and report["summary"]["successful_pages"] == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())

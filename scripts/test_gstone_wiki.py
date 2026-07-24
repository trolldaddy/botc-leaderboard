"""Read-only parser prototype for the official GStone Clocktower Wiki.

Usage:
    python3 scripts/test_gstone_wiki.py "魔鬼代言人"

The normal article HTML is intentionally used first because the site's
MediaWiki parse API may return a shell/error document even when the public
article page is available. Nothing is written to the database.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any, Iterable

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

BASE_URL = "https://clocktower-wiki.gstonegames.com"
ARTICLE_URL = f"{BASE_URL}/index.php"
HEADERS = {
    "User-Agent": "Larplus-Knowledge-Base/0.2 (+official GStone wiki sync prototype)",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
}
SECTION_NAMES = {"提示标记", "提示標記"}
FIELD_PREFIXES = {
    "放置时机": "placement_timing",
    "放置時機": "placement_timing",
    "放置条件": "placement_condition",
    "放置條件": "placement_condition",
    "移除时机": "removal_timing",
    "移除時機": "removal_timing",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fetch_article_html(title: str) -> tuple[str, str, int]:
    response = requests.get(
        ARTICLE_URL,
        params={"title": title},
        headers=HEADERS,
        timeout=25,
    )
    response.raise_for_status()
    return response.text, response.url, response.status_code


def heading_level(tag: Tag) -> int:
    return int(tag.name[1]) if tag.name and re.fullmatch(r"h[1-6]", tag.name) else 99


def heading_text(tag: Tag) -> str:
    # MediaWiki headings often contain edit links and mw-headline spans.
    headline = tag.select_one(".mw-headline")
    return clean_text((headline or tag).get_text(" ", strip=True))


def find_section_heading(soup: BeautifulSoup) -> Tag | None:
    for candidate in soup.find_all(re.compile(r"^h[1-6]$")):
        text = heading_text(candidate)
        normalized = re.sub(r"\[编辑\]|\[編輯\]", "", text).strip()
        if normalized in SECTION_NAMES:
            return candidate
    return None


def section_nodes(heading: Tag) -> list[Tag]:
    level = heading_level(heading)
    nodes: list[Tag] = []
    for sibling in heading.next_siblings:
        if isinstance(sibling, Tag):
            if re.fullmatch(r"h[1-6]", sibling.name or "") and heading_level(sibling) <= level:
                break
            nodes.append(sibling)
    return nodes


def split_field(text: str) -> tuple[str | None, str]:
    normalized = clean_text(text).replace("：", ":")
    for prefix, field in FIELD_PREFIXES.items():
        prefix_ascii = prefix.replace("：", ":")
        if normalized.startswith(prefix_ascii + ":"):
            return field, clean_text(normalized[len(prefix_ascii) + 1 :])
    return None, normalized


def new_reminder(label: str) -> dict[str, str]:
    return {
        "label": clean_text(label),
        "placement_timing": "",
        "placement_condition": "",
        "removal_timing": "",
        "special_notes": "",
    }


def iter_meaningful_blocks(nodes: Iterable[Tag]) -> Iterable[Tag]:
    for node in nodes:
        # Tables are common on this wiki, so preserve rows as parseable blocks.
        if node.name == "table":
            for row in node.find_all("tr"):
                yield row
        elif node.name in {"ul", "ol"}:
            for item in node.find_all("li", recursive=False):
                yield item
        else:
            yield node


def parse_table_row(row: Tag) -> tuple[str | None, str]:
    cells = row.find_all(["th", "td"], recursive=False)
    if len(cells) < 2:
        return None, clean_text(row.get_text(" ", strip=True))
    key = clean_text(cells[0].get_text(" ", strip=True)).rstrip("：:")
    value = clean_text(" ".join(cell.get_text(" ", strip=True) for cell in cells[1:]))
    return FIELD_PREFIXES.get(key), value


def extract_reminder_section(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    heading = find_section_heading(soup)
    if not heading:
        page_title = clean_text((soup.select_one("#firstHeading") or soup.title or "").get_text(" ", strip=True))
        return {
            "found": False,
            "page_title": page_title,
            "reminders": [],
            "raw_text": "",
            "diagnostic": "文章可讀取，但找不到提示標記章節。",
        }

    nodes = section_nodes(heading)
    raw_text = clean_text(" ".join(node.get_text(" ", strip=True) for node in nodes))
    if raw_text in {"无", "無", "暂无", "暫無"}:
        return {"found": True, "reminders": [], "raw_text": raw_text, "diagnostic": "此角色沒有提示標記。"}

    reminders: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for block in iter_meaningful_blocks(nodes):
        text = clean_text(block.get_text(" ", strip=True))
        if not text:
            continue

        field: str | None = None
        value = text
        if block.name == "tr":
            field, value = parse_table_row(block)
        if field is None:
            field, value = split_field(text)

        if field:
            if current is None:
                current = new_reminder("未命名標記")
                reminders.append(current)
            current[field] = clean_text(value)
            continue

        # A standalone short block before field rows is normally the token label.
        is_probable_label = (
            len(text) <= 30
            and not any(prefix in text for prefix in FIELD_PREFIXES)
            and not text.endswith(("。", ".", "；", ";"))
        )
        if is_probable_label:
            current = new_reminder(text)
            reminders.append(current)
            continue

        if current is None:
            current = new_reminder("未命名標記")
            reminders.append(current)
        current["special_notes"] = clean_text(" ".join(filter(None, [current["special_notes"], text])))

    # Remove accidental empty records and exact duplicates while preserving order.
    cleaned: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for reminder in reminders:
        key = tuple(reminder[field] for field in ("label", "placement_timing", "placement_condition", "removal_timing", "special_notes"))
        if not any(key) or key in seen:
            continue
        seen.add(key)
        cleaned.append(reminder)

    return {
        "found": True,
        "reminders": cleaned,
        "raw_text": raw_text,
        "diagnostic": f"找到提示標記章節，解析出 {len(cleaned)} 筆。",
    }


def main() -> int:
    title = sys.argv[1] if len(sys.argv) > 1 else "魔鬼代言人"
    try:
        html, fetched_from, status_code = fetch_article_html(title)
        result = extract_reminder_section(html)
        output = {
            "title": title,
            "source": "GStone 官方鐘樓百科",
            "fetch_method": "article_html",
            "http_status": status_code,
            "html_length": len(html),
            "fetched_from": fetched_from,
            **result,
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0 if result["found"] else 2
    except Exception as exc:
        print(json.dumps({
            "title": title,
            "source": "GStone 官方鐘樓百科",
            "found": False,
            "error": f"{type(exc).__name__}: {exc}",
        }, ensure_ascii=False, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

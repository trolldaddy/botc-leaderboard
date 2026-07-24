"""Prototype parser for the official GStone Clocktower Wiki.

Usage:
    python scripts/test_gstone_wiki.py 魔鬼代言人

This script is deliberately read-only. It tests the MediaWiki API first and
falls back to the normal article URL. Nothing is written to the database.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://clocktower-wiki.gstonegames.com"
API_URL = f"{BASE_URL}/api.php"
HEADERS = {
    "User-Agent": "Larplus-Knowledge-Base/0.1 (+official GStone wiki sync prototype)",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def fetch_article_html(title: str) -> tuple[str, str]:
    params = {
        "action": "parse",
        "page": title,
        "prop": "text|displaytitle",
        "format": "json",
        "formatversion": "2",
        "redirects": "1",
        "origin": "*",
    }
    try:
        response = requests.get(API_URL, params=params, headers=HEADERS, timeout=25)
        response.raise_for_status()
        payload = response.json()
        if payload.get("error"):
            raise RuntimeError(payload["error"].get("info") or str(payload["error"]))
        parsed = payload.get("parse") or {}
        html = parsed.get("text") or ""
        if html:
            return html, response.url
    except Exception as api_error:
        article_url = f"{BASE_URL}/index.php?title={quote(title)}"
        response = requests.get(article_url, headers=HEADERS, timeout=25)
        try:
            response.raise_for_status()
        except Exception as html_error:
            raise RuntimeError(
                f"MediaWiki API 與文章 HTML 均無法讀取。API={api_error}; HTML={html_error}"
            ) from html_error
        return response.text, article_url


def nearest_heading_text(node: Tag) -> str:
    heading = node.find_previous(["h2", "h3", "h4"])
    return clean_text(heading.get_text(" ", strip=True)) if heading else ""


def extract_reminder_section(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    heading = None
    for candidate in soup.find_all(["h2", "h3", "h4"]):
        text = clean_text(candidate.get_text(" ", strip=True))
        if text in {"提示标记", "提示標記"}:
            heading = candidate
            break
    if not heading:
        return {"found": False, "reminders": [], "raw_text": ""}

    section_nodes: list[Tag] = []
    for sibling in heading.next_siblings:
        if isinstance(sibling, Tag) and sibling.name in {"h2", "h3", "h4"}:
            break
        if isinstance(sibling, Tag):
            section_nodes.append(sibling)

    raw_text = clean_text(" ".join(node.get_text(" ", strip=True) for node in section_nodes))
    if raw_text in {"无", "無"}:
        return {"found": True, "reminders": [], "raw_text": raw_text}

    reminders: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for node in section_nodes:
        if node.name in {"ul", "ol"}:
            for li in node.find_all("li", recursive=False):
                label = clean_text(li.get_text(" ", strip=True))
                if label and not label.startswith(("放置时机", "放置時機", "放置条件", "放置條件", "移除时机", "移除時機")):
                    current = {
                        "label": label,
                        "placement_timing": "",
                        "placement_condition": "",
                        "removal_timing": "",
                        "special_notes": "",
                    }
                    reminders.append(current)
            continue

        text = clean_text(node.get_text(" ", strip=True))
        if not text:
            continue
        if current is None:
            current = {
                "label": "未命名標記",
                "placement_timing": "",
                "placement_condition": "",
                "removal_timing": "",
                "special_notes": "",
            }
            reminders.append(current)

        field_patterns = [
            (("放置时机：", "放置時機："), "placement_timing"),
            (("放置条件：", "放置條件："), "placement_condition"),
            (("移除时机：", "移除時機："), "removal_timing"),
        ]
        matched = False
        for prefixes, field in field_patterns:
            for prefix in prefixes:
                if text.startswith(prefix):
                    current[field] = clean_text(text[len(prefix):])
                    matched = True
                    break
            if matched:
                break
        if not matched:
            current["special_notes"] = clean_text(
                " ".join(part for part in [current["special_notes"], text] if part)
            )

    return {"found": True, "reminders": reminders, "raw_text": raw_text}


def main() -> int:
    title = sys.argv[1] if len(sys.argv) > 1 else "魔鬼代言人"
    html, fetched_from = fetch_article_html(title)
    result = extract_reminder_section(html)
    output = {
        "title": title,
        "source": "GStone 官方鐘樓百科",
        "fetched_from": fetched_from,
        **result,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if result["found"] else 2


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import re
from typing import Any, Dict, List
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup, Tag
from opencc import OpenCC

BASE_URL = "https://clocktower-wiki.gstonegames.com"
HEADERS = {
    "User-Agent": "Larplus-Knowledge-Base/1.0 (+official GStone wiki sync)",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
}


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def to_traditional(value: Any) -> str:
    return OpenCC("s2twp").convert(clean_text(value))


def article_url(title: str) -> str:
    return f"{BASE_URL}/index.php?title={quote(clean_text(title))}"


def fetch_article(title: str) -> Dict[str, Any]:
    url = article_url(title)
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    return {
        "title": clean_text(title),
        "url": response.url,
        "status": response.status_code,
        "html": response.text,
    }


def _section_nodes(heading: Tag) -> List[Tag]:
    nodes: List[Tag] = []
    level = int(heading.name[1]) if heading.name and heading.name.startswith("h") else 2
    for sibling in heading.next_siblings:
        if isinstance(sibling, Tag) and sibling.name in {"h2", "h3", "h4", "h5"}:
            sibling_level = int(sibling.name[1])
            if sibling_level <= level:
                break
        if isinstance(sibling, Tag):
            nodes.append(sibling)
    return nodes


def _blank_reminder(label: str) -> Dict[str, str]:
    return {
        "label": to_traditional(label),
        "placement_timing": "",
        "placement_condition": "",
        "removal_timing": "",
        "special_notes": "",
    }


def _assign_text(reminder: Dict[str, str], text: str) -> None:
    traditional = to_traditional(text)
    patterns = [
        (("放置時機：", "放置時機:"), "placement_timing"),
        (("放置條件：", "放置條件:"), "placement_condition"),
        (("移除時機：", "移除時機:"), "removal_timing"),
    ]
    for prefixes, field in patterns:
        for prefix in prefixes:
            if traditional.startswith(prefix):
                reminder[field] = clean_text(traditional[len(prefix):])
                return
    reminder["special_notes"] = clean_text(" ".join(filter(None, [reminder["special_notes"], traditional])))


def parse_reminders(html: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    heading = None
    for candidate in soup.find_all(["h2", "h3", "h4", "h5"]):
        text = to_traditional(candidate.get_text(" ", strip=True)).replace("[編輯]", "").strip()
        if text == "提示標記":
            heading = candidate
            break
    if not heading:
        return {"found": False, "reminders": [], "raw_text": ""}

    nodes = _section_nodes(heading)
    raw_text = to_traditional(" ".join(node.get_text(" ", strip=True) for node in nodes))
    if raw_text in {"無", "无"}:
        return {"found": True, "reminders": [], "raw_text": raw_text}

    reminders: List[Dict[str, str]] = []

    for table in [node for node in nodes if node.name == "table"]:
        rows = table.find_all("tr")
        headers: List[str] = []
        for row in rows:
            cells = row.find_all(["th", "td"])
            values = [to_traditional(cell.get_text(" ", strip=True)) for cell in cells]
            if not values:
                continue
            if not headers and row.find_all("th"):
                headers = values
                continue
            mapping = dict(zip(headers, values)) if headers else {}
            label = mapping.get("提示標記") or mapping.get("標記名稱") or mapping.get("名稱") or values[0]
            if not label:
                continue
            reminder = _blank_reminder(label)
            reminder["placement_timing"] = mapping.get("放置時機", "")
            reminder["placement_condition"] = mapping.get("放置條件", "")
            reminder["removal_timing"] = mapping.get("移除時機", "")
            known = {"提示標記", "標記名稱", "名稱", "放置時機", "放置條件", "移除時機"}
            reminder["special_notes"] = " ".join(value for key, value in mapping.items() if key not in known and value)
            reminders.append(reminder)

    if not reminders:
        current = None
        for node in nodes:
            if node.name in {"ul", "ol"}:
                for item in node.find_all("li", recursive=False):
                    text = to_traditional(item.get_text(" ", strip=True))
                    if text.startswith(("放置時機", "放置條件", "移除時機")) and current:
                        _assign_text(current, text)
                    elif text:
                        current = _blank_reminder(text)
                        reminders.append(current)
                continue
            text = to_traditional(node.get_text(" ", strip=True))
            if not text:
                continue
            if current is None:
                label_match = re.search(r"(?:提示標記|標記名稱)[：:]\s*([^。；;]+)", text)
                current = _blank_reminder(label_match.group(1) if label_match else "未命名標記")
                reminders.append(current)
            for part in re.split(r"(?=(?:放置時機|放置條件|移除時機)[：:])", text):
                part = clean_text(part)
                if part:
                    _assign_text(current, part)

    unique = []
    seen = set()
    for reminder in reminders:
        label = clean_text(reminder.get("label"))
        if not label or label in seen:
            continue
        seen.add(label)
        unique.append(reminder)
    return {"found": True, "reminders": unique, "raw_text": raw_text}


def fetch_role_reminders(title: str) -> Dict[str, Any]:
    article = fetch_article(title)
    parsed = parse_reminders(article["html"])
    return {
        "title": article["title"],
        "source": "GStone 官方鐘樓百科",
        "source_url": article["url"],
        "http_status": article["status"],
        **parsed,
    }

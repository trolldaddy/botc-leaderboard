from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urljoin

import requests
from bs4 import BeautifulSoup, Tag
from opencc import OpenCC

BASE_URL = "https://clocktower-wiki.gstonegames.com"
EXCLUDED_KNOWLEDGE_TITLES = {"第一屆華燈初上劇本創作大賽"}
EXCLUDED_KNOWLEDGE_TITLES.update({
    "劇本", "剧本", "山雨欲來", "山雨欲来", "暗流湧動", "暗流涌动",
    "黯月初昇", "黯月初升", "夢殞春宵", "梦殒春宵", "華燈初上", "华灯初上",
})
EXCLUDED_KNOWLEDGE_TITLE_PATTERNS = (
    r"認證公示", r"认证公示", r"認證說書人", r"培训认证说书人", r"培訓認證說書人", r"專家說書人名單", r"专家说书人名单",
    r"說書人認證撤銷公告", r"说书人认证撤销公告", r"認證(?:城市聯賽|高校聯賽|城市賽|店鋪)",
    r"认证(?:城市联赛|高校联赛|城市赛|店铺)", r"全國比賽", r"全国比赛", r"城市聯賽", r"城市联赛",
    r"城市賽", r"城市赛", r"大師賽", r"大师赛", r"派對賽", r"派对赛", r"高校聯賽", r"高校联赛",
    r"劇本比賽", r"剧本比赛", r"劇本創作大賽", r"剧本创作大赛", r"世界(?:杯|盃).*劇本集錦",
    r"世界杯.*剧本集锦", r"拜年祭", r"節目合集", r"节目合集", r"宣傳.*徵稿", r"宣传.*征稿",
)
PRESERVED_ROLE_GROUP_TITLES = {
    "鎮民", "外來者", "爪牙", "惡魔", "旅行者", "傳奇角色", "奇遇角色", "實驗性角色",
}


HEADERS = {
    "User-Agent": "Larplus-Knowledge-Base/1.1 (+official GStone wiki sync)",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
}
_TO_TRADITIONAL = OpenCC("s2twp")
_TO_SIMPLIFIED = OpenCC("t2s")


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def to_traditional(value: Any) -> str:
    return _TO_TRADITIONAL.convert(clean_text(value))


def to_simplified(value: Any) -> str:
    return _TO_SIMPLIFIED.convert(clean_text(value))


def is_excluded_knowledge_title(title: str) -> bool:
    normalized = to_traditional(title)
    excluded_titles = {to_traditional(value) for value in EXCLUDED_KNOWLEDGE_TITLES}
    return normalized in excluded_titles or any(
        re.search(pattern, normalized) for pattern in EXCLUDED_KNOWLEDGE_TITLE_PATTERNS
    )


def is_excluded_knowledge_page(title: str, page_type: str = "") -> bool:
    normalized = to_traditional(title)
    if normalized in PRESERVED_ROLE_GROUP_TITLES:
        return False
    return clean_text(page_type).lower() == "script" or is_excluded_knowledge_title(title)


def article_url(title: str) -> str:
    return f"{BASE_URL}/index.php?title={quote(clean_text(title))}"


def title_candidates(title: str, aliases: Optional[List[str]] = None) -> List[Dict[str, str]]:
    requested = clean_text(title)
    candidates: List[Dict[str, str]] = []

    def add(value: Any, method: str) -> None:
        candidate = clean_text(value)
        if not candidate or any(item["title"] == candidate for item in candidates):
            return
        candidates.append({"title": candidate, "method": method})

    for alias in aliases or []:
        add(alias, "provided_alias")
    add(requested, "requested_title")
    add(to_simplified(requested), "traditional_to_simplified")
    return candidates


def fetch_article(title: str, aliases: Optional[List[str]] = None) -> Dict[str, Any]:
    attempts: List[Dict[str, Any]] = []
    for candidate in title_candidates(title, aliases):
        url = article_url(candidate["title"])
        response = requests.get(url, headers=HEADERS, timeout=25)
        attempts.append({
            "title": candidate["title"],
            "method": candidate["method"],
            "url": response.url,
            "status": response.status_code,
        })
        if response.status_code == 404:
            continue
        response.raise_for_status()
        return {
            "title": clean_text(title),
            "resolved_title": candidate["title"],
            "resolution_method": candidate["method"],
            "url": response.url,
            "status": response.status_code,
            "html": response.text,
            "attempts": attempts,
        }
    attempted_titles = "、".join(item["title"] for item in attempts)
    raise requests.HTTPError(f"GStone 找不到角色頁，已嘗試：{attempted_titles}")


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


def fetch_role_reminders(title: str, aliases: Optional[List[str]] = None) -> Dict[str, Any]:
    article = fetch_article(title, aliases=aliases)
    parsed = parse_reminders(article["html"])
    return {
        "title": article["title"],
        "resolved_title": article["resolved_title"],
        "resolution_method": article["resolution_method"],
        "attempts": article["attempts"],
        "source": "GStone 官方鐘樓百科",
        "source_url": article["url"],
        "http_status": article["status"],
        **parsed,
    }


def parse_role_information(html: str) -> Dict[str, Any]:
    """Extract the structured role information section from a GStone role article."""
    soup = BeautifulSoup(html, "html.parser")
    image_url = ""
    for image in soup.find_all("img"):
        source = clean_text(image.get("src"))
        alt = clean_text(image.get("alt")).lower()
        if source.startswith("/images/") and alt.endswith((".png", ".jpg", ".jpeg", ".webp")):
            image_url = urljoin(BASE_URL, source)
            break

    official_ability = ""
    for candidate in soup.find_all(["h2", "h3", "h4", "h5"]):
        heading_text = to_traditional(candidate.get_text(" ", strip=True))
        heading_text = re.sub(r"\[[^\]]+\]", "", heading_text).strip()
        if heading_text not in {"角色能力", "能力"}:
            continue
        ability_parts = []
        for node in _section_nodes(candidate):
            text_value = to_traditional(node.get_text(" ", strip=True)).strip()
            if text_value:
                ability_parts.append(text_value)
        official_ability = re.sub(r"\s+", " ", " ".join(ability_parts)).strip()
        break

    heading = None
    for candidate in soup.find_all(["h2", "h3", "h4", "h5"]):
        text = to_traditional(candidate.get_text(" ", strip=True))
        text = re.sub(r"\[[^\]]+\]", "", text).strip()
        if text in {"角色資訊", "角色信息"}:
            heading = candidate
            break
    empty = {"found": False, "english_name": "", "script_names": [], "role_type": "", "ability_tags": [],
             "official_ability": official_ability, "image_url": image_url}
    if not heading:
        return empty

    values: Dict[str, List[str]] = {}
    for node in _section_nodes(heading):
        for item in node.find_all("li"):
            text = to_traditional(item.get_text(" ", strip=True))
            match = re.match(r"^([^：:]+)[：:]\s*(.*)$", text)
            if not match:
                continue
            label = clean_text(match.group(1))
            value = clean_text(match.group(2))
            links = [to_traditional(link.get_text(" ", strip=True)) for link in item.find_all("a") if clean_text(link.get_text(" ", strip=True))]
            values[label] = links or [clean_text(part) for part in re.split(r"[、,，/]", value) if clean_text(part)]

    def first(*labels: str) -> str:
        for label in labels:
            if values.get(label):
                return values[label][0]
        return ""

    def many(*labels: str) -> List[str]:
        for label in labels:
            if values.get(label):
                return list(dict.fromkeys(values[label]))
        return []

    return {
        "found": True,
        "english_name": first("英文名", "英文名稱"),
        "script_names": many("所屬劇本", "所属剧本"),
        "role_type": first("角色型別", "角色類型", "角色类型"),
        "ability_tags": many("角色能力型別", "角色能力類型", "角色能力类型"),
        "official_ability": official_ability,
        "image_url": image_url,
    }


def fetch_role_information(title: str, aliases: Optional[List[str]] = None) -> Dict[str, Any]:
    article = fetch_article(title, aliases=aliases)
    parsed = parse_role_information(article["html"])
    return {
        "title": article["title"],
        "resolved_title": article["resolved_title"],
        "resolution_method": article["resolution_method"],
        "attempts": article["attempts"],
        "source": "GStone 官方鐘樓百科",
        "source_url": article["url"],
        "http_status": article["status"],
        **parsed,
    }

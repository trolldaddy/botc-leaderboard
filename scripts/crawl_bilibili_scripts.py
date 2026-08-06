"""Fetch the manifest's Bilibili Opus pages through Jina Reader into reviewable metadata drafts."""
import argparse
import json
import re
from pathlib import Path

import requests
from opencc import OpenCC

TO_TRADITIONAL = OpenCC("s2twp")
IMAGE_RE = re.compile(r"!\[[^\]]*\]\((https?://[^)]+)\)")
TITLE_RE = re.compile(r"^Title:\s*(.+)$", re.MULTILINE)


def clean_markdown(value):
    value = IMAGE_RE.sub("", str(value or ""))
    value = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"[*~`>#]+", "", value)
    value = re.sub(r"[\u200b\ufeff]", "", value)
    return TO_TRADITIONAL.convert(value).strip(" 【】[]：:　")


def article_body(markdown):
    lines = markdown.splitlines()
    start = next((index for index, line in enumerate(lines) if "本期介绍的是由" in line), 0)
    end = next((index for index in range(start + 1, len(lines))
                if "跳转至索引" in lines[index] or "跳轉至索引" in lines[index]), len(lines))
    return lines[start:end]


def author_from_markdown(markdown):
    line = next((line for line in markdown.splitlines() if "本期介绍的是由" in line), "")
    if not line:
        return ""
    cleaned = clean_markdown(line)
    match = re.search(r"本期介紹的是由(.+?)(?:帶來的|所\s*帶來的|所\s*創作的)", cleaned)
    if not match:
        return ""
    value = match.group(1).strip()
    # Museum introductions sometimes mention a studio before the actual script
    # author.  In that form the last explicit author marker is authoritative.
    if "作者" in value:
        value = value.rsplit("作者", 1)[-1]
    mentions = re.findall(r"@([0-9A-Za-z_\-\u4e00-\u9fff]+)", value)
    if mentions:
        # Parenthesised @aliases describe the same account; an ampersand joins
        # genuinely distinct co-authors (for example @JJ & @Mas).
        explicit_coauthors = bool(re.search(r"@[0-9A-Za-z_\-\u4e00-\u9fff]+\s*[&＆]\s*@[0-9A-Za-z_\-\u4e00-\u9fff]+", value))
        selected = mentions if explicit_coauthors else mentions[:1]
        return "、".join(dict.fromkeys(selected))
    value = re.sub(r"^(?:來自海外的|來自國內的|海外|國內|知名|專家|說書人|劇本創作者|創作者|up主|\s)+", "", value)
    return value.strip(" @&、，（）()")


def extracted_fields(markdown, title):
    buckets = {key: [] for key in (
        "background_introduction", "gameplay_overview", "author_note",
        "production_updates", "player_guide", "storyteller_guide",
    )}
    active = "background_introduction"
    for raw in article_body(markdown)[1:]:
        if IMAGE_RE.search(raw):
            continue
        line = clean_markdown(raw)
        raw_stripped = raw.lstrip()
        if (not line or raw_stripped.startswith(("#血染", "#鐘樓", "#钟楼"))
                or line == "* * *" or "跳轉至索引" in line):
            continue
        is_heading = raw.lstrip().startswith("#")
        if is_heading:
            heading = line
            if "作者" in heading or "Q&A" in heading:
                active = "author_note"
            elif "說書" in heading or "運作" in heading:
                active = "storyteller_guide"
            elif "遊戲提示" in heading or "玩家" in heading:
                active = "player_guide"
            elif any(key in heading for key in ("特色", "特點", "設計理念", "難度", "可玩性", "趣味性", "綜合評價", "角色選擇", "惡魔篇", "爪牙篇", "外來者篇", "鎮民篇")):
                active = "gameplay_overview"
            elif any(key in heading for key in ("簡介", "介紹", "劇情設定")) or normalized_heading(heading) == normalized_heading(title):
                active = "background_introduction"
            else:
                buckets[active].append(heading)
            continue
        if re.search(r"【?20\d{2}[./年]\d{1,2}", line) or "更新至" in line:
            active = "production_updates"
        buckets[active].append(line)
    result = {key: "\n\n".join(values).strip() for key, values in buckets.items()}
    intro_source = result["background_introduction"] or result["author_note"] or result["gameplay_overview"]
    generic_headings = {normalized_heading(value) for value in (
        title, "寫在前面", "劇本簡介", "劇本介紹", "劇情設定", "作者的話", "作者Q&A",
    )}
    first_paragraph = next((part.strip() for part in intro_source.split("\n\n")
                            if len(part.strip()) >= 12
                            and normalized_heading(part) not in generic_headings), "")
    result["introduction"] = first_paragraph[:500]
    result["tagline"] = first_paragraph[:120]
    return result


def normalized_heading(value):
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", str(value or "").casefold())

def slugify(name, external_id):
    value = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "-", name.lower()).strip("-")
    return value or f"bilibili-{external_id}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("scripts/bilibili_script_manifest.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("reports/bilibili-scripts"))
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--hydrate-existing", action="store_true")
    parser.add_argument("--refresh-extracted", action="store_true",
                        help="Replace auto-extracted copy while preserving manually curated metadata.")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = []
    for item in manifest["items"]:
        external_id = item["external_id"]
        output = args.output_dir / f"{external_id}.json"
        raw_output = args.output_dir / f"{external_id}.md"
        if output.exists() and not args.overwrite and not args.hydrate_existing:
            report.append({"external_id": external_id, "status": "exists"})
            continue
        source_url = f"https://www.bilibili.com/opus/{external_id}"
        if args.hydrate_existing and raw_output.exists():
            markdown = raw_output.read_text(encoding="utf-8-sig")
        else:
            response = requests.get(f"https://r.jina.ai/{source_url}", timeout=60)
            response.raise_for_status()
            markdown = response.text
            raw_output.write_text(markdown, encoding="utf-8")
        title_match = TITLE_RE.search(markdown)
        title = TO_TRADITIONAL.convert(item.get("name_zh_tw") or (title_match.group(1) if title_match else f"Bilibili {external_id}"))
        images = list(dict.fromkeys(IMAGE_RE.findall(markdown)))
        fields = extracted_fields(markdown, title)
        existing = {}
        if output.exists():
            existing = json.loads(output.read_text(encoding="utf-8-sig"))
        extracted = (lambda key: fields[key] if args.refresh_extracted else existing.get(key) or fields[key])
        metadata = {
            "slug": slugify(title, external_id), "name_zh_tw": title, "version": existing.get("version"),
            "category": existing.get("category") or "社群縫合劇本",
            "introduction": extracted("introduction"),
            "author_name": author_from_markdown(markdown) if args.refresh_extracted else existing.get("author_name") or author_from_markdown(markdown),
            "tagline": extracted("tagline"), "tags": existing.get("tags") or ["鐘樓博物館"],
            "background_introduction": extracted("background_introduction"),
            "gameplay_overview": extracted("gameplay_overview"),
            "author_note": extracted("author_note"),
            "production_updates": extracted("production_updates"),
            "player_guide": extracted("player_guide"),
            "storyteller_guide": extracted("storyteller_guide"),
            "source_url": source_url, "source_platform": "bilibili", "source_external_id": external_id,
            "is_public": existing.get("is_public", False),
            "images": existing.get("images") or [{"url": url, "alt": title} for url in images],
        }
        output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        report.append({"external_id": external_id, "status": "drafted", "title": title, "images": len(images)})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

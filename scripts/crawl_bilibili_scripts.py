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


def slugify(name, external_id):
    value = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "-", name.lower()).strip("-")
    return value or f"bilibili-{external_id}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("scripts/bilibili_script_manifest.json"))
    parser.add_argument("--output-dir", type=Path, default=Path("reports/bilibili-scripts"))
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    report = []
    for item in manifest["items"]:
        external_id = item["external_id"]
        output = args.output_dir / f"{external_id}.json"
        raw_output = args.output_dir / f"{external_id}.md"
        if output.exists() and not args.overwrite:
            report.append({"external_id": external_id, "status": "exists"})
            continue
        source_url = f"https://www.bilibili.com/opus/{external_id}"
        response = requests.get(f"https://r.jina.ai/{source_url}", timeout=60)
        response.raise_for_status()
        markdown = response.text
        raw_output.write_text(markdown, encoding="utf-8")
        title_match = TITLE_RE.search(markdown)
        title = TO_TRADITIONAL.convert(item.get("name_zh_tw") or (title_match.group(1) if title_match else f"Bilibili {external_id}"))
        images = list(dict.fromkeys(IMAGE_RE.findall(markdown)))
        metadata = {
            "slug": slugify(title, external_id), "name_zh_tw": title, "version": None,
            "category": "社群縫合劇本", "introduction": "", "author_name": "",
            "tagline": "", "tags": ["鐘樓博物館"], "background_introduction": "",
            "gameplay_overview": "", "author_note": "", "production_updates": "",
            "player_guide": "", "storyteller_guide": "", "source_url": source_url,
            "source_platform": "bilibili", "source_external_id": external_id,
            "is_public": False, "images": [{"url": url, "alt": title} for url in images],
        }
        output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        report.append({"external_id": external_id, "status": "drafted", "title": title, "images": len(images)})
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

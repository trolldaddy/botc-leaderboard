"""Download reviewed script artwork into the deployed static tree and rewrite metadata URLs."""
import argparse
import json
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "bilibili_script_manifest.json"
METADATA_DIR = ROOT / "reports" / "bilibili-scripts"
OUTPUT_ROOT = ROOT / "static" / "script-images" / "reviewed"
CONTENT_EXTENSIONS = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "image/avif": ".avif",
}


def extension_for(response, source_url):
    content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
    extension = CONTENT_EXTENSIONS.get(content_type)
    if extension:
        return extension
    suffix = Path(urlparse(source_url).path).suffix.lower()
    return suffix if suffix in CONTENT_EXTENSIONS.values() else mimetypes.guess_extension(content_type) or ".img"


def localize_item(item, session, write):
    metadata_path = METADATA_DIR / f"{item['external_id']}.json"
    if not metadata_path.exists():
        return {"id": item["external_id"], "skipped": "metadata_missing", "downloaded": 0}
    metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
    downloaded = 0
    for index, image in enumerate(metadata.get("images", []), start=1):
        source_url = str(image.get("url") or "")
        if not source_url.startswith(("http://", "https://")):
            continue
        response = session.get(source_url, timeout=45)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").lower()
        if not content_type.startswith("image/") or len(response.content) < 1024:
            raise ValueError(f"Not a valid image response: {source_url}")
        extension = extension_for(response, source_url)
        relative_path = Path("script-images") / "reviewed" / item["external_id"] / f"{index:02d}{extension}"
        target = ROOT / "static" / relative_path
        if write:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(response.content)
            image["url"] = "/static/" + relative_path.as_posix()
        downloaded += 1
    if write and downloaded:
        metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"id": item["external_id"], "name": item.get("name_zh_tw"), "downloaded": downloaded}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))
    selected = [item for item in manifest.get("items", []) if not args.only or item["external_id"] in args.only]
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)",
        "Referer": "https://www.bilibili.com/",
    })
    results = [localize_item(item, session, args.write) for item in selected]
    print(json.dumps({"mode": "write" if args.write else "preview", "items": results,
                      "images": sum(item.get("downloaded", 0) for item in results)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

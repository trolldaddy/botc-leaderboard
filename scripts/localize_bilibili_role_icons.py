"""Cache reviewed script role icons in the deployed static tree and rewrite JSON URLs."""
import argparse
import hashlib
import json
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image

from scripts.import_bilibili_script import find_catalog_role

ROOT = Path(__file__).resolve().parents[1]
JSON_ROOT = ROOT / "reports" / "bilibili-script-json"
OUTPUT_ROOT = ROOT / "static" / "script-role-icons" / "reviewed"
DJINN_SOURCE = "https://oss.gstonegames.com/data_file/clocktower/web/icons/djinn.png"
DJINN_PUBLIC = "/static/script-role-icons/reviewed/djinn.png"
UNKNOWN_PUBLIC = "/static/script-role-icons/reviewed/unknown.svg"
CONTENT_EXTENSIONS = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "image/avif": ".avif",
}


def extension_for(response, source_url):
    content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
    suffix = Path(urlparse(source_url).path).suffix.lower()
    return CONTENT_EXTENSIONS.get(content_type) or (
        suffix if suffix in CONTENT_EXTENSIONS.values()
        else mimetypes.guess_extension(content_type) or ".img"
    )


def download(source_url):
    response = requests.get(source_url, timeout=45, headers={
        "User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)",
        "Referer": "https://www.bilibili.com/",
    })
    response.raise_for_status()
    if not response.headers.get("Content-Type", "").lower().startswith("image/") or len(response.content) < 256:
        raise ValueError(f"Not a valid image response: {source_url}")
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:24]
    return source_url, digest + extension_for(response, source_url), response.content


def image_sources(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    value = str(value or "").strip()
    return [value] if value else []


def crop_icon(item, source_path):
    crop = item.get("icon_crop")
    if not isinstance(crop, dict) or not crop.get("box"):
        return None
    box = tuple(int(value) for value in crop["box"])
    if len(box) != 4:
        raise ValueError("icon_crop.box must be [left, top, right, bottom]")
    source = ROOT / str(crop.get("source") or source_path)
    digest = hashlib.sha256(f"{source}:{box}".encode("utf-8")).hexdigest()[:24]
    filename = f"crop-{digest}.png"
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.crop(box).convert("RGBA").save(OUTPUT_ROOT / filename, "PNG")
    return "/static/script-role-icons/reviewed/" + filename


def collect_documents(paths):
    documents, urls = [], {DJINN_SOURCE}
    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        if not isinstance(payload, list):
            continue
        documents.append((path, payload))
        for item in payload:
            if not isinstance(item, dict) or str(item.get("id", "")).lower() == "_meta":
                continue
            for source in image_sources(item.get("image")):
                if source.startswith(("http://", "https://")):
                    urls.add(source)
            catalog_role = find_catalog_role(item)
            catalog_source = str((catalog_role or {}).get("image") or "").strip()
            if catalog_source.startswith(("http://", "https://")):
                urls.add(catalog_source)
    return documents, urls


def run(write=False, only=(), workers=12):
    paths = [JSON_ROOT / name for name in only] if only else sorted(JSON_ROOT.glob("*.json"))
    documents, urls = collect_documents(paths)
    downloaded, failures = {}, []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(download, url): url for url in urls}
        for future in as_completed(futures):
            source = futures[future]
            try:
                _, filename, data = future.result()
                downloaded[source] = filename
                if write:
                    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
                    (OUTPUT_ROOT / filename).write_bytes(data)
            except Exception as exc:
                failures.append({"url": source, "error": str(exc)})
    djinn_filename = downloaded.get(DJINN_SOURCE)
    if write and djinn_filename:
        (OUTPUT_ROOT / "djinn.png").write_bytes((OUTPUT_ROOT / djinn_filename).read_bytes())
    rewritten = 0
    for path, payload in documents:
        changed = False
        for item in payload:
            if not isinstance(item, dict) or str(item.get("id", "")).lower() == "_meta":
                continue
            sources = image_sources(item.get("image"))
            source = sources[0] if sources else ""
            catalog_role = find_catalog_role(item)
            catalog_source = str((catalog_role or {}).get("image") or "").strip()
            local_url = crop_icon(item, path) if write and item.get("icon_crop") else None
            if not local_url:
                if source in downloaded:
                    local_url = "/static/script-role-icons/reviewed/" + downloaded[source]
                elif catalog_source in downloaded:
                    local_url = "/static/script-role-icons/reviewed/" + downloaded[catalog_source]
                elif str(item.get("team") or "").strip().casefold() in {"jinx", "jinxed", "jinxes", "a jinxed"}:
                    local_url = DJINN_PUBLIC
                elif source.startswith(("http://", "https://")) or not source:
                    local_url = UNKNOWN_PUBLIC
            if local_url and source != local_url:
                item["image"] = local_url
                changed = True
                rewritten += 1
        if write and changed:
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "mode": "write" if write else "preview", "documents": len(documents),
        "unique_images": len(urls), "downloaded": len(downloaded),
        "rewritten": rewritten, "failures": failures,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()
    print(json.dumps(run(args.write, args.only, args.workers), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

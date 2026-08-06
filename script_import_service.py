import base64
import hashlib
import json
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import HTTPException

from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement
from scripts.crawl_bilibili_scripts import IMAGE_RE, TITLE_RE, author_from_markdown, extracted_fields, slugify
from scripts.import_bilibili_script import TO_TRADITIONAL, normalized_entry_type

ROOT = Path(__file__).resolve().parent
IMAGE_ROOT = ROOT / "static" / "script-images" / "uploads"
ICON_ROOT = ROOT / "static" / "script-role-icons" / "uploads"
ALLOWED_HOSTS = {"www.bilibili.com", "bilibili.com"}
EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


def museum_metadata(source_url):
    if not source_url:
        return {}
    parsed = urlparse(source_url)
    match = re.search(r"/opus/(\d+)", parsed.path)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS or not match:
        raise HTTPException(400, "目前只支援鐘樓博物館的 Bilibili opus 網址")
    try:
        response = requests.get("https://r.jina.ai/" + source_url, timeout=45)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"無法讀取鐘樓博物館文章：{exc}") from exc
    markdown = response.text
    title_line = (TITLE_RE.search(markdown).group(1) if TITLE_RE.search(markdown) else "").strip()
    title_match = re.search(r"《([^》]+)》", title_line)
    title = TO_TRADITIONAL.convert(title_match.group(1) if title_match else title_line)
    return {"source_url": source_url, "source_platform": "bilibili", "source_external_id": match.group(1),
            "name_zh_tw": title, "author_name": author_from_markdown(markdown),
            **extracted_fields(markdown, title),
            "remote_images": list(dict.fromkeys(IMAGE_RE.findall(markdown)))}


def extension(filename="", content_type=""):
    suffix = Path(str(filename)).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return EXTENSIONS.get(str(content_type).split(";", 1)[0].lower(), ".webp")


def uploaded_bytes(item):
    encoded = str(item.get("content") or "")
    if encoded.startswith("data:") and "," in encoded:
        encoded = encoded.split(",", 1)[1]
    try:
        data = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(400, f"無法讀取上傳圖片 {item.get('filename') or ''}") from exc
    if not data or len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "單張圖片必須介於 1 byte 與 20 MB")
    return data


def unique_slug(db, name, external_id=""):
    base = slugify(name, external_id or uuid.uuid4().hex[:8])
    candidate, number = base, 2
    while db.query(ScriptEntry.id).filter(ScriptEntry.slug == candidate).first():
        candidate, number = f"{base}-{number}", number + 1
    return candidate


def save_artwork(script, uploads, remote_urls):
    folder = IMAGE_ROOT / script.slug
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for index, item in enumerate(uploads, 1):
        target = folder / f"{index:02d}{extension(item.get('filename'), item.get('content_type'))}"
        target.write_bytes(uploaded_bytes(item))
        saved.append(f"/static/script-images/uploads/{script.slug}/{target.name}")
    if saved:
        return saved
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)", "Referer": "https://www.bilibili.com/"})
    for index, url in enumerate(remote_urls[:12], 1):
        try:
            response = session.get(url, timeout=45)
            response.raise_for_status()
            if not response.headers.get("Content-Type", "").lower().startswith("image/"):
                continue
            target = folder / f"{index:02d}{extension(urlparse(url).path, response.headers.get('Content-Type'))}"
            target.write_bytes(response.content)
            saved.append(f"/static/script-images/uploads/{script.slug}/{target.name}")
        except requests.RequestException:
            continue
    return saved


def local_icon(script, item):
    source = str(item.get("image") or "").strip()
    if normalized_entry_type(item.get("team")) == "jinx" and not source:
        return "/static/script-role-icons/reviewed/djinn.png"
    if not source.startswith(("http://", "https://", "data:image/")):
        return source or "/static/script-role-icons/reviewed/unknown.svg"
    try:
        if source.startswith("data:image/"):
            header, encoded = source.split(",", 1)
            data = base64.b64decode(encoded)
            content_type = header.split(";", 1)[0].split(":", 1)[1]
        else:
            response = requests.get(source, timeout=30, headers={"User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)"})
            response.raise_for_status()
            data, content_type = response.content, response.headers.get("Content-Type", "")
        ICON_ROOT.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(f"{script.slug}:{item.get('id')}".encode()).hexdigest()[:24]
        target = ICON_ROOT / f"{digest}{extension(urlparse(source).path, content_type)}"
        target.write_bytes(data)
        return f"/static/script-role-icons/uploads/{target.name}"
    except Exception:
        return "/static/script-role-icons/reviewed/unknown.svg"


def create_script(db, data, official, supplements, metadata):
    name = TO_TRADITIONAL.convert(str(data.get("name_zh_tw") or metadata.get("name_zh_tw") or "").strip())
    if not name:
        raise HTTPException(400, "請填寫劇本名稱，或提供可辨識標題的鐘樓博物館網址")
    script = ScriptEntry(
        slug=unique_slug(db, name, metadata.get("source_external_id", "")), name_zh_tw=name,
        version=str(data.get("version") or "").strip() or None,
        category=str(data.get("category") or "社群縫合劇本").strip(),
        author_name=str(data.get("author_name") or metadata.get("author_name") or "").strip() or None,
        introduction=str(data.get("introduction") or metadata.get("introduction") or "").strip() or None,
        tagline=str(data.get("tagline") or metadata.get("tagline") or "").strip() or None,
        background_introduction=metadata.get("background_introduction") or None,
        gameplay_overview=metadata.get("gameplay_overview") or None,
        author_note=metadata.get("author_note") or None, production_updates=metadata.get("production_updates") or None,
        player_guide=metadata.get("player_guide") or None, storyteller_guide=metadata.get("storyteller_guide") or None,
        source_url=metadata.get("source_url") or None, source_platform=metadata.get("source_platform") or "manual",
        source_external_id=metadata.get("source_external_id") or None, is_public=False, needs_review=True,
        is_laplace_owned=bool(data.get("is_laplace_owned")))
    db.add(script)
    db.flush()
    for index, url in enumerate(save_artwork(script, data.get("images") or [], metadata.get("remote_images") or [])):
        script.images.append(ScriptImage(image_url=url, alt_text=name, sort_order=index))
    for index, role in enumerate(official):
        script.roles.append(ScriptRole(role_id=role.id, sort_order=index))
    for index, item in enumerate(supplements):
        script.supplements.append(ScriptSupplement(
            external_id=item.get("id") or f"manual-{uuid.uuid4().hex}",
            name_zh_tw=TO_TRADITIONAL.convert(item.get("name") or item.get("id") or "未命名"),
            entry_type=normalized_entry_type(item.get("team")), image_url=local_icon(script, item),
            ability=TO_TRADITIONAL.convert(item.get("ability") or "") or None, sort_order=index))
    db.commit()
    return script

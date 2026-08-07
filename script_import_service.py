import base64
import hashlib
import io
import json
import mimetypes
import re
import shutil
import uuid
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import HTTPException
from PIL import Image
from script_artwork_classifier import inspect_artwork, select_script_faces

from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement
from scripts.crawl_bilibili_scripts import IMAGE_RE, TITLE_RE, author_from_markdown, extracted_fields, slugify
from scripts.import_bilibili_script import TO_TRADITIONAL, normalized_entry_type

ROOT = Path(__file__).resolve().parent
IMAGE_ROOT = ROOT / "static" / "script-images" / "uploads"
ICON_ROOT = ROOT / "static" / "script-role-icons" / "uploads"
CANDIDATE_ROOT = ROOT / "static" / "script-images" / "candidates"
ALLOWED_HOSTS = {"www.bilibili.com", "bilibili.com"}
EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
ARTWORK_SLOTS = {"front": 0, "back": 1, "logo": 100}


def persisted_artwork_url(script, slot):
    return f"/api/scripts/artwork/{script.slug}/{slot}"


def local_artwork_payload(url):
    source = _safe_local_artwork_path(url)
    content_type = mimetypes.guess_type(source.name)[0] or "application/octet-stream"
    return base64.b64encode(source.read_bytes()).decode("ascii"), content_type


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


def rank_remote_artwork(candidates, limit=2):
    """Prefer visual front/back faces over logos, avatars and article banners."""
    prepared = []
    for item in candidates:
        if item.get("content"):
            with Image.open(io.BytesIO(item["content"])) as image:
                prepared.append(inspect_artwork(image, **item))
        else:
            width, height = item.get("width", 0), item.get("height", 0)
            ratio = width / height if height else 0
            portrait = height > width and 0.48 <= ratio <= 0.86
            prepared.append({**item, "ratio": ratio, "portrait": portrait,
                             "face_score": (120 if portrait else 0) - abs(ratio - 0.70) * 80
                                           + min(width * height / 250_000, 20),
                             "back_score": item.get("index", 0)})
    return select_script_faces(prepared, limit=limit)


def remote_artwork_candidates(remote_urls):
    """Read article images for explicit admin review; never infer their role."""
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)", "Referer": "https://www.bilibili.com/"})
    candidates = []
    for index, url in enumerate(list(dict.fromkeys(remote_urls))[:24]):
        try:
            response = session.get(url, timeout=45)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if not content_type.lower().startswith("image/"):
                continue
            with Image.open(io.BytesIO(response.content)) as image:
                width, height = image.size
            candidate_id = hashlib.sha256(url.encode()).hexdigest()[:16]
            CANDIDATE_ROOT.mkdir(parents=True, exist_ok=True)
            target = CANDIDATE_ROOT / f"{candidate_id}{extension(urlparse(url).path, content_type)}"
            target.write_bytes(response.content)
            candidates.append({"id": candidate_id, "index": index,
                               "url": f"/static/script-images/candidates/{target.name}", "source_url": url,
                               "width": width, "height": height, "content_type": content_type})
        except (requests.RequestException, OSError, ValueError):
            continue
    return candidates



def uploaded_artwork_candidates(uploads):
    """Store manual uploads in the same review library as article images."""
    CANDIDATE_ROOT.mkdir(parents=True, exist_ok=True)
    candidates = []
    for index, item in enumerate((uploads or [])[:24]):
        content = uploaded_bytes(item)
        try:
            with Image.open(io.BytesIO(content)) as image:
                width, height = image.size
        except OSError as exc:
            raise HTTPException(400, "\u4e0a\u50b3\u7684\u6a94\u6848\u4e0d\u662f\u6709\u6548\u5716\u7247") from exc
        candidate_id = uuid.uuid4().hex[:16]
        target = CANDIDATE_ROOT / f"{candidate_id}{extension(item.get('filename'), item.get('content_type'))}"
        target.write_bytes(content)
        candidates.append({
            "id": candidate_id, "index": index,
            "url": f"/static/script-images/candidates/{target.name}",
            "source_url": f"/static/script-images/candidates/{target.name}",
            "width": width, "height": height,
            "content_type": item.get("content_type") or "",
        })
    return candidates


def existing_artwork_candidates(images):
    """Expose already assigned artwork in the review library without duplicating it."""
    items = []
    for index, image in enumerate(images or []):
        if image.sort_order not in (0, 1, 100):
            continue
        items.append({
            "id": f"existing-{image.id}", "index": index, "url": image.image_url,
            "source_url": image.image_url, "width": None, "height": None,
            "assigned_kind": {0: "front", 1: "back", 100: "logo"}[image.sort_order],
        })
    return items


def _safe_local_artwork_path(url):
    path = urlparse(str(url or "")).path
    prefixes = {
        "/static/script-images/candidates/": CANDIDATE_ROOT,
        "/static/script-images/uploads/": IMAGE_ROOT,
    }
    for prefix, root in prefixes.items():
        if path.startswith(prefix):
            relative = path[len(prefix):]
            candidate = (root / relative).resolve()
            if root.resolve() in candidate.parents and candidate.is_file():
                return candidate
    raise HTTPException(400, "\u5019\u9078\u5716\u7247\u8def\u5f91\u7121\u6548")


def _download_selected_artwork(script, selected, candidates):
    by_id = {item["id"]: item for item in candidates}
    chosen = {}
    for kind, candidate_id in (selected or {}).items():
        if kind not in ARTWORK_SLOTS or not candidate_id:
            continue
        if candidate_id not in by_id:
            raise HTTPException(400, f"{kind} 圖片不在這篇文章的候選清單中")
        if candidate_id in chosen.values():
            raise HTTPException(400, "同一張圖片不能同時指定成多個用途")
        chosen[kind] = candidate_id
    folder = IMAGE_ROOT / script.slug
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)", "Referer": "https://www.bilibili.com/"})
    for kind, candidate_id in chosen.items():
        item = by_id[candidate_id]
        response = session.get(item.get("source_url") or item["url"], timeout=45)
        response.raise_for_status()
        target = folder / f"{kind}{extension(urlparse(item.get('source_url') or item['url']).path, response.headers.get('Content-Type', ''))}"
        for existing in folder.glob(f"{kind}.*"):
            existing.unlink(missing_ok=True)
        target.write_bytes(response.content)
        saved.append((ARTWORK_SLOTS[kind], f"/static/script-images/uploads/{script.slug}/{target.name}", kind))
    return saved


def save_artwork(script, uploads, remote_urls, artwork_selection=None):
    folder = IMAGE_ROOT / script.slug
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for index, item in enumerate(uploads):
        slot = int(item.get("slot", index))
        kind = {0: "front", 1: "back", 100: "logo"}.get(slot)
        if not kind:
            raise HTTPException(400, "劇本圖片位置只能是正面、背面或 Logo")
        target = folder / f"{kind}{extension(item.get('filename'), item.get('content_type'))}"
        target.write_bytes(uploaded_bytes(item))
        saved.append((ARTWORK_SLOTS[kind], f"/static/script-images/uploads/{script.slug}/{target.name}", kind))
    if saved:
        return saved
    candidates = remote_artwork_candidates(remote_urls)
    if artwork_selection:
        return _download_selected_artwork(script, artwork_selection, candidates)
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; botc-leaderboard/1.0)", "Referer": "https://www.bilibili.com/"})
    candidates = []
    for index, url in enumerate(remote_urls[:12], 1):
        try:
            response = session.get(url, timeout=45)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if not content_type.lower().startswith("image/"):
                continue
            with Image.open(io.BytesIO(response.content)) as image:
                width, height = image.size
            candidates.append({
                "index": index, "url": url, "content": response.content,
                "content_type": content_type, "width": width, "height": height,
            })
        except (requests.RequestException, OSError, ValueError):
            continue
    for output_index, item in enumerate(rank_remote_artwork(candidates), 1):
        target = folder / f"{output_index:02d}{extension(urlparse(item.get('source_url') or item['url']).path, item['content_type'])}"
        target.write_bytes(item["content"])
        saved.append((output_index - 1, f"/static/script-images/uploads/{script.slug}/{target.name}", "front" if output_index == 1 else "back"))
    return saved


def save_artwork_slot(script, item, slot):
    """Persist one edited script face and return its stable public URL."""
    if slot not in (0, 1, 100):
        raise HTTPException(400, "劇本圖片位置只能是正面、背面或 Logo")
    folder = IMAGE_ROOT / script.slug
    folder.mkdir(parents=True, exist_ok=True)
    suffix = extension(item.get("filename"), item.get("content_type"))
    stem = {0: "front", 1: "back", 100: "logo"}[slot]
    for existing in folder.glob(f"{stem}.*"):
        existing.unlink(missing_ok=True)
    target = folder / f"{stem}{suffix}"
    target.write_bytes(uploaded_bytes(item))
    return f"/static/script-images/uploads/{script.slug}/{target.name}"


def save_selected_artwork(script, selection, remote_urls):
    return _download_selected_artwork(script, selection, remote_artwork_candidates(remote_urls))



def save_candidate_artwork(script, selection, candidates):
    """Apply explicitly reviewed local candidates, including manual uploads."""
    by_id = {str(item.get("id")): item for item in (candidates or []) if item.get("id")}
    chosen = {}
    for kind, candidate_id in (selection or {}).items():
        if kind not in ARTWORK_SLOTS or not candidate_id:
            continue
        if candidate_id not in by_id:
            raise HTTPException(400, f"{kind} \u5716\u7247\u4e0d\u5728\u5099\u9078\u5eab\u4e2d")
        if candidate_id in chosen.values():
            raise HTTPException(400, "\u540c\u4e00\u5f35\u5716\u7247\u4e0d\u80fd\u540c\u6642\u6307\u5b9a\u6210\u591a\u500b\u7528\u9014")
        chosen[kind] = candidate_id
    folder = IMAGE_ROOT / script.slug
    folder.mkdir(parents=True, exist_ok=True)
    saved = []
    for kind, candidate_id in chosen.items():
        source = _safe_local_artwork_path(by_id[candidate_id].get("url"))
        target = folder / f"{kind}{source.suffix.lower()}"
        if source.resolve() != target.resolve():
            for existing in folder.glob(f"{kind}.*"):
                existing.unlink(missing_ok=True)
            shutil.copyfile(source, target)
        saved.append((ARTWORK_SLOTS[kind], f"/static/script-images/uploads/{script.slug}/{target.name}", kind))
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
    for slot, url, kind in save_artwork(
        script, data.get("images") or [], metadata.get("remote_images") or [], data.get("artwork_selection") or {}
    ):
        suffix = {"front": "正面", "back": "背面", "logo": " Logo"}[kind]
        image_data, content_type = local_artwork_payload(url)
        script.images.append(ScriptImage(
            image_url=persisted_artwork_url(script, slot), image_data=image_data,
            content_type=content_type, alt_text=f"{name}{suffix}", sort_order=slot,
        ))
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

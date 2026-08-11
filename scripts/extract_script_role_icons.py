"""Extract role icons from script artwork and optionally persist them to GCS/Cloud SQL."""

import argparse
import io
import json
import sys
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from object_storage import store_public_bytes  # noqa: E402
from role_models import Role  # noqa: E402
from script_models import ScriptEntry, ScriptSupplement  # noqa: E402


def load_source(value):
    if str(value).startswith(("http://", "https://")):
        response = requests.get(value, timeout=30)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert("RGBA")
    return Image.open(value).convert("RGBA")


def extract_icon(source, x, y, crop_size, output_size):
    half = crop_size // 2
    box = (x - half, y - half, x + half, y + half)
    if box[0] < 0 or box[1] < 0 or box[2] > source.width or box[3] > source.height:
        raise ValueError(f"Crop {box} exceeds source size {source.size}")
    icon = source.crop(box).resize((output_size, output_size), Image.Resampling.LANCZOS)
    mask = Image.new("L", icon.size, 0)
    ImageDraw.Draw(mask).ellipse((3, 3, output_size - 4, output_size - 4), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(max(1, output_size // 128)))
    icon.putalpha(mask)
    output = io.BytesIO()
    icon.save(output, "WEBP", quality=95, method=6)
    return output.getvalue()


def update_stored_json(script, urls):
    if not script.script_json:
        return 0
    payload = json.loads(script.script_json)
    entries = payload if isinstance(payload, list) else payload.get("roles", [])
    updated = 0
    for item in entries:
        if not isinstance(item, dict):
            continue
        url = urls.get(str(item.get("id") or ""))
        if url:
            item["image"] = url
            updated += 1
    script.script_json = json.dumps(payload, ensure_ascii=False, indent=2)
    script.script_json_updated_at = datetime.now()
    return updated


def run(manifest_path, preview_dir=None, write=False, report_path=None):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source = load_source(manifest["source_image_url"])
    crop_size = int(manifest.get("crop_size", 64))
    output_size = int(manifest.get("output_size", 256))
    roles = manifest.get("roles") or []
    if len({item["id"] for item in roles}) != len(roles):
        raise ValueError("Role IDs in extraction manifest must be unique")

    extracted = []
    for item in roles:
        data = extract_icon(source, int(item["x"]), int(item["y"]), crop_size, output_size)
        filename = f"{item['id']}.webp"
        if preview_dir:
            preview_dir.mkdir(parents=True, exist_ok=True)
            (preview_dir / filename).write_bytes(data)
        extracted.append({**item, "filename": filename, "data": data})

    result = {"script_slug": manifest["script_slug"], "source_size": list(source.size), "extracted": [], "json_updated": 0}
    if write:
        db = SessionLocal()
        try:
            script = db.query(ScriptEntry).filter(ScriptEntry.slug == manifest["script_slug"]).first()
            if not script:
                raise RuntimeError(f"Script not found: {manifest['script_slug']}")
            urls = {}
            for item in extracted:
                url, _, _ = store_public_bytes(
                    item["data"],
                    f"script-role-icons/{script.slug}/{item['filename']}",
                    "image/webp",
                )
                if not url:
                    raise RuntimeError("GCS_BUCKET is required when --write is used")
                role = db.query(Role).filter(Role.canonical_key == item["id"]).first()
                supplement = db.query(ScriptSupplement).filter(
                    ScriptSupplement.script_id == script.id,
                    ScriptSupplement.external_id == item["id"],
                ).first()
                if not role and not supplement:
                    raise RuntimeError(f"Role not found in catalog or script supplements: {item['id']}")
                if role:
                    role.image_url = url
                if supplement:
                    supplement.image_url = url
                urls[item["id"]] = url
                result["extracted"].append({"id": item["id"], "name": item["name"], "url": url})
            result["json_updated"] = update_stored_json(script, urls)
            db.commit()
        finally:
            db.close()
    else:
        result["extracted"] = [{"id": item["id"], "name": item["name"], "filename": item["filename"]} for item in extracted]

    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"script_slug": result["script_slug"], "source_size": result["source_size"], "extracted_count": len(result["extracted"]), "json_updated": result["json_updated"]}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--preview-dir", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    run(args.manifest, args.preview_dir, args.write, args.report)


if __name__ == "__main__":
    main()

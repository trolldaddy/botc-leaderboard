"""Extract role icons from script artwork and optionally persist them to GCS/Cloud SQL."""

import argparse
import colorsys
import io
import json
import math
import sys
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image, ImageFilter, ImageStat

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


def foreground_mask(crop):
    width, height = crop.size
    border = Image.new("RGB", (40, 1))
    samples = []
    for px in range(10):
        for py in range(10):
            samples.extend((crop.getpixel((px, py))[:3], crop.getpixel((width - 1 - px, py))[:3],
                            crop.getpixel((px, height - 1 - py))[:3], crop.getpixel((width - 1 - px, height - 1 - py))[:3]))
    for index, color in enumerate(samples[:40]):
        border.putpixel((index, 0), color)
    background = ImageStat.Stat(border).median

    active = set()
    for y in range(height):
        for x in range(width):
            red, green, blue, _ = crop.getpixel((x, y))
            _, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            distance = math.sqrt(sum((channel - base) ** 2 for channel, base in zip((red, green, blue), background)))
            if distance > 48 or saturation > 0.30 or value < 0.56:
                active.add((x, y))

    components = []
    while active:
        seed = active.pop()
        stack, component = [seed], {seed}
        while stack:
            cx, cy = stack.pop()
            for nx in range(max(0, cx - 1), min(width, cx + 2)):
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    point = (nx, ny)
                    if point in active:
                        active.remove(point)
                        component.add(point)
                        stack.append(point)
        if len(component) >= 4:
            components.append(component)
    if not components:
        raise ValueError("No foreground component detected")
    components.sort(key=len, reverse=True)
    largest = components[0]
    kept = set(largest)
    largest_left = min(x for x, _ in largest)
    largest_top = min(y for _, y in largest)
    largest_right = max(x for x, _ in largest)
    largest_bottom = max(y for _, y in largest)
    margin_x = max(5, round((largest_right - largest_left + 1) * 0.18))
    margin_y = max(5, round((largest_bottom - largest_top + 1) * 0.18))
    neighborhood = (
        max(0, largest_left - margin_x),
        max(0, largest_top - margin_y),
        min(width - 1, largest_right + margin_x),
        min(height - 1, largest_bottom + margin_y),
    )
    for component in components[1:]:
        centroid = (sum(x for x, _ in component) / len(component), sum(y for _, y in component) / len(component))
        near_main_shape = (
            neighborhood[0] <= centroid[0] <= neighborhood[2]
            and neighborhood[1] <= centroid[1] <= neighborhood[3]
        )
        if len(component) >= max(5, len(largest) * 0.012) and near_main_shape:
            kept.update(component)

    mask = Image.new("L", crop.size, 0)
    mask_pixels = mask.load()
    for x, y in kept:
        mask_pixels[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(0.65))


def background_color(crop):
    width, height = crop.size
    samples = []
    for offset in range(min(10, width // 3, height // 3)):
        samples.extend(
            (
                crop.getpixel((offset, offset))[:3],
                crop.getpixel((width - 1 - offset, offset))[:3],
                crop.getpixel((offset, height - 1 - offset))[:3],
                crop.getpixel((width - 1 - offset, height - 1 - offset))[:3],
            )
        )
    channels = zip(*samples)
    return tuple(sorted(channel)[len(samples) // 2] for channel in channels)


def extract_icon(source, x, y, crop_size, output_size, output_padding=24, remove_background=True):
    half = crop_size // 2
    box = (x - half, y - half, x + half, y + half)
    if box[0] < 0 or box[1] < 0 or box[2] > source.width or box[3] > source.height:
        raise ValueError(f"Crop {box} exceeds source size {source.size}")
    crop = source.crop(box)
    if not remove_background:
        mask = foreground_mask(crop)
        bounds = mask.getbbox()
        if not bounds:
            raise ValueError(f"No foreground bounds detected at {(x, y)}")
        icon = crop.crop(bounds).convert("RGB")
        available = output_size - output_padding * 2
        scale = min(available / icon.width, available / icon.height)
        size = (max(1, round(icon.width * scale)), max(1, round(icon.height * scale)))
        icon = icon.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (output_size, output_size), background_color(crop))
        canvas.paste(icon, ((output_size - size[0]) // 2, (output_size - size[1]) // 2))
        output = io.BytesIO()
        canvas.save(output, "WEBP", quality=95, method=6)
        return output.getvalue()
    mask = foreground_mask(crop)
    bounds = mask.getbbox()
    if not bounds:
        raise ValueError(f"No foreground bounds detected at {(x, y)}")
    icon = crop.crop(bounds)
    mask = mask.crop(bounds)
    available = output_size - output_padding * 2
    scale = min(available / icon.width, available / icon.height)
    size = (max(1, round(icon.width * scale)), max(1, round(icon.height * scale)))
    icon = icon.resize(size, Image.Resampling.LANCZOS)
    mask = mask.resize(size, Image.Resampling.LANCZOS)
    icon.putalpha(mask)
    canvas = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((output_size - size[0]) // 2, (output_size - size[1]) // 2))
    output = io.BytesIO()
    canvas.save(output, "WEBP", quality=95, method=6)
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
    output_padding = int(manifest.get("output_padding", 24))
    remove_background = bool(manifest.get("remove_background", True))
    roles = manifest.get("roles") or []
    if len({item["id"] for item in roles}) != len(roles):
        raise ValueError("Role IDs in extraction manifest must be unique")

    extracted = []
    for item in roles:
        role_crop_size = int(item.get("crop_size", crop_size))
        data = extract_icon(
            source,
            int(item["x"]),
            int(item["y"]),
            role_crop_size,
            output_size,
            output_padding,
            remove_background,
        )
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

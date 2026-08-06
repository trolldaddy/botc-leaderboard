"""Import one reviewed Bilibili article. BOTC JSON is the only role-list authority."""
import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sqlalchemy import func, or_  # noqa: E402
from opencc import OpenCC  # noqa: E402
from database import Base, SessionLocal, engine  # noqa: E402
from role_models import Role, RoleAlias  # noqa: E402
from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement  # noqa: E402

TO_TRADITIONAL = OpenCC("s2twp")
SPECIAL_ENTRY_TYPES = {"fabled", "jinx", "loric", "special"}
ROLE_CATALOG_PATH = Path(__file__).resolve().parents[1] / "static" / "js" / "roles_db.js"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def normalized_role_name(value):
    converted = TO_TRADITIONAL.convert(str(value or "").strip())
    return re.sub(r"^[^0-9a-zA-Z\u4e00-\u9fff]+", "", converted).casefold()


def normalized_role_id(value):
    """Compare common BOTC IDs regardless of separators or letter case."""
    return re.sub(r"[^0-9a-z]+", "", str(value or "").strip().casefold())


def load_official_role_catalog(path=ROLE_CATALOG_PATH):
    """Read the browser's authoritative built-in role list without executing JS."""
    by_id, by_name = {}, {}
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if "{id:" not in line:
            continue
        fields = dict(re.findall(r'(id|name|team|image):"([^"]*)"', line))
        if not fields.get("id") or not fields.get("name") or not fields.get("team"):
            continue
        item = {
            "id": fields["id"],
            "name": fields["name"],
            "team": fields["team"].lower(),
            "image": fields.get("image", ""),
        }
        by_id[normalized_role_id(item["id"])] = item
        by_name[normalized_role_name(item["name"])] = item
    return {"by_id": by_id, "by_name": by_name}


OFFICIAL_ROLE_CATALOG = load_official_role_catalog()


def find_catalog_role(reference):
    role = OFFICIAL_ROLE_CATALOG["by_id"].get(normalized_role_id(reference.get("id")))
    if role:
        return role
    for candidate in (reference.get("name"), reference.get("id")):
        role = OFFICIAL_ROLE_CATALOG["by_name"].get(normalized_role_name(candidate))
        if role:
            return role
    return None


def text_field(value):
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, str) and item.strip()), "")
    return str(value or "").strip() if not isinstance(value, dict) else ""


def role_references_from_json(path):
    payload = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError("劇本 JSON 必須是陣列")
    result = []
    for item in payload:
        value = item.get("id") if isinstance(item, dict) else item
        if value and str(value).lower() != "_meta":
            result.append({
                "id": str(value).strip(),
                "name": text_field(item.get("name")) if isinstance(item, dict) else "",
                "team": text_field(item.get("team")).lower() if isinstance(item, dict) else "",
                "image": text_field(item.get("image")) if isinstance(item, dict) else "",
                "ability": text_field(item.get("ability")) if isinstance(item, dict) else "",
            })
    return result


def role_ids_from_json(path):
    return [item["id"] for item in role_references_from_json(path)]


def find_role(db, reference):
    key = reference["id"].lower()
    source_name = reference.get("name", "")
    name = TO_TRADITIONAL.convert(source_name).lower() if source_name else ""
    role = db.query(Role).filter(or_(func.lower(Role.canonical_key) == key,
                                     func.lower(Role.name_zh_tw) == name if name else False)).first()
    if role:
        return role
    alias = db.query(RoleAlias).filter(or_(func.lower(RoleAlias.external_id) == key,
                                           func.lower(RoleAlias.external_name) == name if name else False)).first()
    if alias:
        return db.query(Role).filter(Role.id == alias.role_id).first()

    compact_key = normalized_role_id(key)
    if compact_key:
        role = next((item for item in db.query(Role).all()
                     if normalized_role_id(item.canonical_key) == compact_key), None)
        if role:
            return role
        alias = next((item for item in db.query(RoleAlias).all()
                      if normalized_role_id(item.external_id) == compact_key), None)
        if alias:
            return db.query(Role).filter(Role.id == alias.role_id).first()
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("metadata", type=Path)
    parser.add_argument("script_json", type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    metadata = json.loads(args.metadata.read_text(encoding="utf-8-sig"))
    references = role_references_from_json(args.script_json)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        matched, catalog_matched, missing, supplements = [], [], [], []
        duplicate_references, seen_official, seen_supplements = [], set(), set()
        for reference in references:
            role = find_role(db, reference)
            if role:
                identity = normalized_role_id(role.canonical_key) or f"db:{role.id}"
                if identity in seen_official:
                    duplicate_references.append(reference)
                    continue
                seen_official.add(identity)
                matched.append(role)
                continue
            catalog_role = find_catalog_role(reference)
            if catalog_role:
                identity = normalized_role_id(catalog_role["id"])
                if identity in seen_official:
                    duplicate_references.append(reference)
                    continue
                seen_official.add(identity)
                catalog_matched.append({"reference": reference, "catalog_role": catalog_role})
            elif reference.get("team"):
                identity = normalized_role_id(reference.get("id")) or normalized_role_name(reference.get("name"))
                if identity and identity in seen_supplements:
                    duplicate_references.append(reference)
                    continue
                if identity:
                    seen_supplements.add(identity)
                supplements.append(reference)
            else:
                missing.append(reference)
        report = {
            "mode": "write" if args.write else "preview",
            "script": metadata["name_zh_tw"],
            "entries_found": len(references),
            "roles_matched": len(matched) + len(catalog_matched),
            "database_roles_matched": len(matched),
            "catalog_roles_matched": len(catalog_matched),
            "database_roles_missing": [item["reference"] for item in catalog_matched],
            "special_entries_preserved": len(supplements),
            "roles_missing": missing,
            "duplicate_entries_ignored": duplicate_references,
        }
        if args.require_complete and missing:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            raise SystemExit("Script role matching is incomplete; refusing to continue")
        if args.write and catalog_matched:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            raise SystemExit("Official roles exist in the catalog but not in the target database; refusing to misclassify or write them")
        if not args.write:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return
        script = db.query(ScriptEntry).filter(ScriptEntry.slug == metadata["slug"]).first()
        if not script:
            script = ScriptEntry(slug=metadata["slug"], name_zh_tw=metadata["name_zh_tw"])
            db.add(script)
            db.flush()
        for field in ("name_zh_tw", "version", "category", "introduction", "author_name",
                      "tagline", "tags", "background_introduction", "gameplay_overview",
                      "author_note", "production_updates", "player_guide", "storyteller_guide",
                      "source_url", "source_platform", "source_external_id"):
            if field in metadata:
                value = metadata[field]
                if field == "tags" and isinstance(value, list):
                    value = json.dumps(value, ensure_ascii=False)
                setattr(script, field, value)
        script.published_at = datetime.fromisoformat(metadata["published_at"]) if metadata.get("published_at") else None
        script.is_public = bool(metadata.get("is_public")) and not missing and (len(matched) + len(supplements)) >= 5
        script.needs_review = bool(missing) or (len(matched) + len(supplements)) < 5
        db.query(ScriptImage).filter(ScriptImage.script_id == script.id).delete(synchronize_session=False)
        db.query(ScriptRole).filter(ScriptRole.script_id == script.id).delete(synchronize_session=False)
        db.query(ScriptSupplement).filter(ScriptSupplement.script_id == script.id).delete(synchronize_session=False)
        db.flush()
        for index, image in enumerate(metadata.get("images", [])):
            script.images.append(ScriptImage(image_url=image["url"], alt_text=image.get("alt"), sort_order=index))
        for index, role in enumerate(matched):
            script.roles.append(ScriptRole(role_id=role.id, sort_order=index))
        for index, item in enumerate(supplements):
            script.supplements.append(ScriptSupplement(
                external_id=item["id"],
                name_zh_tw=TO_TRADITIONAL.convert(item.get("name") or item["id"]),
                entry_type=item.get("team") or "special",
                image_url=item.get("image") or None,
                ability=TO_TRADITIONAL.convert(item.get("ability") or "") or None,
                sort_order=index,
            ))
        db.commit()
        report.update(published=script.is_public, needs_review=script.needs_review)
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()

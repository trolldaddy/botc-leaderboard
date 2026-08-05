"""Import one reviewed Bilibili article. BOTC JSON is the only role-list authority."""
import argparse
import json
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
                "name": (item.get("name") or "").strip() if isinstance(item, dict) else "",
                "team": (item.get("team") or "").strip().lower() if isinstance(item, dict) else "",
                "image": (item.get("image") or "").strip() if isinstance(item, dict) else "",
                "ability": (item.get("ability") or "").strip() if isinstance(item, dict) else "",
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
    return db.query(Role).filter(Role.id == alias.role_id).first() if alias else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("metadata", type=Path)
    parser.add_argument("script_json", type=Path)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    metadata = json.loads(args.metadata.read_text(encoding="utf-8-sig"))
    references = role_references_from_json(args.script_json)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        matched, missing, supplements = [], [], []
        for reference in references:
            role = find_role(db, reference)
            if role:
                matched.append(role)
            elif reference.get("team") in SPECIAL_ENTRY_TYPES:
                supplements.append(reference)
            else:
                missing.append(reference)
        report = {
            "mode": "write" if args.write else "preview",
            "script": metadata["name_zh_tw"],
            "entries_found": len(references),
            "roles_matched": len(matched),
            "special_entries_preserved": len(supplements),
            "roles_missing": missing,
        }
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
        script.is_public = bool(metadata.get("is_public")) and not missing and len(matched) >= 5
        script.needs_review = bool(missing) or len(matched) < 5
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

"""Pair an archived BOTC JSON bundle with ScriptEntry rows and localize role data."""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import joinedload  # noqa: E402

from database import SessionLocal  # noqa: E402
from role_models import Role, RoleAlias  # noqa: E402
from script_models import ScriptEntry, ScriptRole  # noqa: E402
from scripts.import_bilibili_script import TO_TRADITIONAL, normalized_entry_type  # noqa: E402
from script_import_service import normalized_script_payload  # noqa: E402

DEFAULT_ARCHIVE = ROOT / "data" / "script-json-archive"
DEFAULT_REPORT = ROOT / "reports" / "script-json-pairing.json"


def normalized(value):
    value = TO_TRADITIONAL.convert(str(value or "")).casefold()
    value = re.sub(r"^(?:new|nojinx|jinx改travel|原版|新夜序|\d+)#?", "", value)
    value = re.sub(r"v?\d+(?:\.\d+)*|公測版|測試版|原版", "", value)
    value = re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", value)
    return value.replace("希望與絕望間", "希望與絕望之間").replace("斗轉", "鬥轉")


PREFERRED_FILES = {
    normalized("共生體"): "原版共生体-蓝铃兰-20260801.json",
    normalized("魚躍龍門"): "鱼跃龙门-北风-20251122.json",
    normalized("夜半狂歡"): "新夜序#夜半狂欢-Zets.json",
}


def read_candidate(path):
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    entries = payload if isinstance(payload, list) else payload.get("roles", [])
    if not isinstance(entries, list):
        raise ValueError("JSON roles must be an array")
    meta = next((item for item in entries if isinstance(item, dict) and item.get("id") == "_meta"), {})
    return {
        "path": path,
        "payload": payload,
        "entries": entries,
        "name": meta.get("name") or path.stem,
        "author": meta.get("author") or "",
        "entry_count": sum(1 for item in entries if not isinstance(item, dict) or item.get("id") != "_meta"),
    }


def match_score(script, candidate):
    script_name = normalized(script.name_zh_tw)
    candidate_name = normalized(candidate["name"])
    file_name = normalized(candidate["path"].stem)
    score, reasons = 0, []
    if script_name and script_name == candidate_name:
        score += 120
        reasons.append("metadata-name")
    elif script_name and (script_name in candidate_name or candidate_name in script_name):
        score += 85
        reasons.append("metadata-name-partial")
    if script_name and script_name in file_name:
        score += 95
        reasons.append("filename")
    elif script_name and len(script_name) >= 2 and (script_name[:2] in file_name or file_name[:2] in script_name):
        score += 35
        reasons.append("filename-prefix")
    if normalized(script.author_name) and normalized(script.author_name) == normalized(candidate["author"]):
        score += 15
        reasons.append("author")
    expected = len(script.roles) + len(script.supplements)
    difference = abs(expected - candidate["entry_count"])
    if expected:
        score += max(0, 20 - difference * 4)
        reasons.append(f"role-count:{candidate['entry_count']}/{expected}")
    if candidate["path"].stem.startswith("原版"):
        score -= 8
    if candidate["path"].stem.startswith("新夜序"):
        score += 3
    return score, reasons


def role_indexes(db):
    roles = db.query(Role).filter(Role.is_active == True).all()  # noqa: E712
    by_id = {normalized(role.canonical_key): role for role in roles}
    by_name = {normalized(role.name_zh_tw): role for role in roles}
    aliases = db.query(RoleAlias).options(joinedload(RoleAlias.role)).all()
    for alias in aliases:
        if alias.role and alias.role.is_active:
            by_id.setdefault(normalized(alias.external_id), alias.role)
            if alias.external_name:
                by_name.setdefault(normalized(alias.external_name), alias.role)
    return by_id, by_name


def localize(script, candidate, by_id, by_name):
    source = candidate["entries"]
    output = []
    matched_roles = 0
    unresolved = []
    official = [item.role for item in sorted(script.roles, key=lambda row: (row.sort_order, row.id)) if item.role]
    supplements = sorted(script.supplements, key=lambda row: (row.sort_order, row.id))
    official_index = 0
    supplement_index = 0
    for index, raw in enumerate(source):
        if isinstance(raw, str):
            raw = {"id": raw}
        if not isinstance(raw, dict):
            continue
        if raw.get("id") == "_meta":
            output.append({**raw, "name": script.name_zh_tw, "author": script.author_name or raw.get("author") or ""})
            continue
        item = dict(raw)
        special = normalized_entry_type(item.get("team")) in {"fabled", "jinx", "loric", "special"}
        role = by_id.get(normalized(item.get("id"))) or by_name.get(normalized(item.get("name")))
        if not special:
            positional_role = official[official_index] if official_index < len(official) else None
            official_index += 1
            role = role or positional_role
        if role:
            matched_roles += 1
            item.update({
                "id": role.canonical_key,
                "name": role.name_zh_tw,
                "team": role.team,
                "ability": role.ability_zh_tw or TO_TRADITIONAL.convert(str(item.get("ability") or "")),
                "image": role.image_url or item.get("image") or "",
                "firstNight": role.first_night_order or 0,
                "otherNight": role.other_night_order or 0,
                "firstNightReminder": role.first_night_reminder or "",
                "otherNightReminder": role.other_night_reminder or "",
            })
        elif special and supplement_index < len(supplements):
            supplement = supplements[supplement_index]
            supplement_index += 1
            item.update({
                "id": supplement.external_id,
                "name": supplement.name_zh_tw,
                "team": supplement.entry_type,
                "ability": supplement.ability or TO_TRADITIONAL.convert(str(item.get("ability") or "")),
                "image": supplement.image_url or item.get("image") or "",
            })
        else:
            item["name"] = TO_TRADITIONAL.convert(str(item.get("name") or item.get("id") or "自創角色"))
            item["team"] = normalized_entry_type(item.get("team"))
            for field in ("ability", "firstNightReminder", "otherNightReminder"):
                item[field] = TO_TRADITIONAL.convert(str(item.get(field) or ""))
            unresolved.append({"index": index, "id": item.get("id"), "name": item.get("name")})
        output.append(item)
    if not any(isinstance(item, dict) and item.get("id") == "_meta" for item in output):
        output.insert(0, {"id": "_meta", "name": script.name_zh_tw, "author": script.author_name or ""})
    return output, matched_roles, unresolved


def run(archive, report_path, write=False):
    candidates, invalid = [], []
    for path in sorted(archive.iterdir()):
        if path.is_file() and path.suffix.lower() == ".json":
            try:
                candidates.append(read_candidate(path))
            except Exception as exc:
                invalid.append({"file": path.name, "error": str(exc)})

    db = SessionLocal()
    try:
        scripts = db.query(ScriptEntry).options(
            joinedload(ScriptEntry.roles).joinedload(ScriptRole.role),
            joinedload(ScriptEntry.supplements),
        ).order_by(ScriptEntry.id).all()
        by_id, by_name = role_indexes(db)
        rows, used = [], set()
        for script in scripts:
            ranked = []
            for candidate in candidates:
                score, reasons = match_score(script, candidate)
                ranked.append((score, candidate, reasons))
            ranked.sort(key=lambda row: (-row[0], row[1]["path"].name))
            score, selected, reasons = ranked[0]
            runner_up = ranked[1][0] if len(ranked) > 1 else 0
            preferred_name = PREFERRED_FILES.get(normalized(script.name_zh_tw))
            if preferred_name:
                preferred = next((row for row in ranked if row[1]["path"].name == preferred_name), None)
                if preferred:
                    score, selected, reasons = preferred
                    reasons = [*reasons, "preferred-reviewed-version"]
            generated = score < 90
            ambiguous = not generated and runner_up >= score - 5 and not preferred_name
            row = {
                "script_id": script.id,
                "slug": script.slug,
                "script_name": script.name_zh_tw,
                "selected_file": selected["path"].name if not (ambiguous or generated) else None,
                "score": score,
                "runner_up_score": runner_up,
                "reasons": reasons,
                "status": "ambiguous" if ambiguous else ("database-generated" if generated else "matched"),
                "alternatives": [{"file": item[1]["path"].name, "score": item[0]} for item in ranked[:3]],
            }
            if generated:
                supplement_payload = [{
                    "id": item.external_id, "name": item.name_zh_tw, "team": item.entry_type,
                    "ability": item.ability or "", "image": item.image_url or "",
                } for item in sorted(script.supplements, key=lambda value: (value.sort_order, value.id))]
                localized = normalized_script_payload(
                    script.name_zh_tw,
                    script.author_name,
                    [item.role for item in sorted(script.roles, key=lambda value: (value.sort_order, value.id)) if item.role],
                    supplement_payload,
                )
                row.update({"matched_roles": len(script.roles), "unresolved_roles": [], "reason": "no-archive-title-match"})
            elif not ambiguous:
                localized, matched_roles, unresolved = localize(script, selected, by_id, by_name)
                row.update({"matched_roles": matched_roles, "unresolved_roles": unresolved})
                used.add(selected["path"].name)
            if not ambiguous and write:
                script.script_json = json.dumps(localized, ensure_ascii=False, indent=2)
                script.script_json_filename = f"{script.slug}.json"
                script.script_json_updated_at = datetime.now()
            rows.append(row)
        if write:
            if any(row["status"] == "ambiguous" for row in rows):
                raise RuntimeError("Refusing partial write because one or more scripts are ambiguous")
            db.commit()
        report = {
            "mode": "write" if write else "preview",
            "script_count": len(scripts),
            "candidate_count": len(candidates),
            "matched_count": sum(row["status"] == "matched" for row in rows),
            "generated_count": sum(row["status"] == "database-generated" for row in rows),
            "ambiguous_count": sum(row["status"] == "ambiguous" for row in rows),
            "scripts": rows,
            "unused_files": sorted(candidate["path"].name for candidate in candidates if candidate["path"].name not in used),
            "invalid_files": invalid,
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({key: report[key] for key in ("mode", "script_count", "candidate_count", "matched_count", "generated_count", "ambiguous_count")}, ensure_ascii=False))
        return 0 if (not write or not report["ambiguous_count"]) else 2
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    raise SystemExit(run(args.archive, args.report, args.write))


if __name__ == "__main__":
    main()

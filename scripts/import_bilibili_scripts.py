"""Audit and batch-import the reviewed Bilibili script manifest."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

from opencc import OpenCC

TO_TRADITIONAL = OpenCC("s2twp")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def normalized(value):
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", TO_TRADITIONAL.convert(str(value or "")).lower())


def script_name(path):
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError, json.JSONDecodeError):
        return ""
    if not isinstance(payload, list):
        return ""
    meta = next((item for item in payload if isinstance(item, dict) and item.get("id") == "_meta"), None)
    return (meta or {}).get("name") or path.stem


def discover_json(search_roots):
    candidates = []
    for root in search_roots:
        if not root.exists():
            continue
        for path in root.rglob("*.json"):
            name = script_name(path)
            if name:
                candidates.append({"path": path, "name": name, "key": normalized(name)})
    return candidates


def metadata_by_external_id(directories):
    indexed = {}
    for directory in directories:
        if not directory.exists():
            continue
        for path in directory.glob("*.json"):
            try:
                payload = json.loads(path.read_text(encoding="utf-8-sig"))
            except (OSError, ValueError, json.JSONDecodeError):
                continue
            if isinstance(payload, dict) and payload.get("source_external_id"):
                indexed.setdefault(str(payload["source_external_id"]), path)
    return indexed


def best_json(name, candidates):
    key = normalized(name)
    if not key:
        return None
    exact = [item for item in candidates if item["key"] == key]
    if exact:
        return exact[0]
    partial = [item for item in candidates if len(key) >= 3 and (key in item["key"] or item["key"] in key)]
    return partial[0] if len(partial) == 1 else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("scripts/bilibili_script_manifest.json"))
    parser.add_argument("--metadata-dir", type=Path, default=Path("reports/bilibili-scripts"))
    parser.add_argument("--existing-metadata-dir", type=Path, default=Path("data/scripts"))
    parser.add_argument("--json-root", action="append", type=Path, default=[])
    parser.add_argument("--report", type=Path, help="Write the complete batch audit as JSON.")
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--require-complete", action="store_true")
    args = parser.parse_args()
    roots = args.json_root or [
        Path("reports/bilibili-script-json"),
        Path.home() / "Downloads",
        Path.home() / ".codex" / "attachments",
        Path("data/scripts"),
    ]
    manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    candidates = discover_json(roots)
    metadata_index = metadata_by_external_id([args.existing_metadata_dir, args.metadata_dir])
    report = []
    failed = False
    for item in manifest["items"]:
        external_id = item["external_id"]
        metadata_path = metadata_index.get(str(external_id), args.metadata_dir / f"{external_id}.json")
        metadata = None
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
        name = item.get("name_zh_tw") or (metadata or {}).get("name_zh_tw") or ""
        explicit_json = Path(item["script_json"]) if item.get("script_json") else None
        match = (
            {"path": explicit_json, "name": script_name(explicit_json), "key": normalized(name)}
            if explicit_json and explicit_json.exists()
            else best_json(name, candidates)
        )
        row = {
            "external_id": external_id, "name_zh_tw": name,
            "metadata": str(metadata_path) if metadata_path.exists() else None,
            "script_json": str(match["path"]) if match else None,
            "status": "ready" if metadata and match else "missing_metadata" if not metadata else "missing_json",
        }
        if row["status"] != "ready":
            failed = True
            report.append(row)
            continue
        command = [sys.executable, "scripts/import_bilibili_script.py", str(metadata_path), str(match["path"])]
        if args.write:
            command.append("--write")
        if args.require_complete:
            command.append("--require-complete")
        result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
        row["status"] = "imported" if args.write and result.returncode == 0 else "previewed" if result.returncode == 0 else "failed"
        raw_output = (result.stdout or "").strip()
        try:
            row["result"] = json.loads(raw_output) if raw_output else None
        except json.JSONDecodeError:
            row["output"] = raw_output
        row["error"] = (result.stderr or "").strip()
        if result.returncode:
            failed = True
        report.append(row)
    statuses = {}
    for row in report:
        statuses[row["status"]] = statuses.get(row["status"], 0) + 1
    completed_results = [row.get("result") or {} for row in report if row["status"] in {"previewed", "imported"}]
    payload = {
        "mode": "write" if args.write else "preview",
        "manifest_items": len(manifest["items"]),
        "json_candidates": len(candidates),
        "summary": statuses,
        "import_summary": {
            "entries_found": sum(result.get("entries_found", 0) for result in completed_results),
            "roles_matched": sum(result.get("roles_matched", 0) for result in completed_results),
            "special_entries_preserved": sum(result.get("special_entries_preserved", 0) for result in completed_results),
            "roles_missing": sum(len(result.get("roles_missing") or []) for result in completed_results),
            "duplicate_entries_ignored": sum(len(result.get("duplicate_entries_ignored") or []) for result in completed_results),
        },
        "missing_json_names": [row["name_zh_tw"] for row in report if row["status"] == "missing_json"],
        "complete": not failed,
        "items": report,
    }
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if args.require_complete and failed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()




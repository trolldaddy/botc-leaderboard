import json
import tempfile
from pathlib import Path

from scripts.import_bilibili_scripts import best_json, discover_json, normalized, script_name


def fixture_root():
    root = Path(tempfile.gettempdir()) / "botc-bilibili-batch-test"
    root.mkdir(parents=True, exist_ok=True)
    return root


def test_normalized_matches_simplified_and_traditional_names():
    assert normalized("共生体 V2") == normalized("共生體-v2")


def test_discovery_reads_meta_name_and_exact_match():
    root = fixture_root()
    path = root / "opaque.json"
    path.write_text(json.dumps([{"id": "_meta", "name": "共生体"}]), encoding="utf-8")
    candidates = discover_json([root])
    assert script_name(path) == "共生体"
    assert best_json("共生體", candidates)["path"] == path


def test_ambiguous_partial_match_is_rejected():
    candidates = [
        {"path": Path("a.json"), "name": "未來之主 A", "key": normalized("未來之主 A")},
        {"path": Path("b.json"), "name": "未來之主 B", "key": normalized("未來之主 B")},
    ]
    assert best_json("未來之主", candidates) is None


def test_batch_write_requires_complete_preview():
    source = Path(__file__).with_name("import_bilibili_scripts.py").read_text(encoding="utf-8")
    preview_gate = source.index("if args.write and not failed:")
    write_flag = source.index('row["metadata"], row["script_json"], "--write"', preview_gate)
    assert preview_gate < write_flag


def test_workflow_imports_the_complete_manifest():
    workflow = (Path(__file__).resolve().parents[1] / ".github/workflows/seed-bilibili-script.yml").read_text(encoding="utf-8")
    assert "scripts/import_bilibili_scripts.py" in workflow
    assert "--require-complete" in workflow
    assert "bilibili-script-audit.json" in workflow


if __name__ == "__main__":
    test_normalized_matches_simplified_and_traditional_names()
    test_discovery_reads_meta_name_and_exact_match()
    test_ambiguous_partial_match_is_rejected()
    test_batch_write_requires_complete_preview()
    test_workflow_imports_the_complete_manifest()
    print({"status": "ok"})
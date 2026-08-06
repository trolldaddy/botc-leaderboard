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


if __name__ == "__main__":
    test_normalized_matches_simplified_and_traditional_names()
    test_discovery_reads_meta_name_and_exact_match()
    test_ambiguous_partial_match_is_rejected()
    print({"status": "ok"})
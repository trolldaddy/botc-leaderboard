import json
import tempfile
from pathlib import Path

from scripts.import_bilibili_script import role_ids_from_json, role_references_from_json


def test_script_json_ignores_meta_and_keeps_names():
    path = Path(tempfile.gettempdir()) / "botc-script-import-test.json"
    path.write_text(json.dumps([{"id": "_meta", "name": "測試"}, {"id": "20002_20", "name": "调查员"}]), encoding="utf-8")
    assert role_ids_from_json(path) == ["20002_20"]
    assert role_references_from_json(path)[0]["name"] == "调查员"



def test_script_json_ignores_fabled_entries():
    path = Path(tempfile.gettempdir()) / "botc-script-import-fabled-test.json"
    path.write_text(json.dumps([
        {"id": "investigator", "name": "调查员", "team": "townsfolk"},
        {"id": "_custom", "name": "自訂傳奇", "team": "fabled"},
    ]), encoding="utf-8")
    assert role_ids_from_json(path) == ["investigator"]

if __name__ == "__main__":
    test_script_json_ignores_meta_and_keeps_names()
    test_script_json_ignores_fabled_entries()
    print({"status": "ok"})
